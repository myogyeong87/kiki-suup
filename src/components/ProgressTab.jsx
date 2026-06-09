import { useState, useEffect } from 'react'
import { getBasicTimetable, getProgressLogs, saveProgressLog } from '../firebase'
import { uniqueClasses, formatDate, getWeekKey, getToday } from '../utils'

const STATUS_OPTIONS = [
  { value: 'plan',    label: '📌 계획' },
  { value: 'done',    label: '✅ 완료' },
  { value: 'holiday', label: '🔴 휴강' },
]

function StatusBadge({ status }) {
  const map = {
    plan:    { cls: 'tag-mint',   label: '📌 계획' },
    done:    { cls: 'tag-green',  label: '✅ 완료' },
    holiday: { cls: 'tag-red',    label: '🔴 휴강' },
  }
  const s = map[status] || map.plan
  return <span className={`tag ${s.cls}`} style={{fontSize:'0.7rem',whiteSpace:'nowrap'}}>{s.label}</span>
}

export default function ProgressTab() {
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editDraft, setEditDraft] = useState({ date:'', content:'', status:'plan' })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ date: getToday(), content: '', status: 'plan' })

  useEffect(() => {
    getBasicTimetable().then(tt => {
      const list = uniqueClasses(tt)
      setClasses(list)
      if (list.length) setSelected(list[0])
    })
  }, [])

  const loadLogs = (cls) => {
    if (!cls) return
    setLoading(true)
    setEditingIdx(null)
    setShowAdd(false)
    getProgressLogs(cls).then(data => {
      setLogs([...data].sort((a,b) => (a.date||'').localeCompare(b.date||'')))
      setLoading(false)
    })
  }

  useEffect(() => { loadLogs(selected) }, [selected])

  // --- add ---
  const handleAdd = async () => {
    if (!addForm.date) return
    const entry = {
      id: `${addForm.date}-${selected}-${Date.now()}`,
      week: getWeekKey(addForm.date),
      date: addForm.date,
      content: addForm.content,
      status: addForm.status,
    }
    const updated = [...logs, entry].sort((a,b) => (a.date||'').localeCompare(b.date||''))
    await saveProgressLog(selected, updated)
    setLogs(updated)
    setAddForm({ date: getToday(), content: '', status: 'plan' })
    setShowAdd(false)
  }

  // --- edit ---
  const startEdit = (idx) => {
    const l = logs[idx]
    setEditDraft({ date: l.date || '', content: l.content || '', status: l.status || 'plan' })
    setEditingIdx(idx)
  }
  const cancelEdit = () => setEditingIdx(null)
  const saveEdit = async (idx) => {
    const updated = logs.map((l,i) => i === idx ? { ...l, ...editDraft } : l)
      .sort((a,b) => (a.date||'').localeCompare(b.date||''))
    await saveProgressLog(selected, updated)
    setLogs(updated)
    setEditingIdx(null)
  }

  // --- delete ---
  const deleteLog = async (idx) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return
    const updated = logs.filter((_,i) => i !== idx)
    await saveProgressLog(selected, updated)
    setLogs(updated)
  }

  return (
    <div className="page" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      {/* 반 선택 */}
      <section className="card">
        <div style={{display:'flex',alignItems:'flex-end',gap:'10px'}}>
          <div style={{flex:1}}>
            <div className="section-label">📊 반 선택</div>
            {classes.length === 0
              ? <div className="empty">기본 시간표에서 반을 먼저 등록하세요</div>
              : (
                <select value={selected} onChange={e => setSelected(e.target.value)}>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )
            }
          </div>
          {selected && (
            <button className="btn btn-secondary btn-sm" style={{marginBottom:'2px'}} onClick={() => setShowAdd(v=>!v)}>
              + 행 추가
            </button>
          )}
        </div>

        {showAdd && (
          <div className="add-row-form">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <div>
                <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'3px'}}>날짜</label>
                <input type="date" value={addForm.date} onChange={e=>setAddForm(p=>({...p,date:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'3px'}}>상태</label>
                <select value={addForm.status} onChange={e=>setAddForm(p=>({...p,status:e.target.value}))}>
                  {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'3px'}}>내용</label>
              <input value={addForm.content} onChange={e=>setAddForm(p=>({...p,content:e.target.value}))} placeholder="수업 내용 (선택)" />
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button className="btn btn-primary btn-sm" onClick={handleAdd}>추가</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowAdd(false)}>취소</button>
            </div>
          </div>
        )}
      </section>

      {/* 진도 기록 */}
      {selected && (
        <section className="card">
          <div className="section-label">
            📋 {selected} 진도 기록
            <span style={{marginLeft:'auto',fontSize:'0.72rem',color:'var(--gray-400)',fontWeight:400}}>
              {logs.length}건
            </span>
          </div>

          {loading && <div className="empty">불러오는 중...</div>}

          {!loading && logs.length === 0 && (
            <div className="empty">
              기록이 없어요<br/>
              <span style={{fontSize:'0.78rem'}}>관리탭 → 이번 주 시간표 → "진도표에 반영" 해보세요</span>
            </div>
          )}

          {!loading && logs.length > 0 && (
            <>
              {/* 테이블 헤더 */}
              <div className="prog-header" style={{gridTemplateColumns:'76px 1fr 88px 60px'}}>
                <span>날짜</span>
                <span>내용</span>
                <span>상태</span>
                <span></span>
              </div>

              {logs.map((log, i) =>
                editingIdx === i ? (
                  /* 편집 행 */
                  <div key={i} className="log-row editing" style={{gridTemplateColumns:'1fr'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'6px'}}>
                      <div>
                        <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>날짜</label>
                        <input type="date" value={editDraft.date}
                          onChange={e=>setEditDraft(p=>({...p,date:e.target.value}))}
                          style={{fontSize:'0.85rem'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>상태</label>
                        <select value={editDraft.status}
                          onChange={e=>setEditDraft(p=>({...p,status:e.target.value}))}
                          style={{fontSize:'0.85rem'}}>
                          {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:'8px'}}>
                      <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>내용</label>
                      <input value={editDraft.content}
                        onChange={e=>setEditDraft(p=>({...p,content:e.target.value}))}
                        placeholder="수업 내용" autoFocus style={{fontSize:'0.85rem'}} />
                    </div>
                    <div style={{display:'flex',gap:'8px'}}>
                      <button className="btn btn-primary btn-sm" onClick={()=>saveEdit(i)}>저장</button>
                      <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>취소</button>
                    </div>
                  </div>
                ) : (
                  /* 일반 행 */
                  <div key={i} className="log-row" style={{gridTemplateColumns:'76px 1fr 88px 60px'}}>
                    <span className="log-date">{formatDate(log.date)}</span>
                    <span style={{fontSize:'0.85rem',wordBreak:'break-all',lineHeight:1.4}}>
                      {log.content || <span style={{color:'var(--gray-300)'}}>-</span>}
                    </span>
                    <StatusBadge status={log.status} />
                    <div style={{display:'flex',gap:'4px',justifyContent:'flex-end'}}>
                      <button className="icon-btn icon-btn-edit" onClick={()=>startEdit(i)} title="수정">✏️</button>
                      <button className="icon-btn icon-btn-delete" onClick={()=>deleteLog(i)} title="삭제">✕</button>
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
