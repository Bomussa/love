import React, { useState, useEffect } from 'react';
import { Bell, Plus, RefreshCw, Edit, Trash2, Play, Eye, Send, User, Clock, Palette, Type, Move, Timer, Square, Zap } from 'lucide-react';
import { apiClient } from "@/lib/api/client";
import OperationalNotificationsManager from './OperationalNotificationsManager';

// خيارات مواقع الظهور
const POSITION_OPTIONS = [
  { value: 'top-right', label_ar: 'أعلى يمين', label_en: 'Top Right' },
  { value: 'top-left', label_ar: 'أعلى يسار', label_en: 'Top Left' },
  { value: 'top-center', label_ar: 'أعلى وسط', label_en: 'Top Center' },
  { value: 'bottom-right', label_ar: 'أسفل يمين', label_en: 'Bottom Right' },
  { value: 'bottom-left', label_ar: 'أسفل يسار', label_en: 'Bottom Left' },
  { value: 'bottom-center', label_ar: 'أسفل وسط', label_en: 'Bottom Center' },
  { value: 'center', label_ar: 'وسط الشاشة', label_en: 'Center' },
];

// خيارات أحجام الخط
const FONT_SIZE_OPTIONS = [
  { value: 'small', label_ar: 'صغير', label_en: 'Small', size: '12px' },
  { value: 'medium', label_ar: 'متوسط', label_en: 'Medium', size: '14px' },
  { value: 'large', label_ar: 'كبير', label_en: 'Large', size: '16px' },
  { value: 'xlarge', label_ar: 'كبير جداً', label_en: 'Extra Large', size: '20px' },
];

// خيارات أنواع الإشعارات
const NOTIFICATION_TYPES = [
  { value: 'call', label_ar: 'استدعاء', label_en: 'Call', color: '#EF4444' },
  { value: 'alert', label_ar: 'تنبيه', label_en: 'Alert', color: '#F59E0B' },
  { value: 'update', label_ar: 'تحديث', label_en: 'Update', color: '#3B82F6' },
  { value: 'info', label_ar: 'معلومات', label_en: 'Info', color: '#10B981' },
];

// ألوان مقترحة
const PRESET_COLORS = [
  '#8A1538', '#C9A54C', '#EF4444', '#F59E0B', '#10B981', 
  '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF', '#000000'
];

const NotificationsManagementV2 = ({ language, t }) => {
  const [activeTab, setActiveTab] = useState('manual');
  const [notifications, setNotifications] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [previewNotification, setPreviewNotification] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // حالة الإشعار الجديد مع كامل الخيارات
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'info',
    patient_id: '', // للاستدعاء الشخصي
    clinic_id: null,
    priority: 'normal',
    // خيارات العرض
    display_position: 'top-right',
    display_duration: 5,
    font_size: 'medium',
    font_color: '#FFFFFF',
    background_color: '#8A1538',
    border_color: '#C9A54C',
    // جدولة
    scheduled_at: '',
    is_active: true
  });

  useEffect(() => {
    loadNotifications();
    loadClinics();
    loadPatients();
  }, []);

  const loadClinics = async () => {
    try {
      const { data } = await supabase.from('clinics').select('id, name_ar, name_en').order('name_ar');
      if (data) setClinics(data);
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  const loadPatients = async () => {
    try {
      // جلب المرضى المسجلين اليوم
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('patients')
        .select('id, military_number, gender')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });
      if (data) setPatients(data);
    } catch (e) {
      console.error('Error loading patients:', e);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*, clinics(name_ar, name_en)')
        .order('created_at', { ascending: false });
      
      if (!error && data) setNotifications(data);
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const addNotification = async () => {
    try {
      const notifData = {
        title: newNotification.title,
        message: newNotification.message,
        type: newNotification.type,
        patient_id: newNotification.patient_id || null,
        clinic_id: newNotification.clinic_id || null,
        is_read: false,
        display_position: newNotification.display_position,
        display_duration: newNotification.display_duration,
        font_size: newNotification.font_size,
        font_color: newNotification.font_color,
        background_color: newNotification.background_color,
        border_color: newNotification.border_color,
        scheduled_at: newNotification.scheduled_at || null,
        is_active: newNotification.is_active,
        metadata: {
          priority: newNotification.priority || 'normal'
        }
      };
      
      const { error } = await supabase.from('notifications').insert(notifData);
      
      if (error) {
        console.error('Error adding notification:', error);
        alert(t('خطأ في إضافة الإشعار', 'Error adding notification'));
        return;
      }
      
      loadNotifications();
      setShowAddForm(false);
      resetNewNotification();
      alert(t('تم إضافة الإشعار بنجاح', 'Notification added successfully'));
    } catch (e) {
      console.error('Error adding notification:', e);
    }
  };

  const resetNewNotification = () => {
    setNewNotification({
      title: '',
      message: '',
      type: 'info',
      patient_id: '',
      clinic_id: null,
      priority: 'normal',
      display_position: 'top-right',
      display_duration: 5,
      font_size: 'medium',
      font_color: '#FFFFFF',
      background_color: '#8A1538',
      border_color: '#C9A54C',
      scheduled_at: '',
      is_active: true
    });
  };

  const updateNotification = async () => {
    if (!editingNotification) return;
    try {
      const { error } = await supabase.from('notifications').update({
        title: editingNotification.title,
        message: editingNotification.message,
        type: editingNotification.type,
        patient_id: editingNotification.patient_id || null,
        clinic_id: editingNotification.clinic_id || null,
        display_position: editingNotification.display_position,
        display_duration: editingNotification.display_duration,
        font_size: editingNotification.font_size,
        font_color: editingNotification.font_color,
        background_color: editingNotification.background_color,
        border_color: editingNotification.border_color,
        scheduled_at: editingNotification.scheduled_at || null,
        is_active: editingNotification.is_active,
        metadata: {
          priority: editingNotification.priority || 'normal'
        }
      }).eq('id', editingNotification.id);
      
      if (!error) {
        loadNotifications();
        setEditingNotification(null);
        alert(t('تم تحديث الإشعار بنجاح', 'Notification updated successfully'));
      }
    } catch (e) {
      console.error('Error updating notification:', e);
    }
  };

  const sendNotification = async (id) => {
    try {
      await supabase.from('notifications').update({ 
        sent_at: new Date().toISOString()
      }).eq('id', id);
      loadNotifications();
      alert(t('تم إرسال الإشعار', 'Notification sent'));
    } catch (e) {
      console.error('Error sending notification:', e);
    }
  };

  const deleteNotification = async (id) => {
    if (!window.confirm(t('هل أنت متأكد من الحذف؟', 'Are you sure you want to delete?'))) return;
    try {
      await supabase.from('notifications').delete().eq('id', id);
      loadNotifications();
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ar-QA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // مكون معاينة الإشعار
  const NotificationPreview = ({ notification }) => {
    const positionStyles = {
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' },
      'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' },
      'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    };

    const fontSizes = {
      'small': '12px',
      'medium': '14px',
      'large': '16px',
      'xlarge': '20px'
    };

    return (
      <div 
        className="fixed z-50 p-4 rounded-xl shadow-2xl max-w-sm animate-pulse"
        style={{
          ...positionStyles[notification.display_position || 'top-right'],
          backgroundColor: notification.background_color || '#8A1538',
          borderColor: notification.border_color || '#C9A54C',
          borderWidth: '2px',
          borderStyle: 'solid',
          color: notification.font_color || '#FFFFFF',
          fontSize: fontSizes[notification.font_size || 'medium']
        }}
      >
        <div className="font-bold mb-2">{notification.title || 'عنوان الإشعار'}</div>
        <div>{notification.message || 'نص الإشعار'}</div>
        <div className="text-xs mt-2 opacity-70">
          {t('مدة الظهور:', 'Duration:')} {notification.display_duration || 5} {t('ثانية', 'seconds')}
        </div>
      </div>
    );
  };

  // نموذج الإشعار (مشترك بين الإضافة والتعديل)
  const NotificationForm = ({ notification, setNotification, onSave, onCancel, isEdit = false }) => (
    <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
      <h4 className="font-bold mb-4 text-lg">
        {isEdit ? t('تعديل الإشعار', 'Edit Notification') : t('إضافة إشعار جديد', 'Add New Notification')}
      </h4>
      
      {/* القسم الأول: المعلومات الأساسية */}
      <div className="mb-6">
        <h5 className="text-[#C9A54C] font-medium mb-3 flex items-center gap-2">
          <Bell size={16} />
          {t('المعلومات الأساسية', 'Basic Information')}
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('العنوان', 'Title')} *</label>
            <input
              type="text"
              value={notification.title}
              onChange={(e) => setNotification({...notification, title: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              placeholder={t('عنوان الإشعار', 'Notification title')}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('النوع', 'Type')}</label>
            <select
              value={notification.type}
              onChange={(e) => setNotification({...notification, type: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              {NOTIFICATION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {language === 'ar' ? type.label_ar : type.label_en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('الأولوية', 'Priority')}</label>
            <select
              value={notification.priority}
              onChange={(e) => setNotification({...notification, priority: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              <option value="low">{t('منخفضة', 'Low')}</option>
              <option value="normal">{t('عادية', 'Normal')}</option>
              <option value="high">{t('عالية', 'High')}</option>
              <option value="urgent">{t('عاجلة', 'Urgent')}</option>
            </select>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm text-gray-400 mb-2">{t('الرسالة', 'Message')} *</label>
            <textarea
              value={notification.message}
              onChange={(e) => setNotification({...notification, message: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white h-20"
              placeholder={t('نص الإشعار', 'Notification message')}
            />
          </div>
        </div>
      </div>

      {/* القسم الثاني: الاستهداف */}
      <div className="mb-6">
        <h5 className="text-[#C9A54C] font-medium mb-3 flex items-center gap-2">
          <User size={16} />
          {t('الاستهداف', 'Targeting')}
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('رقم المراجع (للاستدعاء الشخصي)', 'Patient ID (for personal call)')}</label>
            <input
              type="text"
              value={notification.patient_id || ''}
              onChange={(e) => setNotification({...notification, patient_id: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              placeholder={t('اتركه فارغاً للإشعار العام', 'Leave empty for general notification')}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('أدخل الرقم العسكري للمراجع لإرسال إشعار شخصي له فقط', 'Enter military number for personal notification')}
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('العيادة', 'Clinic')}</label>
            <select
              value={notification.clinic_id || ''}
              onChange={(e) => setNotification({...notification, clinic_id: e.target.value || null})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              <option value="">{t('جميع العيادات', 'All Clinics')}</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* القسم الثالث: خيارات العرض */}
      <div className="mb-6">
        <h5 className="text-[#C9A54C] font-medium mb-3 flex items-center gap-2">
          <Palette size={16} />
          {t('خيارات العرض', 'Display Options')}
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('مكان الظهور', 'Position')}</label>
            <select
              value={notification.display_position}
              onChange={(e) => setNotification({...notification, display_position: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              {POSITION_OPTIONS.map(pos => (
                <option key={pos.value} value={pos.value}>
                  {language === 'ar' ? pos.label_ar : pos.label_en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('مدة الظهور (ثانية)', 'Duration (seconds)')}</label>
            <input
              type="number"
              min="1"
              max="60"
              value={notification.display_duration}
              onChange={(e) => setNotification({...notification, display_duration: parseInt(e.target.value) || 5})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('حجم الخط', 'Font Size')}</label>
            <select
              value={notification.font_size}
              onChange={(e) => setNotification({...notification, font_size: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            >
              {FONT_SIZE_OPTIONS.map(size => (
                <option key={size.value} value={size.value}>
                  {language === 'ar' ? size.label_ar : size.label_en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('وقت الجدولة', 'Schedule Time')}</label>
            <input
              type="datetime-local"
              value={notification.scheduled_at || ''}
              onChange={(e) => setNotification({...notification, scheduled_at: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
            />
          </div>
        </div>
      </div>

      {/* القسم الرابع: الألوان */}
      <div className="mb-6">
        <h5 className="text-[#C9A54C] font-medium mb-3 flex items-center gap-2">
          <Square size={16} />
          {t('الألوان', 'Colors')}
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('لون الخلفية', 'Background Color')}</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={notification.background_color}
                onChange={(e) => setNotification({...notification, background_color: e.target.value})}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={notification.background_color}
                onChange={(e) => setNotification({...notification, background_color: e.target.value})}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNotification({...notification, background_color: color})}
                  className="w-6 h-6 rounded border border-white/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('لون الخط', 'Font Color')}</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={notification.font_color}
                onChange={(e) => setNotification({...notification, font_color: e.target.value})}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={notification.font_color}
                onChange={(e) => setNotification({...notification, font_color: e.target.value})}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNotification({...notification, font_color: color})}
                  className="w-6 h-6 rounded border border-white/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('لون الإطار', 'Border Color')}</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={notification.border_color}
                onChange={(e) => setNotification({...notification, border_color: e.target.value})}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={notification.border_color}
                onChange={(e) => setNotification({...notification, border_color: e.target.value})}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNotification({...notification, border_color: color})}
                  className="w-6 h-6 rounded border border-white/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* معاينة مصغرة */}
      <div className="mb-6 p-4 bg-black/30 rounded-xl">
        <h5 className="text-gray-400 text-sm mb-3">{t('معاينة الإشعار', 'Notification Preview')}</h5>
        <div 
          className="p-4 rounded-xl max-w-sm"
          style={{
            backgroundColor: notification.background_color,
            borderColor: notification.border_color,
            borderWidth: '2px',
            borderStyle: 'solid',
            color: notification.font_color,
            fontSize: FONT_SIZE_OPTIONS.find(f => f.value === notification.font_size)?.size || '14px'
          }}
        >
          <div className="font-bold mb-1">{notification.title || t('عنوان الإشعار', 'Notification Title')}</div>
          <div>{notification.message || t('نص الإشعار', 'Notification message')}</div>
        </div>
      </div>

      {/* أزرار الحفظ والإلغاء */}
      <div className="flex gap-2">
        <button 
          onClick={onSave} 
          disabled={!notification.title || !notification.message}
          className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send size={16} />
          {isEdit ? t('تحديث', 'Update') : t('حفظ', 'Save')}
        </button>
        <button 
          onClick={() => {
            setPreviewNotification(notification);
            setShowPreview(true);
            setTimeout(() => setShowPreview(false), (notification.display_duration || 5) * 1000);
          }}
          className="px-6 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-all flex items-center gap-2"
        >
          <Eye size={16} />
          {t('معاينة', 'Preview')}
        </button>
        <button 
          onClick={onCancel} 
          className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
        >
          {t('إلغاء', 'Cancel')}
        </button>
      </div>
    </div>
  );

   return (
    <div className="space-y-6">
      {/* معاينة الإشعار */}
      {showPreview && previewNotification && (
        <NotificationPreview notification={previewNotification} />
      )}
      {/* العنوان الرئيسي */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('إدارة الإشعارات', 'Notifications Management')}</h3>
      </div>
      {/* تبويبات الإشعارات */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-5 py-3 font-medium rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'manual'
              ? 'bg-[#8A1538] text-white border border-white/10 border-b-0'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Bell size={16} />
          {t('الإشعارات اليدوية', 'Manual Notifications')}
        </button>
        <button
          onClick={() => setActiveTab('operational')}
          className={`px-5 py-3 font-medium rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'operational'
              ? 'bg-[#8A1538] text-white border border-white/10 border-b-0'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap size={16} />
          {t('الإشعارات التشغيلية', 'Operational Notifications')}
        </button>
      </div>
      {/* محتوى التبويب: الإشعارات التشغيلية */}
      {activeTab === 'operational' && (
        <OperationalNotificationsManager language={language} t={t} />
      )}
      {/* محتوى التبويب: الإشعارات اليدوية */}
      {activeTab === 'manual' && (<>
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            {t('إضافة إشعار', 'Add Notification')}
          </button>
          <button 
            onClick={loadNotifications}
            className="p-2 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] border border-white/10 rounded-xl hover:bg-[#8A1538] transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* نموذج إضافة إشعار جديد */}
      {showAddForm && (
        <NotificationForm
          notification={newNotification}
          setNotification={setNewNotification}
          onSave={addNotification}
          onCancel={() => { setShowAddForm(false); resetNewNotification(); }}
          isEdit={false}
        />
      )}

      {/* نموذج تعديل إشعار */}
      {editingNotification && (
        <NotificationForm
          notification={editingNotification}
          setNotification={setEditingNotification}
          onSave={updateNotification}
          onCancel={() => setEditingNotification(null)}
          isEdit={true}
        />
      )}

      {/* جدول الإشعارات */}
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-right p-4 text-gray-400 font-medium">{t('العنوان', 'Title')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('النوع', 'Type')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('المستهدف', 'Target')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('المكان', 'Position')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('وقت الإنشاء', 'Created')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('وقت الإرسال', 'Sent')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map(notif => (
                <tr key={notif.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="font-medium">{notif.title}</div>
                    <div className="text-sm text-gray-400 truncate max-w-xs">{notif.message}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      notif.type === 'call' ? 'bg-red-500/20 text-red-400' :
                      notif.type === 'alert' ? 'bg-yellow-500/20 text-yellow-400' :
                      notif.type === 'update' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {NOTIFICATION_TYPES.find(t => t.value === notif.type)?.[language === 'ar' ? 'label_ar' : 'label_en'] || notif.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">
                      {notif.patient_id ? (
                        <span className="text-[#C9A54C]">{t('مراجع:', 'Patient:')} {notif.patient_id}</span>
                      ) : notif.clinics ? (
                        language === 'ar' ? notif.clinics.name_ar : notif.clinics.name_en
                      ) : (
                        t('عام', 'General')
                      )}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    {POSITION_OPTIONS.find(p => p.value === notif.display_position)?.[language === 'ar' ? 'label_ar' : 'label_en'] || notif.display_position || '-'}
                  </td>
                  <td className="p-4 text-sm text-gray-400">{formatDate(notif.created_at)}</td>
                  <td className="p-4 text-sm text-gray-400">{formatDate(notif.sent_at)}</td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      {!notif.sent_at && (
                        <button
                          onClick={() => sendNotification(notif.id)}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                          title={t('إرسال', 'Send')}
                        >
                          <Play size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setPreviewNotification(notif);
                          setShowPreview(true);
                          setTimeout(() => setShowPreview(false), (notif.display_duration || 5) * 1000);
                        }}
                        className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all"
                        title={t('معاينة', 'Preview')}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => setEditingNotification({
                          ...notif, 
                          priority: notif.metadata?.priority || 'normal',
                          display_position: notif.display_position || 'top-right',
                          display_duration: notif.display_duration || 5,
                          font_size: notif.font_size || 'medium',
                          font_color: notif.font_color || '#FFFFFF',
                          background_color: notif.background_color || '#8A1538',
                          border_color: notif.border_color || '#C9A54C'
                        })}
                        className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
                        title={t('تعديل', 'Edit')}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                        title={t('حذف', 'Delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {notifications.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <Bell size={48} className="mx-auto mb-4 opacity-50" />
            {t('لا توجد إشعارات', 'No notifications found')}
          </div>
        )}
      </div>
      </>)}
    </div>
  );
};

export default NotificationsManagementV2;
