import { useState, useEffect, useCallback } from 'react'
import DayTab from './components/DayTab'
import ProgressTab from './components/ProgressTab'
import ScheduleTab from './components/ScheduleTab'
import TimetableTab from './components/TimetableTab'
import { getCustomHolidays, getVacations } from './firebase'
import { getToday, getTomorrow } from './utils'

const TABS = [
  { id: 'today',     label: '오늘',   icon: '📅' },
  { id: 'tomorrow',  label: '내일',   icon: '🌙' },
  { id: 'progress',  label: '진도표', icon: '📊' },
  { id: 'schedule',  label: '일정',   icon: '📋' },
  { id: 'timetable', label: '시간표', icon: '🗓️' },
]

export default function App() {
  const [tab,           setTab]           = useState('today')
  const [holidays,      setHolidays]      = useState([])
  const [vacations,     setVacations]     = useState([])
  const [progressClass, setProgressClass] = useState('')

  const loadHolidays = useCallback(async () => {
    const year = new Date().getFullYear()
    let pubHols = []
    try {
      const [r1, r2] = await Promise.allSettled([
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`),
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${year + 1}/KR`),
      ])
      for (const r of [r1, r2]) {
        if (r.status === 'fulfilled' && r.value.ok) {
          const data = await r.value.json()
          pubHols = [...pubHols, ...data.map(h => ({ date: h.date, name: h.localName, isPublic: true }))]
        }
      }
    } catch {}

    let customHols = []
    try { customHols = await getCustomHolidays() } catch {}

    let vacs = []
    try { vacs = await getVacations() } catch {}
    setVacations(vacs)

    const map = new Map()
    pubHols.forEach(h => map.set(h.date, h))
    customHols.forEach(h => map.set(h.date, { ...h, isPublic: false }))
    setHolidays([...map.values()].sort((a,b) => a.date.localeCompare(b.date)))
  }, [])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  const navigateToProgress = (className) => {
    setProgressClass(className)
    setTab('progress')
  }

  return (
    <>
      <header className="app-header">
        <h1>🧹 키키쌤의 마법빗자루</h1>
        <p className="subtitle">오늘도 마법같은 하루!</p>
      </header>

      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'today'     && <DayTab initialDate={getToday()} holidays={holidays} vacations={vacations} onNavigateToProgress={navigateToProgress} />}
        {tab === 'tomorrow'  && <DayTab initialDate={getTomorrow()} navigable={true} holidays={holidays} vacations={vacations} onNavigateToProgress={navigateToProgress} />}
        {tab === 'progress'  && <ProgressTab holidays={holidays} vacations={vacations} initialClass={progressClass} onClassSelected={() => setProgressClass('')} />}
        {tab === 'schedule'  && <ScheduleTab />}
        {tab === 'timetable' && <TimetableTab onHolidaysChange={loadHolidays} />}
      </main>

      <nav className="bottom-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-item${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="nav-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}
