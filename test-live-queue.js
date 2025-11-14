/* Live Queue Flow Test against production API */
(async () => {
  const base = 'https://www.mmc-mms.com/api/v1';
  const clinic = process.env.CLINIC || 'xray';
  const headers = { 'content-type': 'application/json' };
  const req = async (path, init = {}) => {
    const res = await fetch(base + path, init).catch(err => ({ error: err }));
    if (!res || res.error) {
      console.log(path, 'ERR', res?.error?.message || 'network error');
      return { status: 0, text: String(res?.error?.message || 'network error'), json: null };
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    console.log(path, res.status, text);
    return { status: res.status, text, json };
  };

  const testId = `TESTFLOW-${Date.now()}`;
  const login = await req('/patient/login', { method: 'POST', headers, body: JSON.stringify({ patientId: testId, gender: 'male' }) });
  const sid = login.json?.data?.id;

  const enter = await req('/queue/enter', { method: 'POST', headers, body: JSON.stringify({ clinic, user: sid }) });
  const position = await req(`/queue/position?clinic=${encodeURIComponent(clinic)}&user=${encodeURIComponent(sid)}`);
  const call = await req('/queue/call', { method: 'POST', headers, body: JSON.stringify({ clinic }) });

  const adminPin = await req(`/admin/pin/status?clinic=${encodeURIComponent(clinic)}`);
  const pin = adminPin.json?.pin?.pin;

  const done = await req('/queue/done', { method: 'POST', headers, body: JSON.stringify({ clinic, user: sid, pin }) });

  const stats1 = await req('/stats/dashboard');
  const stats2 = await req('/stats/queues');
})();
