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
  handleRecover = () => {
    this.setState({ hasError: false });
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mmc:self-heal-recover', { detail: { source: 'error-boundary' } }));
      } catch {
        // noop
      }
    }
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'white', background: '#1a1a2e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>
            <h2>حدث خطأ غير متوقع</h2>
            <button onClick={this.handleRecover} style={{ marginTop: '10px', padding: '10px 20px', background: '#8A1538', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default SelfHealingErrorBoundary;