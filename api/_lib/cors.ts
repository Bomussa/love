/**
 * CORS Utility for Vercel Serverless Functions
 * 
 * Provides consistent CORS handling across all API endpoints
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

/**
 * Set CORS headers on response if origin is allowed
 */
export function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin as string;
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

/**
 * Handle OPTIONS preflight requests
 * Returns true if the request was handled (is OPTIONS)
 */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Get upstream API base URL from environment
 */
export function getUpstreamBase(): string {
  return process.env.UPSTREAM_API_BASE || 'https://rujwuruuosffcazymit.supabase.co/functions/v1';
}

/**
 * Create request headers for upstream forwarding
 */
export function createUpstreamHeaders(req: VercelRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Forward important headers
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization as string;
  }
  if (req.headers.apikey) {
    headers['apikey'] = req.headers.apikey as string;
  }
  if (req.headers['x-client-info']) {
    headers['x-client-info'] = req.headers['x-client-info'] as string;
  }

  return headers;
}
