import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { supabaseConfigError, isSupabaseConfigured } from './lib/supabase-client'
import './index.css'
import './responsive-fixes.css'

// Self-Healing: initialize once on app start + wrap React tree with Error Boundary
import { initSelfHealingSystem } from './lib/self-healing'
import SelfHealingErrorBoundary from './components/SelfHealingErrorBoundary.jsx'
import { EnvConfigurationError } from './lib/env-guard'

const root = ReactDOM.createRoot(document.getElementById('root'))

function SetupErrorFallback({ error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-xl w-full bg-gray-800 text-white rounded-2xl p-6 shadow-2xl border border-red-500/40">
        <h1 className="text-2xl font-bold mb-3 text-red-400">تعذر تشغيل التطبيق</h1>
        <p className="text-sm text-gray-200 leading-7 mb-4">
          يوجد نقص في إعدادات الاتصال الأساسية. تم إيقاف التشغيل لحماية النظام من العمل بإعدادات غير صحيحة.
        </p>
        <p className="text-sm text-gray-200 mb-3">يرجى التواصل مع مسؤول النظام والتأكد من ضبط متغيرات البيئة في Vercel:</p>
        <ul className="list-disc pr-6 text-sm text-gray-300 space-y-1 mb-4">
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-xs text-gray-400 break-words">{error?.message}</p>
      </div>
    </div>
  )
}

function renderApp(AppComponent) {
  root.render(
    <React.StrictMode>
      <SelfHealingErrorBoundary>
        <AppComponent />
      </SelfHealingErrorBoundary>
    </React.StrictMode>,
  )
}

async function bootstrap() {
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

  try {
    const { default: App } = await import('./App.jsx')
    renderApp(App)
  } catch (error) {
    console.error('[Bootstrap] Failed to start application:', error)

    if (error instanceof EnvConfigurationError) {
      renderApp(() => <SetupErrorFallback error={error} />)
      return
    }

    throw error
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
