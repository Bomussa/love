import React from 'react';

export default function LiveStatisticsPanel({ language = 'ar' }) {
  return (
    <div className="p-4 rounded-xl border border-gray-700 text-white">
      {language === 'ar' ? 'الإحصائيات غير متاحة حالياً' : 'Statistics are not available right now'}
    </div>
  );
}
