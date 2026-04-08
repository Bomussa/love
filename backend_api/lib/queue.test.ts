import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getNextTicket,
  getQueueSnapshot,
  createTicket,
  getPatientQueuePosition,
  updateQueueStatus,
  getTopWaitingPatients
} from './queue.ts';

// Mock Supabase
vi.mock('./supabase.ts', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn()
  },
  callRPC: vi.fn()
}));

describe('Queue System Tests', () => {
  const mockClinicId = 'clinic-123';
  const mockPatientId = 'patient-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getNextTicket', () => {
    it('should return next ticket number from database function', async () => {
      const { callRPC } = await import('./supabase.ts');
      vi.mocked(callRPC).mockResolvedValueOnce({
        success: true,
        data: 5
      });

      const result = await getNextTicket(mockClinicId);
      expect(result).toBe(5);
      expect(callRPC).toHaveBeenCalledWith('fn_get_next_ticket', { p_clinic: mockClinicId });
    });

    it('should throw error if RPC fails', async () => {
      const { callRPC } = await import('./supabase.ts');
      vi.mocked(callRPC).mockResolvedValueOnce({
        success: false,
        error: 'Database error'
      });

      await expect(getNextTicket(mockClinicId)).rejects.toThrow('Database error');
    });
  });

  describe('getQueueSnapshot', () => {
    it('should return queue snapshot with correct counts', async () => {
      const mockQueueData = [
        { status: 'WAITING' },
        { status: 'WAITING' },
        { status: 'YOUR_TURN' },
        { status: 'CANCELLED' }
      ];

      const { supabase } = await import('./supabase.ts');
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValueOnce({ data: mockQueueData, error: null })
      } as any);

      const result = await getQueueSnapshot(mockClinicId);
      expect(result.total).toBe(4);
      expect(result.waiting).toBe(2);
      expect(result.your_turn).toBe(1);
      expect(result.cancelled).toBe(1);
    });

    it('should handle empty queue', async () => {
      const { supabase } = await import('./supabase.ts');
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValueOnce({ data: [], error: null })
      } as any);

      const result = await getQueueSnapshot(mockClinicId);
      expect(result.total).toBe(0);
      expect(result.waiting).toBe(0);
    });
  });

  describe('createTicket', () => {
    it('should create ticket with correct data', async () => {
      const { callRPC } = await import('./supabase.ts');
      vi.mocked(callRPC).mockResolvedValueOnce({
        success: true,
        data: 10
      });

      const { supabase } = await import('./supabase.ts');
      const mockTicket = {
        id: 'queue-789',
        clinic_id: mockClinicId,
        patient_id: mockPatientId,
        position: 10,
        status: 'WAITING',
        exam_type: 'general',
        entered_at: new Date().toISOString()
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: mockTicket, error: null })
      } as any);

      const result = await createTicket(mockClinicId, mockPatientId, 'general');
      expect(result.position).toBe(10);
      expect(result.status).toBe('WAITING');
    });

    it('should throw error if ticket creation fails', async () => {
      const { callRPC } = await import('./supabase.ts');
      vi.mocked(callRPC).mockResolvedValueOnce({
        success: true,
        data: 10
      });

      const { supabase } = await import('./supabase.ts');
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Insert failed' }
        })
      } as any);

      await expect(createTicket(mockClinicId, mockPatientId)).rejects.toThrow();
    });
  });

  describe('updateQueueStatus', () => {
    it('should update status to YOUR_TURN', async () => {
      const { supabase } = await import('./supabase.ts');
      const mockUpdated = {
        id: 'queue-789',
        status: 'YOUR_TURN',
        called_at: new Date().toISOString()
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: mockUpdated, error: null })
      } as any);

      const result = await updateQueueStatus('queue-789', 'YOUR_TURN');
      expect(result.status).toBe('YOUR_TURN');
      expect(result.called_at).toBeDefined();
    });

    it('should update status to DONE with completed_at', async () => {
      const { supabase } = await import('./supabase.ts');
      const mockUpdated = {
        id: 'queue-789',
        status: 'DONE',
        completed_at: new Date().toISOString()
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: mockUpdated, error: null })
      } as any);

      const result = await updateQueueStatus('queue-789', 'DONE');
      expect(result.status).toBe('DONE');
      expect(result.completed_at).toBeDefined();
    });
  });

  describe('getTopWaitingPatients', () => {
    it('should return top waiting patients sorted by entry time', async () => {
      const { supabase } = await import('./supabase.ts');
      const mockPatients = [
        { id: '1', patient_id: 'p1', status: 'WAITING', entered_at: '2026-01-08T10:00:00Z' },
        { id: '2', patient_id: 'p2', status: 'WAITING', entered_at: '2026-01-08T10:05:00Z' },
        { id: '3', patient_id: 'p3', status: 'WAITING', entered_at: '2026-01-08T10:10:00Z' }
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce({ data: mockPatients, error: null })
      } as any);

      const result = await getTopWaitingPatients(mockClinicId, 10);
      expect(result).toHaveLength(3);
      expect(result[0].patient_id).toBe('p1');
    });
  });
});
