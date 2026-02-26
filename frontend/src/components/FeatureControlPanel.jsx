import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Eye, EyeOff, RefreshCw,
  Users, Bell, MapPin, Key, BarChart3, Clock,
  Building2, FileText, Shield, Database, Wifi,
  Check, X, AlertCircle, ChevronDown, ChevronUp, Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';

const SYSTEM_FEATURES = [
  {
    id: 'queue_system', name: 'نظام الطوابير (أرقام الدور)', nameEn: 'Queue System',
    description: 'رقم الدور لكل مراجع في كل عيادة', descriptionEn: 'Queue number per patient per clinic',
    icon: Users, category: 'core',
    patientEffect: 'إيقاف: يخفي رقم الدور | إخفاء: يخفي قسم الأرقام',
    checkFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase.from('unified_queue').select('*', { count: 'exact', head: true }).eq('queue_date', today);
      if (error) throw new Error(error.message);
      return `${count ?? 0} سجل اليوم`;
    }
  },
  {
    id: 'pin_system', name: 'نظام الأرقام السرية (PIN)', nameEn: 'PIN System',
    description: 'التحقق من PIN عند الخروج من العيادة', descriptionEn: 'Verify PIN on clinic exit',
    icon: Key, category: 'core',
    patientEffect: 'إيقاف: خروج بدون PIN | إخفاء: الطبيب ينهي الفحص',
    checkFn: async () => {
      const { count, error } = await supabase.from('pins').select('*', { count: 'exact', head: true }).eq('is_active', true);
      if (error) throw new Error(error.message);
      if (!count) throw new Error('لا يوجد PIN نشط');
      return `${count} PIN نشط`;
    }
  },
  {
    id: 'dynamic_pathway', name: 'المسارات الديناميكية', nameEn: 'Dynamic Pathways',
    description: 'ترتيب العيادات حسب الأقل ازدحاماً عند دخول المراجع', descriptionEn: 'Sort clinics by least busy on entry',
    icon: MapPin, category: 'core',
    patientEffect: 'إيقاف: الترتيب الافتراضي | إخفاء: لا يؤثر',
    checkFn: async () => {
      const { count, error } = await supabase.from('patient_routes').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
      if (error) throw new Error(error.message);
      const api = (await import('../lib/api-unified')).default;
      if (typeof api.getQueueCount !== 'function') throw new Error('getQueueCount غير موجودة');
      return `${count ?? 0} مسار نشط ✓`;
    }
  },
  {
    id: 'notifications', name: 'الإشعارات اللحظية', nameEn: 'Real-time Notifications',
    description: 'إشعارات قرب الدور وحان دورك والعيادة التالية', descriptionEn: 'Near turn, your turn, next clinic',
    icon: Bell, category: 'core',
    patientEffect: 'إيقاف: لا إشعارات | إخفاء: يخفي لوحة الإشعارات',
    checkFn: async () => {
      const ch = supabase.channel('fcp_notif_' + Date.now());
      return new Promise((res) => {
        const t = setTimeout(() => { ch.unsubscribe(); throw new Error('انتهت المهلة'); }, 4000);
        ch.subscribe((s) => { clearTimeout(t); ch.unsubscribe(); res(s === 'SUBSCRIBED' ? 'Real-time متصل ✓' : `حالة: ${s}`); });
      });
    }
  },
  {
    id: 'realtime_sync', name: 'المزامنة الفورية', nameEn: 'Real-time Sync',
    description: 'تحديث بيانات الطابور والعيادات لحظياً', descriptionEn: 'Live update of queue data',
    icon: Wifi, category: 'system',
    patientEffect: 'إيقاف: يتطلب تحديث يدوي',
    checkFn: async () => navigator.onLine ? 'متصل بالإنترنت ✓' : (() => { throw new Error('غير متصل'); })()
  },
  {
    id: 'auto_pin_generate', name: 'إصدار PIN تلقائي يومياً', nameEn: 'Auto PIN Generate',
    description: 'إصدار أرقام PIN جديدة كل يوم الساعة 5 صباحاً', descriptionEn: 'Generate new PINs daily at 5 AM',
    icon: Clock, category: 'automation',
    patientEffect: 'لا يؤثر مباشرة على شاشة المراجع',
    checkFn: async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const { count } = await supabase.from('pins').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
      return count > 0 ? `${count} PIN أُصدر اليوم ✓` : 'لم يُصدر PIN اليوم بعد';
    }
  },
  {
    id: 'auto_queue_reset', name: 'إعادة تعيين الأرقام يومياً', nameEn: 'Auto Queue Reset',
    description: 'إعادة أرقام الدور من 1 كل يوم', descriptionEn: 'Reset queue numbers daily',
    icon: RefreshCw, category: 'automation',
    patientEffect: 'لا يؤثر مباشرة على شاشة المراجع',
    checkFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('unified_queue').select('*', { count: 'exact', head: true }).eq('queue_date', today);
      return `اليوم: ${count ?? 0} سجل`;
    }
  },
  {
    id: 'duplicate_prevention', name: 'منع التكرار (Atomic Lock)', nameEn: 'Duplicate Prevention',
    description: 'منع إعطاء نفس رقم الدور لمراجعَين في نفس الوقت', descriptionEn: 'Prevent duplicate queue numbers',
    icon: Shield, category: 'security',
    patientEffect: 'يعمل في الخلفية - لا يؤثر على الشاشة',
    checkFn: async () => {
      const { data } = await supabase.rpc('enter_unified_queue_safe', { p_clinic_id: '__chk__', p_patient_id: '__chk__' });
      return 'Advisory Lock نشط ✓';
    }
  },
  {
    id: 'clinics', name: 'إدارة العيادات', nameEn: 'Clinics Management',
    description: 'إضافة وتعديل وتفعيل العيادات', descriptionEn: 'Add, edit, activate clinics',
    icon: Building2, category: 'management',
    patientEffect: 'إخفاء: يخفي قائمة العيادات',
    checkFn: async () => {
      const { count, error } = await supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_active', true);
      if (error) throw new Error(error.message);
      if (!count) throw new Error('لا توجد عيادات نشطة');
      return `${count} عيادة نشطة ✓`;
    }
  },
  {
    id: 'reports', name: 'التقارير', nameEn: 'Reports',
    description: 'عرض وتصدير تقارير الطابور والعيادات', descriptionEn: 'View and export reports',
    icon: FileText, category: 'analytics',
    patientEffect: 'لا يؤثر على شاشة المراجع',
    checkFn: async () => {
      const { count } = await supabase.from('unified_queue').select('*', { count: 'exact', head: true });
      return `${count ?? 0} سجل إجمالي`;
    }
  },
  {
    id: 'statistics', name: 'الإحصائيات', nameEn: 'Statistics',
    description: 'إحصائيات النظام في لوحة التحكم', descriptionEn: 'System statistics in dashboard',
    icon: BarChart3, category: 'analytics',
    patientEffect: 'لا يؤثر على شاشة المراجع',
    checkFn: async () => {
      const { count } = await supabase.from('unified_queue').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
      return `${count ?? 0} منتظر الآن`;
    }
  },
  {
    id: 'offline_mode', name: 'وضع أوفلاين', nameEn: 'Offline Mode',
    description: 'العمل بدون اتصال بالإنترنت', descriptionEn: 'Work without internet',
    icon: Database, category: 'system',
    patientEffect: 'لا يؤثر مباشرة على شاشة المراجع',
    checkFn: async () => navigator.onLine ? 'متصل - وضع أوفلاين جاهز' : 'غير متصل - وضع أوفلاين نشط'
  }
];

const CATEGORIES = [
  { id: 'core', name: 'الميزات الأساسية', nameEn: 'Core Features' },
  { id: 'management', name: 'الإدارة', nameEn: 'Management' },
  { id: 'analytics', name: 'التحليلات', nameEn: 'Analytics' },
  { id: 'automation', name: 'الأتمتة', nameEn: 'Automation' },
  { id: 'security', name: 'الأمان', nameEn: 'Security' },
  { id: 'system', name: 'النظام', nameEn: 'System' }
];

const Badge = ({ status }) => {
  const map = {
    checking: <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full animate-pulse"><RefreshCw size={9} className="animate-spin"/>جاري الفحص</span>,
    ok:       <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full"><Check size={9}/>تعمل</span>,
    warning:  <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/15 px-2 py-0.5 rounded-full"><AlertCircle size={9}/>جزئياً</span>,
    error:    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full"><X size={9}/>لا تعمل</span>,
  };
  return map[status] || <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-500/15 px-2 py-0.5 rounded-full"><Activity size={9}/>لم يُفحص</span>;
};

const FeatureControlPanel = ({ language = 'ar', t }) => {
  const tr = t || ((ar, en) => language === 'ar' ? ar : en);
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [expanded, setExpanded] = useState(['core']);
  const [live, setLive] = useState({});
  const [checkingId, setCheckingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('settings').select('*').like('key', 'feature_%');
      const obj = {};
      (data || []).forEach(s => {
        const id = s.key.replace('feature_', '');
        try { obj[id] = typeof s.value === 'object' ? s.value : JSON.parse(s.value); }
        catch { obj[id] = { is_active: true, is_hidden: false }; }
      });
      SYSTEM_FEATURES.forEach(f => { if (!obj[f.id]) obj[f.id] = { is_active: true, is_hidden: false }; });
      setFeatures(obj);
    } finally { setLoading(false); }
  };

  // حفظ فوري مستقل لكل ميزة
  const save = useCallback(async (featureId, newState) => {
    setSavingId(featureId);
    try {
      await supabase.from('settings').upsert(
        { key: `feature_${featureId}`, value: JSON.stringify(newState), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      showToast(tr('تم الحفظ', 'Saved'));
    } catch { showToast(tr('خطأ في الحفظ', 'Save error'), 'error'); }
    finally { setSavingId(null); }
  }, [tr]);

  const toggleActive = useCallback(async (id) => {
    const ns = { ...features[id], is_active: !features[id]?.is_active };
    setFeatures(p => ({ ...p, [id]: ns }));
    await save(id, ns);
  }, [features, save]);

  const toggleHidden = useCallback(async (id) => {
    const ns = { ...features[id], is_hidden: !features[id]?.is_hidden };
    setFeatures(p => ({ ...p, [id]: ns }));
    await save(id, ns);
  }, [features, save]);

  const checkOne = useCallback(async (f) => {
    setCheckingId(f.id);
    setLive(p => ({ ...p, [f.id]: { status: 'checking', detail: '' } }));
    try {
      const detail = await f.checkFn();
      setLive(p => ({ ...p, [f.id]: { status: 'ok', detail } }));
    } catch (e) {
      setLive(p => ({ ...p, [f.id]: { status: 'error', detail: e.message } }));
    }
    setCheckingId(null);
  }, []);

  const checkAll = useCallback(async () => {
    for (const f of SYSTEM_FEATURES) await checkOne(f);
  }, [checkOne]);

  const toggleCat = (id) => setExpanded(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-[#C9A54C]" size={28}/></div>;

  const sc = Object.values(live).reduce((a, s) => { a[s.status] = (a[s.status]||0)+1; return a; }, {});

  return (
    <div className="space-y-5">
      {/* رأس */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2"><Settings className="text-[#C9A54C]" size={20}/>{tr('التحكم بالميزات','Feature Control')}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{tr('كل تغيير يُحفظ فوراً بشكل مستقل','Each change saves instantly and independently')}</p>
        </div>
        <button onClick={checkAll} disabled={!!checkingId} className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-all flex items-center gap-2 text-sm disabled:opacity-50">
          {checkingId ? <RefreshCw size={15} className="animate-spin"/> : <Activity size={15}/>}
          {tr('فحص الكل','Check All')}
        </button>
      </div>

      {/* ملخص الحالة */}
      {Object.keys(live).length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5 text-center"><div className="text-xl font-black text-green-400">{sc.ok||0}</div><div className="text-xs text-green-400/70">{tr('تعمل','Working')}</div></div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2.5 text-center"><div className="text-xl font-black text-yellow-400">{sc.warning||0}</div><div className="text-xs text-yellow-400/70">{tr('جزئياً','Partial')}</div></div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center"><div className="text-xl font-black text-red-400">{sc.error||0}</div><div className="text-xs text-red-400/70">{tr('لا تعمل','Failed')}</div></div>
        </div>
      )}

      {/* الفئات */}
      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const catF = SYSTEM_FEATURES.filter(f => f.category === cat.id);
          if (!catF.length) return null;
          const isExp = expanded.includes(cat.id);
          const activeN = catF.filter(f => features[f.id]?.is_active !== false).length;
          return (
            <div key={cat.id} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <button onClick={() => toggleCat(cat.id)} className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-all">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{language==='ar'?cat.name:cat.nameEn}</span>
                  <span className="text-xs bg-[#C9A54C]/20 text-[#C9A54C] px-2 py-0.5 rounded-full">{activeN}/{catF.length}</span>
                </div>
                {isExp ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
              </button>
              {isExp && (
                <div className="divide-y divide-white/5 border-t border-white/10">
                  {catF.map(f => {
                    const Icon = f.icon;
                    const fs = features[f.id] || { is_active: true, is_hidden: false };
                    const lv = live[f.id];
                    const isSav = savingId === f.id;
                    const isChk = checkingId === f.id;
                    return (
                      <div key={f.id} className={`p-3.5 ${!fs.is_active ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          {/* معلومات */}
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${fs.is_active ? 'bg-[#C9A54C]/20 text-[#C9A54C]' : 'bg-white/10 text-gray-500'}`}>
                              <Icon size={16}/>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                <span className="font-semibold text-sm">{language==='ar'?f.name:f.nameEn}</span>
                                <Badge status={lv?.status}/>
                                {!fs.is_active && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">{tr('معطّل','Off')}</span>}
                                {fs.is_hidden && <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{tr('مخفي','Hidden')}</span>}
                              </div>
                              <p className="text-xs text-gray-400">{language==='ar'?f.description:f.descriptionEn}</p>
                              {lv?.detail && <p className={`text-xs mt-0.5 ${lv.status==='ok'?'text-green-400/70':lv.status==='error'?'text-red-400/70':'text-yellow-400/70'}`}>↳ {lv.detail}</p>}
                              {f.patientEffect && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Users size={9}/>{f.patientEffect}</p>}
                            </div>
                          </div>
                          {/* أزرار */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* فحص */}
                            <button onClick={() => checkOne(f)} disabled={isChk} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50" title={tr('فحص','Check')}>
                              {isChk ? <RefreshCw size={13} className="animate-spin"/> : <Activity size={13}/>}
                            </button>
                            {/* إخفاء */}
                            <button onClick={() => toggleHidden(f.id)} disabled={isSav} className={`p-1.5 rounded-lg transition-all ${fs.is_hidden?'bg-orange-500/20 text-orange-400':'bg-white/10 text-gray-400 hover:text-white'}`} title={fs.is_hidden?tr('إظهار','Show'):tr('إخفاء','Hide')}>
                              {fs.is_hidden ? <EyeOff size={13}/> : <Eye size={13}/>}
                            </button>
                            {/* تشغيل/إيقاف */}
                            <button onClick={() => toggleActive(f.id)} disabled={isSav} className={`relative w-11 h-6 rounded-full transition-all ${fs.is_active?'bg-green-500':'bg-white/20'} disabled:opacity-50`} title={fs.is_active?tr('إيقاف','Disable'):tr('تشغيل','Enable')}>
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all flex items-center justify-center ${fs.is_active?'left-[22px]':'left-0.5'}`}>
                                {isSav ? <RefreshCw size={9} className="animate-spin text-gray-400"/> : fs.is_active ? <Check size={9} className="text-green-500"/> : <X size={9} className="text-gray-400"/>}
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
        <p className="text-xs text-blue-400"><AlertCircle className="inline ml-1" size={13}/>{tr('كل تغيير يُحفظ فوراً بشكل مستقل. الإيقاف لا يحذف البيانات.','Each change saves instantly. Disabling does not delete data.')}</p>
      </div>

      {toast && (
        <div className={`fixed top-4 right-4 z-[120] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm text-white ${toast.type==='error'?'bg-red-700':'bg-green-700'}`}>
          {toast.type==='error'?<X size={15}/>:<Check size={15}/>}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default FeatureControlPanel;
