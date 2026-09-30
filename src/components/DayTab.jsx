import { useState, useEffect, useCallback } from 'react'
import {
  getTodos, saveTodos,
  getHomeroom, saveHomeroom,
  getBasicTimetable, getWeeklyTimetable, getActiveSemesterId,
  getProgressLogs, saveProgressLog,
  getSchedules, saveSchedules,
  getConsultations, saveConsultations,
} from '../firebase'
import {
  getToday, getDayKeyFromDate, getWeekKey,
  daysUntilFrom, formatDate, formatDateKorean,
  nextWorkdaySkipVacation, prevWorkdaySkipVacation,
  getVacationForDate,
  PERIODS, DAY_LABELS
} from '../utils'

const PERIOD_OPTIONS = ['1교시','2교시','3교시','4교시','5교시','6교시','7교시','방과후']

// 상담 시간 → 정렬 키 (교시 사이에 끼우기)
const CONSULT_SORT_MAP = {
  '1교시': 1.5, '2교시': 2.5, '3교시': 3.5, '4교시': 4.5,
  '5교시': 5.5, '6교시': 6.5, '7교시': 7.5, '방과후': 8.5,
}
function getConsultSortKey(time) {
  if (!time) return 9
  const t = time.split('~')[0]
  if (CONSULT_SORT_MAP[t] !== undefined) return CONSULT_SORT_MAP[t]
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (m) return parseInt(m[1]) + parseInt(m[2]) / 60
  return 9
}

export default function DayTab({ initialDate, navigable = false, holidays = [], vacations = [], onNavigateToProgress }) {
  const [date, setDate] = useState(initialDate)

  const isToday = date === getToday()
  const weekKey = getWeekKey(date)
  const dayKey  = getDayKeyFromDate(date)
  const dayName = dayKey ? DAY_LABELS[dayKey] : '주말'

  const [todos,            setTodos]             = useState([])
  const [semesterId,       setSemesterId]        = useState('default')
  const [homeroom,         setHomeroom]          = useState({ morning: '', afternoon: '' })
  const [homeroomDraft,    setHomeroomDraft]     = useState({ morning: '', afternoon: '' })
  const [lessons,          setLessons]           = useState([])
  const [schedules,        setSchedules]         = useState([])
  const [consultations,    setConsultations]     = useState([])
  const [loading,          setLoading]           = useState(true)
  const [toastField,       setToastField]        = useState(null)
  const [toastMsg,         setToastMsg]          = useState('')
  const [showLaterTodos,   setShowLaterTodos]    = useState(false)
  const [showAddTodo,      setShowAddTodo]       = useState(false)
  const [todoForm,         setTodoForm]          = useState({ content: '', dueDate: '' })
  const [editingTodoId,    setEditingTodoId]     = useState(null)
  const [editTodoForm,     setEditTodoForm]      = useState({ content: '', dueDate: '' })
  const [showQuickAdd,     setShowQuickAdd]      = useState(false)
  const [quickType,        setQuickType]         = useState('schedule')
  const [quickForm,        setQuickForm]         = useState({ time: '', content: '', studentName: '', memo: '' })

  useEffect(() => { setDate(initialDate) }, [initialDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tds, hr, basic, weekly, sch, consults, semId] = await Promise.all([
        getTodos(),
        getHomeroom(date),
        getBasicTimetable(),
        getWeeklyTimetable(weekKey),
        getSchedules(),
        getConsultations(),
        getActiveSemesterId(),
      ])
      setTodos(tds)
      setHomeroom(hr)
      setHomeroomDraft(hr)
      setSchedules(sch)
      setConsultations(consults)
      setSemesterId(semId)

      if (!dayKey) { setLessons([]); setLoading(false); return }

      const dayData = (weekly[dayKey] && Object.keys(weekly[dayKey]).length)
        ? weekly[dayKey]
        : (basic[dayKey] || {})

      const result = []
      for (const p of PERIODS) {
        const cn = dayData[String(p)] || dayData[p]
        if (cn && cn.trim()) {
          const logs = await getProgressLogs(cn, semId)
          const lastDone = [...logs]
            .filter(l => l.status === 'done' && l.date < date)
            .sort((a, b) => b.date.localeCompare(a.date))[0]
          const targetEntry = logs.find(l => l.date === date) || null
          result.push({
            period: p,
            className: cn.trim(),
            todayEntry: targetEntry,
            lastClass: lastDone?.content || '',
            thisClass: targetEntry?.content || '',
          })
        }
      }
      setLessons(result)
    } catch(e) {
      console.error('[DayTab load]', e)
    }
    setLoading(false)
  }, [date, weekKey, dayKey])

  useEffect(() => { load() }, [load])
  useEffect(() => { setShowAddTodo(false); setEditingTodoId(null); setShowQuickAdd(false) }, [date])

  // ── 📝 할 일 ──────────────────────────────────────────────
  const toggleTodo = async (id) => {
    const updated = todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
    setTodos(updated)
    await saveTodos(updated)
  }

  const addTodo = async () => {
    if (!todoForm.content.trim()) return
    const newItem = { id: `todo-${Date.now()}`, content: todoForm.content.trim(), dueDate: todoForm.dueDate, done: false }
    const updated = [...todos, newItem]
    setTodos(updated)
    await saveTodos(updated)
    setTodoForm({ content: '', dueDate: '' })
    setShowAddTodo(false)
  }

  const startEditTodo = (t) => {
    setEditingTodoId(t.id)
    setEditTodoForm({ content: t.content, dueDate: t.dueDate || '' })
  }

  const saveEditTodo = async () => {
    if (!editTodoForm.content.trim()) return
    const updated = todos.map(t => t.id === editingTodoId ? { ...t, content: editTodoForm.content.trim(), dueDate: editTodoForm.dueDate } : t)
    setTodos(updated)
    await saveTodos(updated)
    setEditingTodoId(null)
  }

  const deleteTodo = async (id) => {
    const updated = todos.filter(t => t.id !== id)
    setTodos(updated)
    await saveTodos(updated)
  }

  // 마감일 순 정렬, 마감일 없는 항목은 하단
  const pendingTodos = todos
    .filter(t => !t.done)
    .sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'))

  // D-7 이내(지난 마감 포함)는 바로 표시, 그 이후·마감일 없음은 드롭다운
  const isSoon       = t => t.dueDate && daysUntilFrom(t.dueDate, date) <= 7
  const visibleTodos = pendingTodos.filter(isSoon)
  const laterTodos   = pendingTodos.filter(t => !isSoon(t))

  const renderTodo = (t) => {
    if (editingTodoId === t.id) {
      return (
        <div key={t.id} className="inline-edit-card">
          <input
            value={editTodoForm.content}
            onChange={e => setEditTodoForm(p => ({ ...p, content: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') saveEditTodo(); if (e.key === 'Escape') setEditingTodoId(null) }}
            placeholder="할 일 내용"
            autoFocus
          />
          <input
            type="date"
            value={editTodoForm.dueDate}
            onChange={e => setEditTodoForm(p => ({ ...p, dueDate: e.target.value }))}
          />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-primary btn-sm" onClick={saveEditTodo}>저장</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditingTodoId(null)}>취소</button>
          </div>
        </div>
      )
    }
    const diff    = t.dueDate ? daysUntilFrom(t.dueDate, date) : null
    const overdue = diff !== null && diff < 0
    const tagCls  = overdue ? 'tag-overdue' : (diff !== null && diff <= 3 ? 'tag-red' : 'tag-yellow')
    const label   = diff === null ? '' : (overdue ? `D+${-diff}` : (diff === 0 ? 'D-Day' : `D-${diff}`))
    return (
      <div key={t.id} className="deadline-item">
        <button
          className={`check-circle${t.done ? ' checked' : ''}`}
          onClick={() => toggleTodo(t.id)}
        >
          {t.done ? '✓' : ''}
        </button>
        <div style={{ flex:1, cursor:'pointer' }} onClick={() => startEditTodo(t)}>
          <span className={overdue ? 'overdue-text' : ''}>{t.content}</span>
          {t.dueDate && (
            <div style={{ fontSize:'0.75rem', color:'var(--gray-400)', marginTop:'2px' }}>
              {formatDate(t.dueDate)}
            </div>
          )}
        </div>
        {label && <span className={`tag ${tagCls}`}>{label}</span>}
        <button className="btn btn-danger btn-icon" onClick={() => deleteTodo(t.id)} style={{ width:'28px', height:'28px', minHeight:'unset', flexShrink:0 }}>✕</button>
      </div>
    )
  }

  // ── 토스트 ────────────────────────────────────────────────
  const showToast = (field, msg = '') => {
    setToastField(field)
    setToastMsg(msg)
    setTimeout(() => { setToastField(null); setToastMsg('') }, 2500)
  }

  // ── 조회/종례 저장 ────────────────────────────────────────
  const saveHomeroomField = async (field, value) => {
    const updated = { ...homeroom, [field]: value }
    setHomeroom(updated)
    try {
      await saveHomeroom(date, updated)
      showToast(field)
    } catch(e) {
      console.error('[homeroom save]', e)
      showToast('error', '저장 실패 ✕')
    }
  }

  // ── 수업 완료/계획 저장 ───────────────────────────────────
  const completeLesson = async (lesson, setCompleting) => {
    setCompleting(true)
    try {
      const freshLogs = await getProgressLogs(lesson.className, semesterId)
      const content   = (lesson.editedThisClass ?? lesson.thisClass) || ''
      const lastNote  = (lesson.editedLastClass  ?? lesson.lastClass) || ''
      const idx       = freshLogs.findIndex(l => l.date === date)
      const entry = {
        id:            (idx >= 0 && freshLogs[idx].id) || `${date}-${lesson.className}-${Date.now()}`,
        week:          weekKey,
        date,
        content,
        lastClassNote: lastNote,
        status:        'done',
      }
      const updated = [...freshLogs]
      if (idx >= 0) updated[idx] = entry
      else updated.push(entry)

      await saveProgressLog(lesson.className, updated, semesterId)
      showToast('complete', '✅ 저장됨')
      await load()
    } catch(e) {
      console.error('[completeLesson]', e)
      showToast('error', `저장 실패: ${e.code || e.message || '알 수 없는 오류'}`)
    }
    setCompleting(false)
  }

  // ── 수업 완료 취소 ────────────────────────────────────────
  const uncompleteLesson = async (lesson) => {
    try {
      const freshLogs = await getProgressLogs(lesson.className, semesterId)
      const idx = freshLogs.findIndex(l => l.date === date)
      if (idx < 0) return
      const updated = [...freshLogs]
      updated[idx] = { ...freshLogs[idx], status: 'plan' }
      await saveProgressLog(lesson.className, updated, semesterId)
      showToast('complete', '↩️ 완료 취소됨')
      await load()
    } catch(e) {
      console.error('[uncompleteLesson]', e)
      showToast('error', `저장 실패: ${e.code || e.message || '알 수 없는 오류'}`)
    }
  }

  // ── 내용 편집 저장 ────────────────────────────────────────
  const saveEditedLesson = async (lesson, draftLast, draftThis) => {
    try {
      const freshLogs = await getProgressLogs(lesson.className, semesterId)
      const idx = freshLogs.findIndex(l => l.date === date)
      const updated = [...freshLogs]
      if (idx >= 0) {
        updated[idx] = {
          ...freshLogs[idx],
          content:       draftThis || '',
          lastClassNote: draftLast || '',
        }
      } else {
        updated.push({
          id:            `${date}-${lesson.className}-${Date.now()}`,
          week:          weekKey,
          date,
          content:       draftThis || '',
          lastClassNote: draftLast || '',
          status:        'plan',
        })
      }
      await saveProgressLog(lesson.className, updated, semesterId)
      showToast('complete', '✅ 저장됨')
      await load()
    } catch(e) {
      console.error('[saveEditedLesson]', e)
      showToast('error', `저장 실패: ${e.code || e.message || '알 수 없는 오류'}`)
    }
  }

  // ── 빠른 추가 ─────────────────────────────────────────────
  const handleQuickAdd = async () => {
    if (quickType === 'schedule') {
      if (!quickForm.content.trim()) return
      const newItem = { id: Date.now().toString(), date, time: quickForm.time, content: quickForm.content }
      const updated = [...schedules, newItem]
        .sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      await saveSchedules(updated)
      setSchedules(updated)
    } else {
      if (!quickForm.studentName.trim()) return
      const newItem = { id: Date.now().toString(), date, time: quickForm.time, studentName: quickForm.studentName.trim(), memo: quickForm.memo }
      const allConsults = await getConsultations()
      const updated = [...allConsults, newItem]
        .sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      await saveConsultations(updated)
      setConsultations(updated)
    }
    setShowQuickAdd(false)
    setQuickForm({ time: '', content: '', studentName: '', memo: '' })
  }

  // ── 일정/상담 필터링 ──────────────────────────────────────
  const daySchedules = schedules
    .filter(s => s.date === date)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const dayConsultations = consultations.filter(c => c.date === date)

  // 수업 + 상담 합쳐서 정렬
  const combinedItems = [
    ...lessons.map(l => ({ type: 'lesson', sortKey: l.period, data: l })),
    ...dayConsultations.map(c => ({ type: 'consult', sortKey: getConsultSortKey(c.time), data: c })),
  ].sort((a, b) => a.sortKey - b.sortKey)

  const lbl = isToday ? '오늘' : dayName

  const goPrev = () => setDate(prevWorkdaySkipVacation(date, holidays, vacations))
  const goNext = () => setDate(nextWorkdaySkipVacation(date, holidays, vacations))

  const todayHoliday  = holidays.find(h => h.date === date)
  const todayVacation = getVacationForDate(date, vacations)

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ color:'var(--mint-400)' }}>불러오는 중... ✨</span>
    </div>
  )

  return (
    <div className="page" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* 토스트 */}
      {toastField === 'error' && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:300,
          background:'#ef4444', color:'#fff',
          padding:'10px 16px', textAlign:'center',
          fontSize:'0.88rem', fontWeight:700
        }}>{toastMsg}</div>
      )}
      {toastField === 'complete' && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:300,
          background:'var(--mint-600)', color:'#fff',
          padding:'10px 16px', textAlign:'center',
          fontSize:'0.88rem', fontWeight:700
        }}>{toastMsg}</div>
      )}

      {/* 방학 배너 */}
      {todayVacation && (
        <div style={{
          background:'#fffbe6', border:'1.5px solid #ffe066',
          borderRadius:'12px', padding:'10px 16px',
          display:'flex', alignItems:'center', gap:'8px',
          fontWeight:700, color:'#856404', fontSize:'0.9rem'
        }}>
          🟡 {todayVacation.name}
          <span style={{fontWeight:400, fontSize:'0.78rem', color:'#b8860b'}}>방학 중</span>
        </div>
      )}

      {/* 날짜 네비게이터 (내일 탭) */}
      {navigable ? (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'var(--white)', borderRadius:'14px', padding:'10px 16px',
          boxShadow:'0 1px 6px rgba(45,136,128,0.07)'
        }}>
          <button
            onClick={goPrev}
            style={{
              width:'36px', height:'36px', borderRadius:'10px',
              background:'var(--mint-100)', color:'var(--mint-700)',
              fontSize:'1.2rem', fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center'
            }}
          >‹</button>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:700, color:'var(--mint-700)', fontSize:'0.92rem' }}>
              {formatDateKorean(date)}
            </div>
            {isToday && (
              <span style={{
                display:'inline-block', marginTop:'3px',
                fontSize:'0.68rem', background:'var(--mint-500)', color:'white',
                padding:'1px 8px', borderRadius:'20px', fontWeight:700
              }}>오늘</span>
            )}
            {todayHoliday && (
              <div style={{ marginTop:'4px', fontSize:'0.75rem', color:'#d45880', fontWeight:700 }}>
                🔴 {todayHoliday.name}
              </div>
            )}
            {todayVacation && !todayHoliday && (
              <div style={{ marginTop:'4px', fontSize:'0.75rem', color:'#b8860b', fontWeight:700 }}>
                🟡 {todayVacation.name}
              </div>
            )}
          </div>
          <button
            onClick={goNext}
            style={{
              width:'36px', height:'36px', borderRadius:'10px',
              background:'var(--mint-100)', color:'var(--mint-700)',
              fontSize:'1.2rem', fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center'
            }}
          >›</button>
        </div>
      ) : (
        <div style={{ textAlign:'center', color:'var(--mint-600)', fontWeight:700, fontSize:'0.9rem' }}>
          {formatDateKorean(date)}
          {todayHoliday && (
            <div style={{ marginTop:'4px', fontSize:'0.75rem', color:'#d45880', fontWeight:700 }}>
              🔴 {todayHoliday.name}
            </div>
          )}
        </div>
      )}

      {/* 할 일 */}
      <section className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          <div className="section-label" style={{ margin:0 }}>📝 할 일</div>
          <button
            onClick={() => setShowAddTodo(p => !p)}
            style={{
              width:'28px',height:'28px',borderRadius:'50%',
              background:'var(--mint-500)',color:'#fff',
              fontSize:'1.1rem',fontWeight:700,
              display:'flex',alignItems:'center',justifyContent:'center',
              flexShrink:0
            }}
          >+</button>
        </div>

        {showAddTodo && (
          <div style={{
            background:'var(--mint-50)',border:'1px solid var(--mint-200)',
            borderRadius:'10px',padding:'12px',marginBottom:'12px',
            display:'flex',flexDirection:'column',gap:'8px'
          }}>
            <input
              value={todoForm.content}
              onChange={e => setTodoForm(p => ({ ...p, content: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') addTodo() }}
              placeholder="할 일 내용"
              autoFocus
            />
            <input
              type="date"
              value={todoForm.dueDate}
              onChange={e => setTodoForm(p => ({ ...p, dueDate: e.target.value }))}
            />
            <div style={{ display:'flex', gap:'8px' }}>
              <button className="btn btn-primary btn-sm" onClick={addTodo}>추가</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddTodo(false); setTodoForm({ content:'', dueDate:'' }) }}>취소</button>
            </div>
          </div>
        )}

        {visibleTodos.length === 0 ? (
          <div className="empty" style={{ padding:'8px 0' }}>할 일이 없어요</div>
        ) : visibleTodos.map(renderTodo)}

        {laterTodos.length > 0 && (
          <>
            <button
              onClick={() => setShowLaterTodos(p => !p)}
              style={{
                width:'100%',marginTop:'8px',padding:'8px',
                background:'none',border:'1px dashed var(--gray-300)',
                borderRadius:'8px',color:'var(--gray-400)',fontSize:'0.82rem',cursor:'pointer'
              }}
            >
              {showLaterTodos ? '이후 할 일 접기 ▲' : `이후 할 일 ${laterTodos.length}건 ▼`}
            </button>
            {showLaterTodos && laterTodos.map(renderTodo)}
          </>
        )}
      </section>

      {/* 조회 메모 */}
      <section className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          <div className="section-label" style={{ margin:0 }}>🌅 {lbl} 조회 메모</div>
          <span className={`save-toast${toastField === 'morning' ? ' visible' : ''}`}>저장됨 ✓</span>
        </div>
        <textarea
          rows={3}
          placeholder="조회 시간 메모를 입력하세요..."
          value={homeroomDraft.morning}
          onChange={e => setHomeroomDraft(p => ({ ...p, morning: e.target.value }))}
          onBlur={e => saveHomeroomField('morning', e.target.value)}
          style={{ resize:'vertical' }}
        />
      </section>

      {/* 수업 + 상담 */}
      <section className="card">
        <div className="section-label">📚 {lbl} 수업</div>
        {!dayKey && <div className="empty">수업이 없어요 🎉</div>}
        {dayKey && combinedItems.length === 0 && <div className="empty">시간표를 설정해주세요</div>}
        {combinedItems.map((item, idx) => {
          if (item.type === 'lesson') {
            const lesson = item.data
            return (
              <LessonCard
                key={`lesson-${lesson.period}-${idx}`}
                lesson={lesson}
                isToday={isToday}
                onComplete={(setCompleting) => completeLesson(lesson, setCompleting)}
                onUncomplete={() => uncompleteLesson(lesson)}
                onSaveFields={(fields) => {
                  setLessons(prev => prev.map((l) => l.period === lesson.period ? { ...l, ...fields } : l))
                }}
                onSaveEdits={(draftLast, draftThis) => saveEditedLesson(lesson, draftLast, draftThis)}
                onNavigateToProgress={onNavigateToProgress}
              />
            )
          } else {
            const c = item.data
            return (
              <div key={`consult-${idx}`} style={{
                background:'#fffbea', border:'1.5px solid #ffe08a',
                borderRadius:'10px', padding:'10px 14px', marginBottom:'8px',
              }}>
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px'}}>
                  <span style={{fontSize:'0.78rem',fontWeight:700,color:'#b8860b'}}>🗣️ 상담</span>
                  {c.time && <span style={{fontSize:'0.75rem',color:'#b8860b'}}>{c.time}</span>}
                </div>
                <div style={{fontSize:'0.9rem',fontWeight:600,color:'#333'}}>{c.studentName}</div>
                {c.memo && <div style={{fontSize:'0.8rem',color:'#666',marginTop:'2px'}}>{c.memo}</div>}
              </div>
            )
          }
        })}
      </section>

      {/* 일정 */}
      <section className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
          <div className="section-label" style={{margin:0}}>📌 {lbl} 일정</div>
          <button
            onClick={() => setShowQuickAdd(p => !p)}
            style={{
              width:'28px',height:'28px',borderRadius:'50%',
              background:'var(--pink-500)',color:'#fff',
              fontSize:'1.1rem',fontWeight:700,
              display:'flex',alignItems:'center',justifyContent:'center',
              flexShrink:0
            }}
          >+</button>
        </div>

        {/* 빠른 추가 패널 */}
        {showQuickAdd && (
          <div style={{
            background:'var(--pink-50)',border:'1px solid var(--pink-200)',
            borderRadius:'10px',padding:'12px',marginBottom:'12px',
            display:'flex',flexDirection:'column',gap:'8px'
          }}>
            <div style={{display:'flex',gap:'6px'}}>
              <button
                className={`btn btn-sm ${quickType==='schedule'?'btn-primary':'btn-secondary'}`}
                onClick={() => setQuickType('schedule')}
              >📌 일정</button>
              <button
                className={`btn btn-sm ${quickType==='consult'?'btn-primary':'btn-secondary'}`}
                onClick={() => setQuickType('consult')}
              >🗣️ 상담</button>
            </div>

            <select
              value={quickForm.time}
              onChange={e => setQuickForm(p => ({...p, time: e.target.value}))}
            >
              <option value="">교시/시간 선택 (선택)</option>
              {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {quickType === 'schedule' ? (
              <input
                value={quickForm.content}
                onChange={e => setQuickForm(p => ({...p, content: e.target.value}))}
                onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd() }}
                placeholder="일정 내용"
                autoFocus
              />
            ) : (
              <>
                <input
                  value={quickForm.studentName}
                  onChange={e => setQuickForm(p => ({...p, studentName: e.target.value}))}
                  placeholder="학생명"
                  autoFocus
                />
                <input
                  value={quickForm.memo}
                  onChange={e => setQuickForm(p => ({...p, memo: e.target.value}))}
                  onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd() }}
                  placeholder="메모 (선택)"
                />
              </>
            )}

            <div style={{display:'flex',gap:'8px'}}>
              <button className="btn btn-primary btn-sm" onClick={handleQuickAdd}>추가</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowQuickAdd(false); setQuickForm({ time:'', content:'', studentName:'', memo:'' }) }}>취소</button>
            </div>
          </div>
        )}

        {daySchedules.length === 0
          ? <div className="empty">일정이 없어요</div>
          : daySchedules.map((s, i) => (
            <div key={i} className="schedule-item">
              <span className="schedule-time">{s.time || '--:--'}</span>
              <div style={{flex:1}}>
                <span style={{ fontSize:'0.9rem' }}>{s.content}</span>
                {s.linkedTodo && (
                  <div style={{fontSize:'0.72rem',color:'var(--gray-500)',marginTop:'2px'}}>
                    📎 {s.linkedTodo.content}
                  </div>
                )}
              </div>
            </div>
          ))
        }
      </section>

      {/* 종례 메모 */}
      <section className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          <div className="section-label" style={{ margin:0 }}>🌇 {lbl} 종례 메모</div>
          <span className={`save-toast${toastField === 'afternoon' ? ' visible' : ''}`}>저장됨 ✓</span>
        </div>
        <textarea
          rows={3}
          placeholder="종례 시간 메모를 입력하세요..."
          value={homeroomDraft.afternoon}
          onChange={e => setHomeroomDraft(p => ({ ...p, afternoon: e.target.value }))}
          onBlur={e => saveHomeroomField('afternoon', e.target.value)}
          style={{ resize:'vertical' }}
        />
      </section>
    </div>
  )
}

// ── LessonCard ───────────────────────────────────────────────
function LessonCard({ lesson, isToday, onComplete, onUncomplete, onSaveFields, onSaveEdits, onNavigateToProgress }) {
  const [editing,    setEditing]    = useState(false)
  const [draftLast,  setDraftLast]  = useState('')
  const [draftThis,  setDraftThis]  = useState('')
  const [completing, setCompleting] = useState(false)

  const startEdit = () => {
    setDraftLast(lesson.editedLastClass ?? lesson.lastClass ?? '')
    setDraftThis(lesson.editedThisClass ?? lesson.thisClass ?? '')
    setEditing(true)
  }

  const handleSave = async () => {
    onSaveFields({ editedLastClass: draftLast, editedThisClass: draftThis })
    await onSaveEdits(draftLast, draftThis)
    setEditing(false)
  }

  const isDone         = lesson.todayEntry?.status === 'done'
  const isHoliday      = lesson.todayEntry?.status === 'holiday'
  const displayLast    = lesson.editedLastClass ?? lesson.lastClass
  const displayThis    = lesson.editedThisClass ?? lesson.thisClass
  const completeLabel  = isToday ? '✅ 수업 완료' : '📌 계획 저장'
  const uncompleteLabel = isToday ? '↩️ 완료 취소' : '↩️ 계획 취소'

  return (
    <div className="lesson-card" style={
      isHoliday ? { opacity:0.6, borderLeftColor:'#d45880' } :
      isDone    ? { opacity:0.7, borderLeftColor:'var(--mint-300)' } : {}
    }>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
        <div className="lesson-period">{lesson.period}교시</div>
        {isHoliday && <span className="tag tag-red" style={{ fontSize:'0.7rem' }}>🔴 휴강</span>}
        {!isHoliday && isDone && <span className="tag tag-green" style={{ fontSize:'0.7rem' }}>✅ 완료</span>}
        {!isHoliday && lesson.todayEntry?.status === 'plan' && (
          <span className="tag tag-mint" style={{ fontSize:'0.7rem' }}>📌 계획</span>
        )}
      </div>
      <div
        className="lesson-class"
        style={{
          cursor: onNavigateToProgress ? 'pointer' : 'default',
          textDecoration: onNavigateToProgress ? 'underline' : 'none',
          textDecorationStyle: 'dotted',
          textUnderlineOffset: '3px',
        }}
        onClick={() => onNavigateToProgress?.(lesson.className)}
        title={onNavigateToProgress ? '진도표로 이동' : undefined}
      >
        {lesson.className}
      </div>

      {editing ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <div>
            <label style={{ fontSize:'0.72rem', color:'var(--gray-500)', display:'block', marginBottom:'3px' }}>
              지난 시간
            </label>
            <input
              value={draftLast}
              onChange={e => setDraftLast(e.target.value)}
              placeholder="지난 시간 내용"
            />
          </div>
          <div>
            <label style={{ fontSize:'0.72rem', color:'var(--gray-500)', display:'block', marginBottom:'3px' }}>
              {isToday ? '이번 시간 계획' : '다음 수업 계획'}
            </label>
            <input
              value={draftThis}
              onChange={e => setDraftThis(e.target.value)}
              placeholder={isToday ? '이번 시간 계획' : '다음 수업 계획'}
              autoFocus
            />
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>저장</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>취소</button>
          </div>
        </div>
      ) : (
        <>
          <div className="lesson-field">
            <label>지난 시간</label>
            <p>{displayLast || <span style={{ color:'var(--gray-300)' }}>기록 없음</span>}</p>
          </div>
          <div className="lesson-field" style={{ marginTop:'8px' }}>
            <label>{isToday ? '이번 시간 계획' : '다음 수업 계획'}</label>
            <p>{displayThis || <span style={{ color:'var(--gray-300)' }}>미입력</span>}</p>
          </div>
          <div className="lesson-actions">
            <button className="btn btn-secondary btn-sm" onClick={startEdit}>✏️ 편집</button>
            {isHoliday ? (
              <span style={{ fontSize:'0.8rem', color:'#d45880', fontWeight:600, display:'flex', alignItems:'center' }}>
                휴강으로 수업 없음
              </span>
            ) : isDone ? (
              <button className="btn btn-secondary btn-sm" onClick={onUncomplete}
                style={{ color:'var(--gray-500)' }}>
                {uncompleteLabel}
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onComplete(setCompleting)}
                disabled={completing}
                style={completing ? { opacity:0.6 } : {}}
              >
                {completing ? '저장 중...' : completeLabel}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
