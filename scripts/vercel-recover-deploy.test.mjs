import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL_TOKEN = process.env.VERCEL_TOKEN || 'test-token';
process.env.VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'project_123';

const { buildApiUrl, createVercelApiClient } = await import('./vercel-recover-deploy.mjs');

test('buildApiUrl appends teamId query when provided', () => {
  assert.equal(
    buildApiUrl('/v9/projects/project_123', 'team_abc'),
    'https://api.vercel.com/v9/projects/project_123?teamId=team_abc',
  );
});

test('all API endpoints include teamId query when context has teamId', async () => {
  const calledUrls = [];
  const responseBody = JSON.stringify({ ok: true });

  globalThis.fetch = async (url) => {
    calledUrls.push(url);
    return new Response(responseBody, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const api = createVercelApiClient({ token: 'token', teamId: 'team_scope' });

  await api('/v9/projects/prj_1');
  await api('/v9/projects/prj_1', { method: 'PATCH', body: '{}' });
  await api('/v13/deployments', { method: 'POST', body: '{}' });
  await api('/v13/deployments/dpl_1');

  assert.deepEqual(calledUrls, [
    'https://api.vercel.com/v9/projects/prj_1?teamId=team_scope',
    'https://api.vercel.com/v9/projects/prj_1?teamId=team_scope',
    'https://api.vercel.com/v13/deployments?teamId=team_scope',
    'https://api.vercel.com/v13/deployments/dpl_1?teamId=team_scope',
  ]);
});
