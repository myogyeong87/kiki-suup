import { useState, useEffect, useCallback } from 'react'
import {
  getDeadlines, saveDeadlines,
  getHomeroom, saveHomeroom,
  getBasicTimetable, getWeeklyTimetable,
  getProgressLogs, saveProgressLog,
  getSchedules
} from '../firebase'
import {
  getToday, getDayKeyFromDate, getWeekKey,
  daysUntilFrom, formatDate, formatDateKorean,
  nextWeekday, prevWeekday, nextWorkday, prevWorkday,
  PERIODS, DAY_LABELS
} from '../utils'

// initialDate: 'YYYY-MM-DD'
// navigable: true → 내일 탭 (날짜 이동 가능), false → 오늘 탭
export default function DayTab({ initialDate, navigable = false, holidays = [] }) {
  const [date, setDate] = useState(initialDate)
  const [skipHolidays, setSkipHolidays] = useState(true)

  const isToday = date === getToday()
  const weekKey = getWeekKey(date)
  const dayKey  = getDayKeyFromDate(date)
  const dayName = dayKey ? DAY_LABELS[dayKey] : '주말'

  const [deadlines,        setDeadlines]       = useState([])
  const [homeroom,         setHomeroom]         = useState({ morning: '', afternoon: '' })
  const [homeroomDraft,    setHomeroomDraft]    = useState({ morning: '', afternoon: '' })
  const [lessons,          setLessons]          = useState([])
  const [schedules,        setSchedules]        = useState([])
  const [loading,          setLoading]          = useState(true)
  const [toastField,       setToastField]       = useState(null)
  const [toastMsg,         setToastMsg]         = useState('')
  const [showAllDeadlines, setShowAllDeadlines] = useState(false)

  // 오늘/내일 탭 기준 날짜 바뀌면 리셋
  useEffect(() => { setDate(initialDate) }, [initialDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dl, hr, basic, weekly, sch] = await Promise.all([
        getDeadlines(),
        getHomeroom(date),
        getBasicTimetable(),
        getWeeklyTimetable(weekKey),
        getSchedules()
      ])
      setDeadlines(dl)
      setHomeroom(hr)
      setHomeroomDraft(hr)
      setSchedules(sch)

      if (!dayKey) { setLessons([]); setLoading(false); return }

      const dayData = (weekly[dayKey] && Object.keys(weekly[dayKey]).length)
        ? weekly[dayKey]
        : (basic[dayKey] || {})

      const result = []
      for (const p of PERIODS) {
        const cn = dayData[String(p)] || dayData[p]
        if (cn && cn.trim()) {
          const logs = await getProgressLogs(cn)
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
  useEffect(() => { setShowAllDeadlines(false) }, [date])

  // ── 마감 임박 ──────────────────────────────────────────────
  const toggleDeadline = async (realIdx) => {
    const updated = deadlines.map((d, i) => i === realIdx ? { ...d, done: !d.done } : d)
    setDeadlines(updated)
    await saveDeadlines(updated)
  }

  const allPending = deadlines
    .filter(d => !d.done && daysUntilFrom(d.date, date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const urgentDeadlines = showAllDeadlines
    ? allPending
    : allPending.filter(d => daysUntilFrom(d.date, date) <= 7)

  // ── 토스트 ─────────────────────────────────────────────────
  const showToast = (field, msg = '') => {
    setToastField(field)
    setToastMsg(msg)
    setTimeout(() => { setToastField(null); setToastMsg('') }, 2500)
  }

  // ── 조회/종례 저장 ──────────────────────────────────────────
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

  // ── 수업 완료/계획 저장 ────────────────────────────────────
  const completeLesson = async (lesson, setCompleting) => {
    setCompleting(true)
    try {
      const freshLogs = await getProgressLogs(lesson.className)
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

      await saveProgressLog(lesson.className, updated)
      showToast('complete', '✅ 저장됨')
      await load()
    } catch(e) {
      console.error('[completeLesson]', e)
      showToast('error', `저장 실패: ${e.code || e.message || '알 수 없는 오류'}`)
    }
    setCompleting(false)
  }

  // ── 일정 ───────────────────────────────────────────────────
  const daySchedules = schedules
    .filter(s => s.date === date)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const lbl = isToday ? '오늘' : dayName

  // ── 날짜 이동 (휴일 스킵 옵션 적용) ──────────────────────
  const goPrev = () => {
    if (skipHolidays && holidays.length > 0) setDate(prevWorkday(date, holidays))
    else setDate(prevWeekday(date))
  }
  const goNext = () => {
    if (skipHolidays && holidays.length > 0) setDate(nextWorkday(date, holidays))
    else setDate(nextWeekday(date))
  }

  // ── 휴일 확인 ──────────────────────────────────────────────
  const todayHoliday = holidays.find(h => h.date === date)

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

      {/* 날짜 네비게이터 (내일 탭) */}
      {navigable ? (
        <div style={{
          display:'flex', flexDirection:'column',
          background:'var(--white)', borderRadius:'14px', padding:'10px 16px',
          boxShadow:'0 1px 6px rgba(45,136,128,0.07)'
        }}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
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
          {/* 휴일 스킵 토글 */}
          <div style={{textAlign:'center', marginTop:'6px'}}>
            <label style={{fontSize:'0.72rem', color:'var(--gray-400)', cursor:'pointer', userSelect:'none'}}>
              <input
                type="checkbox"
                checked={skipHolidays}
                onChange={e => setSkipHolidays(e.target.checked)}
                style={{marginRight:'4px', cursor:'pointer'}}
              />
              휴일 건너뛰기
            </label>
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center', color:'var(--mint-600)', fontWeight:700, fontSize:'0.9rem' }}>
          {formatDateKorean(date)}
        </div>
      )}

      {/* 휴일 배너 */}
      {todayHoliday && (
        <div style={{
          background:'var(--pink-100)', color:'var(--pink-700)',
          padding:'10px 16px', borderRadius:'12px',
          textAlign:'center', fontWeight:700, fontSize:'0.88rem',
          border:'1px solid var(--pink-200)'
        }}>
          🏖️ {todayHoliday.name}
        </div>
      )}

      {/* 마감 임박 */}
      {allPending.length > 0 && (
        <section className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <div className="section-label" style={{ margin:0 }}>⏰ 마감 임박</div>
            <button
              onClick={() => setShowAllDeadlines(p => !p)}
              style={{
                fontSize:'0.72rem', color:'var(--mint-600)',
                background:'var(--mint-100)', padding:'3px 10px',
                borderRadius:'20px', fontWeight:600
              }}
            >
              {showAllDeadlines ? '접기' : `전체 보기 (${allPending.length})`}
            </button>
          </div>
          {urgentDeadlines.length === 0 ? (
            <div className="empty" style={{ padding:'8px 0' }}>D-7 이내 마감 없음</div>
          ) : urgentDeadlines.map((d, i) => {
            const realIdx = deadlines.indexOf(d)
            const diff    = daysUntilFrom(d.date, date)
            const tagCls  = diff <= 3 ? 'tag-red' : 'tag-yellow'
            const label   = diff === 0 ? 'D-Day' : `D-${diff}`
            return (
              <div key={i} className="deadline-item">
                <button
                  className={`check-circle${d.done ? ' checked' : ''}`}
                  onClick={() => toggleDeadline(realIdx)}
                >
                  {d.done ? '✓' : ''}
                </button>
                <div style={{ flex:1 }}>
                  <span className={d.done ? 'strikethrough' : ''}>{d.title}</span>
                  <div style={{ fontSize:'0.75rem', color:'var(--gray-400)', marginTop:'2px' }}>
                    {formatDate(d.date)}
                  </div>
                </div>
                <span className={`tag ${tagCls}`}>{label}</span>
              </div>
            )
          })}
        </section>
      )}

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

      {/* 수업 */}
      <section className="card">
        <div className="section-label">📚 {lbl} 수업</div>
        {!dayKey && <div className="empty">수업이 없어요 🎉</div>}
        {dayKey && lessons.length === 0 && <div className="empty">시간표를 설정해주세요</div>}
        {lessons.map((lesson, idx) => (
          <LessonCard
            key={`${lesson.className}-${idx}`}
            lesson={lesson}
            isToday={isToday}
            onComplete={(setCompleting) => completeLesson(lesson, setCompleting)}
            onSaveFields={(fields) => {
              setLessons(prev => prev.map((l, i) => i === idx ? { ...l, ...fields } : l))
            }}
          />
        ))}
      </section>

      {/* 일정 */}
      <section className="card">
        <div className="section-label">📌 {lbl} 일정</div>
        {daySchedules.length === 0
          ? <div className="empty">일정이 없어요</div>
          : daySchedules.map((s, i) => (
            <div key={i} className="schedule-item">
              <span className="schedule-time">{s.time || '--:--'}</span>
              <span style={{ fontSize:'0.9rem' }}>{s.content}</span>
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

// ── LessonCard ──────────────────────────────────────────────
function LessonCard({ lesson, isToday, onComplete, onSaveFields }) {
  const [editing,    setEditing]    = useState(false)
  const [draftLast,  setDraftLast]  = useState('')
  const [draftThis,  setDraftThis]  = useState('')
  const [completing, setCompleting] = useState(false)

  const startEdit = () => {
    setDraftLast(lesson.editedLastClass ?? lesson.lastClass ?? '')
    setDraftThis(lesson.editedThisClass ?? lesson.thisClass ?? '')
    setEditing(true)
  }

  const handleSave = () => {
    onSaveFields({ editedLastClass: draftLast, editedThisClass: draftThis })
    setEditing(false)
  }

  const isDone         = lesson.todayEntry?.status === 'done'
  const displayLast    = lesson.editedLastClass ?? lesson.lastClass
  const displayThis    = lesson.editedThisClass ?? lesson.thisClass
  const completeLabel  = isToday ? '✅ 수업 완료' : '📌 계획 저장'

  return (
    <div className="lesson-card" style={isDone ? { opacity:0.7, borderLeftColor:'var(--mint-300)' } : {}}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
        <div className="lesson-period">{lesson.period}교시</div>
        {isDone && <span className="tag tag-green" style={{ fontSize:'0.7rem' }}>✅ 완료</span>}
        {lesson.todayEntry?.status === 'plan' && (
          <span className="tag tag-mint" style={{ fontSize:'0.7rem' }}>📌 계획</span>
        )}
      </div>
      <div className="lesson-class">{lesson.className}</div>

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
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onComplete(setCompleting)}
              disabled={completing}
              style={completing ? { opacity:0.6 } : {}}
            >
              {completing ? '저장 중...' : completeLabel}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
