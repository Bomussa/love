const HANDLER_KEY = '__mmcPatientForegroundSyncInstalled'

function installForegroundSyncBridge() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window[HANDLER_KEY]) return
  window[HANDLER_KEY] = true

  const handle = () => {
    if (document.hidden) return

    window.dispatchEvent(new CustomEvent('mmc:patient-foreground-resync', {
      detail: {
        source: 'foreground-sync'
      }
    }))
  }

  document.addEventListener('visibilitychange', handle, false)
  window.addEventListener('focus', handle, false)
}

installForegroundSyncBridge()

export default null