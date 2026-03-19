import api from './api-unified';
import { supabase } from './supabase-client';

function startOfTodayIso() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

export function applyAdminRuntimePatches(apiRef = api) {
  if (!apiRef || apiRef.__adminStatsQueuePatched) {
    return apiRef;
  }

  const originalGetActiveQueue = typeof apiRef.getActiveQueue === 'function'
    ? apiRef.getActiveQueue.bind(apiRef)
    : null;

  apiRef.getActiveQueue = async (clinicId = null) => {
    try {
      let query = supabase
        .from('queues')
        .select('*')
        .in('status', ['waiting', 'serving', 'called'])
        .gte('entered_at', startOfTodayIso())
        .order('entered_at', { ascending: true });

      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, queue: data || [] };
    } catch (error) {
      console.warn('[admin-runtime-patches] getActiveQueue fallback:', error?.message || error);
      return originalGetActiveQueue ? originalGetActiveQueue(clinicId) : { success: false, queue: [] };
    }
  };

  const originalGetStats = typeof apiRef.getStats === 'function'
    ? apiRef.getStats.bind(apiRef)
    : null;

  apiRef.getStats = async () => {
    try {
      const todayISO = startOfTodayIso();

      const { count: totalToday, error: totalError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .gte('entered_at', todayISO);

      const { count: waiting, error: waitingError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting')
        .gte('entered_at', todayISO);

      const { count: completed, error: completedError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', todayISO);

      const { count: serving, error: servingError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .in('status', ['serving', 'called'])
        .gte('entered_at', todayISO);

      if (totalError || waitingError || completedError || servingError) {
        throw totalError || waitingError || completedError || servingError;
      }

      return {
        success: true,
        totalToday: totalToday || 0,
        waiting: waiting || 0,
        completed: completed || 0,
        serving: serving || 0,
      };
    } catch (error) {
      console.warn('[admin-runtime-patches] getStats fallback:', error?.message || error);
      return originalGetStats ? originalGetStats() : {
        success: false,
        totalToday: 0,
        waiting: 0,
        completed: 0,
        serving: 0,
      };
    }
  };

  apiRef.__adminStatsQueuePatched = true;
  return apiRef;
}

applyAdminRuntimePatches();
