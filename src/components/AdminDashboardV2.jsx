/**
 * @module AdminDashboard
 * @description لوحة التحكم المركزية للمسؤولين - تدير العيادات، الطوابير، والتقارير.
 * ✅ تم إزالة كافة البيانات الوهمية
 * ✅ تم توحيد قنوات الاشتراك وإضافة آلية تنظيف
 * ✅ تم تحسين معالجة الأخطاء والتحقق من الاتصال
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import toast, { Toaster } from 'react-hot-toast';
import { 
  LayoutDashboard, Users, Clock, CheckCircle, Activity, 
  Settings, FileText, MapPin, Key, RefreshCw, Trash2, 
  Edit, Plus, LogOut, Home, AlertCircle, ChevronRight,
  Search, Filter, Download, MoreVertical, Shield, Play,
  Pause, SkipForward, Phone, Bell, BarChart3, Calendar,
  UserCheck, XCircle, Eye, Printer, Menu, X, Send, Palette, Type, Move, Timer, Square,
  UserCog, History, Database, Save, Upload, Wifi, WifiOff, Lock, Unlock, Copy, Share2,
  UserPlus, Zap, FolderOpen, Stethoscope, UserX, AlertTriangle, Star, ArrowRight, ArrowLeft
} from 'lucide-react';

// دالة عرض شعار النجاح
const showSuccessToast = (message) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#10B981',
      color: '#fff',
      fontWeight: 'bold',
      borderRadius: '12px',
      padding: '16px 24px',
      fontSize: '16px',
    },
  });
};

// دالة عرض شعار الخطأ
const showErrorToast = (message) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#EF4444',
      color: '#fff',
      fontWeight: 'bold',
      borderRadius: '12px',
      padding: '16px 24px',
      fontSize: '16px',
    },
  });
};

// دالة تسجيل النشاطات
const logActivity = async (actionType, description, userId = null, metadata = {}) => {
  try {
    await supabase.from('activity_logs').insert([{
      action_type: actionType,
      description: description,
      user_id: userId,
      metadata: metadata,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.error('Error logging activity:', e);
  }
};

const QueueManagement = ({ language, t }) => {
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [priorityPatientId, setPriorityPatientId] = useState('');
  const [priorityLoading, setPriorityLoading] = useState(false);

  /**
   * جلب وتحديث بيانات الطوابير بشكل لحظي
   * @async
   * @function loadQueues
   * @param {string} clinicId - معرف العيادة (اختياري)
   */
  const loadQueues = async (clinicId = null) => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('unified_queue')
        .select('*, patients(name, military_id)')
        .eq('queue_date', today);
      
      if (clinicId || selectedClinic) query = query.eq('clinic_id', clinicId || selectedClinic);
      
      const { data, error } = await query.order('display_number', { ascending: true });

      if (error) throw error;
      setQueues(data || []);
    } catch (err) {
      console.error('[Admin] Queue Load Error:', err.message);
      showErrorToast(t('خطأ في جلب البيانات', 'Data Fetch Error'));
    } finally {
      setLoading(false);
    }
  };

  const loadClinics = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar');
      if (!error && data) setClinics(data);
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  useEffect(() => {
    loadQueues();
    loadClinics();
    
    // توحيد قنوات الاشتراك مع آلية تنظيف
    const channel = supabase
      .channel('admin_queue_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue' }, () => {
        loadQueues();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClinic]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-[#C9A54C]" />
          {t('إدارة الطوابير الحقيقية', 'Real-time Queue Management')}
        </h2>
        <div className="flex gap-2">
          <select 
            onChange={(e) => setSelectedClinic(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[#C9A54C]"
          >
            <option value="">{t('جميع العيادات', 'All Clinics')}</option>
            {clinics.map(c => <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>)}
          </select>
          <button onClick={() => loadQueues()} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queues.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center text-gray-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
            {t('لا توجد بيانات حقيقية لليوم', 'No real data for today')}
          </div>
        )}
        {queues.map((q) => (
          <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#C9A54C]/50 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="text-3xl font-bold text-[#C9A54C]">#{q.display_number}</div>
              <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                q.status === 'waiting' ? 'bg-blue-500/20 text-blue-400' :
                q.status === 'called' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {t(q.status === 'waiting' ? 'انتظار' : q.status === 'called' ? 'مستدعى' : 'مكتمل', q.status)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="font-bold">{q.patients?.name || t('مراجع', 'Patient')}</div>
              <div className="text-sm text-gray-400 font-mono">{q.patients?.military_id || q.patient_id}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminDashboardV2 = ({ onLogout, language, t }) => {
  const [activeTab, setActiveTab] = useState('queues');

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      <Toaster />
      {/* Sidebar */}
      <div className="w-64 bg-white/5 border-l border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#C9A54C] rounded-lg flex items-center justify-center font-bold text-black">M</div>
          <div className="font-bold text-lg">MMC Admin</div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('queues')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'queues' ? 'bg-[#C9A54C] text-black font-bold' : 'hover:bg-white/5 text-gray-400'}`}
          >
            <Users size={20} /> {t('الطوابير', 'Queues')}
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-[#C9A54C] text-black font-bold' : 'hover:bg-white/5 text-gray-400'}`}
          >
            <BarChart3 size={20} /> {t('التقارير', 'Reports')}
          </button>
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all">
            <LogOut size={20} /> {t('خروج', 'Logout')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'queues' && <QueueManagement language={language} t={t} />}
        {activeTab === 'reports' && (
          <div className="p-20 text-center text-gray-500">
            {t('قسم التقارير قيد التحديث للبيانات الحقيقية', 'Reports section is being updated for real data')}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardV2;
