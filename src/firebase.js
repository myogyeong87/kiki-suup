import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore'

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

export const SYNC_ID = 'kikisaem'

// --- basicTimetable ---
export async function getBasicTimetable() {
  const snap = await getDoc(doc(db, 'basicTimetable', SYNC_ID))
  return snap.exists() ? snap.data() : {}
}
export async function saveBasicTimetable(data) {
  await setDoc(doc(db, 'basicTimetable', SYNC_ID), data)
}

// --- weeklyTimetable ---
export async function getWeeklyTimetable(weekKey) {
  const snap = await getDoc(doc(db, 'weeklyTimetable', `${SYNC_ID}_${weekKey}`))
  return snap.exists() ? snap.data() : {}
}
export async function saveWeeklyTimetable(weekKey, data) {
  await setDoc(doc(db, 'weeklyTimetable', `${SYNC_ID}_${weekKey}`), data)
}

// --- progressLogs ---
export async function getProgressLogs(className) {
  const key = `${SYNC_ID}_${className}`
  const snap = await getDoc(doc(db, 'progressLogs', key))
  return snap.exists() ? (snap.data().logs || []) : []
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

export async function saveProgressLog(className, logs) {
  const key = `${SYNC_ID}_${className}`
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

// --- deadlines ---
export async function getDeadlines() {
  const snap = await getDoc(doc(db, 'deadlines', SYNC_ID))
  return snap.exists() ? (snap.data().items || []) : []
}
export async function saveDeadlines(items) {
  await setDoc(doc(db, 'deadlines', SYNC_ID), { items })
}

// --- homeroom ---
export async function getHomeroom(dateKey) {
  const snap = await getDoc(doc(db, 'homeroom', `${SYNC_ID}_${dateKey}`))
  return snap.exists() ? snap.data() : { morning: '', afternoon: '' }
}
export async function saveHomeroom(dateKey, data) {
  await setDoc(doc(db, 'homeroom', `${SYNC_ID}_${dateKey}`), data)
}
