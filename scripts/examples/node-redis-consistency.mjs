/**
 * Redis Cache Consistency Examples (Add-only)
 * 
 * Demonstrates delete-on-update pattern for cache consistency.
 * Works with ioredis and Postgres (or any database).
 * 
 * Pattern: When updating data in DB, immediately delete corresponding cache keys
 * to prevent serving stale data. On next read, cache will be repopulated.
 * 
 * For Supabase Edge Functions:
 * - Use Upstash Redis (https://upstash.com) for edge-compatible Redis
 * - Or use Supabase's built-in Redis (if available in your plan)
 * - Import these patterns in your edge function handlers
 */

// ============================================================================
// Example 1: Basic delete-on-update with ioredis
// ============================================================================

/**
 * Example setup with ioredis (Node.js)
 * 
 * Install: npm install ioredis
 */
export class CacheConsistencyManager {
  constructor(redisClient, dbClient) {
    this.redis = redisClient;
    this.db = dbClient;
  }

  /**
   * Get user with caching
   */
  async getUser(userId) {
    const cacheKey = `user:${userId}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      console.log('[Cache] HIT', cacheKey);
      return JSON.parse(cached);
    }

    // Cache miss - fetch from DB
    console.log('[Cache] MISS', cacheKey);
    const user = await this.db.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (user) {
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(user));
    }

    return user;
  }

  /**
   * Update user with cache invalidation (delete-on-update)
   */
  async updateUser(userId, updates) {
    const cacheKey = `user:${userId}`;

    // 1. Update database
    const updated = await this.db.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *',
      [updates.name, updates.email, userId]
    );

    // 2. Immediately delete cache key to prevent stale reads
    await this.redis.del(cacheKey);
    console.log('[Cache] DELETED', cacheKey);

    // Optional: Also delete related keys (user lists, etc.)
    await this.redis.del(`users:list`, `users:count`);

    return updated;
  }

  /**
   * Delete user with cache cleanup
   */
  async deleteUser(userId) {
    const cacheKey = `user:${userId}`;

    // 1. Delete from database
    await this.db.query('DELETE FROM users WHERE id = $1', [userId]);

    // 2. Delete cache
    await this.redis.del(cacheKey);
    console.log('[Cache] DELETED', cacheKey);

    return true;
  }
}

// ============================================================================
// Example 2: Pattern invalidation (delete multiple related keys)
// ============================================================================

/**
 * Invalidate all keys matching a pattern
 * Useful for clearing related cached data
 */
export class PatternInvalidator {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  /**
   * Delete all keys matching pattern (e.g., "user:123:*")
   * Note: Use carefully in production, SCAN is more efficient than KEYS
   */
  async invalidatePattern(pattern) {
    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      console.log(`[Cache] DELETED ${keys.length} keys matching ${pattern}`);
    }
    return keys.length;
  }

  /**
   * Use SCAN to find keys (more efficient than KEYS command)
   */
  async scanKeys(pattern) {
    const keys = [];
    let cursor = '0';

    do {
      const [newCursor, foundKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = newCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Example: Update post and invalidate all related caches
   */
  async updatePost(postId, updates, userId) {
    // Update in DB
    const updated = await this.db.query(
      'UPDATE posts SET title = $1, content = $2 WHERE id = $3',
      [updates.title, updates.content, postId]
    );

    // Invalidate all related caches
    await Promise.all([
      this.redis.del(`post:${postId}`),
      this.invalidatePattern(`posts:user:${userId}:*`),
      this.invalidatePattern(`posts:list:*`),
      this.redis.del(`posts:count`)
    ]);

    return updated;
  }
}

// ============================================================================
// Example 3: Transactional consistency with Postgres + Redis
// ============================================================================

/**
 * Ensure cache invalidation happens atomically with DB update
 */
export class TransactionalCache {
  constructor(redisClient, dbClient) {
    this.redis = redisClient;
    this.db = dbClient;
  }

  /**
   * Update with transaction - if DB fails, cache is not invalidated
   */
  async updateWithTransaction(userId, updates) {
    const cacheKey = `user:${userId}`;
    
    // Start DB transaction
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update in transaction
      const result = await client.query(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
        [updates.name, userId]
      );

      // Commit DB transaction
      await client.query('COMMIT');

      // Only invalidate cache after successful commit
      await this.redis.del(cacheKey);
      console.log('[Cache] DELETED after commit', cacheKey);

      return result.rows[0];
    } catch (err) {
      // Rollback on error - cache stays intact
      await client.query('ROLLBACK');
      console.error('[Transaction] ROLLBACK', err);
      throw err;
    } finally {
      client.release();
    }
  }
}

// ============================================================================
// Example 4: Supabase Edge Function compatibility
// ============================================================================

/**
 * Example for Supabase Edge Functions with Upstash Redis
 * 
 * Edge Functions usage:
 * 
 * import { createClient } from '@supabase/supabase-js';
 * import { Redis } from '@upstash/redis';
 * 
 * const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
 * const redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
 * 
 * export async function handler(req) {
 *   const manager = new EdgeCacheManager(redis, supabase);
 *   const user = await manager.getUser(userId);
 *   return new Response(JSON.stringify(user));
 * }
 */
export class EdgeCacheManager {
  constructor(redisClient, supabaseClient) {
    this.redis = redisClient;
    this.supabase = supabaseClient;
  }

  /**
   * Get with caching
   */
  async getUser(userId) {
    const cacheKey = `user:${userId}`;

    try {
      // Try cache
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    } catch (err) {
      console.warn('[Cache] Redis error, falling back to DB', err);
    }

    // Fetch from Supabase
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Cache result
    try {
      await this.redis.setex(cacheKey, 300, JSON.stringify(data));
    } catch (err) {
      console.warn('[Cache] Failed to cache, continuing', err);
    }

    return data;
  }

  /**
   * Update with cache invalidation
   */
  async updateUser(userId, updates) {
    const cacheKey = `user:${userId}`;

    // Update in Supabase
    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Delete cache
    try {
      await this.redis.del(cacheKey);
      console.log('[Cache] DELETED', cacheKey);
    } catch (err) {
      console.warn('[Cache] Failed to invalidate, continuing', err);
    }

    return data;
  }
}

// ============================================================================
// Example 5: Time-based invalidation with versioning
// ============================================================================

/**
 * Alternative pattern: version-based cache keys
 * Increment version on update instead of deleting
 */
export class VersionedCache {
  constructor(redisClient, dbClient) {
    this.redis = redisClient;
    this.db = dbClient;
  }

  /**
   * Get current version for entity
   */
  async getVersion(entityType, entityId) {
    const versionKey = `version:${entityType}:${entityId}`;
    const version = await this.redis.get(versionKey);
    return version ? parseInt(version, 10) : 1;
  }

  /**
   * Increment version on update
   */
  async incrementVersion(entityType, entityId) {
    const versionKey = `version:${entityType}:${entityId}`;
    return await this.redis.incr(versionKey);
  }

  /**
   * Get with versioned cache key
   */
  async getUser(userId) {
    const version = await this.getVersion('user', userId);
    const cacheKey = `user:${userId}:v${version}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await this.db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (user) {
      await this.redis.setex(cacheKey, 300, JSON.stringify(user));
    }

    return user;
  }

  /**
   * Update and increment version (old cached data becomes stale automatically)
   */
  async updateUser(userId, updates) {
    const updated = await this.db.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
      [updates.name, userId]
    );

    // Increment version - old cache keys are now stale
    await this.incrementVersion('user', userId);
    console.log('[Cache] Version incremented for user', userId);

    return updated;
  }
}

// ============================================================================
// Example 6: Practical integration example
// ============================================================================

/**
 * Complete example with error handling and fallbacks
 */
export async function practicalExample() {
  // Setup (pseudo-code)
  const Redis = { get: async () => null, setex: async () => {}, del: async () => {} };
  const DB = { query: async () => ({ id: 1, name: 'Test' }) };

  const redis = Redis;
  const db = DB;

  // Create manager
  const cache = new CacheConsistencyManager(redis, db);

  // Read operation (cached)
  const user = await cache.getUser(123);
  console.log('User:', user);

  // Write operation (invalidates cache)
  await cache.updateUser(123, { name: 'John Doe', email: 'john@example.com' });

  // Next read will miss cache and fetch fresh data
  const updatedUser = await cache.getUser(123);
  console.log('Updated user:', updatedUser);
}

// ============================================================================
// Documentation: Key Principles
// ============================================================================

/**
 * CACHE CONSISTENCY PATTERNS - BEST PRACTICES
 * 
 * 1. DELETE-ON-UPDATE (Recommended for most cases)
 *    - Pro: Simple, always consistent
 *    - Con: Cache miss on next read (requires DB query)
 *    - Use when: Read/write ratio is high, data is not critical latency
 * 
 * 2. WRITE-THROUGH
 *    - Update both cache and DB
 *    - Pro: No cache miss after update
 *    - Con: Risk of inconsistency if cache update fails
 *    - Use when: Low latency is critical, write failures are rare
 * 
 * 3. VERSION-BASED
 *    - Increment version on update, cache keys include version
 *    - Pro: No need to delete old cache entries (they expire naturally)
 *    - Con: More complex, requires version tracking
 *    - Use when: Multiple concurrent updates are common
 * 
 * 4. TTL-ONLY (Not recommended for critical data)
 *    - Rely only on cache expiration
 *    - Pro: Simplest implementation
 *    - Con: May serve stale data until TTL expires
 *    - Use when: Eventual consistency is acceptable
 * 
 * EDGE FUNCTION NOTES:
 * - Use Upstash Redis for edge compatibility
 * - Always wrap Redis calls in try-catch (graceful degradation)
 * - Consider circuit breaker for Redis connection failures
 * - Set reasonable TTLs (300s = 5min is a good default)
 * - Monitor cache hit rates and adjust TTL accordingly
 * 
 * POSTGRES + REDIS TRANSACTION SAFETY:
 * - Always update DB first, then invalidate cache
 * - Use DB transactions for atomicity
 * - Only invalidate cache after successful DB commit
 * - If cache invalidation fails, log but don't fail the request
 * - Set up monitoring for cache invalidation failures
 */

// Export for testing
export default {
  CacheConsistencyManager,
  PatternInvalidator,
  TransactionalCache,
  EdgeCacheManager,
  VersionedCache,
  practicalExample
};
