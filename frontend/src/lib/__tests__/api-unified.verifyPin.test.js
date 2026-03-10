import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock, maybeSingleMock, queryBuilder } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    is: vi.fn(() => queryBuilder),
    gte: vi.fn(() => queryBuilder),
    maybeSingle: maybeSingleMock,
  };
  return {
    rpcMock: vi.fn(),
    fromMock: vi.fn(() => queryBuilder),
    maybeSingleMock,
    queryBuilder,
  };
});

vi.mock('../supabase-client', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

vi.mock('../pin-daily-sync', () => ({
  default: class MockPINDailySync {
    startDailySync() {}
  },
}));

vi.mock('../guaranteed-data-system', () => ({
  GDS: {},
  initGDS: vi.fn().mockResolvedValue(undefined),
}));

import { api } from '../api-unified';

describe('api.verifyPin fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses clinic_id in fallback and succeeds for same clinic when RPC fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'RPC unavailable' } });
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: 7, clinic_id: 'clinic-a', valid_until: '2099-01-01T00:00:00.000Z', used_at: null },
      error: null,
    });

    const result = await api.verifyPin('clinic-a', '123456');

    expect(result.success).toBe(true);
    expect(result.isValid).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('pins');
    expect(queryBuilder.eq).toHaveBeenCalledWith('clinic_id', 'clinic-a');
    expect(queryBuilder.eq).toHaveBeenCalledWith('pin', '123456');
    expect(queryBuilder.is).toHaveBeenCalledWith('used_at', null);
    expect(queryBuilder.gte).toHaveBeenCalledWith('valid_until', expect.any(String));
  });
});
