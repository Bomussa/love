import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function runNodeScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  return result;
}

test('endpoint contracts are enforced and evidenced', () => {
  const result = runNodeScript('scripts/check-endpoint-contracts.js');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Edge functions \(27\):/);
  assert.match(result.stdout, /Endpoint contract check passed\./);
});

test('schema contracts are enforced and evidenced', () => {
  const result = runNodeScript('scripts/check-schema-contract.js');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Schema contract check passed\./);
});
