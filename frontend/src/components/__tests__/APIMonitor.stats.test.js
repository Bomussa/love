import { describe, expect, it } from 'vitest';
import { computeMonitorStats } from '../APIMonitor.jsx';

describe('computeMonitorStats', () => {
  it('counts only confirmed checks and excludes errors/warnings from active totals', () => {
    const result = computeMonitorStats({
      totalTables: 4,
      totalFunctions: 3,
      tables: {
        clinics: { status: 'active', confirmed: true },
        users: { status: 'warning', confirmed: true },
        queue: { status: 'error', confirmed: true },
        logs: { status: 'active', confirmed: false }
      },
      functions: {
        enter_queue: { status: 'active', confirmed: true },
        call_next: { status: 'warning', confirmed: true },
        finalize_visit: { status: 'active', confirmed: false }
      }
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "activeFunctions": 1,
        "activeTables": 1,
        "totalFunctions": 3,
        "totalTables": 4,
        "uptime": "40.0",
      }
    `);
  });
});
