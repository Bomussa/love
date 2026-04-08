/**
 * Supabase Client Unit Tests
 * 
 * @module lib/supabase.test
 * @description Comprehensive unit tests for the Supabase client wrapper
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSupabaseClient,
  getActiveQueues,
  addToQueue,
  callNextPatient,
  completePatient,
  getPatientPosition,
  getClinicStats,
  verifyClinicPin,
  createNotification,
  getSettings,
  updateSetting,
  getClinics,
  getClinicById,
} from './supabase';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSupabaseClient', () => {
    it('should create client with valid environment variables', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const client = getSupabaseClient();
      expect(client).toBeDefined();
    });

    it('should throw error if SUPABASE_URL is missing', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      expect(() => getSupabaseClient()).toThrow('SUPABASE_URL must be set');
    });

    it('should throw error if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';

      expect(() => getSupabaseClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should use NEXT_PUBLIC_SUPABASE_URL as fallback', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      const client = getSupabaseClient();
      expect(client).toBeDefined();
    });
  });

  describe('getActiveQueues', () => {
    it('should fetch active queues', async () => {
      const mockData = [
        { id: 1, patient_id: '123', status: 'waiting', display_number: 1 },
        { id: 2, patient_id: '456', status: 'serving', display_number: 2 },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await getActiveQueues(mockSupabaseClient);
      expect(result).toEqual(mockData);
    });

    it('should filter by clinic ID', async () => {
      const mockData = [{ id: 1, patient_id: '123', clinic_id: 'clinic-1' }];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          }),
        }),
      });

      const result = await getActiveQueues(mockSupabaseClient, 'clinic-1');
      expect(result).toEqual(mockData);
    });

    it('should throw error on database failure', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
          }),
        }),
      });

      await expect(getActiveQueues(mockSupabaseClient)).rejects.toThrow('Failed to fetch queues');
    });

    it('should retry on transient errors', async () => {
      const mockData = [{ id: 1, patient_id: '123' }];
      let attempts = 0;

      mockSupabaseClient.from.mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient error');
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          }),
        };
      });

      const result = await getActiveQueues(mockSupabaseClient);
      expect(result).toEqual(mockData);
      expect(attempts).toBe(2);
    });
  });

  describe('addToQueue', () => {
    const validPatientData = {
      patient_id: '12345',
      clinic_id: 'clinic-1',
      exam_type: 'general',
    };

    it('should add patient to queue', async () => {
      const mockQueueEntry = {
        id: 1,
        patient_id: '12345',
        clinic_id: 'clinic-1',
        display_number: 1,
        status: 'waiting',
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockQueueEntry, error: null }),
          }),
        }),
      });

      const result = await addToQueue(mockSupabaseClient, validPatientData);
      expect(result).toEqual(mockQueueEntry);
    });

    it('should throw error if patient_id is missing', async () => {
      await expect(addToQueue(mockSupabaseClient, { clinic_id: 'clinic-1' }))
        .rejects.toThrow('patient_id and clinic_id are required');
    });

    it('should throw error if clinic_id is missing', async () => {
      await expect(addToQueue(mockSupabaseClient, { patient_id: '12345' }))
        .rejects.toThrow('patient_id and clinic_id are required');
    });

    it('should handle priority patients', async () => {
      const mockQueueEntry = {
        id: 1,
        patient_id: '12345',
        is_priority: true,
        priority_reason: 'Emergency',
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockQueueEntry, error: null }),
          }),
        }),
      });

      const result = await addToQueue(mockSupabaseClient, {
        ...validPatientData,
        is_priority: true,
        priority_reason: 'Emergency',
      });
      
      expect(result.is_priority).toBe(true);
    });
  });

  describe('callNextPatient', () => {
    it('should call next patient', async () => {
      const mockPatient = {
        id: 1,
        patient_id: '12345',
        status: 'waiting',
        display_number: 1,
      };

      const mockUpdatedPatient = {
        ...mockPatient,
        status: 'serving',
        called_at: expect.any(String),
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedPatient, error: null }),
            }),
          }),
        }),
      });

      const result = await callNextPatient(mockSupabaseClient, 'clinic-1');
      expect(result.status).toBe('serving');
    });

    it('should return null if queue is empty', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await callNextPatient(mockSupabaseClient, 'clinic-1');
      expect(result).toBeNull();
    });

    it('should throw error if clinicId is missing', async () => {
      await expect(callNextPatient(mockSupabaseClient, null))
        .rejects.toThrow('clinicId is required');
    });

    it('should prioritize priority patients', async () => {
      const normalPatient = { id: 1, patient_id: '123', is_priority: false, display_number: 1 };
      const priorityPatient = { id: 2, patient_id: '456', is_priority: true, display_number: 2 };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: priorityPatient, error: null }),
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { ...priorityPatient, status: 'serving' }, error: null }),
            }),
          }),
        }),
      });

      const result = await callNextPatient(mockSupabaseClient, 'clinic-1');
      expect(result.is_priority).toBe(true);
    });
  });

  describe('completePatient', () => {
    it('should complete patient examination', async () => {
      const mockUpdated = {
        id: 1,
        patient_id: '12345',
        status: 'completed',
        completed_at: expect.any(String),
      };

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
            }),
          }),
        }),
      });

      const result = await completePatient(mockSupabaseClient, 'queue-1', '1234');
      expect(result.status).toBe('completed');
      expect(result.completed_by_pin).toBe('1234');
    });

    it('should throw error if queueId is missing', async () => {
      await expect(completePatient(mockSupabaseClient, null))
        .rejects.toThrow('queueId is required');
    });

    it('should work without PIN', async () => {
      const mockUpdated = {
        id: 1,
        status: 'completed',
        completed_at: expect.any(String),
        completed_by_pin: null,
      };

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
            }),
          }),
        }),
      });

      const result = await completePatient(mockSupabaseClient, 'queue-1');
      expect(result.status).toBe('completed');
    });
  });

  describe('getPatientPosition', () => {
    it('should get patient position', async () => {
      const mockPosition = {
        display_number: 5,
        status: 'waiting',
        clinic_id: 'clinic-1',
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockPosition, error: null }),
            }),
          }),
        }),
      });

      const result = await getPatientPosition(mockSupabaseClient, '12345');
      expect(result).toEqual(mockPosition);
    });

    it('should return null if patient not in queue', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const result = await getPatientPosition(mockSupabaseClient, '99999');
      expect(result).toBeNull();
    });

    it('should throw error if patientId is missing', async () => {
      await expect(getPatientPosition(mockSupabaseClient, null))
        .rejects.toThrow('patientId is required');
    });
  });

  describe('getClinicStats', () => {
    it('should calculate clinic statistics', async () => {
      const mockQueues = [
        { status: 'waiting', entered_at: '2025-01-01T10:00:00Z' },
        { status: 'serving', entered_at: '2025-01-01T10:00:00Z' },
        { status: 'completed', entered_at: '2025-01-01T10:00:00Z', completed_at: '2025-01-01T10:15:00Z' },
        { status: 'completed', entered_at: '2025-01-01T10:00:00Z', completed_at: '2025-01-01T10:30:00Z' },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockQueues, error: null }),
        }),
      });

      const result = await getClinicStats(mockSupabaseClient, 'clinic-1');
      
      expect(result.total_patients).toBe(4);
      expect(result.waiting).toBe(1);
      expect(result.serving).toBe(1);
      expect(result.completed).toBe(2);
      expect(result.average_wait_time).toBeGreaterThan(0);
    });

    it('should handle empty queue', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await getClinicStats(mockSupabaseClient, 'clinic-1');
      
      expect(result.total_patients).toBe(0);
      expect(result.average_wait_time).toBe(0);
    });

    it('should throw error if clinicId is missing', async () => {
      await expect(getClinicStats(mockSupabaseClient, null))
        .rejects.toThrow('clinicId is required');
    });
  });

  describe('verifyClinicPin', () => {
    it('should verify valid PIN', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { pin: '1234' }, error: null }),
          }),
        }),
      });

      const result = await verifyClinicPin(mockSupabaseClient, 'clinic-1', '1234');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid PIN', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { pin: '1234' }, error: null }),
          }),
        }),
      });

      const result = await verifyClinicPin(mockSupabaseClient, 'clinic-1', '9999');
      expect(result.valid).toBe(false);
    });

    it('should throw error if clinicId or pin is missing', async () => {
      await expect(verifyClinicPin(mockSupabaseClient, null, '1234'))
        .rejects.toThrow('clinicId and pin are required');
      
      await expect(verifyClinicPin(mockSupabaseClient, 'clinic-1', null))
        .rejects.toThrow('clinicId and pin are required');
    });
  });

  describe('createNotification', () => {
    it('should create notification', async () => {
      const notificationData = {
        type: 'info',
        message: 'Test notification',
        user_id: 'user-1',
      };

      const mockNotification = {
        id: 1,
        ...notificationData,
        created_at: expect.any(String),
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockNotification, error: null }),
          }),
        }),
      });

      const result = await createNotification(mockSupabaseClient, notificationData);
      expect(result.message).toBe('Test notification');
    });
  });

  describe('getSettings', () => {
    it('should get all settings', async () => {
      const mockSettings = [
        { key: 'setting1', value: 'value1' },
        { key: 'setting2', value: 'value2' },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
      });

      const result = await getSettings(mockSupabaseClient);
      expect(result).toEqual(mockSettings);
    });

    it('should get single setting by key', async () => {
      const mockSetting = { key: 'setting1', value: 'value1' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSetting, error: null }),
          }),
        }),
      });

      const result = await getSettings(mockSupabaseClient, 'setting1');
      expect(result).toEqual(mockSetting);
    });
  });

  describe('updateSetting', () => {
    it('should update setting', async () => {
      const mockSetting = { key: 'setting1', value: 'newValue' };

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSetting, error: null }),
          }),
        }),
      });

      const result = await updateSetting(mockSupabaseClient, 'setting1', 'newValue');
      expect(result.value).toBe('newValue');
    });

    it('should throw error if key is missing', async () => {
      await expect(updateSetting(mockSupabaseClient, null, 'value'))
        .rejects.toThrow('key is required');
    });
  });

  describe('getClinics', () => {
    it('should get all clinics ordered by name', async () => {
      const mockClinics = [
        { id: 'clinic-1', name_ar: 'عيادة أ', name: 'Clinic A' },
        { id: 'clinic-2', name_ar: 'عيادة ب', name: 'Clinic B' },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockClinics, error: null }),
        }),
      });

      const result = await getClinics(mockSupabaseClient);
      expect(result).toEqual(mockClinics);
    });

    it('should return empty array if no clinics', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const result = await getClinics(mockSupabaseClient);
      expect(result).toEqual([]);
    });
  });

  describe('getClinicById', () => {
    it('should get clinic by ID', async () => {
      const mockClinic = { id: 'clinic-1', name_ar: 'عيادة أ' };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockClinic, error: null }),
          }),
        }),
      });

      const result = await getClinicById(mockSupabaseClient, 'clinic-1');
      expect(result).toEqual(mockClinic);
    });

    it('should return null if clinic not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await getClinicById(mockSupabaseClient, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should throw error if clinicId is missing', async () => {
      await expect(getClinicById(mockSupabaseClient, null))
        .rejects.toThrow('clinicId is required');
    });
  });
});

// Edge cases
describe('Edge Cases', () => {
  it('should handle special characters in IDs', async () => {
    const mockClinic = { id: 'clinic-1', name: 'Test' };

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockClinic, error: null }),
        }),
      }),
    });

    const result = await getClinicById(mockSupabaseClient, '  clinic-1  ');
    expect(result).toEqual(mockClinic);
  });

  it('should handle very long IDs', async () => {
    const longId = 'a'.repeat(1000);
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const result = await getClinicById(mockSupabaseClient, longId);
    expect(result).toBeNull();
  });
});
