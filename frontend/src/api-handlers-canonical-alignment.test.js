import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readBackendSource() {
  return fs.readFileSync(path.resolve(process.cwd(), '../lib/api-handlers.js'), 'utf8');
}

function sliceByMarkers(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end === -1 ? source.length : end);
}

describe('api-handlers canonical alignment for overlapping endpoints', () => {
  it('keeps patient login aligned with canonical payload + DB upsert', () => {
    const source = readBackendSource();
    const block = sliceByMarkers(source, "if (pathname === '/api/v1/patient/login' && method === 'POST')", "if (pathname.startsWith('/api/v1/patient/') && method === 'GET')");
    expect(block).toContain('body.personalId ?? body.patientId');
    expect(block).toContain(".from('patients')");
    expect(block).toContain('.upsert(');
  });

  it('queue enter canonical path uses DB RPC and not KV queue numbering', () => {
    const source = readBackendSource();
    const block = sliceByMarkers(source, "if (pathname === '/api/v1/queue/enter' && method === 'POST')", "if (pathname === '/api/v1/queue/status' && method === 'GET')");
    expect(block).toContain("rpc('enter_unified_queue_safe'");
    expect(block).not.toContain('KV_QUEUES.get(queueKey)');
    expect(block).not.toContain('queue.patients.length + 1');
  });

  it('pin verify canonical path uses DB pins table and not KV pin store', () => {
    const source = readBackendSource();
    const block = sliceByMarkers(source, "if (pathname === '/api/v1/pin/verify' && method === 'POST')", "if (pathname === '/api/v1/queue/call' && method === 'POST')");
    expect(block).toContain(".from('pins')");
    expect(block).not.toContain('KV_PINS.get');
  });

  it('queue status canonical path reads DB-backed queue rows', () => {
    const source = readBackendSource();
    const block = sliceByMarkers(source, "if (pathname === '/api/v1/queue/status' && method === 'GET')", "if (pathname === '/api/v1/pin/verify' && method === 'POST')");
    expect(block).toContain(".from('queues')");
    expect(block).not.toContain('KV_QUEUES.get(queueKey)');
  });
});
