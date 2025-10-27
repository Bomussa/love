// Client-side Idempotency Key Generation
// Computes a stable key from method + normalized endpoint + stable-serialized body
// No API keys required - pure client-side utility

/**
 * Normalize endpoint path for consistent key generation
 * @param {string} endpoint - API endpoint path
 * @returns {string} Normalized path
 */
function normalizeEndpoint(endpoint) {
  const path = String(endpoint || '').trim();
  // Remove query params and fragments for consistency
  const cleanPath = path.split('?')[0].split('#')[0];
  // Remove leading/trailing slashes and normalize
  return cleanPath.replace(/^\/+|\/+$/g, '').toLowerCase();
}

/**
 * Stable JSON serialization for consistent hashing
 * Sorts object keys recursively for deterministic output
 * @param {any} obj - Object to serialize
 * @returns {string} Stable JSON string
 */
function stableStringify(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
  }
  // Sort object keys
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => `"${key}":${stableStringify(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Simple hash function (FNV-1a) for string input
 * @param {string} str - Input string
 * @returns {string} Hexadecimal hash
 */
function simpleHash(str) {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Generate idempotency key from request parameters
 * @param {string} method - HTTP method (POST, PUT, PATCH, DELETE)
 * @param {string} endpoint - API endpoint path
 * @param {string|object} body - Request body (string or object)
 * @returns {string} Idempotency key in format: method_hash
 */
export function generateIdempotencyKey(method, endpoint, body = null) {
  const normalizedMethod = String(method || 'POST').toUpperCase();
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  
  // Parse body if string
  let bodyObj = body;
  if (typeof body === 'string') {
    try {
      bodyObj = JSON.parse(body);
    } catch (e) {
      // If not JSON, use as-is
      bodyObj = body;
    }
  }
  
  // Create stable representation
  const bodyStr = stableStringify(bodyObj);
  const combined = `${normalizedMethod}:${normalizedEndpoint}:${bodyStr}`;
  
  // Generate hash
  const hash = simpleHash(combined);
  
  return `${normalizedMethod.toLowerCase()}_${hash}`;
}

/**
 * Manage sent keys registry with TTL in localStorage
 */
class SentKeysRegistry {
  constructor(storageKey = 'mms.sentKeys', ttlMs = 24 * 60 * 60 * 1000) {
    this.storageKey = storageKey;
    this.ttlMs = ttlMs; // Default 24 hours
  }

  /**
   * Check if a key was already sent successfully
   * @param {string} key - Idempotency key
   * @returns {boolean} True if already sent
   */
  isSent(key) {
    try {
      const data = this._load();
      const entry = data[key];
      if (!entry) return false;
      
      // Check TTL
      if (Date.now() > entry.expiresAt) {
        delete data[key];
        this._save(data);
        return false;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Mark a key as sent
   * @param {string} key - Idempotency key
   */
  markSent(key) {
    try {
      const data = this._load();
      data[key] = {
        sentAt: new Date().toISOString(),
        expiresAt: Date.now() + this.ttlMs
      };
      this._save(data);
      this._cleanup(data);
    } catch (e) {
      // Fail silently
    }
  }

  /**
   * Clear a specific key
   * @param {string} key - Idempotency key
   */
  clear(key) {
    try {
      const data = this._load();
      delete data[key];
      this._save(data);
    } catch (e) {
      // Fail silently
    }
  }

  /**
   * Clear all keys
   */
  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      // Fail silently
    }
  }

  /**
   * Get all sent keys (for debugging)
   * @returns {object} Map of keys to metadata
   */
  getAll() {
    try {
      const data = this._load();
      this._cleanup(data);
      return data;
    } catch (e) {
      return {};
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  _save(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      // Fail silently - localStorage might be full
    }
  }

  _cleanup(data) {
    // Remove expired entries
    const now = Date.now();
    let changed = false;
    for (const key in data) {
      if (data[key].expiresAt < now) {
        delete data[key];
        changed = true;
      }
    }
    if (changed) {
      this._save(data);
    }
  }
}

// Export singleton instance
export const sentKeysRegistry = new SentKeysRegistry();

// Export class for testing
export { SentKeysRegistry };
