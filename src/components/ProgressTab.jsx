import { useState, useEffect, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx-js-style'
import { getBasicTimetable, getProgressLogs, saveProgressLog } from '../firebase'
import { uniqueClasses, formatDate, getWeekKey, getWeekDates, getToday } from '../utils'

const STATUS_OPTIONS = [
  { value: 'plan',    label: '📌 계획' },
  { value: 'done',    label: '✅ 완료' },
  { value: 'holiday', label: '🔴 휴강' },
]

const STATUS_LABEL = { done: '완료', plan: '계획', holiday: '휴강' }

function StatusBadge({ status }) {
  const map = {
    plan:    { cls: 'tag-mint',  label: '📌 계획' },
    done:    { cls: 'tag-green', label: '✅ 완료' },
    holiday: { cls: 'tag-red',   label: '🔴 휴강' },
  }
  const s = map[status] || map.plan
  return <span className={`tag ${s.cls}`} style={{fontSize:'0.7rem',whiteSpace:'nowrap'}}>{s.label}</span>
}

const CELL_COLORS = {
  done:    { background: '#d45880', color: '#fff' },
  plan:    { background: '#fce4ee', color: '#7a2048' },
  holiday: { background: '#f0f0f0', color: '#888' },
}

// xlsx-js-style 셀 스타일 정의
const XLS_S = {
  done:    { fill:{ patternType:'solid', fgColor:{ rgb:'D45880' } }, font:{ color:{ rgb:'FFFFFF' }, sz:10 } },
  plan:    { fill:{ patternType:'solid', fgColor:{ rgb:'FCE4EE' } }, font:{ color:{ rgb:'7A2048' }, sz:10 } },
  holiday: { fill:{ patternType:'solid', fgColor:{ rgb:'F0F0F0' } }, font:{ color:{ rgb:'888888' }, sz:10 } },
  header:  { fill:{ patternType:'solid', fgColor:{ rgb:'FDF0F5' } }, font:{ bold:true, color:{ rgb:'5A2038' }, sz:10 } },
  weekCol: { fill:{ patternType:'solid', fgColor:{ rgb:'FDF0F5' } }, font:{ bold:true, color:{ rgb:'7A2048' }, sz:10 } },
}

function OverallView({ classes, holidays, onSelectClass }) {
  const [allLogs, setAllLogs] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!classes.length) { setLoading(false); return }
    setLoading(true)
    Promise.all(classes.map(cls =>
      getProgressLogs(cls).then(logs => [cls, logs])
    )).then(results => {
      const map = {}
      results.forEach(([cls, logs]) => { map[cls] = logs })
      setAllLogs(map)
      setLoading(false)
    })
  }, [classes])

  const allWeeks = useMemo(() => {
    const weekSet = new Set()
    Object.values(allLogs).forEach(logs => {
      logs.forEach(log => { if (log.week) weekSet.add(log.week) })
    })
    return [...weekSet].sort()
  }, [allLogs])

  // matrix[weekKey][className] = logs[]
  const matrix = useMemo(() => {
    const m = {}
    allWeeks.forEach(wk => { m[wk] = {} })
    Object.entries(allLogs).forEach(([cls, logs]) => {
      logs.forEach(log => {
        if (log.week && m[log.week]) {
          if (!m[log.week][cls]) m[log.week][cls] = []
          m[log.week][cls].push(log)
        }
      })
    })
    return m
  }, [allLogs, allWeeks])

  const holidayDates = useMemo(() => new Set(holidays.map(h => h.date)), [holidays])

  const weekHasHoliday = (wk) => {
    const dates = getWeekDates(wk)
    return Object.values(dates).some(d => holidayDates.has(d))
  }

  const getCellStatus = (logs) => {
    if (!logs || logs.length === 0) return null
    if (logs.some(l => l.status === 'done')) return 'done'
    if (logs.some(l => l.status === 'plan')) return 'plan'
    return 'holiday'
  }

  const getCellContent = (logs) => {
    if (!logs || logs.length === 0) return ''
    return logs.map(l => l.content).filter(Boolean).join(' / ')
  }

  // 전체 현황 엑셀 내보내기
  const exportXlsx = () => {
    const wb = XLSX.utils.book_new()
    const headerRow = [
      { v: '주차', s: XLS_S.header },
      { v: '날짜', s: XLS_S.header },
      ...classes.map(c => ({ v: c, s: XLS_S.header }))
    ]
    const dataRows = allWeeks.map((wk, idx) => {
      const dates = getWeekDates(wk)
      const range = `${formatDate(dates.mon)}~${formatDate(dates.fri)}`
      return [
        { v: `${idx + 1}주차`, s: XLS_S.weekCol },
        { v: range, s: XLS_S.weekCol },
        ...classes.map(cls => {
          const cellLogs = matrix[wk]?.[cls]
          const status = getCellStatus(cellLogs)
          const content = getCellContent(cellLogs)
          return { v: content || STATUS_LABEL[status] || '', s: status ? XLS_S[status] : {} }
        })
      ]
    })
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
    ws['!cols'] = [{ wch: 8 }, { wch: 12 }, ...classes.map(() => ({ wch: 16 }))]
    XLSX.utils.book_append_sheet(wb, ws, '전체현황')
    XLSX.writeFile(wb, `키키쌤_진도표_${getToday()}.xlsx`)
  }

  if (loading) return <div className="empty">불러오는 중...</div>
  if (!classes.length) return <div className="empty">기본 시간표에서 반을 먼저 등록하세요</div>
  if (!allWeeks.length) return <div className="empty">진도 기록이 없어요</div>

  const WEEK_COL_W = 72
  const CLASS_COL_W = 110

  return (
    <>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px'}}>
        <span style={{fontSize:'0.75rem', color:'var(--gray-400)'}}>셀 클릭 → 반별 보기 이동</span>
        <button className="btn btn-secondary btn-sm" onClick={exportXlsx}>📥 엑셀</button>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: WEEK_COL_W + classes.length * CLASS_COL_W }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', left: 0, zIndex: 2,
                background: '#fdf0f5',
                width: WEEK_COL_W, minWidth: WEEK_COL_W,
                padding: '8px 10px', fontSize: '0.72rem', color: '#b06080',
                borderBottom: '2px solid #f5c2d5',
                borderRight: '2px solid #f5c2d5',
                textAlign: 'center',
              }}>주차</th>
              {classes.map(cls => (
                <th key={cls} style={{
                  padding: '8px 10px', fontSize: '0.78rem',
                  fontWeight: 600, color: '#5a2038',
                  background: '#fdf0f5',
                  borderBottom: '2px solid #f5c2d5',
                  borderRight: '1px solid #f5e6ee',
                  width: CLASS_COL_W, minWidth: CLASS_COL_W,
                  maxWidth: CLASS_COL_W,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}>{cls}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allWeeks.map((wk, idx) => {
              const dates = getWeekDates(wk)
              const range = `${formatDate(dates.mon)}~${formatDate(dates.fri)}`
              const hasHoliday = weekHasHoliday(wk)
              // 주차 내 휴일 이름 (첫 번째)
              const weekHolName = hasHoliday
                ? (holidays.find(h => Object.values(dates).includes(h.date))?.name || '')
                : ''
              return (
                <tr key={wk}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    background: '#fdf0f5',
                    padding: '8px 10px',
                    borderBottom: '1px solid #f5e6ee',
                    borderRight: '2px solid #f5c2d5',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7a2048' }}>{idx + 1}주차</div>
                    <div style={{ fontSize: '0.65rem', color: '#b06080', marginTop: '2px' }}>{range}</div>
                    {weekHolName && (
                      <div style={{ fontSize: '0.6rem', color: '#d45880', marginTop: '2px' }}>🏖️ {weekHolName}</div>
                    )}
                  </td>
                  {classes.map(cls => {
                    const cellLogs = matrix[wk]?.[cls]
                    const status = getCellStatus(cellLogs)
                    const content = getCellContent(cellLogs)
                    // 휴일 주 빈 셀은 연회색
                    const colorStyle = status
                      ? CELL_COLORS[status]
                      : hasHoliday
                        ? { background: '#f5f5f5', color: '#bbb' }
                        : { background: '#fff', color: '#ccc' }
                    const cellLabel = content || STATUS_LABEL[status] || ''
                    return (
                      <td
                        key={cls}
                        onClick={() => status && onSelectClass(cls)}
                        title={content || undefined}
                        style={{
                          padding: '7px 9px',
                          borderBottom: '1px solid #f0f0f0',
                          borderRight: '1px solid #f0f0f0',
                          cursor: status ? 'pointer' : 'default',
                          ...colorStyle,
                        }}
                      >
                        <div style={{
                          fontSize: '0.78rem',
                          lineHeight: 1.3,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: CLASS_COL_W - 18,
                        }}>
                          {cellLabel}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function ProgressTab({ holidays = [] }) {
  const [viewMode,   setViewMode]   = useState('class') // 'class' | 'overall'
  const [classes,    setClasses]    = useState([])
  const [selected,   setSelected]   = useState('')
  const [logs,       setLogs]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editDraft,  setEditDraft]  = useState({ date:'', content:'', status:'plan' })
  const [showAdd,    setShowAdd]    = useState(false)
  const [addForm,    setAddForm]    = useState({ date: getToday(), content: '', status: 'plan' })
  const editContentRef = useRef(null)

  useEffect(() => {
    getBasicTimetable().then(tt => {
      const list = uniqueClasses(tt)
      setClasses(list)
      if (list.length) setSelected(list[0])
    })
  }, [])

  const loadLogs = (cls) => {
    if (!cls) return
    setLoading(true)
    setEditingIdx(null)
    setShowAdd(false)
    getProgressLogs(cls).then(data => {
      setLogs([...data].sort((a,b) => (a.date||'').localeCompare(b.date||'')))
      setLoading(false)
    })
  }

  useEffect(() => { loadLogs(selected) }, [selected])

  // ── 추가 ──────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addForm.date) return
    const entry = {
      id:      `${addForm.date}-${selected}-${Date.now()}`,
      week:    getWeekKey(addForm.date),
      date:    addForm.date,
      content: addForm.content,
      status:  addForm.status,
    }
    const updated = [...logs, entry].sort((a,b) => (a.date||'').localeCompare(b.date||''))
    await saveProgressLog(selected, updated)
    setLogs(updated)
    setAddForm({ date: getToday(), content: '', status: 'plan' })
    setShowAdd(false)
  }

  // ── 편집 ──────────────────────────────────────────────────
  const startEdit = (idx) => {
    const l = logs[idx]
    setEditDraft({ date: l.date || '', content: l.content || '', status: l.status || 'plan' })
    setEditingIdx(idx)
    setTimeout(() => editContentRef.current?.focus(), 50)
  }
  const cancelEdit = () => setEditingIdx(null)
  const saveEdit = async (idx) => {
    const updated = logs.map((l,i) => i === idx ? { ...l, ...editDraft } : l)
      .sort((a,b) => (a.date||'').localeCompare(b.date||''))
    await saveProgressLog(selected, updated)
    setLogs(updated)
    setEditingIdx(null)
  }

  // ── 삭제 ──────────────────────────────────────────────────
  const deleteLog = async (e, idx) => {
    e.stopPropagation()
    if (!window.confirm('이 기록을 삭제할까요?')) return
    const updated = logs.filter((_,i) => i !== idx)
    await saveProgressLog(selected, updated)
    setLogs(updated)
  }

  // ── 반별 보기 엑셀 내보내기 ───────────────────────────────
  const exportClassXlsx = () => {
    const wb = XLSX.utils.book_new()
    const wsData = [
      [{ v:'날짜', s:XLS_S.header }, { v:'내용', s:XLS_S.header }, { v:'상태', s:XLS_S.header }],
      ...logs.map(l => {
        const st = l.status || 'plan'
        return [
          { v: l.date || '', s: XLS_S[st] || {} },
          { v: l.content || '', s: XLS_S[st] || {} },
          { v: STATUS_LABEL[st] || '계획', s: XLS_S[st] || {} },
        ]
      })
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch:12 }, { wch:40 }, { wch:8 }]
    const sheetName = (selected||'진도표').slice(0, 31).replace(/[:\\/\*\?\[\]]/g, '_')
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `키키쌤_진도표_${getToday()}.xlsx`)
  }

  const handleSelectClassFromOverall = (cls) => {
    setSelected(cls)
    setViewMode('class')
  }

  return (
    <div className="page" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      {/* 보기 모드 토글 */}
      <section className="card" style={{padding:'10px 14px'}}>
        <div style={{display:'flex',gap:'6px'}}>
          <button
            className={viewMode === 'class' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            onClick={() => setViewMode('class')}
          >반별 보기</button>
          <button
            className={viewMode === 'overall' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            onClick={() => setViewMode('overall')}
          >전체 현황</button>
        </div>
      </section>

      {/* 전체 현황 뷰 */}
      {viewMode === 'overall' && (
        <section className="card" style={{padding:'14px 14px 16px', overflow:'visible'}}>
          <div className="section-label" style={{marginBottom:'4px'}}>📊 전체 현황</div>
          <OverallView
            classes={classes}
            holidays={holidays}
            onSelectClass={handleSelectClassFromOverall}
          />
        </section>
      )}

      {/* 반별 보기 */}
      {viewMode === 'class' && (
        <>
          {/* 반 선택 */}
          <section className="card">
            <div style={{display:'flex',alignItems:'flex-end',gap:'10px'}}>
              <div style={{flex:1}}>
                <div className="section-label">📊 반 선택</div>
                {classes.length === 0
                  ? <div className="empty">기본 시간표에서 반을 먼저 등록하세요</div>
                  : (
                    <select value={selected} onChange={e => setSelected(e.target.value)}>
                      {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )
                }
              </div>
              {selected && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{marginBottom:'2px'}}
                  onClick={() => setShowAdd(v=>!v)}
                >
                  {showAdd ? '닫기' : '+ 행 추가'}
                </button>
              )}
            </div>

            {showAdd && (
              <div className="add-row-form">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  <div>
                    <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'3px'}}>날짜</label>
                    <input type="date" value={addForm.date} onChange={e=>setAddForm(p=>({...p,date:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'3px'}}>상태</label>
                    <select value={addForm.status} onChange={e=>setAddForm(p=>({...p,status:e.target.value}))}>
                      {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'3px'}}>내용</label>
                  <input
                    value={addForm.content}
                    onChange={e=>setAddForm(p=>({...p,content:e.target.value}))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                    placeholder="수업 내용 (선택) — Enter로 저장"
                    autoFocus
                  />
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn btn-primary btn-sm" onClick={handleAdd}>추가</button>
                  <button className="btn btn-secondary btn-sm" onClick={()=>setShowAdd(false)}>취소</button>
                </div>
              </div>
            )}
          </section>

          {/* 진도 기록 */}
          {selected && (
            <section className="card">
              <div className="section-label">
                📋 {selected} 진도 기록
                <span style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'8px'}}>
                  {logs.length > 0 && (
                    <button className="btn btn-secondary btn-sm" onClick={exportClassXlsx}>📥 엑셀</button>
                  )}
                  <span style={{fontSize:'0.72rem',color:'var(--gray-400)',fontWeight:400}}>
                    {logs.length}건
                  </span>
                </span>
              </div>

              {loading && <div className="empty">불러오는 중...</div>}

              {!loading && logs.length === 0 && (
                <div className="empty">
                  기록이 없어요<br/>
                  <span style={{fontSize:'0.78rem'}}>시간표 탭 → 이번 주 → "진도표에 반영" 해보세요</span>
                </div>
              )}

              {!loading && logs.length > 0 && (
                <>
                  <div className="prog-header" style={{gridTemplateColumns:'76px 1fr 88px 60px'}}>
                    <span>날짜</span><span>내용</span><span>상태</span><span></span>
                  </div>

                  {logs.map((log, i) =>
                    editingIdx === i ? (
                      <div key={i} className="log-row editing" style={{gridTemplateColumns:'1fr'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'6px'}}>
                          <div>
                            <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>날짜</label>
                            <input
                              type="date"
                              value={editDraft.date}
                              onChange={e=>setEditDraft(p=>({...p,date:e.target.value}))}
                              style={{fontSize:'0.85rem'}}
                            />
                          </div>
                          <div>
                            <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>상태</label>
                            <select
                              value={editDraft.status}
                              onChange={e=>setEditDraft(p=>({...p,status:e.target.value}))}
                              style={{fontSize:'0.85rem'}}
                            >
                              {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{marginBottom:'8px'}}>
                          <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>
                            내용 <span style={{color:'var(--pink-400)',fontWeight:400}}>— Enter로 저장</span>
                          </label>
                          <input
                            ref={editContentRef}
                            value={editDraft.content}
                            onChange={e=>setEditDraft(p=>({...p,content:e.target.value}))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(i)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            placeholder="수업 내용"
                            style={{fontSize:'0.85rem'}}
                          />
                        </div>
                        <div style={{display:'flex',gap:'8px'}}>
                          <button className="btn btn-primary btn-sm" onClick={()=>saveEdit(i)}>저장</button>
                          <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="log-row"
                        style={{gridTemplateColumns:'76px 1fr 88px 60px'}}
                        onClick={() => startEdit(i)}
                        title="클릭하여 수정"
                      >
                        <span className="log-date">{formatDate(log.date)}</span>
                        <span style={{fontSize:'0.85rem',wordBreak:'break-all',lineHeight:1.4}}>
                          {log.content || <span style={{color:'var(--gray-300)'}}>-</span>}
                        </span>
                        <StatusBadge status={log.status} />
                        <div style={{display:'flex',gap:'4px',justifyContent:'flex-end'}}>
                          <button
                            className="icon-btn icon-btn-edit"
                            onClick={e => { e.stopPropagation(); startEdit(i) }}
                            title="수정"
                          >✏️</button>
                          <button
                            className="icon-btn icon-btn-delete"
                            onClick={e => deleteLog(e, i)}
                            title="삭제"
                          >✕</button>
                        </div>
                      </div>
                    )
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
