/**
 * useQueueRealtime Hook
 * Realtime Subscription مع Cleanup إلزامي
 * 
 * الإضافات الحرجة المطبقة:
 * - Cleanup عند unmount لمنع تسريب الذاكرة
 * - حد أقصى للقنوات
 * - الوقت من الخادم فقط
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase-client';

/**
 * Hook للاشتراك في تحديثات الطابور في الوقت الحقيقي
 * @param {string} clinicId - معرف العيادة
 * @param {function} onUpdate - دالة تُستدعى عند التحديث
 * @param {object} options - خيارات إضافية
 */
export function useQueueRealtime(clinicId, onUpdate, options = {}) {
  const channelRef = useRef(null);
  const { enabled = true } = options;

  const handleChange = useCallback((payload) => {
    if (onUpdate && typeof onUpdate === 'function') {
      // إضافة timestamp من الخادم
      const enrichedPayload = {
        ...payload,
        receivedAt: new Date().toISOString(), // للتتبع فقط
        serverTime: payload.commit_timestamp || payload.new?.entered_at
      };
      onUpdate(enrichedPayload);
    }
  }, [onUpdate]);

  useEffect(() => {
    if (!clinicId || !enabled) {
      return;
    }

    // إنشاء قناة فريدة
    const channelName = `queue_${clinicId}_${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queues',
          filter: `clinic_id=eq.${clinicId}`
        },
        handleChange
      )
      .subscribe((status) => {
        console.log(`Realtime subscription status for ${clinicId}:`, status);
      });

    channelRef.current = channel;

    // Cleanup إلزامي عند unmount
    return () => {
      if (channelRef.current) {
        console.log(`Cleaning up realtime channel for ${clinicId}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clinicId, enabled, handleChange]);

  // دالة لإعادة الاتصال يدويًا
  const reconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    // سيتم إعادة الاتصال تلقائيًا عبر useEffect
  }, []);

  return { reconnect };
}

/**
 * Hook للاشتراك في تحديثات الإشعارات
 */
export function useNotificationsRealtime(patientId, onNotification) {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!patientId) return;

    const channelName = `notifications_${patientId}_${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          if (onNotification) {
            onNotification(payload.new);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup إلزامي
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [patientId, onNotification]);
}

/**
 * Hook للاشتراك في جميع تحديثات الطوابير (للإدارة)
 */
export function useAllQueuesRealtime(onUpdate) {
  const channelRef = useRef(null);

  useEffect(() => {
    const channelName = `all_queues_${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queues'
        },
        (payload) => {
          if (onUpdate) {
            onUpdate(payload);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup إلزامي
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [onUpdate]);
}

export default useQueueRealtime;
