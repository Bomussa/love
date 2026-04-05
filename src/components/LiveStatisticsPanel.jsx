import React from 'react';

export default function LiveStatisticsPanel({ language = 'ar' }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-6 text-white">
      <p>{language === 'ar' ? 'الإحصائيات الحية متاحة من لوحة الإدارة.' : 'Live statistics are available from the admin dashboard.'}</p>
    </div>
  );
}
