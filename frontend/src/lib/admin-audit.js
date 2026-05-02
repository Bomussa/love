import { supabase } from './supabase-client';

const AUDIT_TABLE = 'activity_logs';
const MUTATION_TABLES = new Set(['activity_logs', 'daily_activity_logs', 'permanent_audit_logs']);
const AUDIT_EVENT_FLAG = '__MMC_ADMIN_AUDIT_LOCK__';
let installed = false;
let originalFrom = null;
let originalRpc = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isAdminShellActive() {
  if (!isBrowser()) return false;
  return !!document.querySelector('[data-view="admin"]');
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

async function writeAudit(actionType, description, metadata = {}) {
  if (!isBrowser()) return false;
  if (window[AUDIT_EVENT_FLAG]) return false;

  try {
    window[AUDIT_EVENT_FLAG] = true;
    const payload = {
      action_type: actionType,
      description,
      metadata: {
        ...metadata,
        source: 'admin-ui',
      },
      user_id: null,
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

        if (isAdminShellActive()) {
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

    if (isAdminShellActive()) {
      await writeAudit(
        result?.error ? 'admin_rpc_error' : 'admin_rpc_call',
        `${result?.error ? 'RPC ERROR' : 'RPC'}: ${fnName}`,
        {
          function: fnName,
          params: params ? Object.keys(params) : [],
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
    if (!target.closest?.('[data-view="admin"]')) return;

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
    if (!target || !target.closest?.('[data-view="admin"]')) return;

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
