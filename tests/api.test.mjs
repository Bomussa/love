import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
global.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};
global.window = {
  addEventListener: () => {},
  location: { origin: 'https://mmc-mms.com', protocol: 'https:', host: 'mmc-mms.com' },
};
global.navigator = { onLine: false };

const { default: api } = await import('../src/lib/api.js');

test('api encodes queue position params', async () => {
  let capturedUrl = '';
  global.fetch = async (url) => {
    capturedUrl = String(url);
    return { ok: true, text: async () => JSON.stringify({ success: true }) };
  };

  await api.getQueuePosition('clinic A', 'user/1');
  assert.match(capturedUrl, /clinic%20A/);
  assert.match(capturedUrl, /user%2F1/);
});

test('api queues write operation when offline fetch fails', async () => {
  global.fetch = async () => {
    throw new Error('offline');
  };

  const response = await api.createQueue('s1', 'general', 'male', 'id1');
  assert.equal(response.offline, true);

  const queueRaw = localStorage.getItem('mms.offlineQueue');
  assert.ok(queueRaw);
  const queue = JSON.parse(queueRaw);
  assert.ok(queue.length >= 1);
});
