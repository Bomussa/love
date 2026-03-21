import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const vercelConfig = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

function findRewrite(source) {
  return (vercelConfig.rewrites || []).find((item) => item?.source === source);
}

test('vercel frontend build contract runs root verification before workspace build', () => {
  assert.equal(vercelConfig.installCommand, 'npm ci');
  assert.equal(vercelConfig.buildCommand, 'npm run build:vercel');
  assert.equal(typeof packageJson.scripts?.['build:vercel'], 'string');
  assert.match(packageJson.scripts['build:vercel'], /check:vercel-routes/);
  assert.match(packageJson.scripts['build:vercel'], /test:smoke/);
  assert.match(packageJson.scripts['build:vercel'], /npm run build$/);
});

test('vercel frontend health and backend proxy rewrites exist before generic api wildcard', () => {
  const rewrites = vercelConfig.rewrites || [];
  const sources = rewrites.map((item) => item?.source);
  const wildcardIndex = sources.indexOf('/api/(.*)');

  const apiHealth = findRewrite('/api/health');
  const apiV1Status = findRewrite('/api/v1/status');
  const backendHealth = findRewrite('/api/backend/health');
  const backendStatus = findRewrite('/api/backend/status');

  assert.ok(apiHealth);
  assert.ok(apiV1Status);
  assert.ok(backendHealth);
  assert.ok(backendStatus);

  assert.equal(apiHealth.destination, '/.well-known/healthz.json');
  assert.equal(apiV1Status.destination, '/.well-known/healthz.json');
  assert.equal(backendHealth.destination, 'https://love-api-bomussa.vercel.app/api/v1/health');
  assert.equal(backendStatus.destination, 'https://love-api-bomussa.vercel.app/api/v1/status');

  assert.ok(sources.indexOf('/api/health') < wildcardIndex);
  assert.ok(sources.indexOf('/api/v1/status') < wildcardIndex);
  assert.ok(sources.indexOf('/api/backend/health') < wildcardIndex);
  assert.ok(sources.indexOf('/api/backend/status') < wildcardIndex);
});
