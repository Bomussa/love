/**
 * Shared validation utilities for Supabase Edge Functions
 * 
 * Provides input validation and sanitization
 */

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength (minimum requirements)
 */
export function isValidPassword(password: string): boolean {
  // At least 8 characters
  return password.length >= 8;
}

/**
 * Validates login request body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLoginRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Invalid request body'] };
  }

  const req = body as Record<string, unknown>;

  // Validate email
  if (!req.email || typeof req.email !== 'string') {
    errors.push('Email is required');
  } else if (!isValidEmail(req.email)) {
    errors.push('Invalid email format');
  }

  // Validate password
  if (!req.password || typeof req.password !== 'string') {
    errors.push('Password is required');
  } else if (!isValidPassword(req.password)) {
    errors.push('Password must be at least 8 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes string input (removes dangerous characters)
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}


}
