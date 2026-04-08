/**
 * useDoctorSessions Hook
 * 
 * Purpose: Subscribe to real-time doctor session updates from Supabase
 * Source: doctor_sessions_view (aggregated from queues table)
 * 
 * ✅ No polling
 * ✅ Real-time updates via Supabase subscription
 * ✅ Single source of truth (Supabase queues)
 * ✅ No duplicate logic
 * ✅ No PIN references
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-client';

export default function useDoctorSessions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Real-time subscription to queues table changes
    const channel = supabase
      .channel('doctor-sessions-realtime')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'queues' 
        },
        (payload) => {
          console.log('Queue updated:', payload);
          fetchData(); // Refetch aggregated view
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Try to fetch from view first
      const { data: viewData, error: viewError } = await supabase
        .from('doctor_sessions_view')
        .select('*');

      if (viewError) {
        console.warn('View not available, falling back to direct query:', viewError);
        
        // Fallback: Direct aggregation from queues table
        const today = new Date().toISOString().split('T')[0];
        const { data: queues, error: queuesError } = await supabase
          .from('queues')
          .select('*, clinics(name_ar, name_en)')
          .eq('queue_date', today);

        if (queuesError) throw queuesError;

        // Manual aggregation
        const aggregated = aggregateQueueData(queues);
        setData(aggregated);
      } else {
        setData(viewData || []);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching doctor sessions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Fallback aggregation function
  function aggregateQueueData(queues) {
    const grouped = {};

    queues.forEach(q => {
      const clinicId = q.clinic_id;
      
      if (!grouped[clinicId]) {
        grouped[clinicId] = {
          clinic_id: clinicId,
          clinic_name: q.clinics?.name_ar || clinicId,
          clinic_name_en: q.clinics?.name_en || clinicId,
          waiting_count: 0,
          active_count: 0,
          completed_count: 0,
          missed_count: 0,
          calls_made: 0,
          starts_made: 0,
          advances_made: 0,
          session_start: null,
          session_end: null,
          session_status: 'idle',
          queue_date: q.queue_date
        };
      }

      const g = grouped[clinicId];

      // Count by status
      if (q.status === 'waiting') g.waiting_count++;
      if (['called', 'in_progress', 'serving'].includes(q.status)) g.active_count++;
      if (q.status === 'completed') g.completed_count++;
      if (q.status === 'no_show') g.missed_count++;

      // Count actions
      if (q.called_at) g.calls_made++;
      if (q.entered_clinic_at) g.starts_made++;
      if (q.completed_at) g.advances_made++;

      // Track session timing
      if (q.called_at && (!g.session_start || q.called_at < g.session_start)) {
        g.session_start = q.called_at;
      }
      if (q.completed_at && (!g.session_end || q.completed_at > g.session_end)) {
        g.session_end = q.completed_at;
      }
    });

    // Calculate duration and status
    Object.values(grouped).forEach(g => {
      if (g.session_start) {
        const start = new Date(g.session_start);
        const end = g.session_end ? new Date(g.session_end) : new Date();
        g.session_duration_minutes = Math.round((end - start) / 60000);
      } else {
        g.session_duration_minutes = 0;
      }

      if (g.active_count > 0) g.session_status = 'active';
      else if (g.waiting_count > 0) g.session_status = 'waiting';
      else g.session_status = 'idle';
    });

    return Object.values(grouped);
  }

  return { data, loading, error, refetch: fetchData };
}
