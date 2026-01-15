import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { takeQueueNumber } from '../services/queue';
import { subscribeWaitingCalls } from '../lib/realtime';
import { useSession } from '../hooks/useSession';

export default function Home() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [clinicId, setClinicId] = useState<string>('');
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [called, setCalled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    const unsub = subscribeWaitingCalls(session.user.id, () => setCalled(true));
    return () => unsub();
  }, [session?.user?.id]);

  async function take() {
    if (!clinicId || loading) return;
    setLoading(true);
    try {
      const num = await takeQueueNumber(clinicId);
      setQueueNumber(num);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
      <header style={{ marginBottom: '40px' }}>
        <img src="/logo.jpeg" alt="Logo" style={{ height: '80px', marginBottom: '20px' }} />
        <h1 style={{ color: '#333' }}>نظام إدارة اللجان الطبية</h1>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '30px' }}>
          <input 
            placeholder="أدخل رقم العيادة" 
            value={clinicId} 
            onChange={e=>setClinicId(e.target.value)} 
            style={{ padding: '12px', width: '70%', borderRadius: '6px', border: '1px solid #ddd', fontSize: '16px' }} 
          />
          <button 
            onClick={take} 
            disabled={loading} 
            style={{ padding: '12px 24px', marginLeft: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
          >
            {loading ? 'جاري الطلب...' : 'أخذ الدور'}
          </button>
        </div>

        {queueNumber !== null && (
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745', margin: '20px 0', padding: '20px', border: '2px dashed #28a745', borderRadius: '8px' }}>
            رقمك الحالي: {queueNumber}
          </div>
        )}

        {called && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#ffc107', color: '#856404', borderRadius: '6px', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>
            🔔 تم النداء عليك! يرجى التوجه للعيادة فوراً
          </div>
        )}

        <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <button onClick={() => navigate('/patient')} style={{ padding: '15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>ملفي الطبي</button>
          <button onClick={() => navigate('/notifications')} style={{ padding: '15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>الإشعارات</button>
        </div>
      </main>

      <footer style={{ marginTop: '50px', color: '#777', fontSize: '14px' }}>
        &copy; 2026 جميع الحقوق محفوظة - منظومة MMC-MMS
      </footer>
    </div>
  );
}
