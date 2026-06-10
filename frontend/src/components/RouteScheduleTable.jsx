import React, { useMemo } from 'react';
import { Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * RouteScheduleTable - جدول المسار الطبي للمريض
 * يتبع الثيم المختار وينسق مع الألوان الرسمية
 * @component
 * @param {Array} props.pathway - مسار العيادات
 * @param {number} props.currentClinicId - العيادة الحالية
 * @param {string} props.language - ar/en
 * @param {Object} props.theme - كائن الثيم من enhanced-themes.js
 */
const RouteScheduleTable = ({
  pathway = [],
  currentClinicId = null,
  language = 'ar',
  theme = {},
}) => {
  const tr = (ar, en) => language === 'ar' ? ar : en;

  // مستخرج الألوان من الثيم
  const themeColors = useMemo(() => ({
    primary: theme?.colors?.primary || '#8A1538',
    secondary: theme?.colors?.secondary || '#C9A54C',
    accent: theme?.colors?.accent || '#E8DABE',
    success: theme?.colors?.success || '#10b981',
    warning: theme?.colors?.warning || '#f59e0b',
    error: theme?.colors?.error || '#ef4444',
    surface: theme?.colors?.surface || '#f8fafc',
    text: theme?.colors?.text || '#1e293b',
  }), [theme]);

  // حالة الطابور
  const getStatusBadge = (clinicId) => {
    if (clinicId === currentClinicId) {
      return {
        label: tr('الحالية', 'Current'),
        color: themeColors.warning,
        bgColor: `${themeColors.warning}15`,
        icon: <Clock size={16} />,
      };
    }
    return {
      label: tr('قادمة', 'Upcoming'),
      color: themeColors.secondary,
      bgColor: `${themeColors.secondary}15`,
      icon: <AlertCircle size={16} />,
    };
  };

  if (!pathway || pathway.length === 0) {
    return (
      <div
        className="rounded-lg p-8 text-center border-2"
        style={{
          borderColor: `${themeColors.primary}30`,
          backgroundColor: `${themeColors.primary}08`,
        }}
      >
        <p style={{ color: themeColors.text }}>
          {tr('لا توجد عيادات في المسار', 'No clinics in pathway')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border-2" style={{ borderColor: `${themeColors.primary}30` }}>
      {/* Mobile View */}
      <div className="md:hidden space-y-3 p-4">
        {pathway.map((clinic, idx) => {
          const status = getStatusBadge(clinic.id);
          return (
            <div
              key={clinic.id}
              className="rounded-lg p-4 border-l-4"
              style={{
                borderLeftColor: themeColors.primary,
                backgroundColor: `${themeColors.surface}80`,
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 style={{ color: themeColors.primary }} className="font-bold text-lg">
                    {clinic.name_ar || clinic.name}
                  </h4>
                  <p style={{ color: themeColors.text }} className="text-sm opacity-70">
                    #{idx + 1} {tr('من', 'of')} {pathway.length}
                  </p>
                </div>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: status.bgColor,
                    color: status.color,
                  }}
                >
                  {status.icon}
                  {status.label}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm" style={{ color: themeColors.text }}>
                <MapPin size={14} />
                {clinic.address || tr('عنوان غير متوفر', 'Address not available')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: `${themeColors.primary}15` }}>
              <th
                className="px-4 py-3 text-right font-bold text-sm"
                style={{ color: themeColors.primary }}
              >
                {tr('الرقم', '#')}
              </th>
              <th
                className="px-4 py-3 text-right font-bold text-sm"
                style={{ color: themeColors.primary }}
              >
                {tr('اسم العيادة', 'Clinic Name')}
              </th>
              <th
                className="px-4 py-3 text-right font-bold text-sm"
                style={{ color: themeColors.primary }}
              >
                {tr('النوع', 'Type')}
              </th>
              <th
                className="px-4 py-3 text-right font-bold text-sm"
                style={{ color: themeColors.primary }}
              >
                {tr('الحالة', 'Status')}
              </th>
              <th
                className="px-4 py-3 text-right font-bold text-sm"
                style={{ color: themeColors.primary }}
              >
                {tr('الموقع', 'Address')}
              </th>
            </tr>
          </thead>
          <tbody>
            {pathway.map((clinic, idx) => {
              const status = getStatusBadge(clinic.id);
              const isHighlighted = clinic.id === currentClinicId;

              return (
                <tr
                  key={clinic.id}
                  style={{
                    backgroundColor: isHighlighted ? `${themeColors.warning}10` : 'transparent',
                    borderBottom: `1px solid ${themeColors.primary}15`,
                  }}
                >
                  <td
                    className="px-4 py-3 font-bold"
                    style={{ color: themeColors.primary }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    className="px-4 py-3 font-semibold"
                    style={{ color: themeColors.text }}
                  >
                    {clinic.name_ar || clinic.name}
                  </td>
                  <td
                    className="px-4 py-3 text-sm"
                    style={{ color: themeColors.text }}
                  >
                    {clinic.exam_type || tr('عام', 'General')}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: status.bgColor,
                        color: status.color,
                      }}
                    >
                      {status.icon}
                      {status.label}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 text-sm"
                    style={{ color: themeColors.text }}
                  >
                    {clinic.address || tr('عنوان غير متوفر', 'N/A')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RouteScheduleTable;
