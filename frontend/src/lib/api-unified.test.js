import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./guaranteed-data-system', () => ({ initGDS: vi.fn().mockResolvedValue(undefined) }));

vi.mock('./supabase-client', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };

  return {
    supabase: {
      from: vi.fn(() => chain),
      rpc: vi.fn(),
      __chain: chain,
    },
  };
});

import api from './api-unified';
import { supabase } from './supabase-client';

const chain = supabase.__chain;

describe('api-unified regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns clinics list when query succeeds', async () => {
    chain.order.mockResolvedValueOnce({ data: [{ id: '1' }], error: null });

    const res = await api.getClinics();
    expect(res).toEqual({ success: true, clinics: [{ id: '1' }] });
  });

  it('returns 0 queue count on query failure', async () => {
    chain.eq
      .mockReturnValueOnce(chain)
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce({ count: null, error: new Error('db down') });

    const count = await api.getQueueCount('clinic-1');
    expect(count).toBe(0);
  });
});
