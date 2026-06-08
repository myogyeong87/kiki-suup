import { useState, useEffect } from 'react'
import { getBasicTimetable, getProgressLogs } from '../firebase'
import { uniqueClasses, formatDate } from '../utils'

export default function ProgressTab() {
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getBasicTimetable().then(tt => {
      const list = uniqueClasses(tt)
      setClasses(list)
      if (list.length) setSelected(list[0])
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    getProgressLogs(selected).then(data => {
      setLogs([...data].sort((a,b) => a.date?.localeCompare(b.date)))
      setLoading(false)
    })
  }, [selected])

  return (
    <div className="page" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      <section className="card">
        <div className="section-label">📊 반 선택</div>
        {classes.length === 0
          ? <div className="empty">기본 시간표에서 반을 먼저 등록하세요</div>
          : (
            <select value={selected} onChange={e => setSelected(e.target.value)}>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )
        }
      </section>

      {selected && (
        <section className="card">
          <div className="section-label">📋 {selected} 진도 기록</div>
          {loading && <div className="empty">불러오는 중...</div>}
          {!loading && logs.length === 0 && (
            <div className="empty">아직 수업 완료 기록이 없어요</div>
          )}
          {!loading && logs.length > 0 && (
            <>
              <div style={{
                display:'grid',
                gridTemplateColumns:'90px 1fr 1fr',
                gap:'8px',
                padding:'6px 0',
                borderBottom:'2px solid var(--purple-100)',
                fontSize:'0.75rem',
                fontWeight:700,
                color:'var(--purple-600)'
              }}>
                <span>날짜</span>
                <span>지난 시간</span>
                <span>이번 시간</span>
              </div>
              {logs.map((log, i) => (
                <div key={i} className="log-row">
                  <span className="log-date">{formatDate(log.date)}</span>
                  <span>{log.lastClass || '-'}</span>
                  <span>{log.thisClass || '-'}</span>
                </div>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  )
}
