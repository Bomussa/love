import { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, Users, Clock, CheckCircle, Activity, 
  Settings, FileText, Key, RefreshCw, Trash2, 
  Edit, Plus, LogOut, AlertCircle, ChevronRight,
  Search, Download, Shield, Play, Bell, BarChart3, Calendar,
  UserCheck, XCircle, Eye, Printer, Menu, X, TrendingUp,
  UserPlus, Lock, Unlock, Building, Stethoscope, 
  PieChart, ArrowUp, ArrowDown, Timer, Save, ChevronDown,
  EyeOff, ToggleLeft, ToggleRight, Volume2, VolumeX, Undo2
} from 'lucide-react';

// ==================== API Configuration ====================
const API_BASE = 'https://love-api-bomussa.vercel.app/api/v1';

const api = {
  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'API Error');
    return data.data;
  },
  async post(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'API Error');
    return data.data;
  },
  async patch(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'API Error');
    return data.data;
  },
  async delete(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'API Error');
    return data.data;
  }
};

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

// ==================== الترجمة ====================
const translations = {
  ar: {
    dashboard: 'لوحة التحكم',
    queues: 'إدارة الطوابير',
    users: 'المستخدمين والصلاحيات',
    clinics: 'العيادات',
    pins: 'الأرقام السرية',
    reports: 'التقارير',
    settings: 'الإعدادات',
    notifications: 'الإشعارات',
    logout: 'تسجيل الخروج',
    totalPatients: 'إجمالي المرضى',
    waiting: 'في الانتظار',
    completed: 'مكتمل',
    serving: 'قيد الفحص',
    avgWait: 'متوسط الانتظار',
    today: 'اليوم',
    week: 'الأسبوع',
    month: 'الشهر',
    add: 'إضافة',
    edit: 'تعديل',
    delete: 'حذف',
    save: 'حفظ',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    search: 'بحث',
    filter: 'تصفية',
    export: 'تصدير',
    print: 'طباعة',
    refresh: 'تحديث',
    active: 'نشط',
    inactive: 'غير نشط',
    enable: 'تفعيل',
    disable: 'إلغاء',
    show: 'إظهار',
    hide: 'إخفاء',
    next: 'التالي',
    previous: 'السابق',
    noData: 'لا توجد بيانات',
    loading: 'جاري التحميل...',
    error: 'حدث خطأ',
    success: 'تم بنجاح',
    male: 'ذكور',
    female: 'إناث',
    floor: 'الطابق',
    clinicName: 'اسم العيادة',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    fullName: 'الاسم الكامل',
    role: 'الصلاحية',
    admin: 'مدير النظام',
    supervisor: 'مشرف',
    operator: 'مشغل',
    viewer: 'مشاهد',
    callInterval: 'فترة استدعاء الطابور (ثانية)',
    moveToEnd: 'أقصى وقت انتظار (ثانية)',
    examDuration: 'مدة الفحص (ثانية)',
    autoCall: 'الاستدعاء التلقائي',
    soundEnabled: 'تفعيل الصوت',
    notificationsEnabled: 'تفعيل الإشعارات',
    completionRate: 'نسبة الإنجاز',
    genderDist: 'توزيع حسب الجنس',
    clinicStats: 'إحصائيات حسب العيادة',
    activityLog: 'سجل النشاط',
    undo: 'تراجع',
  },
  en: {
    dashboard: 'Dashboard',
    queues: 'Queue Management',
    users: 'Users & Permissions',
    clinics: 'Clinics',
    pins: 'PIN Codes',
    reports: 'Reports',
    settings: 'Settings',
    notifications: 'Notifications',
    logout: 'Logout',
    totalPatients: 'Total Patients',
    waiting: 'Waiting',
    completed: 'Completed',
    serving: 'Serving',
    avgWait: 'Avg Wait',
    today: 'Today',
    week: 'Week',
    month: 'Month',
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    print: 'Print',
    refresh: 'Refresh',
    active: 'Active',
    inactive: 'Inactive',
    enable: 'Enable',
    disable: 'Disable',
    show: 'Show',
    hide: 'Hide',
    next: 'Next',
    previous: 'Previous',
    noData: 'No data',
    loading: 'Loading...',
    error: 'Error occurred',
    success: 'Success',
    male: 'Male',
    female: 'Female',
    floor: 'Floor',
    clinicName: 'Clinic Name',
    username: 'Username',
    password: 'Password',
    fullName: 'Full Name',
    role: 'Role',
    admin: 'Admin',
    supervisor: 'Supervisor',
    operator: 'Operator',
    viewer: 'Viewer',
    callInterval: 'Call Interval (seconds)',
    moveToEnd: 'Max Wait Time (seconds)',
    examDuration: 'Exam Duration (seconds)',
    autoCall: 'Auto Call',
    soundEnabled: 'Sound Enabled',
    notificationsEnabled: 'Notifications Enabled',
    completionRate: 'Completion Rate',
    genderDist: 'Gender Distribution',
    clinicStats: 'Clinic Statistics',
    activityLog: 'Activity Log',
    undo: 'Undo',
  }
};

// ==================== مكون الشعار الرسمي ====================
const OfficialHeader = ({ className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <img 
      src="/mms-logo.png" 
      alt="قيادة الخدمات الطبية" 
      className="w-12 h-12 object-contain"
    />
    <div className="text-right">
      <h1 className="text-base font-bold text-white leading-tight">اللجنة الطبية العسكرية</h1>
      <p className="text-xs text-[#C9A54C]">المركز الطبي التخصصي العسكري</p>
    </div>
  </div>
);

// ==================== مكون البطاقة الإحصائية ====================
const StatCard = ({ icon: Icon, label, value, subValue, trend, color = 'gold' }) => {
  const colorClasses = {
    gold: 'from-[#C9A54C]/20 to-[#C9A54C]/5 border-[#C9A54C]/30 text-[#C9A54C]',
    green: 'from-green-500/20 to-green-500/5 border-green-500/30 text-green-400',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-xs mb-1">{label}</p>
          <h3 className="text-2xl font-bold text-white">{value}</h3>
          {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  );
};

// ==================== مكون Toggle ====================
const Toggle = ({ enabled, onChange, label }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-gray-300">{label}</span>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-[#C9A54C]' : 'bg-gray-600'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'right-1' : 'left-1'}`} />
    </button>
  </div>
);

// ==================== مكون Modal ====================
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#12121a] rounded-2xl border border-[#C9A54C]/20 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#C9A54C]/20">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// ==================== مكون إدارة الطوابير ====================
const QueueManagement = ({ t, lang }) => {
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [queuesData, clinicsData] = await Promise.all([
        api.get('/admin/queues'),
        api.get('/admin/clinics')
      ]);
      setQueues(queuesData || []);
      setClinics(clinicsData || []);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const callNext = async (clinicId) => {
    try {
      const pins = await api.get('/admin/pins');
      const pin = pins.find(p => p.clinic_id === clinicId)?.pin;
      if (!pin) return alert('لم يتم العثور على PIN');
      await api.post('/queue/next', { clinicId, pin });
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const completePatient = async (queueId) => {
    try {
      await api.patch(`/admin/queues/${queueId}`, { status: 'completed' });
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteQueue = async (queueId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    try {
      await api.delete(`/admin/queues/${queueId}`);
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const moveToEnd = async (queueId, clinicId) => {
    try {
      await api.post('/admin/queues/move-to-end', { queueId, clinicId });
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const filteredQueues = selectedClinic === 'all' 
    ? queues 
    : queues.filter(q => q.clinic_id === selectedClinic);

  const queuesByClinic = clinics.map(clinic => ({
    ...clinic,
    waiting: queues.filter(q => q.clinic_id === clinic.id && q.status === 'waiting'),
    serving: queues.filter(q => q.clinic_id === clinic.id && q.status === 'serving'),
    completed: queues.filter(q => q.clinic_id === clinic.id && q.status === 'completed').length
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="text-[#C9A54C]" size={20} />
          {t.queues}
        </h3>
        <div className="flex items-center gap-2">
          <select 
            value={selectedClinic}
            onChange={(e) => setSelectedClinic(e.target.value)}
            className="bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">جميع العيادات</option>
            {clinics.map(c => (
              <option key={c.id} value={c.id}>{lang === 'ar' ? c.name_ar : c.name_en}</option>
            ))}
          </select>
          <button onClick={loadData} className="p-2 bg-[#C9A54C] text-black rounded-lg hover:bg-[#B8943D]">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* بطاقات العيادات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {queuesByClinic.map(clinic => (
          <div key={clinic.id} className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-xl border border-[#C9A54C]/20 overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-[#C9A54C]/20 to-transparent border-b border-[#C9A54C]/20">
              <h4 className="font-bold text-base">{lang === 'ar' ? clinic.name_ar : clinic.name_en}</h4>
              <p className="text-xs text-gray-400">{lang === 'ar' ? clinic.floor_ar : clinic.floor_en}</p>
              <div className="flex gap-3 mt-1 text-xs">
                <span className="text-yellow-400">{t.waiting}: {clinic.waiting.length}</span>
                <span className="text-green-400">{t.completed}: {clinic.completed}</span>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {clinic.serving.length > 0 && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-2 animate-pulse">
                  <div className="text-xs text-green-400 mb-1">{t.serving}</div>
                  <div className="text-xl font-bold text-green-400">
                    {clinic.serving[0]?.display_number}
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <button 
                  onClick={() => callNext(clinic.id)} 
                  className="flex-1 py-2 bg-[#C9A54C] text-black rounded-lg text-sm font-medium hover:bg-[#B8943D] flex items-center justify-center gap-1"
                >
                  <Play size={14} /> {t.next}
                </button>
                {clinic.serving.length > 0 && (
                  <button 
                    onClick={() => completePatient(clinic.serving[0].id)} 
                    className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                  >
                    <CheckCircle size={18} />
                  </button>
                )}
              </div>

              {clinic.waiting.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-gray-400 mb-1">قائمة الانتظار</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {clinic.waiting.slice(0, 3).map((q, i) => (
                      <div key={q.id} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-2 py-1">
                        <span className="font-mono">{q.display_number}</span>
                        <div className="flex gap-1">
                          <button onClick={() => moveToEnd(q.id, clinic.id)} className="p-1 hover:bg-white/10 rounded" title="نقل لنهاية الدور">
                            <ArrowDown size={12} />
                          </button>
                          <button onClick={() => deleteQueue(q.id)} className="p-1 hover:bg-red-500/20 rounded text-red-400" title="حذف">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {clinic.waiting.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">+{clinic.waiting.length - 3} آخرين</div>
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

// ==================== مكون إدارة المستخدمين ====================
const UsersManagement = ({ t, lang }) => {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', full_name: '', role: 'viewer' });
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/users');
      setUsers(data || []);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const saveUser = async () => {
    if (!formData.username || !formData.full_name) {
      return alert('يرجى ملء جميع الحقول المطلوبة');
    }
    try {
      if (editingUser) {
        await api.patch(`/admin/users/${editingUser.id}`, formData);
      } else {
        if (!formData.password) return alert('كلمة المرور مطلوبة');
        await api.post('/admin/users', formData);
      }
      setShowForm(false);
      setEditingUser(null);
      setFormData({ username: '', password: '', full_name: '', role: 'viewer' });
      loadUsers();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleStatus = async (user) => {
    try {
      await api.patch(`/admin/users/${user.id}`, { is_active: !user.is_active });
      loadUsers();
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      loadUsers();
    } catch (e) {
      alert(e.message);
    }
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({ username: user.username, full_name: user.full_name, role: user.role, password: '' });
    setShowForm(true);
  };

  const roles = [
    { value: 'admin', label: t.admin, color: 'text-red-400' },
    { value: 'supervisor', label: t.supervisor, color: 'text-yellow-400' },
    { value: 'operator', label: t.operator, color: 'text-blue-400' },
    { value: 'viewer', label: t.viewer, color: 'text-gray-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Shield className="text-[#C9A54C]" size={20} />
          {t.users}
        </h3>
        <button 
          onClick={() => { setShowForm(true); setEditingUser(null); setFormData({ username: '', password: '', full_name: '', role: 'viewer' }); }}
          className="px-3 py-2 bg-[#C9A54C] text-black rounded-lg text-sm hover:bg-[#B8943D] flex items-center gap-1"
        >
          <UserPlus size={16} /> {t.add}
        </button>
      </div>

      {/* نموذج الإضافة/التعديل */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingUser ? t.edit : t.add}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.fullName} *</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
              placeholder={t.fullName}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.username} *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
              placeholder={t.username}
              disabled={!!editingUser}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.password} {!editingUser && '*'}</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
              placeholder={editingUser ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية' : t.password}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.role}</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
            >
              {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={saveUser} className="flex-1 py-2 bg-[#C9A54C] text-black rounded-lg text-sm font-medium hover:bg-[#B8943D] flex items-center justify-center gap-1">
              <Save size={16} /> {t.save}
            </button>
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500">
              {t.cancel}
            </button>
          </div>
        </div>
      </Modal>

      {/* جدول المستخدمين */}
      <div className="bg-[#12121a] rounded-xl border border-[#C9A54C]/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#C9A54C]/10 border-b border-[#C9A54C]/20">
              <tr>
                <th className="text-right p-3">{t.fullName}</th>
                <th className="text-right p-3">{t.username}</th>
                <th className="text-right p-3">{t.role}</th>
                <th className="text-center p-3">الحالة</th>
                <th className="text-center p-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center p-4 text-gray-400">{t.loading}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-4 text-gray-400">{t.noData}</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3">{user.full_name}</td>
                  <td className="p-3 font-mono text-xs">{user.username}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${roles.find(r => r.value === user.role)?.color || 'text-gray-400'}`}>
                      {roles.find(r => r.value === user.role)?.label || user.role}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleStatus(user)} className={`p-1 rounded ${user.is_active ? 'text-green-400' : 'text-red-400'}`}>
                      {user.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(user)} className="p-1 hover:bg-white/10 rounded text-blue-400">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => deleteUser(user.id)} className="p-1 hover:bg-white/10 rounded text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==================== مكون إدارة العيادات ====================
const ClinicsManagement = ({ t, lang }) => {
  const [clinics, setClinics] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClinic, setEditingClinic] = useState(null);
  const [formData, setFormData] = useState({ name_ar: '', name_en: '', floor_ar: '', floor_en: '', is_active: true, sort_order: 0 });
  const [loading, setLoading] = useState(true);

  const loadClinics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/clinics');
      setClinics(data || []);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClinics(); }, [loadClinics]);

  const saveClinic = async () => {
    if (!formData.name_ar) return alert('اسم العيادة بالعربية مطلوب');
    try {
      if (editingClinic) {
        await api.patch(`/admin/clinics/${editingClinic.id}`, formData);
      } else {
        await api.post('/admin/clinics', formData);
      }
      setShowForm(false);
      setEditingClinic(null);
      setFormData({ name_ar: '', name_en: '', floor_ar: '', floor_en: '', is_active: true, sort_order: 0 });
      loadClinics();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleStatus = async (clinic) => {
    try {
      await api.patch(`/admin/clinics/${clinic.id}`, { is_active: !clinic.is_active });
      loadClinics();
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteClinic = async (clinicId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه العيادة؟')) return;
    try {
      await api.delete(`/admin/clinics/${clinicId}`);
      loadClinics();
    } catch (e) {
      alert(e.message);
    }
  };

  const openEdit = (clinic) => {
    setEditingClinic(clinic);
    setFormData({ 
      name_ar: clinic.name_ar, 
      name_en: clinic.name_en, 
      floor_ar: clinic.floor_ar, 
      floor_en: clinic.floor_en, 
      is_active: clinic.is_active, 
      sort_order: clinic.sort_order 
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Building className="text-[#C9A54C]" size={20} />
          {t.clinics}
        </h3>
        <button 
          onClick={() => { setShowForm(true); setEditingClinic(null); setFormData({ name_ar: '', name_en: '', floor_ar: '', floor_en: '', is_active: true, sort_order: 0 }); }}
          className="px-3 py-2 bg-[#C9A54C] text-black rounded-lg text-sm hover:bg-[#B8943D] flex items-center gap-1"
        >
          <Plus size={16} /> {t.add}
        </button>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingClinic ? t.edit : t.add}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">الاسم بالعربية *</label>
              <input
                type="text"
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name in English</label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">الطابق بالعربية</label>
              <input
                type="text"
                value={formData.floor_ar}
                onChange={(e) => setFormData({ ...formData, floor_ar: e.target.value })}
                className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
                placeholder="مثال: الدور الأول"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Floor in English</label>
              <input
                type="text"
                value={formData.floor_en}
                onChange={(e) => setFormData({ ...formData, floor_en: e.target.value })}
                className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. First Floor"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">الترتيب</label>
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <Toggle 
            enabled={formData.is_active} 
            onChange={(v) => setFormData({ ...formData, is_active: v })} 
            label="العيادة نشطة"
          />
          <div className="flex gap-2 pt-2">
            <button onClick={saveClinic} className="flex-1 py-2 bg-[#C9A54C] text-black rounded-lg text-sm font-medium hover:bg-[#B8943D] flex items-center justify-center gap-1">
              <Save size={16} /> {t.save}
            </button>
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500">
              {t.cancel}
            </button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          <div className="col-span-full text-center p-4 text-gray-400">{t.loading}</div>
        ) : clinics.length === 0 ? (
          <div className="col-span-full text-center p-4 text-gray-400">{t.noData}</div>
        ) : clinics.map(clinic => (
          <div key={clinic.id} className={`bg-[#12121a] rounded-xl border ${clinic.is_active ? 'border-[#C9A54C]/20' : 'border-red-500/20 opacity-60'} p-4`}>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold">{lang === 'ar' ? clinic.name_ar : clinic.name_en}</h4>
                <p className="text-xs text-gray-400">{lang === 'ar' ? clinic.floor_ar : clinic.floor_en}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleStatus(clinic)} className={`p-1 rounded ${clinic.is_active ? 'text-green-400' : 'text-red-400'}`}>
                  {clinic.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => openEdit(clinic)} className="p-1 hover:bg-white/10 rounded text-blue-400">
                  <Edit size={16} />
                </button>
                <button onClick={() => deleteClinic(clinic.id)} className="p-1 hover:bg-white/10 rounded text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded ${clinic.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {clinic.is_active ? t.active : t.inactive}
              </span>
              <span className="text-gray-500">ترتيب: {clinic.sort_order}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== مكون الأرقام السرية ====================
const PINManagement = ({ t, lang }) => {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPins = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/pins');
      setPins(data || []);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPins(); }, [loadPins]);

  const copyPin = (pin) => {
    navigator.clipboard.writeText(pin);
    alert('تم نسخ الرقم السري');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Key className="text-[#C9A54C]" size={20} />
          {t.pins}
        </h3>
        <button onClick={loadPins} className="p-2 bg-[#C9A54C] text-black rounded-lg hover:bg-[#B8943D]">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-[#12121a] rounded-xl border border-[#C9A54C]/20 p-4">
        <p className="text-xs text-gray-400 mb-3">
          الأرقام السرية تتجدد يومياً تلقائياً. استخدمها لتسجيل دخول العيادات.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-full text-center p-4 text-gray-400">{t.loading}</div>
          ) : pins.length === 0 ? (
            <div className="col-span-full text-center p-4 text-gray-400">{t.noData}</div>
          ) : pins.map(pin => (
            <div key={pin.clinic_id} className="bg-gradient-to-br from-[#8A1538]/30 to-[#6B0F2A]/30 rounded-xl border border-[#C9A54C]/20 p-4">
              <h4 className="font-bold text-sm mb-1">{lang === 'ar' ? pin.clinic_name_ar : pin.clinic_name_en}</h4>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-[#C9A54C]">{pin.pin}</span>
                <button onClick={() => copyPin(pin.pin)} className="p-2 bg-[#C9A54C]/20 text-[#C9A54C] rounded-lg hover:bg-[#C9A54C]/30">
                  نسخ
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">{pin.date}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== مكون التقارير ====================
const ReportsSection = ({ t, lang }) => {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get(`/admin/reports/stats?period=${period}`);
      setStats(data);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const printReport = () => {
    window.print();
  };

  if (loading) return <div className="text-center p-8 text-gray-400">{t.loading}</div>;
  if (!stats) return <div className="text-center p-8 text-gray-400">{t.noData}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="text-[#C9A54C]" size={20} />
          {t.reports}
        </h3>
        <div className="flex items-center gap-2">
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
          >
            <option value="today">{t.today}</option>
            <option value="week">{t.week}</option>
            <option value="month">{t.month}</option>
          </select>
          <button onClick={printReport} className="p-2 bg-[#C9A54C] text-black rounded-lg hover:bg-[#B8943D]">
            <Printer size={18} />
          </button>
          <button onClick={loadStats} className="p-2 bg-[#C9A54C] text-black rounded-lg hover:bg-[#B8943D]">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* البطاقات الإحصائية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label={t.totalPatients} value={stats.summary?.totalPatients || 0} color="gold" />
        <StatCard icon={CheckCircle} label={t.completed} value={stats.summary?.completed || 0} color="green" />
        <StatCard icon={Clock} label={t.waiting} value={stats.summary?.waiting || 0} color="yellow" />
        <StatCard icon={Timer} label={t.avgWait} value={`${stats.summary?.avgWaitMinutes || 0} د`} color="blue" />
      </div>

      {/* نسبة الإنجاز */}
      <div className="bg-[#12121a] rounded-xl border border-[#C9A54C]/20 p-4">
        <h4 className="font-bold mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-[#C9A54C]" />
          {t.completionRate}
        </h4>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-[#C9A54C] to-[#8A1538] h-full transition-all duration-500"
              style={{ width: `${stats.summary?.completionRate || 0}%` }}
            />
          </div>
          <span className="text-xl font-bold text-[#C9A54C]">{stats.summary?.completionRate || 0}%</span>
        </div>
      </div>

      {/* توزيع حسب الجنس */}
      <div className="bg-[#12121a] rounded-xl border border-[#C9A54C]/20 p-4">
        <h4 className="font-bold mb-3 flex items-center gap-2">
          <PieChart size={18} className="text-[#C9A54C]" />
          {t.genderDist}
        </h4>
        <div className="flex items-center justify-around">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400">{stats.genderDistribution?.males || 0}</div>
            <div className="text-xs text-gray-400">{t.male}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-pink-400">{stats.genderDistribution?.females || 0}</div>
            <div className="text-xs text-gray-400">{t.female}</div>
          </div>
        </div>
      </div>

      {/* إحصائيات العيادات */}
      <div className="bg-[#12121a] rounded-xl border border-[#C9A54C]/20 p-4">
        <h4 className="font-bold mb-3 flex items-center gap-2">
          <Stethoscope size={18} className="text-[#C9A54C]" />
          {t.clinicStats}
        </h4>
        <div className="space-y-2">
          {stats.clinicStats?.map(clinic => (
            <div key={clinic.clinic_id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
              <span>{lang === 'ar' ? clinic.clinic_name_ar : clinic.clinic_name_en}</span>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-400">الكل: {clinic.total}</span>
                <span className="text-green-400">مكتمل: {clinic.completed}</span>
                <span className="text-yellow-400">انتظار: {clinic.waiting}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== مكون الإعدادات ====================
const SettingsSection = ({ t }) => {
  const [settings, setSettings] = useState({
    callIntervalSeconds: 120,
    moveToEndSeconds: 240,
    examDurationSeconds: 300,
    autoCallEnabled: false,
    soundEnabled: true,
    notificationsEnabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings');
      setSettings(data);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      await api.patch('/settings', settings);
      alert('تم حفظ الإعدادات بنجاح');
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center p-8 text-gray-400">{t.loading}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Settings className="text-[#C9A54C]" size={20} />
          {t.settings}
        </h3>
      </div>

      <div className="bg-[#12121a] rounded-xl border border-[#C9A54C]/20 p-4 space-y-4">
        <h4 className="font-bold text-sm border-b border-[#C9A54C]/20 pb-2">إعدادات الطابور</h4>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.callInterval}</label>
          <input
            type="number"
            value={settings.callIntervalSeconds}
            onChange={(e) => setSettings({ ...settings, callIntervalSeconds: parseInt(e.target.value) || 120 })}
            className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">كل كم ثانية يتم النداء على الرقم التالي (الافتراضي: 120 = دقيقتين)</p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.moveToEnd}</label>
          <input
            type="number"
            value={settings.moveToEndSeconds}
            onChange={(e) => setSettings({ ...settings, moveToEndSeconds: parseInt(e.target.value) || 240 })}
            className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">بعد كم ثانية يتم نقل المراجع لنهاية الدور إذا لم يدخل (الافتراضي: 240 = 4 دقائق)</p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.examDuration}</label>
          <input
            type="number"
            value={settings.examDurationSeconds}
            onChange={(e) => setSettings({ ...settings, examDurationSeconds: parseInt(e.target.value) || 300 })}
            className="w-full bg-[#1a1a24] border border-[#C9A54C]/30 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">مدة الفحص المتوقعة لكل مراجع (الافتراضي: 300 = 5 دقائق)</p>
        </div>

        <div className="border-t border-[#C9A54C]/20 pt-4">
          <h4 className="font-bold text-sm mb-3">إعدادات عامة</h4>
          <Toggle 
            enabled={settings.autoCallEnabled} 
            onChange={(v) => setSettings({ ...settings, autoCallEnabled: v })} 
            label={t.autoCall}
          />
          <Toggle 
            enabled={settings.soundEnabled} 
            onChange={(v) => setSettings({ ...settings, soundEnabled: v })} 
            label={t.soundEnabled}
          />
          <Toggle 
            enabled={settings.notificationsEnabled} 
            onChange={(v) => setSettings({ ...settings, notificationsEnabled: v })} 
            label={t.notificationsEnabled}
          />
        </div>

        <button 
          onClick={saveSettings}
          disabled={saving}
          className="w-full py-3 bg-[#C9A54C] text-black rounded-lg font-medium hover:bg-[#B8943D] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={18} />
          {saving ? 'جاري الحفظ...' : t.save}
        </button>
      </div>
    </div>
  );
};

// ==================== المكون الرئيسي ====================
const AdminDashboardComplete = () => {
  const [language, setLanguage] = useState('ar');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const t = translations[language];

  const loadDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/reports/stats?period=today');
      setStats(data);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardStats();
      const interval = setInterval(loadDashboardStats, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadDashboardStats]);

  const handleLogout = () => {
    if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      localStorage.removeItem('adminUser');
      window.location.href = '/admin';
    }
  };

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard },
    { id: 'queues', icon: Users, label: t.queues },
    { id: 'users', icon: Shield, label: t.users },
    { id: 'clinics', icon: Building, label: t.clinics },
    { id: 'pins', icon: Key, label: t.pins },
    { id: 'reports', icon: BarChart3, label: t.reports },
    { id: 'settings', icon: Settings, label: t.settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Users} label={t.totalPatients} value={stats?.summary?.totalPatients || 0} color="gold" />
              <StatCard icon={CheckCircle} label={t.completed} value={stats?.summary?.completed || 0} color="green" />
              <StatCard icon={Clock} label={t.waiting} value={stats?.summary?.waiting || 0} color="yellow" />
              <StatCard icon={Timer} label={t.avgWait} value={`${stats?.summary?.avgWaitMinutes || 0} د`} color="blue" />
            </div>
            <QueueManagement t={t} lang={language} />
          </div>
        );
      case 'queues':
        return <QueueManagement t={t} lang={language} />;
      case 'users':
        return <UsersManagement t={t} lang={language} />;
      case 'clinics':
        return <ClinicsManagement t={t} lang={language} />;
      case 'pins':
        return <PINManagement t={t} lang={language} />;
      case 'reports':
        return <ReportsSection t={t} lang={language} />;
      case 'settings':
        return <SettingsSection t={t} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b0b0f] via-[#12121a] to-[#0b0b0f] text-white" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#8A1538] to-[#6B0F2A] border-b border-[#C9A54C]/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg lg:hidden">
              <Menu size={20} />
            </button>
            <OfficialHeader />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="px-3 py-1.5 bg-[#C9A54C] text-black rounded-lg text-sm font-medium hover:bg-[#B8943D]"
            >
              {language === 'ar' ? 'English' : 'عربي'}
            </button>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg text-red-400" title={t.logout}>
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed lg:static inset-y-0 ${language === 'ar' ? 'right-0' : 'left-0'} z-30 w-64 bg-[#12121a] border-${language === 'ar' ? 'l' : 'r'} border-[#C9A54C]/20 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : language === 'ar' ? 'translate-x-full' : '-translate-x-full'} pt-16 lg:pt-0`}>
          <nav className="p-4 space-y-1">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${
                  activeTab === item.id 
                    ? 'bg-gradient-to-r from-[#C9A54C]/20 to-transparent text-[#C9A54C] border-r-2 border-[#C9A54C]' 
                    : 'hover:bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-64px)]">
          {loading && activeTab === 'dashboard' ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw size={32} className="animate-spin text-[#C9A54C]" />
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardComplete;
