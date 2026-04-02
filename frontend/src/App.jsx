import React, { useMemo, useState } from 'react';
import api, { ApiVersionMismatchError } from './lib/api-unified';

const initialForm = { clinic_id: '', patient_id: '' };

function App() {
  const [form, setForm] = useState(initialForm);
  const [statusData, setStatusData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const apiBlocked = useMemo(() => api.isVersionBlocked(), [error, loading, statusData]);

  const runAction = async (action) => {
    if (apiBlocked) {
      setError('تم إيقاف الواجهة بسبب عدم تطابق إصدار API (v1).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        clinic_id: form.clinic_id,
        patient_id: form.patient_id,
      };

      const response = await action(payload);
      if (!response.success) {
        setError(response.error || 'فشل الطلب');
        return;
      }

      setStatusData(response);
    } catch (err) {
      if (err instanceof ApiVersionMismatchError) {
        setError(`API Version mismatch: expected ${err.expected}, got ${err.received || 'missing'}. UI blocked.`);
      } else {
        setError(err.message || 'حدث خطأ غير متوقع');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="text-center mb-6">
          <img src="/mms-logo.png" alt="Medical Services" className="w-20 h-20 mx-auto object-contain mb-3" />
          <h1 className="text-2xl font-bold">نظام إدارة الطابور</h1>
          <p className="text-slate-300 mt-1">واجهة UI نقية مرتبطة فقط بـ API v1</p>
        </div>

        <div className="grid gap-4 mb-5">
          <input
            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2"
            placeholder="Clinic ID"
            value={form.clinic_id}
            onChange={(e) => setForm((prev) => ({ ...prev, clinic_id: e.target.value }))}
          />
          <input
            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2"
            placeholder="Patient ID"
            value={form.patient_id}
            onChange={(e) => setForm((prev) => ({ ...prev, patient_id: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button className="bg-blue-600 rounded-lg py-2" onClick={() => runAction(api.createQueue)} disabled={loading || apiBlocked}>Create</button>
          <button className="bg-green-600 rounded-lg py-2" onClick={() => runAction(api.startQueue)} disabled={loading || apiBlocked}>Start</button>
          <button className="bg-amber-600 rounded-lg py-2" onClick={() => runAction(api.advanceQueue)} disabled={loading || apiBlocked}>Advance</button>
          <button className="bg-purple-600 rounded-lg py-2" onClick={() => runAction(api.getQueueStatus)} disabled={loading || apiBlocked}>Status</button>
        </div>

        {error && <div className="bg-red-900/40 border border-red-500 text-red-200 p-3 rounded-lg mb-4">{error}</div>}

        <pre className="bg-black/40 border border-slate-700 rounded-lg p-3 overflow-auto text-sm min-h-40">
          {statusData ? JSON.stringify(statusData, null, 2) : 'No response yet.'}
        </pre>
      </div>
    </div>
  );
}

export default App;
