/**
 * Notification Status Endpoint
 * GET /api/v1/notify/status?pin=XX&clinic=YY
 * Retrieves recent notifications for a patient
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const pin = url.searchParams.get('pin');
    const clinic = url.searchParams.get('clinic');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!pin || !clinic) {
      return jsonResponse({ error: 'Missing pin or clinic parameter' }, 400);
    }

    // List notifications for this patient
    const prefix = `notify:${clinic}:${pin}:`;
    const notifications = [];

    // Note: KV list() is limited, this is a simplified implementation
    // In production, consider using a different storage strategy for notifications
    
    try {
      const list = await env.KV_EVENTS.list({ prefix, limit });
      
      for (const key of list.keys) {
        const notification = await env.KV_EVENTS.get(key.name, { type: 'json' });
        if (notification) {
          notifications.push(notification);
        }
      }
    } catch (listError) {
      console.error('KV list error:', listError);
    }

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return jsonResponse({
      success: true,
      pin,
      clinic,
      notifications: notifications.slice(0, limit),
      count: notifications.length,
      timestamp: new Date().toISOString()
    }, 200);

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

