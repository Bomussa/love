import { describe, it, expect } from 'vitest';
import { QUEUE_STATUS, invokeRpcSafe, getNextClinicInRoute } from '../api/v1.js';

describe('api/v2 compatibility', () => {
  it('keeps unified status values', () => {
    expect(QUEUE_STATUS.WAITING).toBe('WAITING');
    expect(QUEUE_STATUS.DONE).toBe('DONE');
  });

  it('returns missing RPC marker for undefined function', async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { code: '42883', message: 'function does not exist' } }),
    };

    const result = await invokeRpcSafe(supabase as any, 'missing_fn', {});
    expect(result.ok).toBe(false);
    expect(result.missing).toBe(true);
  });

  it('computes next clinic for recruitment male path', () => {
    const result = getNextClinicInRoute({
      examType: 'recruitment',
      gender: 'male',
      currentClinicId: 'XR',
    });
    expect(result.nextClinicId).toBe('EYE');
    expect(result.finished).toBe(false);
  });

  it('marks path as finished at final clinic', () => {
    const result = getNextClinicInRoute({
      examType: 'recruitment',
      gender: 'male',
      currentClinicId: 'DNT',
    });
    expect(result.nextClinicId).toBeNull();
    expect(result.finished).toBe(true);
  });
});
