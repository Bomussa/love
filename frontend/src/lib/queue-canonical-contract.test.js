import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('queue canonical contract', () => {
  it('uses canonical public.queues in patient enter/admin status frontend paths', () => {
    const apiUnified = read('src/lib/api-unified.js');

    expect(apiUnified).toContain(".from('queues')");
    expect(apiUnified).not.toContain(".from('unified_queue')");

    // patient enter flow
    expect(apiUnified).toMatch(/async\s+enterQueue[\s\S]*\.from\('queues'\)/);

    // admin status flow
    expect(apiUnified).toMatch(/getQueueStatusWithStats[\s\S]*\.from\('queues'\)/);
  });

  it('uses canonical public.queues in display/admin realtime subscriptions', () => {
    const display = read('src/components/DisplayPage.jsx');
    const displayEnhanced = read('src/components/DisplayPage-Enhanced.jsx');
    const admin = read('src/components/AdminDashboardV2.jsx');
    const patient = read('src/components/PatientPage.jsx');

    expect(display).toContain("table: 'queues'");
    expect(displayEnhanced).toContain("table: 'queues'");
    expect(admin).toContain("table: 'queues'");
    expect(patient).toContain("table: 'queues'");
  });
});
