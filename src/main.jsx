import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './responsive-fixes.css'

// Self-Healing: initialize once on app start + wrap React tree with Error Boundary
import { initSelfHealingSystem } from './lib/self-healing'
import SelfHealingErrorBoundary from './components/SelfHealingErrorBoundary.jsx'

try {
  initSelfHealingSystem()
} catch (e) {
  // Never block boot; log only
  console.error('[SelfHealing] initSelfHealingSystem failed:', e)
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
