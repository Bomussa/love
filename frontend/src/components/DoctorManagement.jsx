/**
 * @fileoverview Doctor Management Component
 * @description Admin panel for managing doctors (add, edit, delete, freeze)
 * @version 2.0.0
 */

import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Edit2, Trash2, Lock, Unlock, Search, RefreshCw,
  CheckCircle, XCircle, AlertCircle, UserCheck, Key, Eye, EyeOff
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import toast from 'react-hot-toast';

/**
 * Doctor Management Component
 * @param {Object} props
 * @param {string} props.language - Current language
 * @param {Function} props.t - Translation function
 */
const DoctorManagement = ({ language = 'ar', t = (ar, en) => ar }) => {
  const [doctors, setDoctors] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    clinic_id: '',
    specialty: '',
    phone: '',
    email: '',
    is_active: true
  });

  const translate = (ar, en) => language === 'ar' ? ar : en;

  useEffect(() => {
    loadDoctors();
    loadClinics();
  }, []);

  /**
   * Load doctors from database
   */
  const loadDoctors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          *,
          clinics:clinic_id (name_ar, name_en)
        `)
        .order('name');

      if (error) throw error;
      setDoctors(data || []);
    } catch (e) {
      console.error('Error loading doctors:', e);
      toast.error(translate('خطأ في تحميل الأطباء', 'Error loading doctors'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load clinics list
   */
  const loadClinics = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar');

      if (!error && data) {
        setClinics(data);
      }
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  /**
   * Open modal for adding new doctor
   */
  const openAddModal = () => {
    setEditingDoctor(null);
    setFormData({
      name: '',
      username: '',
      password: '',
      clinic_id: clinics.length > 0 ? clinics[0].id : '',
      specialty: '',
      phone: '',
      email: '',
      is_active: true
    });
    setShowPassword(false);
    setShowModal(true);
  };

  /**
   * Open modal for editing doctor
   */
  const openEditModal = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name || '',
      username: doctor.username || '',
      password: '', // Don't show existing password
      clinic_id: doctor.clinic_id || '',
      specialty: doctor.specialty || '',
      phone: doctor.phone || '',
      email: doctor.email || '',
      is_active: doctor.is_active !== false
    });
    setShowPassword(false);
    setShowModal(true);
  };

  /**
   * Save doctor (add or update)
   */
  const saveDoctor = async () => {
    try {
      // Validation
      if (!formData.name.trim()) {
        toast.error(translate('الاسم مطلوب', 'Name is required'));
        return;
      }
      if (!formData.username.trim()) {
        toast.error(translate('اسم المستخدم مطلوب', 'Username is required'));
        return;
      }
      if (!editingDoctor && !formData.password.trim()) {
        toast.error(translate('كلمة المرور مطلوبة', 'Password is required'));
        return;
      }

      const doctorData = {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        clinic_id: formData.clinic_id,
        specialty: formData.specialty.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      // Add password only if provided (for new or when changing)
      if (formData.password.trim()) {
        doctorData.password_hash = await hashPassword(formData.password);
      }

      if (editingDoctor) {
        // Update existing doctor
        const { error } = await supabase
          .from('doctors')
          .update(doctorData)
          .eq('id', editingDoctor.id);

        if (error) throw error;
        toast.success(translate('تم تحديث بيانات الطبيب', 'Doctor updated successfully'));
      } else {
        // Add new doctor
        doctorData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('doctors')
          .insert([doctorData]);

        if (error) throw error;
        toast.success(translate('تم إضافة الطبيب بنجاح', 'Doctor added successfully'));
      }

      setShowModal(false);
      loadDoctors();

    } catch (e) {
      console.error('Error saving doctor:', e);
      if (e.message?.includes('duplicate')) {
        toast.error(translate('اسم المستخدم مستخدم بالفعل', 'Username already exists'));
      } else {
        toast.error(translate('خطأ في حفظ البيانات', 'Error saving data'));
      }
    }
  };

  /**
   * Delete doctor
   */
  const deleteDoctor = async (doctor) => {
    const confirmed = window.confirm(
      translate(
        `هل أنت متأكد من حذف الطبيب "${doctor.name}"؟`,
        `Are you sure you want to delete doctor "${doctor.name}"?`
      )
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', doctor.id);

      if (error) throw error;
      toast.success(translate('تم حذف الطبيب', 'Doctor deleted'));
      loadDoctors();
    } catch (e) {
      console.error('Error deleting doctor:', e);
      toast.error(translate('خطأ في حذف الطبيب', 'Error deleting doctor'));
    }
  };

  /**
   * Toggle doctor active status (freeze/unfreeze)
   */
  const toggleStatus = async (doctor) => {
    try {
      const newStatus = !doctor.is_active;
      const { error } = await supabase
        .from('doctors')
        .update({ 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', doctor.id);

      if (error) throw error;
      
      toast.success(
        newStatus 
          ? translate('تم تفعيل الطبيب', 'Doctor activated')
          : translate('تم تجميد الطبيب', 'Doctor frozen')
      );
      loadDoctors();
    } catch (e) {
      console.error('Error toggling status:', e);
      toast.error(translate('خطأ في تغيير الحالة', 'Error changing status'));
    }
  };

  /**
   * Generate random secure password
   */
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  /**
   * Hash password (simple implementation - use bcrypt in production)
   */
  const hashPassword = async (password) => {
    // In production, use proper hashing like bcrypt
    // This is a placeholder - replace with actual hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Filter doctors
  const filteredDoctors = doctors.filter(d => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (d.name || '').toLowerCase().includes(searchLower) ||
      (d.username || '').toLowerCase().includes(searchLower) ||
      (d.specialty || '').toLowerCase().includes(searchLower) ||
      (d.phone || '').includes(searchTerm)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <UserCheck className="text-[#C9A54C]" size={28} />
          {translate('إدارة الأطباء', 'Doctor Management')}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDoctors}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-gradient-to-r from-[#C9A54C] to-[#8A1538] hover:from-[#D4B55D] hover:to-[#9A2548] text-white rounded-lg font-medium flex items-center gap-2 transition-all"
          >
            <UserPlus size={20} />
            {translate('إضافة طبيب', 'Add Doctor')}
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-white/10">
          <div className="text-2xl font-bold text-[#C9A54C]">{doctors.length}</div>
          <div className="text-sm text-gray-400">{translate('إجمالي الأطباء', 'Total Doctors')}</div>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-white/10">
          <div className="text-2xl font-bold text-green-400">
            {doctors.filter(d => d.is_active !== false).length}
          </div>
          <div className="text-sm text-gray-400">{translate('نشط', 'Active')}</div>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-white/10">
          <div className="text-2xl font-bold text-red-400">
            {doctors.filter(d => d.is_active === false).length}
          </div>
          <div className="text-sm text-gray-400">{translate('مجمد', 'Frozen')}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={translate('بحث باسم أو تخصص الطبيب...', 'Search by doctor name or specialty...')}
          className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500"
        />
      </div>

      {/* Doctors Table */}
      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-white/10">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('الاسم', 'Name')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('اسم المستخدم', 'Username')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('العيادة', 'Clinic')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('التخصص', 'Specialty')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('الحالة', 'Status')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredDoctors.map((doctor) => (
              <tr key={doctor.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                <td className="p-4">
                  <div className="font-medium">{doctor.name}</div>
                  <div className="text-sm text-gray-400">{doctor.phone}</div>
                </td>
                <td className="p-4 font-mono text-sm">{doctor.username}</td>
                <td className="p-4">
                  {language === 'ar' 
                    ? doctor.clinics?.name_ar 
                    : doctor.clinics?.name_en}
                </td>
                <td className="p-4 text-gray-400">{doctor.specialty || '-'}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    doctor.is_active !== false 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {doctor.is_active !== false 
                      ? translate('نشط', 'Active') 
                      : translate('مجمد', 'Frozen')}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(doctor)}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                      title={translate('تعديل', 'Edit')}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => toggleStatus(doctor)}
                      className={`p-2 rounded-lg transition-all ${
                        doctor.is_active !== false
                          ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400'
                          : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                      }`}
                      title={doctor.is_active !== false ? translate('تجميد', 'Freeze') : translate('تفعيل', 'Activate')}
                    >
                      {doctor.is_active !== false ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>
                    <button
                      onClick={() => deleteDoctor(doctor)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                      title={translate('حذف', 'Delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredDoctors.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <UserCheck size={48} className="mx-auto mb-4 opacity-50" />
            <p>{translate('لا يوجد أطباء', 'No doctors found')}</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto border border-white/10">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {editingDoctor 
                  ? translate('تعديل بيانات الطبيب', 'Edit Doctor')
                  : translate('إضافة طبيب جديد', 'Add New Doctor')
                }
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{translate('الاسم الكامل', 'Full Name')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder={translate('اسم الطبيب', 'Doctor name')}
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{translate('اسم المستخدم', 'Username')} *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder={translate('username', 'username')}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {translate('كلمة المرور', 'Password')} 
                  {!editingDoctor && ' *'}
                  {editingDoctor && <span className="text-gray-500 text-xs"> ({translate('اترك فارغاً للاحتفاظ بالحالي', 'Leave empty to keep current')})</span>}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white pr-10"
                      placeholder={translate('••••••••', '••••••••')}
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    onClick={generatePassword}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-all"
                  >
                    {translate('توليد', 'Generate')}
                  </button>
                </div>
              </div>

              {/* Clinic */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{translate('العيادة', 'Clinic')} *</label>
                <select
                  value={formData.clinic_id}
                  onChange={(e) => setFormData({ ...formData, clinic_id: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white"
                >
                  {clinics.map(clinic => (
                    <option key={clinic.id} value={clinic.id}>
                      {language === 'ar' ? clinic.name_ar : clinic.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specialty */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{translate('التخصص', 'Specialty')}</label>
                <input
                  type="text"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder={translate('مثال: باطنية، جراحة', 'e.g., Internal Medicine, Surgery')}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{translate('رقم الهاتف', 'Phone')}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder={translate('05xxxxxxxx', '05xxxxxxxx')}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{translate('البريد الإلكتروني', 'Email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder={translate('doctor@example.com', 'doctor@example.com')}
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-black/30 text-[#C9A54C]"
                />
                <label htmlFor="is_active" className="text-sm">
                  {translate('حساب نشط', 'Active Account')}
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-all"
              >
                {translate('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={saveDoctor}
                className="flex-1 py-3 bg-gradient-to-r from-[#C9A54C] to-[#8A1538] hover:from-[#D4B55D] hover:to-[#9A2548] text-white rounded-lg font-medium transition-all"
              >
                {editingDoctor ? translate('حفظ التغييرات', 'Save Changes') : translate('إضافة الطبيب', 'Add Doctor')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorManagement;
