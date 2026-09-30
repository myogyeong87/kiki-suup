import { useState, useEffect } from 'react'
import {
  getBasicTimetable,
  getSemesters, saveSemesters, getActiveSemesterId,
  getWeeklyTimetable, saveWeeklyTimetable,
  getProgressLogs, saveProgressLog,
  getCustomHolidays, saveCustomHolidays,
  getVacations, saveVacations,
  exportAllData,
} from '../firebase'
import { DAYS, DAY_LABELS, PERIODS, getWeekKey, getNextWeekKey, getWeekDates, formatDate, uniqueClasses, getToday, getActiveSemester } from '../utils'

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

function SemesterManager() {
  const [semesters,  setSemesters]  = useState([])
  const [editingId,  setEditingId]  = useState(null)
  const [form,       setForm]       = useState({ name:'', startDate:'' })
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  useEffect(() => { getSemesters().then(setSemesters) }, [])

  const activeId = getActiveSemester(semesters, getToday())?.id

  const addSemester = async () => {
    if (!form.name.trim() || !form.startDate) return
    const newItem = { id: `sem-${Date.now()}`, name: form.name.trim(), startDate: form.startDate, timetable: {} }
    const updated = [...semesters, newItem]
    setSaving(true)
    await saveSemesters(updated)
    setSemesters(updated)
    setForm({ name:'', startDate:'' })
    setSaving(false)
    setEditingId(newItem.id)
  }

  const removeSemester = async (id) => {
    if (!window.confirm('이 학기 시간표를 삭제할까요? 저장된 시간표 데이터가 사라집니다.')) return
    const updated = semesters.filter(s => s.id !== id)
    await saveSemesters(updated)
    setSemesters(updated)
    if (editingId === id) setEditingId(null)
  }

  const updateGrid = (day, period, val) => {
    setSemesters(prev => prev.map(s => s.id === editingId
      ? { ...s, timetable: { ...s.timetable, [day]: { ...(s.timetable[day]||{}), [period]: val } } }
      : s))
    setSaved(false)
  }

  const updateInfo = (field, val) => {
    setSemesters(prev => prev.map(s => s.id === editingId ? { ...s, [field]: val } : s))
    setSaved(false)
  }

  const saveGrid = async () => {
    const cur = semesters.find(s => s.id === editingId)
    if (!cur?.name?.trim() || !cur?.startDate) { alert('학기 이름과 시작일을 입력해 주세요'); return }
    if (semesters.some(s => s.id !== cur.id && s.startDate === cur.startDate)) {
      alert('다른 학기와 시작일이 같아요. 시작일을 다르게 입력해 주세요'); return
    }
    setSaving(true)
    await saveSemesters(semesters)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const editingSemester = semesters.find(s => s.id === editingId)

  return (
    <section className="card">
      <div className="section-label">📆 학기 관리</div>

      {semesters.length > 0 && (
        <div style={{ marginBottom:'14px', display:'flex', flexDirection:'column', gap:'6px' }}>
          {semesters.map(s => (
            <div key={s.id} style={{
              display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px',
              background: s.id === editingId ? 'var(--pink-50)' : '#f9f9f9',
              border: s.id === editingId ? '1.5px solid var(--pink-300)' : '1px solid var(--gray-100)',
              borderRadius:'8px',
            }}>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:'0.88rem', fontWeight:600 }}>{s.name}</span>
                {s.id === activeId && (
                  <span className="tag tag-green" style={{ fontSize:'0.65rem', marginLeft:'6px' }}>현재 적용중</span>
                )}
                <div style={{ fontSize:'0.72rem', color:'var(--gray-400)', marginTop:'2px' }}>
                  {formatDate(s.startDate)}부터
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(editingId === s.id ? null : s.id)}>
                {editingId === s.id ? '접기' : '편집'}
              </button>
              <button
                className="btn btn-danger btn-icon"
                onClick={() => removeSemester(s.id)}
                style={{ width:'28px', height:'28px', minHeight:'unset', flexShrink:0 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ background:'var(--pink-50)', borderRadius:'10px', padding:'12px', border:'1px solid var(--pink-200)', marginBottom: editingSemester ? '16px' : 0 }}>
        <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--pink-700)', marginBottom:'8px' }}>학기 추가</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="예: 2025년 1학기"
          />
          <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
        </div>
        <button className="btn btn-primary btn-sm w-full" onClick={addSemester} disabled={saving}>+ 추가</button>
      </div>

      {editingSemester && (
        <>
          <div className="section-label" style={{ marginTop:'16px' }}>✏️ 학기 정보</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px' }}>
            <input
              value={editingSemester.name}
              onChange={e => updateInfo('name', e.target.value)}
              placeholder="예: 2026년 1학기"
            />
            <input type="date" value={editingSemester.startDate} onChange={e => updateInfo('startDate', e.target.value)} />
          </div>
          <div className="section-label">🗓️ {editingSemester.name} 시간표</div>
          <TimetableGrid grid={editingSemester.timetable} onUpdate={updateGrid} />
          <button className="btn btn-primary w-full mt-16" onClick={saveGrid} disabled={saving}>
            {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
          </button>
        </>
      )}
    </section>
  )
}

// 진도표 반영 공통 로직
// prevGrid: 저장 전 시간표 (이번 주에만 있다가 빠진 반도 정리하기 위해)
async function applyProgressLogic(weekKey, grid, prevGrid = {}) {
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

  // 확인 대상 반: 기본 시간표 + 이전 주간 시간표 + 현재 시간표
  const basicTT = await getBasicTimetable(weekDates.mon)
  const allClasses = new Set([
    ...uniqueClasses(basicTT),
    ...uniqueClasses(prevGrid),
    ...Object.keys(classDateMap),
  ])
  const semesterId = await getActiveSemesterId(weekDates.mon)

  let added = 0, cleaned = 0

  for (const cn of allClasses) {
    const dates = classDateMap[cn] || new Set()
    const logs = await getProgressLogs(cn, semesterId)

    // 수업 없는 날짜의 빈 plan 항목만 삭제 (내용 있거나 done/holiday는 유지)
    const kept = logs.filter(l => {
      if (!weekDateSet.has(l.date)) return true
      if (dates.has(l.date)) return true
      if ((l.content || '').trim()) return true
      if (l.status !== 'plan') return true
      return false
    })
    const removed = logs.length - kept.length

    // 수업 있는 날짜 중 항목 없는 날짜만 추가
    let addedHere = 0
    for (const date of dates) {
      if (kept.find(l => l.date === date)) continue // 이미 있으면 건드리지 않음
      kept.push({
        id: `${date}-${cn}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        week: weekKey, date, content: '', status: 'plan',
      })
      addedHere++
    }

    if (removed || addedHere) {
      await saveProgressLog(cn, kept, semesterId)
      added += addedHere; cleaned += removed
    }
  }

  return { added, cleaned }
}

// 시간표 변경 알림 (오늘/내일 탭이 즉시 다시 불러오도록)
function notifyTimetableUpdated() {
  window.dispatchEvent(new Event('timetable-updated'))
}

// 시간표 저장 + 진도표 반영을 한 번에
async function saveAndApply(weekKey, grid) {
  const prevGrid = await getWeeklyTimetable(weekKey)
  await saveWeeklyTimetable(weekKey, grid)
  notifyTimetableUpdated()

  // 오늘/내일 탭과 같은 기준: 주간 시간표에 없는 요일은 기본 시간표 사용
  const basic = await getBasicTimetable(getWeekDates(weekKey).mon)
  const effective = {}
  for (const day of DAYS) {
    effective[day] = (grid[day] && Object.keys(grid[day]).length) ? grid[day] : (basic[day] || {})
  }
  return applyProgressLogic(weekKey, effective, prevGrid)
}

function saveResultMessage({ added, cleaned }) {
  const parts = []
  if (added > 0) parts.push(`진도표 ${added}건 추가`)
  if (cleaned > 0) parts.push(`${cleaned}건 정리`)
  return parts.length ? `✅ 저장됨 · ${parts.join(', ')}` : '✅ 저장됨'
}

function WeekTimetableEditor({ weekKey, title, extraLoaders = [] }) {
  const [grid,   setGrid]   = useState({})
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState('')

  useEffect(() => { getWeeklyTimetable(weekKey).then(setGrid) }, [weekKey])

  const loadFrom = async (loader) => {
    setGrid(await loader()); setMsg('')
  }

  const update = (day, period, val) => {
    setGrid(prev => ({ ...prev, [day]: { ...(prev[day]||{}), [period]: val } }))
    setMsg('')
  }

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      setMsg(saveResultMessage(await saveAndApply(weekKey, grid)))
    } catch(e) {
      setMsg('오류가 발생했습니다'); console.error(e)
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <section className="card">
      <div className="section-label">{title} ({weekKey})</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
        <button className="btn btn-secondary btn-sm" onClick={() => loadFrom(() => getBasicTimetable(getWeekDates(weekKey).mon))}>기본 시간표 불러오기</button>
        {extraLoaders.map(l => (
          <button key={l.label} className="btn btn-secondary btn-sm" onClick={() => loadFrom(l.load)}>{l.label}</button>
        ))}
      </div>
      <TimetableGrid grid={grid} onUpdate={update} />
      <button className="btn btn-primary w-full mt-16" onClick={save} disabled={saving}>
        {saving ? '저장 중...' : '저장'}
      </button>
      {msg && (
        <div style={{
          marginTop:'8px',fontSize:'0.82rem',textAlign:'center',fontWeight:600,
          color: msg.startsWith('✅') ? 'var(--pink-600)' : 'var(--gray-500)'
        }}>{msg}</div>
      )}
      <div style={{fontSize:'0.72rem',color:'var(--gray-400)',marginTop:'6px',textAlign:'center'}}>
        저장하면 진도표에도 자동 반영됩니다 (내용 없는 📌 계획 칸만 정리)
      </div>
    </section>
  )
}

function WeeklyTimetable() {
  return <WeekTimetableEditor weekKey={getWeekKey()} title="🗓️ 이번 주 시간표" />
}

function NextWeeklyTimetable() {
  const thisWeekKey = getWeekKey()
  return (
    <WeekTimetableEditor
      weekKey={getNextWeekKey()}
      title="📅 다음 주 시간표"
      extraLoaders={[{ label: '이번 주 시간표 불러오기', load: () => getWeeklyTimetable(thisWeekKey) }]}
    />
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

function BackupManager() {
  const [busy, setBusy] = useState(false)
  const [msg,  setMsg]  = useState('')

  const download = async () => {
    setBusy(true); setMsg('')
    try {
      const data = await exportAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `마법빗자루-백업-${getToday()}.json`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      setMsg('✅ 백업 파일을 저장했어요')
    } catch(e) {
      setMsg('오류가 발생했습니다'); console.error(e)
    }
    setBusy(false)
  }

  return (
    <section className="card">
      <div className="section-label">💾 전체 자료 백업</div>
      <div style={{ fontSize:'0.8rem', color:'var(--gray-500)', lineHeight:1.6, marginBottom:'12px' }}>
        학기·시간표·진도표·일정·상담·할 일·조회/종례·휴일·방학 자료를 파일 하나(JSON)로 저장합니다.
        학년도가 바뀌기 전에 한 번씩 받아 두면 안심이에요.
      </div>
      <button className="btn btn-primary w-full" onClick={download} disabled={busy}>
        {busy ? '백업 만드는 중...' : '📥 백업 파일 내려받기'}
      </button>
      {msg && (
        <div style={{
          marginTop:'8px',fontSize:'0.82rem',textAlign:'center',fontWeight:600,
          color: msg.startsWith('✅') ? 'var(--pink-600)' : 'var(--gray-500)'
        }}>{msg}</div>
      )}
    </section>
  )
}

export default function TimetableTab({ onHolidaysChange }) {
  const [section, setSection] = useState('semester')
  const sections = [
    { id:'semester',    label:'학기 관리' },
    { id:'weekly',      label:'이번 주' },
    { id:'nextweekly',  label:'다음 주' },
    { id:'holiday',     label:'휴일 관리' },
    { id:'backup',      label:'백업' },
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
      {section === 'semester'    && <SemesterManager />}
      {section === 'weekly'      && <WeeklyTimetable />}
      {section === 'nextweekly'  && <NextWeeklyTimetable />}
      {section === 'holiday'     && <HolidayManager onHolidaysChange={onHolidaysChange} />}
      {section === 'backup'      && <BackupManager />}
    </div>
  )
}
