import React from 'react';

class SelfHealingErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('[SelfHealing] Error caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'white', background: '#1a1a2e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>
            <h2>حدث خطأ غير متوقع</h2>
            <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '10px 20px', background: '#8A1538', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              إعادة التحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default SelfHealingErrorBoundary;
