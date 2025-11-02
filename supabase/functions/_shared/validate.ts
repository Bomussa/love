/**
 * Shared validation utilities for Supabase Edge Functions
 * 
 * Provides common validation logic for request handling
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password requirements
 * At least 6 characters (basic validation)
 */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 6;
}

/**
 * Parse and validate JSON body from request
 */
export async function parseJsonBody<T = unknown>(req: Request): Promise<T | null> {
  try {
    const body = await req.json();
    return body as T;
  } catch (error) {
    console.error('Failed to parse JSON body:', error);
    return null;
  }
}

/**
 * Validate login credentials from request body
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

export function validateLoginCredentials(body: unknown): {
  valid: boolean;
  credentials?: LoginCredentials;
  error?: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== 'string' || !email) {
    return { valid: false, error: 'Email is required' };
  }

  if (!isValidEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (typeof password !== 'string' || !password) {
    return { valid: false, error: 'Password is required' };
  }

  if (!isValidPassword(password)) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }

  return {
    valid: true,
    credentials: { email, password },
  };
}

/**
 * Extract API key from Authorization header or apikey header
 */
export function extractApiKey(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check apikey header
  const apiKey = req.headers.get('apikey');
  if (apiKey) {
    return apiKey;
  }

  return null;
}
