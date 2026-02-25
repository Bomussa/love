import { useState, useEffect } from 'react'
import { Bell, Eye, EyeOff, Send, Settings, Save, Trash2, Plus, Clock, MapPin, Type, Palette, Move } from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import api from '../lib/api-unified'

/**
 * مكون إدارة الإشعارات المتقدم
 * يتيح للإدارة التحكم الكامل في جميع إشعارات التطبيق
 */
export default function NotificationManager({ language = 'ar' }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('system') // system, custom, send
  const [customNotification, setCustomNotification] = useState({
    title_ar: '',
    title_en: '',
    message_ar: '',
    message_en: '',
    target_number: '', // رقم معين أو فارغ للجميع
    icon: '📢',
    bg_color: '#4F46E5',
    text_color: '#FFFFFF',
    position: 'top-right',
    animation: 'slide',
    duration: 8,
    font_size: 'large',
    enabled: true
  })
  const [sendingNotification, setSendingNotification] = useState(false)

  const t = (ar, en) => language === 'ar' ? ar : en

  // إشعارات النظام الافتراضية
  const systemNotifications = [
    {
      id: 'welcome',
      name_ar: 'إشعار الترحيب',
      name_en: 'Welcome Notification',
      description_ar: 'يظهر عند دخول صفحة تسجيل الدخول',
      description_en: 'Shows on login page',
      icon: '👋',
      default_enabled: true
    },
    {
      id: 'queue_info',
      name_ar: 'معلومات الدور',
      name_en: 'Queue Info',
      description_ar: 'يظهر بعد اختيار نوع الفحص',
      description_en: 'Shows after selecting exam type',
      icon: '📋',
      default_enabled: true
    },
    {
      id: 'turn_alert',
      name_ar: 'تنبيه الدور',
      name_en: 'Turn Alert',
      description_ar: 'يظهر عند حلول الدور',
      description_en: 'Shows when it\'s your turn',
      icon: '🔔',
      default_enabled: true
    },
    {
      id: 'completion',
      name_ar: 'إتمام الفحوصات',
      name_en: 'Completion Notice',
      description_ar: 'يظهر عند إكمال جميع الفحوصات',
      description_en: 'Shows when all exams are completed',
      icon: '✅',
      default_enabled: true
    }
  ]

  // خيارات الإعدادات
  const positionOptions = [
    { value: 'top-right', label_ar: 'أعلى يمين', label_en: 'Top Right' },
    { value: 'top-left', label_ar: 'أعلى يسار', label_en: 'Top Left' },
    { value: 'top-center', label_ar: 'أعلى وسط', label_en: 'Top Center' },
    { value: 'bottom-right', label_ar: 'أسفل يمين', label_en: 'Bottom Right' },
    { value: 'bottom-left', label_ar: 'أسفل يسار', label_en: 'Bottom Left' },
    { value: 'bottom-center', label_ar: 'أسفل وسط', label_en: 'Bottom Center' },
    { value: 'center', label_ar: 'وسط الشاشة', label_en: 'Center' }
  ]

  const animationOptions = [
    { value: 'slide', label_ar: 'انزلاق', label_en: 'Slide' },
    { value: 'fade', label_ar: 'تلاشي', label_en: 'Fade' },
    { value: 'bounce', label_ar: 'قفز', label_en: 'Bounce' },
    { value: 'zoom', label_ar: 'تكبير', label_en: 'Zoom' },
    { value: 'none', label_ar: 'بدون', label_en: 'None' }
  ]

  const fontSizeOptions = [
    { value: 'small', label_ar: 'صغير', label_en: 'Small' },
    { value: 'medium', label_ar: 'متوسط', label_en: 'Medium' },
    { value: 'large', label_ar: 'كبير', label_en: 'Large' },
    { value: 'xlarge', label_ar: 'كبير جداً', label_en: 'Extra Large' }
  ]

  const iconOptions = ['📢', '🔔', '⚠️', '✅', '❌', '💡', '📋', '👋', '🎉', '⏰', '📍', '🏥']

  // تحميل إعدادات الإشعارات
  useEffect(() => {
    loadNotificationSettings()
  }, [])

  const loadNotificationSettings = async () => {
    try {
      const { data } = await api.supabase
        .from('notification_settings')
        .select('*')
      
      if (data) {
        setNotifications(data)
      }
    } catch (error) {
      console.error('Error loading notification settings:', error)
    } finally {
      setLoading(false)
    }
  }

  // حفظ إعدادات إشعار
  const saveNotificationSetting = async (notifId, settings) => {
    try {
      const { error } = await api.supabase
        .from('notification_settings')
        .upsert({
          id: notifId,
          ...settings,
          updated_at: new Date().toISOString()
        })
      
      if (!error) {
        loadNotificationSettings()
        alert(t('تم الحفظ بنجاح', 'Saved successfully'))
      }
    } catch (error) {
      console.error('Error saving notification settings:', error)
      alert(t('حدث خطأ في الحفظ', 'Error saving'))
    }
  }

  // إرسال إشعار مخصص
  const sendCustomNotification = async () => {
    if (!customNotification.title_ar && !customNotification.title_en) {
      alert(t('يرجى إدخال عنوان الإشعار', 'Please enter notification title'))
      return
    }

    setSendingNotification(true)
    try {
      // حفظ الإشعار في قاعدة البيانات
      const { error } = await api.supabase
        .from('custom_notifications')
        .insert({
          ...customNotification,
          created_at: new Date().toISOString(),
          status: 'active'
        })

      if (!error) {
        alert(t('تم إرسال الإشعار بنجاح', 'Notification sent successfully'))
        // إعادة تعيين النموذج
        setCustomNotification({
          title_ar: '',
          title_en: '',
          message_ar: '',
          message_en: '',
          target_number: '',
          icon: '📢',
          bg_color: '#4F46E5',
          text_color: '#FFFFFF',
          position: 'top-right',
          animation: 'slide',
          duration: 8,
          font_size: 'large',
          enabled: true
        })
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      alert(t('حدث خطأ في الإرسال', 'Error sending'))
    } finally {
      setSendingNotification(false)
    }
  }

  // معاينة الإشعار
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Bell className="w-7 h-7 text-yellow-400" />
          {t('إدارة الإشعارات', 'Notification Manager')}
        </h2>
      </div>

      {/* التبويبات */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeTab === 'system' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 inline-block mr-2" />
          {t('إشعارات النظام', 'System Notifications')}
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeTab === 'send' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <Send className="w-4 h-4 inline-block mr-2" />
          {t('إرسال إشعار', 'Send Notification')}
        </button>
      </div>

      {/* محتوى التبويبات */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          {systemNotifications.map((notif) => (
            <NotificationSettingCard
              key={notif.id}
              notification={notif}
              settings={notifications.find(n => n.id === notif.id) || {}}
              onSave={(settings) => saveNotificationSetting(notif.id, settings)}
              language={language}
              positionOptions={positionOptions}
              animationOptions={animationOptions}
              fontSizeOptions={fontSizeOptions}
              t={t}
            />
          ))}
        </div>
      )}

      {activeTab === 'send' && (
        <div className="bg-gray-800/50 rounded-xl p-6 space-y-6">
          <h3 className="text-xl font-bold text-white mb-4">
            {t('إرسال إشعار مخصص', 'Send Custom Notification')}
          </h3>

          {/* الهدف */}
          <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4">
            <label className="block text-sm font-medium text-yellow-400 mb-2">
              {t('إرسال إلى رقم معين (اختياري)', 'Send to specific number (optional)')}
            </label>
            <Input
              type="text"
              placeholder={t('اتركه فارغاً للإرسال للجميع', 'Leave empty to send to all')}
              value={customNotification.target_number}
              onChange={(e) => setCustomNotification({...customNotification, target_number: e.target.value})}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <p className="text-xs text-gray-400 mt-1">
              {t('أدخل الرقم العسكري لإرسال الإشعار لمراجع معين فقط', 'Enter military ID to send to specific patient only')}
            </p>
          </div>

          {/* العنوان */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('العنوان (عربي)', 'Title (Arabic)')}
              </label>
              <Input
                type="text"
                placeholder={t('عنوان الإشعار بالعربي', 'Arabic title')}
                value={customNotification.title_ar}
                onChange={(e) => setCustomNotification({...customNotification, title_ar: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('العنوان (إنجليزي)', 'Title (English)')}
              </label>
              <Input
                type="text"
                placeholder={t('عنوان الإشعار بالإنجليزي', 'English title')}
                value={customNotification.title_en}
                onChange={(e) => setCustomNotification({...customNotification, title_en: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          </div>

          {/* الرسالة */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('الرسالة (عربي)', 'Message (Arabic)')}
              </label>
              <textarea
                placeholder={t('نص الإشعار بالعربي', 'Arabic message')}
                value={customNotification.message_ar}
                onChange={(e) => setCustomNotification({...customNotification, message_ar: e.target.value})}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-3 min-h-[100px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('الرسالة (إنجليزي)', 'Message (English)')}
              </label>
              <textarea
                placeholder={t('نص الإشعار بالإنجليزي', 'English message')}
                value={customNotification.message_en}
                onChange={(e) => setCustomNotification({...customNotification, message_en: e.target.value})}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-3 min-h-[100px]"
              />
            </div>
          </div>

          {/* الإعدادات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* الأيقونة */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Type className="w-4 h-4 inline-block mr-1" />
                {t('الأيقونة', 'Icon')}
              </label>
              <div className="flex flex-wrap gap-1">
                {iconOptions.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setCustomNotification({...customNotification, icon})}
                    className={`text-2xl p-1 rounded ${customNotification.icon === icon ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* الموقع */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <MapPin className="w-4 h-4 inline-block mr-1" />
                {t('الموقع', 'Position')}
              </label>
              <select
                value={customNotification.position}
                onChange={(e) => setCustomNotification({...customNotification, position: e.target.value})}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2"
              >
                {positionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.label_ar : opt.label_en}
                  </option>
                ))}
              </select>
            </div>

            {/* طريقة الظهور */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Move className="w-4 h-4 inline-block mr-1" />
                {t('الحركة', 'Animation')}
              </label>
              <select
                value={customNotification.animation}
                onChange={(e) => setCustomNotification({...customNotification, animation: e.target.value})}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2"
              >
                {animationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.label_ar : opt.label_en}
                  </option>
                ))}
              </select>
            </div>

            {/* المدة */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Clock className="w-4 h-4 inline-block mr-1" />
                {t('المدة (ثانية)', 'Duration (sec)')}
              </label>
              <Input
                type="number"
                min="1"
                max="60"
                value={customNotification.duration}
                onChange={(e) => setCustomNotification({...customNotification, duration: parseInt(e.target.value) || 8})}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          </div>

          {/* الألوان والحجم */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* لون الخلفية */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Palette className="w-4 h-4 inline-block mr-1" />
                {t('لون الخلفية', 'Background Color')}
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customNotification.bg_color}
                  onChange={(e) => setCustomNotification({...customNotification, bg_color: e.target.value})}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={customNotification.bg_color}
                  onChange={(e) => setCustomNotification({...customNotification, bg_color: e.target.value})}
                  className="bg-gray-700 border-gray-600 text-white flex-1"
                />
              </div>
            </div>

            {/* لون النص */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('لون النص', 'Text Color')}
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customNotification.text_color}
                  onChange={(e) => setCustomNotification({...customNotification, text_color: e.target.value})}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={customNotification.text_color}
                  onChange={(e) => setCustomNotification({...customNotification, text_color: e.target.value})}
                  className="bg-gray-700 border-gray-600 text-white flex-1"
                />
              </div>
            </div>

            {/* حجم الخط */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('حجم الخط', 'Font Size')}
              </label>
              <select
                value={customNotification.font_size}
                onChange={(e) => setCustomNotification({...customNotification, font_size: e.target.value})}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2"
              >
                {fontSizeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.label_ar : opt.label_en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* معاينة */}
          <div className="border border-gray-600 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3">{t('معاينة', 'Preview')}</h4>
            <div 
              className="rounded-2xl p-5 max-w-sm"
              style={{ 
                backgroundColor: customNotification.bg_color,
                color: customNotification.text_color
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{customNotification.icon}</span>
                <h3 className={`font-bold ${
                  customNotification.font_size === 'small' ? 'text-base' :
                  customNotification.font_size === 'medium' ? 'text-lg' :
                  customNotification.font_size === 'large' ? 'text-xl' : 'text-2xl'
                }`}>
                  {language === 'ar' ? customNotification.title_ar || 'العنوان' : customNotification.title_en || 'Title'}
                </h3>
              </div>
              <div className={`font-medium whitespace-pre-line ${
                customNotification.font_size === 'small' ? 'text-sm' :
                customNotification.font_size === 'medium' ? 'text-base' :
                customNotification.font_size === 'large' ? 'text-lg' : 'text-xl'
              }`}>
                {language === 'ar' ? customNotification.message_ar || 'نص الرسالة' : customNotification.message_en || 'Message text'}
              </div>
            </div>
          </div>

          {/* أزرار الإرسال */}
          <div className="flex gap-3">
            <Button
              onClick={sendCustomNotification}
              disabled={sendingNotification}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Send className="w-5 h-5 mr-2" />
              {sendingNotification ? t('جاري الإرسال...', 'Sending...') : t('إرسال الإشعار', 'Send Notification')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// مكون بطاقة إعدادات الإشعار
function NotificationSettingCard({ notification, settings, onSave, language, positionOptions, animationOptions, fontSizeOptions, t }) {
  const [localSettings, setLocalSettings] = useState({
    enabled: settings.enabled ?? true,
    position: settings.position || 'top-right',
    animation: settings.animation || 'slide',
    duration: settings.duration || 8,
    font_size: settings.font_size || 'large',
    bg_color: settings.bg_color || '#4F46E5',
    text_color: settings.text_color || '#FFFFFF',
    ...settings
  })
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-800/50 rounded-xl overflow-hidden">
      {/* الرأس */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{notification.icon}</span>
          <div>
            <h3 className="text-lg font-bold text-white">
              {language === 'ar' ? notification.name_ar : notification.name_en}
            </h3>
            <p className="text-sm text-gray-400">
              {language === 'ar' ? notification.description_ar : notification.description_en}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setLocalSettings({...localSettings, enabled: !localSettings.enabled})
            }}
            className={`p-2 rounded-lg ${localSettings.enabled ? 'bg-green-600' : 'bg-gray-600'}`}
          >
            {localSettings.enabled ? <Eye className="w-5 h-5 text-white" /> : <EyeOff className="w-5 h-5 text-white" />}
          </button>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* الإعدادات المفصلة */}
      {expanded && (
        <div className="p-4 border-t border-gray-700 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* الموقع */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('الموقع', 'Position')}</label>
              <select
                value={localSettings.position}
                onChange={(e) => setLocalSettings({...localSettings, position: e.target.value})}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2"
              >
                {positionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.label_ar : opt.label_en}
                  </option>
                ))}
              </select>
            </div>

            {/* الحركة */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('الحركة', 'Animation')}</label>
              <select
                value={localSettings.animation}
                onChange={(e) => setLocalSettings({...localSettings, animation: e.target.value})}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2"
              >
                {animationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.label_ar : opt.label_en}
                  </option>
                ))}
              </select>
            </div>

            {/* المدة */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('المدة (ثانية)', 'Duration')}</label>
              <Input
                type="number"
                min="1"
                max="60"
                value={localSettings.duration}
                onChange={(e) => setLocalSettings({...localSettings, duration: parseInt(e.target.value) || 8})}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            {/* حجم الخط */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('حجم الخط', 'Font Size')}</label>
              <select
                value={localSettings.font_size}
                onChange={(e) => setLocalSettings({...localSettings, font_size: e.target.value})}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2"
              >
                {fontSizeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.label_ar : opt.label_en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* الألوان */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('لون الخلفية', 'Background')}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={localSettings.bg_color}
                  onChange={(e) => setLocalSettings({...localSettings, bg_color: e.target.value})}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={localSettings.bg_color}
                  onChange={(e) => setLocalSettings({...localSettings, bg_color: e.target.value})}
                  className="bg-gray-700 border-gray-600 text-white flex-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('لون النص', 'Text Color')}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={localSettings.text_color}
                  onChange={(e) => setLocalSettings({...localSettings, text_color: e.target.value})}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={localSettings.text_color}
                  onChange={(e) => setLocalSettings({...localSettings, text_color: e.target.value})}
                  className="bg-gray-700 border-gray-600 text-white flex-1"
                />
              </div>
            </div>
          </div>

          {/* زر الحفظ */}
          <Button
            onClick={() => onSave(localSettings)}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            <Save className="w-5 h-5 mr-2" />
            {t('حفظ الإعدادات', 'Save Settings')}
          </Button>
        </div>
      )}
    </div>
  )
}
