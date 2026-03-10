import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './responsive-fixes.css'

// Initialize the root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Failed to find the root element');
} else {
  const root = ReactDOM.createRoot(rootElement);

  const renderApp = (Component) => {
    root.render(
      <React.StrictMode>
        <Component />
      </React.StrictMode>
    );
  };

  // Immediate bootstrap for better reliability
  try {
    renderApp(App);
    console.log('[Main] Application rendered successfully');
  } catch (error) {
    console.error('[Main] Critical error during initial render:', error);
    
    // Fallback UI in case of total failure
    root.render(
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#0f172a', 
        color: 'white',
        fontFamily: 'Cairo, sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h1 style={{ color: '#f87171' }}>حدث خطأ في تحميل التطبيق</h1>
          <p>يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.</p>
          <pre style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px' }}>{error.message}</pre>
        </div>
      </div>
    );
  }
}
