/**
 * OperationalNotificationsManager
 * إدارة قوالب الإشعارات التشغيلية (NEAR_TURN, YOUR_TURN, STEP_DONE, إلخ)
 * يقرأ البيانات من جدول operational_notifications في Supabase
 */
import React, { useState, useEffect } from 'react';
import { Bell, Edit, Save, X, RefreshCw, Volume2, VolumeX, Zap, AlertCircle, CheckCircle, Info, Clock } from 'lucide-react';
import { apiClient } from "@/lib/api/client";

const TYPE_META = {
  NEAR_TURN:    { label_ar: 'اقتراب الدور',      label_en: 'Near Turn',     color: '#F59E0B', icon: Clock },
  YOUR_TURN:    { label_ar: 'حان دورك',           label_en: 'Your Turn',     color: '#EF4444', icon: Zap },
  STEP_DONE_NEXT: { label_ar: 'انتهاء الخطوة',   label_en: 'Step Done',     color: '#10B981', icon: CheckCircle },
  START_HINT:   { label_ar: 'ترحيب',              label_en: 'Welcome',       color: '#3B82F6', icon: Info },
  RESET_DONE:   { label_ar: 'إعادة تعيين',        label_en: 'Reset Done',    color: '#8B5CF6', icon: RefreshCw },
  CLINIC_OPENED:{ label_ar: 'فتح عيادة',          label_en: 'Clinic Opened', color: '#06B6D4', icon: Bell },
  CLINIC_CLOSED:{ label_ar: 'إغلاق عيادة',        label_en: 'Clinic Closed', color: '#6B7280', icon: AlertCircle },
};

const PRIORITY_OPTIONS = [
  { value: 'low',    label_ar: 'منخفضة',  label_en: 'Low',    color: '#6B7280' },
  { value: 'normal', label_ar: 'عادية',   label_en: 'Normal', color: '#3B82F6' },
  { value: 'high',   label_ar: 'عالية',   label_en: 'High',   color: '#F59E0B' },
  { value: 'urgent', label_ar: 'عاجلة',   label_en: 'Urgent', color: '#EF4444' },
];

const OperationalNotificationsManager = ({ language, t }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('operational_notifications')
        .select('*')
        .order('notification_type');
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      setErrorMsg(t('فشل تحميل الإشعارات التشغيلية', 'Failed to load operational notifications'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotifications(); }, []);

  const startEdit = (notif) => {
    setEditingId(notif.id);
    setEditData({ ...notif });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('operational_notifications')
        .update({
          title_ar: editData.title_ar,
          title_en: editData.title_en,
          message_ar: editData.message_ar,
          message_en: editData.message_en,
          priority: editData.priority,
          sound_enabled: editData.sound_enabled,
          vibrate_enabled: editData.vibrate_enabled,
          is_active: editData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (error) throw error;
      setSuccessMsg(t('تم الحفظ بنجاح ✓', 'Saved successfully ✓'));
      setTimeout(() => setSuccessMsg(''), 3000);
      setEditingId(null);
      await loadNotifications();
    } catch (err) {
      setErrorMsg(t('فشل الحفظ: ' + err.message, 'Save failed: ' + err.message));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (notif) => {
    try {
      const { error } = await supabase
        .from('operational_notifications')
        .update({ is_active: !notif.is_active, updated_at: new Date().toISOString() })
        .eq('id', notif.id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_active: !n.is_active } : n));
    } catch (err) {
      setErrorMsg(t('فشل تحديث الحالة', 'Failed to update status'));
    }
  };

  const getMeta = (type) => TYPE_META[type] || { label_ar: type, label_en: type, color: '#6B7280', icon: Bell };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C9A54C]/20 flex items-center justify-center">
            <Zap size={20} className="text-[#C9A54C]" />
          </div>
          <div>
            <h4 className="font-bold text-lg">{t('الإشعارات التشغيلية', 'Operational Notifications')}</h4>
            <p className="text-sm text-gray-400">{t('قوالب الإشعارات التلقائية للمراجعين', 'Automatic notification templates for patients')}</p>
          </div>
        </div>
        <button
          onClick={loadNotifications}
          className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
          title={t('تحديث', 'Refresh')}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin text-[#C9A54C]' : 'text-gray-400'} />
        </button>
      </div>

      {/* Success/Error messages */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-sm">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle size={16} />
          {errorMsg}
          <button onClick={() => setErrorMsg('')} className="mr-auto"><X size={14} /></button>
        </div>
      )}

      {/* Info banner */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2 text-sm text-blue-300">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>{t(
          'هذه الإشعارات تُرسل تلقائياً للمراجعين أثناء انتظارهم في الطابور. يمكنك تعديل نصوصها وإعداداتها.',
          'These notifications are automatically sent to patients while waiting in queue. You can edit their texts and settings.'
        )}</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={32} className="animate-spin text-[#C9A54C]" />
        </div>
      )}

      {/* Notifications list */}
      {!loading && (
        <div className="space-y-3">
          {notifications.map(notif => {
            const meta = getMeta(notif.notification_type);
            const MetaIcon = meta.icon;
            const isEditing = editingId === notif.id;
            const priorityMeta = PRIORITY_OPTIONS.find(p => p.value === (isEditing ? editData.priority : notif.priority));

            return (
              <div
                key={notif.id}
                className={`rounded-2xl border transition-all ${
                  isEditing
                    ? 'border-[#C9A54C]/50 bg-gradient-to-br from-[#8A1538]/40 to-[#6B0F2A]/40'
                    : 'border-white/10 bg-white/5 hover:bg-white/8'
                } ${!notif.is_active ? 'opacity-60' : ''}`}
              >
                {/* Card header */}
                <div className="flex items-center gap-3 p-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: meta.color + '25' }}
                  >
                    <MetaIcon size={20} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: meta.color }}>
                        {language === 'ar' ? meta.label_ar : meta.label_en}
                      </span>
                      <span className="text-xs text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded-md">
                        {notif.notification_type}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: priorityMeta?.color + '25', color: priorityMeta?.color }}
                      >
                        {language === 'ar' ? priorityMeta?.label_ar : priorityMeta?.label_en}
                      </span>
                    </div>
                    {!isEditing && (
                      <p className="text-sm text-gray-300 mt-1 truncate">
                        {language === 'ar' ? notif.title_ar : notif.title_en}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Sound indicator */}
                    {notif.sound_enabled
                      ? <Volume2 size={16} className="text-green-400" title={t('صوت مفعّل', 'Sound on')} />
                      : <VolumeX size={16} className="text-gray-500" title={t('صوت معطّل', 'Sound off')} />
                    }
                    {/* Active toggle */}
                    <button
                      onClick={() => toggleActive(notif)}
                      className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                        notif.is_active ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                      title={notif.is_active ? t('مفعّل - انقر للتعطيل', 'Active - click to disable') : t('معطّل - انقر للتفعيل', 'Inactive - click to enable')}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        notif.is_active ? 'right-0.5' : 'left-0.5'
                      }`} />
                    </button>
                    {/* Edit button */}
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(notif)}
                        className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
                        title={t('تعديل', 'Edit')}
                      >
                        <Edit size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Arabic title */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('العنوان (عربي)', 'Title (Arabic)')}</label>
                        <input
                          type="text"
                          value={editData.title_ar || ''}
                          onChange={e => setEditData(p => ({ ...p, title_ar: e.target.value }))}
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:border-[#C9A54C]/50 focus:outline-none"
                          dir="rtl"
                        />
                      </div>
                      {/* English title */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('العنوان (إنجليزي)', 'Title (English)')}</label>
                        <input
                          type="text"
                          value={editData.title_en || ''}
                          onChange={e => setEditData(p => ({ ...p, title_en: e.target.value }))}
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:border-[#C9A54C]/50 focus:outline-none"
                          dir="ltr"
                        />
                      </div>
                      {/* Arabic message */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('الرسالة (عربي)', 'Message (Arabic)')}</label>
                        <textarea
                          value={editData.message_ar || ''}
                          onChange={e => setEditData(p => ({ ...p, message_ar: e.target.value }))}
                          rows={2}
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:border-[#C9A54C]/50 focus:outline-none resize-none"
                          dir="rtl"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t('يمكن استخدام: {clinicName} {position} {number} {nextClinic}', 'Variables: {clinicName} {position} {number} {nextClinic}')}</p>
                      </div>
                      {/* English message */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('الرسالة (إنجليزي)', 'Message (English)')}</label>
                        <textarea
                          value={editData.message_en || ''}
                          onChange={e => setEditData(p => ({ ...p, message_en: e.target.value }))}
                          rows={2}
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:border-[#C9A54C]/50 focus:outline-none resize-none"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Settings row */}
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Priority */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">{t('الأولوية:', 'Priority:')}</label>
                        <select
                          value={editData.priority || 'normal'}
                          onChange={e => setEditData(p => ({ ...p, priority: e.target.value }))}
                          className="bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-white text-sm focus:border-[#C9A54C]/50 focus:outline-none"
                        >
                          {PRIORITY_OPTIONS.map(p => (
                            <option key={p.value} value={p.value}>
                              {language === 'ar' ? p.label_ar : p.label_en}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Sound toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editData.sound_enabled || false}
                          onChange={e => setEditData(p => ({ ...p, sound_enabled: e.target.checked }))}
                          className="w-4 h-4 rounded accent-[#C9A54C]"
                        />
                        <span className="text-sm text-gray-300">{t('صوت', 'Sound')}</span>
                      </label>
                      {/* Vibrate toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editData.vibrate_enabled || false}
                          onChange={e => setEditData(p => ({ ...p, vibrate_enabled: e.target.checked }))}
                          className="w-4 h-4 rounded accent-[#C9A54C]"
                        />
                        <span className="text-sm text-gray-300">{t('اهتزاز', 'Vibrate')}</span>
                      </label>
                      {/* Active toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editData.is_active || false}
                          onChange={e => setEditData(p => ({ ...p, is_active: e.target.checked }))}
                          className="w-4 h-4 rounded accent-[#C9A54C]"
                        />
                        <span className="text-sm text-gray-300">{t('مفعّل', 'Active')}</span>
                      </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-all flex items-center gap-2"
                      >
                        <X size={16} />
                        {t('إلغاء', 'Cancel')}
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl text-sm font-semibold hover:bg-[#B8943D] transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview (when not editing) */}
                {!isEditing && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {language === 'ar' ? notif.message_ar : notif.message_en}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {notifications.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <Bell size={48} className="mx-auto mb-4 opacity-30" />
              <p>{t('لا توجد إشعارات تشغيلية', 'No operational notifications found')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OperationalNotificationsManager;
