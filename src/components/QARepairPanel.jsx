/**
 * QA & Repair Comprehensive Panel
 * لوحة شاملة لعرض نتائج الفحص والإصلاحات مع التفاصيل الكاملة
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import {
  Zap, RefreshCw, Play, CheckCircle, XCircle, AlertTriangle,
  Clock, TrendingUp, Activity, Shield, Eye, ChevronDown, ChevronUp,
  Wrench, FileText, Filter, Download, Calendar, Search
} from 'lucide-react';
import toast from 'react-hot-toast';

const QARepairPanel = ({ language = 'ar', t }) => {
  const isRTL = language === 'ar';
  
  // States
  const [qaRuns, setQaRuns] = useState([]);
  const [findings, setFindings] = useState([]);
  const [repairRuns, setRepairRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [expandedFinding, setExpandedFinding] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
    
    // Subscribe to real-time updates
    const qaSubscription = supabase
      .channel('qa_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'qa_runs' 
      }, () => {
        loadData();
      })
      .subscribe();

    const findingsSubscription = supabase
      .channel('findings_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'qa_findings' 
      }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      qaSubscription.unsubscribe();
      findingsSubscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // جلب آخر 20 عملية فحص
      const { data: runs, error: runsError } = await supabase
        .from('qa_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (runsError) throw runsError;

      // جلب آخر 50 finding
      const { data: fnd, error: fndError } = await supabase
        .from('qa_findings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (fndError) throw fndError;

      // جلب عمليات الإصلاح
      const { data: repairs, error: repairsError } = await supabase
        .from('repair_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (repairsError) throw repairsError;

      setQaRuns(runs || []);
      setFindings(fnd || []);
      setRepairRuns(repairs || []);
    } catch (e) {
      console.error('Error loading QA data:', e);
      toast.error(t('فشل تحميل البيانات', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const startDeepQA = async () => {
    setRunning(true);
    try {
      const response = await fetch('/api/v1/qa/deep_run');
      const result = await response.json();
      
      if (result.ok !== undefined) {
        if (result.ok) {
          toast.success(t('✅ اكتمل الفحص بنجاح - لا توجد مشاكل حرجة', 'Deep QA completed - No critical issues'));
        } else {
          toast.error(t('⚠️ اكتمل الفحص - وُجدت مشاكل تحتاج معالجة', 'Deep QA completed - Issues found'));
        }
        loadData();
      } else {
        toast.error(t('فشل تشغيل الفحص', 'QA Run failed'));
      }
    } catch (e) {
      console.error('Deep QA error:', e);
      toast.error(t('خطأ في الاتصال بخدمة الفحص', 'Connection error'));
    } finally {
      setRunning(false);
    }
  };

  const executeRepair = async (findingId) => {
    try {
      toast.loading(t('جاري تنفيذ الإصلاح...', 'Executing repair...'));
      
      const response = await fetch('/api/v1/repair/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          findingId, 
          token: 'mmc-mms-repair-secret-2026' 
        })
      });
      
      const result = await response.json();
      
      toast.dismiss();
      
      if (result.success) {
        toast.success(t('✅ تم الإصلاح بنجاح', 'Repair successful'));
        loadData();
      } else {
        toast.error(t('❌ فشل الإصلاح: ' + (result.error || 'Unknown error'), 'Repair failed'));
      }
    } catch (e) {
      toast.dismiss();
      console.error('Repair error:', e);
      toast.error(t('خطأ في الاتصال بخدمة الإصلاح', 'Connection error'));
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'text-red-400 bg-red-500/10 border-red-500/20',
      high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      low: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    };
    return colors[severity] || colors.medium;
  };

  const getSeverityIcon = (severity) => {
    if (severity === 'critical' || severity === 'high') return <XCircle size={16} />;
    if (severity === 'medium') return <AlertTriangle size={16} />;
    return <Activity size={16} />;
  };

  // Filter findings
  const filteredFindings = findings.filter(f => {
    if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false;
    if (filterStatus === 'resolved' && !f.is_resolved) return false;
    if (filterStatus === 'unresolved' && f.is_resolved) return false;
    if (searchTerm && !f.description.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !f.type.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    totalRuns: qaRuns.length,
    successfulRuns: qaRuns.filter(r => r.ok).length,
    totalFindings: findings.length,
    criticalFindings: findings.filter(f => f.severity === 'critical' && !f.is_resolved).length,
    resolvedFindings: findings.filter(f => f.is_resolved).length,
    totalRepairs: repairRuns.length,
    successfulRepairs: repairRuns.filter(r => r.status === 'success').length
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-indigo-400" size={28} />
            {t('نظام المراقبة والإصلاح الذاتي الشامل', 'Comprehensive QA & Self-Healing System')}
          </h2>
          <p className="text-slate-400 mt-1">
            {t('مراقبة حية، تشخيص دقيق، وإصلاح تلقائي للأعطال', 'Live monitoring, precise diagnostics, and automatic repair')}
          </p>
        </div>
        <button 
          onClick={startDeepQA} 
          disabled={running}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            running 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          {running ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
          {t('تشغيل فحص عميق الآن', 'Run Deep QA Now')}
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">{t('عمليات الفحص', 'QA Runs')}</span>
            <Activity className="text-indigo-400" size={18} />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalRuns}</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.successfulRuns} {t('ناجحة', 'successful')}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">{t('المشاكل المكتشفة', 'Findings')}</span>
            <AlertTriangle className="text-orange-400" size={18} />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalFindings}</div>
          <div className="text-xs text-red-400 mt-1">
            {stats.criticalFindings} {t('حرجة', 'critical')}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">{t('المشاكل المحلولة', 'Resolved')}</span>
            <CheckCircle className="text-green-400" size={18} />
          </div>
          <div className="text-2xl font-bold text-white">{stats.resolvedFindings}</div>
          <div className="text-xs text-green-400 mt-1">
            {stats.totalFindings > 0 ? Math.round((stats.resolvedFindings / stats.totalFindings) * 100) : 0}% {t('معدل الحل', 'resolution rate')}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">{t('عمليات الإصلاح', 'Repairs')}</span>
            <Wrench className="text-purple-400" size={18} />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalRepairs}</div>
          <div className="text-xs text-purple-400 mt-1">
            {stats.successfulRepairs} {t('ناجحة', 'successful')}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('بحث في المشاكل...', 'Search findings...')}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">{t('كل المستويات', 'All Severities')}</option>
            <option value="critical">{t('حرجة', 'Critical')}</option>
            <option value="high">{t('عالية', 'High')}</option>
            <option value="medium">{t('متوسطة', 'Medium')}</option>
            <option value="low">{t('منخفضة', 'Low')}</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">{t('الكل', 'All')}</option>
            <option value="resolved">{t('محلولة', 'Resolved')}</option>
            <option value="unresolved">{t('غير محلولة', 'Unresolved')}</option>
          </select>

          <button
            onClick={loadData}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            {t('تحديث', 'Refresh')}
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div className="bg-slate-800/30 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText size={20} className="text-indigo-400" />
            {t('المشاكل المكتشفة', 'Detected Issues')} ({filteredFindings.length})
          </h3>
        </div>

        <div className="divide-y divide-white/5">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
              {t('جاري التحميل...', 'Loading...')}
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CheckCircle className="mx-auto mb-2 text-green-400" size={32} />
              <p>{t('لا توجد مشاكل', 'No issues found')}</p>
            </div>
          ) : (
            filteredFindings.map(finding => {
              const repair = repairRuns.find(r => r.finding_id === finding.id);
              const isExpanded = expandedFinding === finding.id;

              return (
                <div key={finding.id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${getSeverityColor(finding.severity)}`}>
                          {getSeverityIcon(finding.severity)}
                          {finding.severity.toUpperCase()}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
                          {finding.type}
                        </span>
                        {finding.is_resolved && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                            ✓ {t('محلولة', 'Resolved')}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-white mb-2">{finding.description}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(finding.created_at).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </span>
                        {finding.resolved_at && (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle size={12} />
                            {t('تم الحل في', 'Resolved at')} {new Date(finding.resolved_at).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          </span>
                        )}
                      </div>

                      {isExpanded && finding.metadata && (
                        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-white/10">
                          <p className="text-xs text-slate-400 font-mono">{JSON.stringify(finding.metadata, null, 2)}</p>
                        </div>
                      )}

                      {repair && isExpanded && (
                        <div className="mt-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <h4 className="text-sm font-bold text-purple-400 mb-2">{t('تفاصيل الإصلاح', 'Repair Details')}</h4>
                          <div className="space-y-1 text-xs text-slate-300">
                            <p><strong>{t('الحالة', 'Status')}:</strong> {repair.status}</p>
                            <p><strong>{t('الطريقة', 'Playbook')}:</strong> {repair.playbook}</p>
                            {repair.logs && <p><strong>{t('السجل', 'Logs')}:</strong> {repair.logs}</p>}
                            <p><strong>{t('التاريخ', 'Date')}:</strong> {new Date(repair.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </button>
                      
                      {!finding.is_resolved && (
                        <button
                          onClick={() => executeRepair(finding.id)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <Wrench size={14} />
                          {t('إصلاح', 'Repair')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default QARepairPanel;
