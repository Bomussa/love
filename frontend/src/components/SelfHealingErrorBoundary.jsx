/**
 * SelfHealingErrorBoundary Component
 * نظام المعالجة الذاتية للخطأ - يحمي التطبيق من الانهيار الكامل
 * @module SelfHealingErrorBoundary
 */

import React, { Component } from 'react'

/**
 * Error Boundary Component - يلتقط الأخطاء في React tree
 * @class SelfHealingErrorBoundary
 * @extends Component
 */
class SelfHealingErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // تحديث الحالة لعرض UI الاحتياطي
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // تسجيل الخطأ للمراجعة
    console.error('🔴 Error Boundary caught:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleRetry = () => {
    // محاولة استعادة التطبيق
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // UI الاحتياطي عند حدوث خطأ
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: '#fff',
          fontFamily: 'Cairo, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px'
          }}>
            ⚠️
          </div>
          <h1 style={{
            fontSize: '24px',
            marginBottom: '10px',
            color: '#C9A54C'
          }}>
            عذراً! حدث خطأ غير متوقع
          </h1>
          <p style={{
            color: '#888',
            marginBottom: '30px',
            maxWidth: '500px'
          }}>
            نحن نعمل على إصلاح هذا الخطأ. يرجى المحاولة مرة أخرى.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              background: '#8A1538',
              color: '#fff',
              border: 'none',
              padding: '12px 30px',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
          >
            🔄 إعادة المحاولة
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default SelfHealingErrorBoundary