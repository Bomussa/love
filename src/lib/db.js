/**
 * Database Abstraction Layer for Cloudflare KV
 * This file provides a PostgreSQL-like interface for Cloudflare KV storage
 * Used by legacy API endpoints in src/pages/api/
 */

// In Cloudflare Pages Functions, env is passed via context
// This module exports functions that will be bound to the actual KV namespaces at runtime

class KVDatabaseAdapter {
  constructor() {
    this.env = null;
  }

  /**
   * Initialize with Cloudflare environment bindings
   * This should be called from the Pages Function context
   */
  init(env) {
    this.env = env;
  }

  /**
   * Simulate PostgreSQL query interface
   * Returns a promise that resolves to { rows: [] }
   */
  async query(sql, params = []) {
    if (!this.env) {

      return { rows: [] };
    }

    // This is a stub - actual queries should use KV directly
    // Legacy code using this should be migrated to use KV namespaces
    return { rows: [] };
  }

  /**
   * Get a client for transaction-like operations
   */
  async getClient() {
    const self = this;
    return {
      query: async (sql, params) => {
        return await self.query(sql, params);
      },
      release: () => {
        // No-op for KV
      },
    };
  }
}

// Export singleton instance
const db = new KVDatabaseAdapter();

export default db;

/**
 * Helper function to initialize db with environment
 * Should be called from Pages Functions middleware
 */
export function initDB(env) {
  db.init(env);
  return db;
}

