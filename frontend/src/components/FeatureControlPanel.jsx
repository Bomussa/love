/**
 * لوحة التحكم بالميزات
 * Feature Control Panel
 * 
 * يتيح التحكم الكامل في جميع ميزات النظام:
 * - إيقاف/تشغيل
 * - إخفاء/إظهار
 * - تعديل الإعدادات
 */

import React, { useState, useEffect } from 'react';
import {
  Settings, Power, Eye, EyeOff, Save, RefreshCw,
  Users, Bell, MapPin, Key, BarChart3, Clock,
  Building2, FileText, Shield, Database, Wifi,
  Check, X, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { apiClient } from "@/lib/api/client";

// قائمة الميزات المتاحة للتحكم
const SYSTEM_FEATURES = [
  {
    id: 'queue_system',
    name: 'نظام الطوابير',
    nameEn: 'Queue System',
    description: 'إدارة أرقام الدور والانتظار',
    descriptionEn: 'Manage queue numbers and waiting',
    icon: Users,
    category: 'core'
  },
  {
    id: 'pin_system',
    name: 'نظام الأرقام السرية',
    nameEn: 'PIN System',
    description: 'إصدار وإدارة أرقام PIN',
    descriptionEn: 'Generate and manage PIN codes',
    icon: Key,
    category: 'core'
  },
  {
    id: 'notifications',
    name: 'نظام الإشعارات',
    nameEn: 'Notifications',
    description: 'إرسال وإدارة الإشعارات',
    descriptionEn: 'Send and manage notifications',
    icon: Bell,
    category: 'core'
  },
  {
    id: 'routes',
    name: 'نظام المسارات',
    nameEn: 'Routes System',
    description: 'توجيه المراجعين للعيادات',
    descriptionEn: 'Guide patients to clinics',
    icon: MapPin,
    category: 'core'
  },
  {
    id: 'clinics',
    name: 'إدارة العيادات',
    nameEn: 'Clinics Management',
    description: 'إضافة وتعديل العيادات',
    descriptionEn: 'Add and edit clinics',
    icon: Building2,
    category: 'management'
  },
  {
    id: 'reports',
    name: 'التقارير',
    nameEn: 'Reports',
    description: 'عرض وتصدير التقارير',
    descriptionEn: 'View and export reports',
    icon: FileText,
    category: 'analytics'
  },
  {
    id: 'statistics',
    name: 'الإحصائيات',
    nameEn: 'Statistics',
    description: 'عرض إحصائيات النظام',
    descriptionEn: 'View system statistics',
    icon: BarChart3,
    category: 'analytics'
  },
  {
    id: 'realtime_sync',
    name: 'المزامنة الفورية',
    nameEn: 'Real-time Sync',
    description: 'تحديث البيانات تلقائياً',
    descriptionEn: 'Auto-update data',
    icon: Wifi,
    category: 'system'
  },
  {
    id: 'auto_pin_generate',
    name: 'إصدار PIN تلقائي',
    nameEn: 'Auto PIN Generate',
    description: 'إصدار أرقام PIN يومياً',
    descriptionEn: 'Generate PIN codes daily',
    icon: Clock,
    category: 'automation'
  },
  {
    id: 'auto_queue_reset',
    name: 'إعادة تعيين الدور',
    nameEn: 'Auto Queue Reset',
    description: 'إعادة تعيين الأرقام يومياً',
    descriptionEn: 'Reset queue numbers daily',
    icon: RefreshCw,
    category: 'automation'
  },
  {
    id: 'duplicate_prevention',
    name: 'منع التكرار',
    nameEn: 'Duplicate Prevention',
    description: 'منع تسجيل نفس الرقم مرتين',
    descriptionEn: 'Prevent duplicate registration',
    icon: Shield,
    category: 'security'
  },
  {
    id: 'offline_mode',
    name: 'وضع أوفلاين',
    nameEn: 'Offline Mode',
    description: 'العمل بدون اتصال',
    descriptionEn: 'Work without connection',
    icon: Database,
    category: 'system'
  }
];

const CATEGORIES = [
  { id: 'core', name: 'الميزات الأساسية', nameEn: 'Core Features' },
  { id: 'management', name: 'الإدارة', nameEn: 'Management' },
  { id: 'analytics', name: 'التحليلات', nameEn: 'Analytics' },
  { id: 'automation', name: 'الأتمتة', nameEn: 'Automation' },
  { id: 'security', name: 'الأمان', nameEn: 'Security' },
  { id: 'system', name: 'النظام', nameEn: 'System' }
];

const FeatureControlPanel = ({ language = 'ar', t }) => {
  const tr = t || ((ar, en) => language === 'ar' ? ar : en);
  
  // نظام الإشعارات
  const [notification, setNotification] = useState(null);
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };
  
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(['core']);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadFeatureSettings();
  }, []);

  const loadFeatureSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .like('key', 'feature_%');

      if (!error && data) {
        const featuresObj = {};
        data.forEach(s => {
          const featureId = s.key.replace('feature_', '');
          try {
            featuresObj[featureId] = JSON.parse(s.value);
          } catch {
            featuresObj[featureId] = { is_active: s.value === 'true', is_hidden: false };
          }
        });

        // تعيين القيم الافتراضية للميزات غير الموجودة
        SYSTEM_FEATURES.forEach(f => {
          if (!featuresObj[f.id]) {
            featuresObj[f.id] = { is_active: true, is_hidden: false };
          }
        });

        setFeatures(featuresObj);
      } else {
        // تعيين القيم الافتراضية
        const defaultFeatures = {};
        SYSTEM_FEATURES.forEach(f => {
          defaultFeatures[f.id] = { is_active: true, is_hidden: false };
        });
        setFeatures(defaultFeatures);
      }
    } catch (e) {
      console.error('Error loading feature settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateFeature = (featureId, updates) => {
    setFeatures(prev => ({
      ...prev,
      [featureId]: { ...prev[featureId], ...updates }
    }));
    setHasChanges(true);
  };

  const toggleFeatureActive = (featureId) => {
    updateFeature(featureId, { is_active: !features[featureId]?.is_active });
  };

  const toggleFeatureHidden = (featureId) => {
    updateFeature(featureId, { is_hidden: !features[featureId]?.is_hidden });
  };

  const saveAllSettings = async () => {
    try {
      setSaving(true);
      
      const updates = Object.entries(features).map(([featureId, settings]) => ({
        key: `feature_${featureId}`,
        value: JSON.stringify(settings),
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        await supabase.from('settings').upsert(update);
      }

      setHasChanges(false);
      showNotification(tr('تم حفظ الإعدادات بنجاح', 'Settings saved successfully'), 'success');
    } catch (e) {
      console.error('Error saving settings:', e);
      showNotification(tr('خطأ في حفظ الإعدادات', 'Error saving settings'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const enableAllFeatures = () => {
    const updated = {};
    SYSTEM_FEATURES.forEach(f => {
      updated[f.id] = { is_active: true, is_hidden: false };
    });
    setFeatures(updated);
    setHasChanges(true);
  };

  const disableAllFeatures = () => {
    const updated = {};
    SYSTEM_FEATURES.forEach(f => {
      updated[f.id] = { ...features[f.id], is_active: false };
    });
    setFeatures(updated);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-[#C9A54C]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* العنوان وأزرار التحكم */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Settings className="text-[#C9A54C]" />
            {tr('التحكم بالميزات', 'Feature Control')}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {tr('تفعيل أو إيقاف أو إخفاء ميزات النظام', 'Enable, disable, or hide system features')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={enableAllFeatures}
            className="px-4 py-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-all flex items-center gap-2"
          >
            <Check size={18} />
            {tr('تفعيل الكل', 'Enable All')}
          </button>
          <button
            onClick={disableAllFeatures}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all flex items-center gap-2"
          >
            <X size={18} />
            {tr('إيقاف الكل', 'Disable All')}
          </button>
          <button
            onClick={saveAllSettings}
            disabled={!hasChanges || saving}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              hasChanges 
                ? 'bg-[#C9A54C] text-black hover:bg-[#B8943D]' 
                : 'bg-white/10 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            {tr('حفظ التغييرات', 'Save Changes')}
          </button>
        </div>
      </div>

      {/* تنبيه التغييرات غير المحفوظة */}
      {hasChanges && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-yellow-400" size={20} />
          <span className="text-yellow-400">
            {tr('لديك تغييرات غير محفوظة', 'You have unsaved changes')}
          </span>
        </div>
      )}

      {/* قائمة الميزات حسب الفئة */}
      <div className="space-y-4">
        {CATEGORIES.map(category => {
          const categoryFeatures = SYSTEM_FEATURES.filter(f => f.category === category.id);
          if (categoryFeatures.length === 0) return null;

          const isExpanded = expandedCategories.includes(category.id);
          const activeCount = categoryFeatures.filter(f => features[f.id]?.is_active).length;

          return (
            <div key={category.id} className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
              {/* رأس الفئة */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <h4 className="font-bold">
                    {language === 'ar' ? category.name : category.nameEn}
                  </h4>
                  <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
                    {activeCount}/{categoryFeatures.length} {tr('مفعّل', 'active')}
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {/* قائمة الميزات */}
              {isExpanded && (
                <div className="border-t border-white/10">
                  {categoryFeatures.map(feature => {
                    const featureState = features[feature.id] || { is_active: true, is_hidden: false };
                    const Icon = feature.icon;

                    return (
                      <div
                        key={feature.id}
                        className={`p-4 border-b border-white/5 last:border-b-0 transition-all ${
                          !featureState.is_active ? 'opacity-60' : ''
                        } ${featureState.is_hidden ? 'bg-orange-500/5' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${
                              featureState.is_active ? 'bg-[#C9A54C]/20 text-[#C9A54C]' : 'bg-white/10 text-gray-400'
                            }`}>
                              <Icon size={20} />
                            </div>
                            <div>
                              <h5 className="font-medium">
                                {language === 'ar' ? feature.name : feature.nameEn}
                              </h5>
                              <p className="text-xs text-gray-400">
                                {language === 'ar' ? feature.description : feature.descriptionEn}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* زر الإخفاء */}
                            <button
                              onClick={() => toggleFeatureHidden(feature.id)}
                              className={`p-2 rounded-lg transition-all ${
                                featureState.is_hidden 
                                  ? 'bg-orange-500/20 text-orange-400' 
                                  : 'bg-white/10 text-gray-400 hover:text-white'
                              }`}
                              title={featureState.is_hidden ? tr('إظهار', 'Show') : tr('إخفاء', 'Hide')}
                            >
                              {featureState.is_hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>

                            {/* زر التفعيل */}
                            <button
                              onClick={() => toggleFeatureActive(feature.id)}
                              className={`w-14 h-8 rounded-full transition-all ${
                                featureState.is_active ? 'bg-green-500' : 'bg-white/20'
                              }`}
                            >
                              <div className={`w-6 h-6 bg-white rounded-full transition-all ${
                                featureState.is_active ? 'translate-x-7' : 'translate-x-1'
                              }`}>
                                {featureState.is_active ? (
                                  <Check className="w-full h-full p-1 text-green-500" />
                                ) : (
                                  <X className="w-full h-full p-1 text-gray-400" />
                                )}
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* شارات الحالة */}
                        <div className="flex gap-2 mt-2 mr-11">
                          {!featureState.is_active && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                              {tr('معطّل', 'Disabled')}
                            </span>
                          )}
                          {featureState.is_hidden && (
                            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                              {tr('مخفي من القائمة', 'Hidden from menu')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

      {/* ملاحظة */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-sm text-blue-400">
          <AlertCircle className="inline ml-1" size={16} />
          {tr(
            'ملاحظة: إيقاف ميزة لا يحذف بياناتها، ويمكنك إعادة تفعيلها في أي وقت. الإخفاء يخفي الميزة من القائمة فقط.',
            'Note: Disabling a feature does not delete its data, and you can re-enable it anytime. Hiding only removes it from the menu.'
          )}
        </p>
      </div>
    </div>
  );
};

export default FeatureControlPanel;
