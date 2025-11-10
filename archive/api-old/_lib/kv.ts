/**
 * Storage Adapter for Vercel KV (Upstash Redis) with in-memory fallback
 * Provides a unified interface for key-value storage
 */

export interface StorageAdapter {
  getJSON<T = any>(key: string): Promise<T | null>;
  setJSON(key: string, value: any, options?: { expirationTtl?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/**
 * Vercel KV Adapter using Upstash Redis
 */
export class VercelKVAdapter implements StorageAdapter {
  private kv: any;

  constructor() {
    // Dynamically import @vercel/kv only when needed
    try {
      // Try to get KV from @vercel/kv
      const { kv } = require('@vercel/kv');
      this.kv = kv;
    } catch (e) {
      console.warn('[@vercel/kv not available, KV operations will fail]');
      this.kv = null;
    }
  }

  async getJSON<T = any>(key: string): Promise<T | null> {
    if (!this.kv) return null;
    try {
      const value = await this.kv.get(key);
      return value as T | null;
    } catch (error) {
      console.error(`KV getJSON error for key ${key}:`, error);
      return null;
    }
  }

  async setJSON(key: string, value: any, options?: { expirationTtl?: number }): Promise<void> {
    if (!this.kv) return;
    try {
      if (options?.expirationTtl) {
        await this.kv.set(key, value, { ex: options.expirationTtl });
      } else {
        await this.kv.set(key, value);
      }
    } catch (error) {
      console.error(`KV setJSON error for key ${key}:`, error);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.kv) return null;
    try {
      return await this.kv.get(key);
    } catch (error) {
      console.error(`KV get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    if (!this.kv) return;
    try {
      if (options?.expirationTtl) {
        await this.kv.set(key, value, { ex: options.expirationTtl });
      } else {
        await this.kv.set(key, value);
      }
    } catch (error) {
      console.error(`KV set error for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.kv) return;
    try {
      await this.kv.del(key);
    } catch (error) {
      console.error(`KV delete error for key ${key}:`, error);
    }
  }

  async list(prefix: string): Promise<string[]> {
    if (!this.kv) return [];
    try {
      // Upstash Redis uses SCAN for prefix matching
      const keys = await this.kv.keys(`${prefix}*`);
      return keys || [];
    } catch (error) {
      console.error(`KV list error for prefix ${prefix}:`, error);
      return [];
    }
  }
}

/**
 * In-Memory Adapter for local development
 */
export class MemoryAdapter implements StorageAdapter {
  private store: Map<string, { value: string; expiresAt?: number }> = new Map();
  private warningShown = false;

  private showWarning() {
    if (!this.warningShown) {
      console.warn('⚠️  Using in-memory storage adapter. Data will not persist. Configure Vercel KV for production.');
      this.warningShown = true;
    }
  }

  async getJSON<T = any>(key: string): Promise<T | null> {
    this.showWarning();
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  async setJSON(key: string, value: any, options?: { expirationTtl?: number }): Promise<void> {
    this.showWarning();
    const expiresAt = options?.expirationTtl ? Date.now() + (options.expirationTtl * 1000) : undefined;
    this.store.set(key, { value: JSON.stringify(value), expiresAt });
  }

  async get(key: string): Promise<string | null> {
    this.showWarning();
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.showWarning();
    const expiresAt = options?.expirationTtl ? Date.now() + (options.expirationTtl * 1000) : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.showWarning();
    this.store.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    this.showWarning();
    const keys: string[] = [];
    for (const [key] of this.store) {
      if (key.startsWith(prefix)) {
        const entry = this.store.get(key);
        if (!entry?.expiresAt || Date.now() <= entry.expiresAt) {
          keys.push(key);
        }
      }
    }
    return keys;
  }
}

/**
 * Create and return the appropriate storage adapter
 */
export function createStorageAdapter(): StorageAdapter {
  // Check if Vercel KV environment variables are set
  const hasKV = process.env.KV_URL || process.env.KV_REST_API_URL || 
                process.env.VERCEL_KV_REST_API_URL || process.env.REDIS_URL;
  
  if (hasKV) {
    try {
      return new VercelKVAdapter();
    } catch (error) {
      console.warn('Failed to initialize Vercel KV adapter, falling back to memory:', error);
      return new MemoryAdapter();
    }
  }
  
  return new MemoryAdapter();
}
