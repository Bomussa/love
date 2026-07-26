import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './responsive-fixes.css'
import './theme-overrides.css'
import './lib/login-error-relay.js'
import './lib/patient-experience-relay.js'
import './lib/patient-foreground-sync.js'

// Self-Healing: initialize once on app start + wrap React tree with Error Boundary
import { initSelfHealingSystem } from './lib/self-healing'
import SelfHealingErrorBoundary from './components/SelfHealingErrorBoundary.jsx'

const CLIENT_RECOVERY_KEY = 'mmc_client_asset_recovery'

async function recoverClientAssets(reason) {
  if (typeof window === 'undefined') return
  if (sessionStorage.getItem(CLIENT_RECOVERY_KEY) === '1') {
    console.error('[Bootstrap] Client recovery already attempted:', reason)
    return
  }

  sessionStorage.setItem(CLIENT_RECOVERY_KEY, '1')
  console.warn('[Bootstrap] Recovering stale client assets:', reason)

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    }
  } catch (error) {
    console.error('[Bootstrap] Failed to clear stale client assets:', error)
  }

  const recoveryUrl = new URL(window.location.href)
  recoveryUrl.searchParams.set('_mmc_recovery', Date.now().toString())
  window.location.replace(recoveryUrl.toString())
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    recoverClientAssets('vite-preload-error')
  })

  window.addEventListener('error', (event) => {
    const message = String(event?.message || '')
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) {
      recoverClientAssets('dynamic-import-error')
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const message = String(event?.reason?.message || event?.reason || '')
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) {
      event.preventDefault()
      recoverClientAssets('dynamic-import-rejection')
    }
  })

  // Defer non-critical initialization to improve TTI.
  const init = () => {
    try {
      initSelfHealingSystem()
    } catch (error) {
      console.error('[SelfHealing] initSelfHealingSystem failed:', error)
    }
  }

  if (window.requestIdleCallback) {
    window.requestIdleCallback(init)
  } else {
    setTimeout(init, 2000)
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        })
        await registration.update()
      } catch (error) {
        console.error('[SW] registration failed:', error)
      }
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SelfHealingErrorBoundary>
      <App />
    </SelfHealingErrorBoundary>
  </React.StrictMode>,
)
