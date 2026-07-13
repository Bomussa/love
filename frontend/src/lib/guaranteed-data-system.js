/**
 * Guaranteed Data System (GDS)
 * Supabase-only data access layer.
 *
 * No offline cache, no local fallback, no synthetic data.
 * All failures return explicit errors so UI can fail closed.
 */

import { supabase } from './supabase-client';

const DEFAULT_FEATURES_CONFIG = Object.freeze({
  queues: {
    id: 'queues',
    name: 'نظام الطوابير',
    nameEn: 'Queue System',
    enabled: true,
    visible: true,
    realtime: true,
    priority: 1,
  },
  clinics: {
    id: 'clinics',
    name: 'العيادات',
    nameEn: 'Clinics',
    enabled: true,
    visible: true,
    realtime: true,
    priority: 2,
  },
  notifications: {
    id: 'notifications',
    name: 'الإشعارات',
    nameEn: 'Notifications',
    enabled: true,
    visible: true,
    realtime: true,
    priority: 3,
  },
  routes: {
    id: 'routes',
    name: 'المسارات',
    nameEn: 'Routes',
    enabled: true,
    visible: true,
    realtime: true,
    priority: 5,
  },
  statistics: {
    id: 'statistics',
    name: 'الإحصائيات',
    nameEn: 'Statistics',
    enabled: true,
    visible: true,
    realtime: false,
    priority: 6,
  },
  reports: {
    id: 'reports',
    name: 'التقارير',
    nameEn: 'Reports',
    enabled: true,
    visible: true,
    realtime: false,
    priority: 7,
  },
});

class GuaranteedDataSystem {
  constructor() {
    this.client = supabase;
    this.features = { ...DEFAULT_FEATURES_CONFIG };
    this.subscriptions = new Map();
    this.isInitialized = false;
    this.connectionState = 'disconnected';
    this.lastSync = null;
  }

  async initialize() {
    if (this.isInitialized) return true;

    try {
      const { error } = await this.client.from('clinics').select('id').limit(1);
      if (error) throw error;

      this.connectionState = 'connected';
      this.isInitialized = true;
      this.lastSync = new Date();
      return true;
    } catch (error) {
      this.connectionState = 'error';
      console.error('❌ GDS initialization failed:', error);
      return false;
    }
  }

  getFeatureState(featureId) {
    return this.features[featureId] || null;
  }

  getAllFeatures() {
    return { ...this.features };
  }

  isFeatureAvailable(featureId) {
    const feature = this.features[featureId];
    return !!(feature && feature.enabled && feature.visible);
  }

  getFeatureIdFromTable(tableName) {
    const mapping = {
      queues: 'queues',
      clinics: 'clinics',
      notifications: 'notifications',
      patient_routes: 'routes',
    };
    return mapping[tableName] || null;
  }

  async fetchGuaranteed(tableName, options = {}) {
    const featureId = this.getFeatureIdFromTable(tableName);
    if (featureId && !this.features[featureId]?.enabled) {
      return { data: [], error: null, skipped: true, guaranteed: false };
    }

    try {
      let query = this.client.from(tableName).select(options.select || '*');

      if (options.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value !== null && value !== undefined) {
            query = query.eq(key, value);
          }
        }
      }

      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;

      this.lastSync = new Date();
      return {
        data: data || [],
        error: null,
        guaranteed: true,
        source: 'supabase',
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        data: [],
        error: error.message,
        guaranteed: false,
        source: 'error',
      };
    }
  }

  async saveGuaranteed(tableName, data, options = {}) {
    const featureId = this.getFeatureIdFromTable(tableName);
    if (featureId && !this.features[featureId]?.enabled) {
      return { success: false, error: 'الميزة موقفة', skipped: true };
    }

    try {
      let result;
      if (options.upsert) {
        result = await this.client.from(tableName).upsert(data).select();
      } else if (options.update && options.match) {
        result = await this.client.from(tableName).update(data).match(options.match).select();
      } else {
        result = await this.client.from(tableName).insert(data).select();
      }

      if (result.error) throw result.error;
      this.lastSync = new Date();

      return {
        success: true,
        data: result.data || [],
        error: null,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteGuaranteed(tableName, match) {
    try {
      const { error } = await this.client.from(tableName).delete().match(match);
      if (error) throw error;
      this.lastSync = new Date();
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  subscribeRealtime(tableName, callback, options = {}) {
    const featureId = this.getFeatureIdFromTable(tableName);
    if (featureId && !this.features[featureId]?.realtime) {
      return () => {};
    }

    this.unsubscribe(tableName);

    const channel = this.client
      .channel(`gds_${tableName}_${Date.now()}`)
      .on('postgres_changes', {
        event: options.event || '*',
        schema: 'public',
        table: tableName,
        ...(options.filter ? { filter: options.filter } : {}),
      }, (payload) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`❌ [${tableName}] realtime callback error:`, error);
        }
      })
      .subscribe();

    this.subscriptions.set(tableName, channel);
    return () => this.unsubscribe(tableName);
  }

  unsubscribe(tableName) {
    const channel = this.subscriptions.get(tableName);
    if (channel) {
      this.client.removeChannel(channel);
      this.subscriptions.delete(tableName);
    }
  }

  unsubscribeAll() {
    for (const tableName of [...this.subscriptions.keys()]) {
      this.unsubscribe(tableName);
    }
  }

  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      connectionState: this.connectionState,
      lastSync: this.lastSync,
      activeSubscriptions: this.subscriptions.size,
      features: this.features,
      mode: 'supabase-only',
    };
  }

  clearCache() {
    return true;
  }
}

export const GDS = new GuaranteedDataSystem();

export async function initGDS() {
  return GDS.initialize();
}

export async function getQueues(filters = {}) {
  return GDS.fetchGuaranteed('queues', {
    filters,
    orderBy: { column: 'entered_at', ascending: false },
  });
}

export async function getClinics(filters = {}) {
  return GDS.fetchGuaranteed('clinics', {
    filters,
    orderBy: { column: 'order_index', ascending: true },
  });
}

export async function getNotifications(patientId = null) {
  return GDS.fetchGuaranteed('notifications', {
    filters: patientId ? { patient_id: patientId } : {},
    orderBy: { column: 'created_at', ascending: false },
  });
}

export async function getRoutes(patientId = null) {
  return GDS.fetchGuaranteed('patient_routes', {
    filters: patientId ? { patient_id: patientId } : {},
    orderBy: { column: 'created_at', ascending: false },
  });
}

export async function saveQueue(data) {
  return GDS.saveGuaranteed('queues', data);
}

export async function updateQueue(id, data) {
  return GDS.saveGuaranteed('queues', data, { update: true, match: { id } });
}

export async function deleteQueue(id) {
  return GDS.deleteGuaranteed('queues', { id });
}

export function subscribeQueues(callback) {
  return GDS.subscribeRealtime('queues', callback);
}

export function subscribeClinics(callback) {
  return GDS.subscribeRealtime('clinics', callback);
}

export function subscribeNotifications(callback, patientId = null) {
  return GDS.subscribeRealtime('notifications', callback, {
    filter: patientId ? `patient_id=eq.${patientId}` : undefined,
  });
}

export function toggleFeature(featureId, enabled) {
  if (!GDS.features[featureId]) return false;
  GDS.features[featureId] = { ...GDS.features[featureId], enabled };
  return true;
}

export function toggleFeatureVisibility(featureId, visible) {
  if (!GDS.features[featureId]) return false;
  GDS.features[featureId] = { ...GDS.features[featureId], visible };
  return true;
}

export function getFeaturesStatus() {
  return GDS.getAllFeatures();
}

export function getGDSStatus() {
  return GDS.getSystemStatus();
}

export default GDS;
