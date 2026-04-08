/**
 * Environment Configuration Manager
 * Centralizes all environment variable management
 */

export function createEnv() {
  return {
    // Supabase Configuration
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    
    // API Configuration
    API_TIMEOUT: parseInt(process.env.API_TIMEOUT || '30000', 10),
    API_RETRY_ATTEMPTS: parseInt(process.env.API_RETRY_ATTEMPTS || '3', 10),
    API_RETRY_DELAY: parseInt(process.env.API_RETRY_DELAY || '1000', 10),
    
    // Cache Configuration
    CACHE_ENABLED: process.env.CACHE_ENABLED === 'true',
    CACHE_TTL: parseInt(process.env.CACHE_TTL || '300', 10),
    
    // Maintenance Mode
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
    
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'production',
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // Security
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    API_KEY: process.env.API_KEY,
    
    // Feature Flags
    FEATURE_SSE_ENABLED: process.env.FEATURE_SSE_ENABLED !== 'false',
    FEATURE_ADAPTIVE_POLLING: process.env.FEATURE_ADAPTIVE_POLLING !== 'false',
    FEATURE_CIRCUIT_BREAKER: process.env.FEATURE_CIRCUIT_BREAKER !== 'false',
  };
}

/**
 * Validate required environment variables
 */
export function validateEnv() {
  const env = createEnv();
  
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  
  const missing = required.filter(key => !env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Configuration error: Missing required environment variables (${missing.join(', ')}). ` +
      'Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before starting the API.'
    );
  }
  
  return env;
}
