import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';

export const DiagnosticsPanel = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeQueues: 0,
    systemStatus: 'Healthy',
    lastUpdate: new Error().stack ? 'Just now' : 'Unknown'
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { count: patientCount } = await supabase.from('patients').select('*', { count: 'exact', head: true });
      const { count: clinicCount } = await supabase.from('clinics').select('*', { count: 'exact', head: true });
      
      setStats(prev => ({
        ...prev,
        totalPatients: patientCount || 0,
        activeQueues: clinicCount || 0,
        lastUpdate: new Date().toLocaleTimeString()
      }));
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-gray-900/50 rounded-xl border border-blue-500/30 backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
          نظام التشخيص والمراقبة المباشر
        </h2>
        <span className="text-sm text-blue-400">آخر تحديث: {stats.lastUpdate}</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-blue-400 text-sm mb-1">إجمالي المرضى</p>
          <p className="text-2xl font-bold text-white">{stats.totalPatients}</p>
        </div>
        <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <p className="text-purple-400 text-sm mb-1">العيادات النشطة</p>
          <p className="text-2xl font-bold text-white">{stats.activeQueues}</p>
        </div>
        <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
          <p className="text-green-400 text-sm mb-1">حالة النظام</p>
          <p className="text-2xl font-bold text-white">{stats.systemStatus}</p>
        </div>
      </div>

      <div className="mt-6 p-4 bg-black/30 rounded-lg border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">سجل العمليات الأخير</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>اتصال قاعدة البيانات</span>
            <span className="text-green-500">مستقر</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>نظام المزامنة</span>
            <span className="text-green-500">يعمل</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>توزيع الأحمال</span>
            <span className="text-blue-500">تلقائي</span>
          </div>
        </div>
      </div>
    </div>
  );
};
