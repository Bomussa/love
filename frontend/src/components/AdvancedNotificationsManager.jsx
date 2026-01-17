/**
 * نظام إدارة الإشعارات المتقدم
 * Advanced Notifications Management System
 * 
 * الميزات:
 * - إشعار لمراجع معين حسب الرقم العسكري/الشخصي
 * - تحديد وقت ومكان الإشعار
 * - تخصيص المدة والخط واللون والخلفية
 * - إيقاف/تشغيل، إخفاء/إظهار، تعديل، حذف، حفظ
 */

import React, { useState, useEffect } from 'react';
import {
  Bell, Plus, RefreshCw, Edit, Trash2, Send, Eye, EyeOff,
  Play, Pause, Save, Clock, MapPin, Type, Palette, Image,
  User, Search, Filter, X, Check, AlertCircle, Settings
} from 'lucide-react';
import supabase from '../lib/supabase-client';

// الخطوط المتاحة
const AVAILABLE_FONTS = [
  { id: 'default', name: 'الافتراضي', nameEn: 'Default', family: 'inherit' },
  { id: 'cairo', name: 'القاهرة', nameEn: 'Cairo', family: "'Cairo', sans-serif" },
  { id: 'tajawal', name: 'تجوال', nameEn: 'Tajawal', family: "'Tajawal', sans-serif" },
  { id: 'almarai', name: 'المراعي', nameEn: 'Almarai', family: "'Almarai', sans-serif" },
  { id: 'noto', name: 'نوتو', nameEn: 'Noto Sans Arabic', family: "'Noto Sans Arabic', sans-serif" },
  { id: 'amiri', name: 'أميري', nameEn: 'Amiri', family: "'Amiri', serif" },
];

// مواقع الإشعار
const NOTIFICATION_POSITIONS = [
  { id: 'top-center', name: 'أعلى الوسط', nameEn: 'Top Center' },
  { id: 'top-right', name: 'أعلى اليمين', nameEn: 'Top Right' },
  { id: 'top-left', name: 'أعلى اليسار', nameEn: 'Top Left' },
  { id: 'center', name: 'الوسط', nameEn: 'Center' },
  { id: 'bottom-center', name: 'أسفل الوسط', nameEn: 'Bottom Center' },
  { id: 'bottom-right', name: 'أسفل اليمين', nameEn: 'Bottom Right' },
  { id: 'bottom-left', name: 'أسفل اليسار', nameEn: 'Bottom Left' },
  { id: 'fullscreen', name: 'ملء الشاشة', nameEn: 'Fullscreen' },
];

// ألوان مسبقة
const PRESET_COLORS = [
  '#C9A54C', '#8A1538', '#6B0F2A', '#FFFFFF', '#000000',
  '#22C55E', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

// خلفيات مسبقة
const PRESET_BACKGROUNDS = [
  { id: 'solid', name: 'لون صلب', type: 'color', value: '#8A1538' },
  { id: 'gradient1', name: 'تدرج ذهبي', type: 'gradient', value: 'linear-gradient(135deg, #8A1538 0%, #C9A54C 100%)' },
  { id: 'gradient2', name: 'تدرج أحمر', type: 'gradient', value: 'linear-gradient(135deg, #6B0F2A 0%, #8A1538 100%)' },
  { id: 'gradient3', name: 'تدرج أزرق', type: 'gradient', value: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)' },
  { id: 'gradient4', name: 'تدرج أخضر', type: 'gradient', value: 'linear-gradient(135deg, #166534 0%, #22C55E 100%)' },
  { id: 'transparent', name: 'شفاف', type: 'color', value: 'transparent' },
];

const AdvancedNotificationsManager = ({ language = 'ar', t }) => {
  // الترجمة المحلية
  const translate = (ar, en) => language === 'ar' ? ar : en;
  const tr = t || translate;

  // الحالات
  const [notifications, setNotifications] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showPreview, setShowPreview] = useState(null);

  // نموذج الإشعار الجديد
  const defaultNotification = {
    title: '',
    message: '',
    status: 'draft',
    is_active: true,
    is_hidden: false,
    clinic_id: null,
    target_patient_id: '', // الرقم العسكري/الشخصي المستهدف
    priority: 'normal',
    // إعدادات التوقيت
    scheduled_at: null,
    expires_at: null,
    duration_seconds: 10, // مدة العرض بالثواني
    // إعدادات المظهر
    position: 'top-center',
    font_family: 'default',
    font_size: 16,
    text_color: '#FFFFFF',
    background_type: 'gradient',
    background_value: 'linear-gradient(135deg, #8A1538 0%, #C9A54C 100%)',
    border_radius: 12,
    animation: 'slide-down',
    // بيانات إضافية
    metadata: {}
  };

  const [newNotification, setNewNotification] = useState(defaultNotification);

  // تحميل البيانات
  useEffect(() => {
    loadNotifications();
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      const { data } = await supabase.from('clinics').select('id, name_ar, name_en').order('name_ar');
      if (data) setClinics(data);
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*, clinics(name_ar, name_en)')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        // تحويل البيانات القديمة للتوافق مع النظام الجديد
        const enhancedData = data.map(n => ({
          ...n,
          is_active: n.is_active !== false,
          is_hidden: n.is_hidden || false,
          target_patient_id: n.target_patient_id || n.metadata?.target_patient_id || '',
          position: n.position || n.metadata?.position || 'top-center',
          font_family: n.font_family || n.metadata?.font_family || 'default',
          font_size: n.font_size || n.metadata?.font_size || 16,
          text_color: n.text_color || n.metadata?.text_color || '#FFFFFF',
          background_type: n.background_type || n.metadata?.background_type || 'gradient',
          background_value: n.background_value || n.metadata?.background_value || 'linear-gradient(135deg, #8A1538 0%, #C9A54C 100%)',
          duration_seconds: n.duration_seconds || n.metadata?.duration_seconds || 10,
          border_radius: n.border_radius || n.metadata?.border_radius || 12,
          animation: n.animation || n.metadata?.animation || 'slide-down',
        }));
        setNotifications(enhancedData);
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  // إضافة إشعار جديد
  const addNotification = async () => {
    if (!newNotification.title || !newNotification.message) {
      alert(tr('يرجى إدخال العنوان والرسالة', 'Please enter title and message'));
      return;
    }

    try {
      const notifData = {
        title: newNotification.title,
        message: newNotification.message,
        status: newNotification.status || 'draft',
        is_active: newNotification.is_active,
        is_hidden: newNotification.is_hidden,
        clinic_id: newNotification.clinic_id || null,
        target_patient_id: newNotification.target_patient_id || null,
        is_read: false,
        scheduled_at: newNotification.scheduled_at || null,
        expires_at: newNotification.expires_at || null,
        metadata: {
          priority: newNotification.priority,
          position: newNotification.position,
          font_family: newNotification.font_family,
          font_size: newNotification.font_size,
          text_color: newNotification.text_color,
          background_type: newNotification.background_type,
          background_value: newNotification.background_value,
          duration_seconds: newNotification.duration_seconds,
          border_radius: newNotification.border_radius,
          animation: newNotification.animation,
        }
      };

      const { error } = await supabase.from('notifications').insert(notifData);

      if (error) {
        console.error('Error adding notification:', error);
        alert(tr('خطأ في إضافة الإشعار', 'Error adding notification'));
        return;
      }

      loadNotifications();
      setShowAddForm(false);
      setNewNotification(defaultNotification);
      alert(tr('تم إضافة الإشعار بنجاح', 'Notification added successfully'));
    } catch (e) {
      console.error('Error adding notification:', e);
    }
  };

  // تحديث إشعار
  const updateNotification = async (notification) => {
    try {
      const updateData = {
        title: notification.title,
        message: notification.message,
        status: notification.status,
        is_active: notification.is_active,
        is_hidden: notification.is_hidden,
        clinic_id: notification.clinic_id,
        target_patient_id: notification.target_patient_id || null,
        scheduled_at: notification.scheduled_at,
        expires_at: notification.expires_at,
        metadata: {
          priority: notification.priority,
          position: notification.position,
          font_family: notification.font_family,
          font_size: notification.font_size,
          text_color: notification.text_color,
          background_type: notification.background_type,
          background_value: notification.background_value,
          duration_seconds: notification.duration_seconds,
          border_radius: notification.border_radius,
          animation: notification.animation,
        },
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', notification.id);

      if (!error) {
        loadNotifications();
        setEditingNotification(null);
        alert(tr('تم تحديث الإشعار بنجاح', 'Notification updated successfully'));
      }
    } catch (e) {
      console.error('Error updating notification:', e);
    }
  };

  // تبديل حالة التفعيل
  const toggleActive = async (id, currentState) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_active: !currentState, updated_at: new Date().toISOString() })
        .eq('id', id);
      loadNotifications();
    } catch (e) {
      console.error('Error toggling active:', e);
    }
  };

  // تبديل حالة الإخفاء
  const toggleHidden = async (id, currentState) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_hidden: !currentState, updated_at: new Date().toISOString() })
        .eq('id', id);
      loadNotifications();
    } catch (e) {
      console.error('Error toggling hidden:', e);
    }
  };

  // إرسال الإشعار
  const sendNotification = async (id) => {
    try {
      await supabase.from('notifications').update({
        status: 'sent',
        sent_at: new Date().toISOString()
      }).eq('id', id);
      loadNotifications();
      alert(tr('تم إرسال الإشعار', 'Notification sent'));
    } catch (e) {
      console.error('Error sending notification:', e);
    }
  };

  // حذف إشعار
  const deleteNotification = async (id) => {
    if (!window.confirm(tr('هل أنت متأكد من الحذف؟', 'Are you sure you want to delete?'))) return;
    try {
      await supabase.from('notifications').delete().eq('id', id);
      loadNotifications();
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  // تصفية الإشعارات
  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = !searchTerm || 
      n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.target_patient_id?.includes(searchTerm);
    
    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'active' && n.is_active && !n.is_hidden) ||
      (filterStatus === 'inactive' && !n.is_active) ||
      (filterStatus === 'hidden' && n.is_hidden) ||
      (filterStatus === 'sent' && n.status === 'sent') ||
      (filterStatus === 'draft' && n.status === 'draft');

    return matchesSearch && matchesFilter;
  });

  // مكون نموذج الإشعار
  const NotificationForm = ({ notification, setNotification, onSave, onCancel, isEditing = false }) => (
    <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 space-y-6">
      <h4 className="font-bold text-lg flex items-center gap-2">
        <Bell className="text-[#C9A54C]" size={20} />
        {isEditing ? tr('تعديل الإشعار', 'Edit Notification') : tr('إضافة إشعار جديد', 'Add New Notification')}
      </h4>

      {/* القسم الأول: المعلومات الأساسية */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2">
          {tr('المعلومات الأساسية', 'Basic Information')}
        </h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('العنوان', 'Title')} *</label>
            <input
              type="text"
              value={notification.title}
              onChange={(e) => setNotification({...notification, title: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              placeholder={tr('عنوان الإشعار', 'Notification title')}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('العيادة', 'Clinic')}</label>
            <select
              value={notification.clinic_id || ''}
              onChange={(e) => setNotification({...notification, clinic_id: e.target.value || null})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              <option value="">{tr('جميع العيادات', 'All Clinics')}</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id}>
                  {language === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              <User size={14} className="inline ml-1" />
              {tr('رقم المراجع المستهدف', 'Target Patient ID')}
            </label>
            <input
              type="text"
              value={notification.target_patient_id}
              onChange={(e) => setNotification({...notification, target_patient_id: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              placeholder={tr('الرقم العسكري أو الشخصي', 'Military or Personal ID')}
            />
            <p className="text-xs text-gray-500 mt-1">{tr('اتركه فارغاً للإشعار العام', 'Leave empty for general notification')}</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('الأولوية', 'Priority')}</label>
            <select
              value={notification.priority}
              onChange={(e) => setNotification({...notification, priority: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              <option value="low">{tr('منخفضة', 'Low')}</option>
              <option value="normal">{tr('عادية', 'Normal')}</option>
              <option value="high">{tr('عالية', 'High')}</option>
              <option value="urgent">{tr('عاجلة', 'Urgent')}</option>
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm text-gray-400 mb-2">{tr('الرسالة', 'Message')} *</label>
            <textarea
              value={notification.message}
              onChange={(e) => setNotification({...notification, message: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white h-24"
              placeholder={tr('نص الإشعار', 'Notification message')}
            />
          </div>
        </div>
      </div>

      {/* القسم الثاني: التوقيت */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2 flex items-center gap-2">
          <Clock size={16} />
          {tr('إعدادات التوقيت', 'Timing Settings')}
        </h5>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('وقت الإرسال', 'Scheduled Time')}</label>
            <input
              type="datetime-local"
              value={notification.scheduled_at ? notification.scheduled_at.slice(0, 16) : ''}
              onChange={(e) => setNotification({...notification, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">{tr('اتركه فارغاً للإرسال الفوري', 'Leave empty for immediate send')}</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('وقت الانتهاء', 'Expiry Time')}</label>
            <input
              type="datetime-local"
              value={notification.expires_at ? notification.expires_at.slice(0, 16) : ''}
              onChange={(e) => setNotification({...notification, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('مدة العرض (ثانية)', 'Display Duration (sec)')}</label>
            <input
              type="number"
              value={notification.duration_seconds}
              onChange={(e) => setNotification({...notification, duration_seconds: parseInt(e.target.value) || 10})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              min="1"
              max="300"
            />
          </div>
        </div>
      </div>

      {/* القسم الثالث: المظهر */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2 flex items-center gap-2">
          <Palette size={16} />
          {tr('إعدادات المظهر', 'Appearance Settings')}
        </h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              <MapPin size={14} className="inline ml-1" />
              {tr('موقع الإشعار', 'Position')}
            </label>
            <select
              value={notification.position}
              onChange={(e) => setNotification({...notification, position: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              {NOTIFICATION_POSITIONS.map(pos => (
                <option key={pos.id} value={pos.id}>
                  {language === 'ar' ? pos.name : pos.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              <Type size={14} className="inline ml-1" />
              {tr('نوع الخط', 'Font Family')}
            </label>
            <select
              value={notification.font_family}
              onChange={(e) => setNotification({...notification, font_family: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              {AVAILABLE_FONTS.map(font => (
                <option key={font.id} value={font.id}>
                  {language === 'ar' ? font.name : font.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('حجم الخط', 'Font Size')}</label>
            <input
              type="number"
              value={notification.font_size}
              onChange={(e) => setNotification({...notification, font_size: parseInt(e.target.value) || 16})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              min="10"
              max="48"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('استدارة الحواف', 'Border Radius')}</label>
            <input
              type="number"
              value={notification.border_radius}
              onChange={(e) => setNotification({...notification, border_radius: parseInt(e.target.value) || 12})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              min="0"
              max="50"
            />
          </div>
        </div>

        {/* الألوان */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('لون النص', 'Text Color')}</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNotification({...notification, text_color: color})}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    notification.text_color === color ? 'border-[#C9A54C] scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={notification.text_color}
                onChange={(e) => setNotification({...notification, text_color: e.target.value})}
                className="w-8 h-8 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{tr('الخلفية', 'Background')}</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_BACKGROUNDS.map(bg => (
                <button
                  key={bg.id}
                  onClick={() => setNotification({...notification, background_type: bg.type, background_value: bg.value})}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    notification.background_value === bg.value ? 'border-[#C9A54C] scale-110' : 'border-transparent'
                  }`}
                  style={{ background: bg.value }}
                />
              ))}
              <input
                type="color"
                value={notification.background_type === 'color' ? notification.background_value : '#8A1538'}
                onChange={(e) => setNotification({...notification, background_type: 'color', background_value: e.target.value})}
                className="w-8 h-8 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* الرسوم المتحركة */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{tr('الرسوم المتحركة', 'Animation')}</label>
          <select
            value={notification.animation}
            onChange={(e) => setNotification({...notification, animation: e.target.value})}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white max-w-xs"
          >
            <option value="none">{tr('بدون', 'None')}</option>
            <option value="slide-down">{tr('انزلاق للأسفل', 'Slide Down')}</option>
            <option value="slide-up">{tr('انزلاق للأعلى', 'Slide Up')}</option>
            <option value="fade">{tr('تلاشي', 'Fade')}</option>
            <option value="scale">{tr('تكبير', 'Scale')}</option>
            <option value="bounce">{tr('ارتداد', 'Bounce')}</option>
          </select>
        </div>
      </div>

      {/* القسم الرابع: التحكم */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2 flex items-center gap-2">
          <Settings size={16} />
          {tr('إعدادات التحكم', 'Control Settings')}
        </h5>
        
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <span className="text-sm">{tr('مفعّل', 'Active')}</span>
            <button
              onClick={() => setNotification({...notification, is_active: !notification.is_active})}
              className={`w-12 h-6 rounded-full transition-all ${notification.is_active ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${notification.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <span className="text-sm">{tr('مخفي', 'Hidden')}</span>
            <button
              onClick={() => setNotification({...notification, is_hidden: !notification.is_hidden})}
              className={`w-12 h-6 rounded-full transition-all ${notification.is_hidden ? 'bg-orange-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${notification.is_hidden ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* معاينة الإشعار */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-[#C9A54C] border-b border-white/10 pb-2 flex items-center gap-2">
          <Eye size={16} />
          {tr('معاينة الإشعار', 'Notification Preview')}
        </h5>
        
        <div 
          className="p-4 rounded-xl transition-all"
          style={{
            background: notification.background_value,
            borderRadius: `${notification.border_radius}px`,
            fontFamily: AVAILABLE_FONTS.find(f => f.id === notification.font_family)?.family || 'inherit',
            fontSize: `${notification.font_size}px`,
            color: notification.text_color,
          }}
        >
          <h4 className="font-bold mb-2">{notification.title || tr('عنوان الإشعار', 'Notification Title')}</h4>
          <p>{notification.message || tr('نص الإشعار سيظهر هنا', 'Notification message will appear here')}</p>
          {notification.target_patient_id && (
            <p className="text-xs mt-2 opacity-75">
              {tr('موجه لـ:', 'Targeted to:')} {notification.target_patient_id}
            </p>
          )}
        </div>
      </div>

      {/* أزرار الحفظ والإلغاء */}
      <div className="flex gap-2 pt-4 border-t border-white/10">
        <button
          onClick={onSave}
          disabled={!notification.title || !notification.message}
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
          <Bell className="text-[#C9A54C]" />
          {tr('إدارة الإشعارات المتقدمة', 'Advanced Notifications Management')}
        </h3>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            {tr('إضافة إشعار', 'Add Notification')}
          </button>
          <button
            onClick={loadNotifications}
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
            placeholder={tr('بحث بالعنوان أو الرسالة أو رقم المراجع...', 'Search by title, message, or patient ID...')}
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
          <option value="sent">{tr('مرسل', 'Sent')}</option>
          <option value="draft">{tr('مسودة', 'Draft')}</option>
        </select>
      </div>

      {/* نموذج إضافة إشعار جديد */}
      {showAddForm && (
        <NotificationForm
          notification={newNotification}
          setNotification={setNewNotification}
          onSave={addNotification}
          onCancel={() => {
            setShowAddForm(false);
            setNewNotification(defaultNotification);
          }}
        />
      )}

      {/* نموذج تعديل إشعار */}
      {editingNotification && (
        <NotificationForm
          notification={editingNotification}
          setNotification={setEditingNotification}
          onSave={() => updateNotification(editingNotification)}
          onCancel={() => setEditingNotification(null)}
          isEditing
        />
      )}

      {/* قائمة الإشعارات */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
            {tr('جاري التحميل...', 'Loading...')}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bell className="mx-auto mb-2 opacity-50" size={48} />
            {tr('لا توجد إشعارات', 'No notifications found')}
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border transition-all ${
                notification.is_hidden ? 'opacity-50 border-orange-500/30' :
                !notification.is_active ? 'opacity-75 border-red-500/30' :
                'border-white/10'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold">{notification.title}</h4>
                      
                      {/* شارات الحالة */}
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        notification.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                        notification.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {notification.status === 'sent' ? tr('مرسل', 'Sent') :
                         notification.status === 'draft' ? tr('مسودة', 'Draft') :
                         tr('في الانتظار', 'Queued')}
                      </span>
                      
                      {!notification.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                          {tr('معطّل', 'Disabled')}
                        </span>
                      )}
                      
                      {notification.is_hidden && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">
                          {tr('مخفي', 'Hidden')}
                        </span>
                      )}
                      
                      {notification.target_patient_id && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 flex items-center gap-1">
                          <User size={10} />
                          {notification.target_patient_id}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-300 text-sm mb-2">{notification.message}</p>
                    
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      {notification.clinics && (
                        <span>{tr('العيادة:', 'Clinic:')} {language === 'ar' ? notification.clinics.name_ar : notification.clinics.name_en}</span>
                      )}
                      {notification.scheduled_at && (
                        <span>{tr('مجدول:', 'Scheduled:')} {new Date(notification.scheduled_at).toLocaleString('ar-QA')}</span>
                      )}
                      <span>{tr('المدة:', 'Duration:')} {notification.duration_seconds || 10} {tr('ث', 's')}</span>
                      <span>{tr('الموقع:', 'Position:')} {NOTIFICATION_POSITIONS.find(p => p.id === notification.position)?.[language === 'ar' ? 'name' : 'nameEn'] || notification.position}</span>
                    </div>
                  </div>

                  {/* أزرار التحكم */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleActive(notification.id, notification.is_active)}
                      className={`p-2 rounded-lg transition-all ${
                        notification.is_active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                      title={notification.is_active ? tr('إيقاف', 'Disable') : tr('تفعيل', 'Enable')}
                    >
                      {notification.is_active ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    
                    <button
                      onClick={() => toggleHidden(notification.id, notification.is_hidden)}
                      className={`p-2 rounded-lg transition-all ${
                        notification.is_hidden ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                      title={notification.is_hidden ? tr('إظهار', 'Show') : tr('إخفاء', 'Hide')}
                    >
                      {notification.is_hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    
                    {notification.status !== 'sent' && (
                      <button
                        onClick={() => sendNotification(notification.id)}
                        className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
                        title={tr('إرسال', 'Send')}
                      >
                        <Send size={18} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => setEditingNotification({...notification})}
                      className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                      title={tr('تعديل', 'Edit')}
                    >
                      <Edit size={18} />
                    </button>
                    
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                      title={tr('حذف', 'Delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdvancedNotificationsManager;
