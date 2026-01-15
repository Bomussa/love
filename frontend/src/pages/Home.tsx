import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { takeQueueNumber } from '../services/queue';
import { subscribeWaitingCalls } from '../lib/realtime';
import { useSession } from '../hooks/useSession';
import { getClinicById } from '../services/clinic';
import clinics from '../../config/clinics.json';

type Step = 'input' | 'service' | 'queue' | 'waiting' | 'completed';

export default function Home() {
  const { session } = useSession();
  const navigate = useNavigate();
  
  // المرحلة الأولى: إدخال البيانات الشخصية
  const [step, setStep] = useState<Step>('input');
  const [personalId, setPersonalId] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  
  // المرحلة الثانية: اختيار الخدمة
  const [selectedService, setSelectedService] = useState<string>('');
  
  // المرحلة الثالثة: الدور والانتظار
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [clinicFloor, setClinicFloor] = useState('');
  const [called, setCalled] = useState(false);
  const [waitingTime, setWaitingTime] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // الاستماع للنداءات الحقيقية
  useEffect(() => {
    if (!session?.user?.id || step !== 'waiting') return;
    const unsub = subscribeWaitingCalls(session.user.id, () => setCalled(true));
    return () => unsub();
  }, [session?.user?.id, step]);

  // المرحلة الأولى: التحقق من البيانات الشخصية
  const handlePersonalData = async () => {
    if (!personalId || !gender) {
      setError('يرجى ملء جميع الحقول');
      return;
    }
    
    if (personalId.length < 2 || personalId.length > 12) {
      setError('الرقم الشخصي يجب أن يكون من 2 إلى 12 رقم');
      return;
    }

    setError('');
    setStep('service');
  };

  // المرحلة الثانية: اختيار الخدمة والحصول على الدور
  const handleSelectService = async (serviceId: string) => {
    setLoading(true);
    setError('');
    
    try {
      // الحصول على رقم الدور من قاعدة البيانات
      const queueNum = await takeQueueNumber(serviceId);
      
      // الحصول على بيانات العيادة
      const clinic = getClinicById(serviceId);
      if (!clinic) throw new Error('العيادة غير موجودة');

      setQueueNumber(queueNum);
      setSelectedService(serviceId);
      setClinicName(clinic.name);
      setClinicFloor(clinic.floor);
      
      // حساب الوقت المتوقع (تقريبي: 5 دقائق لكل شخص)
      const estimatedWait = queueNum * 5;
      setWaitingTime(estimatedWait);
      
      setStep('waiting');
    } catch (err) {
      setError('حدث خطأ في الحصول على رقم الدور');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('input');
    setPersonalId('');
    setGender('');
    setSelectedService('');
    setQueueNumber(null);
    setClinicName('');
    setClinicFloor('');
    setCalled(false);
    setWaitingTime(null);
    setError('');
  };

  // ===== المرحلة الأولى: إدخال البيانات الشخصية =====
  if (step === 'input') {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
        <header style={{ marginBottom: '40px' }}>
          <img src="/logo.jpeg" alt="Logo" style={{ height: '80px', marginBottom: '20px' }} />
          <h1 style={{ color: '#333' }}>مرحباً بك في نظام اللجنة الطبية</h1>
        </header>

        <main style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '20px', color: '#333' }}>أدخل بياناتك الشخصية</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <input 
              type="text"
              placeholder="الرقم الشخصي أو العسكري"
              value={personalId}
              onChange={e => setPersonalId(e.target.value)}
              style={{ padding: '12px', width: '100%', borderRadius: '6px', border: '1px solid #ddd', fontSize: '16px', marginBottom: '10px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <p style={{ marginBottom: '10px', color: '#666' }}>اختر الجنس:</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setGender('M')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: gender === 'M' ? '#007bff' : '#e9ecef',
                  color: gender === 'M' ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: gender === 'M' ? 'bold' : 'normal'
                }}
              >
                👨 ذكر
              </button>
              <button
                onClick={() => setGender('F')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: gender === 'F' ? '#007bff' : '#e9ecef',
                  color: gender === 'F' ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: gender === 'F' ? 'bold' : 'normal'
                }}
              >
                👩 أنثى
              </button>
            </div>
          </div>

          {error && <div style={{ color: 'red', marginBottom: '15px', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '6px' }}>{error}</div>}

          <button
            onClick={handlePersonalData}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            {loading ? 'جاري المعالجة...' : 'التالي'}
          </button>
        </main>
      </div>
    );
  }

  // ===== المرحلة الثانية: اختيار الخدمة =====
  if (step === 'service') {
    const clinicsList = Object.values(clinics);
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
        <header style={{ marginBottom: '40px' }}>
          <img src="/logo.jpeg" alt="Logo" style={{ height: '80px', marginBottom: '20px' }} />
          <h1 style={{ color: '#333' }}>اختر الخدمة الطبية</h1>
        </header>

        <main style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            {clinicsList.map((clinic: any) => (
              <button
                key={clinic.id}
                onClick={() => handleSelectService(clinic.id)}
                disabled={loading}
                style={{
                  padding: '20px',
                  backgroundColor: '#fff',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  ':hover': { boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }
                }}
              >
                {clinic.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('input')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ← رجوع
          </button>
        </main>
      </div>
    );
  }

  // ===== المرحلة الثالثة: عرض الدور والانتظار =====
  if (step === 'waiting') {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
        <header style={{ marginBottom: '40px' }}>
          <img src="/logo.jpeg" alt="Logo" style={{ height: '80px', marginBottom: '20px' }} />
          <h1 style={{ color: '#333' }}>تفاصيل دورك</h1>
        </header>

        <main style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          
          {/* عرض رقم الدور */}
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '2px solid #007bff' }}>
            <h2 style={{ color: '#007bff', marginBottom: '10px' }}>رقم دورك</h2>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#007bff' }}>{queueNumber}</div>
          </div>

          {/* بيانات العيادة */}
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ color: '#333', marginBottom: '15px' }}>بيانات العيادة</h3>
            <div style={{ textAlign: 'right', color: '#666' }}>
              <p style={{ marginBottom: '10px' }}><strong>العيادة:</strong> {clinicName}</p>
              <p style={{ marginBottom: '10px' }}><strong>الطابق:</strong> {clinicFloor}</p>
            </div>
          </div>

          {/* الوقت المتوقع */}
          {waitingTime !== null && (
            <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
              <h3 style={{ color: '#2e7d32', marginBottom: '10px' }}>الوقت المتوقع</h3>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>حوالي {waitingTime} دقيقة</div>
            </div>
          )}

          {/* حالة النداء */}
          {!called ? (
            <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
              <p style={{ color: '#2e7d32', fontSize: '18px', fontWeight: 'bold' }}>⏳ انتظر نداءك...</p>
              <p style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>سيتم النداء عليك عندما تصل دورك</p>
            </div>
          ) : (
            <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#ffebee', borderRadius: '8px', animation: 'pulse 1s infinite' }}>
              <p style={{ color: '#c62828', fontSize: '18px', fontWeight: 'bold' }}>🔔 تم النداء عليك!</p>
              <p style={{ color: '#c62828', fontSize: '16px', marginTop: '10px' }}>توجه للعيادة الآن</p>
            </div>
          )}

          <button
            onClick={() => setStep('service')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ← رجوع
          </button>
        </main>
      </div>
    );
  }

  return null;
}
