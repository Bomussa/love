import { supabase } from './supabase-client';
import authService from './auth-service';

const AUDIT_TABLE = 'activity_logs';
const MUTATION_TABLES = new Set(['activity_logs', 'daily_activity_logs', 'permanent_audit_logs']);
const AUDIT_EVENT_FLAG = '__MMC_ADMIN_AUDIT_LOCK__';
let installed = false;
let originalFrom = null;
let originalRpc = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readJsonStorage(key) {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getAuditSessionContext() {
  const adminSession = readJsonStorage('mmc_admin_session');
  const doctorSession = readJsonStorage('mmc_doctor_session');
  const authSession = typeof authService?.getSession === 'function' ? authService.getSession() : null;
  const session = doctorSession || adminSession || authSession || null;

  if (!session) {
    return {
      userId: null,
      username: null,
      role: null,
      source: null,
    };
  }

  return {
    userId: session.id || session.user_id || session.username || null,
    username: session.username || session.name || session.full_name || null,
    role: session.role || null,
    source: doctorSession ? 'doctor-session' : adminSession ? 'admin-session' : 'auth-service',
  };
}

function isAuditShellActive() {
  if (!isBrowser()) return false;

  const path = window.location.pathname || '';
  return Boolean(
    document.querySelector('[data-view="admin"], [data-view="doctor"]') ||
    path.startsWith('/admin') ||
    path.startsWith('/doctor') ||
    readJsonStorage('mmc_admin_session') ||
    readJsonStorage('mmc_doctor_session')
  );
}

function getTextLabel(el) {
  if (!el || typeof el !== 'object') return 'unknown';

  const aria = el.getAttribute?.('aria-label')?.trim();
  if (aria) return aria;

  const title = el.getAttribute?.('title')?.trim();
  if (title) return title;

  const text = (el.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return text.slice(0, 120);

  const placeholder = el.getAttribute?.('placeholder')?.trim();
  if (placeholder) return placeholder;

  return el.tagName?.toLowerCase() || 'unknown';
}

function extractPatientId(metadata = {}) {
  return (
    metadata.patient_id ||
    metadata.patientId ||
    metadata.p_patient_id ||
    metadata.real_patient_id ||
    metadata.queue_patient_id ||
    null
  );
}

async function writeAudit(actionType, description, metadata = {}) {
  if (!isBrowser()) return false;
  if (window[AUDIT_EVENT_FLAG]) return false;

  const actor = getAuditSessionContext();
  const patientId = extractPatientId(metadata);

  try {
    window[AUDIT_EVENT_FLAG] = true;
    const payload = {
      action_type: actionType,
      description,
      metadata: {
        ...metadata,
        patient_id: patientId,
        actor_username: actor.username,
        actor_role: actor.role,
        source: metadata.source || actor.source || 'ui',
      },
      user_id: actor.userId || actor.username || null,
      ip_address: null,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from(AUDIT_TABLE).insert([payload]);
    if (error) {
      console.warn('[admin-audit] audit write failed:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[admin-audit] audit write exception:', error?.message || error);
    return false;
  } finally {
    window[AUDIT_EVENT_FLAG] = false;
  }
}

function patchSupabaseClient() {
  if (!isBrowser() || !supabase) return;
  if (originalFrom || originalRpc) return;

  originalFrom = supabase.from.bind(supabase);
  originalRpc = supabase.rpc.bind(supabase);

  supabase.from = ((tableName) => {
    const builder = originalFrom(tableName);

    if (MUTATION_TABLES.has(tableName)) {
      return builder;
    }

    const wrapMutation = (methodName, actionType) => {
      const original = builder?.[methodName];
      if (typeof original !== 'function') return;

      builder[methodName] = async (...args) => {
        const result = await original.apply(builder, args);

        if (isAuditShellActive()) {
          const errMsg = result?.error?.message || null;
          await writeAudit(
            actionType,
            `${methodName.toUpperCase()} on ${tableName}`,
            {
              table: tableName,
              method: methodName,
              error: errMsg,
            }
          );
        }

        return result;
      };
    };

    wrapMutation('insert', 'admin_data_insert');
    wrapMutation('update', 'admin_data_update');
    wrapMutation('upsert', 'admin_data_upsert');
    wrapMutation('delete', 'admin_data_delete');

    return builder;
  });

  supabase.rpc = async (fnName, params = {}) => {
    const result = await originalRpc(fnName, params);
    const patientId = extractPatientId(params);

    if (isAuditShellActive()) {
      await writeAudit(
        result?.error ? 'admin_rpc_error' : 'admin_rpc_call',
        `${result?.error ? 'RPC ERROR' : 'RPC'}: ${fnName}`,
        {
          function: fnName,
          params: params ? Object.keys(params) : [],
          patient_id: patientId,
          queue_id: params?.p_queue_id || params?.queue_id || null,
          error: result?.error?.message || null,
        }
      );
    }

    return result;
  };
}

function attachUiListeners() {
  if (!isBrowser()) return;

  const clickHandler = (event) => {
    const target = event.target?.closest?.('button, [role="button"], a');
    if (!target) return;
    if (!isAuditShellActive()) return;

    const label = getTextLabel(target);
    if (!label) return;

    queueMicrotask(() => {
      void writeAudit('admin_ui_click', `Clicked: ${label}`, {
        label,
        tagName: target.tagName,
        href: target.getAttribute?.('href') || null,
      });
    });
  };

  const changeHandler = (event) => {
    const target = event.target;
    if (!target || !isAuditShellActive()) return;

    const isSelect = target.matches?.('select');
    const isCheckbox = target.matches?.('input[type="checkbox"], input[type="radio"]');
    if (!isSelect && !isCheckbox) return;

    const label = getTextLabel(target);
    queueMicrotask(() => {
      void writeAudit('admin_ui_change', `Changed: ${label}`, {
        label,
        value: target.value ?? null,
        checked: typeof target.checked === 'boolean' ? target.checked : null,
        type: target.type || target.tagName?.toLowerCase() || 'unknown',
      });
    });
  };

  document.removeEventListener('click', clickHandler, true);
  document.removeEventListener('change', changeHandler, true);
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('change', changeHandler, true);
}

export function installAdminAuditSystem() {
  if (installed) return;
  installed = true;
  patchSupabaseClient();
  attachUiListeners();
}

export async function logAdminEvent(actionType, description, metadata = {}) {
  return writeAudit(actionType, description, metadata);
}
