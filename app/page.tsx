'use client';

import { useState } from 'react';

export default function Home() {
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testEndpoint = async (endpoint: string) => {
    setLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      setTestResult({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '40px 20px' 
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          marginBottom: '8px',
          color: '#1a1a1a',
          fontSize: '32px'
        }}>
          🏥 MMC-MMS API Proxy
        </h1>
        <p style={{ 
          color: '#666',
          marginBottom: '32px',
          fontSize: '16px'
        }}>
          المركز الطبي العسكري المتخصص - العطار - اللجنة الطبية
        </p>

        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '32px'
        }}>
          <h2 style={{ 
            fontSize: '20px',
            marginBottom: '16px',
            color: '#1a1a1a'
          }}>
            ℹ️ معلومات النظام
          </h2>
          <div style={{ 
            display: 'grid',
            gap: '12px',
            fontSize: '14px'
          }}>
            <div>
              <strong>الحالة:</strong> <span style={{ color: '#22c55e' }}>✅ يعمل</span>
            </div>
            <div>
              <strong>النوع:</strong> API Proxy (Edge Runtime)
            </div>
            <div>
              <strong>الإصدار:</strong> Next.js 14.2.32
            </div>
            <div>
              <strong>CORS:</strong> مفعّل ومحسّن
            </div>
          </div>
        </div>

        <h2 style={{ 
          fontSize: '20px',
          marginBottom: '16px',
          color: '#1a1a1a'
        }}>
          🧪 اختبار API Endpoints
        </h2>

        <div style={{
          display: 'grid',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {[
            { name: 'Status', path: '/api/v1/status' },
            { name: 'Queue', path: '/api/v1/queue' },
            { name: 'PIN Status', path: '/api/v1/pin/status' },
            { name: 'Daily Report', path: '/api/v1/reports/daily' }
          ].map(endpoint => (
            <button
              key={endpoint.path}
              onClick={() => testEndpoint(endpoint.path)}
              disabled={loading}
              style={{
                padding: '12px 20px',
                backgroundColor: loading ? '#e5e7eb' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s',
                textAlign: 'right'
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              {loading ? '⏳ جاري الاختبار...' : `اختبار ${endpoint.name}`}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            padding: '16px',
            borderRadius: '6px',
            marginBottom: '16px',
            color: '#c00'
          }}>
            <strong>❌ خطأ:</strong> {error}
          </div>
        )}

        {testResult && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            padding: '20px',
            borderRadius: '8px'
          }}>
            <h3 style={{ 
              fontSize: '18px',
              marginBottom: '12px',
              color: '#166534'
            }}>
              ✅ نتيجة الاختبار
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <strong>Status Code:</strong>{' '}
              <span style={{
                backgroundColor: testResult.status === 200 ? '#22c55e' : '#ef4444',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                {testResult.status}
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <strong>CORS Headers:</strong>
              <pre style={{
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '8px'
              }}>
                {JSON.stringify({
                  'access-control-allow-origin': testResult.headers['access-control-allow-origin'],
                  'access-control-allow-credentials': testResult.headers['access-control-allow-credentials'],
                  'access-control-allow-methods': testResult.headers['access-control-allow-methods']
                }, null, 2)}
              </pre>
            </div>

            <div>
              <strong>Response Data:</strong>
              <pre style={{
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '8px'
              }}>
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div style={{
          marginTop: '32px',
          padding: '20px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <h3 style={{ 
            fontSize: '16px',
            marginBottom: '12px',
            color: '#92400e'
          }}>
            📝 ملاحظة مهمة
          </h3>
          <p style={{ color: '#78350f', lineHeight: '1.6', margin: 0 }}>
            هذه صفحة اختبار فقط. الواجهة الأصلية موجودة على{' '}
            <strong>https://mmc-mms.com</strong>. هذا المشروع يعمل كـ API Proxy
            لحل مشكلة CORS بين Frontend و Backend.
          </p>
        </div>
      </div>
    </main>
  );
}
