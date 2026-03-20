import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Copy, RefreshCw } from 'lucide-react';

export const PINManagementFixed = ({ language, t }) => {
  const [pins, setPins] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPin, setNewPin] = useState({ pin_code: '', clinic_id: '', max_uses: 100 });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    
    const subscription = supabase
      .channel('pins_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pins' }, () => {
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

      // جلب الأرقام السرية
      const { data: pinsData, error: pinsError } = await supabase
        .from('pins')
        .select('*')
        .order('created_at', { ascending: false });

      if (!pinsError && pinsData) {
        setPins(pinsData);
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
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePin = () => {
    return Math.floor(10 + Math.random() * 90).toString();
  };

  const addPin = async () => {
    try {
      if (!newPin.clinic_id) {
        alert(t('يرجى اختيار العيادة', 'Please select a clinic'));
        return;
      }

      const pinCode = newPin.pin_code || generatePin();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('pins')
        .insert({
          pin: pinCode,
          clinic_id: newPin.clinic_id,
          valid_until: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
          used_at: null,
          created_at: now
        });

      if (!error) {
        alert(t('تم إضافة الرقم السري', 'PIN added successfully'));
        setNewPin({ pin_code: '', clinic_id: '', max_uses: 100 });
        setShowAddForm(false);
        loadData();
      } else {
        alert(t('خطأ في إضافة الرقم', 'Error adding PIN'));
      }
    } catch (error) {
      console.error('Error adding PIN:', error);
      alert(t('حدث خطأ', 'Error occurred'));
    }
  };

  const deletePin = async (pinId) => {
    if (confirm(t('هل تريد حذف هذا الرقم؟', 'Delete this PIN?'))) {
      try {
        const { error } = await supabase
          .from('pins')
          .delete()
          .eq('id', pinId);

        if (!error) {
          loadData();
        }
      } catch (error) {
        console.error('Error deleting PIN:', error);
      }
    }
  };

  const copyPin = (pin) => {
    navigator.clipboard.writeText(pin);
    alert(t('تم نسخ الرقم', 'PIN copied'));
  };

  const isValid = (pin) => {
    const now = new Date();
    if (pin.valid_until && pin.used_at) {
      return !pin.used_at && new Date(pin.valid_until) >= now;
    }
    return true;
  };

  const getClinicName = (clinicId) => {
    const clinic = clinics.find(c => c.id === clinicId);
    return clinic ? (language === 'ar' ? clinic.name_ar : clinic.name_en) : clinicId;
  };

  const stats = {
    total: pins.length,
    active: pins.filter(p => isValid(p)).length,
    used: pins.filter(p => p.used_at).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#12121a] p-4 rounded-xl border border-white/5">
          <div className="text-gray-400 text-sm mb-2">{t('إجمالي', 'Total')}</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-[#12121a] p-4 rounded-xl border border-white/5">
          <div className="text-green-400 text-sm mb-2">{t('نشطة', 'Active')}</div>
          <div className="text-2xl font-bold text-green-400">{stats.active}</div>
        </div>
        <div className="bg-[#12121a] p-4 rounded-xl border border-white/5">
          <div className="text-yellow-400 text-sm mb-2">{t('مستخدمة', 'Used')}</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.used}</div>
        </div>
      </div>

      {/* Add PIN Button */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
      >
        <Plus size={20} />
        {t('إضافة رقم سري', 'Add PIN')}
      </button>

      {/* Add PIN Form */}
      {showAddForm && (
        <div className="bg-[#12121a] p-6 rounded-xl border border-white/5 space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">{t('العيادة', 'Clinic')}</label>
            <select
              value={newPin.clinic_id}
              onChange={(e) => setNewPin({ ...newPin, clinic_id: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
            >
              <option value="">{t('اختر العيادة', 'Select Clinic')}</option>
              {clinics.map(clinic => (
                <option key={clinic.id} value={clinic.id}>
                  {language === 'ar' ? clinic.name_ar : clinic.name_en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">{t('الرقم السري (اختياري)', 'PIN Code (Optional)')}</label>
            <input
              type="text"
              value={newPin.pin_code}
              onChange={(e) => setNewPin({ ...newPin, pin_code: e.target.value })}
              placeholder={t('سيتم توليده تلقائياً', 'Will be auto-generated')}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={addPin}
              disabled={generating}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              {t('إضافة', 'Add')}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition"
            >
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* PINs Table */}
      <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-right py-3 px-4">{t('الرقم', 'PIN')}</th>
                <th className="text-center py-3 px-4">{t('العيادة', 'Clinic')}</th>
                <th className="text-center py-3 px-4">{t('الحالة', 'Status')}</th>
                <th className="text-center py-3 px-4">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pins.map(pin => (
                <tr key={pin.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4 font-mono font-bold text-lg">{pin.pin}</td>
                  <td className="text-center py-3 px-4">{getClinicName(pin.clinic_id)}</td>
                  <td className="text-center py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isValid(pin) ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {isValid(pin) ? t('نشط', 'Active') : t('منتهي', 'Expired')}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => copyPin(pin.pin)}
                        className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition"
                        title={t('نسخ', 'Copy')}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => deletePin(pin.id)}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition"
                        title={t('حذف', 'Delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pins.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {t('لا توجد أرقام سرية', 'No PINs')}
          </div>
        )}
      </div>
    </div>
  );
};

export default PINManagementFixed;
