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
 * Validate email format
 * Uses a more comprehensive regex that handles most valid email formats
 * while still being practical (not fully RFC 5322 compliant to avoid complexity)
 */
export function isValidEmail(email: string): boolean {
  // More robust email validation pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 max length
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
  } else if (data.password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters' });
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
