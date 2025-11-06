import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Clock, Settings, Save, RefreshCw, Eye, EyeOff, Play, Pause } from 'lucide-react'
import api from '../lib/api-unified'

export function SystemSettingsPanel({ language = 'ar' }) {
  const [settings, setSettings] = useState({
    // توقيتات النظام
    queueIntervalSeconds: 120,        // 2 دقيقة للنداء التلقائي
    patientMaxWaitSeconds: 240,       // 4 دقائق للمراجع
    refreshIntervalSeconds: 30,       // تحديث البيانات
    nearTurnRefreshSeconds: 7,        // تحديث عند قرب الدور
    
    // تفعيل/تعطيل الأنظمة
    autoCallEnabled: true,            // النداء التلقائي
    timeoutHandlerEnabled: true,      // نقل المراجع بعد 4 دقائق
    notificationsEnabled: true,       // الإشعارات
    
    // إظهار/إخفاء للمراجعين
    showCountdownTimer: true,         // عرض العد التنازلي
    showQueuePosition: true,          // عرض الموقع في الدور
    showEstimatedWait: true,          // عرض الوقت المتوقع
    showAheadCount: true,             // عرض عدد المنتظرين قبله
    
    // إعدادات إضافية
    notifyNearAhead: 3,               // إشعار للـ3 التاليين
    pinLateMinutes: 5,                // مهلة تأخير PIN
    noticeTtlSeconds: 30              // مدة عرض الإشعار
  })
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // تحميل الإعدادات من Backend
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await api.getSystemSettings()
      if (data && data.success) {
        setSettings(prev => ({ ...prev, ...data.settings }))
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      showMessage('فشل تحميل الإعدادات', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await api.updateSystemSettings(settings)
      if (result && result.success) {
        showMessage('تم حفظ الإعدادات بنجاح', 'success')
      } else {
        showMessage('فشل حفظ الإعدادات', 'error')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      showMessage('فشل حفظ الإعدادات', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('هل أنت متأكد من إعادة تعيين الإعدادات للقيم الافتراضية؟')) {
      return
    }
    
    setSaving(true)
    try {
      const result = await api.resetSystemSettings()
      if (result && result.success) {
        setSettings(prev => ({ ...prev, ...result.settings }))
        showMessage('تم إعادة تعيين الإعدادات', 'success')
      }
    } catch (error) {
      console.error('Failed to reset settings:', error)
      showMessage('فشل إعادة التعيين', 'error')
    } finally {
      setSaving(false)
    }
  }

  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="animate-spin ml-2" />
            <span>جاري تحميل الإعدادات...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* رسالة النجاح/الخطأ */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-300' 
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* توقيتات النظام */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            توقيتات النظام (بالثواني)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                فترة النداء التلقائي (ثانية)
              </label>
              <Input
                type="number"
                min="30"
                max="300"
                value={settings.queueIntervalSeconds}
                onChange={(e) => updateSetting('queueIntervalSeconds', parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                الحالي: {settings.queueIntervalSeconds} ثانية ({Math.floor(settings.queueIntervalSeconds / 60)} دقيقة)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                المهلة القصوى للمراجع (ثانية)
              </label>
              <Input
                type="number"
                min="60"
                max="600"
                value={settings.patientMaxWaitSeconds}
                onChange={(e) => updateSetting('patientMaxWaitSeconds', parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                الحالي: {settings.patientMaxWaitSeconds} ثانية ({Math.floor(settings.patientMaxWaitSeconds / 60)} دقيقة)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                فترة تحديث البيانات (ثانية)
              </label>
              <Input
                type="number"
                min="5"
                max="60"
                value={settings.refreshIntervalSeconds}
                onChange={(e) => updateSetting('refreshIntervalSeconds', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                تحديث عند قرب الدور (ثانية)
              </label>
              <Input
                type="number"
                min="3"
                max="30"
                value={settings.nearTurnRefreshSeconds}
                onChange={(e) => updateSetting('nearTurnRefreshSeconds', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* تفعيل/تعطيل الأنظمة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            تفعيل/تعطيل الأنظمة التلقائية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <ToggleRow
              label="النداء التلقائي على المراجع التالي"
              description="يتم النداء تلقائياً كل دقيقتين"
              enabled={settings.autoCallEnabled}
              onToggle={() => toggleSetting('autoCallEnabled')}
            />

            <ToggleRow
              label="نقل المراجع المتأخر لنهاية الدور"
              description="يتم نقل المراجع تلقائياً بعد 4 دقائق"
              enabled={settings.timeoutHandlerEnabled}
              onToggle={() => toggleSetting('timeoutHandlerEnabled')}
            />

            <ToggleRow
              label="نظام الإشعارات"
              description="إرسال إشعارات للمراجعين"
              enabled={settings.notificationsEnabled}
              onToggle={() => toggleSetting('notificationsEnabled')}
            />
          </div>
        </CardContent>
      </Card>

      {/* إظهار/إخفاء للمراجعين */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            إظهار/إخفاء المعلومات للمراجعين
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <ToggleRow
              label="عرض العد التنازلي"
              description="إظهار العد التنازلي للـ4 دقائق"
              enabled={settings.showCountdownTimer}
              onToggle={() => toggleSetting('showCountdownTimer')}
            />

            <ToggleRow
              label="عرض الموقع في الدور"
              description="إظهار رقم الدور الحالي"
              enabled={settings.showQueuePosition}
              onToggle={() => toggleSetting('showQueuePosition')}
            />

            <ToggleRow
              label="عرض الوقت المتوقع"
              description="إظهار الوقت المتوقع للانتظار"
              enabled={settings.showEstimatedWait}
              onToggle={() => toggleSetting('showEstimatedWait')}
            />

            <ToggleRow
              label="عرض عدد المنتظرين"
              description="إظهار عدد المراجعين قبله"
              enabled={settings.showAheadCount}
              onToggle={() => toggleSetting('showAheadCount')}
            />
          </div>
        </CardContent>
      </Card>

      {/* إعدادات إضافية */}
      <Card>
        <CardHeader>
          <CardTitle>إعدادات إضافية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                إشعار للمراجعين التاليين
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={settings.notifyNearAhead}
                onChange={(e) => updateSetting('notifyNearAhead', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                مهلة تأخير PIN (دقيقة)
              </label>
              <Input
                type="number"
                min="1"
                max="30"
                value={settings.pinLateMinutes}
                onChange={(e) => updateSetting('pinLateMinutes', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                مدة عرض الإشعار (ثانية)
              </label>
              <Input
                type="number"
                min="5"
                max="60"
                value={settings.noticeTtlSeconds}
                onChange={(e) => updateSetting('noticeTtlSeconds', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* أزرار الحفظ */}
      <div className="flex gap-4 justify-end">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
        >
          <RefreshCw className="w-4 h-4 ml-2" />
          إعادة تعيين
        </Button>
        
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 ml-2" />
              حفظ الإعدادات
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// مكون مساعد للتبديل
function ToggleRow({ label, description, enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-gray-500">{description}</div>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-green-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

