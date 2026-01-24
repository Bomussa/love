/**
 * مكون إدارة العيادات المحسن
 * Enhanced Clinics Manager
 * 
 * الميزات:
 * - إيقاف/تشغيل العيادة
 * - إخفاء/إظهار العيادة
 * - إضافة/تعديل/حذف العيادات
 * - حفظ التغييرات
 * - تحويل المراجعين عند الإغلاق
 * - إعدادات متقدمة لكل عيادة
 */

import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, RefreshCw, Edit, Trash2, Save,
  Eye, EyeOff, Play, Pause, Users, Clock, MapPin,
  ArrowRight, AlertCircle, Check, X, Settings,
  ChevronDown, ChevronUp, Filter, Search
} from 'lucide-react';
import supabase from '../lib/supabase-client';

const EnhancedClinicsManager = ({ language = 'ar', t }) => {
  const tr = t || ((ar, en) => language === 'ar' ? ar : en);

  // نظام الإشعارات المحسن
  const [notification, setNotification] = useState(null);
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // الحالات
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClinic, setEditingClinic] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [transferReason, setTransferReason] = useState('');
  const [targetClinicId, setTargetClinicId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedClinic, setExpandedClinic] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);

  // نموذج العيادة الجديدة
  const defaultClinic = {
    name_ar: '',
    name_en: '',
    code: '',
    floor: '',
    is_active: true,
    is_hidden: false,
    system_enabled: true,
    // إعدادات التوقيت
    exam_duration: 5,
    call_interval: 2,
    late_threshold: 4,
    max_daily_patients: 50,
    // إعدادات إضافية
    category: 'clinic',
    gender_constraint: 'mixed',
    priority_weight: 1,
    auto_call_enabled: true,
    sound_enabled: true,
    display_on_screen: true,
    // المظهر
    color: '#8A1538',
    icon: 'building'
  };

  const [newClinic, setNewClinic] = useState(defaultClinic);

  // تحميل العيادات
  useEffect(() => {
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar');

      if (!error && data) {
        // إضافة الحقول الافتراضية للعيادات القديمة
        const enhancedData = data.map(clinic => ({
          ...clinic,
          is_hidden: clinic.is_hidden || false,
          system_enabled: clinic.system_enabled !== false,
          auto_call_enabled: clinic.auto_call_enabled !== false,
          sound_enabled: clinic.sound_enabled !== false,
          display_on_screen: clinic.display_on_screen !== false,
          max_daily_patients: clinic.max_daily_patients || 50,
          priority_weight: clinic.priority_weight || 1,
          color: clinic.color || '#8A1538'
        }));
        setClinics(enhancedData);
      }
    } catch (e) {
      console.error('Error loading clinics:', e);
    } finally {
      setLoading(false);
    }
  };

  // إضافة عيادة جديدة
  const addClinic = async () => {
    if (!newClinic.name_ar || !newClinic.name_en) {
      showNotification(tr('يرجى إدخال اسم العيادة', 'Please enter clinic name'), 'warning');
      return;
    }

    try {
      const clinicId = newClinic.code || newClinic.name_en.substring(0, 5).toUpperCase().replace(/\s/g, '');
      
      const { error } = await supabase.from('clinics').insert({
        id: clinicId,
        name: newClinic.name_en,
        name_ar: newClinic.name_ar,
        name_en: newClinic.name_en,
        floor: newClinic.floor || 'الطابق الأول',
        is_active: newClinic.is_active,
        is_hidden: newClinic.is_hidden,
        system_enabled: newClinic.system_enabled,
        call_interval: newClinic.call_interval,
        call_interval_seconds: newClinic.call_interval * 60,
        exam_duration: newClinic.exam_duration,
        late_threshold: newClinic.late_threshold,
        max_daily_patients: newClinic.max_daily_patients,
        category: newClinic.category,
        gender_constraint: newClinic.gender_constraint,
        priority_weight: newClinic.priority_weight,
        auto_call_enabled: newClinic.auto_call_enabled,
        sound_enabled: newClinic.sound_enabled,
        display_on_screen: newClinic.display_on_screen,
        color: newClinic.color,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (!error) {
        loadClinics();
        setShowAddForm(false);
        setNewClinic(defaultClinic);
        showNotification(tr('تم إضافة العيادة بنجاح', 'Clinic added successfully'), 'success');
      } else {
        console.error('Error adding clinic:', error);
        showNotification(tr('خطأ في إضافة العيادة', 'Error adding clinic'), 'error');
      }
    } catch (e) {
      console.error('Error adding clinic:', e);
    }
  };

  // تحديث عيادة
  const updateClinic = async (clinicId, updates) => {
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', clinicId);

      if (!error) {
        loadClinics();
        setEditingClinic(null);
        showNotification(tr('تم تحديث العيادة بنجاح', 'Clinic updated successfully'), 'success');
      }
    } catch (e) {
      console.error('Error updating clinic:', e);
    }
  };

  // تبديل حالة التفعيل
  const toggleActive = async (clinic) => {
    if (clinic.is_active) {
      // إذا كانت مفعلة، نفتح modal التحويل
      setTransferModal(clinic);
    } else {
      // إذا كانت معطلة، نفعلها مباشرة
      try {
        await supabase
          .from('clinics')
          .update({
            is_active: true,
            closure_reason: null,
            closed_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', clinic.id);
        loadClinics();
      } catch (e) {
        console.error('Error activating clinic:', e);
      }
    }
  };

  // تبديل حالة الإخفاء
  const toggleHidden = async (clinicId, currentState) => {
    try {
      await supabase
        .from('clinics')
        .update({ is_hidden: !currentState, updated_at: new Date().toISOString() })
        .eq('id', clinicId);
      loadClinics();
    } catch (e) {
      console.error('Error toggling hidden:', e);
    }
  };

  // إغلاق العيادة مع التحويل
  const closeClinicWithTransfer = async () => {
    if (!transferReason) {
      showNotification(tr('يرجى اختيار سبب الإغلاق', 'Please select closure reason'), 'warning');
      return;
    }

    try {
      // تحديث حالة العيادة
      await supabase.from('clinics').update({
        is_active: false,
        closure_reason: transferReason,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', transferModal.id);

      // تحويل المراجعين إذا تم اختيار عيادة
      if (targetClinicId) {
        await supabase.from('unified_queue').update({
          clinic_id: targetClinicId,
          transferred_from: transferModal.id,
          transfer_reason: transferReason,
          updated_at: new Date().toISOString()
        }).eq('clinic_id', transferModal.id).eq('status', 'waiting');
      }

      loadClinics();
      setTransferModal(null);
      setTransferReason('');
      setTargetClinicId('');
      showNotification(tr('تم إغلاق العيادة بنجاح', 'Clinic closed successfully'), 'success');
    } catch (e) {
      console.error('Error closing clinic:', e);
    }
  };

  // حذف عيادة
  const deleteClinic = async (clinicId) => {
    // استخدام modal بدلاً من window.confirm
    setDeleteConfirmModal(clinicId);
    return;
  };

  // تنفيذ الحذف بعد التأكيد
  const confirmDeleteClinic = async (clinicId) => {
    if (!clinicId) return;
    
    try {
      await supabase.from('clinics').delete().eq('id', clinicId);
      loadClinics();
      showNotification(tr('تم حذف العيادة بنجاح', 'Clinic deleted successfully'), 'success');
      setDeleteConfirmModal(null);
    } catch (e) {
      console.error('Error deleting clinic:', e);
    }
  };

  // تصفية العيادات
  const filteredClinics = clinics.filter(clinic => {
    const matchesSearch = !searchTerm ||
      clinic.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'active' && clinic.is_active && !clinic.is_hidden) ||
      (filterStatus === 'inactive' && !clinic.is_active) ||
      (filterStatus === 'hidden' && clinic.is_hidden);

    return matchesSearch && matchesFilter;
  });

  // أسباب الإغلاق
  const closureReasons = [
    { value: 'غياب الطبيب', label: tr('غياب الطبيب', 'Doctor absent') },
    { value: 'إجازة', label: tr('إجازة', 'On leave') },
    { value: 'صيانة', label: tr('صيانة', 'Maintenance') },
    { value: 'اجتماع', label: tr('اجتماع', 'Meeting') },
    { value: 'طوارئ', label: tr('طوارئ', 'Emergency') },
    { value: 'انتهاء الدوام', label: tr('انتهاء الدوام', 'End of shift') },
    { value: 'أخرى', label: tr('أخرى', 'Other') }
  ];

  // مكون نموذج العيادة
  const ClinicForm = ({ clinic, setClinic, onSave, onCancel, isEditing = false }) => (
    <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 space-y-6">
      <h4 className="font-bold text-lg flex items-center gap-2">
        <Building2 className="text-[#C9A54C]" size={20} />
        {isEditing ? tr('تعديل العيادة', 'Edit Clinic') : tr('إضافة عيادة جديدة', 'Add New Clinic')}
      </h4>

      {/* المعلومات الأساسية */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2">
          {tr('المعلومات الأساسية', 'Basic Information')}
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('الاسم بالعربية', 'Arabic Name')} *</label>
            <input
              type="text"
              value={clinic.name_ar}
              onChange={(e) => setClinic({...clinic, name_ar: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              placeholder="عيادة العيون"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('الاسم بالإنجليزية', 'English Name')} *</label>
            <input
              type="text"
              value={clinic.name_en}
              onChange={(e) => setClinic({...clinic, name_en: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              placeholder="Eye Clinic"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('الرمز', 'Code')}</label>
            <input
              type="text"
              value={clinic.code || clinic.id || ''}
              onChange={(e) => setClinic({...clinic, code: e.target.value.toUpperCase()})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              placeholder="EYE"
              maxLength={5}
              disabled={isEditing}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('الطابق', 'Floor')}</label>
            <input
              type="text"
              value={clinic.floor || ''}
              onChange={(e) => setClinic({...clinic, floor: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              placeholder="الطابق الأول"
            />
          </div>
        </div>
      </div>

      {/* إعدادات التوقيت */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2 flex items-center gap-2">
          <Clock size={16} />
          {tr('إعدادات التوقيت', 'Timing Settings')}
        </h5>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('مدة الفحص (دقيقة)', 'Exam Duration (min)')}</label>
            <input
              type="number"
              value={clinic.exam_duration || 5}
              onChange={(e) => setClinic({...clinic, exam_duration: parseInt(e.target.value) || 5})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              min="1"
              max="60"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('فترة النداء (دقيقة)', 'Call Interval (min)')}</label>
            <input
              type="number"
              value={clinic.call_interval || 2}
              onChange={(e) => setClinic({...clinic, call_interval: parseInt(e.target.value) || 2})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              min="1"
              max="15"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('حد التأخير (دقيقة)', 'Late Threshold (min)')}</label>
            <input
              type="number"
              value={clinic.late_threshold || 4}
              onChange={(e) => setClinic({...clinic, late_threshold: parseInt(e.target.value) || 4})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              min="1"
              max="30"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('الحد اليومي', 'Daily Limit')}</label>
            <input
              type="number"
              value={clinic.max_daily_patients || 50}
              onChange={(e) => setClinic({...clinic, max_daily_patients: parseInt(e.target.value) || 50})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              min="1"
              max="500"
            />
          </div>
        </div>
      </div>

      {/* إعدادات التحكم */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2 flex items-center gap-2">
          <Settings size={16} />
          {tr('إعدادات التحكم', 'Control Settings')}
        </h5>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* مفعّل */}
          <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
            <span className="text-xs text-gray-400">{tr('مفعّل', 'Active')}</span>
            <button
              onClick={() => setClinic({...clinic, is_active: !clinic.is_active})}
              className={`w-12 h-6 rounded-full transition-all ${clinic.is_active ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${clinic.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* مخفي */}
          <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
            <span className="text-xs text-gray-400">{tr('مخفي', 'Hidden')}</span>
            <button
              onClick={() => setClinic({...clinic, is_hidden: !clinic.is_hidden})}
              className={`w-12 h-6 rounded-full transition-all ${clinic.is_hidden ? 'bg-orange-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${clinic.is_hidden ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* النداء التلقائي */}
          <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
            <span className="text-xs text-gray-400">{tr('نداء تلقائي', 'Auto Call')}</span>
            <button
              onClick={() => setClinic({...clinic, auto_call_enabled: !clinic.auto_call_enabled})}
              className={`w-12 h-6 rounded-full transition-all ${clinic.auto_call_enabled ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${clinic.auto_call_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* الصوت */}
          <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
            <span className="text-xs text-gray-400">{tr('الصوت', 'Sound')}</span>
            <button
              onClick={() => setClinic({...clinic, sound_enabled: !clinic.sound_enabled})}
              className={`w-12 h-6 rounded-full transition-all ${clinic.sound_enabled ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${clinic.sound_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* العرض على الشاشة */}
          <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
            <span className="text-xs text-gray-400">{tr('عرض الشاشة', 'Display')}</span>
            <button
              onClick={() => setClinic({...clinic, display_on_screen: !clinic.display_on_screen})}
              className={`w-12 h-6 rounded-full transition-all ${clinic.display_on_screen ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${clinic.display_on_screen ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* النظام */}
          <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
            <span className="text-xs text-gray-400">{tr('النظام', 'System')}</span>
            <button
              onClick={() => setClinic({...clinic, system_enabled: !clinic.system_enabled})}
              className={`w-12 h-6 rounded-full transition-all ${clinic.system_enabled ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${clinic.system_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* إعدادات إضافية */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2">
          {tr('إعدادات إضافية', 'Additional Settings')}
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('الفئة', 'Category')}</label>
            <select
              value={clinic.category || 'clinic'}
              onChange={(e) => setClinic({...clinic, category: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              <option value="clinic">{tr('عيادة', 'Clinic')}</option>
              <option value="lab">{tr('مختبر', 'Laboratory')}</option>
              <option value="radiology">{tr('أشعة', 'Radiology')}</option>
              <option value="pharmacy">{tr('صيدلية', 'Pharmacy')}</option>
              <option value="reception">{tr('استقبال', 'Reception')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('قيد الجنس', 'Gender Constraint')}</label>
            <select
              value={clinic.gender_constraint || 'mixed'}
              onChange={(e) => setClinic({...clinic, gender_constraint: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              <option value="mixed">{tr('مختلط', 'Mixed')}</option>
              <option value="male">{tr('رجال فقط', 'Male Only')}</option>
              <option value="female">{tr('نساء فقط', 'Female Only')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('وزن الأولوية', 'Priority Weight')}</label>
            <input
              type="number"
              value={clinic.priority_weight || 1}
              onChange={(e) => setClinic({...clinic, priority_weight: parseInt(e.target.value) || 1})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              min="1"
              max="10"
            />
          </div>
        </div>
      </div>

      {/* أزرار الحفظ والإلغاء */}
      <div className="flex gap-2 pt-4 border-t border-white/10">
        <button
          onClick={onSave}
          disabled={!clinic.name_ar || !clinic.name_en}
          className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Save size={18} />
          {tr('حفظ', 'Save')}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
        >
          {tr('إلغاء', 'Cancel')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* العنوان وأزرار التحكم */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="text-[#C9A54C]" />
          {tr('إدارة العيادات', 'Clinics Management')}
        </h3>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            {tr('إضافة عيادة', 'Add Clinic')}
          </button>
          <button
            onClick={loadClinics}
            className="p-2 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] border border-white/10 rounded-xl hover:bg-[#8A1538] transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* البحث والتصفية */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pr-10 pl-4 py-2 text-white"
            placeholder={tr('بحث بالاسم أو الرمز...', 'Search by name or code...')}
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
        >
          <option value="all">{tr('الكل', 'All')}</option>
          <option value="active">{tr('مفعّل', 'Active')}</option>
          <option value="inactive">{tr('معطّل', 'Inactive')}</option>
          <option value="hidden">{tr('مخفي', 'Hidden')}</option>
        </select>
      </div>

      {/* نموذج إضافة عيادة */}
      {showAddForm && (
        <ClinicForm
          clinic={newClinic}
          setClinic={setNewClinic}
          onSave={addClinic}
          onCancel={() => {
            setShowAddForm(false);
            setNewClinic(defaultClinic);
          }}
        />
      )}

      {/* نموذج تعديل عيادة */}
      {editingClinic && (
        <ClinicForm
          clinic={editingClinic}
          setClinic={setEditingClinic}
          onSave={() => updateClinic(editingClinic.id, editingClinic)}
          onCancel={() => setEditingClinic(null)}
          isEditing
        />
      )}

      {/* قائمة العيادات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8 text-gray-400">
            <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
            {tr('جاري التحميل...', 'Loading...')}
          </div>
        ) : filteredClinics.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-400">
            <Building2 className="mx-auto mb-2 opacity-50" size={48} />
            {tr('لا توجد عيادات', 'No clinics found')}
          </div>
        ) : (
          filteredClinics.map(clinic => (
            <div
              key={clinic.id}
              className={`bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border transition-all ${
                clinic.is_hidden ? 'opacity-50 border-orange-500/30' :
                !clinic.is_active ? 'opacity-75 border-red-500/30' :
                'border-white/10'
              }`}
            >
              <div className="p-4">
                {/* رأس البطاقة */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-lg">
                      {language === 'ar' ? clinic.name_ar : clinic.name_en}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {language === 'ar' ? clinic.name_en : clinic.name_ar}
                    </p>
                  </div>
                  <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
                    {clinic.id}
                  </span>
                </div>

                {/* شارات الحالة */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {clinic.is_active ? (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={10} /> {tr('مفعّل', 'Active')}
                    </span>
                  ) : (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <X size={10} /> {tr('معطّل', 'Disabled')}
                    </span>
                  )}
                  {clinic.is_hidden && (
                    <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <EyeOff size={10} /> {tr('مخفي', 'Hidden')}
                    </span>
                  )}
                  {clinic.floor && (
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <MapPin size={10} /> {clinic.floor}
                    </span>
                  )}
                </div>

                {/* معلومات إضافية */}
                <div className="text-xs text-gray-400 space-y-1 mb-4">
                  <div className="flex justify-between">
                    <span>{tr('مدة الفحص:', 'Exam:')}</span>
                    <span>{clinic.exam_duration || 5} {tr('د', 'm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{tr('النداء:', 'Call:')}</span>
                    <span>{clinic.call_interval || 2} {tr('د', 'm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{tr('الحد اليومي:', 'Daily limit:')}</span>
                    <span>{clinic.max_daily_patients || 50}</span>
                  </div>
                </div>

                {/* أزرار التحكم */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => toggleActive(clinic)}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                      clinic.is_active
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {clinic.is_active ? <Pause size={16} /> : <Play size={16} />}
                    {clinic.is_active ? tr('إيقاف', 'Stop') : tr('تشغيل', 'Start')}
                  </button>

                  <button
                    onClick={() => toggleHidden(clinic.id, clinic.is_hidden)}
                    className={`p-2 rounded-lg transition-all ${
                      clinic.is_hidden
                        ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                    title={clinic.is_hidden ? tr('إظهار', 'Show') : tr('إخفاء', 'Hide')}
                  >
                    {clinic.is_hidden ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>

                  <button
                    onClick={() => setEditingClinic({...clinic})}
                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                    title={tr('تعديل', 'Edit')}
                  >
                    <Edit size={18} />
                  </button>

                  <button
                    onClick={() => deleteClinic(clinic.id)}
                    className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                    title={tr('حذف', 'Delete')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* مكون الإشعارات */}
      {notification && (
        <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[120] max-w-md transition-all duration-300 ${
          notification.type === 'success' ? 'bg-green-600' :
          notification.type === 'error' ? 'bg-red-600' :
          notification.type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
        } text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3`}>
          <span className="text-xl">
            {notification.type === 'success' ? '✓' :
             notification.type === 'error' ? '✕' :
             notification.type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <span className="flex-1">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-white/80 hover:text-white">×</button>
        </div>
      )}

      {/* Modal تأكيد الحذف */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <AlertCircle className="text-red-400" size={24} />
              {tr('تأكيد الحذف', 'Confirm Delete')}
            </h4>
            <p className="text-gray-300 mb-6">
              {tr('هل أنت متأكد من حذف هذه العيادة؟ سيتم حذف جميع البيانات المرتبطة بها.', 'Are you sure you want to delete this clinic? All related data will be deleted.')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmDeleteClinic(deleteConfirmModal)}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-medium flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                {tr('حذف', 'Delete')}
              </button>
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="flex-1 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal التحويل */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4">{tr('إغلاق وتحويل العيادة', 'Close & Transfer Clinic')}</h4>
            <p className="text-gray-400 mb-4">
              {language === 'ar' ? (transferModal.name_ar || transferModal.name_en) : (transferModal.name_en || transferModal.name_ar)}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr('سبب الإغلاق', 'Closure Reason')} *</label>
                <select
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                >
                  <option value="">{tr('اختر السبب', 'Select reason')}</option>
                  {closureReasons.map(reason => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr('تحويل المراجعين إلى', 'Transfer patients to')}</label>
                <select
                  value={targetClinicId}
                  onChange={(e) => setTargetClinicId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                >
                  <option value="">{tr('بدون تحويل', 'No transfer')}</option>
                  {clinics.filter(c => c.id !== transferModal.id && c.is_active).map(c => (
                    <option key={c.id} value={c.id}>
                      {language === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{tr('اختياري - لتحويل المراجعين المنتظرين', 'Optional - to transfer waiting patients')}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={closeClinicWithTransfer}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-medium"
              >
                {tr('إغلاق العيادة', 'Close Clinic')}
              </button>
              <button
                onClick={() => {
                  setTransferModal(null);
                  setTransferReason('');
                  setTargetClinicId('');
                }}
                className="flex-1 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedClinicsManager;
