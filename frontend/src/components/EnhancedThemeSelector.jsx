/**
 * EnhancedThemeSelector - محدد الثيمات المحسن
 * يسمح للمستخدم باختيار وتطبيق الثيمات الطبية
 * ✅ يستخدم api-unified للاتصال المباشر بـ Supabase (بدون API خارجي)
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './Card';
import { Button } from './Button';
import { Palette, Check, Info, Eye, EyeOff, Settings, RefreshCw } from 'lucide-react';
import { enhancedMedicalThemes, generateThemeCSS } from '../lib/enhanced-themes';
import api from '../lib/api-unified';

export function EnhancedThemeSelector({
  currentTheme,
  onThemeChange,
  language = 'ar',
  showPreview = true,
  showDescription = true,
  enableFeatureFlag = true
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [previewTheme, setPreviewTheme] = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    enableThemeSelector: true,
    showThemePreview: true
  });

  // جلب إعدادات الثيمات من Supabase مباشرة
  useEffect(() => {
    fetchThemeSettings();
  }, []);

  // تطبيق الثيم CSS ديناميكياً
  useEffect(() => {
    const themeToApply = previewTheme || currentTheme;
    const themeCSS = generateThemeCSS(themeToApply);

    // إزالة الثيم السابق
    const existingStyle = document.getElementById('enhanced-theme-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // إضافة الثيم الجديد
    const style = document.createElement('style');
    style.id = 'enhanced-theme-style';
    style.textContent = themeCSS;
    document.head.appendChild(style);

    return () => {
      const styleToRemove = document.getElementById('enhanced-theme-style');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [currentTheme, previewTheme]);

  /**
   * جلب إعدادات الثيمات من Supabase
   */
  const fetchThemeSettings = async () => {
    try {
      const result = await api.getSettings('theme');
      if (result.success) {
        setSettings(result.data);
        setIsVisible(result.data.enableThemeSelector);
      }
    } catch (error) {
      console.error('Error fetching theme settings:', error);
    }
  };

  /**
   * تحديث الثيم في Supabase
   */
  const handleThemeSelect = async (themeId) => {
    setIsLoading(true);
    try {
      // تحديث الثيم في قاعدة البيانات عبر api-unified
      const result = await api.updateSettings('theme', {
        currentTheme: themeId
      });

      if (result.success) {
        onThemeChange(themeId);
        setPreviewTheme(null);
        // إظهار إشعار نجاح
        showNotification('تم تطبيق الثيم بنجاح على جميع الصفحات', 'success');
      } else {
        showNotification('فشل في حفظ الثيم', 'error');
      }
    } catch (error) {
      console.error('Error updating theme:', error);
      showNotification('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = (themeId) => {
    if (showPreview) {
      setPreviewTheme(themeId);
    }
  };

  const handlePreviewEnd = () => {
    setPreviewTheme(null);
  };

  const showNotification = (message, type) => {
    // يمكن استبدال هذا بنظام إشعارات أفضل
    if (type === 'success') {
      console.log('✅', message);
    } else {
      console.error('❌', message);
    }
  };

  if (!isVisible && enableFeatureFlag) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Palette className="w-8 h-8 text-[var(--theme-primary)]" />
          <div>
            <h2 className="text-2xl font-bold text-[var(--theme-text)]">
              {language === 'ar' ? 'الثيمات الطبية المتقدمة' : 'Advanced Medical Themes'}
            </h2>
            <p className="text-sm text-[var(--theme-text-secondary)]">
              {language === 'ar' 
                ? 'اختر الثيم المناسب لتجربة مستخدم مثالية' 
                : 'Choose the right theme for an optimal user experience'
              }
            </p>
          </div>
        </div>
        {showPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewTheme(null)}
            className="flex items-center gap-2"
          >
            {previewTheme ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {language === 'ar' ? 'إيقاف المعاينة' : 'Stop Preview'}
          </Button>
        )}
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {enhancedMedicalThemes.map((theme) => (
          <Card
            key={theme.id}
            className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
              currentTheme === theme.id 
                ? 'ring-4 ring-[var(--theme-primary)] shadow-lg' 
                : 'hover:ring-2 hover:ring-[var(--theme-primary)]/50'
            }`}
            onClick={() => handleThemeSelect(theme.id)}
            onMouseEnter={() => handlePreview(theme.id)}
            onMouseLeave={handlePreviewEnd}
          >
            <CardContent className="p-6 relative">
              {/* Color Swatches */}
              <div className="flex gap-2 mb-4">
                <div
                  className="w-10 h-10 rounded-full shadow-md border-2 border-gray-200"
                  style={{ backgroundColor: theme.colors.primary }}
                  title="اللون الأساسي"
                />
                <div
                  className="w-10 h-10 rounded-full shadow-md border-2 border-gray-200"
                  style={{ backgroundColor: theme.colors.secondary }}
                  title="اللون الثانوي"
                />
                <div
                  className="w-10 h-10 rounded-full shadow-md border-2 border-gray-200"
                  style={{ backgroundColor: theme.colors.accent }}
                  title="لون التمييز"
                />
                <div
                  className="w-10 h-10 rounded-full shadow-md border-2 border-gray-200"
                  style={{ backgroundColor: theme.colors.background }}
                  title="لون الخلفية"
                />
              </div>

              {/* Theme Name */}
              <h3 className="font-bold text-xl text-theme-text mb-2">
                {language === 'ar' ? theme.nameAr : theme.name}
              </h3>

              {/* Theme Description */}
              {showDescription && (
                <p className="text-sm text-theme-text-secondary mb-4 line-clamp-3 leading-relaxed">
                  {language === 'ar' ? theme.descriptionAr : theme.description}
                </p>
              )}

              {/* Gradient Preview */}
              <div
                className="h-4 rounded-full mb-4 shadow-inner"
                style={{ background: theme.gradients.primary }}
              />

              {/* Theme Features */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 bg-theme-primary/10 text-theme-primary text-xs rounded-full">
                  {language === 'ar' ? 'طبي' : 'Medical'}
                </span>
                <span className="px-2 py-1 bg-theme-secondary/10 text-theme-secondary text-xs rounded-full">
                  {language === 'ar' ? 'احترافي' : 'Professional'}
                </span>
              </div>

              {/* Selection Indicator */}
              {currentTheme === theme.id && (
                <div className="absolute top-3 right-3 bg-theme-primary text-white rounded-full p-2 shadow-lg">
                  <Check className="w-5 h-5" />
                </div>
              )}

              {/* Preview Indicator */}
              {previewTheme === theme.id && (
                <div className="absolute top-3 left-3 bg-theme-accent text-white rounded-full p-2 shadow-lg">
                  <Eye className="w-5 h-5" />
                </div>
              )}

              {/* Loading Indicator */}
              {isLoading && currentTheme === theme.id && (
                <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center rounded-lg">
                  <RefreshCw className="w-8 h-8 text-[var(--theme-primary)] animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instructions */}
      <div className="p-6 bg-gradient-to-r from-[var(--theme-surface)] to-[var(--theme-background)] rounded-lg border border-[var(--theme-border)] mb-6">
        <div className="flex items-start gap-4">
          <Info className="w-6 h-6 text-[var(--theme-info)] mt-1 flex-shrink-0" />
          <div className="text-sm text-[var(--theme-text-secondary)] space-y-2">
            <p className="font-medium text-[var(--theme-text)]">
              {language === 'ar' ? 'تعليمات الاستخدام:' : 'Usage Instructions:'}
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                {language === 'ar'
                  ? 'مرر الماوس فوق أي ثيم لمعاينته مباشرة على الصفحة'
                  : 'Hover over any theme to preview it directly on the page'
                }
              </li>
              <li>
                {language === 'ar'
                  ? 'اضغط على الثيم لتطبيقه على جميع صفحات التطبيق بدون استثناء'
                  : 'Click on a theme to apply it to all application pages without exception'
                }
              </li>
              <li>
                {language === 'ar'
                  ? 'جميع الثيمات مصممة وفقاً لمعايير التصميم الطبي الاحترافي'
                  : 'All themes are designed according to professional medical design standards'
                }
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Current Theme Info */}
      {currentTheme && (
        <div className="p-4 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5" />
              <span className="font-medium">
                {language === 'ar' ? 'الثيم النشط:' : 'Active Theme:'}
              </span>
            </div>
            <span className="font-bold text-lg">
              {language === 'ar'
                ? enhancedMedicalThemes.find(t => t.id === currentTheme)?.nameAr
                : enhancedMedicalThemes.find(t => t.id === currentTheme)?.name
              }
            </span>
          </div>
          <p className="text-sm opacity-90 mt-2">
            {language === 'ar'
              ? 'يتم تطبيق هذا الثيم على جميع صفحات النظام تلقائياً'
              : 'This theme is automatically applied to all system pages'
            }
          </p>
        </div>
      )}
    </div>
  );
}

export default EnhancedThemeSelector;
