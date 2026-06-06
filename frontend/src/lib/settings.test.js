import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();
const mockUpsert = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

vi.mock('./supabase-client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: (...args) => {
        if (String(args[0]).includes('key, value, description')) {
          return { order: mockOrder };
        }
        return { eq: mockEq };
      },
      upsert: mockUpsert,
    })),
  },
}));

import {
  getSetting,
  getAllSettings,
  getSystemConfig,
  getThemeSettings,
  setSetting,
  updateThemeSettings,
} from './settings';

describe('settings service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSetting returns fallback on read error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(getSetting('missing', 'fallback')).resolves.toBe('fallback');
  });

  it('getAllSettings returns normalized map', async () => {
    mockOrder.mockResolvedValueOnce({
      error: null,
      data: [{ key: 'a', value: 1, description: null }],
    });

    await expect(getAllSettings()).resolves.toEqual({
      a: { value: '1', description: '' },
    });
  });

  it('getSystemConfig applies typed defaults for invalid numbers/booleans', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: 'nan' }, error: null })
      .mockResolvedValueOnce({ data: { value: '2' }, error: null })
      .mockResolvedValueOnce({ data: { value: 'oops' }, error: null })
      .mockResolvedValueOnce({ data: { value: 'yes' }, error: null })
      .mockResolvedValueOnce({ data: { value: 'false' }, error: null })
      .mockResolvedValueOnce({ data: { value: '08:00' }, error: null })
      .mockResolvedValueOnce({ data: { value: '16:00' }, error: null })
      .mockResolvedValueOnce({ data: { value: 777 }, error: null });

    await expect(getSystemConfig()).resolves.toEqual({
      graceMinutes: 5,
      cadenceMinutes: 2,
      maxCapacity: 6,
      autoRouting: true,
      notifications: false,
      workingHours: { start: '08:00', end: '16:00' },
      emergencyPin: '777',
    });
  });

  it('getThemeSettings returns typed defaults on missing rows', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { value: 'true' }, error: null })
      .mockResolvedValueOnce({ data: { value: 'bad' }, error: null });

    await expect(getThemeSettings()).resolves.toEqual({
      currentTheme: 'medical-professional',
      enableThemeSelector: true,
      showThemePreview: true,
    });
  });

  it('setSetting returns false when upsert fails', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'fail' } });
    await expect(setSetting('x', 'y')).resolves.toBe(false);
  });

  it('updateThemeSettings persists mapped keys', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    await expect(updateThemeSettings({ currentTheme: 'medical', enableThemeSelector: false })).resolves.toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});
