/**
   * @module AdminDashboardV2
   * @description لوحة تحكم المسؤول المحسّنة - تشمل إدارة المستخدمين الكاملة
   * ✅ إدارة المستخدمين الإداريين (إضافة، حذف، تجميد، تغيير كلمة المرور، الصلاحيات)
   * ✅ إدارة الطوابير لحظية من Supabase
   * ✅ التقارير من Supabase
   * ✅ لا بيانات وهمية - كل شيء من Supabase مباشرة
   */

  import React, { useState, useEffect, useCallback } from 'react';
  import { supabase } from '../lib/supabase-client';
  import toast, { Toaster } from 'react-hot-toast';
  import {
    LayoutDashboard, Users, Clock, CheckCircle, Activity,
    Settings, FileText, RefreshCw, Trash2,
    Edit, Plus, LogOut, AlertCircle, Search,
    Shield, BarChart3,
    UserCheck, XCircle, Lock, Unlock,
    UserPlus, Stethoscope, UserX, ArrowRight, Eye, EyeOff, Save
  } from 'lucide-react';

  const showSuccessToast = (message) => {
    toast.success(message, {
      duration: 3000, position: 'top-center',
      style: { background: '#10B981', color: '#fff', fontWeight: 'bold', borderRadius: '12px', padding: '16px 24px', fontSize: '16px' },
    });
  };

  const showErrorToast = (message) => {
    toast.error(message, {
      duration: 4000, position: 'top-center',
      style: { background: '#EF4444', color: '#fff', fontWeight: 'bold', borderRadius: '12px', padding: '16px 24px', fontSize: '16px' },
    });
  };

  // ── مكون إدارة الطوابير ──────────────────────────────────────────────
  const QueueManagement = ({ language, t }) => {
    const [queues, setQueues] = useState([]);
    const [clinics, setClinics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClinic, setSelectedClinic] = useState('');

    const loadQueues = useCallback(async (clinicId) => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        let query = supabase
          .from('unified_queue')
          .select('*, patients(name, military_id)')
          .eq('queue_date', today);
        const cId = clinicId !== undefined ? clinicId : selectedClinic;
        if (cId) query = query.eq('clinic_id', cId);
        const { data, error } = await query.order('display_number', { ascending: true });
        if (error) throw error;
        setQueues(data || []);
      } catch (err) {
        showErrorToast(t('خطأ في جلب بيانات الطابور', 'Queue fetch error'));
      } finally {
        setLoading(false);
      }
    }, [selectedClinic]);

    const loadClinics = async () => {
      const { data, error } = await supabase.from('clinics').select('*').order('name_ar');
      if (!error && data) setClinics(data);
    };

    useEffect(() => {
      loadQueues();
      loadClinics();
      const channel = supabase.channel('admin_queue_sync_v2')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue' }, () => loadQueues())
        .subscribe();
      return () => supabase.removeChannel(channel);
    }, [selectedClinic]);

    const handleCallNext = async (clinicId) => {
      const { error } = await supabase.rpc('call_next_patient', { p_clinic_id: clinicId }).catch(() => ({ error: true }));
      if (!error) { showSuccessToast(t('تم استدعاء المراجع التالي', 'Next patient called')); loadQueues(); }
      else showErrorToast(t('خطأ في الاستدعاء', 'Call error'));
    };

    const statusMap = {
      waiting: { ar: 'انتظار', en: 'Waiting', cls: 'bg-blue-500/20 text-blue-400' },
      called:  { ar: 'مستدعى', en: 'Called',   cls: 'bg-yellow-500/20 text-yellow-400' },
      done:    { ar: 'مكتمل',  en: 'Done',     cls: 'bg-green-500/20 text-green-400' },
    };

    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="text-[#C9A54C]" />
            {t('إدارة الطوابير اللحظية', 'Real-time Queue Management')}
          </h2>
          <div className="flex gap-2">
            <select
              value={selectedClinic}
              onChange={(e) => { setSelectedClinic(e.target.value); loadQueues(e.target.value); }}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[#C9A54C] text-white"
            >
              <option value="">{t('جميع العيادات', 'All Clinics')}</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>)}
            </select>
            <button onClick={() => loadQueues()} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {queues.length === 0 && !loading ? (
          <div className="py-20 text-center text-gray-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
            {t('لا توجد بيانات حقيقية لليوم', 'No real data for today')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queues.map((q) => {
              const s = statusMap[q.status] || { ar: q.status, en: q.status, cls: 'bg-gray-500/20 text-gray-400' };
              return (
                <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#C9A54C]/50 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-3xl font-bold text-[#C9A54C]">#{q.display_number}</div>
                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${s.cls}`}>
                      {language === 'ar' ? s.ar : s.en}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold">{q.patients?.name || t('مراجع', 'Patient')}</div>
                    <div className="text-sm text-gray-400 font-mono">{q.patients?.military_id || q.patient_id}</div>
                    {q.clinic_id && (
                      <button
                        onClick={() => handleCallNext(q.clinic_id)}
                        className="mt-2 w-full text-xs bg-[#C9A54C]/20 hover:bg-[#C9A54C]/40 text-[#C9A54C] rounded-lg py-1 transition-all flex items-center justify-center gap-1"
                      >
                        <ArrowRight size={12} /> {t('استدعاء التالي', 'Call Next')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── مكون إدارة المستخدمين الإداريين ─────────────────────────────────
  const AdminUsersManagement = ({ language, t }) => {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'admin', is_active: true });
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const loadAdmins = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('admins')
        .select('id, username, full_name, role, is_active, last_login, created_at')
        .order('created_at', { ascending: false });
      if (!error) setAdmins(data || []);
      else showErrorToast(t('خطأ في جلب بيانات المستخدمين', 'Error loading admins'));
      setLoading(false);
    };

    useEffect(() => { loadAdmins(); }, []);

    const resetForm = () => {
      setForm({ username: '', password: '', full_name: '', role: 'admin', is_active: true });
      setEditingAdmin(null);
      setShowForm(false);
      setShowPassword(false);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.username.trim()) return showErrorToast(t('اسم المستخدم مطلوب', 'Username required'));
      if (!editingAdmin && !form.password.trim()) return showErrorToast(t('كلمة المرور مطلوبة', 'Password required'));
      setSaving(true);
      try {
        if (editingAdmin) {
          const updateData = { username: form.username, full_name: form.full_name, role: form.role, is_active: form.is_active };
          if (form.password.trim()) updateData.password_hash = form.password;
          const { error } = await supabase.from('admins').update(updateData).eq('id', editingAdmin.id);
          if (error) throw error;
          showSuccessToast(t('تم تحديث المستخدم بنجاح', 'Admin updated successfully'));
        } else {
          const { error } = await supabase.from('admins').insert([{
            username: form.username, password_hash: form.password,
            full_name: form.full_name, role: form.role, is_active: form.is_active,
            created_at: new Date().toISOString()
          }]);
          if (error) throw error;
          showSuccessToast(t('تم إنشاء المستخدم بنجاح', 'Admin created successfully'));
        }
        resetForm();
        loadAdmins();
      } catch (err) {
        showErrorToast(err.message || t('خطأ في حفظ البيانات', 'Save error'));
      } finally {
        setSaving(false);
      }
    };

    const handleEdit = (admin) => {
      setForm({ username: admin.username, password: '', full_name: admin.full_name || '', role: admin.role || 'admin', is_active: admin.is_active });
      setEditingAdmin(admin);
      setShowForm(true);
    };

    const handleToggleStatus = async (admin) => {
      const newStatus = !admin.is_active;
      const { error } = await supabase.from('admins').update({ is_active: newStatus }).eq('id', admin.id);
      if (!error) {
        showSuccessToast(newStatus ? t('تم تفعيل الحساب', 'Account activated') : t('تم تجميد الحساب', 'Account frozen'));
        loadAdmins();
      } else showErrorToast(t('خطأ في تغيير الحالة', 'Status change error'));
    };

    const handleDelete = async (admin) => {
      if (!confirm(t(`هل أنت متأكد من حذف المستخدم: ${admin.username}؟`, `Delete admin: ${admin.username}?`))) return;
      const { error } = await supabase.from('admins').delete().eq('id', admin.id);
      if (!error) { showSuccessToast(t('تم حذف المستخدم', 'Admin deleted')); loadAdmins(); }
      else showErrorToast(t('خطأ في الحذف', 'Delete error'));
    };

    const filteredAdmins = admins.filter(a =>
      a.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const roleColors = { superadmin: 'text-red-400 bg-red-500/10', admin: 'text-[#C9A54C] bg-[#C9A54C]/10', viewer: 'text-blue-400 bg-blue-500/10' };

    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="text-[#C9A54C]" />
            {t('إدارة المستخدمين الإداريين', 'Admin Users Management')}
          </h2>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-[#C9A54C] hover:bg-[#B8943B] text-black font-bold px-4 py-2 rounded-xl transition-all"
          >
            <UserPlus size={18} /> {t('إضافة مسؤول جديد', 'Add New Admin')}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('بحث عن مستخدم...', 'Search admin...')}
            className="w-full bg-white/5 border border-white/10 rounded-xl pr-10 pl-4 py-3 outline-none focus:border-[#C9A54C] text-white placeholder-gray-500"
          />
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white/5 border border-[#C9A54C]/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              {editingAdmin ? <Edit size={18} className="text-[#C9A54C]" /> : <UserPlus size={18} className="text-[#C9A54C]" />}
              {editingAdmin ? t('تعديل المستخدم', 'Edit Admin') : t('إضافة مستخدم جديد', 'Add New Admin')}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('اسم المستخدم *', 'Username *')}</label>
                <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[#C9A54C] text-white"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('الاسم الكامل', 'Full Name')}</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[#C9A54C] text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  {editingAdmin ? t('كلمة المرور الجديدة (اتركها فارغة للإبقاء)', 'New Password (leave blank to keep)') : t('كلمة المرور *', 'Password *')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2 pr-10 outline-none focus:border-[#C9A54C] text-white"
                    required={!editingAdmin}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('الصلاحية', 'Role')}</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[#C9A54C] text-white"
                >
                  <option value="viewer">{t('مشاهد فقط', 'Viewer')}</option>
                  <option value="admin">{t('مسؤول', 'Admin')}</option>
                  <option value="superadmin">{t('مسؤول أعلى', 'Super Admin')}</option>
                </select>
              </div>
              <div className="flex items-center gap-3 col-span-full">
                <label className="text-sm text-gray-400">{t('الحساب مفعّل', 'Account Active')}</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="col-span-full flex gap-3 justify-end">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                  {t('إلغاء', 'Cancel')}
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-[#C9A54C] hover:bg-[#B8943B] text-black font-bold rounded-xl transition-all disabled:opacity-50">
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingAdmin ? t('حفظ التعديلات', 'Save Changes') : t('إنشاء المستخدم', 'Create Admin')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Admins Table */}
        {loading ? (
          <div className="text-center py-10 text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            {t('جارٍ التحميل...', 'Loading...')}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAdmins.length === 0 ? (
              <div className="text-center py-10 text-gray-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
                {t('لا توجد مستخدمين', 'No admins found')}
              </div>
            ) : filteredAdmins.map(admin => (
              <div key={admin.id} className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 flex items-center justify-between gap-4 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${admin.is_active ? 'bg-[#C9A54C]/20 text-[#C9A54C]' : 'bg-gray-700 text-gray-400'}`}>
                    {(admin.full_name || admin.username || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold">{admin.full_name || admin.username}</div>
                    <div className="text-sm text-gray-400 font-mono">@{admin.username}</div>
                    {admin.last_login && (
                      <div className="text-xs text-gray-500">{t('آخر دخول:', 'Last login:')} {new Date(admin.last_login).toLocaleDateString('ar-SA')}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${roleColors[admin.role] || 'text-gray-400 bg-gray-700'}`}>
                    {admin.role === 'superadmin' ? t('أعلى صلاحية', 'Super Admin') : admin.role === 'admin' ? t('مسؤول', 'Admin') : t('مشاهد', 'Viewer')}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${admin.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {admin.is_active ? t('مفعّل', 'Active') : t('مجمّد', 'Frozen')}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(admin)} title={t('تعديل', 'Edit')} className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white">
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(admin)}
                      title={admin.is_active ? t('تجميد', 'Freeze') : t('تفعيل', 'Activate')}
                      className={`p-2 hover:bg-white/10 rounded-lg transition-all ${admin.is_active ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}
                    >
                      {admin.is_active ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>
                    <button onClick={() => handleDelete(admin)} title={t('حذف', 'Delete')} className="p-2 hover:bg-red-500/10 rounded-lg transition-all text-red-400 hover:text-red-300">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── مكون التقارير ─────────────────────────────────────────────────────
  const ReportsPanel = ({ language, t }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, completed: 0, waiting: 0, today: 0 });
    const [dateRange, setDateRange] = useState({ from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] });

    const loadReports = async () => {
      setLoading(true);
      try {
        const { data: queueData, error } = await supabase
          .from('unified_queue')
          .select('*, patients(name, military_id), clinics(name_ar, name_en)')
          .gte('queue_date', dateRange.from)
          .lte('queue_date', dateRange.to)
          .order('created_at', { ascending: false });
        if (!error && queueData) {
          setReports(queueData);
          setStats({
            total: queueData.length,
            completed: queueData.filter(q => q.status === 'done' || q.status === 'completed').length,
            waiting: queueData.filter(q => q.status === 'waiting').length,
            today: queueData.filter(q => q.queue_date === new Date().toISOString().split('T')[0]).length,
          });
        }
      } catch (err) {
        showErrorToast(t('خطأ في جلب التقارير', 'Reports fetch error'));
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => { loadReports(); }, []);

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="text-[#C9A54C]" />
          {t('التقارير والإحصائيات', 'Reports & Statistics')}
        </h2>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('إجمالي السجلات', 'Total Records'), value: stats.total, icon: FileText, color: 'text-blue-400' },
            { label: t('مكتملة', 'Completed'), value: stats.completed, icon: CheckCircle, color: 'text-green-400' },
            { label: t('في الانتظار', 'Waiting'), value: stats.waiting, icon: Clock, color: 'text-yellow-400' },
            { label: t('اليوم', 'Today'), value: stats.today, icon: Activity, color: 'text-[#C9A54C]' },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className={`${s.color} mb-2`}><s.icon size={20} /></div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-sm text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">{t('من:', 'From:')}</label>
            <input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A54C] text-white" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">{t('إلى:', 'To:')}</label>
            <input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A54C] text-white" />
          </div>
          <button onClick={loadReports} className="flex items-center gap-2 px-4 py-2 bg-[#C9A54C] hover:bg-[#B8943B] text-black font-bold rounded-xl transition-all">
            <Search size={16} /> {t('تطبيق الفلتر', 'Apply Filter')}
          </button>
          <button onClick={loadReports} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Reports Table */}
        {loading ? (
          <div className="text-center py-10 text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            {t('جارٍ تحميل التقارير...', 'Loading reports...')}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
            {t('لا توجد بيانات للفترة المحددة', 'No data for selected period')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-3 px-4 text-right">#</th>
                  <th className="py-3 px-4 text-right">{t('المراجع', 'Patient')}</th>
                  <th className="py-3 px-4 text-right">{t('العيادة', 'Clinic')}</th>
                  <th className="py-3 px-4 text-right">{t('الحالة', 'Status')}</th>
                  <th className="py-3 px-4 text-right">{t('التاريخ', 'Date')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 50).map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                    <td className="py-3 px-4 text-[#C9A54C] font-bold">#{r.display_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{r.patients?.name || t('غير معروف', 'Unknown')}</div>
                      <div className="text-xs text-gray-500 font-mono">{r.patients?.military_id || r.patient_id}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{language === 'ar' ? r.clinics?.name_ar : r.clinics?.name_en || r.clinic_id}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${r.status === 'done' || r.status === 'completed' ? 'bg-green-500/20 text-green-400' : r.status === 'called' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {r.status === 'done' || r.status === 'completed' ? t('مكتمل', 'Done') : r.status === 'called' ? t('مستدعى', 'Called') : t('انتظار', 'Waiting')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{r.queue_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reports.length > 50 && (
              <div className="text-center py-3 text-gray-500 text-sm">{t(`عرض أول 50 من ${reports.length} سجل`, `Showing first 50 of ${reports.length} records`)}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── المكون الرئيسي ────────────────────────────────────────────────────
  export const AdminDashboardV2 = ({ onLogout, language, t: tFn }) => {
    const [activeTab, setActiveTab] = useState('queues');

    const t = tFn || ((ar, en) => language === 'ar' ? ar : (en || ar));

    const tabs = [
      { id: 'queues',   icon: Users,   label: t('الطوابير', 'Queues') },
      { id: 'admins',   icon: Shield,  label: t('المستخدمون', 'Admins') },
      { id: 'reports',  icon: BarChart3, label: t('التقارير', 'Reports') },
    ];

    return (
      <div className="min-h-screen bg-[#050505] text-white flex" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <Toaster />
        {/* Sidebar */}
        <div className="w-64 bg-white/5 border-l border-white/10 flex flex-col shrink-0">
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C9A54C] rounded-lg flex items-center justify-center font-bold text-black text-lg">M</div>
            <div>
              <div className="font-bold text-lg">MMC Admin</div>
              <div className="text-xs text-gray-400">{t('لوحة التحكم', 'Dashboard')}</div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#C9A54C] text-black font-bold' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
              >
                <tab.icon size={20} /> {tab.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-white/10">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all">
              <LogOut size={20} /> {t('تسجيل الخروج', 'Logout')}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'queues' && <QueueManagement language={language} t={t} />}
          {activeTab === 'admins' && <AdminUsersManagement language={language} t={t} />}
          {activeTab === 'reports' && <ReportsPanel language={language} t={t} />}
        </div>
      </div>
    );
  };

  export default AdminDashboardV2;
  