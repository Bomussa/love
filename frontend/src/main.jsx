import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { supabaseConfigError, isSupabaseConfigured } from './lib/supabase-client'
import './index.css'
import './responsive-fixes.css'

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
}

const ConfigErrorScreen = ({ errorMessage }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900 px-6">
    <div className="max-w-2xl w-full bg-red-950/60 border border-red-500 rounded-2xl p-6 text-red-50">
      <h1 className="text-2xl font-bold mb-3">تعذّر تشغيل التطبيق</h1>
      <p className="mb-4 leading-7">
        إعدادات Supabase غير مكتملة. يرجى إضافة متغيرات البيئة المطلوبة في Vercel قبل إعادة النشر.
      </p>
      <div className="bg-black/40 rounded-lg p-4 text-sm overflow-x-auto">
        <code>{errorMessage}</code>
      </div>
    </div>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSupabaseConfigured ? (
      <SelfHealingErrorBoundary>
        <App />
      </SelfHealingErrorBoundary>
    ) : (
      <ConfigErrorScreen errorMessage={supabaseConfigError} />
    )}
  </React.StrictMode>,
)
// Force rebuild 1760995246
// Trigger rebuild Sat Jan 17 02:33:28 EST 2026
