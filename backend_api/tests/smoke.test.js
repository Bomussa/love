const fetchApi = globalThis.fetch;

const BASE = 'http://localhost:3000/api/v1';

async function test() {
  console.log('=== START SMOKE TEST ===');

  try {
    // 1. Health
    console.log('Testing Health...');
    let res = await fetchApi(`${BASE}/health`);
    let json = await res.json();
    console.log('Health:', json);

    // 2. Login
    console.log('Testing Login...');
    res = await fetchApi(`${BASE}/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalId: '9999',
        gender: 'male',
        examType: 'recruitment'
      })
    });
    json = await res.json();
    console.log('Login:', json);

    if (!json.success || !json.data || !json.data.flow) {
        throw new Error('Login failed or flow not returned');
    }

    const flow = json.data.flow;
    const firstClinic = flow[0];

    // 3. Create Queue
    console.log(`Testing Queue Create for clinic: ${firstClinic}...`);
    res = await fetchApi(`${BASE}/queue/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: '9999',
        clinic_id: firstClinic
      })
    });
    json = await res.json();
    console.log('Queue Create:', json);

    // 4. Status
    console.log(`Testing Status for clinic: ${firstClinic}...`);
    res = await fetchApi(`${BASE}/queue/status?clinic_id=${firstClinic}`);
    json = await res.json();
    console.log('Status:', json);

    // 5. Call
    console.log(`Testing Call for clinic: ${firstClinic}...`);
    res = await fetchApi(`${BASE}/queue/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic_id: firstClinic })
    });
    json = await res.json();
    console.log('Call:', json);

    // 6. Done
    if (json.success && json.data && json.data.id) {
      console.log(`Testing Done for queue ID: ${json.data.id}...`);
      res = await fetchApi(`${BASE}/queue/done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: json.data.id })
      });
      json = await res.json();
      console.log('Done:', json);
    } else {
      console.log('Skip Done test: No active queue entry called');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }

  console.log('=== END SMOKE TEST ===');
}

test();
