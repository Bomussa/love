import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { takeQueueNumber } from '../services/queue';
import { subscribeWaitingCalls } from '../lib/realtime';
import { useSession } from '../hooks/useSession';

export default function Home() {
  const { session } = useSession();
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{padding: '20px', textAlign: 'center'}}>
      <h1>مرحباً بك في نظام إدارة العيادات</h1>
      <div style={{margin: '20px 0'}}>
        <input placeholder="clinic_id" value={clinicId} onChange={e=>setClinicId(e.target.value)} style={{padding: '8px', marginRight: '10px'}} />
        <button onClick={take} disabled={loading} style={{padding: '8px 16px'}}>أخذ الدور</button>
      </div>
      {queueNumber !== null && <div style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745'}}>رقمك: {queueNumber}</div>}
      {called && <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#ffc107', borderRadius: '4px'}}>تم النداء - يرجى التوجه للعيادة</div>}
    </div>
  );
}
