import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('critical frontend files exist', () => {
  const requiredFiles = [
    'frontend/src/lib/api-unified.js',
    'frontend/src/lib/supabase-client.js',
    'frontend/src/lib/api-contract.js',
    'vercel.json',
  ];

  requiredFiles.forEach((path) => {
    assert.equal(fs.existsSync(path), true, `Missing required file: ${path}`);
  });
});

test('vercel config keeps api rewrite and www redirect', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const hasApiRewrite = Array.isArray(config.rewrites)
    && config.rewrites.some((entry) => entry.source === '/api/(.*)');
  const hasWwwRedirect = Array.isArray(config.redirects)
    && config.redirects.some((entry) => String(entry.destination || '').includes('https://mmc-mms.com'));

  assert.equal(hasApiRewrite, true, 'Missing /api rewrite rule');
  assert.equal(hasWwwRedirect, true, 'Missing www to apex redirect');
});
