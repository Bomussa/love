import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => ({
  apiClient: {
    post: vi.fn()
  }
}));

import api from '../api-unified';
import { apiClient } from '../api/client';

describe('api-unified verifyPin', () => {
  it('normalizes successful pin responses across valid/verified shapes', async () => {
    apiClient.post.mockResolvedValueOnce({ valid: true });

    const result = await api.verifyPin(4, ' 222 ');

    expect(apiClient.post).toHaveBeenCalledWith('pinValidate', { clinicId: 4, pin: '222' });
    expect(result.success).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('returns normalized failure object when request fails', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('network')); 

    const result = await api.verifyPin(1, '12');

    expect(result.success).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('network');
  });
});
