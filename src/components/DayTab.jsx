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
  daysUntil, formatDate, PERIODS, DAY_LABELS
} from '../utils'

// date: 'YYYY-MM-DD' (오늘 또는 내일)
export default function DayTab({ date }) {
  const isToday  = date === getToday()
  const dayLabel = isToday ? '오늘' : '내일'
  const weekKey  = getWeekKey(date)
  const dayKey   = getDayKeyFromDate(date)
  const dayName  = dayKey ? DAY_LABELS[dayKey] : '주말'

  const [deadlines,     setDeadlines]     = useState([])
  const [homeroom,      setHomeroom]      = useState({ morning: '', afternoon: '' })
  const [homeroomDraft, setHomeroomDraft] = useState({ morning: '', afternoon: '' })
  const [lessons,       setLessons]       = useState([])
  const [schedules,     setSchedules]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [toastField,    setToastField]    = useState(null)
  const [toastMsg,      setToastMsg]      = useState('')

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
          // 해당 날짜 이전 마지막 완료 항목 → "지난 시간"
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

  // ── 마감 임박 ──────────────────────────────────────────────
  const toggleDeadline = async (realIdx) => {
    const updated = deadlines.map((d, i) => i === realIdx ? { ...d, done: !d.done } : d)
    setDeadlines(updated)
    await saveDeadlines(updated)
  }

  const urgentDeadlines = deadlines.filter(d => {
    if (d.done) return false
    const diff = daysUntil(d.date)
    return diff >= 0 && diff <= 7
  }).sort((a, b) => a.date.localeCompare(b.date))

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

  // ── 수업 완료 ───────────────────────────────────────────────
  const completeLesson = async (lesson, setCompleting) => {
    setCompleting(true)
    try {
      const freshLogs   = await getProgressLogs(lesson.className)
      const content     = (lesson.editedThisClass ?? lesson.thisClass) || ''
      const lastNote    = (lesson.editedLastClass  ?? lesson.lastClass) || ''
      const idx         = freshLogs.findIndex(l => l.date === date)
      const entry = {
        id:           (idx >= 0 && freshLogs[idx].id) || `${date}-${lesson.className}-${Date.now()}`,
        week:         weekKey,
        date,
        content,
        lastClassNote: lastNote,
        status:       'done',
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

  // ── 오늘/내일 일정 ─────────────────────────────────────────
  const daySchedules = schedules
    .filter(s => s.date === date)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ color:'var(--mint-400)' }}>불러오는 중... ✨</span>
    </div>
  )

  return (
    <div className="page" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* 전역 토스트 */}
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

      {/* 날짜 헤더 */}
      <div style={{ textAlign:'center', color:'var(--mint-600)', fontWeight:700, fontSize:'0.9rem' }}>
        {date} ({dayName})
        {!isToday && (
          <span style={{
            marginLeft:'8px', fontSize:'0.75rem',
            background:'var(--mint-100)', color:'var(--mint-700)',
            padding:'2px 8px', borderRadius:'20px', fontWeight:700
          }}>내일</span>
        )}
      </div>

      {/* 마감 임박 */}
      {urgentDeadlines.length > 0 && (
        <section className="card">
          <div className="section-label">⏰ 마감 임박</div>
          {urgentDeadlines.map((d, i) => {
            const realIdx = deadlines.indexOf(d)
            const diff = daysUntil(d.date)
            const tagCls = diff <= 3 ? 'tag-red' : 'tag-yellow'
            const label  = diff === 0 ? 'D-Day' : `D-${diff}`
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
          <div className="section-label" style={{ margin:0 }}>🌅 {dayLabel} 조회 메모</div>
          <span className={`save-toast${toastField === 'morning' ? ' visible' : ''}`}>저장됨 ✓</span>
        </div>
        <textarea
          rows={3}
          placeholder={`${dayLabel} 조회 시간 메모를 입력하세요...`}
          value={homeroomDraft.morning}
          onChange={e => setHomeroomDraft(p => ({ ...p, morning: e.target.value }))}
          onBlur={e => saveHomeroomField('morning', e.target.value)}
          style={{ resize:'vertical' }}
        />
      </section>

      {/* 수업 */}
      <section className="card">
        <div className="section-label">📚 {dayLabel} 수업</div>
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
        <div className="section-label">📌 {dayLabel} 일정</div>
        {daySchedules.length === 0
          ? <div className="empty">{dayLabel} 일정이 없어요</div>
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
          <div className="section-label" style={{ margin:0 }}>🌇 {dayLabel} 종례 메모</div>
          <span className={`save-toast${toastField === 'afternoon' ? ' visible' : ''}`}>저장됨 ✓</span>
        </div>
        <textarea
          rows={3}
          placeholder={`${dayLabel} 종례 시간 메모를 입력하세요...`}
          value={homeroomDraft.afternoon}
          onChange={e => setHomeroomDraft(p => ({ ...p, afternoon: e.target.value }))}
          onBlur={e => saveHomeroomField('afternoon', e.target.value)}
          style={{ resize:'vertical' }}
        />
      </section>
    </div>
  )
}

// ── LessonCard ──────────────────────────────────────────────────
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

  const isDone      = lesson.todayEntry?.status === 'done'
  const displayLast = lesson.editedLastClass ?? lesson.lastClass
  const displayThis = lesson.editedThisClass ?? lesson.thisClass
  const completeLabel = isToday ? '✅ 수업 완료' : '📌 계획 저장'

  return (
    <div className="lesson-card" style={isDone ? { opacity:0.7, borderLeftColor:'var(--mint-300)' } : {}}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
        <div className="lesson-period">{lesson.period}교시</div>
        {isDone && <span className="tag tag-green"  style={{ fontSize:'0.7rem' }}>✅ 완료</span>}
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
              {isToday ? '이번 시간 계획' : '내일 수업 계획'}
            </label>
            <input
              value={draftThis}
              onChange={e => setDraftThis(e.target.value)}
              placeholder={isToday ? '이번 시간 계획' : '내일 수업 계획'}
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
            <label>{isToday ? '이번 시간 계획' : '내일 수업 계획'}</label>
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
