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

describe('api-unified queueDone canonical contract', () => {
  it('attempts the canonical /api/v1/queue/done request before direct table mutation fallback', () => {
    const source = readSource('src/lib/api-unified.js');
    const queueDoneBlock = sliceByMarkers(source, 'async queueDone(', 'async callNextPatient(');

    expect(queueDoneBlock).toContain("requestJson(`${resolveApiV1Base()}/queue/done`");

    const canonicalCallIndex = queueDoneBlock.indexOf("requestJson(`${resolveApiV1Base()}/queue/done`");
    const firstDirectQueueMutationIndex = queueDoneBlock.indexOf(".from('queues')");

    expect(canonicalCallIndex).toBeGreaterThanOrEqual(0);
    expect(firstDirectQueueMutationIndex).toBeGreaterThanOrEqual(0);
    expect(canonicalCallIndex).toBeLessThan(firstDirectQueueMutationIndex);
  });
});
