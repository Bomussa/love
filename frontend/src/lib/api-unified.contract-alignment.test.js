import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function sliceByMarkers(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end === -1 ? source.length : end);
}

describe('api-unified source alignment', () => {
  it('normalizes patient id before patientLogin reads/writes', () => {
    const source = readSource('src/lib/api-unified.js');
    expect(source).toContain('function normalizePatientId(');
    expect(source).toMatch(/patientLogin[\s\S]*normalizePatientId\(patientId\)/);
    expect(source).toMatch(/patientLogin[\s\S]*\.eq\('patient_id', normalizedPatientId\)/);
    expect(source).toMatch(/patientLogin[\s\S]*patient_id: normalizedPatientId/);
  });

  it('uses atomic queue RPC without client-side next-number fallback', () => {
    const source = readSource('src/lib/api-unified.js');
    const enterQueueBlock = sliceByMarkers(source, 'async enterQueue(', 'async getQueuePosition(');
    expect(enterQueueBlock).toContain("rpc('enter_unified_queue_safe'");
    expect(enterQueueBlock).not.toContain('nextNumber');
    expect(enterQueueBlock).not.toContain(".from('queues').select('display_number')");
    expect(enterQueueBlock).not.toContain(".from('queues').insert");
  });

  it('uses two-digit pin helper for generatePIN and issuePin', () => {
    const source = readSource('src/lib/api-unified.js');
    expect(source).toContain('function generateTwoDigitPin()');
    expect(source).toMatch(/generatePIN[\s\S]*const pin = generateTwoDigitPin\(\)/);
    expect(source).toMatch(/issuePin[\s\S]*const newPin = generateTwoDigitPin\(\)/);
    expect(source).not.toMatch(/generatePIN[\s\S]*Math\.floor\(10 \+ Math\.random\(\) \* 90\)/);
    expect(source).not.toMatch(/issuePin[\s\S]*Math\.floor\(10 \+ Math\.random\(\) \* 90\)/);
  });
});
