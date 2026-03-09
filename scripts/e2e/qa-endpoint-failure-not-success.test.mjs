import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const smartResponsePath = new URL('../../frontend/src/lib/SmartResponseSystemV3.js', import.meta.url);
const panelPath = new URL('../../frontend/src/components/QARepairPanel.jsx', import.meta.url);

test('qa/deep_run failure returns standardized fallback failure object', () => {
  const src = fs.readFileSync(smartResponsePath, 'utf8');
  assert.match(src, /endpoint === 'qa\/deep_run'/);
  assert.match(src, /ok:\s*false/);
  assert.match(src, /source:\s*'fallback'/);
  assert.match(src, /error_code:/);
  assert.match(src, /status:\s*503/);
  assert.doesNotMatch(src, /Restored by SmartResponse V3/);
});

test('QARepairPanel treats fallback failures as failed state (not success)', () => {
  const src = fs.readFileSync(panelPath, 'utf8');
  assert.match(src, /setQaRunStatus\(\{\s*source: resultSource,\s*ok: false,/s);
  assert.match(src, /setKpi\(\{ success_rate: 0, failure_rate: 100 \}\)/);
  assert.match(src, /toast\.error\(t\('فشل تشغيل الفحص العميق'/);
  assert.match(src, /fallback_result/);
});
