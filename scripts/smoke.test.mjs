import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';

test('critical smoke: key runtime files are present', async () => {
  await access(new URL('../frontend/src/main.jsx', import.meta.url));
  await access(new URL('../frontend/src/App.jsx', import.meta.url));
  await access(new URL('../lib/api-handlers.js', import.meta.url));
  assert.ok(true);
});

