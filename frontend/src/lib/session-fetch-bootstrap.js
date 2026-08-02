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

if (originalFetch && !globalThis.__MMC_SESSION_FETCH_INSTALLED__) {
  globalThis.__MMC_SESSION_FETCH_INSTALLED__ = true;
  globalThis.fetch = async (input, init = {}) => {
    const requestType = classifyRequest(input);
    if (!requestType) return originalFetch(input, init);

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

    return originalFetch(input, {
      ...init,
      headers,
    });
  };
}
