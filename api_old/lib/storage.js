/**
 * Storage Layer - بديل لـ Cloudflare KV
 * يستخدم Vercel KV أو ذاكرة مؤقتة
 */

// ذاكرة مؤقتة في الذاكرة (للتطوير والاختبار)
const memoryStore = new Map();

class Storage {
  constructor(namespace) {
    this.namespace = namespace;
  }

  // Get value
  async get(key, options = {}) {
    const fullKey = `${this.namespace}:${key}`;
    
    // محاولة استخدام Vercel KV إذا كان متاحاً
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const response = await fetch(
          `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(fullKey)}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (options.type === 'json') {
            return JSON.parse(data.result);
          }
          return data.result;
        }
      } catch (error) {
        console.error('Vercel KV error:', error);
      }
    }
    
    // Fallback إلى الذاكرة المؤقتة
    const stored = memoryStore.get(fullKey);
    if (!stored) return null;
    
    // التحقق من انتهاء الصلاحية
    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      memoryStore.delete(fullKey);
      return null;
    }
    
    if (options.type === 'json') {
      return JSON.parse(stored.value);
    }
    
    return stored.value;
  }

  // Put value
  async put(key, value, options = {}) {
    const fullKey = `${this.namespace}:${key}`;
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // محاولة استخدام Vercel KV إذا كان متاحاً
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const url = new URL(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(fullKey)}`);
        if (options.expirationTtl) {
          url.searchParams.set('ex', options.expirationTtl.toString());
        }
        
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          },
          body: stringValue,
        });
        
        if (response.ok) {
          return;
        }
      } catch (error) {
        console.error('Vercel KV error:', error);
      }
    }
    
    // Fallback إلى الذاكرة المؤقتة
    const expiresAt = options.expirationTtl 
      ? Date.now() + (options.expirationTtl * 1000)
      : null;
    
    memoryStore.set(fullKey, {
      value: stringValue,
      expiresAt
    });
  }

  // Delete value
  async delete(key) {
    const fullKey = `${this.namespace}:${key}`;
    
    // محاولة استخدام Vercel KV إذا كان متاحاً
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        await fetch(
          `${process.env.KV_REST_API_URL}/del/${encodeURIComponent(fullKey)}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
            },
          }
        );
      } catch (error) {
        console.error('Vercel KV error:', error);
      }
    }
    
    // Fallback إلى الذاكرة المؤقتة
    memoryStore.delete(fullKey);
  }

  // List keys (محدود في الذاكرة المؤقتة)
  async list(options = {}) {
    const prefix = options.prefix ? `${this.namespace}:${options.prefix}` : `${this.namespace}:`;
    const keys = [];
    
    for (const [key] of memoryStore.entries()) {
      if (key.startsWith(prefix)) {
        keys.push(key.replace(`${this.namespace}:`, ''));
      }
    }
    
    return { keys: keys.map(name => ({ name })) };
  }
}

// إنشاء namespaces
export const KV_ADMIN = new Storage('admin');
export const KV_PINS = new Storage('pins');
export const KV_QUEUES = new Storage('queues');
export const KV_EVENTS = new Storage('events');
export const KV_LOCKS = new Storage('locks');
export const KV_CACHE = new Storage('cache');

// Helper functions
export function createEnv() {
  return {
    KV_ADMIN,
    KV_PINS,
    KV_QUEUES,
    KV_EVENTS,
    KV_LOCKS,
    KV_CACHE
  };
}

