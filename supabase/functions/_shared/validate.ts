/**
 * Validation Utilities for Supabase Edge Functions
 * 
 * Common validation functions for request data
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
 * At least 6 characters
 */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 6;
}

/**
 * Validate login request body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export function validateLoginRequest(body: unknown): { valid: boolean; data?: LoginRequest; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }
  
  const data = body as Record<string, unknown>;
  
  if (!data.email || typeof data.email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  if (!isValidEmail(data.email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  if (!data.password || typeof data.password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  
  if (!isValidPassword(data.password)) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  
  return {
    valid: true,
    data: {
      email: data.email,
      password: data.password,
    },
  };
}

/**
 * Sanitize error message for client response
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}
