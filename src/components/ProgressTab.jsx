import { useState, useEffect } from 'react'
import { getBasicTimetable, getProgressLogs, saveProgressLog } from '../firebase'
import { uniqueClasses, formatDate } from '../utils'

export default function ProgressTab() {
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editDraft, setEditDraft] = useState({ lastClass: '', thisClass: '' })

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
    setEditingIdx(null)
    getProgressLogs(selected).then(data => {
      setLogs([...data].sort((a,b) => (a.date||'').localeCompare(b.date||'')))
      setLoading(false)
    })
  }, [selected])

  const startEdit = (idx) => {
    setEditDraft({ lastClass: logs[idx].lastClass || '', thisClass: logs[idx].thisClass || '' })
    setEditingIdx(idx)
  }

  const cancelEdit = () => setEditingIdx(null)

  const saveEdit = async (idx) => {
    const updated = logs.map((l, i) => i === idx ? { ...l, ...editDraft } : l)
    await saveProgressLog(selected, updated)
    setLogs(updated)
    setEditingIdx(null)
  }

  const deleteLog = async (idx) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return
    const updated = logs.filter((_, i) => i !== idx)
    await saveProgressLog(selected, updated)
    setLogs(updated)
  }

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
                gridTemplateColumns:'80px 1fr 1fr 56px',
                gap:'6px',
                padding:'6px 0',
                borderBottom:'2px solid var(--purple-100)',
                fontSize:'0.75rem',
                fontWeight:700,
                color:'var(--purple-600)'
              }}>
                <span>날짜</span>
                <span>지난 시간</span>
                <span>이번 시간</span>
                <span></span>
              </div>
              {logs.map((log, i) => (
                editingIdx === i ? (
                  <div key={i} className="log-row editing" style={{gridTemplateColumns:'1fr'}}>
                    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                      <div style={{fontSize:'0.75rem',color:'var(--purple-600)',fontWeight:700}}>{formatDate(log.date)}</div>
                      <div>
                        <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>지난 시간</label>
                        <input
                          value={editDraft.lastClass}
                          onChange={e => setEditDraft(p=>({...p,lastClass:e.target.value}))}
                          style={{fontSize:'0.85rem'}}
                        />
                      </div>
                      <div>
                        <label style={{fontSize:'0.7rem',color:'var(--gray-500)',display:'block',marginBottom:'2px'}}>이번 시간</label>
                        <input
                          value={editDraft.thisClass}
                          onChange={e => setEditDraft(p=>({...p,thisClass:e.target.value}))}
                          style={{fontSize:'0.85rem'}}
                          autoFocus
                        />
                      </div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(i)}>저장</button>
                        <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>취소</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="log-row" style={{gridTemplateColumns:'80px 1fr 1fr 56px'}}>
                    <span className="log-date">{formatDate(log.date)}</span>
                    <span style={{fontSize:'0.85rem'}}>{log.lastClass || '-'}</span>
                    <span style={{fontSize:'0.85rem'}}>{log.thisClass || '-'}</span>
                    <div style={{display:'flex',gap:'4px',justifyContent:'flex-end'}}>
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{width:'26px',height:'26px',fontSize:'0.8rem',borderRadius:'6px'}}
                        onClick={() => startEdit(i)}
                        title="수정"
                      >✏️</button>
                      <button
                        className="btn btn-danger btn-icon"
                        style={{width:'26px',height:'26px',fontSize:'0.8rem',borderRadius:'6px'}}
                        onClick={() => deleteLog(i)}
                        title="삭제"
                      >✕</button>
                    </div>
                  </div>
                )
              ))}
            </>
          )}
        </section>
      )}
    </div>
  )
}
