import api from './api-unified'

const HANDLER_KEY = '__mmcPatientForegroundSyncInstalled'
const QUEUE_CACHE_PREFIX = 'mmc_patient_queue_cache:'
const ROUTE_CACHE_PREFIX = 'mmc_patient_route_cache:'

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function extractQueueTargets() {
  if (typeof localStorage === 'undefined') return []
  const targets = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(QUEUE_CACHE_PREFIX)) continue
    const payload = safeParse(localStorage.getItem(key))
    const [, clinicId, patientId] = key.split(':')
    if (clinicId && patientId && payload?.display_number != null) {
      targets.push({ clinicId, patientId })
    }
  }
  return targets
}

function extractRouteTargets() {
  if (typeof localStorage === 'undefined') return []
  const targets = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(ROUTE_CACHE_PREFIX)) continue
    const [, patientId] = key.split(':')
    if (patientId) targets.push(patientId)
  }
  return targets
}

async function refreshPatientJourneyCaches() {
  if (typeof window === 'undefined') return

  const queueTargets = extractQueueTargets()
  const routeTargets = extractRouteTargets()

  for (const target of queueTargets) {
    try {
      await api.getQueuePosition(target.clinicId, target.patientId)
    } catch {}
  }

  for (const patientId of routeTargets) {
    try {
      await api.getRoute(patientId)
    } catch {}
  }
}

function installForegroundSyncBridge() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window[HANDLER_KEY]) return
  window[HANDLER_KEY] = true

  const handle = () => {
    if (document.hidden) return
    void refreshPatientJourneyCaches()
  }

  document.addEventListener('visibilitychange', handle, false)
  window.addEventListener('focus', handle, false)
}

installForegroundSyncBridge()

export default null
