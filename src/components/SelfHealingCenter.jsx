/**
 * MMC Self-Healing System - Self-Healing Center
 * Admin panel for managing self-healing system
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { HealthStatusCard } from './HealthStatusCard';
import {
  getHealthState,
  getOverallStatus,
  subscribeToHealthChanges,
  forceHealthCheck,
} from '../lib/self-healing/HealthMonitor';
import {
  isSafeModeEnabled,
  enableSafeMode,
  disableSafeMode,
  getSafeModeStatus,
} from '../lib/self-healing/SafeModeManager';
import {
  isReadOnlyMode,
  softReloadOnce,
  resetRealtimeSubscribe,
  safeCacheClear,
  notificationDedupRepair,
  i18nCacheRepair,
  enterReadOnlyMode,
  exitReadOnlyMode,
} from '../lib/self-healing/RecoveryPlaybooks';
import {
  getLocalRepairLogs,
  getFilteredLogs,
  downloadLogs,
  getRepairStatistics,
  clearLocalRepairLogs,
} from '../lib/self-healing/RepairLog';
import { STATUS, SEVERITY } from '../lib/self-healing/constants';
import {
  Activity,
  Shield,
  RefreshCw,
  Download,
  Trash2,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Search,
} from 'lucide-react';

/**
 * Self-Healing Center Component
 */
export function SelfHealingCenter({ language = 'ar' }) {
  // Health state
  const [healthState, setHealthState] = useState(getHealthState());
  const [overallStatus, setOverallStatus] = useState(getOverallStatus());
  
  // Safe mode state
  const [safeMode, setSafeMode] = useState(isSafeModeEnabled());
  const [safeModeStatus, setSafeModeStatus] = useState(getSafeModeStatus());
  
  // Read-only mode
  const [readOnlyMode, setReadOnlyMode] = useState(isReadOnlyMode());
  
  // Logs
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const [logSeverity, setLogSeverity] = useState('');
  
  // Stats
  const [stats, setStats] = useState(null);
  
  // Loading states
  const [runningPlaybook, setRunningPlaybook] = useState(null);
  
  // Subscribe to health changes
  useEffect(() => {
    const unsubscribe = subscribeToHealthChanges((state, overall) => {
      setHealthState(state);
      setOverallStatus(overall);
    });
    
    return unsubscribe;
  }, []);
  
  // Load logs and stats
  useEffect(() => {
    loadLogs();
    setStats(getRepairStatistics());
    
    // Check read-only mode periodically
    const interval = setInterval(() => {
      setReadOnlyMode(isReadOnlyMode());
      setSafeMode(isSafeModeEnabled());
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  const loadLogs = () => {
    const filters = {};
    if (logSeverity) filters.severity = logSeverity;
    if (logFilter) filters.search = logFilter;
    
    setLogs(getFilteredLogs(filters));
  };
  
  // Force health check
  const handleForceCheck = async () => {
    await forceHealthCheck();
  };
  
  // Toggle safe mode
  const handleToggleSafeMode = () => {
    if (safeMode) {
      disableSafeMode();
      setSafeMode(false);
    } else {
      enableSafeMode();
      setSafeMode(true);
    }
    setSafeModeStatus(getSafeModeStatus());
  };
  
  // Toggle read-only mode
  const handleToggleReadOnly = () => {
    if (readOnlyMode) {
      exitReadOnlyMode();
      setReadOnlyMode(false);
    } else {
      enterReadOnlyMode('MANUAL_TRIGGER');
      setReadOnlyMode(true);
    }
  };
  
  // Run playbook
  const runPlaybook = async (playbookName, fn, params = {}) => {
    setRunningPlaybook(playbookName);
    try {
      const result = await fn(params);
      loadLogs();
      setStats(getRepairStatistics());
      return result;
    } finally {
      setRunningPlaybook(null);
    }
  };
  
  // Export logs
  const handleExportLogs = (format) => {
    downloadLogs(format, logs);
  };
  
  // Clear logs
  const handleClearLogs = () => {
    if (window.confirm(language === 'ar' 
      ? 'هل أنت متأكد من حذف جميع السجلات؟'
      : 'Are you sure you want to clear all logs?')) {
      clearLocalRepairLogs();
      loadLogs();
      setStats(getRepairStatistics());
    }
  };
  
  // Translations
  const t = {
    ar: {
      title: 'مركز الإصلاح الذاتي',
      subtitle: 'Self-Healing Center',
      healthStatus: 'حالة النظام',
      overallStatus: 'الحالة العامة',
      safeMode: 'وضع الأمان',
      readOnlyMode: 'وضع القراءة فقط',
      autoRepair: 'الإصلاح التلقائي',
      playbooks: 'أدوات الإصلاح',
      logs: 'سجلات الإصلاح',
      stats: 'الإحصائيات',
      enabled: 'مفعل',
      disabled: 'معطل',
      run: 'تشغيل',
      export: 'تصدير',
      clear: 'مسح',
      filter: 'تصفية',
      search: 'بحث',
      noLogs: 'لا توجد سجلات',
      successRate: 'نسبة النجاح',
      totalActions: 'إجمالي الإجراءات',
    },
    en: {
      title: 'Self-Healing Center',
      subtitle: 'System Recovery & Health Monitoring',
      healthStatus: 'Health Status',
      overallStatus: 'Overall Status',
      safeMode: 'Safe Mode',
      readOnlyMode: 'Read-Only Mode',
      autoRepair: 'Auto-Repair',
      playbooks: 'Recovery Tools',
      logs: 'Repair Logs',
      stats: 'Statistics',
      enabled: 'Enabled',
      disabled: 'Disabled',
      run: 'Run',
      export: 'Export',
      clear: 'Clear',
      filter: 'Filter',
      search: 'Search',
      noLogs: 'No logs found',
      successRate: 'Success Rate',
      totalActions: 'Total Actions',
    },
  }[language];
  
  const overallStatusColors = {
    [STATUS.OK]: '#10b981',
    [STATUS.DEGRADED]: '#f59e0b',
    [STATUS.FAIL]: '#ef4444',
  };
  
  return (
    <div className="self-healing-center" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          {t.title}
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>{t.subtitle}</p>
      </div>
      
      {/* Overall Status */}
      <Card style={{ marginBottom: '20px' }}>
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} />
            {t.overallStatus}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '16px',
            backgroundColor: overallStatusColors[overallStatus] + '20',
            borderRadius: '8px',
            border: `2px solid ${overallStatusColors[overallStatus]}`,
          }}>
            <span style={{ fontSize: '32px' }}>
              {overallStatus === STATUS.OK ? '✅' : 
               overallStatus === STATUS.DEGRADED ? '⚠️' : '❌'}
            </span>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {overallStatus}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                {new Date().toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
              </div>
            </div>
            <Button 
              onClick={handleForceCheck}
              style={{ marginLeft: 'auto' }}
              variant="outline"
            >
              <RefreshCw size={16} style={{ marginLeft: '8px' }} />
              {language === 'ar' ? 'فحص الآن' : 'Check Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Health Cards */}
      <Card style={{ marginBottom: '20px' }}>
        <CardHeader>
          <CardTitle>{t.healthStatus}</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}>
            {Object.entries(healthState).map(([module, data]) => (
              <HealthStatusCard
                key={module}
                module={module}
                status={data.status}
                details={data}
                lastCheck={data.lastCheck}
                language={language}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Toggles */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px',
        marginBottom: '20px',
      }}>
        {/* Safe Mode Toggle */}
        <Card>
          <CardHeader>
            <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} />
              {t.safeMode}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {safeMode ? t.enabled : t.disabled}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {safeMode 
                    ? `${safeModeStatus.disabledFeatures.length} features disabled`
                    : 'All features enabled'}
                </div>
              </div>
              <Button
                onClick={handleToggleSafeMode}
                variant={safeMode ? 'destructive' : 'default'}
              >
                {safeMode 
                  ? (language === 'ar' ? 'إلغاء التفعيل' : 'Disable')
                  : (language === 'ar' ? 'تفعيل' : 'Enable')}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Read-Only Mode Toggle */}
        <Card>
          <CardHeader>
            <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} />
              {t.readOnlyMode}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {readOnlyMode ? t.enabled : t.disabled}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {readOnlyMode 
                    ? 'Mutations disabled'
                    : 'Full access enabled'}
                </div>
              </div>
              <Button
                onClick={handleToggleReadOnly}
                variant={readOnlyMode ? 'destructive' : 'default'}
              >
                {readOnlyMode 
                  ? (language === 'ar' ? 'إلغاء التفعيل' : 'Disable')
                  : (language === 'ar' ? 'تفعيل' : 'Enable')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Playbooks */}
      <Card style={{ marginBottom: '20px' }}>
        <CardHeader>
          <CardTitle>{t.playbooks}</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Button
              onClick={() => runPlaybook('softReload', softReloadOnce, { moduleName: 'admin' })}
              disabled={runningPlaybook === 'softReload'}
              variant="outline"
            >
              <RefreshCw size={16} style={{ marginLeft: '8px' }} />
              {language === 'ar' ? 'إعادة تحميل الواجهة' : 'Soft Reload'}
            </Button>
            
            <Button
              onClick={() => runPlaybook('resetRealtime', resetRealtimeSubscribe, { clinicId: 'admin' })}
              disabled={runningPlaybook === 'resetRealtime'}
              variant="outline"
            >
              <RefreshCw size={16} style={{ marginLeft: '8px' }} />
              {language === 'ar' ? 'إعادة الاتصال' : 'Reset Realtime'}
            </Button>
            
            <Button
              onClick={() => runPlaybook('clearCache', safeCacheClear, { scope: 'all' })}
              disabled={runningPlaybook === 'clearCache'}
              variant="outline"
            >
              <Trash2 size={16} style={{ marginLeft: '8px' }} />
              {language === 'ar' ? 'مسح الذاكرة' : 'Clear Cache'}
            </Button>
            
            <Button
              onClick={() => runPlaybook('fixNotifications', notificationDedupRepair)}
              disabled={runningPlaybook === 'fixNotifications'}
              variant="outline"
            >
              <CheckCircle size={16} style={{ marginLeft: '8px' }} />
              {language === 'ar' ? 'إصلاح الإشعارات' : 'Fix Notifications'}
            </Button>
            
            <Button
              onClick={() => runPlaybook('repairI18n', i18nCacheRepair)}
              disabled={runningPlaybook === 'repairI18n'}
              variant="outline"
            >
              <RefreshCw size={16} style={{ marginLeft: '8px' }} />
              {language === 'ar' ? 'إصلاح الترجمة' : 'Repair i18n'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats */}
      {stats && (
        <Card style={{ marginBottom: '20px' }}>
          <CardHeader>
            <CardTitle>{t.stats}</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{t.totalActions}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{t.successRate}</div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold',
                  color: stats.successRate >= 95 ? '#10b981' : 
                         stats.successRate >= 80 ? '#f59e0b' : '#ef4444'
                }}>
                  {stats.successRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {language === 'ar' ? 'متوسط المحاولات' : 'Avg Attempts'}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {stats.averageAttempts.toFixed(1)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {t.logs}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={() => handleExportLogs('csv')} variant="outline" size="sm">
                <Download size={14} style={{ marginLeft: '4px' }} />
                CSV
              </Button>
              <Button onClick={() => handleExportLogs('json')} variant="outline" size="sm">
                <Download size={14} style={{ marginLeft: '4px' }} />
                JSON
              </Button>
              <Button onClick={handleClearLogs} variant="destructive" size="sm">
                <Trash2 size={14} style={{ marginLeft: '4px' }} />
                {t.clear}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder={t.search}
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && loadLogs()}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                }}
              />
            </div>
            <select
              value={logSeverity}
              onChange={(e) => setLogSeverity(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
              }}
            >
              <option value="">{language === 'ar' ? 'جميع الخطورة' : 'All Severities'}</option>
              <option value={SEVERITY.INFO}>{language === 'ar' ? 'معلومات' : 'Info'}</option>
              <option value={SEVERITY.WARNING}>{language === 'ar' ? 'تحذير' : 'Warning'}</option>
              <option value={SEVERITY.ERROR}>{language === 'ar' ? 'خطأ' : 'Error'}</option>
            </select>
            <Button onClick={loadLogs} variant="outline">
              <Filter size={16} />
            </Button>
          </div>
          
          {/* Logs Table */}
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              {t.noLogs}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'ar' ? 'الوقت' : 'Time'}</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'ar' ? 'الإجراء' : 'Action'}</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'ar' ? 'الوحدة' : 'Module'}</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'ar' ? 'الخطورة' : 'Severity'}</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'ar' ? 'النتيجة' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 50).map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px', fontSize: '12px' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px' }}>{log.action}</td>
                      <td style={{ padding: '8px' }}>{log.module}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: log.severity === SEVERITY.ERROR ? '#fee2e2' :
                                          log.severity === SEVERITY.WARNING ? '#fef3c7' : '#d1fae5',
                          color: log.severity === SEVERITY.ERROR ? '#991b1b' :
                                 log.severity === SEVERITY.WARNING ? '#92400e' : '#065f46',
                        }}>
                          {log.severity}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>{log.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SelfHealingCenter;
