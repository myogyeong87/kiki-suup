import { useState, useEffect } from 'react'
import {
  getBasicTimetable, saveBasicTimetable,
  getWeeklyTimetable, saveWeeklyTimetable,
  getProgressLogs, saveProgressLog,
  getCustomHolidays, saveCustomHolidays,
  getVacations, saveVacations,
} from '../firebase'
import { DAYS, DAY_LABELS, PERIODS, getWeekKey, getNextWeekKey, getWeekDates, formatDate, uniqueClasses } from '../utils'

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

// 진도표 반영 공통 로직
async function applyProgressLogic(weekKey, grid) {
  const weekDates = getWeekDates(weekKey)
  const weekDateSet = new Set(Object.values(weekDates))

  // 현재 시간표의 반-날짜 맵
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

  // 기본 시간표에서 전체 반 목록
  const basicTT = await getBasicTimetable()
  const allKnownClasses = uniqueClasses(basicTT)
  const currentClasses = new Set(Object.keys(classDateMap))
  const removedClasses = allKnownClasses.filter(cn => !currentClasses.has(cn))

  let added = 0, cleaned = 0

  // 현재 시간표에 있는 반: 없는 날짜 항목만 추가
  for (const [cn, dates] of Object.entries(classDateMap)) {
    const logs = await getProgressLogs(cn)
    let changed = false
    for (const date of dates) {
      if (logs.find(l => l.date === date)) continue // 이미 있으면 건드리지 않음
      logs.push({
        id: `${date}-${cn}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        week: weekKey, date, content: '', status: 'plan',
      })
      changed = true; added++
    }
    if (changed) await saveProgressLog(cn, logs)
  }

  // 시간표에서 빠진 반: 해당 주 날짜의 빈 plan 항목만 삭제 (내용 있거나 done/holiday는 유지)
  for (const cn of removedClasses) {
    const logs = await getProgressLogs(cn)
    const toKeep = logs.filter(l => {
      if (!weekDateSet.has(l.date)) return true
      if ((l.content || '').trim()) return true
      if (l.status !== 'plan') return true
      return false
    })
    if (toKeep.length !== logs.length) {
      await saveProgressLog(cn, toKeep)
      cleaned += logs.length - toKeep.length
    }
  }

  return { added, cleaned }
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
      if (Object.keys(grid).length === 0) {
        setApplyMsg('저장된 시간표가 없습니다')
        setApplying(false)
        setTimeout(() => setApplyMsg(''), 3000)
        return
      }
      const { added, cleaned } = await applyProgressLogic(weekKey, grid)
      let msg = ''
      if (added > 0 && cleaned > 0) msg = `✅ ${added}건 추가, ${cleaned}건 정리됨`
      else if (added > 0) msg = `✅ ${added}건 추가됨`
      else if (cleaned > 0) msg = `✅ ${cleaned}건 정리됨`
      else msg = '새로운 항목 없음'
      setApplyMsg(msg)
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
  const [grid,     setGrid]     = useState({})
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState('')

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

  const applyToProgress = async () => {
    setApplying(true); setApplyMsg('')
    try {
      if (Object.keys(grid).length === 0) {
        setApplyMsg('저장된 시간표가 없습니다')
        setApplying(false)
        setTimeout(() => setApplyMsg(''), 3000)
        return
      }
      const { added, cleaned } = await applyProgressLogic(nextWeekKey, grid)
      let msg = ''
      if (added > 0 && cleaned > 0) msg = `✅ ${added}건 추가, ${cleaned}건 정리됨`
      else if (added > 0) msg = `✅ ${added}건 추가됨`
      else if (cleaned > 0) msg = `✅ ${cleaned}건 정리됨`
      else msg = '새로운 항목 없음'
      setApplyMsg(msg)
    } catch(e) {
      setApplyMsg('오류가 발생했습니다'); console.error(e)
    }
    setApplying(false)
    setTimeout(() => setApplyMsg(''), 3000)
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

const THIS_YEAR = new Date().getFullYear()

function HolidayManager({ onHolidaysChange }) {
  const [year,        setYear]        = useState(THIS_YEAR)
  const [pubHols,     setPubHols]     = useState([])
  const [customHols,  setCustomHols]  = useState([])
  const [vacations,   setVacations]   = useState([])
  const [loadingPub,  setLoadingPub]  = useState(false)
  const [showPub,     setShowPub]     = useState(false)
  const [form,        setForm]        = useState({ date:'', name:'' })
  const [vacForm,     setVacForm]     = useState({ name:'', startDate:'', endDate:'' })
  const [saving,      setSaving]      = useState(false)
  const [savingVac,   setSavingVac]   = useState(false)

  useEffect(() => {
    getCustomHolidays().then(setCustomHols)
    getVacations().then(setVacations)
  }, [])

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

  const addVacation = async () => {
    if (!vacForm.name.trim() || !vacForm.startDate || !vacForm.endDate) return
    if (vacForm.endDate < vacForm.startDate) return
    const newVac = {
      id: `vac-${Date.now()}`,
      name: vacForm.name.trim(),
      startDate: vacForm.startDate,
      endDate: vacForm.endDate,
    }
    const updated = [...vacations, newVac].sort((a,b) => a.startDate.localeCompare(b.startDate))
    setSavingVac(true)
    await saveVacations(updated)
    setVacations(updated)
    setVacForm({ name:'', startDate:'', endDate:'' })
    setSavingVac(false)
    onHolidaysChange?.()
  }

  const removeVacation = async (id) => {
    const updated = vacations.filter(v => v.id !== id)
    await saveVacations(updated)
    setVacations(updated)
    onHolidaysChange?.()
  }

  const yearStr = String(year)
  const customInYear = customHols.filter(h => h.date.startsWith(yearStr))
  const customDatesInYear = new Set(customInYear.map(h => h.date))
  const combinedHols = [
    ...pubHols.filter(h => !customDatesInYear.has(h.date)).map(h => ({ ...h, isPublic: true })),
    ...customInYear.map(h => ({ ...h, isPublic: false })),
  ].sort((a,b) => a.date.localeCompare(b.date))

  return (
    <section className="card">
      <div className="section-label">🏖️ 휴일 관리</div>

      {/* ── 방학 기간 ─────────────────────────── */}
      <div style={{marginBottom:'18px'}}>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--pink-700)',marginBottom:'10px'}}>🌻 방학 기간</div>

        {vacations.length > 0 && (
          <div style={{marginBottom:'10px',display:'flex',flexDirection:'column',gap:'6px'}}>
            {vacations.map(v => (
              <div key={v.id} style={{
                display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',
                background:'#fffbe6',borderRadius:'8px',border:'1px solid #ffe08a'
              }}>
                <span style={{fontSize:'0.88rem',fontWeight:600,color:'#856404',flex:1}}>{v.name}</span>
                <span style={{fontSize:'0.75rem',color:'#b8860b',whiteSpace:'nowrap'}}>
                  {formatDate(v.startDate)} ~ {formatDate(v.endDate)}
                </span>
                <button
                  className="btn btn-danger btn-icon"
                  onClick={() => removeVacation(v.id)}
                  style={{width:'28px',height:'28px',minHeight:'unset',flexShrink:0}}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{background:'var(--pink-50)',borderRadius:'10px',padding:'12px',border:'1px solid var(--pink-200)'}}>
          <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--pink-700)',marginBottom:'8px'}}>방학 기간 추가</div>
          <input
            value={vacForm.name}
            onChange={e=>setVacForm(p=>({...p,name:e.target.value}))}
            placeholder="방학 이름 (예: 여름방학)"
            style={{marginBottom:'8px'}}
          />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
            <div>
              <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>시작일</label>
              <input type="date" value={vacForm.startDate} onChange={e=>setVacForm(p=>({...p,startDate:e.target.value}))} />
            </div>
            <div>
              <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>종료일</label>
              <input type="date" value={vacForm.endDate} onChange={e=>setVacForm(p=>({...p,endDate:e.target.value}))} />
            </div>
          </div>
          <button className="btn btn-primary btn-sm w-full" onClick={addVacation} disabled={savingVac}>+ 추가</button>
        </div>
      </div>

      {/* ── 임의 휴일 (단일 날짜) ──────────────── */}
      <div style={{marginBottom:'18px'}}>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--pink-700)',marginBottom:'10px'}}>📌 임의 휴일</div>
        <div style={{background:'var(--pink-50)',borderRadius:'10px',padding:'12px',border:'1px solid var(--pink-200)'}}>
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
      </div>

      {/* ── 공휴일 (자동) ─────────────────────── */}
      <div>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--pink-700)',marginBottom:'8px'}}>🇰🇷 공휴일 (자동)</div>
        <div style={{display:'flex',gap:'6px',marginBottom:'10px',alignItems:'center',flexWrap:'wrap'}}>
          {[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map(y => (
            <button
              key={y}
              className={`btn btn-sm ${year===y?'btn-primary':'btn-secondary'}`}
              onClick={() => setYear(y)}
            >{y}년</button>
          ))}
          {loadingPub && <span style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>불러오는 중...</span>}
        </div>

        <button
          onClick={() => setShowPub(p => !p)}
          style={{
            width:'100%',padding:'8px 12px',
            background:'none',border:'1px dashed var(--gray-300)',
            borderRadius:'8px',color:'var(--gray-400)',fontSize:'0.82rem',
            cursor:'pointer',display:'flex',justifyContent:'space-between'
          }}
        >
          <span>공휴일 목록 ({combinedHols.length}개)</span>
          <span>{showPub ? '▲' : '▼'}</span>
        </button>

        {showPub && (
          <div style={{marginTop:'8px'}}>
            {!loadingPub && combinedHols.length === 0 && (
              <div className="empty">{year}년 공휴일 정보 없음</div>
            )}
            {combinedHols.map((h, i) => (
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
          </div>
        )}
      </div>
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
