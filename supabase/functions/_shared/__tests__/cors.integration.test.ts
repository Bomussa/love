import {
  corsJsonResponse,
  handleOptions,
  isAllowedOrigin,
} from '../cors.ts';

Deno.test('allowed production origin passes allowlist check', () => {
  if (!isAllowedOrigin('https://mmc-mms.com')) {
    throw new Error('production origin should be allowed');
  }
  if (!isAllowedOrigin('https://www.mmc-mms.com')) {
    throw new Error('www production origin should be allowed');
  }
});

Deno.test('preflight OPTIONS returns 204 for allowed origin', async () => {
  const req = new Request('https://example.test/api', {
    method: 'OPTIONS',
    headers: { Origin: 'https://www.mmc-mms.com' },
  });

  const res = handleOptions(req);
  if (!res) throw new Error('expected preflight response');
  if (res.status !== 204) throw new Error(`expected 204 got ${res.status}`);
  if (res.headers.get('Access-Control-Allow-Origin') !== 'https://www.mmc-mms.com') {
    throw new Error('origin should be reflected for allowed origin');
  }
});

Deno.test('disallowed origin gets explicit 403 on preflight', async () => {
  const req = new Request('https://example.test/api', {
    method: 'OPTIONS',
    headers: { Origin: 'https://blocked.example.com' },
  });

  const res = handleOptions(req);
  if (!res) throw new Error('expected response');
  if (res.status !== 403) throw new Error(`expected 403 got ${res.status}`);
});

Deno.test('disallowed origin gets explicit 403 on regular request', async () => {
  const res = corsJsonResponse({ data: { ok: true } }, 200, 'https://blocked.example.com');
  if (res.status !== 403) throw new Error(`expected 403 got ${res.status}`);
});
