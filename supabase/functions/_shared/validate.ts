/**
 * Validation utilities for Supabase Edge Functions
 * 
 * Provides input validation and sanitization
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * RFC 5322-inspired email validation regex
 * Pattern breakdown:
 * - Local part: alphanumeric + allowed special chars (!#$%&'*+/=?^_`{|}~-)
 * - @ symbol
 * - Domain: alphanumeric segments separated by dots, with hyphens allowed within segments
 * - Practical validation that handles most valid emails without full RFC 5322 complexity
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Maximum email length per RFC 5321
 */
const MAX_EMAIL_LENGTH = 254;

/**
 * Validate email format
 * Uses a comprehensive regex that handles most valid email formats
 * while still being practical (not fully RFC 5322 compliant to avoid complexity)
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

/**
 * Validate login request body
 */
export function validateLoginRequest(body: unknown): { 
  valid: boolean; 
  data?: LoginRequest; 
  errors?: ValidationError[] 
} {
  const errors: ValidationError[] = [];

  if (typeof body !== 'object' || body === null) {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object' }],
    };
  }

  const data = body as Record<string, unknown>;

  // Validate email
  if (!data.email || typeof data.email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required and must be a string' });
  } else if (!isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  // Validate password
  if (!data.password || typeof data.password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required and must be a string' });
  } else if (data.password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      email: data.email as string,
      password: data.password as string,
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
