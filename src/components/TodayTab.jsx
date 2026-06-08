import { useState, useEffect, useCallback } from 'react'
import {
  getDeadlines, saveDeadlines,
  getHomeroom, saveHomeroom,
  getBasicTimetable, getWeeklyTimetable,
  getProgressLogs, saveProgressLog,
  getSchedules
} from '../firebase'
import { getToday, getTodayDayKey, getWeekKey, daysUntil, formatDate, PERIODS } from '../utils'

export default function TodayTab() {
  const today = getToday()
  const weekKey = getWeekKey()
  const dayKey = getTodayDayKey()

  const [deadlines, setDeadlines] = useState([])
  const [homeroom, setHomeroom] = useState({ morning: '', afternoon: '' })
  const [homeroomDraft, setHomeroomDraft] = useState({ morning: '', afternoon: '' })
  const [todayLessons, setTodayLessons] = useState([]) // [{period, className, lastClass, thisClass}]
  const [schedules, setSchedules] = useState([])
  const [editLesson, setEditLesson] = useState(null) // {period, className, field, value}
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dl, hr, basic, weekly, sch] = await Promise.all([
        getDeadlines(),
        getHomeroom(today),
        getBasicTimetable(),
        getWeeklyTimetable(weekKey),
        getSchedules()
      ])
      setDeadlines(dl)
      setHomeroom(hr)
      setHomeroomDraft(hr)
      setSchedules(sch)

      if (!dayKey) { setTodayLessons([]); setLoading(false); return }

      // pick timetable: weekly overrides basic
      const dayData = (weekly[dayKey] && Object.keys(weekly[dayKey]).length)
        ? weekly[dayKey]
        : (basic[dayKey] || {})

      const lessons = []
      for (const p of PERIODS) {
        const cn = dayData[String(p)] || dayData[p]
        if (cn && cn.trim()) {
          const logs = await getProgressLogs(cn)
          const last = logs.length ? logs[logs.length - 1] : null
          lessons.push({
            period: p,
            className: cn.trim(),
            logs,
            lastClass: last?.thisClass || '',
            thisClass: last?.thisClassNext || ''
          })
        }
      }
      setTodayLessons(lessons)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [today, weekKey, dayKey])

  useEffect(() => { load() }, [load])

  // --- deadlines ---
  const toggleDeadline = async (idx) => {
    const updated = deadlines.map((d, i) => i === idx ? { ...d, done: !d.done } : d)
    setDeadlines(updated)
    await saveDeadlines(updated)
  }

  const urgentDeadlines = deadlines.filter(d => {
    if (d.done) return false
    const diff = daysUntil(d.date)
    return diff >= 0 && diff <= 7
  }).sort((a,b) => a.date.localeCompare(b.date))

  // --- homeroom save ---
  const saveHomeroomField = async (field, value) => {
    const updated = { ...homeroom, [field]: value }
    setHomeroom(updated)
    await saveHomeroom(today, updated)
  }

  // --- lesson complete ---
  const completeLesson = async (lesson) => {
    if (!lesson.editedThisClass && !lesson.thisClass) return
    const newEntry = {
      date: today,
      lastClass: lesson.lastClass,
      thisClass: lesson.editedThisClass ?? lesson.thisClass
    }
    const updatedLogs = [...lesson.logs, newEntry]
    await saveProgressLog(lesson.className, updatedLogs)
    await load()
  }

  // --- today schedules ---
  const todaySchedules = schedules
    .filter(s => s.date === today)
    .sort((a,b) => (a.time||'').localeCompare(b.time||''))

  if (loading) return (
    <div className="page" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
      <span style={{color:'var(--purple-400)'}}>불러오는 중... ✨</span>
    </div>
  )

  return (
    <div className="page" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      {/* 날짜 */}
      <div style={{textAlign:'center',color:'var(--purple-600)',fontWeight:700,fontSize:'0.9rem'}}>
        {today} ({dayKey ? {mon:'월',tue:'화',wed:'수',thu:'목',fri:'금'}[dayKey] : '주말'})
      </div>

      {/* 마감 임박 */}
      {urgentDeadlines.length > 0 && (
        <section className="card">
          <div className="section-label">⏰ 마감 임박</div>
          {urgentDeadlines.map((d, i) => {
            const diff = daysUntil(d.date)
            const tagCls = diff <= 3 ? 'tag-red' : 'tag-yellow'
            const label = diff === 0 ? 'D-Day' : `D-${diff}`
            return (
              <div key={i} className="deadline-item">
                <button className={`check-circle${d.done?' checked':''}`} onClick={() => toggleDeadline(deadlines.indexOf(d))}>
                  {d.done ? '✓' : ''}
                </button>
                <div style={{flex:1}}>
                  <span className={d.done ? 'strikethrough' : ''}>{d.title}</span>
                  <div style={{fontSize:'0.75rem',color:'var(--gray-400)',marginTop:'2px'}}>{formatDate(d.date)}</div>
                </div>
                <span className={`tag ${tagCls}`}>{label}</span>
              </div>
            )
          })}
        </section>
      )}

      {/* 조회 메모 */}
      <section className="card">
        <div className="section-label">🌅 조회 메모</div>
        <textarea
          rows={3}
          placeholder="조회 시간 메모를 입력하세요..."
          value={homeroomDraft.morning}
          onChange={e => setHomeroomDraft(p => ({...p, morning: e.target.value}))}
          onBlur={e => saveHomeroomField('morning', e.target.value)}
          style={{resize:'vertical'}}
        />
      </section>

      {/* 오늘 수업 */}
      <section className="card">
        <div className="section-label">📚 오늘 수업</div>
        {!dayKey && <div className="empty">오늘은 수업이 없어요 🎉</div>}
        {dayKey && todayLessons.length === 0 && (
          <div className="empty">시간표를 설정해주세요</div>
        )}
        {todayLessons.map((lesson, idx) => (
          <LessonCard
            key={idx}
            lesson={lesson}
            onComplete={() => completeLesson(lesson)}
            onEdit={(field, value) => {
              setTodayLessons(prev => prev.map((l,i) =>
                i === idx ? {...l, [field]: value} : l
              ))
            }}
            onSaveThisClass={async (value) => {
              const updatedLesson = {...lesson, editedThisClass: value}
              setTodayLessons(prev => prev.map((l,i) => i===idx ? updatedLesson : l))
            }}
          />
        ))}
      </section>

      {/* 오늘 일정 */}
      <section className="card">
        <div className="section-label">📌 오늘 일정</div>
        {todaySchedules.length === 0
          ? <div className="empty">오늘 일정이 없어요</div>
          : todaySchedules.map((s,i) => (
            <div key={i} className="schedule-item">
              <span className="schedule-time">{s.time || '--:--'}</span>
              <span style={{fontSize:'0.9rem'}}>{s.content}</span>
            </div>
          ))
        }
      </section>

      {/* 종례 메모 */}
      <section className="card">
        <div className="section-label">🌇 종례 메모</div>
        <textarea
          rows={3}
          placeholder="종례 시간 메모를 입력하세요..."
          value={homeroomDraft.afternoon}
          onChange={e => setHomeroomDraft(p => ({...p, afternoon: e.target.value}))}
          onBlur={e => saveHomeroomField('afternoon', e.target.value)}
          style={{resize:'vertical'}}
        />
      </section>
    </div>
  )
}

function LessonCard({ lesson, onComplete, onEdit, onSaveThisClass }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(lesson.editedThisClass ?? lesson.thisClass ?? '')

  const handleSave = () => {
    onSaveThisClass(draft)
    setEditing(false)
  }

  return (
    <div className="lesson-card">
      <div className="lesson-period">{lesson.period}교시</div>
      <div className="lesson-class">{lesson.className}</div>
      <div className="lesson-field">
        <label>지난 시간</label>
        <p>{lesson.lastClass || <span style={{color:'var(--gray-300)'}}>기록 없음</span>}</p>
      </div>
      <div className="lesson-field" style={{marginTop:'8px'}}>
        <label>이번 시간 계획</label>
        {editing ? (
          <div style={{display:'flex',gap:'6px',marginTop:'4px'}}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="이번 시간 내용 입력"
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleSave}>저장</button>
          </div>
        ) : (
          <p>{(lesson.editedThisClass ?? lesson.thisClass) || <span style={{color:'var(--gray-300)'}}>미입력</span>}</p>
        )}
      </div>
      <div className="lesson-actions">
        {!editing && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setDraft(lesson.editedThisClass ?? lesson.thisClass ?? ''); setEditing(true) }}>
            ✏️ 편집
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={onComplete}>
          ✅ 수업 완료
        </button>
      </div>
    </div>
  )
}
