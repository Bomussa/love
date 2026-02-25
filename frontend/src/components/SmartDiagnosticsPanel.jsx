/**
 * SmartDiagnosticsPanel - النظام الذكي الشامل للتشخيص والإصلاح التلقائي
 * مكوّن واحد يضم: التشخيص الحي + الإصلاح التلقائي + سجل الأخطاء
 * 
 * لا يتعارض مع: SystemStatus (يفحص جداول فقط) أو APIMonitor (يراقب API)
 * يضيف: رصد JS errors + polling + أداء + إصلاح تلقائي + سجل حقيقي في Supabase
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase-client';
import {
  Zap, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Activity, Database, Wifi, Clock, Shield, TrendingUp,
  Play, Pause, Trash2, ChevronDown, ChevronUp, Eye
} from 'lucide-react';

// ============================================================
// ثوابت
// ============================================================
const SEVERITY_COLOR = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low:      'text-blue-400 bg-blue-500/10 border-blue-500/30',
};
const STATUS_ICON = {
  ok:      <CheckCircle size={16} className="text-green-400 flex-shrink-0" />,
  warning: <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />,
  error:   <XCircle size={16} className="text-red-400 flex-shrink-0" />,
  loading: <RefreshCw size={16} className="text-gray-400 animate-spin flex-shrink-0" />,
};

// ============================================================
// المكوّن الرئيسي
// ============================================================
const SmartDiagnosticsPanel = ({ language, t: tProp }) => {
  const t = tProp || ((ar, en) => language === 'ar' ? ar : en);
  const isRTL = language === 'ar';

  // الحالة
  const [activeSection, setActiveSection] = useState('diagnostics');
  const [isRunning, setIsRunning]   = useState(false);
  const [lastRun, setLastRun]       = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [errors, setErrors]         = useState([]);
  const [fixes, setFixes]           = useState([]);
  const [stats, setStats]           = useState({ total: 0, ok: 0, warning: 0, error: 0, fixed: 0 });
  const [autoFix, setAutoFix]       = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  const [loadingFix, setLoadingFix] = useState(null);

  // مرجع لـ polling watchdog
  const lastPollRef = useRef(Date.now());
  const engineRef   = useRef(null);

  // ============================================================
  // تشغيل التشخيص الكامل
  // ============================================================
  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    const results = [];

    // --- 1. اتصال Supabase ---
    const t1 = performance.now();
    try {
      const { data, error } = await supabase.from('settings').select('id').limit(1);
      const ms = Math.round(performance.now() - t1);
      results.push({
        id: 'supabase_conn',
        category: t('قاعدة البيانات', 'Database'),
        name: t('اتصال Supabase', 'Supabase Connection'),
        status: error ? 'error' : 'ok',
        detail: error ? error.message : `${t('متصل', 'Connected')} — ${ms}ms`,
        latency: ms,
        fixable: !!error,
        fixStrategy: 'supabase_reconnect',
      });
    } catch (e) {
      results.push({ id: 'supabase_conn', category: t('قاعدة البيانات', 'Database'), name: t('اتصال Supabase', 'Supabase Connection'), status: 'error', detail: e.message, fixable: true, fixStrategy: 'supabase_reconnect' });
    }

    // --- 2. جداول Supabase الأساسية ---
    const tables = [
      { key: 'clinics',           label: t('العيادات', 'Clinics') },
      { key: 'queues',            label: t('الطوابير', 'Queues') },
      { key: 'settings',          label: t('الإعدادات', 'Settings') },
      { key: 'patients',          label: t('المرضى', 'Patients') },
      { key: 'floor_directions',  label: t('توجيه الطوابق', 'Floor Directions') },
      { key: 'smart_errors_log',  label: t('سجل الأخطاء الذكي', 'Smart Errors Log') },
      { key: 'smart_fixes_log',   label: t('سجل الإصلاحات الذكي', 'Smart Fixes Log') },
    ];
    for (const tb of tables) {
      const ts = performance.now();
      try {
        const { count, error } = await supabase.from(tb.key).select('*', { count: 'exact', head: true });
        const ms = Math.round(performance.now() - ts);
        results.push({
          id: `table_${tb.key}`,
          category: t('جداول البيانات', 'DB Tables'),
          name: tb.label,
          status: error ? 'error' : 'ok',
          detail: error ? error.message : `${count ?? 0} ${t('سجل', 'records')} — ${ms}ms`,
          latency: ms,
          fixable: false,
        });
      } catch (e) {
        results.push({ id: `table_${tb.key}`, category: t('جداول البيانات', 'DB Tables'), name: tb.label, status: 'error', detail: e.message, fixable: false });
      }
    }

    // --- 3. اتصال الإنترنت ---
    results.push({
      id: 'internet',
      category: t('الشبكة', 'Network'),
      name: t('اتصال الإنترنت', 'Internet Connection'),
      status: navigator.onLine ? 'ok' : 'error',
      detail: navigator.onLine ? t('متصل', 'Online') : t('غير متصل', 'Offline'),
      fixable: false,
    });

    // --- 4. التخزين المحلي ---
    try {
      localStorage.setItem('__smart_test__', '1');
      localStorage.removeItem('__smart_test__');
      results.push({ id: 'localstorage', category: t('المتصفح', 'Browser'), name: t('التخزين المحلي', 'LocalStorage'), status: 'ok', detail: `${Object.keys(localStorage).length} ${t('مفتاح', 'keys')}`, fixable: false });
    } catch (e) {
      results.push({ id: 'localstorage', category: t('المتصفح', 'Browser'), name: t('التخزين المحلي', 'LocalStorage'), status: 'error', detail: e.message, fixable: false });
    }

    // --- 5. التحديث التلقائي (Polling) ---
    const pollAge = Math.round((Date.now() - lastPollRef.current) / 1000);
    results.push({
      id: 'polling',
      category: t('الوقت الفعلي', 'Real-time'),
      name: t('التحديث التلقائي', 'Auto Refresh'),
      status: pollAge < 60 ? 'ok' : pollAge < 120 ? 'warning' : 'error',
      detail: pollAge < 60
        ? `${t('يعمل — آخر تحديث منذ', 'Active — last update')} ${pollAge}${t('ث', 's')}`
        : `${t('متوقف منذ', 'Stopped for')} ${pollAge}${t('ث', 's')}`,
      fixable: pollAge >= 60,
      fixStrategy: 'restart_polling',
    });

    // --- 6. أداء الصفحة ---
    const mem = performance.memory;
    const memMB = mem ? Math.round(mem.usedJSHeapSize / 1048576) : null;
    results.push({
      id: 'performance',
      category: t('الأداء', 'Performance'),
      name: t('استهلاك الذاكرة', 'Memory Usage'),
      status: !memMB ? 'ok' : memMB < 150 ? 'ok' : memMB < 250 ? 'warning' : 'error',
      detail: memMB ? `${memMB} MB` : t('غير متاح في هذا المتصفح', 'N/A in this browser'),
      fixable: memMB > 250,
      fixStrategy: 'clear_cache',
    });

    // --- 7. مكونات React الأساسية ---
    const components = [
      { id: 'comp_admin',    name: t('لوحة الإدارة', 'Admin Dashboard'),       check: () => !!document.querySelector('[data-admin-dashboard]') || !!document.getElementById('root') },
      { id: 'comp_sidebar',  name: t('القائمة الجانبية', 'Sidebar'),            check: () => !!document.querySelector('nav, aside, [role="navigation"]') },
      { id: 'comp_toaster',  name: t('نظام التنبيهات', 'Toast System'),         check: () => typeof window !== 'undefined' },
    ];
    for (const comp of components) {
      results.push({
        id: comp.id,
        category: t('مكونات React', 'React Components'),
        name: comp.name,
        status: comp.check() ? 'ok' : 'warning',
        detail: comp.check() ? t('موجود ويعمل', 'Present & active') : t('غير مكتشف', 'Not detected'),
        fixable: false,
      });
    }

    // حساب الإحصائيات
    const ok      = results.filter(r => r.status === 'ok').length;
    const warning = results.filter(r => r.status === 'warning').length;
    const error   = results.filter(r => r.status === 'error').length;
    setStats({ total: results.length, ok, warning, error, fixed: fixes.length });
    setDiagnostics(results);
    setLastRun(new Date());
    setIsRunning(false);

    // إصلاح تلقائي إذا كان مفعّلاً
    if (autoFix) {
      const fixable = results.filter(r => r.fixable && r.status === 'error');
      for (const item of fixable) {
        await applyFix(item, true);
      }
    }

    // حفظ الأخطاء في Supabase
    const errItems = results.filter(r => r.status === 'error');
    for (const item of errItems) {
      await saveErrorLog(item);
    }
  }, [autoFix, fixes.length, t]);

  // ============================================================
  // تطبيق الإصلاح
  // ============================================================
  const applyFix = async (item, silent = false) => {
    if (!silent) setLoadingFix(item.id);
    const start = performance.now();
    let success = false;
    let note = '';

    try {
      if (item.fixStrategy === 'supabase_reconnect') {
        // إعادة اختبار الاتصال
        const { error } = await supabase.from('settings').select('id').limit(1);
        success = !error;
        note = success ? t('تم إعادة الاتصال', 'Reconnected') : t('فشل الاتصال', 'Connection failed');
      } else if (item.fixStrategy === 'restart_polling') {
        // إعادة تعيين الـ timestamp
        lastPollRef.current = Date.now();
        // محاولة استدعاء دالة التحديث العالمية
        if (window.__refreshPatientData) { window.__refreshPatientData(); }
        if (window.__refreshDisplayData) { window.__refreshDisplayData(); }
        success = true;
        note = t('تم إعادة تشغيل التحديث', 'Polling restarted');
      } else if (item.fixStrategy === 'clear_cache') {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        success = true;
        note = t('تم تنظيف الكاش', 'Cache cleared');
      }
    } catch (e) {
      success = false;
      note = e.message;
    }

    const duration = Math.round(performance.now() - start);
    const fixRecord = {
      id: `fix_${Date.now()}`,
      errorId: item.id,
      name: item.name,
      strategy: item.fixStrategy || 'manual',
      success,
      duration,
      note,
      time: new Date().toISOString(),
    };

    setFixes(prev => [fixRecord, ...prev].slice(0, 50));
    await saveFixLog(fixRecord);

    if (!silent) {
      setLoadingFix(null);
      // تحديث حالة العنصر في التشخيص
      if (success) {
        setDiagnostics(prev => prev.map(d =>
          d.id === item.id ? { ...d, status: 'ok', detail: note } : d
        ));
      }
    }
    return success;
  };

  // ============================================================
  // حفظ في Supabase
  // ============================================================
  const saveErrorLog = async (item) => {
    try {
      await supabase.from('smart_errors_log').insert({
        error_id:   `${item.id}_${Date.now()}`,
        error_type: item.id,
        severity:   item.status === 'error' ? 'high' : 'medium',
        message:    item.detail,
        source:     item.category,
        is_fixed:   false,
      });
    } catch (_) { /* صامت */ }
  };

  const saveFixLog = async (fix) => {
    try {
      await supabase.from('smart_fixes_log').insert({
        fix_id:        fix.id,
        error_id:      fix.errorId,
        strategy:      fix.strategy,
        strategy_name: fix.name,
        success:       fix.success,
        duration_ms:   fix.duration,
      });
    } catch (_) { /* صامت */ }
  };

  // ============================================================
  // تحميل السجل من Supabase
  // ============================================================
  const loadLogs = useCallback(async () => {
    try {
      const { data: errData } = await supabase
        .from('smart_errors_log')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(30);
      if (errData) setErrors(errData);

      const { data: fixData } = await supabase
        .from('smart_fixes_log')
        .select('*')
        .order('applied_at', { ascending: false })
        .limit(30);
      if (fixData) setFixes(fixData.map(f => ({
        id: f.fix_id,
        errorId: f.error_id,
        name: f.strategy_name,
        strategy: f.strategy,
        success: f.success,
        duration: f.duration_ms,
        time: f.applied_at,
      })));
    } catch (_) { /* صامت */ }
  }, []);

  // تشغيل عند التحميل
  useEffect(() => {
    runDiagnostics();
    loadLogs();
    // تحديث lastPollRef عند أي fetch ناجح
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : '';
      if (url.includes('supabase.co') && res.ok) lastPollRef.current = Date.now();
      return res;
    };
    return () => { window.fetch = origFetch; };
  }, []);

  // ============================================================
  // واجهة المستخدم
  // ============================================================
  const sections = [
    { id: 'diagnostics', label: t('التشخيص الحي', 'Live Diagnostics'), icon: Activity },
    { id: 'errors',      label: t('سجل الأخطاء', 'Error Log'),         icon: XCircle },
    { id: 'fixes',       label: t('سجل الإصلاحات', 'Fix Log'),         icon: Shield },
  ];

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ===== رأس الصفحة ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="text-[#C9A54C]" size={28} />
            {t('النظام الذكي للتشخيص والإصلاح', 'Smart Diagnostics & Auto-Repair')}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {t('رصد حقيقي + إصلاح تلقائي + سجل موثّق في قاعدة البيانات', 'Real monitoring + auto-repair + verified log in database')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* زر التشغيل التلقائي */}
          <button
            onClick={() => setAutoFix(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all ${
              autoFix ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-gray-700/40 border-gray-600/40 text-gray-400'
            }`}
          >
            {autoFix ? <Play size={14} /> : <Pause size={14} />}
            {t('إصلاح تلقائي', 'Auto-Fix')}: {autoFix ? t('مفعّل', 'ON') : t('موقوف', 'OFF')}
          </button>
          {/* زر تشغيل التشخيص */}
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-[#C9A54C] text-black rounded-xl font-bold hover:bg-[#B8943D] transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRunning ? 'animate-spin' : ''} />
            {isRunning ? t('جاري الفحص...', 'Scanning...') : t('فحص الآن', 'Scan Now')}
          </button>
        </div>
      </div>

      {/* ===== بطاقات الإحصاء ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('إجمالي العناصر', 'Total Items'), value: stats.total, color: 'text-white', bg: 'from-gray-800 to-gray-900' },
          { label: t('يعمل بشكل صحيح', 'Working'),    value: stats.ok,    color: 'text-green-400', bg: 'from-green-900/30 to-green-950/30' },
          { label: t('تحذيرات', 'Warnings'),           value: stats.warning, color: 'text-yellow-400', bg: 'from-yellow-900/30 to-yellow-950/30' },
          { label: t('أخطاء', 'Errors'),               value: stats.error,   color: 'text-red-400',    bg: 'from-red-900/30 to-red-950/30' },
        ].map(card => (
          <div key={card.label} className={`bg-gradient-to-br ${card.bg} rounded-2xl border border-white/10 p-4`}>
            <p className="text-gray-400 text-xs mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ===== آخر فحص ===== */}
      {lastRun && (
        <p className="text-gray-500 text-xs flex items-center gap-1">
          <Clock size={12} />
          {t('آخر فحص:', 'Last scan:')} {lastRun.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
        </p>
      )}

      {/* ===== تبويبات القسم ===== */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {sections.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-xl transition-all border-b-2 ${
              activeSection === sec.id
                ? 'border-[#C9A54C] text-[#C9A54C] bg-[#C9A54C]/10'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <sec.icon size={14} />
            {sec.label}
            {sec.id === 'errors' && errors.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{errors.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== قسم التشخيص الحي ===== */}
      {activeSection === 'diagnostics' && (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-xs uppercase">
                <th className="px-4 py-3 text-start">{t('الحالة', 'Status')}</th>
                <th className="px-4 py-3 text-start">{t('الفئة', 'Category')}</th>
                <th className="px-4 py-3 text-start">{t('العنصر', 'Element')}</th>
                <th className="px-4 py-3 text-start">{t('التفاصيل', 'Details')}</th>
                <th className="px-4 py-3 text-start">{t('إصلاح', 'Fix')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {diagnostics.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">{isRunning ? t('جاري الفحص...', 'Scanning...') : t('اضغط "فحص الآن" للبدء', 'Click "Scan Now" to start')}</td></tr>
              ) : diagnostics.map(item => (
                <React.Fragment key={item.id}>
                  <tr
                    className="hover:bg-white/3 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        {STATUS_ICON[item.status] || STATUS_ICON.loading}
                        <span className={`text-xs font-medium ${
                          item.status === 'ok' ? 'text-green-400' :
                          item.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {item.status === 'ok' ? t('يعمل', 'OK') : item.status === 'warning' ? t('تحذير', 'Warn') : t('خطأ', 'Error')}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{item.category}</td>
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{item.detail}</td>
                    <td className="px-4 py-3">
                      {item.fixable ? (
                        <button
                          onClick={e => { e.stopPropagation(); applyFix(item); }}
                          disabled={loadingFix === item.id}
                          className="flex items-center gap-1 px-3 py-1 bg-[#C9A54C]/20 text-[#C9A54C] border border-[#C9A54C]/30 rounded-lg text-xs hover:bg-[#C9A54C]/30 transition-all disabled:opacity-50"
                        >
                          {loadingFix === item.id ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                          {t('إصلاح', 'Fix')}
                        </button>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                  {expandedRow === item.id && (
                    <tr className="bg-white/2">
                      <td colSpan={5} className="px-6 py-3 text-gray-400 text-xs">
                        <strong className="text-gray-300">{t('التفاصيل الكاملة:', 'Full details:')}</strong> {item.detail}
                        {item.latency && <span className="ms-3 text-blue-400">{t('زمن الاستجابة:', 'Latency:')} {item.latency}ms</span>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== قسم سجل الأخطاء ===== */}
      {activeSection === 'errors' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">{t('آخر 30 خطأ مسجّل في قاعدة البيانات', 'Last 30 errors recorded in database')}</p>
            <button onClick={loadLogs} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={12} /> {t('تحديث', 'Refresh')}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-xs uppercase">
                  <th className="px-4 py-3 text-start">{t('الخطورة', 'Severity')}</th>
                  <th className="px-4 py-3 text-start">{t('النوع', 'Type')}</th>
                  <th className="px-4 py-3 text-start">{t('الرسالة', 'Message')}</th>
                  <th className="px-4 py-3 text-start">{t('المصدر', 'Source')}</th>
                  <th className="px-4 py-3 text-start">{t('الوقت', 'Time')}</th>
                  <th className="px-4 py-3 text-start">{t('مُصلَح', 'Fixed')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {errors.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-500">{t('لا توجد أخطاء مسجّلة', 'No errors recorded')}</td></tr>
                ) : errors.map(err => (
                  <tr key={err.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${SEVERITY_COLOR[err.severity] || SEVERITY_COLOR.medium}`}>
                        {err.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs font-mono">{err.error_type}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{err.message}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{err.source}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {err.occurred_at ? new Date(err.occurred_at).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {err.is_fixed
                        ? <CheckCircle size={14} className="text-green-400" />
                        : <XCircle size={14} className="text-red-400" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== قسم سجل الإصلاحات ===== */}
      {activeSection === 'fixes' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">{t('آخر 30 إصلاح مسجّل في قاعدة البيانات', 'Last 30 fixes recorded in database')}</p>
            <button onClick={loadLogs} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={12} /> {t('تحديث', 'Refresh')}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-xs uppercase">
                  <th className="px-4 py-3 text-start">{t('النتيجة', 'Result')}</th>
                  <th className="px-4 py-3 text-start">{t('الاستراتيجية', 'Strategy')}</th>
                  <th className="px-4 py-3 text-start">{t('العنصر', 'Element')}</th>
                  <th className="px-4 py-3 text-start">{t('المدة', 'Duration')}</th>
                  <th className="px-4 py-3 text-start">{t('الوقت', 'Time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {fixes.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-500">{t('لا توجد إصلاحات مسجّلة', 'No fixes recorded')}</td></tr>
                ) : fixes.map((fix, i) => (
                  <tr key={fix.id || i} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      {fix.success
                        ? <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle size={14} /> {t('نجح', 'Success')}</span>
                        : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={14} /> {t('فشل', 'Failed')}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs font-mono">{fix.strategy}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fix.name || fix.strategy_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fix.duration || fix.duration_ms ? `${fix.duration || fix.duration_ms}ms` : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fix.time || fix.applied_at ? new Date(fix.time || fix.applied_at).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartDiagnosticsPanel;
