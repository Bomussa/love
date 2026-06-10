import React, { useState, useEffect } from 'react';
import {
  Users, Phone, CheckCircle, RotateCcw, RefreshCw,
  Search, Filter, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import toast from 'react-hot-toast';

/**
 * AdminQueueControlPanel - لوحة التحكم بالصفوف
 * مكون منفصل وقابل لإعادة الاستخدام
 * @component
 */
const AdminQueueControlPanel = ({ language = 'ar', clinicId = null, theme = {} }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const tr = (ar, en) => language === 'ar' ? ar : en;

  // تحميل المرضى
  const loadPatients = async () => {
    if (!clinicId) return;
    
    try {
      setLoading(true);
      const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('display_number', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (e) {
      console.error('loadPatients:', e);
      toast.error(tr('خطأ في تحميل البيانات', 'Error loading data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
    const interval = setInterval(loadPatients, 5000);
    return () => clearInterval(interval);
  }, [clinicId]);

  // إجراءات
  const callNext = async () => {
    try {
      const { data, error } = await supabase.rpc('call_next_patient', {
        p_clinic_id: clinicId,
        p_mark_current_done: false,
      });
      if (error) throw error;
      toast.success(tr(`تم استدعاء الرقم ${data?.display_number}`, `Called #${data?.display_number}`));
      loadPatients();
    } catch (e) {
      toast.error(tr('خطأ في الاستدعاء', 'Error calling'));
    }
  };

  const completePatient = async (patientId) => {
    try {
      const { error } = await supabase
        .from('queues')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('patient_id', patientId)
        .eq('clinic_id', clinicId);

      if (error) throw error;
      toast.success(tr('تم إنهاء الفحص', 'Completed'));
      loadPatients();
    } catch (e) {
      toast.error(tr('خطأ', 'Error'));
    }
  };

  // إحصائيات
  const stats = {
    waiting: patients.filter(p => p.status === 'waiting').length,
    current: patients.filter(p => ['called', 'in_progress'].includes(p.status)).length,
    completed: patients.filter(p => p.status === 'completed').length,
  };

  // فلترة المرضى
  const filtered = patients.filter(p => {
    const matchSearch = String(p.patient_id || '').includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
          <Users className="text-blue-400 mx-auto mb-2" size={24} />
          <p className="text-2xl font-bold text-white">{stats.waiting}</p>
          <p className="text-xs text-gray-400">{tr('في الانتظار', 'Waiting')}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
          <Phone className="text-yellow-400 mx-auto mb-2" size={24} />
          <p className="text-2xl font-bold text-white">{stats.current}</p>
          <p className="text-xs text-gray-400">{tr('قيد الفحص', 'In Service')}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
          <CheckCircle className="text-green-400 mx-auto mb-2" size={24} />
          <p className="text-2xl font-bold text-white">{stats.completed}</p>
          <p className="text-xs text-gray-400">{tr('أنهوا الفحص', 'Completed')}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={callNext}
          disabled={stats.waiting === 0}
          className="flex-1 py-3 bg-gradient-to-r from-[#8A1538] to-[#C9A54C] hover:from-[#9A2548] hover:to-[#D4B55D] text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <Phone size={18} />
          {tr('استدعاء التالي', 'Call Next')}
        </button>
        <button
          onClick={loadPatients}
          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={tr('البحث برقم المريض', 'Search by ID')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm"
        >
          <option value="all">{tr('الكل', 'All')}</option>
          <option value="waiting">{tr('في الانتظار', 'Waiting')}</option>
          <option value="called">{tr('تم الاستدعاء', 'Called')}</option>
          <option value="in_progress">{tr('قيد الفحص', 'In Progress')}</option>
          <option value="completed">{tr('مكتمل', 'Completed')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-right text-gray-300 font-bold text-sm">#</th>
                <th className="px-4 py-3 text-right text-gray-300 font-bold text-sm">{tr('الهوية', 'ID')}</th>
                <th className="px-4 py-3 text-right text-gray-300 font-bold text-sm">{tr('الحالة', 'Status')}</th>
                <th className="px-4 py-3 text-right text-gray-300 font-bold text-sm">{tr('الوقت', 'Time')}</th>
                <th className="px-4 py-3 text-right text-gray-300 font-bold text-sm">{tr('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-700 hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#C9A54C]">#{p.display_number}</td>
                  <td className="px-4 py-3 font-mono text-sm text-white">{p.patient_id || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-1 rounded-full ${
                      p.status === 'waiting' ? 'bg-blue-500/20 text-blue-400' :
                      p.status === 'called' ? 'bg-yellow-500/20 text-yellow-400' :
                      p.status === 'in_progress' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 flex items-center gap-1">
                    <Clock size={14} />
                    {p.entered_at ? new Date(p.entered_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.status !== 'completed' && (
                      <button
                        onClick={() => completePatient(p.patient_id)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-colors"
                      >
                        {tr('إنهاء', 'Done')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-6 text-center text-gray-400">
              {tr('لا توجد نتائج', 'No results')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminQueueControlPanel;
