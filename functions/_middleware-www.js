/**
 * WWW Redirect Middleware
 * Enforces www.mmc-mms.com (redirects from mmc-mms.com)
 * 
 * Priority: High (runs before other middleware)
 */

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // Check if hostname is missing www
  if (url.hostname === 'mmc-mms.com') {
    // Redirect to www version
    url.hostname = 'www.mmc-mms.com';
    
    return new Response(null, {
      status: 301,
      headers: {
        'Location': url.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  }
  
  // Continue to next middleware/handler
  return await next();
}

