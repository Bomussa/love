// Lock Manager - Prevent race conditions and duplicates
// Uses KV_LOCKS for distributed locking

/**
 * Acquire a lock with timeout
 * @param {KVNamespace} kv - KV_LOCKS namespace
 * @param {string} key - Lock key
 * @param {number} ttl - Lock TTL in seconds (default: 5)
 * @param {number} maxRetries - Maximum retry attempts (default: 10)
 * @param {number} retryDelay - Delay between retries in ms (default: 100)
 * @returns {Promise<{acquired: boolean, lockId: string}>}
 */
export async function acquireLock(kv, key, ttl = 60, maxRetries = 10, retryDelay = 100) {
  const lockKey = `lock:${key}`;
  const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Try to get existing lock
      const existingLock = await kv.get(lockKey, 'json');
      
      if (!existingLock) {
        // No lock exists, try to acquire
        const lockData = {
          lockId: lockId,
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + ttl * 1000).toISOString()
        };
        
        await kv.put(lockKey, JSON.stringify(lockData), {
          expirationTtl: Math.max(60, ttl) // Cloudflare KV requires minimum 60 seconds
        });
        
        // Verify we got the lock (double-check)
        await new Promise(resolve => setTimeout(resolve, 50));
        const verifyLock = await kv.get(lockKey, 'json');
        
        if (verifyLock && verifyLock.lockId === lockId) {
          return { acquired: true, lockId: lockId };
        }
      }
      
      // Lock exists or verification failed, wait and retry
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
    } catch (error) {
      console.error(`Lock acquisition error (attempt ${attempt + 1}):`, error);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  return { acquired: false, lockId: null };
}

/**
 * Release a lock
 * @param {KVNamespace} kv - KV_LOCKS namespace
 * @param {string} key - Lock key
 * @param {string} lockId - Lock ID to verify ownership
 * @returns {Promise<boolean>}
 */
export async function releaseLock(kv, key, lockId) {
  const lockKey = `lock:${key}`;
  
  try {
    // Verify we own the lock before releasing
    const existingLock = await kv.get(lockKey, 'json');
    
    if (existingLock && existingLock.lockId === lockId) {
      await kv.delete(lockKey);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Lock release error:', error);
    return false;
  }
}

/**
 * Execute function with lock protection
 * @param {KVNamespace} kv - KV_LOCKS namespace
 * @param {string} key - Lock key
 * @param {Function} fn - Function to execute
 * @param {number} ttl - Lock TTL in seconds
 * @returns {Promise<any>}
 */
export async function withLock(kv, key, fn, ttl = 5) {
  const { acquired, lockId } = await acquireLock(kv, key, ttl);
  
  if (!acquired) {
    throw new Error(`Failed to acquire lock: ${key}`);
  }
  
  try {
    const result = await fn();
    return result;
  } finally {
    await releaseLock(kv, key, lockId);
  }
}

/**
 * Prevent duplicate operations within time window
 * @param {KVNamespace} kv - KV_LOCKS namespace
 * @param {string} operationKey - Unique operation identifier
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<boolean>} - true if allowed, false if duplicate
 */
export async function checkDuplicate(kv, operationKey, windowSeconds = 2) {
  const dupKey = `dup:${operationKey}`;
  
  try {
    const existing = await kv.get(dupKey);
    
    if (existing) {
      // Duplicate detected
      return false;
    }
    
    // Mark as processed
    await kv.put(dupKey, new Date().toISOString(), {
      expirationTtl: windowSeconds
    });
    
    return true;
  } catch (error) {
    console.error('Duplicate check error:', error);
    // On error, allow operation (fail open)
    return true;
  }
}

/**
 * Rate limit check
 * @param {KVNamespace} kv - KV_LOCKS namespace
 * @param {string} identifier - User/IP identifier
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
export async function checkRateLimit(kv, identifier, maxRequests = 10, windowSeconds = 60) {
  const rateLimitKey = `rate:${identifier}`;
  
  try {
    let rateData = await kv.get(rateLimitKey, 'json');
    
    if (!rateData) {
      // First request
      rateData = {
        count: 1,
        reset_at: new Date(Date.now() + windowSeconds * 1000).toISOString()
      };
      
      await kv.put(rateLimitKey, JSON.stringify(rateData), {
        expirationTtl: windowSeconds
      });
      
      return { allowed: true, remaining: maxRequests - 1 };
    }
    
    if (rateData.count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    
    // Increment count
    rateData.count += 1;
    
    await kv.put(rateLimitKey, JSON.stringify(rateData), {
      expirationTtl: windowSeconds
    });
    
    return { allowed: true, remaining: maxRequests - rateData.count };
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow operation (fail open)
    return { allowed: true, remaining: maxRequests };
  }
}

