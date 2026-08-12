import { useState, useEffect } from 'react'
import {
  getSchedules, saveSchedules,
  getTodos, saveTodos,
  getConsultations, saveConsultations,
} from '../firebase'
import { getToday, formatDate, daysUntil } from '../utils'

const PERIOD_OPTIONS = ['1교시','2교시','3교시','4교시','5교시','6교시','7교시','방과후']

function isPeriodValue(v) {
  if (!v) return false
  const base = v.split('~')[0]
  return PERIOD_OPTIONS.includes(base)
}

function TimeInput({ value, onChange, mode, onModeChange }) {
  const parseRange = (v) => {
    if (!v) return { start: '', end: '' }
    const parts = v.split('~')
    return { start: parts[0] || '', end: parts[1] || '' }
  }
  const { start, end } = parseRange(value)

  const updatePeriod = (newStart, newEnd) => {
    if (!newStart) { onChange(''); return }
    const si = PERIOD_OPTIONS.indexOf(newStart)
    const ei = PERIOD_OPTIONS.indexOf(newEnd)
    if (newEnd && ei > si) onChange(`${newStart}~${newEnd}`)
    else onChange(newStart)
  }

  return (
    <div style={{display:'flex',gap:'6px',alignItems:'stretch'}}>
      {mode === 'text' ? (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="HH:MM (선택)"
          style={{flex:1}}
        />
      ) : (
        <div style={{flex:1,display:'flex',gap:'4px',alignItems:'center'}}>
          <select value={start} onChange={e => updatePeriod(e.target.value, end)} style={{flex:1}}>
            <option value="">교시 선택</option>
            {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {start && (
            <>
              <span style={{fontSize:'0.78rem',color:'var(--gray-400)',flexShrink:0}}>~</span>
              <select value={end} onChange={e => updatePeriod(start, e.target.value)} style={{flex:1}}>
                <option value="">단일</option>
                {PERIOD_OPTIONS.slice(PERIOD_OPTIONS.indexOf(start) + 1).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => { onModeChange(mode === 'text' ? 'period' : 'text'); onChange('') }}
        style={{flexShrink:0,padding:'0 10px',minHeight:'42px',whiteSpace:'nowrap'}}
      >
        {mode === 'text' ? '교시▼' : '직접입력'}
      </button>
    </div>
  )
}

// ── 🗣️ 상담 ──────────────────────────────────────────────────
function ConsultationManager() {
  const [items,        setItems]        = useState([])
  const [form,         setForm]         = useState({ date: getToday(), time: '', studentName: '', memo: '' })
  const [timeMode,     setTimeMode]     = useState('period')
  const [saving,       setSaving]       = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [editForm,     setEditForm]     = useState({ date:'', time:'', studentName:'', memo:'' })
  const [editTimeMode, setEditTimeMode] = useState('period')
  const [showPast,     setShowPast]     = useState(false)

  useEffect(() => {
    getConsultations().then(data =>
      setItems([...data].sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)))
    )
  }, [])

  const today    = getToday()
  const upcoming = items.filter(i => i.date >= today)
  const past     = items.filter(i => i.date < today)

  const add = async () => {
    if (!form.studentName.trim()) return
    const updated = [...items, { ...form, id: Date.now().toString() }]
      .sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    setSaving(true)
    await saveConsultations(updated)
    setItems(updated)
    setForm({ date: getToday(), time: '', studentName: '', memo: '' })
    setSaving(false)
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditForm({ date: item.date, time: item.time||'', studentName: item.studentName||'', memo: item.memo||'' })
    setEditTimeMode(isPeriodValue(item.time) ? 'period' : 'text')
  }

  const saveEdit = async () => {
    const updated = items.map(i => i.id === editId ? { ...i, ...editForm } : i)
      .sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    await saveConsultations(updated)
    setItems(updated)
    setEditId(null)
  }

  const remove = async (id) => {
    const updated = items.filter(i => i.id !== id)
    await saveConsultations(updated)
    setItems(updated)
  }

  const renderItem = (item) =>
    editId === item.id ? (
      <div key={item.id} className="inline-edit-card">
        <input type="date" value={editForm.date} onChange={e=>setEditForm(p=>({...p,date:e.target.value}))} />
        <TimeInput value={editForm.time} onChange={v=>setEditForm(p=>({...p,time:v}))} mode={editTimeMode} onModeChange={setEditTimeMode} />
        <input
          value={editForm.studentName}
          onChange={e=>setEditForm(p=>({...p,studentName:e.target.value}))}
          placeholder="학생명"
        />
        <input
          value={editForm.memo}
          onChange={e=>setEditForm(p=>({...p,memo:e.target.value}))}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
          placeholder="메모"
          autoFocus
        />
        <div style={{display:'flex',gap:'8px'}}>
          <button className="btn btn-primary btn-sm" onClick={saveEdit}>저장</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>취소</button>
        </div>
      </div>
    ) : (
      <div key={item.id} className="schedule-item">
        <div style={{flex:1}}>
          <div style={{fontSize:'0.78rem',color:'var(--pink-600)',fontWeight:700}}>
            {formatDate(item.date)}{item.time ? ` ${item.time}` : ''}
          </div>
          <div style={{fontSize:'0.9rem',fontWeight:600}}>{item.studentName}</div>
          {item.memo && <div style={{fontSize:'0.8rem',color:'var(--gray-500)',marginTop:'2px'}}>{item.memo}</div>}
        </div>
        <div style={{display:'flex',gap:'4px',alignItems:'center',flexShrink:0}}>
          <button className="icon-btn icon-btn-edit" onClick={() => startEdit(item)} title="수정">✏️</button>
          <button className="btn btn-danger btn-icon" onClick={() => remove(item.id)}>✕</button>
        </div>
      </div>
    )

  return (
    <section className="card">
      <div className="section-label">🗣️ 상담 관리</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
        <TimeInput value={form.time} onChange={v=>setForm(p=>({...p,time:v}))} mode={timeMode} onModeChange={setTimeMode} />
        <input
          value={form.studentName}
          onChange={e=>setForm(p=>({...p,studentName:e.target.value}))}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="학생명"
        />
        <textarea
          value={form.memo}
          onChange={e=>setForm(p=>({...p,memo:e.target.value}))}
          placeholder="메모 (선택)"
          rows={2}
          style={{resize:'vertical'}}
        />
        <button className="btn btn-primary" onClick={add} disabled={saving}>+ 추가</button>
      </div>

      {upcoming.length === 0 && past.length === 0 && <div className="empty">등록된 상담이 없어요</div>}
      {upcoming.length === 0 && past.length > 0 && <div className="empty">예정된 상담이 없어요</div>}
      {upcoming.map(renderItem)}

      {past.length > 0 && (
        <>
          <button
            onClick={() => setShowPast(p => !p)}
            style={{
              width:'100%',marginTop:'8px',padding:'8px',
              background:'none',border:'1px dashed var(--gray-300)',
              borderRadius:'8px',color:'var(--gray-400)',fontSize:'0.82rem',cursor:'pointer'
            }}
          >
            {showPast ? '지난 상담 접기 ▲' : `지난 상담 보기 ▼ (${past.length}건)`}
          </button>
          {showPast && past.map(renderItem)}
        </>
      )}
    </section>
  )
}

// ── 📌 일정 ──────────────────────────────────────────────────
function ScheduleManager() {
  const [items,        setItems]        = useState([])
  const [form,         setForm]         = useState({ date: getToday(), time: '', content: '', todoContent: '', todoDate: '' })
  const [timeMode,     setTimeMode]     = useState('period')
  const [showTodo,     setShowTodo]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [editForm,     setEditForm]     = useState({ date:'', time:'', content:'' })
  const [editTimeMode, setEditTimeMode] = useState('period')
  const [showPast,     setShowPast]     = useState(false)

  useEffect(() => {
    getSchedules().then(data =>
      setItems([...data].sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)))
    )
  }, [])

  const today    = getToday()
  const upcoming = items.filter(i => i.date >= today)
  const past     = items.filter(i => i.date < today)

  const add = async () => {
    if (!form.content.trim()) return
    setSaving(true)

    let linkedTodo = null
    if (showTodo && form.todoContent.trim()) {
      const todoId = `todo-${Date.now()}`
      linkedTodo = { id: todoId, content: form.todoContent.trim(), dueDate: form.todoDate }
      const todos = await getTodos()
      const updatedTodos = [...todos, { id: todoId, content: linkedTodo.content, dueDate: linkedTodo.dueDate, done: false }]
      await saveTodos(updatedTodos)
    }

    const newItem = { id: Date.now().toString(), date: form.date, time: form.time, content: form.content }
    if (linkedTodo) newItem.linkedTodo = linkedTodo

    const updated = [...items, newItem]
      .sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    await saveSchedules(updated)
    setItems(updated)
    setForm({ date: getToday(), time: '', content: '', todoContent: '', todoDate: '' })
    setShowTodo(false)
    setSaving(false)
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditForm({ date: item.date, time: item.time||'', content: item.content })
    setEditTimeMode(isPeriodValue(item.time) ? 'period' : 'text')
  }

  const saveEdit = async () => {
    const updated = items.map(i => i.id === editId ? { ...i, ...editForm } : i)
      .sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    await saveSchedules(updated)
    setItems(updated)
    setEditId(null)
  }

  const remove = async (id) => {
    const updated = items.filter(i => i.id !== id)
    await saveSchedules(updated)
    setItems(updated)
  }

  const todoLabel = (td) => {
    if (!td || !td.dueDate) return ''
    const diff = daysUntil(td.dueDate)
    return diff < 0 ? `D+${-diff}` : diff === 0 ? 'D-Day' : `D-${diff}`
  }

  const renderItem = (item) =>
    editId === item.id ? (
      <div key={item.id} className="inline-edit-card">
        <input type="date" value={editForm.date} onChange={e=>setEditForm(p=>({...p,date:e.target.value}))} />
        <TimeInput value={editForm.time} onChange={v=>setEditForm(p=>({...p,time:v}))} mode={editTimeMode} onModeChange={setEditTimeMode} />
        <input
          value={editForm.content}
          onChange={e=>setEditForm(p=>({...p,content:e.target.value}))}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
          placeholder="일정 내용"
          autoFocus
        />
        <div style={{display:'flex',gap:'8px'}}>
          <button className="btn btn-primary btn-sm" onClick={saveEdit}>저장</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>취소</button>
        </div>
      </div>
    ) : (
      <div key={item.id} className="schedule-item">
        <div style={{flex:1}}>
          <div style={{fontSize:'0.78rem',color:'var(--pink-600)',fontWeight:700}}>
            {formatDate(item.date)}{item.time ? ` ${item.time}` : ''}
          </div>
          <div style={{fontSize:'0.9rem'}}>{item.content}</div>
          {item.linkedTodo && (
            <div style={{fontSize:'0.72rem',color:'var(--gray-500)',marginTop:'3px'}}>
              📎 {item.linkedTodo.content} <span style={{fontWeight:700}}>{todoLabel(item.linkedTodo)}</span>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:'4px',alignItems:'center',flexShrink:0}}>
          <button className="icon-btn icon-btn-edit" onClick={() => startEdit(item)} title="수정">✏️</button>
          <button className="btn btn-danger btn-icon" onClick={() => remove(item.id)}>✕</button>
        </div>
      </div>
    )

  return (
    <section className="card">
      <div className="section-label">📌 일정 관리</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
        <TimeInput value={form.time} onChange={v=>setForm(p=>({...p,time:v}))} mode={timeMode} onModeChange={setTimeMode} />
        <input
          value={form.content}
          onChange={e=>setForm(p=>({...p,content:e.target.value}))}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="일정 내용 — Enter로 추가"
        />

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowTodo(p => !p)}
          style={{textAlign:'left',color:'var(--pink-600)'}}
        >
          {showTodo ? '📎 할일 연결 해제 ✕' : '📎 할일 함께 등록 (선택)'}
        </button>

        {showTodo && (
          <div style={{background:'var(--pink-50)',borderRadius:'8px',padding:'10px',display:'flex',flexDirection:'column',gap:'8px',border:'1px solid var(--pink-200)'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--pink-700)'}}>연결 할일 정보</div>
            <input
              value={form.todoContent}
              onChange={e=>setForm(p=>({...p,todoContent:e.target.value}))}
              placeholder="할일 내용"
            />
            <input type="date" value={form.todoDate} onChange={e=>setForm(p=>({...p,todoDate:e.target.value}))} placeholder="마감일 (선택)" />
          </div>
        )}

        <button className="btn btn-primary" onClick={add} disabled={saving}>+ 추가</button>
      </div>

      {upcoming.length === 0 && past.length === 0 && <div className="empty">등록된 일정이 없어요</div>}
      {upcoming.length === 0 && past.length > 0 && <div className="empty">다가오는 일정이 없어요</div>}
      {upcoming.map(renderItem)}

      {past.length > 0 && (
        <>
          <button
            onClick={() => setShowPast(p => !p)}
            style={{
              width:'100%',marginTop:'8px',padding:'8px',
              background:'none',border:'1px dashed var(--gray-300)',
              borderRadius:'8px',color:'var(--gray-400)',fontSize:'0.82rem',cursor:'pointer'
            }}
          >
            {showPast ? '지난 일정 접기 ▲' : `지난 일정 보기 ▼ (${past.length}개)`}
          </button>
          {showPast && past.map(renderItem)}
        </>
      )}
    </section>
  )
}

// ── 📝 할일 ──────────────────────────────────────────────────
function TodoManager() {
  const [items,        setItems]        = useState([])
  const [form,         setForm]         = useState({ content: '', dueDate: '' })
  const [saving,       setSaving]       = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [editForm,     setEditForm]     = useState({ content:'', dueDate:'' })
  const [showActive,   setShowActive]   = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    getTodos().then(data =>
      setItems([...data].sort((a,b) => (a.dueDate||'9999-99-99').localeCompare(b.dueDate||'9999-99-99')))
    )
  }, [])

  const active   = items.filter(i => !i.done)
  const archived = items.filter(i => i.done)

  const add = async () => {
    if (!form.content.trim()) return
    const updated = [...items, { ...form, content: form.content.trim(), done: false, id: `todo-${Date.now()}` }]
      .sort((a,b) => (a.dueDate||'9999-99-99').localeCompare(b.dueDate||'9999-99-99'))
    setSaving(true)
    await saveTodos(updated)
    setItems(updated)
    setForm({ content: '', dueDate: '' })
    setSaving(false)
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditForm({ content: item.content, dueDate: item.dueDate || '' })
  }

  const saveEdit = async () => {
    if (!editForm.content.trim()) return
    const updated = items.map(i => i.id === editId ? { ...i, content: editForm.content.trim(), dueDate: editForm.dueDate } : i)
      .sort((a,b) => (a.dueDate||'9999-99-99').localeCompare(b.dueDate||'9999-99-99'))
    await saveTodos(updated)
    setItems(updated)
    setEditId(null)
  }

  const toggle = async (id) => {
    const updated = items.map(i => i.id===id ? {...i,done:!i.done} : i)
    await saveTodos(updated)
    setItems(updated)
  }

  const remove = async (id) => {
    const updated = items.filter(i => i.id!==id)
    await saveTodos(updated)
    setItems(updated)
  }

  const renderItem = (item) => {
    if (editId === item.id) return (
      <div key={item.id} className="inline-edit-card">
        <input
          value={editForm.content}
          onChange={e=>setEditForm(p=>({...p,content:e.target.value}))}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
          placeholder="할 일 내용"
          autoFocus
        />
        <input type="date" value={editForm.dueDate} onChange={e=>setEditForm(p=>({...p,dueDate:e.target.value}))} />
        <div style={{display:'flex',gap:'8px'}}>
          <button className="btn btn-primary btn-sm" onClick={saveEdit}>저장</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>취소</button>
        </div>
      </div>
    )

    const diff    = item.dueDate ? daysUntil(item.dueDate) : null
    const overdue = !item.done && diff !== null && diff < 0
    const tagCls  = overdue ? 'tag-overdue' : (diff !== null && diff <= 3 ? 'tag-red' : 'tag-yellow')
    const label   = diff === null ? '' : (overdue ? `D+${-diff}` : (diff === 0 ? 'D-Day' : `D-${diff}`))

    return (
      <div key={item.id} className="deadline-item">
        <button className={`check-circle${item.done?' checked':''}`} onClick={() => toggle(item.id)}>
          {item.done ? '✓' : ''}
        </button>
        <div style={{flex:1}}>
          <span className={item.done ? 'strikethrough' : (overdue ? 'overdue-text' : '')}>{item.content}</span>
          {item.dueDate && <div style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>{formatDate(item.dueDate)}</div>}
        </div>
        {!item.done && label && <span className={`tag ${tagCls}`} style={{flexShrink:0}}>{label}</span>}
        <div style={{display:'flex',gap:'4px',alignItems:'center',flexShrink:0}}>
          <button className="icon-btn icon-btn-edit" onClick={() => startEdit(item)} title="수정">✏️</button>
          <button className="btn btn-danger btn-icon" onClick={() => remove(item.id)}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <section className="card">
      <div className="section-label">📝 할일 관리</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        <input
          value={form.content}
          onChange={e=>setForm(p=>({...p,content:e.target.value}))}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="할 일 내용"
        />
        <input type="date" value={form.dueDate} onChange={e=>setForm(p=>({...p,dueDate:e.target.value}))} placeholder="마감일 (선택)" />
        <button className="btn btn-primary" onClick={add} disabled={saving}>+ 추가</button>
      </div>

      {/* 미완료 */}
      <button
        onClick={() => setShowActive(p => !p)}
        style={{
          width:'100%',padding:'10px 12px',
          background:'var(--pink-50)',border:'1px solid var(--pink-200)',
          borderRadius:'8px',color:'var(--pink-700)',fontSize:'0.85rem',
          fontWeight:700,cursor:'pointer',textAlign:'left',
          display:'flex',justifyContent:'space-between',alignItems:'center',
          marginBottom: showActive && active.length > 0 ? '8px' : '0'
        }}
      >
        <span>📝 미완료 ({active.length}개)</span>
        <span>{showActive ? '▲' : '▼'}</span>
      </button>
      {showActive && (
        active.length === 0
          ? <div className="empty" style={{marginTop:'8px'}}>미완료 할 일이 없어요</div>
          : active.map(renderItem)
      )}

      {/* 완료 — 기본 접힘 */}
      {archived.length > 0 && (
        <>
          <button
            onClick={() => setShowArchived(p => !p)}
            style={{
              width:'100%',marginTop:'8px',padding:'8px',
              background:'none',border:'1px dashed var(--gray-300)',
              borderRadius:'8px',color:'var(--gray-400)',fontSize:'0.82rem',cursor:'pointer'
            }}
          >
            {showArchived ? '완료된 할 일 접기 ▲' : `완료된 할 일 보기 ▼ (${archived.length}개)`}
          </button>
          {showArchived && archived.map(renderItem)}
        </>
      )}
    </section>
  )
}

export default function ScheduleTab() {
  const [section, setSection] = useState('consult')
  return (
    <div className="page" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      <div style={{display:'flex',gap:'8px'}}>
        <button
          className={`btn btn-sm ${section==='consult'?'btn-primary':'btn-secondary'}`}
          onClick={() => setSection('consult')}
        >🗣️ 상담</button>
        <button
          className={`btn btn-sm ${section==='schedule'?'btn-primary':'btn-secondary'}`}
          onClick={() => setSection('schedule')}
        >📌 일정</button>
        <button
          className={`btn btn-sm ${section==='todo'?'btn-primary':'btn-secondary'}`}
          onClick={() => setSection('todo')}
        >📝 할일</button>
      </div>
      {section === 'consult'  && <ConsultationManager />}
      {section === 'schedule' && <ScheduleManager />}
      {section === 'todo'     && <TodoManager />}
    </div>
  )
}
