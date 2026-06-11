export const DAYS = ['mon','tue','wed','thu','fri']
export const DAY_LABELS = { mon:'월', tue:'화', wed:'수', thu:'목', fri:'금' }
export const PERIODS = [1,2,3,4,5,6,7]

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getToday() {
  return toDateStr(new Date())
}

export function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateStr(d)
}

// 'YYYY-MM-DD' → 'mon'~'fri' | null (로컬 날짜 기준, 주말은 null)
export function getDayKeyFromDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay() // 로컬 파싱으로 timezone 안전
  const map = [null, 'mon', 'tue', 'wed', 'thu', 'fri', null]
  return map[day] ?? null
}

export function getTodayDayKey() {
  return getDayKeyFromDate(getToday())
}

export function getWeekKey(dateStr) {
  let d
  if (dateStr) {
    const [y, m, day] = dateStr.split('-').map(Number)
    d = new Date(y, m - 1, day) // 로컬 파싱
  } else {
    d = new Date()
  }
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d - jan1) / 86400000)
  const dow = (d.getDay() + 6) % 7
  const weekNum = Math.floor((dayOfYear - dow + 10) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2,'0')}`
}

// Returns { mon: 'YYYY-MM-DD', ... } for a given weekKey
export function getWeekDates(weekKey) {
  const [yearStr, weekPart] = weekKey.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekPart)
  const jan4 = new Date(year, 0, 4)
  const dow = (jan4.getDay() + 6) % 7
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - dow + (week - 1) * 7)
  const result = {}
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri']
  for (let i = 0; i < 5; i++) {
    const d = new Date(firstMonday)
    d.setDate(firstMonday.getDate() + i)
    result[dayKeys[i]] = toDateStr(d)
  }
  return result
}

export function daysUntil(dateStr) {
  return daysUntilFrom(dateStr, getToday())
}

export function daysUntilFrom(deadlineDate, fromDate) {
  const [y,  m,  d]  = deadlineDate.split('-').map(Number)
  const [fy, fm, fd] = fromDate.split('-').map(Number)
  const target = new Date(y,  m  - 1, d)
  const from   = new Date(fy, fm - 1, fd)
  return Math.ceil((target - from) / 86400000)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${m}/${d}`
}

export function formatDateKorean(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  return `${y}년 ${m}월 ${d}일 (${dayNames[dt.getDay()]})`
}

// 다음 평일 (토/일 자동 스킵)
export function nextWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  do { dt.setDate(dt.getDate() + 1) } while ([0, 6].includes(dt.getDay()))
  return toDateStr(dt)
}

// 이전 평일 (토/일 자동 스킵)
export function prevWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  do { dt.setDate(dt.getDate() - 1) } while ([0, 6].includes(dt.getDay()))
  return toDateStr(dt)
}

// 다음 평일+임의휴일 스킵
export function nextWorkday(dateStr, holidays = []) {
  const hset = new Set(holidays.map(h => h.date))
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  do {
    dt.setDate(dt.getDate() + 1)
  } while ([0, 6].includes(dt.getDay()) || hset.has(toDateStr(dt)))
  return toDateStr(dt)
}

// 이전 평일+임의휴일 스킵
export function prevWorkday(dateStr, holidays = []) {
  const hset = new Set(holidays.map(h => h.date))
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  do {
    dt.setDate(dt.getDate() - 1)
  } while ([0, 6].includes(dt.getDay()) || hset.has(toDateStr(dt)))
  return toDateStr(dt)
}

export function uniqueClasses(timetable) {
  const set = new Set()
  Object.values(timetable).forEach(dayObj => {
    if (typeof dayObj === 'object') {
      Object.values(dayObj).forEach(v => { if (v && v.trim()) set.add(v.trim()) })
    }
  })
  return [...set].sort()
}
