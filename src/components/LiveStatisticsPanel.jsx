/**
 * @file LiveStatisticsPanel.jsx
 * @description لوحة الإحصاءات الحية
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';

export const LiveStatisticsPanel = ({ language }) => {
  const [stats, setStats] = useState({ total: 0, waiting: 0, done: 0, clinics: 0 });
  useEffect(() => {
    supabase.rpc('get_admin_dashboard_overview').then(({ data }) => {
      if (data) setStats(data);
    });
  }, []);
  const ar = language === 'ar';
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div className="bg-blue-900/30 rounded-xl p-4 text-center">
        <div className="text-3xl font-bold text-blue-300">{stats.total_today ?? stats.total ?? 0}</div>
        <div className="text-gray-400 text-sm mt-1">{ar ? 'إجمالي اليوم' : 'Today Total'}</div>
      </div>
      <div className="bg-yellow-900/30 rounded-xl p-4 text-center">
        <div className="text-3xl font-bold text-yellow-300">{stats.waiting_now ?? stats.waiting ?? 0}</div>
        <div className="text-gray-400 text-sm mt-1">{ar ? 'في الانتظار' : 'Waiting'}</div>
      </div>
      <div className="bg-green-900/30 rounded-xl p-4 text-center">
        <div className="text-3xl font-bold text-green-300">{stats.completed_today ?? stats.done ?? 0}</div>
        <div className="text-gray-400 text-sm mt-1">{ar ? 'مكتمل' : 'Completed'}</div>
      </div>
      <div className="bg-purple-900/30 rounded-xl p-4 text-center">
        <div className="text-3xl font-bold text-purple-300">{stats.active_clinics ?? stats.clinics ?? 0}</div>
        <div className="text-gray-400 text-sm mt-1">{ar ? 'عيادات نشطة' : 'Active Clinics'}</div>
      </div>
    </div>
  );
};
export default LiveStatisticsPanel;
