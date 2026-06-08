import { useState, useEffect, useCallback } from 'react'
import {
  getBasicTimetable, saveBasicTimetable,
  getWeeklyTimetable, saveWeeklyTimetable,
  getSchedules, saveSchedules,
  getDeadlines, saveDeadlines
} from '../firebase'
import { DAYS, DAY_LABELS, PERIODS, getWeekKey, getToday, formatDate } from '../utils'

export default function ManageTab() {
  const [section, setSection] = useState('basic')

  const sections = [
    { id:'basic', label:'기본 시간표' },
    { id:'weekly', label:'이번 주 시간표' },
    { id:'schedule', label:'일정' },
    { id:'deadline', label:'마감' },
  ]

  return (
    <div className="page" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        {sections.map(s => (
          <button
            key={s.id}
            className={`btn btn-sm ${section===s.id?'btn-primary':'btn-secondary'}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'basic' && <BasicTimetable />}
      {section === 'weekly' && <WeeklyTimetable />}
      {section === 'schedule' && <ScheduleManager />}
      {section === 'deadline' && <DeadlineManager />}
    </div>
  )
}

function BasicTimetable() {
  const [grid, setGrid] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getBasicTimetable().then(data => setGrid(data))
  }, [])

  const update = (day, period, val) => {
    setGrid(prev => ({
      ...prev,
      [day]: { ...(prev[day]||{}), [period]: val }
    }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await saveBasicTimetable(grid)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="card">
      <div className="section-label">📆 기본 시간표 편집</div>
      <div style={{overflowX:'auto'}}>
        <div className="tt-grid" style={{gridTemplateColumns:`40px repeat(${DAYS.length},1fr)`,minWidth:'340px'}}>
          <div style={{fontSize:'0.75rem',color:'var(--gray-400)',display:'flex',alignItems:'center',justifyContent:'center'}}>교시</div>
          {DAYS.map(d => (
            <div key={d} style={{fontSize:'0.78rem',fontWeight:700,color:'var(--purple-600)',textAlign:'center',padding:'4px 0'}}>{DAY_LABELS[d]}</div>
          ))}
          {PERIODS.map(p => (
            <>
              <div key={`lbl-${p}`} style={{fontSize:'0.78rem',color:'var(--gray-500)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{p}</div>
              {DAYS.map(d => (
                <div key={`${d}-${p}`} className="tt-cell">
                  <input
                    value={grid[d]?.[p] || ''}
                    onChange={e => update(d, p, e.target.value)}
                    placeholder="-"
                  />
                </div>
              ))}
            </>
          ))}
        </div>
      </div>
      <button className="btn btn-primary w-full mt-16" onClick={save} disabled={saving}>
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
    </section>
  )
}

function WeeklyTimetable() {
  const weekKey = getWeekKey()
  const [grid, setGrid] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getWeeklyTimetable(weekKey).then(data => setGrid(data))
  }, [weekKey])

  const loadFromBasic = async () => {
    const basic = await getBasicTimetable()
    setGrid(basic)
    setSaved(false)
  }

  const update = (day, period, val) => {
    setGrid(prev => ({
      ...prev,
      [day]: { ...(prev[day]||{}), [period]: val }
    }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await saveWeeklyTimetable(weekKey, grid)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="card">
      <div className="section-label">🗓️ 이번 주 시간표 ({weekKey})</div>
      <button className="btn btn-secondary btn-sm mb-12" onClick={loadFromBasic}>
        기본 시간표 불러오기
      </button>
      <div style={{overflowX:'auto'}}>
        <div className="tt-grid" style={{gridTemplateColumns:`40px repeat(${DAYS.length},1fr)`,minWidth:'340px'}}>
          <div style={{fontSize:'0.75rem',color:'var(--gray-400)',display:'flex',alignItems:'center',justifyContent:'center'}}>교시</div>
          {DAYS.map(d => (
            <div key={d} style={{fontSize:'0.78rem',fontWeight:700,color:'var(--purple-600)',textAlign:'center',padding:'4px 0'}}>{DAY_LABELS[d]}</div>
          ))}
          {PERIODS.map(p => (
            <>
              <div key={`lbl-${p}`} style={{fontSize:'0.78rem',color:'var(--gray-500)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{p}</div>
              {DAYS.map(d => (
                <div key={`${d}-${p}`} className="tt-cell">
                  <input
                    value={grid[d]?.[p] || ''}
                    onChange={e => update(d, p, e.target.value)}
                    placeholder="-"
                  />
                </div>
              ))}
            </>
          ))}
        </div>
      </div>
      <button className="btn btn-primary w-full mt-16" onClick={save} disabled={saving}>
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
    </section>
  )
}

function ScheduleManager() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ date: getToday(), time: '', content: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSchedules().then(data => setItems([...data].sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))))
  }, [])

  const add = async () => {
    if (!form.content.trim()) return
    const updated = [...items, { ...form, id: Date.now().toString() }]
      .sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    setSaving(true)
    await saveSchedules(updated)
    setItems(updated)
    setForm({ date: getToday(), time: '', content: '' })
    setSaving(false)
  }

  const remove = async (id) => {
    const updated = items.filter(i => i.id !== id)
    await saveSchedules(updated)
    setItems(updated)
  }

  return (
    <section className="card">
      <div className="section-label">📌 일정 관리</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        <input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} />
        <input type="time" value={form.time} onChange={e => setForm(p=>({...p,time:e.target.value}))} placeholder="시간 (선택)" />
        <input value={form.content} onChange={e => setForm(p=>({...p,content:e.target.value}))} placeholder="일정 내용" />
        <button className="btn btn-primary" onClick={add} disabled={saving}>+ 추가</button>
      </div>
      {items.length === 0 && <div className="empty">등록된 일정이 없어요</div>}
      {items.map(item => (
        <div key={item.id} className="schedule-item">
          <div style={{flex:1}}>
            <div style={{fontSize:'0.78rem',color:'var(--purple-600)',fontWeight:700}}>{formatDate(item.date)} {item.time}</div>
            <div style={{fontSize:'0.9rem'}}>{item.content}</div>
          </div>
          <button className="btn btn-danger btn-icon" onClick={() => remove(item.id)}>✕</button>
        </div>
      ))}
    </section>
  )
}

function DeadlineManager() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ title: '', date: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDeadlines().then(data => setItems([...data].sort((a,b) => a.date.localeCompare(b.date))))
  }, [])

  const add = async () => {
    if (!form.title.trim() || !form.date) return
    const updated = [...items, { ...form, done: false, id: Date.now().toString() }]
      .sort((a,b) => a.date.localeCompare(b.date))
    setSaving(true)
    await saveDeadlines(updated)
    setItems(updated)
    setForm({ title: '', date: '' })
    setSaving(false)
  }

  const toggle = async (id) => {
    const updated = items.map(i => i.id===id ? {...i,done:!i.done} : i)
    await saveDeadlines(updated)
    setItems(updated)
  }

  const remove = async (id) => {
    const updated = items.filter(i => i.id!==id)
    await saveDeadlines(updated)
    setItems(updated)
  }

  return (
    <section className="card">
      <div className="section-label">⏰ 마감 관리</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="마감 항목 제목" />
        <input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} />
        <button className="btn btn-primary" onClick={add} disabled={saving}>+ 추가</button>
      </div>
      {items.length === 0 && <div className="empty">등록된 마감이 없어요</div>}
      {items.map(item => (
        <div key={item.id} className="deadline-item">
          <button className={`check-circle${item.done?' checked':''}`} onClick={() => toggle(item.id)}>
            {item.done ? '✓' : ''}
          </button>
          <div style={{flex:1}}>
            <span className={item.done?'strikethrough':''}>{item.title}</span>
            <div style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>{formatDate(item.date)}</div>
          </div>
          <button className="btn btn-danger btn-icon" onClick={() => remove(item.id)}>✕</button>
        </div>
      ))}
    </section>
  )
}
