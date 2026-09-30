import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { getToday, getActiveSemester } from './utils'

const firebaseConfig = {
  apiKey: "AIzaSyBHO5R_uvHC0M13673Ei7WqcWA79IVO6O4",
  authDomain: "kiki-suup.firebaseapp.com",
  projectId: "kiki-suup",
  storageBucket: "kiki-suup.firebasestorage.app",
  messagingSenderId: "506576686429",
  appId: "1:506576686429:web:d2f09460ed0a107cc2acb4"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// --- 로그인 (본인 계정만 자료 접근, Firestore 규칙과 동일한 이메일) ---
export const auth = getAuth(app)
export const ALLOWED_EMAIL = 'myogyeong87@gmail.com'

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    // 팝업이 막힌 환경(일부 홈 화면 앱)에서는 페이지 이동 방식으로 재시도
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
    } else {
      throw e
    }
  }
}
export const signOutUser = () => signOut(auth)

export const SYNC_ID = 'kikisaem'

// --- semesters (학기별 기본 시간표) ---
export async function getSemesters() {
  const snap = await getDoc(doc(db, 'semesters', SYNC_ID))
  if (snap.exists()) return snap.data().items || []

  // 마이그레이션: 기존 단일 basicTimetable → 첫 학기로 변환
  const oldSnap = await getDoc(doc(db, 'basicTimetable', SYNC_ID))
  if (oldSnap.exists() && Object.keys(oldSnap.data()).length) {
    const migrated = [{ id: 'migrated-default', name: '기존 시간표', startDate: '2000-01-01', timetable: oldSnap.data() }]
    await setDoc(doc(db, 'semesters', SYNC_ID), { items: migrated })
    return migrated
  }
  return []
}
export async function saveSemesters(items) {
  await setDoc(doc(db, 'semesters', SYNC_ID), { items })
}

// 날짜(기본: 오늘) 기준 자동 적용되는 학기의 시간표 그리드
export async function getBasicTimetable(dateStr = getToday()) {
  const semesters = await getSemesters()
  const active = getActiveSemester(semesters, dateStr)
  return active?.timetable || {}
}

// 날짜(기본: 오늘) 기준 자동 적용되는 학기 id (진도표 저장 키 스코핑용)
export async function getActiveSemesterId(dateStr = getToday()) {
  const semesters = await getSemesters()
  const active = getActiveSemester(semesters, dateStr)
  return active?.id || 'default'
}

// --- weeklyTimetable ---
export async function getWeeklyTimetable(weekKey) {
  const snap = await getDoc(doc(db, 'weeklyTimetable', `${SYNC_ID}_${weekKey}`))
  return snap.exists() ? snap.data() : {}
}
export async function saveWeeklyTimetable(weekKey, data) {
  await setDoc(doc(db, 'weeklyTimetable', `${SYNC_ID}_${weekKey}`), data)
}

// --- progressLogs (학기별 스코핑) ---
export async function getProgressLogs(className, semesterId = 'default') {
  const key = `${SYNC_ID}_${semesterId}_${className}`
  const snap = await getDoc(doc(db, 'progressLogs', key))
  if (snap.exists()) return snap.data().logs || []

  // 마이그레이션: 기존 학기(migrated-default)는 예전 unscoped 키로 폴백 조회
  if (semesterId === 'migrated-default') {
    const legacyKey = `${SYNC_ID}_${className}`
    const legacySnap = await getDoc(doc(db, 'progressLogs', legacyKey))
    if (legacySnap.exists()) return legacySnap.data().logs || []
  }
  return []
}

// Firestore는 undefined 값을 허용하지 않으므로 저장 전 모든 항목을 정제한다.
function sanitizeLogs(logs) {
  return (logs || []).map((entry, i) => {
    // undefined 제거: JSON 왕복으로 undefined 키 제거
    const base = JSON.parse(JSON.stringify(entry || {}))
    // 필수 필드 보완
    if (!base.id)     base.id     = `auto-${Date.now()}-${i}`
    if (!base.date)   base.date   = ''
    if (!base.status) base.status = 'plan'
    if (base.content      === undefined) base.content      = ''
    if (base.lastClassNote === undefined) base.lastClassNote = ''
    return base
  })
}

export async function saveProgressLog(className, logs, semesterId = 'default') {
  const key = `${SYNC_ID}_${semesterId}_${className}`
  const sanitized = sanitizeLogs(logs)
  console.log('[saveProgressLog] key:', key)
  console.log('[saveProgressLog] data:', JSON.stringify(sanitized))
  await setDoc(doc(db, 'progressLogs', key), { logs: sanitized })
  console.log('[saveProgressLog] success ✓')
}

// --- schedules ---
export async function getSchedules() {
  const snap = await getDoc(doc(db, 'schedules', SYNC_ID))
  return snap.exists() ? (snap.data().items || []) : []
}
export async function saveSchedules(items) {
  await setDoc(doc(db, 'schedules', SYNC_ID), { items })
}

// --- todos (할 일, 기존 deadlines 대체) ---
export async function getTodos() {
  const snap = await getDoc(doc(db, 'todos', SYNC_ID))
  if (snap.exists()) return snap.data().items || []

  // 마이그레이션: 기존 deadlines → todos (title→content, date→dueDate)
  const oldSnap = await getDoc(doc(db, 'deadlines', SYNC_ID))
  if (oldSnap.exists() && (oldSnap.data().items || []).length) {
    const migrated = oldSnap.data().items.map(d => ({
      id: d.id, content: d.title, dueDate: d.date, done: !!d.done,
    }))
    await setDoc(doc(db, 'todos', SYNC_ID), { items: migrated })
    return migrated
  }
  return []
}
export async function saveTodos(items) {
  await setDoc(doc(db, 'todos', SYNC_ID), { items })
}

// --- homeroom ---
export async function getHomeroom(dateKey) {
  const snap = await getDoc(doc(db, 'homeroom', `${SYNC_ID}_${dateKey}`))
  return snap.exists() ? snap.data() : { morning: '', afternoon: '' }
}
export async function saveHomeroom(dateKey, data) {
  await setDoc(doc(db, 'homeroom', `${SYNC_ID}_${dateKey}`), data)
}

// --- custom holidays ---
export async function getCustomHolidays() {
  const snap = await getDoc(doc(db, 'holidays', SYNC_ID))
  return snap.exists() ? (snap.data().items || []) : []
}
export async function saveCustomHolidays(items) {
  await setDoc(doc(db, 'holidays', SYNC_ID), { items })
}

// --- consultations ---
export async function getConsultations() {
  const snap = await getDoc(doc(db, 'consultations', SYNC_ID))
  return snap.exists() ? (snap.data().items || []) : []
}
export async function saveConsultations(items) {
  await setDoc(doc(db, 'consultations', SYNC_ID), { items })
}

// --- vacations (방학 기간) ---
export async function getVacations() {
  const snap = await getDoc(doc(db, 'vacations', SYNC_ID))
  return snap.exists() ? (snap.data().items || []) : []
}
export async function saveVacations(items) {
  await setDoc(doc(db, 'vacations', SYNC_ID), { items })
}

// --- 전체 백업 ---
const BACKUP_COLLECTIONS = [
  'semesters', 'weeklyTimetable', 'progressLogs', 'homeroom',
  'schedules', 'todos', 'consultations', 'holidays', 'vacations',
  'basicTimetable', 'deadlines', // 예전 형식 (마이그레이션 전 원본)
]

// { exportedAt, collections: { 컬렉션명: { 문서id: 데이터 } } }
export async function exportAllData() {
  const collections = {}
  for (const name of BACKUP_COLLECTIONS) {
    const snap = await getDocs(collection(db, name))
    const docs = {}
    snap.forEach(d => {
      if (d.id === SYNC_ID || d.id.startsWith(`${SYNC_ID}_`)) docs[d.id] = d.data()
    })
    collections[name] = docs
  }
  return { app: 'kiki-suup', version: 1, exportedAt: new Date().toISOString(), collections }
}
