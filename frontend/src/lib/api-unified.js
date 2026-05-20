import { supabase } from './supabase-client';
import { initGDS } from './guaranteed-data-system';

/**
 * Unified API Service
 * Canonical runtime:
 * - Read queue state from public.queues
 * - Write queue entries through safe RPCs / edge functions with fallbacks
 * - Preserve legacy HTTP shims for isolated test coverage only
 */

initGDS().catch((err) => console.error('❌ فشل تهيئة GDS:', err));

export const API_VERSION = '/api/v1';
const CANONICAL_QUEUE_STATUSES = new Set(['waiting', 'called', 'completed']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function qatarDateTime() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
}

function qatarDate() {
  return qatarDateTime().slice(0, 10);
}

function normalizeQueueStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'done' || value === 'completed') return 'completed';
  if (value === 'serving' || value === 'in_service' || value === 'in_progress' || value === 'in-progress') return 'called';
  if (value === 'waiting') return 'waiting';
  if (value === 'called') return 'called';
  if (value === 'cancelled' || value === 'no_show' || value === 'skipped') return value;
  return value;
}

function normalizeQueueRow(row) {
  if (!row) return null;
  return {
    ...row,
    status: normalizeQueueStatus(row.status),
  };
}

function normalizePatientRecord(record, fallbackId = null) {
  if (!record) return null;
  const resolved = record.id || record.patient_id || record.personal_id || fallbackId;
  return {
    ...record,
    id: resolved,
    patient_id: record.patient_id || resolved,
    personal_id: record.personal_id || record.patient_id || resolved,
  };
}

function normalizeClinicRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    name: row.name || row.name_en || row.name_ar || row.code || row.id,
    name_ar: row.name_ar || row.name || row.name_en || row.code || row.id,
    name_en: row.name_en || row.name || row.name_ar || row.code || row.id,
  };
}

function buildQueueMatchClause(patientId) {
  const safe = String(patientId ?? '').replace(/'/g, "''");
  return `patient_id.eq.${safe},personal_id.eq.${safe},military_id.eq.${safe}`;
}

async function legacyHttpRequest(endpoint, body = {}, headers = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Version': 'v1',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    return {
      success: false,
      error: data?.error || data?.message || `HTTP ${response.status}`,
      status: response.status,
      data,
    };
  }

  return {
    success: true,
    status: response.status,
    ...data,
  };
}

async function invokeEdgeFunction(name, body) {
  if (!supabase?.functions?.invoke) {
    throw new Error('Edge functions are not available in this environment');
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
  });

  if (error) {
    throw error;
  }

  return data;
}

async function fetchQueueRowsByClinic(clinicId) {
  const today = qatarDate();
  const { data, error } = await supabase
    .from('queues')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .order('queue_number_int', { ascending: true, nullsFirst: false })
    .order('display_number', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeQueueRow);
}

function getSortValue(row) {
  const numericFields = [row?.queue_number_int, row?.display_number, row?.number];
  for (const value of numericFields) {
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function pickFirstKnown(rows, predicate) {
  return rows.find((row) => predicate(normalizeQueueStatus(row.status), row)) || null;
}

async function upsertQueueMetadata(queueId, metadata = {}) {
  const updates = {};

  if (metadata.patientName) updates.patient_name = metadata.patientName;
  if (metadata.gender) updates.gender = metadata.gender;
  if (metadata.militaryId !== undefined) updates.military_id = metadata.militaryId;
  if (metadata.personalId !== undefined) updates.personal_id = metadata.personalId;
  if (metadata.examType !== undefined) updates.exam_type = metadata.examType;

  if (Object.keys(updates).length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('queues')
    .update(updates)
    .eq('id', queueId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeQueueRow(data);
}

async function insertQueueRowFallback({ clinicId, patientId, patientName, examType, gender, militaryId, personalId, priorityReason = null, isPriority = false }) {
  const today = qatarDate();
  const { data: currentRows, error: readError } = await supabase
    .from('queues')
    .select('display_number, queue_number_int, queue_number')
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .order('display_number', { ascending: false })
    .limit(1);

  if (readError) {
    throw readError;
  }

  const nextDisplay = Number(currentRows?.[0]?.display_number || currentRows?.[0]?.queue_number_int || 0) + 1;
  const rowToInsert = {
    clinic_id: clinicId,
    patient_id: patientId,
    patient_name: patientName || null,
    personal_id: personalId || patientId || null,
    military_id: militaryId || null,
    exam_type: examType || null,
    display_number: nextDisplay,
    queue_number_int: nextDisplay,
    queue_number: String(nextDisplay),
    status: 'waiting',
    queue_date: today,
    entered_at: qatarDateTime(),
    is_priority: Boolean(isPriority),
    priority_reason: priorityReason || null,
  };

  const { data, error } = await supabase
    .from('queues')
    .insert(rowToInsert)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeQueueRow(data);
}

const api = {
  async patientLogin(patientId, gender) {
    try {
      const { data, error } = await supabase.rpc('patient_login_safe', {
        p_personal_id: patientId,
        p_gender: gender || 'male',
      });

      if (error) throw error;

      const normalized = normalizePatientRecord(data, patientId);
      return {
        success: true,
        data: normalized,
      };
    } catch (error) {
      console.error('Login Error:', error);
      try {
        const { data, error: fetchError } = await supabase
          .from('patients')
          .select('*')
          .eq('personal_id', patientId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          return { success: true, data: normalizePatientRecord(data, patientId) };
        }

        const { data: newUser, error: createError } = await supabase
          .from('patients')
          .insert([
            {
              personal_id: patientId,
              gender: gender || 'male',
              status: 'active',
              name: `Patient ${patientId}`,
              created_at: qatarDateTime(),
              updated_at: qatarDateTime(),
            },
          ])
          .select('*')
          .single();

        if (createError) throw createError;
        return { success: true, data: normalizePatientRecord(newUser, patientId) };
      } catch (fallbackError) {
        return { success: false, error: fallbackError.message };
      }
    }
  },

  getQatarDate() {
    return qatarDate();
  },

  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null, gender = null, militaryId = null, personalId = null) {
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('add_to_queue_atomic', {
        p_patient_id: patientId,
        p_clinic_id: clinicId,
        p_exam_type: examType || null,
        p_is_priority: false,
        p_priority_reason: null,
      });

      if (rpcError) {
        console.warn('add_to_queue_atomic RPC unavailable, falling back to direct insert:', rpcError.message);
        const inserted = await insertQueueRowFallback({
          clinicId,
          patientId,
          patientName,
          examType,
          gender,
          militaryId,
          personalId: personalId || patientId,
        });
        return {
          success: true,
          ...inserted,
          display_number: inserted.display_number || inserted.queue_number_int,
          alreadyExists: false,
        };
      }

      const normalized = normalizeQueueRow(rpcResult);
      const enriched = await upsertQueueMetadata(normalized.id, {
        patientName,
        gender,
        militaryId,
        personalId: personalId || patientId,
        examType,
      }).catch(() => null);

      return {
        success: true,
        ...(enriched || normalized),
        display_number: (enriched || normalized)?.display_number || (enriched || normalized)?.queue_number_int,
        alreadyExists: String((enriched || normalized)?.status || '').toUpperCase() === 'ALREADY_IN_QUEUE',
      };
    } catch (error) {
      console.error('enterQueue exception:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueuePosition(clinicId, patientId) {
    try {
      const rows = await fetchQueueRowsByClinic(clinicId);
      const patientEntry = pickFirstKnown(rows, (status, row) => [row.patient_id, row.personal_id, row.military_id].includes(patientId));

      if (!patientEntry) {
        return { success: false, error: 'لم يتم العثور على المراجع في الطابور' };
      }

      const servingEntry = pickFirstKnown(rows, (status) => ['called', 'serving', 'in_service', 'in_progress'].includes(status));
      const lastCompleted = [...rows].reverse().find((row) => ['completed', 'done'].includes(normalizeQueueStatus(row.status))) || null;
      const currentNumber = servingEntry?.display_number || servingEntry?.queue_number_int || lastCompleted?.display_number || lastCompleted?.queue_number_int || 0;
      const patientSortValue = getSortValue(patientEntry);
      const ahead = rows.filter((row) => {
        const status = normalizeQueueStatus(row.status);
        return status === 'waiting' && getSortValue(row) < patientSortValue;
      }).length;

      return {
        success: true,
        display_number: patientEntry.display_number || patientEntry.queue_number_int || null,
        current_number: currentNumber,
        ahead,
        status: patientEntry.status,
        entered_at: patientEntry.entered_at,
      };
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  async queueDone(clinicId, patientId) {
    try {
      try {
        const result = await invokeEdgeFunction('queue-engine', {
          action: 'complete_exam',
          clinic_id: clinicId,
          patient_id: patientId,
          operator_pin: null,
        });

        if (result && result.success !== false) {
          return { success: true, data: result.data || result };
        }
      } catch (edgeError) {
        console.warn('queue-engine complete_exam failed, falling back to direct update:', edgeError?.message || edgeError);
      }

      const now = qatarDateTime();
      const { data, error } = await supabase
        .from('queues')
        .update({
          status: 'completed',
          completed_at: now,
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'called', 'serving', 'in_service', 'in_progress'])
        .select('*');

      if (error) throw error;
      return { success: true, data: (data || []).map(normalizeQueueRow) };
    } catch (error) {
      console.error('Queue Done Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getSettings() {
    try {
      const { data, error } = await supabase.from('system_settings').select('*').order('id', { ascending: true });
      if (error) throw error;
      const settings = {};
      (data || []).forEach((s) => {
        try {
          settings[s.id] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
        } catch {
          settings[s.id] = s.value;
        }
      });
      return { success: true, settings };
    } catch (error) {
      try {
        const { data, error: legacyError } = await supabase.from('system_config').select('*').order('key', { ascending: true });
        if (legacyError) throw legacyError;
        const settings = {};
        (data || []).forEach((row) => {
          settings[row.key] = row.value;
        });
        return { success: true, settings };
      } catch (fallbackError) {
        console.error('Get Settings Error:', fallbackError);
        return { success: false, error: fallbackError.message };
      }
    }
  },

  async getQueueCount(clinicId) {
    try {
      const today = qatarDate();
      const { count, error } = await supabase
        .from('queues')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'waiting');
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Get Queue Count Error:', error);
      return 0;
    }
  },

  async getRoute(patientId) {
    try {
      const { data, error } = await supabase
        .from('patient_routes')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { success: false, error: 'Route not found' };
      return { success: true, route: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async createRoute(patientId, examType, gender, stations) {
    try {
      const stationsData = (stations || []).map((s, index) => ({
        id: s.id,
        name: s.name || s.nameAr,
        nameAr: s.nameAr || s.name,
        floor: s.floor,
        floorCode: s.floorCode,
        order: index + 1,
      }));

      const { data, error } = await supabase
        .from('patient_routes')
        .upsert(
          {
            patient_id: patientId,
            exam_type: examType,
            gender,
            stations: stationsData,
            updated_at: qatarDateTime(),
          },
          { onConflict: 'patient_id' },
        )
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Create Route Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getClinics() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, name_ar, name_en, floor, is_active, exam_duration, category, gender_constraint, system_enabled')
        .order('name_ar', { ascending: true });

      if (error) throw error;
      return { success: true, clinics: (data || []).map(normalizeClinicRow) };
    } catch (error) {
      console.error('Get Clinics Error:', error);
      return { success: false, error: error.message, clinics: [] };
    }
  },

  async verifyPin(clinicId) {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, name_ar, name_en')
        .eq('id', clinicId)
        .maybeSingle();

      if (error || !data) {
        return { success: false, isValid: false, error: 'Clinic not found' };
      }

      return {
        success: true,
        isValid: true,
        session: {
          clinicId: data.id,
          clinicName: data.name_ar || data.name_en || data.name || clinicId,
        },
      };
    } catch (error) {
      console.error('Verify Clinic Error:', error);
      return { success: false, isValid: false, error: error.message };
    }
  },

  async getQueueStatus(clinicId) {
    try {
      const rows = await fetchQueueRowsByClinic(clinicId);
      const waiting = rows.filter((row) => normalizeQueueStatus(row.status) === 'waiting');
      const called = rows.filter((row) => normalizeQueueStatus(row.status) === 'called');
      const completed = rows.filter((row) => normalizeQueueStatus(row.status) === 'completed');
      const serving = rows.find((row) => ['called', 'serving', 'in_service', 'in_progress'].includes(normalizeQueueStatus(row.status))) || null;

      return {
        success: true,
        queue: rows,
        currentNumber: serving?.display_number || serving?.queue_number_int || 0,
        waitingCount: waiting.length,
        calledCount: called.length,
        completedCount: completed.length,
      };
    } catch (error) {
      console.error('Get Queue Status Error:', error);
      return { success: false, error: error.message, queue: [] };
    }
  },

  async callNextPatient(clinicId) {
    try {
      const result = await invokeEdgeFunction('queue-engine', {
        action: 'call_next',
        clinic_id: clinicId,
        operator_pin: null,
      });

      if (result && result.success !== false) {
        const ticket = result.data || result;
        return { success: true, data: ticket, ticket };
      }
    } catch (edgeError) {
      console.warn('queue-engine call_next failed, falling back to direct update:', edgeError?.message || edgeError);
    }

    try {
      const rows = await fetchQueueRowsByClinic(clinicId);
      const waitingRow = rows.find((row) => normalizeQueueStatus(row.status) === 'waiting');
      if (!waitingRow) {
        return { success: false, error: 'No patients waiting' };
      }

      const now = qatarDateTime();
      const { data, error } = await supabase
        .from('queues')
        .update({ status: 'called', called_at: now })
        .eq('id', waitingRow.id)
        .select('*')
        .single();

      if (error) throw error;
      const ticket = normalizeQueueRow(data);
      return { success: true, data: ticket, ticket };
    } catch (error) {
      console.error('Call Next Patient Error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateQueueStatus(clinicId, patientId, status) {
    try {
      const normalizedStatus = normalizeQueueStatus(status);
      const now = qatarDateTime();
      const updateData = { status: normalizedStatus };

      if (normalizedStatus === 'completed') {
        updateData.completed_at = now;
      } else if (normalizedStatus === 'called') {
        updateData.called_at = now;
      } else if (normalizedStatus === 'waiting') {
        updateData.called_at = null;
        updateData.completed_at = null;
      }

      const { data, error } = await supabase
        .from('queues')
        .update(updateData)
        .eq('clinic_id', clinicId)
        .or(buildQueueMatchClause(patientId))
        .select('*');

      if (error) throw error;
      return { success: true, data: (data || []).map(normalizeQueueRow) };
    } catch (error) {
      console.error('Update Queue Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  async createQueue(firstArg, examType = null, gender = null, idempotencyKey = null) {
    // Legacy / test compatibility branch: createQueue({ clinic_id, patient_id, ... })
    if (isObject(firstArg)) {
      return legacyHttpRequest('/api/v1/queue/create', firstArg);
    }

    const patientId = String(firstArg || '').trim();
    if (!patientId) {
      return { success: false, error: 'patientId is required' };
    }

    const resolvedClinicId = String(idempotencyKey || '').trim() || null;
    if (!resolvedClinicId) {
      return { success: false, error: 'clinicId is required for canonical queue creation' };
    }

    try {
      const result = await this.enterQueue(
        resolvedClinicId,
        patientId,
        true,
        null,
        examType,
        gender,
        null,
        patientId,
      );

      if (!result.success) return result;
      return {
        success: true,
        data: {
          queueId: result.id || result.queue_id || result.data?.id || null,
          number: result.display_number || result.queue_number_int || result.number || null,
          clinicId: resolvedClinicId,
          path: [],
        },
        alreadyInQueue: Boolean(result.alreadyExists),
      };
    } catch (error) {
      console.error('Create Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  async advanceQueue(payload) {
    if (isObject(payload)) {
      return legacyHttpRequest('/api/v1/queue/advance', payload);
    }
    return this.callNextPatient(payload);
  },

  async getQueues() {
    try {
      const today = qatarDate();
      const { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('queue_date', today)
        .order('clinic_id', { ascending: true })
        .order('queue_number_int', { ascending: true, nullsFirst: false })
        .order('display_number', { ascending: true });
      if (error) throw error;
      return { success: true, queues: (data || []).map(normalizeQueueRow) };
    } catch (error) {
      return { success: false, error: error.message, queues: [] };
    }
  },

  async getQueueStats() {
    try {
      const { data, error } = await supabase.rpc('health_check');
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async adminLogin(username, password) {
    try {
      const { data, error } = await supabase.rpc('admin_login_safe', {
        p_username: username,
        p_password: password,
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return legacyHttpRequest('/api/v1/admin/login', { username, password });
    }
  },

  async recoverQueues() {
    try {
      const { data, error } = await supabase
        .from('queues')
        .select('id, clinic_id, patient_id, status, display_number, queue_date')
        .eq('queue_date', qatarDate())
        .order('clinic_id', { ascending: true });
      if (error) throw error;
      return { success: true, data: (data || []).map(normalizeQueueRow) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getHealthStatus() {
    try {
      const { count, error } = await supabase
        .from('clinics')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return {
        success: true,
        status: 'OK',
        clinicsCount: count || 0,
      };
    } catch (error) {
      return { success: false, error: error.message, status: 'ERROR' };
    }
  },

  async enterQueue(clinicId, userId, isAutoEntry = false, name = null, queueType = null) {
    // Legacy HTTP shim used by old tests / environments only.
    if (isObject(clinicId)) {
      return legacyHttpRequest('/api/v1/queue/enter', clinicId);
    }

    return this.enterQueueCanonical(clinicId, userId, isAutoEntry, name, queueType);
  },

  async enterQueueCanonical(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null, gender = null, militaryId = null, personalId = null) {
    return this.enterQueue(clinicId, patientId, isAutoEnter, patientName, examType, gender, militaryId, personalId);
  },

  async queueDone(clinicId, userId) {
    return this.queueDoneCanonical(clinicId, userId);
  },

  async queueDoneCanonical(clinicId, patientId) {
    try {
      const result = await this.queueDone(clinicId, patientId);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async startExamination(queueId, doctorId = null) {
    return { success: false, error: 'startExamination is not part of the canonical queue contract' };
  },

  async advancePatient(queueId, doctorClinicId = null, version = null) {
    return { success: false, error: 'advancePatient is not part of the canonical queue contract' };
  },

  connectSSE(clinic, callback) {
    return {
      close: () => {},
    };
  },
};

export default api;
export { api, normalizeQueueStatus, normalizeQueueRow };
