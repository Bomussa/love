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

describe('canonical patient runtime patch contract', () => {
  it('routes patient login, queue enter, pin verify, and queue call through canonical api v1 endpoints before fallback', () => {
    const source = readSource('src/lib/canonical-patient-runtime-patch.js');

    const patientLoginBlock = sliceByMarkers(source, 'api.patientLogin = async function patchedPatientLogin', 'api.enterQueue = async function patchedEnterQueue');
    expect(patientLoginBlock).toContain("requestJson(`${resolveApiV1Base()}/patient/login`");
    expect(patientLoginBlock.indexOf("requestJson(`${resolveApiV1Base()}/patient/login`")).toBeLessThan(patientLoginBlock.indexOf('return originalPatientLogin'));

    const enterQueueBlock = sliceByMarkers(source, 'api.enterQueue = async function patchedEnterQueue', 'api.verifyPin = async function patchedVerifyPin');
    expect(enterQueueBlock).toContain("requestJson(`${resolveApiV1Base()}/queue/enter`");
    expect(enterQueueBlock.indexOf("requestJson(`${resolveApiV1Base()}/queue/enter`")).toBeLessThan(enterQueueBlock.indexOf('return originalEnterQueue'));

    const verifyPinBlock = sliceByMarkers(source, 'api.verifyPin = async function patchedVerifyPin', 'api.callNextPatient = async function patchedCallNextPatient');
    expect(verifyPinBlock).toContain("requestJson(`${resolveApiV1Base()}/pin/verify`");
    expect(verifyPinBlock.indexOf("requestJson(`${resolveApiV1Base()}/pin/verify`")).toBeLessThan(verifyPinBlock.indexOf('return originalVerifyPin'));

    const callNextBlock = sliceByMarkers(source, 'api.callNextPatient = async function patchedCallNextPatient', "Object.defineProperty(api, '__canonicalPatientRuntimePatched'");
    expect(callNextBlock).toContain("requestJson(`${resolveApiV1Base()}/queue/call`");
    expect(callNextBlock.indexOf("requestJson(`${resolveApiV1Base()}/queue/call`")).toBeLessThan(callNextBlock.indexOf('return originalCallNextPatient'));
  });

  it('applies the patch only once per runtime', () => {
    const source = readSource('src/lib/canonical-patient-runtime-patch.js');
    expect(source).toContain('if (!api.__canonicalPatientRuntimePatched)');
    expect(source).toContain("Object.defineProperty(api, '__canonicalPatientRuntimePatched'");
  });
});
