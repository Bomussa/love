/**
 * Vercel Serverless Function: /api/signin
 * 
 * Purpose: Safety net proxy for signin requests to Supabase Edge Functions
 * Forwards POST/OPTIONS to UPSTREAM_API_BASE/login with strict CORS and timeouts
 * Note: signin is mapped to the same login endpoint as per requirements
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, handlePreflight, getUpstreamBase, createUpstreamHeaders } from './_lib/cors';

// Timeout for upstream requests (30 seconds)
const UPSTREAM_TIMEOUT_MS = 30000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const upstreamBase = getUpstreamBase();
  const upstreamUrl = `${upstreamBase}/login`;

  // Set CORS headers
  setCorsHeaders(req, res);

  // Handle OPTIONS preflight
  if (handlePreflight(req, res)) {
    return;
  }

  // Only allow POST for actual signin requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['POST', 'OPTIONS'] });
  }

  // Forward request to upstream with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamHeaders = createUpstreamHeaders(req);

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    // Forward response status and body
    const data = await response.text();
    res.status(response.status);

    // Forward relevant response headers
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    return res.send(data);
  } catch (error: unknown) {
    // Handle timeout or network errors
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({ 
        error: 'Gateway Timeout', 
        message: 'Upstream request timed out' 
      });
    }

    console.error('Signin proxy error:', error);
    return res.status(502).json({ 
      error: 'Bad Gateway', 
      message: 'Failed to reach upstream signin service' 
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
