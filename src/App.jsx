import { useState, useEffect, useCallback } from 'react'
import DayTab from './components/DayTab'
import ProgressTab from './components/ProgressTab'
import ScheduleTab from './components/ScheduleTab'
import TimetableTab from './components/TimetableTab'
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth'
import { getCustomHolidays, getVacations, auth, ALLOWED_EMAIL, signInWithGoogle, signOutUser } from './firebase'
import { getToday, getTomorrowWorkday } from './utils'

const TABS = [
  { id: 'today',     label: '오늘',   icon: '📅' },
  { id: 'tomorrow',  label: '내일',   icon: '🌙' },
  { id: 'progress',  label: '진도표', icon: '📊' },
  { id: 'schedule',  label: '일정',   icon: '📋' },
  { id: 'timetable', label: '시간표', icon: '🗓️' },
]

// 로그인 확인 후에만 앱(= Firestore 접근)을 띄운다
export default function App() {
  const [user,    setUser]    = useState(undefined) // undefined: 확인 중
  const [error,   setError]   = useState('')
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    getRedirectResult(auth).catch(e => setError(loginErrorMessage(e)))
    return onAuthStateChanged(auth, u => setUser(u || null))
  }, [])

  const login = async () => {
    setSigning(true); setError('')
    try { await signInWithGoogle() } catch (e) { setError(loginErrorMessage(e)) }
    setSigning(false)
  }

  if (user && user.email === ALLOWED_EMAIL) return <MainApp />

  return (
    <>
      <header className="app-header">
        <h1><img src="/icons/icon-192-v4.png" alt="" className="header-icon" /> 키키쌤의 마법빗자루</h1>
        <p className="subtitle">오늘도 마법같은 하루!</p>
      </header>
      <main className="page" style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <section className="card" style={{ textAlign:'center' }}>
          {user === undefined ? (
            <div style={{ color:'var(--gray-500)' }}>확인 중...</div>
          ) : user ? (
            <>
              <div style={{ fontWeight:700, marginBottom:'8px' }}>접근 권한이 없는 계정이에요</div>
              <div style={{ fontSize:'0.82rem', color:'var(--gray-500)', marginBottom:'16px' }}>{user.email}</div>
              <button className="btn btn-secondary w-full" onClick={signOutUser}>다른 계정으로 로그인</button>
            </>
          ) : (
            <>
              <div style={{ fontWeight:700, marginBottom:'6px' }}>🔒 로그인이 필요해요</div>
              <div style={{ fontSize:'0.82rem', color:'var(--gray-500)', marginBottom:'16px' }}>
                키키쌤 구글 계정으로 한 번 로그인하면 이 기기에서는 계속 유지돼요
              </div>
              <button className="btn btn-primary w-full" onClick={login} disabled={signing}>
                {signing ? '로그인 중...' : '구글 계정으로 로그인'}
              </button>
            </>
          )}
          {error && <div style={{ marginTop:'12px', fontSize:'0.8rem', color:'var(--pink-700)' }}>{error}</div>}
        </section>
      </main>
    </>
  )
}

function loginErrorMessage(e) {
  console.error('[login]', e)
  if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return ''
  if (e.code === 'auth/unauthorized-domain') return '이 주소는 아직 로그인이 허용되지 않았어요 (Firebase 승인된 도메인 확인)'
  if (e.code === 'auth/operation-not-allowed') return '구글 로그인이 아직 켜져 있지 않아요 (Firebase 콘솔 확인)'
  return `로그인에 실패했어요 (${e.code || e.message})`
}

function MainApp() {
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
        <h1><img src="/icons/icon-192-v4.png" alt="" className="header-icon" /> 키키쌤의 마법빗자루</h1>
        <p className="subtitle">오늘도 마법같은 하루!</p>
      </header>

      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'today'     && <DayTab initialDate={getToday()} holidays={holidays} vacations={vacations} onNavigateToProgress={navigateToProgress} />}
        {tab === 'tomorrow'  && <DayTab initialDate={getTomorrowWorkday()} navigable={true} holidays={holidays} vacations={vacations} onNavigateToProgress={navigateToProgress} />}
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
