/**
 * Real-time Service using Supabase Realtime
 * Provides live updates for queues and notifications
 */

import { supabase } from './supabase-client';

// ============================================
// QUEUE REAL-TIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to queue updates for a specific clinic
 * @param {string} clinicId - Clinic ID to subscribe to
 * @param {Function} callback - Callback function to handle updates
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToQueue(clinicId, callback) {
  console.log(`📡 Subscribing to queue updates for clinic: ${clinicId}`);

  const subscription = supabase
    .channel(`queue:${clinicId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'queues',
        filter: `clinic_id=eq.${clinicId}`
      },
      (payload) => {
        console.log(`🔔 Queue update for ${clinicId}:`, payload);
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log(`📡 Queue subscription status for ${clinicId}:`, status);
    });

  return {
    unsubscribe: () => {
      console.log(`📴 Unsubscribing from queue: ${clinicId}`);
      subscription.unsubscribe();
    }
  };
}

/**
 * Subscribe to all queue updates (for admin dashboard)
 * @param {Function} callback - Callback function to handle updates
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToAllQueues(callback) {
  console.log('📡 Subscribing to all queue updates');

  const subscription = supabase
    .channel('queues:all')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queues'
      },
      (payload) => {
        console.log('🔔 Global queue update:', payload);
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Global queue subscription status:', status);
    });

  return {
    unsubscribe: () => {
      console.log('📴 Unsubscribing from all queues');
      subscription.unsubscribe();
    }
  };
}

// ============================================
// NOTIFICATION REAL-TIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to notifications for a specific patient
 * @param {string} patientId - Patient ID to subscribe to
 * @param {Function} callback - Callback function to handle new notifications
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToNotifications(patientId, callback) {
  console.log(`📡 Subscribing to notifications for patient: ${patientId}`);

  const subscription = supabase
    .channel(`notifications:${patientId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `patient_id=eq.${patientId}`
      },
      (payload) => {
        console.log(`🔔 New notification for ${patientId}:`, payload);
        callback(payload.new);
      }
    )
    .subscribe((status) => {
      console.log(`📡 Notification subscription status for ${patientId}:`, status);
    });

  return {
    unsubscribe: () => {
      console.log(`📴 Unsubscribing from notifications: ${patientId}`);
      subscription.unsubscribe();
    }
  };
}

// ============================================
// PATIENT POSITION TRACKING
// ============================================

/**
 * Track patient's position in queue with real-time updates
 * @param {string} clinicId - Clinic ID
 * @param {string} patientId - Patient ID
 * @param {Function} callback - Callback with position updates
 * @returns {Object} Subscription object with unsubscribe method
 */
export function trackPatientPosition(clinicId, patientId, callback) {
  console.log(`📡 Tracking position for patient ${patientId} in clinic ${clinicId}`);

  let currentPosition = null;

  const updatePosition = async () => {
    try {
      // Get patient's display number
      const { data: patientQueue, error: patientError } = await supabase
        .from('queues')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('status', 'waiting')
        .single();

      if (patientError) throw patientError;

      // Count how many are ahead
      const { count, error: countError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .lt('display_number', patientQueue.display_number);

      if (countError) throw countError;

      const position = {
        displayNumber: patientQueue.display_number,
        ahead: count || 0,
        timestamp: new Date().toISOString()
      };

      // Only call callback if position changed
      if (JSON.stringify(position) !== JSON.stringify(currentPosition)) {
        currentPosition = position;
        callback(position);
      }
    } catch (error) {
      console.error('Error tracking position:', error);
    }
  };

  // Initial position check
  updatePosition();

  // Subscribe to queue changes
  const subscription = subscribeToQueue(clinicId, () => {
    updatePosition();
  });

  return {
    unsubscribe: () => {
      subscription.unsubscribe();
    }
  };
}

// ============================================
// ADMIN DASHBOARD REAL-TIME
// ============================================

/**
 * Subscribe to admin dashboard updates (all queues + notifications)
 * @param {Function} callback - Callback function to handle updates
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToAdminDashboard(callback) {
  console.log('📡 Subscribing to admin dashboard updates');

  const queueSubscription = subscribeToAllQueues((payload) => {
    callback({ type: 'queue', data: payload });
  });

  const notificationSubscription = supabase
    .channel('notifications:all')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      },
      (payload) => {
        console.log('🔔 New notification (admin view):', payload);
        callback({ type: 'notification', data: payload.new });
      }
    )
    .subscribe((status) => {
      console.log('📡 Admin notification subscription status:', status);
    });

  return {
    unsubscribe: () => {
      console.log('📴 Unsubscribing from admin dashboard');
      queueSubscription.unsubscribe();
      notificationSubscription.unsubscribe();
    }
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Test real-time connection
 * @returns {Promise<boolean>} Connection status
 */
export async function testRealtimeConnection() {
  try {
    console.log('🧪 Testing real-time connection...');

    const testChannel = supabase.channel('test-connection');

    return new Promise((resolve) => {
      testChannel
        .on('presence', { event: 'sync' }, () => {
          console.log('✅ Real-time connection successful');
          testChannel.unsubscribe();
          resolve(true);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time connection successful');
            testChannel.unsubscribe();
            resolve(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('❌ Real-time connection failed');
            testChannel.unsubscribe();
            resolve(false);
          }
        });

      // Timeout after 5 seconds
      setTimeout(() => {
        testChannel.unsubscribe();
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    console.error('❌ Real-time connection test failed:', error);
    return false;
  }
}

/**
 * Get all active subscriptions count
 * @returns {number} Number of active subscriptions
 */
export function getActiveSubscriptionsCount() {
  const channels = supabase.getChannels();
  return channels.length;
}

/**
 * Unsubscribe from all channels
 */
export async function unsubscribeAll() {
  console.log('📴 Unsubscribing from all channels');
  await supabase.removeAllChannels();
  console.log('✅ All channels unsubscribed');
}

// Export all functions
export default {
  subscribeToQueue,
  subscribeToAllQueues,
  subscribeToNotifications,
  trackPatientPosition,
  subscribeToAdminDashboard,
  testRealtimeConnection,
  getActiveSubscriptionsCount,
  unsubscribeAll
};
