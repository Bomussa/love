import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/system-settings-shim'
import App from './App.jsx'
import './index.css'
import './responsive-fixes.css'
import './theme-overrides.css'

// Self-Healing: initialize once on app start + wrap React tree with Error Boundary
import { initSelfHealingSystem } from './lib/self-healing'
import SelfHealingErrorBoundary from './components/SelfHealingErrorBoundary.jsx'

// Defer non-critical initialization to improve TTI
if (typeof window !== 'undefined') {
  const init = () => {
    try {
      initSelfHealingSystem()
    } catch (e) {
      console.error('[SelfHealing] initSelfHealingSystem failed:', e)
    }
  }
  
  if (window.requestIdleCallback) {
    window.requestIdleCallback(init)
  } else {
    setTimeout(init, 2000)
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('[SW] registration failed:', error)
      })
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
// Force rebuild 1760995246
// Trigger rebuild Sat Jan 17 02:33:28 EST 2026
