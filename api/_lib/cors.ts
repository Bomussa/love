/**
 * Shared CORS utilities for Vercel Serverless Functions
 * 
 * Provides consistent CORS handling across all API endpoints
 * with strict origin validation and secure defaults.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed origins for CORS
export const ALLOWED_ORIGINS = [
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
 * Handle OPTIONS preflight request
 * Returns true if OPTIONS was handled (caller should return)
 */
export function handleOptions(
  req: VercelRequest, 
  res: VercelResponse,
  allowedMethods: string[] = ['GET', 'POST', 'OPTIONS']
): boolean {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Apply CORS headers and handle OPTIONS in one call
 * Returns true if request was handled (OPTIONS preflight)
 */
export function applyCors(
  req: VercelRequest,
  res: VercelResponse,
  allowedMethods?: string[]
): boolean {
  setCorsHeaders(req, res);
  return handleOptions(req, res, allowedMethods);
}
