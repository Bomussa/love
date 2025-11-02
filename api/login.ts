/**
 * Vercel Serverless Function: /api/login
 * 
 * Purpose: Safety net proxy for login requests to Supabase Edge Functions
 * Forwards POST/OPTIONS to UPSTREAM_API_BASE/login with strict CORS and timeouts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Timeout for upstream requests (30 seconds)
const UPSTREAM_TIMEOUT_MS = 30000;

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  const upstreamBase = process.env.UPSTREAM_API_BASE || 'https://rujwuruuosffcazymit.supabase.co/functions/v1';
  const upstreamUrl = `${upstreamBase}/login`;

  // CORS: Set headers if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  // Only allow POST for actual login requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['POST', 'OPTIONS'] });
  }

  try {
    // Forward request to upstream with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

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

    clearTimeout(timeoutId);

    // Forward response status and body
    const data = await response.text();
    res.status(response.status);

    // Forward relevant response headers
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    return res.send(data);
  } catch (error: any) {
    // Handle timeout or network errors
    if (error.name === 'AbortError') {
      return res.status(504).json({ 
        error: 'Gateway Timeout', 
        message: 'Upstream request timed out' 
      });
    }

    console.error('Login proxy error:', error);
    return res.status(502).json({ 
      error: 'Bad Gateway', 
      message: 'Failed to reach upstream login service' 
    });
  }
}
