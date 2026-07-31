import { getStoredAppSessionToken } from './app-session';

const originalFetch = globalThis.fetch?.bind(globalThis);

function getRequestUrl(input) {
  return new URL(
    typeof input === 'string' || input instanceof URL ? input : input?.url,
    typeof window !== 'undefined' ? window.location.origin : 'https://mmc-mms.com',
  );
}

function classifyRequest(input) {
  try {
    const url = getRequestUrl(input);

    if (url.pathname.startsWith('/api/v1')) return 'application-api';
    if (url.hostname.endsWith('.supabase.co')
      && (url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/functions/v1'))) {
      return 'supabase-data-api';
    }

    return null;
  } catch {
    return null;
  }
}

function rewriteLegacyPathwayReport(input) {
  try {
    const url = getRequestUrl(input);
    const selectedColumns = url.searchParams.get('select') || '';
    const isLegacyReport = url.hostname.endsWith('.supabase.co')
      && url.pathname.endsWith('/rest/v1/patient_routes')
      && /(^|,)\s*stations\s*(,|$)/i.test(selectedColumns)
      && /(^|,)\s*current_station_index\s*(,|$)/i.test(selectedColumns);

    if (!isLegacyReport) return { input, transform: false };

    url.pathname = url.pathname.replace(/\/patient_routes$/, '/pathways');
    url.searchParams.set('select', 'patient_id,pathway,current_step,completed,created_at');
    return { input: url.toString(), transform: true };
  } catch {
    return { input, transform: false };
  }
}

async function transformLegacyPathwayResponse(response) {
  if (!response.ok) return response;

  try {
    const rows = await response.clone().json();
    if (!Array.isArray(rows)) return response;

    const transformed = rows.map((row) => ({
      patient_id: row.patient_id,
      stations: Array.isArray(row.pathway) ? row.pathway : [],
      current_station_index: row.current_step ?? 0,
      status: row.completed ? 'completed' : 'active',
      created_at: row.created_at,
    }));

    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.delete('Content-Length');
    return new Response(JSON.stringify(transformed), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

if (originalFetch && !globalThis.__MMC_SESSION_FETCH_INSTALLED__) {
  globalThis.__MMC_SESSION_FETCH_INSTALLED__ = true;
  globalThis.fetch = async (input, init = {}) => {
    const rewritten = rewriteLegacyPathwayReport(input);
    const requestType = classifyRequest(rewritten.input);
    if (!requestType) return originalFetch(rewritten.input, init);

    const requestHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(requestHeaders || init.headers || {});
    const token = getStoredAppSessionToken();

    if (token) {
      if (requestType === 'application-api') {
        headers.set('X-Session-Token', token);
      } else {
        const clientInfo = headers.get('X-Client-Info') || 'mmc-mms-frontend';
        const normalizedClientInfo = clientInfo.replace(/;?\s*mmc-session=[^;\s]+/gi, '').trim();
        headers.set('X-Client-Info', `${normalizedClientInfo}; mmc-session=${token}`);
      }
    }

    const response = await originalFetch(rewritten.input, {
      ...init,
      headers,
    });

    return rewritten.transform ? transformLegacyPathwayResponse(response) : response;
  };
}
