import React, { useState, useEffect, useCallback } from 'react';
import healthMonitor from '../lib/app-health-monitor';

// أيقونات SVG مدمجة لتجنب import إضافي
const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const VolumeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

// إعدادات كل مستوى خطورة
const severityConfig = {
  critical: {
    bg: 'rgba(127, 29, 29, 0.97)',
    border: '#ef4444',
    text: '#fee2e2',
    badge: '#dc2626',
    label: 'حرج',
    labelEn: 'Critical',
    icon: '🚨',
    autoRemove: false
  },
  error: {
    bg: 'rgba(124, 45, 18, 0.97)',
    border: '#f97316',
    text: '#ffedd5',
    badge: '#ea580c',
    label: 'خطأ',
    labelEn: 'Error',
    icon: '⚠️',
    autoRemove: 15000
  },
  warning: {
    bg: 'rgba(113, 63, 18, 0.95)',
    border: '#eab308',
    text: '#fef9c3',
    badge: '#ca8a04',
    label: 'تحذير',
    labelEn: 'Warning',
    icon: '⚡',
    autoRemove: 10000
  },
  info: {
    bg: 'rgba(20, 83, 45, 0.95)',
    border: '#22c55e',
    text: '#dcfce7',
    badge: '#16a34a',
    label: 'معلومة',
    labelEn: 'Info',
    icon: '✅',
    autoRemove: 6000
  }
};

const HealthAlertBanner = ({ language = 'ar' }) => {
  const [alerts, setAlerts] = useState([]);
  const [silenced, setSilenced] = useState(false);
  const isAr = language === 'ar';

  const addAlert = useCallback((issue) => {
    setAlerts(prev => {
      // تجنب التكرار - نفس النوع خلال 10 ثوانٍ
      const exists = prev.find(
        a => a.type === issue.type &&
        Date.now() - new Date(a.timestamp).getTime() < 10000
      );
      if (exists) {
        // إذا كانت نفس المشكلة وتم إصلاحها، حدّث الحالة
        if (issue.resolved) {
          return prev.map(a => a.type === issue.type ? { ...a, resolved: true } : a);
        }
        return prev;
      }
      return [issue, ...prev].slice(0, 6);
    });

    // إزالة تلقائية حسب المستوى
    const cfg = severityConfig[issue.severity] || severityConfig.warning;
    if (cfg.autoRemove) {
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== issue.id));
      }, cfg.autoRemove);
    }
  }, []);

  useEffect(() => {
    healthMonitor.onAlert(addAlert);
  }, [addAlert]);

  // الاستماع لأحداث الإصلاح
  useEffect(() => {
    const handleRefresh = () => {
      setAlerts(prev =>
        prev.map(a =>
          a.fixAction === 'trigger_refresh' || a.fixAction === 'sync_data'
            ? { ...a, resolved: true }
            : a
        )
      );
      // إزالة المحلولة بعد 3 ثوانٍ
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => !a.resolved));
      }, 3000);
    };
    window.addEventListener('force_data_refresh', handleRefresh);
    return () => window.removeEventListener('force_data_refresh', handleRefresh);
  }, []);

  const dismiss = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const dismissAll = () => setAlerts([]);

  const handleSilence = () => {
    healthMonitor.silenceFor(10);
    setSilenced(true);
    setTimeout(() => setSilenced(false), 600000);
  };

  const handleManualFix = (alert) => {
    window.dispatchEvent(new CustomEvent('force_data_refresh'));
    dismiss(alert.id);
  };

  if (alerts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: isAr ? '16px' : 'auto',
        right: isAr ? 'auto' : '16px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '340px',
        direction: isAr ? 'rtl' : 'ltr',
        pointerEvents: 'auto'
      }}
    >
      {/* شريط التحكم إذا كان هناك أكثر من تنبيه */}
      {alerts.length > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(17, 24, 39, 0.95)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#9ca3af',
          fontSize: '12px',
          backdropFilter: 'blur(8px)'
        }}>
          <span>
            {alerts.length} {isAr ? 'تنبيهات نشطة' : 'active alerts'}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleSilence}
              title={isAr ? 'كتم الصوت 10 دقائق' : 'Silence 10 min'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: silenced ? '#fbbf24' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
            >
              <VolumeOffIcon />
            </button>
            <button
              onClick={dismissAll}
              title={isAr ? 'إغلاق الكل' : 'Dismiss all'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
            >
              <XIcon />
            </button>
          </div>
        </div>
      )}

      {/* التنبيهات */}
      {alerts.map((alert) => {
        const cfg = severityConfig[alert.severity] || severityConfig.warning;
        return (
          <div
            key={alert.id}
            style={{
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: '12px',
              padding: '12px',
              boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${cfg.border}30`,
              backdropFilter: 'blur(12px)',
              minWidth: '280px',
              animation: 'slideInAlert 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              {/* الأيقونة */}
              <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>
                {cfg.icon}
              </span>

              {/* المحتوى */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* الشارة والعنوان */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: cfg.badge,
                    color: '#fff',
                    fontWeight: 'bold',
                    letterSpacing: '0.5px'
                  }}>
                    {isAr ? cfg.label : cfg.labelEn}
                  </span>
                  {alert.resolved && (
                    <span style={{
                      fontSize: '11px',
                      color: '#4ade80',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <CheckIcon />
                      {isAr ? 'تم الإصلاح' : 'Fixed'}
                    </span>
                  )}
                </div>

                {/* العنوان */}
                <p style={{
                  color: cfg.text,
                  fontWeight: '600',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  margin: 0
                }}>
                  {alert.title}
                </p>

                {/* الرسالة */}
                {alert.message && (
                  <p style={{
                    color: cfg.text,
                    opacity: 0.75,
                    fontSize: '11px',
                    marginTop: '3px',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    margin: '3px 0 0 0'
                  }}>
                    {alert.message}
                  </p>
                )}

                {/* الوقت وزر الإصلاح */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '6px'
                }}>
                  <span style={{ color: cfg.text, opacity: 0.45, fontSize: '10px' }}>
                    {new Date(alert.timestamp).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US')}
                  </span>
                  {!alert.resolved && alert.autoFix && (
                    <button
                      onClick={() => handleManualFix(alert)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        color: cfg.text,
                        opacity: 0.7,
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshIcon />
                      {isAr ? 'إصلاح' : 'Fix'}
                    </button>
                  )}
                </div>
              </div>

              {/* زر الإغلاق */}
              <button
                onClick={() => dismiss(alert.id)}
                style={{
                  flexShrink: 0,
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px',
                  cursor: 'pointer',
                  color: cfg.text,
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <XIcon />
              </button>
            </div>
          </div>
        );
      })}

      {/* CSS للأنيميشن */}
      <style>{`
        @keyframes slideInAlert {
          from {
            opacity: 0;
            transform: translateX(${isAr ? '-20px' : '20px'});
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default HealthAlertBanner;
