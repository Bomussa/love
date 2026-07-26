import { getStoredAppSessionToken } from './app-session';

const originalFetch = globalThis.fetch?.bind(globalThis);

function shouldAttachSession(input) {
  try {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input?.url,
      typeof window !== 'undefined' ? window.location.origin : 'https://mmc-mms.com',
    );

    const isApplicationApi = url.pathname.startsWith('/api/v1');
    const isSupabaseDataApi = url.hostname.endsWith('.supabase.co')
      && (url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/functions/v1'));

    return isApplicationApi || isSupabaseDataApi;
  } catch {
    return false;
  }
}

if (originalFetch && !globalThis.__MMC_SESSION_FETCH_INSTALLED__) {
  globalThis.__MMC_SESSION_FETCH_INSTALLED__ = true;
  globalThis.fetch = async (input, init = {}) => {
    if (!shouldAttachSession(input)) {
      return originalFetch(input, init);
    }

    const token = getStoredAppSessionToken();
    if (!token) return originalFetch(input, init);

    const requestHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(requestHeaders || init.headers || {});
    headers.set('X-Session-Token', token);

    return originalFetch(input, {
      ...init,
      headers,
    });
  };
}
