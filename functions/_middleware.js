/**
 * Global Middleware for Cloudflare Pages Functions
 * Handles WWW redirect, rate limiting, and CORS
 */

// Rate limiting state (in-memory for this worker instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // 1. WWW Redirect (301 Permanent)
  if (!url.hostname.startsWith('www.') && url.hostname === 'mmc-mms.com') {
    const wwwUrl = new URL(request.url);
    wwwUrl.hostname = 'www.' + wwwUrl.hostname;
    
    return new Response(null, {
      status: 301,
      headers: {
        'Location': wwwUrl.toString(),
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  }

  // 2. Rate Limiting (only for API and admin routes)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `${clientIP}:${Math.floor(Date.now() / RATE_LIMIT_WINDOW)}`;
    
    const currentCount = rateLimitMap.get(rateLimitKey) || 0;
    
    if (currentCount >= RATE_LIMIT_MAX_REQUESTS) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'تم تجاوز الحد المسموح من الطلبات',
        retry_after: RATE_LIMIT_WINDOW / 1000,
        timestamp: new Date().toISOString()
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(RATE_LIMIT_WINDOW / 1000),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + (RATE_LIMIT_WINDOW / 1000))
        }
      });
    }
    
    rateLimitMap.set(rateLimitKey, currentCount + 1);
    
    // Clean up old entries
    if (rateLimitMap.size > 10000) {
      const now = Math.floor(Date.now() / RATE_LIMIT_WINDOW);
      for (const [key] of rateLimitMap) {
        const keyTime = parseInt(key.split(':')[1]);
        if (keyTime < now - 2) {
          rateLimitMap.delete(key);
        }
      }
    }
  }

  // 3. CORS Headers for API and admin routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
  }

  // Continue to the next handler
  const response = await next();
  
  const newHeaders = new Headers(response.headers);
  
  // 4. Cache-Control headers
  // Static files (JS, CSS, images, fonts)
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2|ttf|ico)$/)) {
    newHeaders.set('Cache-Control', 'public, max-age=600, s-maxage=1800');
  }
  // API responses - no cache
  else if (url.pathname.startsWith('/api/v1/')) {
    newHeaders.set('Cache-Control', 'no-store');
  }
  
  // 5. Add CORS headers to response if API or admin route
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

