import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './Card';
import { Button } from './Button';
import { Palette, Check, Info, Eye, EyeOff, Settings, RefreshCw } from 'lucide-react';
import { enhancedMedicalThemes, generateThemeCSS } from '../lib/enhanced-themes';

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

  const isTouchDevice = typeof window !== 'undefined' && (
    'ontouchstart' in window || navigator.maxTouchPoints > 0
  );

  useEffect(() => {
    fetchThemeSettings();
  }, []);

  useEffect(() => {
    const themeToApply = previewTheme || currentTheme;
    const themeCSS = generateThemeCSS(themeToApply);

    const existingStyle = document.getElementById('enhanced-theme-style');
    if (existingStyle) {
      existingStyle.remove();
    }

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

  const fetchThemeSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings?type=theme');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.data);
          setIsVisible(data.data.enableThemeSelector);
        }
      }
    } catch (error) {
      console.warn('Theme settings fetch failed:', error);
    }
  };

  const handleThemeSelect = async (themeId) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'theme',
          settings: {
            currentTheme: themeId
          }
        }),
      });

      if (response.ok) {
        onThemeChange(themeId);
        setPreviewTheme(null);
        showNotification('تم تطبيق الثيم بنجاح على جميع الصفحات', 'success');
      } else {
        showNotification('فشل في حفظ الثيم', 'error');
      }
    } catch (error) {
      console.error('Theme update failed:', error);
      showNotification('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = (themeId) => {
    if (isTouchDevice) return;
    if (showPreview && settings.showThemePreview) {
      setPreviewTheme(themeId);
    }
  };

  const handlePreviewEnd = () => {
    if (isTouchDevice) return;
    setPreviewTheme(null);
  };

  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `
      fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300
      ${type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'}
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  };

  if (!isVisible || !enableFeatureFlag || !settings.enableThemeSelector) {
    return null;
  }

  return (
    <div className="enhanced-theme-selector w-full max-w-6xl mx-auto p-6 bg-theme-surface rounded-lg shadow-lg border border-theme-border">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-r from-theme-primary to-theme-secondary rounded-full">
            <Palette className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-theme-text mb-1">
              {language === 'ar' ? 'اختيار الثيم الطبي' : 'Medical Theme Selector'}
            </h2>
            <p className="text-theme-text-secondary">
              {language === 'ar'
                ? 'اختر الثيم المناسب لتطبيق الخدمات الطبية'
                : 'Choose the appropriate theme for the medical services application'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchThemeSettings}
            disabled={isLoading}
            className="text-theme-text-secondary hover:text-theme-primary"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(!isVisible)}
            className="text-theme-text-secondary hover:text-theme-primary"
          >
            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {enhancedMedicalThemes.map((theme) => (
          <Card
            key={theme.id}
            role="button"
            tabIndex={0}
            className={`
              relative cursor-pointer transition-all duration-200 active:scale-[0.98]
              touch-manipulation select-none
              ${currentTheme === theme.id ? 'ring-2 ring-theme-primary shadow-lg' : ''}
              ${previewTheme === theme.id ? 'ring-2 ring-theme-accent shadow-md' : ''}
              ${isLoading ? 'opacity-50 pointer-events-none' : ''}
            `}
            onMouseEnter={() => handlePreview(theme.id)}
            onMouseLeave={handlePreviewEnd}
            onClick={() => handleThemeSelect(theme.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleThemeSelect(theme.id);
              }
            }}
          >
            <CardContent className="p-6">
              <div className="flex gap-2 mb-4">
                <div className="w-10 h-10 rounded-full shadow-md border-2 border-white" style={{ backgroundColor: theme.colors.primary }} />
                <div className="w-10 h-10 rounded-full shadow-md border-2 border-white" style={{ backgroundColor: theme.colors.secondary }} />
                <div className="w-10 h-10 rounded-full shadow-md border-2 border-white" style={{ backgroundColor: theme.colors.accent }} />
                <div className="w-10 h-10 rounded-full shadow-md border-2 border-gray-200" style={{ backgroundColor: theme.colors.background }} />
              </div>

              <h3 className="font-bold text-xl text-theme-text mb-2">
                {language === 'ar' ? theme.nameAr : theme.name}
              </h3>

              {showDescription && (
                <p className="text-sm text-theme-text-secondary mb-4 line-clamp-3 leading-relaxed">
                  {language === 'ar' ? theme.descriptionAr : theme.description}
                </p>
              )}

              <div className="h-4 rounded-full mb-4 shadow-inner" style={{ background: theme.gradients.primary }} />

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 bg-theme-primary/10 text-theme-primary text-xs rounded-full">
                  {language === 'ar' ? 'طبي' : 'Medical'}
                </span>
                <span className="px-2 py-1 bg-theme-secondary/10 text-theme-secondary text-xs rounded-full">
                  {language === 'ar' ? 'احترافي' : 'Professional'}
                </span>
              </div>

              {currentTheme === theme.id && (
                <div className="absolute top-3 right-3 bg-theme-primary text-white rounded-full p-2 shadow-lg">
                  <Check className="w-5 h-5" />
                </div>
              )}

              {previewTheme === theme.id && !isTouchDevice && (
                <div className="absolute top-3 left-3 bg-theme-accent text-white rounded-full p-2 shadow-lg">
                  <Eye className="w-5 h-5" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
