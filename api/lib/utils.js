/**
 * Shared Utilities for Cloudflare Pages Functions
 * Centralized helper functions to avoid code duplication
 */

/**
 * Create a standardized JSON response
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response} JSON response with CORS headers
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

/**
 * Create CORS preflight response
 * @param {string[]} methods - Allowed HTTP methods
 * @returns {Response} CORS preflight response
 */
export function corsResponse(methods = ['GET', 'POST', 'OPTIONS']) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': methods.join(', '),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Object|null} Error response or null if valid
 */
export function validateRequiredFields(body, requiredFields) {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      missing_fields: missing
    };
  }
  
  return null;
}

/**
 * Check if KV namespace is available
 * @param {Object} kv - KV namespace binding
 * @param {string} name - Name of the KV namespace (for error message)
 * @returns {Object|null} Error response or null if available
 */
export function checkKVAvailability(kv, name = 'KV') {
  if (!kv) {
    return {
      success: false,
      error: `${name} not available`,
      message: 'Storage service unavailable'
    };
  }
  
  return null;
}

/**
 * Create error response with consistent format
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {Object} extra - Additional error details
 * @returns {Object} Error response object
 */
export function errorResponse(message, status = 500, extra = {}) {
  return {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    ...extra
  };
}

/**
 * Create success response with consistent format
 * @param {Object} data - Response data
 * @param {string} message - Optional success message
 * @returns {Object} Success response object
 */
export function successResponse(data, message = null) {
  const response = {
    success: true,
    ...data
  };
  
  if (message) {
    response.message = message;
  }
  
  return response;
}

