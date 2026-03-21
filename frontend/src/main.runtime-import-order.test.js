import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('main runtime import order', () => {
  it('loads the canonical patient runtime patch after the bootstrap wiring and before render', () => {
    const source = readSource('src/main.jsx');
    const bootstrapIndex = source.indexOf("import './lib/patient-flow-bootstrap.js'");
    const patchIndex = source.indexOf("import './lib/canonical-patient-runtime-patch.js'");

    expect(bootstrapIndex).toBeGreaterThanOrEqual(0);
    expect(patchIndex).toBeGreaterThanOrEqual(0);
    expect(bootstrapIndex).toBeLessThan(patchIndex);
  });
});
