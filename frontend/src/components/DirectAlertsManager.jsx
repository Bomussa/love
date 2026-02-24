/**
 * DirectAlertsManager
 * إدارة التنبيهات المباشرة للمرضى من لوحة الإدارة
 * يحفظ في جدول direct_alerts ويستقبلها المريض في الوقت الفعلي
 */
import React, { useState, useEffect } from 'react';
import { Send, Trash2, RefreshCw, Bell, AlertTriangle, CheckCircle, Info, Zap, User, Clock, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../lib/supabase-client';

const ALERT_TYPES = [
  { value: 'info',    label_ar: 'معلومة',  label_en: 'Info',    color: '#3B82F6', icon: Info },
  { value: 'success', label_ar: 'نجاح',    label_en: 'Success', color: '#10B981', icon: CheckCircle },
  { value: 'warning', label_ar: 'تحذير',   label_en: 'Warning', color: '#F59E0B', icon: AlertTriangle },
  { value: 'urgent',  label_ar: 'عاجل',    label_en: 'Urgent',  color: '#EF4444', icon: Zap },
];

const DirectAlertsManager = ({ language, t }) => {
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    patient_id: '',
    message: '',
    message_en: '',
    alert_type: 'info',
    sound_enabled: true,
  });

  const tl = (ar, en) => language === 'ar' ? ar : en;

  useEffect(() => {
    loadAlerts();
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('patients')
        .select('id, military_number')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });
      if (data) setPatients(data);
    } catch (e) {
      console.error('Error loading patients:', e);
    }
  };

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('direct_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) setAlerts(data);
    } catch (e) {
      console.error('Error loading alerts:', e);
    } finally {
      setLoading(false);
    }
  };

  const sendAlert = async () => {
    if (!form.patient_id || !form.message.trim()) {
      alert(tl('يرجى تحديد المراجع وكتابة الرسالة', 'Please select patient and write message'));
      return;
    }
    try {
      setSending(true);
      const { error } = await supabase.from('direct_alerts').insert({
        patient_id: form.patient_id,
        message: form.message,
        message_en: form.message_en || form.message,
        alert_type: form.alert_type,
        sound_enabled: form.sound_enabled,
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
      setForm({ patient_id: '', message: '', message_en: '', alert_type: 'info', sound_enabled: true });
      await loadAlerts();
    } catch (e) {
      console.error('Error sending alert:', e);
      alert(tl('خطأ في إرسال التنبيه', 'Error sending alert'));
    } finally {
      setSending(false);
    }
  };

  const deleteAlert = async (id) => {
    try {
      await supabase.from('direct_alerts').delete().eq('id', id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error('Error deleting alert:', e);
    }
  };

  const deactivateAlert = async (id) => {
    try {
      await supabase.from('direct_alerts').update({ is_active: false }).eq('id', id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: false } : a));
    } catch (e) {
      console.error('Error deactivating alert:', e);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      {/* نموذج إرسال تنبيه جديد */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send size={20} className="text-[#C9A54C]" />
          {tl('إرسال تنبيه مباشر', 'Send Direct Alert')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* اختيار المراجع */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{tl('المراجع', 'Patient')} *</label>
            <div className="flex gap-2">
              <select
                value={form.patient_id}
                onChange={e => setForm(prev => ({ ...prev, patient_id: e.target.value }))}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A54C]"
              >
                <option value="">{tl('اختر مراجعاً...', 'Select patient...')}</option>
                {patients.map(p => (
                  <option key={p.id} value={p.military_number}>{p.military_number}</option>
                ))}
              </select>
              <input
                type="text"
                value={form.patient_id}
                onChange={e => setForm(prev => ({ ...prev, patient_id: e.target.value }))}
                placeholder={tl('أو أدخل الرقم', 'Or enter ID')}
                className="w-32 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A54C]"
              />
            </div>
          </div>
          {/* نوع التنبيه */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{tl('نوع التنبيه', 'Alert Type')}</label>
            <div className="flex gap-2">
              {ALERT_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setForm(prev => ({ ...prev, alert_type: type.value }))}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                      form.alert_type === type.value
                        ? 'border-current text-white'
                        : 'border-white/10 text-gray-400 hover:border-white/30'
                    }`}
                    style={form.alert_type === type.value ? { backgroundColor: type.color + '33', borderColor: type.color, color: type.color } : {}}
                  >
                    <Icon size={14} />
                    {language === 'ar' ? type.label_ar : type.label_en}
                  </button>
                );
              })}
            </div>
          </div>
          {/* رسالة عربية */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{tl('الرسالة (عربي)', 'Message (Arabic)')} *</label>
            <textarea
              value={form.message}
              onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder={tl('اكتب رسالتك هنا...', 'Write your message here...')}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A54C] resize-none"
            />
          </div>
          {/* رسالة إنجليزية */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{tl('الرسالة (إنجليزي)', 'Message (English)')}</label>
            <textarea
              value={form.message_en}
              onChange={e => setForm(prev => ({ ...prev, message_en: e.target.value }))}
              placeholder="Write your message in English..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A54C] resize-none"
            />
          </div>
        </div>
        {/* خيارات إضافية */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setForm(prev => ({ ...prev, sound_enabled: !prev.sound_enabled }))}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border ${
              form.sound_enabled
                ? 'bg-[#C9A54C]/20 border-[#C9A54C]/50 text-[#C9A54C]'
                : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
            {form.sound_enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {tl(form.sound_enabled ? 'صوت مفعّل' : 'صوت معطّل', form.sound_enabled ? 'Sound On' : 'Sound Off')}
          </button>
          <button
            onClick={sendAlert}
            disabled={sending || !form.patient_id || !form.message.trim()}
            className="px-6 py-2.5 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
            {sending ? tl('جاري الإرسال...', 'Sending...') : tl('إرسال التنبيه', 'Send Alert')}
          </button>
        </div>
      </div>

      {/* قائمة التنبيهات المرسلة */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h4 className="font-semibold flex items-center gap-2">
            <Bell size={18} className="text-[#C9A54C]" />
            {tl('التنبيهات المرسلة', 'Sent Alerts')}
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{alerts.length}</span>
          </h4>
          <button onClick={loadAlerts} className="p-2 hover:bg-white/10 rounded-lg transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            {tl('جاري التحميل...', 'Loading...')}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            {tl('لا توجد تنبيهات مرسلة', 'No alerts sent yet')}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {alerts.map(alert => {
              const typeInfo = ALERT_TYPES.find(t => t.value === alert.alert_type) || ALERT_TYPES[0];
              const Icon = typeInfo.icon;
              return (
                <div key={alert.id} className={`flex items-start gap-3 p-4 transition-all ${!alert.is_active ? 'opacity-40' : 'hover:bg-white/5'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: typeInfo.color + '22' }}>
                    <Icon size={16} style={{ color: typeInfo.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: typeInfo.color + '22', color: typeInfo.color }}>
                        {language === 'ar' ? typeInfo.label_ar : typeInfo.label_en}
                      </span>
                      <span className="text-xs text-[#C9A54C] flex items-center gap-1">
                        <User size={10} />
                        {alert.patient_id}
                      </span>
                      {alert.read_at && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle size={10} />
                          {tl('مقروء', 'Read')}
                        </span>
                      )}
                      {!alert.is_active && (
                        <span className="text-xs text-gray-500">{tl('منتهي', 'Expired')}</span>
                      )}
                    </div>
                    <p className="text-sm text-white/90 truncate">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      {formatDate(alert.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {alert.is_active && (
                      <button
                        onClick={() => deactivateAlert(alert.id)}
                        className="p-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all"
                        title={tl('إلغاء التفعيل', 'Deactivate')}
                      >
                        <VolumeX size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                      title={tl('حذف', 'Delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectAlertsManager;
