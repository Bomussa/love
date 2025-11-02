/**
 * Shared CORS utility for Vercel Serverless Functions
 * 
 * Provides consistent CORS handling across all API endpoints
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed origins for CORS
export const ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

/**
 * Sets CORS headers on the response if the origin is allowed
 */
export function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin as string;
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

/**
 * Handles OPTIONS preflight requests
 * Returns true if the request was handled, false otherwise
 */
export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
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
 * Validates that the request method is allowed
 */
export function validateMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowedMethods: string[]
): boolean {
  if (!allowedMethods.includes(req.method || '')) {
    res.status(405).json({ 
      error: 'Method Not Allowed', 
      allowed: allowedMethods 
    });
    return false;
  }
  return true;
}
