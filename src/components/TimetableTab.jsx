import { useState, useEffect } from 'react'
import {
  getBasicTimetable, saveBasicTimetable,
  getWeeklyTimetable, saveWeeklyTimetable,
  getProgressLogs, saveProgressLog,
  getCustomHolidays, saveCustomHolidays,
} from '../firebase'
import { DAYS, DAY_LABELS, PERIODS, getWeekKey, getNextWeekKey, getWeekDates, formatDate } from '../utils'

function TimetableGrid({ grid, onUpdate }) {
  return (
    <div style={{overflowX:'auto'}}>
      <div className="tt-grid" style={{gridTemplateColumns:`40px repeat(${DAYS.length},1fr)`,minWidth:'340px'}}>
        <div style={{fontSize:'0.75rem',color:'var(--gray-400)',display:'flex',alignItems:'center',justifyContent:'center'}}>교시</div>
        {DAYS.map(d => (
          <div key={d} style={{fontSize:'0.78rem',fontWeight:700,color:'var(--pink-600)',textAlign:'center',padding:'4px 0'}}>
            {DAY_LABELS[d]}
          </div>
        ))}
        {PERIODS.map(p => (
          <div key={p} style={{display:'contents'}}>
            <div style={{fontSize:'0.78rem',color:'var(--gray-500)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{p}</div>
            {DAYS.map(d => (
              <div key={`${d}-${p}`} className="tt-cell">
                <input value={grid[d]?.[p] || ''} onChange={e => onUpdate(d, p, e.target.value)} placeholder="-" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function BasicTimetable() {
  const [grid,   setGrid]   = useState({})
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => { getBasicTimetable().then(setGrid) }, [])

  const update = (day, period, val) => {
    setGrid(prev => ({ ...prev, [day]: { ...(prev[day]||{}), [period]: val } }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await saveBasicTimetable(grid)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="card">
      <div className="section-label">📆 기본 시간표 편집</div>
      <TimetableGrid grid={grid} onUpdate={update} />
      <button className="btn btn-primary w-full mt-16" onClick={save} disabled={saving}>
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
    </section>
  )
}

function WeeklyTimetable() {
  const weekKey = getWeekKey()
  const [grid,     setGrid]     = useState({})
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState('')

  useEffect(() => { getWeeklyTimetable(weekKey).then(setGrid) }, [weekKey])

  const loadFromBasic = async () => {
    const basic = await getBasicTimetable()
    setGrid(basic); setSaved(false)
  }

  const update = (day, period, val) => {
    setGrid(prev => ({ ...prev, [day]: { ...(prev[day]||{}), [period]: val } }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await saveWeeklyTimetable(weekKey, grid)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const applyToProgress = async () => {
    setApplying(true); setApplyMsg('')
    try {
      const weekDates = getWeekDates(weekKey)
      const classDateMap = {}
      for (const day of DAYS) {
        const date = weekDates[day]
        if (!date) continue
        for (const p of PERIODS) {
          const cn = (grid[day]?.[p] || '').trim()
          if (!cn) continue
          if (!classDateMap[cn]) classDateMap[cn] = new Set()
          classDateMap[cn].add(date)
        }
      }
      if (Object.keys(classDateMap).length === 0) {
        setApplyMsg('시간표에 반이 없습니다')
        setApplying(false)
        setTimeout(() => setApplyMsg(''), 3000)
        return
      }
      let added = 0
      for (const [cn, dates] of Object.entries(classDateMap)) {
        const logs = await getProgressLogs(cn)
        let changed = false
        for (const date of dates) {
          if (logs.find(l => l.date === date)) continue
          logs.push({
            id: `${date}-${cn}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            week: weekKey, date, content: '', status: 'plan',
          })
          changed = true; added++
        }
        if (changed) await saveProgressLog(cn, logs)
      }
      setApplyMsg(added > 0 ? `✅ ${added}건 추가됨` : '새로운 항목 없음')
    } catch(e) {
      setApplyMsg('오류가 발생했습니다'); console.error(e)
    }
    setApplying(false)
    setTimeout(() => setApplyMsg(''), 3000)
  }

  return (
    <section className="card">
      <div className="section-label">🗓️ 이번 주 시간표 ({weekKey})</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
        <button className="btn btn-secondary btn-sm" onClick={loadFromBasic}>기본 시간표 불러오기</button>
      </div>
      <TimetableGrid grid={grid} onUpdate={update} />
      <button className="btn btn-primary w-full mt-16" onClick={save} disabled={saving}>
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
      <div style={{marginTop:'12px',borderTop:'1px solid var(--gray-100)',paddingTop:'12px'}}>
        <button
          className="btn btn-secondary w-full"
          style={{background:'var(--pink-50)',color:'var(--pink-700)',border:'1.5px dashed var(--pink-300)'}}
          onClick={applyToProgress}
          disabled={applying}
        >
          {applying ? '처리 중...' : '📋 진도표에 반영'}
        </button>
        {applyMsg && (
          <div style={{
            marginTop:'8px',fontSize:'0.82rem',textAlign:'center',fontWeight:600,
            color: applyMsg.startsWith('✅') ? 'var(--pink-600)' : 'var(--gray-500)'
          }}>{applyMsg}</div>
        )}
        <div style={{fontSize:'0.72rem',color:'var(--gray-400)',marginTop:'6px',textAlign:'center'}}>
          저장된 시간표를 진도표에 📌 계획 항목으로 추가합니다
        </div>
      </div>
    </section>
  )
}

function NextWeeklyTimetable() {
  const nextWeekKey = getNextWeekKey()
  const thisWeekKey = getWeekKey()
  const [grid,   setGrid]   = useState({})
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => { getWeeklyTimetable(nextWeekKey).then(setGrid) }, [nextWeekKey])

  const loadFromBasic = async () => {
    const basic = await getBasicTimetable()
    setGrid(basic); setSaved(false)
  }

  const loadFromThisWeek = async () => {
    const thisWeek = await getWeeklyTimetable(thisWeekKey)
    setGrid(thisWeek); setSaved(false)
  }

  const update = (day, period, val) => {
    setGrid(prev => ({ ...prev, [day]: { ...(prev[day]||{}), [period]: val } }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await saveWeeklyTimetable(nextWeekKey, grid)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="card">
      <div className="section-label">📅 다음 주 시간표 ({nextWeekKey})</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
        <button className="btn btn-secondary btn-sm" onClick={loadFromBasic}>기본 시간표 불러오기</button>
        <button className="btn btn-secondary btn-sm" onClick={loadFromThisWeek}>이번 주 시간표 불러오기</button>
      </div>
      <TimetableGrid grid={grid} onUpdate={update} />
      <button className="btn btn-primary w-full mt-16" onClick={save} disabled={saving}>
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
    </section>
  )
}

const THIS_YEAR = new Date().getFullYear()

function HolidayManager({ onHolidaysChange }) {
  const [year,       setYear]       = useState(THIS_YEAR)
  const [pubHols,    setPubHols]    = useState([])
  const [customHols, setCustomHols] = useState([])
  const [loadingPub, setLoadingPub] = useState(false)
  const [form,       setForm]       = useState({ date:'', name:'' })
  const [saving,     setSaving]     = useState(false)

  useEffect(() => { getCustomHolidays().then(setCustomHols) }, [])

  useEffect(() => {
    setLoadingPub(true)
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPubHols(data.map(h => ({ date: h.date, name: h.localName }))); setLoadingPub(false) })
      .catch(() => { setPubHols([]); setLoadingPub(false) })
  }, [year])

  const addCustom = async () => {
    if (!form.date || !form.name.trim()) return
    const updated = [...customHols, { date: form.date, name: form.name.trim() }]
      .sort((a,b) => a.date.localeCompare(b.date))
    setSaving(true)
    await saveCustomHolidays(updated)
    setCustomHols(updated)
    setForm({ date:'', name:'' })
    setSaving(false)
    onHolidaysChange?.()
  }

  const removeCustom = async (date) => {
    const updated = customHols.filter(h => h.date !== date)
    await saveCustomHolidays(updated)
    setCustomHols(updated)
    onHolidaysChange?.()
  }

  // 선택 연도의 공휴일 + 임의 휴일 합산
  const yearStr = String(year)
  const customInYear = customHols.filter(h => h.date.startsWith(yearStr))
  const customDatesInYear = new Set(customInYear.map(h => h.date))
  const combined = [
    ...pubHols.filter(h => !customDatesInYear.has(h.date)).map(h => ({ ...h, isPublic: true })),
    ...customInYear.map(h => ({ ...h, isPublic: false })),
  ].sort((a,b) => a.date.localeCompare(b.date))

  return (
    <section className="card">
      <div className="section-label">🏖️ 휴일 관리</div>

      {/* 연도 선택 */}
      <div style={{display:'flex',gap:'6px',marginBottom:'14px',alignItems:'center',flexWrap:'wrap'}}>
        {[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map(y => (
          <button
            key={y}
            className={`btn btn-sm ${year===y?'btn-primary':'btn-secondary'}`}
            onClick={() => setYear(y)}
          >{y}년</button>
        ))}
        {loadingPub && <span style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>불러오는 중...</span>}
      </div>

      {/* 임의 휴일 추가 */}
      <div style={{background:'var(--pink-50)',borderRadius:'10px',padding:'12px',marginBottom:'14px',border:'1px solid var(--pink-200)'}}>
        <div style={{fontSize:'0.78rem',fontWeight:700,color:'var(--pink-700)',marginBottom:'8px'}}>임의 휴일 추가</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
          <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
          <input
            value={form.name}
            onChange={e=>setForm(p=>({...p,name:e.target.value}))}
            onKeyDown={e=>{ if(e.key==='Enter') addCustom() }}
            placeholder="재량휴업일, 수련회 등"
          />
        </div>
        <button className="btn btn-primary btn-sm w-full" onClick={addCustom} disabled={saving}>+ 추가</button>
      </div>

      {/* 목록 */}
      {!loadingPub && combined.length === 0 && (
        <div className="empty">{year}년 공휴일 정보 없음</div>
      )}
      {combined.map((h, i) => (
        <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 0',borderBottom:'1px solid var(--gray-100)'}}>
          <span style={{fontSize:'0.78rem',color:'var(--pink-600)',fontWeight:700,minWidth:'50px'}}>{formatDate(h.date)}</span>
          <span style={{flex:1,fontSize:'0.88rem'}}>{h.name}</span>
          {h.isPublic ? (
            <span style={{fontSize:'0.68rem',background:'var(--gray-100)',color:'var(--gray-500)',padding:'2px 8px',borderRadius:'20px',whiteSpace:'nowrap'}}>공휴일</span>
          ) : (
            <>
              <span style={{fontSize:'0.68rem',background:'var(--pink-100)',color:'var(--pink-700)',padding:'2px 8px',borderRadius:'20px',whiteSpace:'nowrap'}}>임의</span>
              <button
                className="btn btn-danger btn-icon"
                onClick={() => removeCustom(h.date)}
                style={{width:'28px',height:'28px',minHeight:'unset'}}
              >✕</button>
            </>
          )}
        </div>
      ))}
    </section>
  )
}

export default function TimetableTab({ onHolidaysChange }) {
  const [section, setSection] = useState('basic')
  const sections = [
    { id:'basic',       label:'기본 시간표' },
    { id:'weekly',      label:'이번 주' },
    { id:'nextweekly',  label:'다음 주' },
    { id:'holiday',     label:'휴일 관리' },
  ]
  return (
    <div className="page" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        {sections.map(s => (
          <button
            key={s.id}
            className={`btn btn-sm ${section===s.id?'btn-primary':'btn-secondary'}`}
            onClick={() => setSection(s.id)}
          >{s.label}</button>
        ))}
      </div>
      {section === 'basic'       && <BasicTimetable />}
      {section === 'weekly'      && <WeeklyTimetable />}
      {section === 'nextweekly'  && <NextWeeklyTimetable />}
      {section === 'holiday'     && <HolidayManager onHolidaysChange={onHolidaysChange} />}
    </div>
  )
}
