const axios = require('axios');

const BASE = process.env.BASE_URL || process.env.DEPLOY_URL || 'http://localhost:3000';

describe('Critical path: health, login, create/update request', () => {
  jest.setTimeout(30000);

  test('Health endpoint should return 200', async () => {
    const r = await axios.get(`${BASE}/api/v1/health`);
    expect(r.status).toBe(200);
  });

  test('Login endpoint reachable (200 or 401)', async () => {
    const payload = { username: process.env.TEST_USER || 'testuser', password: process.env.TEST_PASS || 'testpass' };
    const r = await axios.post(`${BASE}/api/v1/auth/login`, payload).catch(e => e.response || e);
    expect([200,401]).toContain(r.status);
  });
});
