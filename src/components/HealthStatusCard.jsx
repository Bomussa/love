/**
 * MMC Self-Healing System - Health Status Card
 * Displays health status for a single module
 */

import React from 'react';
import { STATUS } from '../lib/self-healing/constants';

/**
 * Status indicator colors
 */
const statusColors = {
  [STATUS.OK]: {
    bg: '#d1fae5',
    border: '#10b981',
    text: '#065f46',
    icon: '🟢',
  },
  [STATUS.DEGRADED]: {
    bg: '#fef3c7',
    border: '#f59e0b',
    text: '#92400e',
    icon: '🟡',
  },
  [STATUS.FAIL]: {
    bg: '#fee2e2',
    border: '#ef4444',
    text: '#991b1b',
    icon: '🔴',
  },
};

/**
 * Status labels
 */
const statusLabels = {
  ar: {
    [STATUS.OK]: 'يعمل',
    [STATUS.DEGRADED]: 'محدود',
    [STATUS.FAIL]: 'متوقف',
  },
  en: {
    [STATUS.OK]: 'Operational',
    [STATUS.DEGRADED]: 'Degraded',
    [STATUS.FAIL]: 'Down',
  },
};

/**
 * Module names
 */
const moduleNames = {
  ar: {
    frontend: 'الواجهة الأمامية',
    api: 'واجهة البرمجة',
    database: 'قاعدة البيانات',
    realtime: 'التحديث الفوري',
    notifications: 'الإشعارات',
  },
  en: {
    frontend: 'Frontend',
    api: 'API',
    database: 'Database',
    realtime: 'Realtime',
    notifications: 'Notifications',
  },
};

/**
 * Health Status Card Component
 */
export function HealthStatusCard({ 
  module, 
  status, 
  details = {}, 
  language = 'ar',
  onClick,
  lastCheck,
}) {
  const colors = statusColors[status] || statusColors[STATUS.FAIL];
  const labels = statusLabels[language];
  const names = moduleNames[language];
  
  const formatTime = (timestamp) => {
    if (!timestamp) return language === 'ar' ? 'غير معروف' : 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  
  return (
    <div 
      onClick={onClick}
      style={{
        ...styles.card,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={styles.header}>
        <span style={styles.icon}>{colors.icon}</span>
        <span style={{...styles.status, color: colors.text}}>
          {labels[status]}
        </span>
      </div>
      
      <div style={styles.moduleName}>
        {names[module] || module}
      </div>
      
      {details.reason && (
        <div style={{...styles.details, color: colors.text}}>
          {details.reason}
        </div>
      )}
      
      {details.responseTime && (
        <div style={styles.metric}>
          {language === 'ar' ? 'وقت الاستجابة:' : 'Response time:'} {details.responseTime}ms
        </div>
      )}
      
      {details.failures > 0 && (
        <div style={styles.metric}>
          {language === 'ar' ? 'الأخطاء:' : 'Failures:'} {details.failures}
        </div>
      )}
      
      <div style={styles.lastCheck}>
        {language === 'ar' ? 'آخر فحص:' : 'Last check:'} {formatTime(lastCheck)}
      </div>
    </div>
  );
}

const styles = {
  card: {
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid',
    transition: 'all 0.2s ease',
    minWidth: '180px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  icon: {
    fontSize: '20px',
  },
  status: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  moduleName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  details: {
    fontSize: '12px',
    marginBottom: '8px',
    opacity: 0.8,
  },
  metric: {
    fontSize: '11px',
    color: '#6b7280',
    marginBottom: '4px',
  },
  lastCheck: {
    fontSize: '10px',
    color: '#9ca3af',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(0,0,0,0.1)',
  },
};

export default HealthStatusCard;
