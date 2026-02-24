/**
 * MMC Self-Healing System - Error Boundary
 * Catches React errors and renders Safe Screen
 */

import React from 'react';
import { logRepair, generateCorrelationId } from '../lib/self-healing/RepairLog';
import { softReloadOnce, hardRefresh } from '../lib/self-healing/RecoveryPlaybooks';
import { SEVERITY, ERROR_SIGNATURES, I18N_KEYS, DEFAULT_TRANSLATIONS } from '../lib/self-healing/constants';

/**
 * Track recent errors globally
 */
if (typeof window !== 'undefined') {
  window.__MMC_RECENT_ERRORS__ = window.__MMC_RECENT_ERRORS__ || [];
}

/**
 * Safe Screen Component
 * Displayed when error boundary catches an error
 */
export function SafeScreen({ error, errorInfo, onRetry, onReload, correlationId, language = 'ar' }) {
  const t = DEFAULT_TRANSLATIONS[language] || DEFAULT_TRANSLATIONS.ar;
  
  return (
    <div className="mmc-safe-screen" style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🏥</div>
        <h1 style={styles.title}>
          {language === 'ar' ? 'عذراً، حدث خطأ ما' : 'Sorry, something went wrong'}
        </h1>
        <p style={styles.message}>
          {language === 'ar' 
            ? 'نحن نعمل على إصلاح المشكلة. يمكنك المحاولة مرة أخرى أو تحديث الصفحة.'
            : 'We are working on fixing the issue. You can try again or refresh the page.'}
        </p>
        
        <div style={styles.buttons}>
          <button 
            onClick={onRetry}
            style={{...styles.button, ...styles.primaryButton}}
          >
            {language === 'ar' ? 'محاولة مرة أخرى' : 'Try Again'}
          </button>
          <button 
            onClick={onReload}
            style={{...styles.button, ...styles.secondaryButton}}
          >
            {language === 'ar' ? 'تحديث الصفحة' : 'Refresh Page'}
          </button>
        </div>
        
        <div style={styles.footer}>
          <p style={styles.contact}>
            {t[I18N_KEYS.CONTACT_ADMIN]}
          </p>
          {correlationId && (
            <p style={styles.correlationId}>
              ID: {correlationId}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Styles for Safe Screen
const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 99999,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px',
    margin: '0 0 12px 0',
  },
  message: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '32px',
    lineHeight: '1.5',
    margin: '0 0 32px 0',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
    minWidth: '140px',
  },
  primaryButton: {
    background: '#0d9488',
    color: 'white',
  },
  secondaryButton: {
    background: '#f3f4f6',
    color: '#374151',
  },
  footer: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '20px',
  },
  contact: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 8px 0',
  },
  correlationId: {
    fontSize: '12px',
    color: '#9ca3af',
    fontFamily: 'monospace',
    margin: 0,
  },
};

/**
 * Error Boundary Component
 */
export class SelfHealingErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: null,
      recoveryAttempted: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const correlationId = generateCorrelationId();
    
    // Track error globally
    if (typeof window !== 'undefined') {
      window.__MMC_RECENT_ERRORS__.push({
        timestamp: Date.now(),
        error: error.message,
        correlationId,
      });
      
      // Keep only recent errors
      const oneMinuteAgo = Date.now() - 60000;
      window.__MMC_RECENT_ERRORS__ = window.__MMC_RECENT_ERRORS__.filter(
        e => e.timestamp > oneMinuteAgo
      );
    }
    
    // Log the error
    logRepair({
      action: 'errorBoundaryCatch',
      module: this.props.moduleName || 'unknown',
      severity: SEVERITY.ERROR,
      errorSignature: ERROR_SIGNATURES.REACT_ERROR,
      correlationId,
      error,
      details: {
        componentStack: errorInfo.componentStack,
        moduleName: this.props.moduleName,
      },
    });
    
    this.setState({
      errorInfo,
      correlationId,
    });
    
    // Auto-attempt recovery if enabled
    if (this.props.autoRecover !== false && !this.state.recoveryAttempted) {
      this.attemptRecovery();
    }
  }

  attemptRecovery = async () => {
    this.setState({ recoveryAttempted: true });
    
    const moduleName = this.props.moduleName || 'app';
    
    // Try soft reload first
    const result = await softReloadOnce(moduleName);
    
    if (result.success) {
      // Soft reload succeeded, reset error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
      
      logRepair({
        action: 'autoRecoverySuccess',
        module: moduleName,
        severity: SEVERITY.INFO,
        result: 'success',
        correlationId: this.state.correlationId,
        details: { method: 'softReload' },
      });
    } else {
      // Soft reload failed, will show Safe Screen
      logRepair({
        action: 'autoRecoveryFailed',
        module: moduleName,
        severity: SEVERITY.WARNING,
        result: 'failed',
        correlationId: this.state.correlationId,
        details: { reason: result.reason },
      });
    }
  };

  handleRetry = () => {
    const moduleName = this.props.moduleName || 'app';
    
    logRepair({
      action: 'manualRetry',
      module: moduleName,
      severity: SEVERITY.INFO,
      correlationId: this.state.correlationId,
    });
    
    this.attemptRecovery();
  };

  handleReload = () => {
    logRepair({
      action: 'manualReload',
      module: this.props.moduleName || 'app',
      severity: SEVERITY.INFO,
      correlationId: this.state.correlationId,
    });
    
    hardRefresh();
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          correlationId={this.state.correlationId}
          language={this.props.language}
        />
      );
    }

    return this.props.children;
  }
}

export default SelfHealingErrorBoundary;
