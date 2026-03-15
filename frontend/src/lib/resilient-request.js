/**
 * Resilient Request Utility
 * يدعم: timeout + retry + exponential backoff + jitter + JSON parsing safeguards
 */

const DEFAULT_OPTIONS = {
  retries: 2,
  timeoutMs: 8000,
  retryDelayMs: 400,
  retryOnStatuses: [408, 425, 429, 500, 502, 503, 504],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetriableError(error) {
  const name = error?.name || '';
  return name === 'AbortError' || name === 'TypeError';
}

function calculateBackoffMs(baseDelay, attempt) {
  const exponential = baseDelay * (2 ** attempt);
  const jitter = Math.floor(Math.random() * Math.max(100, exponential * 0.2));
  return exponential + jitter;
}

export async function resilientRequest(url, options = {}, resilience = {}) {
  const cfg = { ...DEFAULT_OPTIONS, ...resilience };
  let lastError;

  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      const shouldRetry = cfg.retryOnStatuses.includes(response.status);
      if (shouldRetry && attempt < cfg.retries) {
        await sleep(calculateBackoffMs(cfg.retryDelayMs, attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < cfg.retries && isRetriableError(error)) {
        await sleep(calculateBackoffMs(cfg.retryDelayMs, attempt));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export async function requestJson(url, options = {}, resilience = {}) {
  const response = await resilientRequest(url, options, resilience);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}
