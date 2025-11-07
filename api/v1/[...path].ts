/**
 * Unified API Router for Vercel
 * Single serverless function that routes to all API handlers
 * This solves the Hobby plan limit of 12 functions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// CORS helper
function setCORS(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// JSON response helper
function sendJSON(res: VercelResponse, code: number, body: any) {
  setCORS(res);
  return res.status(code).json(body);
}

// Main router
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCORS(res);
    return res.status(200).end();
  }

  try {
    // Extract path from query
    const pathParts = ([] as string[]).concat((req.query.path ?? []) as string[]);
    const path = pathParts.join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');

    // Route to appropriate handler
    if (!path || path === 'health') {
      // Health check
      return sendJSON(res, 200, {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mode: 'vercel-router',
      });
    }

    // Parse path: /queue/status -> queue, status
    const parts = path.split('/');
    const module = parts[0]; // queue, pin, admin, etc.
    const action = parts[1] || 'index';

    // Dynamic import of handler
    let handler;
    try {
      // Try to import the handler module
      const handlerPath = `../../_api_handlers/v1/${module}/${action}`;
      handler = await import(handlerPath);
    } catch (e) {
      // Handler not found
      return sendJSON(res, 404, {
        success: false,
        error: 'Endpoint not found',
        path,
        module,
        action,
      });
    }

    // Execute handler
    if (handler && handler.default) {
      return await handler.default(req, res);
    } else {
      return sendJSON(res, 500, {
        success: false,
        error: 'Handler has no default export',
        path,
      });
    }
  } catch (error: any) {
    console.error('Router error:', error);
    return sendJSON(res, 500, {
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}
