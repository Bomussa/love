/**
 * Vercel Serverless Function: /api/signin
 * 
 * Purpose: Safety net proxy for signin requests (alias for login)
 * Forwards POST/OPTIONS to UPSTREAM_API_BASE/login with strict CORS and timeouts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_lib/cors';

// Timeout for upstream requests (30 seconds)
const UPSTREAM_TIMEOUT_MS = 30000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const upstreamBase = process.env.UPSTREAM_API_BASE || 'https://rujwuruuosffcazymit.supabase.co/functions/v1';
  const upstreamUrl = `${upstreamBase}/login`;

  // Apply CORS and handle OPTIONS
  if (applyCors(req, res, ['POST', 'OPTIONS'])) {
    return; // OPTIONS was handled
  }

  // Only allow POST for actual signin requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['POST', 'OPTIONS'] });
  }

  // Forward request to upstream with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward important headers
    if (req.headers.authorization) {
      upstreamHeaders['Authorization'] = req.headers.authorization as string;
    }
    if (req.headers.apikey) {
      upstreamHeaders['apikey'] = req.headers.apikey as string;
    }
    if (req.headers['x-client-info']) {
      upstreamHeaders['x-client-info'] = req.headers['x-client-info'] as string;
    }

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
