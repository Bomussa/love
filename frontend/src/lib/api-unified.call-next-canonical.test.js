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

describe('api-unified callNextPatient canonical contract', () => {
  it('should attempt the canonical /api/v1/queue/call request before direct queue-table mutations', () => {
    const source = readSource('src/lib/api-unified.js');
    const block = sliceByMarkers(source, 'async callNextPatient(', '// --- Clinics & PIN ---');

    expect(block).toContain("requestJson(`${resolveApiV1Base()}/queue/call`");

    const canonicalCallIndex = block.indexOf("requestJson(`${resolveApiV1Base()}/queue/call`");
    const firstDirectQueueMutationIndex = block.indexOf(".from('queues')");

    expect(canonicalCallIndex).toBeGreaterThanOrEqual(0);
    expect(firstDirectQueueMutationIndex).toBeGreaterThanOrEqual(0);
    expect(canonicalCallIndex).toBeLessThan(firstDirectQueueMutationIndex);
  });
});
