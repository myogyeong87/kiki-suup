import { useState } from 'react'
import DayTab from './components/DayTab'
import ProgressTab from './components/ProgressTab'
import ManageTab from './components/ManageTab'
import { getToday, getTomorrow } from './utils'

const TABS = [
  { id: 'today',    label: '오늘',   icon: '📅' },
  { id: 'tomorrow', label: '내일',   icon: '🌙' },
  { id: 'progress', label: '진도표', icon: '📊' },
  { id: 'manage',   label: '관리',   icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState('today')

  return (
    <>
      <header className="app-header">
        <h1>🧹 키키쌤의 마법빗자루</h1>
        <p className="subtitle">오늘도 마법같은 하루!</p>
      </header>

      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'today'    && <DayTab date={getToday()} />}
        {tab === 'tomorrow' && <DayTab date={getTomorrow()} />}
        {tab === 'progress' && <ProgressTab />}
        {tab === 'manage'   && <ManageTab />}
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
