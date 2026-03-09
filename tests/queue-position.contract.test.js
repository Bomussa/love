import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiSource = readFileSync(new URL('../lib/api.js', import.meta.url), 'utf8');

test('queue position client contract uses POST endpoint with canonical payload keys', () => {
  assert.match(
    apiSource,
    /this\.request\(`\$\{API_VERSION\}\/queue\/position`,\s*\{\s*method:\s*'POST'/s,
    'Queue position client must call POST /api/v1/queue/position',
  );

  assert.match(
    apiSource,
    /body:\s*JSON\.stringify\(\{\s*clinicId:\s*clinic,\s*patientId:\s*user,\s*\}\)/s,
    'Queue position payload must include canonical keys clinicId and patientId',
  );
});
