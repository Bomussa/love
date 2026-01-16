import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Users, Clock, CheckCircle, Activity, 
  Settings, FileText, MapPin, Key, RefreshCw, Trash2, 
  Edit, Plus, LogOut, Home, AlertCircle, ChevronRight,
  Search, Filter, Download, MoreVertical, Shield, Play,
  Pause, SkipForward, Phone, Bell, BarChart3, Calendar,
  UserCheck, XCircle, Eye, Printer, Menu, X, TrendingUp,
  UserPlus, Lock, Unlock, Building, Stethoscope, ClipboardList,
  PieChart, ArrowUp, ArrowDown, Timer, Target, Award, Zap
} from 'lucide-react';
import supabase from '../lib/supabase-client';

// ==================== الألوان الرسمية ====================
const COLORS = {
  maroon: '#8A1538',
  maroonDark: '#6B0F2A',
  gold: '#C9A54C',
  goldLight: '#D4AF37',
  white: '#FFFFFF',
  black: '#000000',
  bgDark: '#0b0b0f',
  bgCard: '#12121a',
};

// ==================== مكون الشعار الرسمي ====================
const OfficialHeader = ({ size = 'md', showText = true, className = '' }) => {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };
  
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <img 
        src="/mms-logo.png" 
        alt="قيادة الخدمات الطبية" 
        className={`${sizes[size]} object-contain rounded-full border-2 border-[${COLORS.gold}]/30 shadow-lg`}
      />
      {showText && (
        <div className="text-right">
          <h1 className="text-xl font-bold text-white">اللجنة الطبية العسكرية</h1>
          <p className="text-sm text-[#C9A54C]">قيادة الخدمات الطبية العسكرية</p>
          <p className="text-xs text-gray-400">المركز الطبي التخصصي العسكري - العطار</p>
        </div>
      )}
    </div>
  );
};

// ==================== مكون البطاقة الإحصائية ====================
const StatCard = ({ icon: Icon, label, value, subValue, trend, color = 'gold', onClick }) => {
  const colorClasses = {
    gold: 'from-[#C9A54C]/20 to-[#C9A54C]/5 border-[#C9A54C]/30 text-[#C9A54C]',
    maroon: 'from-[#8A1538]/20 to-[#8A1538]/5 border-[#8A1538]/30 text-[#8A1538]',
    green: 'from-green-500/20 to-green-500/5 border-green-500/30 text-green-400',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400',
  };

  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden bg-gradient-to-br ${colorClasses[color]} 
        rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl
        ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{label}</p>
          <h3 className="text-3xl font-bold text-white">{value}</h3>
          {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          <span>{Math.abs(trend)}% من الأمس</span>
        </div>
      )}
      {/* تأثير بصري */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5 blur-2xl" />
    </div>
  );
};

// ==================== مكون إدارة الطوابير ====================
const QueueManagement = ({ language, t }) => {
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [queuesRes, clinicsRes] = await Promise.all([
        supabase.from('queues').select('*, clinics(name_ar, name_en)').order('created_at', { ascending: false }),
        supabase.from('clinics').select('*').order('name_ar')
      ]);
      
      if (queuesRes.data) setQueues(queuesRes.data);
      if (clinicsRes.data) setClinics(clinicsRes.data);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const callNext = async (clinicId) => {
    const waiting = queues.filter(q => q.clinic_id === clinicId && q.status === 'waiting');
    if (waiting.length === 0) {
      alert(t('لا يوجد مرضى في الانتظار', 'No patients waiting'));
      return;
    }
    await supabase.from('queues').update({ status: 'called', called_at: new Date().toISOString() }).eq('id', waiting[0].id);
    loadData();
  };

  const completePatient = async (queueId) => {
    await supabase.from('queues').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', queueId);
    loadData();
  };

  const skipPatient = async (queueId) => {
    await supabase.from('queues').update({ status: 'skipped' }).eq('id', queueId);
    loadData();
  };

  const queuesByClinic = clinics.map(clinic => ({
    ...clinic,
    waiting: queues.filter(q => q.clinic_id === clinic.id && q.status === 'waiting'),
    called: queues.filter(q => q.clinic_id === clinic.id && q.status === 'called'),
    completed: queues.filter(q => q.clinic_id === clinic.id && q.status === 'completed').length
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Users className="text-[#C9A54C]" />
          {t('إدارة الطوابير', 'Queue Management')}
        </h3>
        <button onClick={loadData} className="p-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queuesByClinic.map(clinic => (
          <div key={clinic.id} className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-[#C9A54C]/20 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-[#C9A54C]/20 to-transparent border-b border-[#C9A54C]/20">
              <h4 className="font-bold text-lg">{language === 'ar' ? clinic.name_ar : clinic.name_en}</h4>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-yellow-400">انتظار: {clinic.waiting.length}</span>
                <span className="text-green-400">مكتمل: {clinic.completed}</span>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              {clinic.called.length > 0 && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 animate-pulse">
                  <div className="text-xs text-green-400 mb-1">يُستدعى الآن</div>
                  <div className="text-2xl font-bold text-green-400">
                    {clinic.called[0]?.display_number || clinic.called[0]?.queue_number}
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <button onClick={() => callNext(clinic.id)} className="flex-1 py-2 bg-[#C9A54C] text-black rounded-lg font-medium hover:bg-[#B8943D] transition-all flex items-center justify-center gap-2">
                  <Play size={16} /> التالي
                </button>
                {clinic.called.length > 0 && (
                  <>
                    <button onClick={() => completePatient(clinic.called[0].id)} className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">
                      <CheckCircle size={20} />
                    </button>
                    <button onClick={() => skipPatient(clinic.called[0].id)} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
                      <SkipForward size={20} />
                    </button>
                  </>
                )}
              </div>

              {clinic.waiting.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-400 mb-2">قائمة الانتظار</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {clinic.waiting.slice(0, 5).map((q, i) => (
                      <div key={q.id} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                        <span className="font-mono">{q.display_number || q.queue_number}</span>
                        <span className="text-gray-400">#{i + 1}</span>
                      </div>
                    ))}
                    {clinic.waiting.length > 5 && (
                      <div className="text-xs text-gray-500 text-center py-1">+{clinic.waiting.length - 5} آخرين</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== مكون إدارة المستخدمين والصلاحيات ====================
const UsersManagement = ({ language, t }) => {
  const [users, setUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer', name: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false });
      if (!error && data) setUsers(data);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.name) {
      alert(t('يرجى ملء جميع الحقول', 'Please fill all fields'));
      return;
    }
    try {
      await supabase.from('admin_users').insert([{
        username: newUser.username,
        password: newUser.password, // في الإنتاج يجب تشفير كلمة المرور
        role: newUser.role,
        name: newUser.name,
        is_active: true
      }]);
      setNewUser({ username: '', password: '', role: 'viewer', name: '' });
      setShowAddForm(false);
      loadUsers();
    } catch (e) {
      console.error('Error:', e);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    await supabase.from('admin_users').update({ is_active: !currentStatus }).eq('id', userId);
    loadUsers();
  };

  const deleteUser = async (userId) => {
    if (!window.confirm(t('هل أنت متأكد من حذف هذا المستخدم؟', 'Are you sure you want to delete this user?'))) return;
    await supabase.from('admin_users').delete().eq('id', userId);
    loadUsers();
  };

  const roles = [
    { value: 'admin', label: t('مدير النظام', 'System Admin'), color: 'text-red-400' },
    { value: 'supervisor', label: t('مشرف', 'Supervisor'), color: 'text-yellow-400' },
    { value: 'operator', label: t('مشغل', 'Operator'), color: 'text-blue-400' },
    { value: 'viewer', label: t('مشاهد', 'Viewer'), color: 'text-gray-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Shield className="text-[#C9A54C]" />
          {t('إدارة المستخدمين والصلاحيات', 'Users & Permissions')}
        </h3>
        <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2">
          <UserPlus size={18} />
          {t('إضافة مستخدم', 'Add User')}
        </button>
      </div>

      {/* نموذج إضافة مستخدم */}
      {showAddForm && (
        <div className="bg-[#12121a] rounded-2xl border border-[#C9A54C]/20 p-6">
          <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
            <UserPlus className="text-[#C9A54C]" />
            {t('إضافة مستخدم جديد', 'Add New User')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder={t('الاسم الكامل', 'Full Name')}
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#C9A54C] outline-none"
            />
            <input
              type="text"
              placeholder={t('اسم المستخدم', 'Username')}
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#C9A54C] outline-none"
            />
            <input
              type="password"
              placeholder={t('كلمة المرور', 'Password')}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#C9A54C] outline-none"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#C9A54C] outline-none"
            >
              {roles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addUser} className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all">
              {t('حفظ', 'Save')}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* جدول المستخدمين */}
      <div className="bg-[#12121a] rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#8A1538]/30">
            <tr>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">{t('الاسم', 'Name')}</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">{t('اسم المستخدم', 'Username')}</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">{t('الصلاحية', 'Role')}</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">{t('الحالة', 'Status')}</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">{t('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium">{user.name}</td>
                <td className="px-6 py-4 text-gray-400">{user.username}</td>
                <td className="px-6 py-4">
                  <span className={`${roles.find(r => r.value === user.role)?.color || 'text-gray-400'}`}>
                    {roles.find(r => r.value === user.role)?.label || user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs ${user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {user.is_active ? t('نشط', 'Active') : t('معطل', 'Disabled')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => toggleUserStatus(user.id, user.is_active)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      {user.is_active ? <Lock size={16} className="text-yellow-400" /> : <Unlock size={16} className="text-green-400" />}
                    </button>
                    <button onClick={() => deleteUser(user.id)} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors">
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {t('لا يوجد مستخدمين', 'No users found')}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== مكون التقارير الشاملة ====================
const ComprehensiveReports = ({ language, t }) => {
  const [stats, setStats] = useState({
    today: { total: 0, completed: 0, waiting: 0, avgWait: 0 },
    week: { total: 0, completed: 0, waiting: 0, avgWait: 0 },
    month: { total: 0, completed: 0, waiting: 0, avgWait: 0 },
    byClinic: [],
    byGender: { male: 0, female: 0 },
    byExamType: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const printRef = useRef();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const today = new Date(now.setHours(0, 0, 0, 0));
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // جلب جميع البيانات
      const { data: allQueues } = await supabase.from('queues').select('*, clinics(name_ar, name_en), patients(gender, exam_type)');
      const { data: clinics } = await supabase.from('clinics').select('*');

      if (allQueues) {
        const todayQueues = allQueues.filter(q => new Date(q.created_at) >= today);
        const weekQueues = allQueues.filter(q => new Date(q.created_at) >= weekAgo);
        const monthQueues = allQueues.filter(q => new Date(q.created_at) >= monthAgo);

        const calcStats = (data) => ({
          total: data.length,
          completed: data.filter(q => q.status === 'completed').length,
          waiting: data.filter(q => q.status === 'waiting').length,
          avgWait: data.filter(q => q.called_at && q.created_at).reduce((acc, q) => 
            acc + (new Date(q.called_at) - new Date(q.created_at)), 0) / (data.filter(q => q.called_at).length || 1) / 60000
        });

        // إحصائيات حسب العيادة
        const byClinic = clinics?.map(clinic => ({
          name: language === 'ar' ? clinic.name_ar : clinic.name_en,
          total: allQueues.filter(q => q.clinic_id === clinic.id).length,
          completed: allQueues.filter(q => q.clinic_id === clinic.id && q.status === 'completed').length,
          waiting: allQueues.filter(q => q.clinic_id === clinic.id && q.status === 'waiting').length
        })) || [];

        // إحصائيات حسب الجنس
        const byGender = {
          male: allQueues.filter(q => q.patients?.gender === 'male').length,
          female: allQueues.filter(q => q.patients?.gender === 'female').length
        };

        setStats({
          today: calcStats(todayQueues),
          week: calcStats(weekQueues),
          month: calcStats(monthQueues),
          byClinic,
          byGender,
          byExamType: []
        });
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    const printContent = document.getElementById('print-report');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>تقرير اللجنة الطبية العسكرية</title>
        <style>
          body { font-family: 'Cairo', 'Tajawal', Arial, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #8A1538; padding-bottom: 20px; }
          .header img { width: 100px; height: 100px; }
          .header h1 { color: #8A1538; margin: 10px 0 5px; }
          .header h2 { color: #C9A54C; margin: 5px 0; font-size: 16px; }
          .header p { color: #666; font-size: 14px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .stat-box { border: 2px solid #8A1538; border-radius: 10px; padding: 15px; text-align: center; }
          .stat-box h3 { color: #8A1538; font-size: 24px; margin: 0; }
          .stat-box p { color: #666; margin: 5px 0 0; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
          th { background: #8A1538; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #C9A54C; color: #666; font-size: 12px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/mms-logo.png" alt="شعار قيادة الخدمات الطبية" />
          <h1>اللجنة الطبية العسكرية</h1>
          <h2>قيادة الخدمات الطبية العسكرية</h2>
          <p>المركز الطبي التخصصي العسكري - العطار</p>
          <p>تقرير بتاريخ: ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        
        <h3 style="color: #8A1538;">إحصائيات اليوم</h3>
        <div class="stats-grid">
          <div class="stat-box"><h3>${stats.today.total}</h3><p>إجمالي المرضى</p></div>
          <div class="stat-box"><h3>${stats.today.completed}</h3><p>المكتملين</p></div>
          <div class="stat-box"><h3>${stats.today.waiting}</h3><p>في الانتظار</p></div>
          <div class="stat-box"><h3>${Math.round(stats.today.avgWait)}</h3><p>متوسط الانتظار (دقيقة)</p></div>
        </div>

        <h3 style="color: #8A1538;">إحصائيات حسب العيادة</h3>
        <table>
          <thead>
            <tr><th>العيادة</th><th>الإجمالي</th><th>المكتملين</th><th>في الانتظار</th></tr>
          </thead>
          <tbody>
            ${stats.byClinic.map(c => `<tr><td>${c.name}</td><td>${c.total}</td><td>${c.completed}</td><td>${c.waiting}</td></tr>`).join('')}
          </tbody>
        </table>

        <h3 style="color: #8A1538;">إحصائيات حسب الجنس</h3>
        <table>
          <thead><tr><th>الجنس</th><th>العدد</th></tr></thead>
          <tbody>
            <tr><td>ذكور</td><td>${stats.byGender.male}</td></tr>
            <tr><td>إناث</td><td>${stats.byGender.female}</td></tr>
          </tbody>
        </table>

        <div class="footer">
          <p>تم إنشاء هذا التقرير آلياً من نظام اللجنة الطبية العسكرية</p>
          <p>© ${new Date().getFullYear()} قيادة الخدمات الطبية العسكرية - جميع الحقوق محفوظة</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const exportToExcel = () => {
    // تصدير CSV
    let csv = 'العيادة,الإجمالي,المكتملين,في الانتظار\n';
    stats.byClinic.forEach(c => {
      csv += `${c.name},${c.total},${c.completed},${c.waiting}\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const periods = [
    { id: 'today', label: t('اليوم', 'Today') },
    { id: 'week', label: t('الأسبوع', 'Week') },
    { id: 'month', label: t('الشهر', 'Month') },
  ];

  const currentStats = stats[selectedPeriod] || stats.today;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="text-[#C9A54C]" />
          {t('التقارير والإحصائيات الشاملة', 'Comprehensive Reports')}
        </h3>
        <div className="flex gap-3">
          <div className="flex bg-white/5 rounded-xl p-1">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-4 py-2 rounded-lg transition-all ${selectedPeriod === p.id ? 'bg-[#C9A54C] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={printReport} className="px-4 py-2 bg-[#8A1538] text-white rounded-xl hover:bg-[#6B0F2A] transition-all flex items-center gap-2">
            <Printer size={18} />
            {t('طباعة', 'Print')}
          </button>
          <button onClick={exportToExcel} className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2">
            <Download size={18} />
            {t('تصدير', 'Export')}
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t('إجمالي المرضى', 'Total Patients')} value={currentStats.total} color="gold" />
        <StatCard icon={CheckCircle} label={t('المكتملين', 'Completed')} value={currentStats.completed} color="green" />
        <StatCard icon={Clock} label={t('في الانتظار', 'Waiting')} value={currentStats.waiting} color="yellow" />
        <StatCard icon={Timer} label={t('متوسط الانتظار', 'Avg Wait')} value={`${Math.round(currentStats.avgWait)} د`} color="blue" />
      </div>

      {/* إحصائيات حسب العيادة */}
      <div className="bg-[#12121a] rounded-2xl border border-white/5 p-6">
        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Building className="text-[#C9A54C]" />
          {t('إحصائيات حسب العيادة', 'Statistics by Clinic')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.byClinic.map((clinic, i) => (
            <div key={i} className="bg-gradient-to-br from-[#8A1538]/20 to-transparent rounded-xl border border-[#8A1538]/20 p-4">
              <h5 className="font-bold text-[#C9A54C] mb-3">{clinic.name}</h5>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold">{clinic.total}</div>
                  <div className="text-xs text-gray-500">إجمالي</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{clinic.completed}</div>
                  <div className="text-xs text-gray-500">مكتمل</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{clinic.waiting}</div>
                  <div className="text-xs text-gray-500">انتظار</div>
                </div>
              </div>
              {/* شريط التقدم */}
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#C9A54C] to-[#8A1538]"
                  style={{ width: `${clinic.total > 0 ? (clinic.completed / clinic.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* إحصائيات حسب الجنس */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#12121a] rounded-2xl border border-white/5 p-6">
          <h4 className="text-lg font-bold mb-4">{t('توزيع حسب الجنس', 'Distribution by Gender')}</h4>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                <span className="text-3xl">👨</span>
              </div>
              <div className="text-2xl font-bold">{stats.byGender.male}</div>
              <div className="text-sm text-gray-500">{t('ذكور', 'Male')}</div>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-pink-500/20 flex items-center justify-center mb-2">
                <span className="text-3xl">👩</span>
              </div>
              <div className="text-2xl font-bold">{stats.byGender.female}</div>
              <div className="text-sm text-gray-500">{t('إناث', 'Female')}</div>
            </div>
          </div>
        </div>

        <div className="bg-[#12121a] rounded-2xl border border-white/5 p-6">
          <h4 className="text-lg font-bold mb-4">{t('نسبة الإنجاز', 'Completion Rate')}</h4>
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#1a1a2e" strokeWidth="12" fill="none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  stroke="#C9A54C" 
                  strokeWidth="12" 
                  fill="none"
                  strokeDasharray={`${(currentStats.total > 0 ? currentStats.completed / currentStats.total : 0) * 352} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">
                  {currentStats.total > 0 ? Math.round((currentStats.completed / currentStats.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== مكون الإعدادات ====================
const SystemSettings = ({ language, t }) => {
  const [settings, setSettings] = useState({
    queueInterval: 120,
    maxWaitTime: 300,
    autoCallEnabled: true,
    soundEnabled: true,
    notificationsEnabled: true
  });

  useEffect(() => {
    const saved = localStorage.getItem('systemSettings');
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  const saveSettings = () => {
    localStorage.setItem('systemSettings', JSON.stringify(settings));
    alert(t('تم حفظ الإعدادات', 'Settings saved'));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <Settings className="text-[#C9A54C]" />
        {t('إعدادات النظام', 'System Settings')}
      </h3>

      <div className="bg-[#12121a] rounded-2xl border border-white/5 p-6 space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('فترة استدعاء الطابور (ثانية)', 'Queue Call Interval (seconds)')}</label>
          <input
            type="number"
            value={settings.queueInterval}
            onChange={(e) => setSettings({ ...settings, queueInterval: parseInt(e.target.value) })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#C9A54C] outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('أقصى وقت انتظار (ثانية)', 'Max Wait Time (seconds)')}</label>
          <input
            type="number"
            value={settings.maxWaitTime}
            onChange={(e) => setSettings({ ...settings, maxWaitTime: parseInt(e.target.value) })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#C9A54C] outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <span>{t('تفعيل الاستدعاء التلقائي', 'Enable Auto Call')}</span>
          <button
            onClick={() => setSettings({ ...settings, autoCallEnabled: !settings.autoCallEnabled })}
            className={`w-12 h-6 rounded-full transition-colors ${settings.autoCallEnabled ? 'bg-[#C9A54C]' : 'bg-white/20'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.autoCallEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span>{t('تفعيل الصوت', 'Enable Sound')}</span>
          <button
            onClick={() => setSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
            className={`w-12 h-6 rounded-full transition-colors ${settings.soundEnabled ? 'bg-[#C9A54C]' : 'bg-white/20'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <button onClick={saveSettings} className="w-full py-3 bg-[#C9A54C] text-black rounded-xl font-bold hover:bg-[#B8943D] transition-all">
          {t('حفظ الإعدادات', 'Save Settings')}
        </button>
      </div>
    </div>
  );
};

// ==================== المكون الرئيسي ====================
export const AdminDashboardNew = ({ onLogout, language, toggleLanguage }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    totalPatients: 0,
    waiting: 0,
    completed: 0,
    inProgress: 0,
    avgWaitTime: 0,
    activePins: 0
  });
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const t = (ar, en) => language === 'ar' ? ar : en;

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [queuesRes, pinsRes] = await Promise.all([
        supabase.from('queues').select('*').gte('created_at', today.toISOString()),
        supabase.from('pins').select('*', { count: 'exact', head: true }).eq('is_active', true)
      ]);

      const queues = queuesRes.data || [];
      const waiting = queues.filter(q => q.status === 'waiting').length;
      const completed = queues.filter(q => q.status === 'completed').length;
      const inProgress = queues.filter(q => q.status === 'called').length;

      // حساب متوسط وقت الانتظار
      const completedWithTime = queues.filter(q => q.status === 'completed' && q.called_at && q.created_at);
      const avgWait = completedWithTime.length > 0
        ? completedWithTime.reduce((acc, q) => acc + (new Date(q.called_at) - new Date(q.created_at)), 0) / completedWithTime.length / 60000
        : 0;

      setStats({
        totalPatients: queues.length,
        waiting,
        completed,
        inProgress,
        avgWaitTime: Math.round(avgWait),
        activePins: pinsRes.count || 0
      });
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('لوحة التحكم', 'Dashboard') },
    { id: 'queues', icon: Users, label: t('إدارة الطوابير', 'Queues') },
    { id: 'users', icon: Shield, label: t('المستخدمين والصلاحيات', 'Users & Permissions') },
    { id: 'reports', icon: BarChart3, label: t('التقارير', 'Reports') },
    { id: 'pins', icon: Key, label: t('الأرقام السرية', 'PIN Codes') },
    { id: 'clinics', icon: Building, label: t('العيادات', 'Clinics') },
    { id: 'settings', icon: Settings, label: t('الإعدادات', 'Settings') },
  ];

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white font-sans">
      {/* زر القائمة للموبايل */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-[60] p-3 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-xl border border-[#C9A54C]/30"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* الشريط الجانبي */}
      <aside className={`fixed left-0 top-0 h-full w-72 bg-[#12121a] border-r border-[#C9A54C]/10 z-50 transform transition-transform duration-300 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* الشعار والعنوان */}
        <div className="p-6 border-b border-[#C9A54C]/10">
          <OfficialHeader size="sm" showText={true} />
        </div>

        {/* القائمة */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                activeTab === item.id 
                ? 'bg-gradient-to-r from-[#C9A54C]/20 to-transparent text-[#C9A54C] border border-[#C9A54C]/30' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
              {activeTab === item.id && <ChevronRight size={16} className="mr-auto" />}
            </button>
          ))}
        </nav>

        {/* أزرار الخروج */}
        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-[#C9A54C]/10 space-y-2">
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
          >
            <Home size={20} />
            <span>{t('الرئيسية', 'Home')}</span>
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20"
          >
            <LogOut size={20} />
            <span>{t('تسجيل الخروج', 'Logout')}</span>
          </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="lg:mr-72 p-6 lg:p-8">
        {/* الرأس */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">{menuItems.find(m => m.id === activeTab)?.label}</h2>
            <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleLanguage} className="px-4 py-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
            <button onClick={loadDashboardData} className="p-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* لوحة التحكم الرئيسية */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* البطاقات الإحصائية */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard icon={Users} label={t('إجمالي المرضى', 'Total Patients')} value={stats.totalPatients} color="gold" />
              <StatCard icon={Clock} label={t('في الانتظار', 'Waiting')} value={stats.waiting} color="yellow" />
              <StatCard icon={Activity} label={t('قيد الفحص', 'In Progress')} value={stats.inProgress} color="blue" />
              <StatCard icon={CheckCircle} label={t('المكتملين', 'Completed')} value={stats.completed} color="green" />
              <StatCard icon={Timer} label={t('متوسط الانتظار', 'Avg Wait')} value={`${stats.avgWaitTime} د`} color="purple" />
              <StatCard icon={Key} label={t('أرقام سرية نشطة', 'Active PINs')} value={stats.activePins} color="maroon" />
            </div>

            {/* حالة النظام */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#12121a] rounded-2xl border border-white/5 p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Activity className="text-[#C9A54C]" />
                  {t('حالة النظام', 'System Status')}
                </h3>
                <div className="space-y-4">
                  {[
                    { name: t('قاعدة البيانات', 'Database'), status: 'connected' },
                    { name: t('خدمة الطوابير', 'Queue Service'), status: 'active' },
                    { name: t('خدمة الإشعارات', 'Notifications'), status: 'active' },
                  ].map((service, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <span>{service.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm text-green-400">{t('متصل', 'Connected')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#12121a] rounded-2xl border border-white/5 p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Zap className="text-[#C9A54C]" />
                  {t('إجراءات سريعة', 'Quick Actions')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setActiveTab('queues')} className="p-4 bg-gradient-to-br from-[#8A1538]/20 to-transparent rounded-xl border border-[#8A1538]/20 hover:border-[#C9A54C]/30 transition-all text-right">
                    <Users className="text-[#C9A54C] mb-2" size={24} />
                    <span className="block font-medium">{t('إدارة الطوابير', 'Manage Queues')}</span>
                  </button>
                  <button onClick={() => setActiveTab('reports')} className="p-4 bg-gradient-to-br from-[#8A1538]/20 to-transparent rounded-xl border border-[#8A1538]/20 hover:border-[#C9A54C]/30 transition-all text-right">
                    <BarChart3 className="text-[#C9A54C] mb-2" size={24} />
                    <span className="block font-medium">{t('عرض التقارير', 'View Reports')}</span>
                  </button>
                  <button onClick={() => setActiveTab('users')} className="p-4 bg-gradient-to-br from-[#8A1538]/20 to-transparent rounded-xl border border-[#8A1538]/20 hover:border-[#C9A54C]/30 transition-all text-right">
                    <Shield className="text-[#C9A54C] mb-2" size={24} />
                    <span className="block font-medium">{t('إدارة المستخدمين', 'Manage Users')}</span>
                  </button>
                  <button onClick={() => setActiveTab('settings')} className="p-4 bg-gradient-to-br from-[#8A1538]/20 to-transparent rounded-xl border border-[#8A1538]/20 hover:border-[#C9A54C]/30 transition-all text-right">
                    <Settings className="text-[#C9A54C] mb-2" size={24} />
                    <span className="block font-medium">{t('الإعدادات', 'Settings')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queues' && <QueueManagement language={language} t={t} />}
        {activeTab === 'users' && <UsersManagement language={language} t={t} />}
        {activeTab === 'reports' && <ComprehensiveReports language={language} t={t} />}
        {activeTab === 'settings' && <SystemSettings language={language} t={t} />}
      </main>
    </div>
  );
};

export default AdminDashboardNew;
