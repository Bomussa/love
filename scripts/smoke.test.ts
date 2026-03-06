import assert from 'assert';

describe('Critical smoke tests', () => {
  it('Queue engine loads', async () => {
    const mod = await import('../src/queue/QueueEngine');
    assert.ok(mod);
  });

  it('API v1 path exists', async () => {
    const api = await import('../src/api');
    assert.ok(api.basePath === '/api/v1');
  });
});
