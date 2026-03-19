/**
 * Resilient Request Utility
 * يدعم: timeout + retry + exponential backoff + jitter + JSON parsing safeguards
 *
 * ملاحظة صيانة:
 * بعض بيئات النشر قد تُرجع HTML (مثل صفحات الحماية/المصادقة) بدل JSON.
 * لذلك يجب ألا نُسقِط هذه الحالة إلى {} بصمت، بل نُرجع وصفًا منظمًا يمكن للطبقات
 * الأعلى التعامل معه بوضوح دون كسر الإنتاج أو إخفاء السبب الجذري.
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

function getContentType(response) {
  return String(response?.headers?.get?.('content-type') || '').toLowerCase();
}

function isJsonContentType(contentType) {
  return contentType.includes('application/json') || contentType.includes('+json');
}

function looksLikeHtml(text) {
  const normalized = String(text || '').trim().toLowerCase();
  return normalized.startsWith('<!doctype html')
    || normalized.startsWith('<html')
    || normalized.includes('<body')
    || normalized.includes('</html>');
}

function buildNonJsonPayload({ response, contentType, rawText }) {
  const snippet = String(rawText || '').slice(0, 300);
  const isHtml = looksLikeHtml(rawText);

  return {
    error: {
      code: isHtml ? 'NON_JSON_HTML_RESPONSE' : 'NON_JSON_RESPONSE',
      message: isHtml
        ? 'الخادم أعاد صفحة HTML بدل JSON متوقع'
        : 'الخادم أعاد استجابة غير JSON',
      status: response?.status || 0,
      contentType: contentType || '',
      snippet,
    },
  };
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
  const contentType = getContentType(response);

  if (isJsonContentType(contentType)) {
    const payload = await response.json().catch(() => ({}));
    return {
      response,
      payload,
      rawText: '',
      isJson: true,
      contentType,
    };
  }

  const rawText = await response.text().catch(() => '');
  const payload = buildNonJsonPayload({ response, contentType, rawText });

  return {
    response,
    payload,
    rawText,
    isJson: false,
    contentType,
  };
}
