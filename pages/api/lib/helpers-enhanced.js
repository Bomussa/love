/**
 * Enhanced Helper Functions for Vercel API
 * Includes body parsing, CORS, validation, and rate limiting
 */

// Rate limiting store
const rateLimitStore = new Map();

/**
 * Parse request body for Vercel serverless functions
 */
export async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        if (!body) {
          resolve({});
          return;
        }
        
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    
    req.on('error', reject);
  });
}

/**
 * Set CORS headers with origin validation
 */
export function setCorsHeaders(res, req) {
  const allowedOrigins = [
    'https://love-snowy-three.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173'
  ];
  
  const origin = req?.headers?.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow same-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Get client IP
 */
export function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Rate limiting
 */
export function checkRateLimit(ip, limit = 100, windowMs = 60000) {
  const now = Date.now();
  const windowKey = Math.floor(now / windowMs);
  const key = `${ip}:${windowKey}`;
  
  const current = rateLimitStore.get(key) || 0;
  
  if (current >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: (windowKey + 1) * windowMs
    };
  }
  
  rateLimitStore.set(key, current + 1);
  
  // Cleanup old entries (keep only last 2 windows)
  if (rateLimitStore.size > 1000) {
    const cutoffWindow = windowKey - 2;
    for (const [k] of rateLimitStore.entries()) {
      const keyWindow = parseInt(k.split(':')[1]);
      if (keyWindow < cutoffWindow) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  return {
    allowed: true,
    remaining: limit - current - 1,
    resetAt: (windowKey + 1) * windowMs
  };
}

/**
 * Validate Personal ID (Qatari format: 11 digits)
 */
export function validatePersonalId(id) {
  if (!id) return false;
  const cleaned = String(id).trim();
  return /^\d{2,12}$/.test(cleaned);
}

/**
 * Validate Gender
 */
export function validateGender(gender) {
  if (!gender) return false;
  const normalized = String(gender).toLowerCase().trim();
  return ['male', 'female', 'ذكر', 'أنثى'].includes(normalized);
}

/**
 * Normalize Gender
 */
export function normalizeGender(gender) {
  const normalized = String(gender).toLowerCase().trim();
  if (normalized === 'male' || normalized === 'ذكر') return 'male';
  if (normalized === 'female' || normalized === 'أنثى') return 'female';
  return null;
}

/**
 * Validate Clinic ID
 */
export function validateClinicId(clinicId) {
  if (!clinicId) return false;
  const validClinics = [
    'lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes',
    'internal', 'ent', 'surgery', 'dental', 'psychiatry',
    'derma', 'bones'
  ];
  return validClinics.includes(String(clinicId).toLowerCase());
}

/**
 * Generate session ID
 */
export function generateSessionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${random}`;
}

/**
 * Generate PIN (2 digits as per original)
 */
export function generatePIN() {
  return String(Math.floor(Math.random() * 90) + 10).padStart(2, '0');
}

/**
 * Generate ticket number
 */
export function generateTicket(clinicId, sequence) {
  const prefix = String(clinicId).substring(0, 3).toUpperCase();
  const number = String(sequence).padStart(3, '0');
  return `${prefix}-${number}`;
}

/**
 * Format error response
 */
export function formatError(message, code = 'ERROR', details = null) {
  const error = {
    success: false,
    error: message,
    code
  };
  
  if (details && process.env.NODE_ENV === 'development') {
    error.details = details;
  }
  
  return error;
}

/**
 * Format success response
 */
export function formatSuccess(data, message = null) {
  const response = {
    success: true,
    ...data
  };
  
  if (message) {
    response.message = message;
  }
  
  return response;
}

/**
 * Log API request
 */
export function logRequest(req, additionalInfo = {}) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = getClientIP(req);
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`, additionalInfo);
}

/**
 * Handle API error
 */
export function handleError(error, res, statusCode = 500) {
  console.error('API Error:', error);
  
  const isDev = process.env.NODE_ENV === 'development';
  
  return res.status(statusCode).json({
    success: false,
    error: isDev ? error.message : 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    ...(isDev && error.stack ? { stack: error.stack } : {})
  });
}

