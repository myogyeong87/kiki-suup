export const DAYS = ['mon','tue','wed','thu','fri']
export const DAY_LABELS = { mon:'월', tue:'화', wed:'수', thu:'목', fri:'금' }
export const PERIODS = [1,2,3,4,5,6,7]

export function getToday() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${yyyy}-${mm}-${dd}`
}

export function getTodayDayKey() {
  const day = new Date().getDay() // 0=Sun
  const map = [null,'mon','tue','wed','thu','fri',null]
  return map[day] ?? null
}

export function getWeekKey(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d - jan1) / 86400000)
  const dow = (d.getDay() + 6) % 7 // Mon=0
  const weekNum = Math.floor((dayOfYear - dow + 10) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2,'0')}`
}

export function daysUntil(dateStr) {
  const today = new Date(getToday())
  const target = new Date(dateStr)
  return Math.ceil((target - today) / 86400000)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y,m,d] = dateStr.split('-')
  return `${m}/${d}`
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
