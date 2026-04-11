/**
 * @fileoverview Doctor Control Dashboard Component
 * @description Main dashboard for doctors to manage patient queue
 * @version 2.0.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, Clock, CheckCircle, Activity, Phone, SkipForward, 
  XCircle, RotateCcw, ArrowRight, ArrowLeft, UserCheck,
  Calendar, Search, Filter, RefreshCw, AlertCircle, Timer,
  Play, Pause, UserX, Star
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import toast from 'react-hot-toast';

/**
 * Doctor Control Dashboard - Main component for clinic queue management
 * @param {Object} props
 * @param {string} props.language - Current language ('ar' or 'en')
 * @param {Function} props.t - Translation function
 * @param {string} props.doctorId - Current doctor ID
 * @param {string} props.clinicId - Current clinic ID
 */
const DoctorControl = ({ language = 'ar', t = (ar, en) => ar, doctorId, clinicId }) => {
  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(clinicId);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    waiting: 0,
    inProgress: 0,
    completed: 0,
    missed: 0,
    avgWaitTime: 0
  });
  const [currentPatient, setCurrentPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Translation helper
  const translate = (ar, en) => language === 'ar' ? ar : en;

  useEffect(() => {
    loadClinics();
    if (selectedClinic) {
      loadPatients();
    }
    
    // Real-time subscription for queue updates
    const subscription = supabase
      .channel('queues_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'queues',
        filter: selectedClinic ? `clinic_id=eq.${selectedClinic}` : undefined
      }, (payload) => {
        loadPatients();
      })
      .subscribe();

    // Auto-refresh every 10 seconds
    const interval = setInterval(loadPatients, 10000);

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [selectedClinic]);

  /**
   * Load clinics list
   */
  const loadClinics = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar');
      
      if (!error && data) {
        setClinics(data);
        if (!selectedClinic && data.length > 0) {
          setSelectedClinic(data[0].id);
        }
      }
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  /**
   * Load patients queue with real data from Supabase
   */
  const loadPatients = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch queue with patient details
      const { data, error } = await supabase
        .from('queues')
        .select(`
          *,
          patients:patient_id (
            id,
            patient_id,
            military_id,
            personal_id,
            name,
            gender
          )
        `)
        .eq('clinic_id', selectedClinic)
        .eq('queue_date', today)
        .order('display_number', { ascending: true });

      if (error) throw error;

      // Enrich patient data
      const enrichedData = (data || []).map(q => ({
        ...q,
        real_patient_id: q.patients?.military_id || q.patients?.personal_id || q.patients?.patient_id || q.patient_id,
        patient_name: q.patients?.name || translate('مريض', 'Patient'),
        patient_gender: q.patients?.gender || 'male'
      }));

      setPatients(enrichedData);
      calculateStats(enrichedData);
      
      // Set current patient (in_progress)
      const current = enrichedData.find(p => p.status === 'in_progress');
      setCurrentPatient(current || null);

    } catch (e) {
      console.error('Error loading patients:', e);
      toast.error(translate('خطأ في تحميل البيانات', 'Error loading data'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate queue statistics
   */
  const calculateStats = (data) => {
    const waiting = data.filter(p => p.status === 'waiting').length;
    const inProgress = data.filter(p => p.status === 'in_progress').length;
    const completed = data.filter(p => p.status === 'completed').length;
    const missed = data.filter(p => p.status === 'missed').length;
    
    // Calculate average wait time
    const completedPatients = data.filter(p => p.status === 'completed' && p.entered_at && p.called_at);
    let avgWaitTime = 0;
    if (completedPatients.length > 0) {
      const totalWait = completedPatients.reduce((sum, p) => {
        const enter = new Date(p.entered_at).getTime();
        const call = new Date(p.called_at).getTime();
        return sum + (enter - call);
      }, 0);
      avgWaitTime = Math.round(totalWait / completedPatients.length / 60000); // minutes
    }

    setStats({ waiting, inProgress, completed, missed, avgWaitTime });
  };

  /**
   * Call next patient in queue
   */
  const callNextPatient = async () => {
    try {
      const waitingPatients = patients
        .filter(p => p.status === 'waiting')
        .sort((a, b) => (a.display_number || 0) - (b.display_number || 0));

      if (waitingPatients.length === 0) {
        toast.info(translate('لا يوجد مرضى في الانتظار', 'No patients waiting'));
        return;
      }

      const nextPatient = waitingPatients[0];
      
      const { error } = await supabase
        .from('queues')
        .update({
          status: 'in_progress',
          called_at: new Date().toISOString(),
          doctor_id: doctorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', nextPatient.id);

      if (error) throw error;

      toast.success(translate(`تم استدعاء المريض رقم ${nextPatient.display_number}`, 
        `Patient ${nextPatient.display_number} called`));
      
      // Log activity
      await logActivity('patient_called', `تم استدعاء المريض ${nextPatient.real_patient_id}`, 
        { patient_id: nextPatient.patient_id, queue_id: nextPatient.id });

      loadPatients();

    } catch (e) {
      console.error('Error calling next patient:', e);
      toast.error(translate('خطأ في استدعاء المريض', 'Error calling patient'));
    }
  };

  /**
   * Complete current patient examination
   */
  const completePatient = async (patient) => {
    try {
      const { error } = await supabase
        .from('queues')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', patient.id);

      if (error) throw error;

      toast.success(translate('تم إنهاء الفحص بنجاح', 'Examination completed'));
      
      await logActivity('patient_completed', `تم إنهاء فحص المريض ${patient.real_patient_id}`,
        { patient_id: patient.patient_id, queue_id: patient.id });

      loadPatients();

    } catch (e) {
      console.error('Error completing patient:', e);
      toast.error(translate('خطأ في إنهاء الفحص', 'Error completing examination'));
    }
  };

  /**
   * Mark patient as missed
   */
  const markMissed = async (patient) => {
    try {
      const { error } = await supabase
        .from('queues')
        .update({
          status: 'missed',
          updated_at: new Date().toISOString()
        })
        .eq('id', patient.id);

      if (error) throw error;

      toast.info(translate('تم تسجيل الغياب', 'Absence recorded'));
      
      await logActivity('patient_missed', `تم تسجيل غياب المريض ${patient.real_patient_id}`,
        { patient_id: patient.patient_id, queue_id: patient.id });

      loadPatients();

    } catch (e) {
      console.error('Error marking missed:', e);
      toast.error(translate('خطأ في تسجيل الغياب', 'Error recording absence'));
    }
  };

  /**
   * Move patient to end of queue
   */
  const moveToEnd = async (patient) => {
    try {
      // Get max display number
      const maxNumber = Math.max(...patients.map(p => p.display_number || 0), 0);
      
      const { error } = await supabase
        .from('queues')
        .update({
          status: 'waiting',
          display_number: maxNumber + 1,
          called_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', patient.id);

      if (error) throw error;

      toast.success(translate('تم نقل المريض لآخر الصف', 'Patient moved to end of queue'));
      
      await logActivity('patient_moved', `تم نقل المريض ${patient.real_patient_id} لآخر الصف`,
        { patient_id: patient.patient_id, queue_id: patient.id });

      loadPatients();

    } catch (e) {
      console.error('Error moving patient:', e);
      toast.error(translate('خطأ في نقل المريض', 'Error moving patient'));
    }
  };

  /**
   * Return patient to queue (undo)
   */
  const returnToQueue = async (patient) => {
    try {
      const { error } = await supabase
        .from('queues')
        .update({
          status: 'waiting',
          called_at: null,
          entered_at: null,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', patient.id);

      if (error) throw error;

      toast.success(translate('تم إعادة المريض للصف', 'Patient returned to queue'));
      
      await logActivity('patient_returned', `تم إعادة المريض ${patient.real_patient_id} للصف`,
        { patient_id: patient.patient_id, queue_id: patient.id });

      loadPatients();

    } catch (e) {
      console.error('Error returning patient:', e);
      toast.error(translate('خطأ في إعادة المريض', 'Error returning patient'));
    }
  };

  /**
   * Log activity to database
   */
  const logActivity = async (actionType, description, metadata = {}) => {
    try {
      await supabase.from('activity_logs').insert([{
        action_type: actionType,
        description: description,
        user_id: doctorId,
        metadata: metadata,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {
      console.error('Error logging activity:', e);
    }
  };

  /**
   * Format time duration
   */
  const formatDuration = (startTime, endTime = new Date()) => {
    if (!startTime) return '-';
    const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Filter patients
  const filteredPatients = patients.filter(p => {
    const matchesSearch = 
      (p.real_patient_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.display_number?.toString() || '').includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <UserCheck className="text-[#C9A54C]" size={28} />
          {translate('لوحة تحكم الطبيب', 'Doctor Control Panel')}
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedClinic}
            onChange={(e) => setSelectedClinic(e.target.value)}
            className="bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-2 text-white"
          >
            {clinics.map(clinic => (
              <option key={clinic.id} value={clinic.id}>
                {language === 'ar' ? clinic.name_ar : clinic.name_en}
              </option>
            ))}
          </select>
          <button
            onClick={loadPatients}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
          >
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard 
          icon={<Users className="text-blue-400" />}
          value={stats.waiting}
          label={translate('في الانتظار', 'Waiting')}
          color="blue"
        />
        <StatCard 
          icon={<Activity className="text-yellow-400" />}
          value={stats.inProgress}
          label={translate('قيد الفحص', 'In Progress')}
          color="yellow"
        />
        <StatCard 
          icon={<CheckCircle className="text-green-400" />}
          value={stats.completed}
          label={translate('تم الفحص', 'Completed')}
          color="green"
        />
        <StatCard 
          icon={<UserX className="text-red-400" />}
          value={stats.missed}
          label={translate('تغيب', 'Missed')}
          color="red"
        />
        <StatCard 
          icon={<Clock className="text-purple-400" />}
          value={`${stats.avgWaitTime}m`}
          label={translate('متوسط الانتظار', 'Avg Wait')}
          color="purple"
        />
      </div>

      {/* Current Patient Card */}
      {currentPatient && (
        <div className="bg-gradient-to-r from-[#C9A54C]/20 to-[#8A1538]/20 rounded-xl p-6 border border-[#C9A54C]/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Play className="text-green-400" size={20} />
              {translate('المريض الحالي', 'Current Patient')}
            </h3>
            <span className="text-3xl font-bold text-[#C9A54C]">
              #{currentPatient.display_number}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-400">{translate('الرقم العسكري', 'Military ID')}</div>
              <div className="font-mono text-lg">{currentPatient.real_patient_id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">{translate('الاسم', 'Name')}</div>
              <div className="font-medium">{currentPatient.patient_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">{translate('الجنس', 'Gender')}</div>
              <div className="font-medium">
                {currentPatient.patient_gender === 'male' ? translate('ذكر', 'Male') : translate('أنثى', 'Female')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">{translate('مدة الفحص', 'Exam Duration')}</div>
              <div className="font-mono text-lg text-[#C9A54C]">
                {formatDuration(currentPatient.entered_at)}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => completePatient(currentPatient)}
              className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle size={20} />
              {translate('إنهاء الفحص', 'Complete')}
            </button>
            <button
              onClick={() => markMissed(currentPatient)}
              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium flex items-center gap-2 transition-all"
            >
              <UserX size={20} />
              {translate('تغيب', 'Missed')}
            </button>
          </div>
        </div>
      )}

      {/* Call Next Button */}
      {!currentPatient && (
        <button
          onClick={callNextPatient}
          disabled={stats.waiting === 0}
          className="w-full py-4 bg-gradient-to-r from-[#C9A54C] to-[#8A1538] hover:from-[#D4B55D] hover:to-[#9A2548] text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Phone size={24} />
          {translate('استدعاء المريض التالي', 'Call Next Patient')}
          {stats.waiting > 0 && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
              {stats.waiting} {translate('في الانتظار', 'waiting')}
            </span>
          )}
        </button>
      )}

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={translate('بحث برقم أو اسم المريض...', 'Search by patient number or name...')}
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-3 text-white"
        >
          <option value="all">{translate('الكل', 'All')}</option>
          <option value="waiting">{translate('في الانتظار', 'Waiting')}</option>
          <option value="in_progress">{translate('قيد الفحص', 'In Progress')}</option>
          <option value="completed">{translate('تم الفحص', 'Completed')}</option>
          <option value="missed">{translate('تغيب', 'Missed')}</option>
        </select>
      </div>

      {/* Patients Table */}
      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-white/10">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('الرقم', 'No.')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('الرقم العسكري', 'Military ID')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('الاسم', 'Name')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('الحالة', 'Status')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('وقت الاستدعاء', 'Called At')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('المدة', 'Duration')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{translate('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((patient) => (
              <tr key={patient.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                <td className="p-4 font-mono text-lg font-bold text-[#C9A54C]">
                  #{patient.display_number}
                </td>
                <td className="p-4 font-mono">{patient.real_patient_id}</td>
                <td className="p-4">
                  <div className="font-medium">{patient.patient_name}</div>
                  <div className="text-sm text-gray-400">
                    {patient.patient_gender === 'male' ? translate('ذكر', 'Male') : translate('أنثى', 'Female')}
                  </div>
                </td>
                <td className="p-4">
                  <StatusBadge status={patient.status} t={translate} />
                </td>
                <td className="p-4 text-gray-400">
                  {patient.called_at 
                    ? new Date(patient.called_at).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                    : '-'
                  }
                </td>
                <td className="p-4">
                  {patient.status === 'in_progress' 
                    ? <span className="font-mono text-[#C9A54C]">{formatDuration(patient.entered_at)}</span>
                    : patient.status === 'completed' && patient.entered_at && patient.completed_at
                      ? formatDuration(patient.entered_at, patient.completed_at)
                      : '-'
                  }
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    {patient.status === 'waiting' && (
                      <>
                        <button
                          onClick={() => markMissed(patient)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                          title={translate('تسجيل غياب', 'Mark Missed')}
                        >
                          <UserX size={16} />
                        </button>
                        <button
                          onClick={() => moveToEnd(patient)}
                          className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                          title={translate('نقل لآخر الصف', 'Move to End')}
                        >
                          <ArrowLeft size={16} />
                        </button>
                      </>
                    )}
                    {(patient.status === 'completed' || patient.status === 'missed') && (
                      <button
                        onClick={() => returnToQueue(patient)}
                        className="p-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-all"
                        title={translate('إعادة للصف', 'Return to Queue')}
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredPatients.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p>{translate('لا يوجد مرضى', 'No patients found')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Statistics Card Component
 */
const StatCard = ({ icon, value, label, color }) => {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 border`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
};

/**
 * Status Badge Component
 */
const StatusBadge = ({ status, t }) => {
  const statusConfig = {
    waiting: { color: 'bg-blue-500/20 text-blue-400', label: t('في الانتظار', 'Waiting') },
    in_progress: { color: 'bg-yellow-500/20 text-yellow-400', label: t('قيد الفحص', 'In Progress') },
    completed: { color: 'bg-green-500/20 text-green-400', label: t('تم الفحص', 'Completed') },
    missed: { color: 'bg-red-500/20 text-red-400', label: t('تغيب', 'Missed') },
  };

  const config = statusConfig[status] || statusConfig.waiting;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

export default DoctorControl;
