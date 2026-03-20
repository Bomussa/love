import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, X, CheckCircle, Clock, Users } from 'lucide-react';

export const QueueManagementFixed = ({ language, t }) => {
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // تحديث كل 5 ثوان
    setRefreshInterval(interval);
    
    // Real-time subscription
    const subscription = supabase
      .channel('queues_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // جلب الطوابير لليوم الحالي
      const today = new Date().toISOString().split('T')[0];
      const { data: queueData, error: queueError } = await supabase
        .from('queues')
        .select('*')
        .eq('queue_date', today)
        .order('display_number', { ascending: true });

      if (!queueError && queueData) {
        setQueues(queueData);
      }

      // جلب العيادات
      const { data: clinicsData, error: clinicsError } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar');

      if (!clinicsError && clinicsData) {
        setClinics(clinicsData);
      }
    } catch (error) {
      console.error('Error loading queue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const callNext = async (clinicId) => {
    try {
      const waitingQueues = queues
        .filter(q => q.clinic_id === clinicId && q.status === 'waiting')
        .sort((a, b) => (a.display_number || 0) - (b.display_number || 0));

      if (waitingQueues.length === 0) {
        alert(t('لا يوجد مرضى في الانتظار', 'No patients waiting'));
        return;
      }

      const nextPatient = waitingQueues[0];
      const { error } = await supabase
        .from('queues')
        .update({ 
          status: 'serving', 
          called_at: new Date().toISOString() 
        })
        .eq('id', nextPatient.id);

      if (!error) {
        alert(t(`تم استدعاء الرقم: ${nextPatient.display_number}`, `Called number: ${nextPatient.display_number}`));
        loadData();
      }
    } catch (error) {
      console.error('Error calling next:', error);
      alert(t('حدث خطأ', 'Error occurred'));
    }
  };

  const completePatient = async (queueId) => {
    try {
      const { error } = await supabase
        .from('queues')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', queueId);

      if (!error) {
        alert(t('تم إكمال الفحص', 'Examination completed'));
        loadData();
      }
    } catch (error) {
      console.error('Error completing patient:', error);
    }
  };

  const skipPatient = async (queueId) => {
    try {
      const { error } = await supabase
        .from('queues')
        .update({ status: 'skipped' })
        .eq('id', queueId);

      if (!error) {
        loadData();
      }
    } catch (error) {
      console.error('Error skipping patient:', error);
    }
  };

  const filteredQueues = selectedClinic 
    ? queues.filter(q => q.clinic_id === selectedClinic)
    : queues;

  const stats = {
    total: filteredQueues.length,
    waiting: filteredQueues.filter(q => q.status === 'waiting').length,
    serving: filteredQueues.filter(q => q.status === 'serving').length,
    completed: filteredQueues.filter(q => q.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12121a] p-4 rounded-xl border border-white/5">
          <div className="text-gray-400 text-sm mb-2">{t('إجمالي', 'Total')}</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-[#12121a] p-4 rounded-xl border border-white/5">
          <div className="text-yellow-400 text-sm mb-2">{t('في الانتظار', 'Waiting')}</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.waiting}</div>
        </div>
        <div className="bg-[#12121a] p-4 rounded-xl border border-white/5">
          <div className="text-blue-400 text-sm mb-2">{t('قيد الفحص', 'Serving')}</div>
          <div className="text-2xl font-bold text-blue-400">{stats.serving}</div>
        </div>
        <div className="bg-[#12121a] p-4 rounded-xl border border-white/5">
          <div className="text-green-400 text-sm mb-2">{t('مكتملة', 'Completed')}</div>
          <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
        </div>
      </div>

      {/* Clinic Filter */}
      <div className="bg-[#12121a] p-4 rounded-xl border border-white/5">
        <label className="text-sm text-gray-400 mb-2 block">{t('اختر العيادة', 'Select Clinic')}</label>
        <select
          value={selectedClinic || ''}
          onChange={(e) => setSelectedClinic(e.target.value || null)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
        >
          <option value="">{t('جميع العيادات', 'All Clinics')}</option>
          {clinics.map(clinic => (
            <option key={clinic.id} value={clinic.id}>
              {language === 'ar' ? clinic.name_ar : clinic.name_en}
            </option>
          ))}
        </select>
      </div>

      {/* Queues Table */}
      <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-right py-3 px-4">{t('الرقم', 'Number')}</th>
                <th className="text-center py-3 px-4">{t('الحالة', 'Status')}</th>
                <th className="text-center py-3 px-4">{t('الوقت', 'Time')}</th>
                <th className="text-center py-3 px-4">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueues.map(queue => (
                <tr key={queue.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4 font-mono font-bold text-lg">{queue.display_number}</td>
                  <td className="text-center py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      queue.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                      queue.status === 'serving' ? 'bg-blue-500/20 text-blue-400' :
                      queue.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {queue.status}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-400">
                    {queue.entered_at ? new Date(queue.entered_at).toLocaleTimeString() : '-'}
                  </td>
                  <td className="text-center py-3 px-4">
                    <div className="flex gap-2 justify-center">
                      {queue.status === 'waiting' && (
                        <button
                          onClick={() => callNext(queue.clinic_id)}
                          className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition"
                          title={t('استدعاء', 'Call')}
                        >
                          <Phone size={16} />
                        </button>
                      )}
                      {queue.status === 'serving' && (
                        <button
                          onClick={() => completePatient(queue.id)}
                          className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 transition"
                          title={t('إكمال', 'Complete')}
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {(queue.status === 'waiting' || queue.status === 'serving') && (
                        <button
                          onClick={() => skipPatient(queue.id)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition"
                          title={t('تخطي', 'Skip')}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredQueues.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {t('لا توجد طوابير', 'No queues')}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueManagementFixed;
