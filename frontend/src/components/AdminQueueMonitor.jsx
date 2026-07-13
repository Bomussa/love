import React, { useState, useEffect, useCallback } from 'react';
import { GENERAL_REFRESH_INTERVAL } from '../core/config/refresh.constants';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase-client';

const normalizeStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'completed' || value === 'done') return 'completed';
  if (value === 'called' || value === 'serving' || value === 'in_progress' || value === 'in_service') return 'called';
  if (value === 'waiting') return 'waiting';
  return 'waiting';
};

const todayKey = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

const formatPatientIdentity = (record = {}) => {
  const idLabel = record.military_id || record.personal_id || record.patient_id || '—';
  const genderLabel = record.gender || '';
  return { idLabel, genderLabel };
};

export function AdminQueueMonitor({ clinicId, autoRefresh = true }) {
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchQueueStatus = useCallback(async () => {
    if (!clinicId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('unified_queue')
        .select('id,display_number,patient_id,personal_id,military_id,gender,status,entered_at,called_at,completed_at,exam_type,clinic_id,queue_date')
        .eq('clinic_id', clinicId)
        .eq('queue_date', todayKey())
        .order('display_number', { ascending: true });

      if (queryError) throw queryError;

      const rawQueue = (data || []).map((item) => ({ ...item, status: normalizeStatus(item.status) }));

      setQueueData({
        waiting: rawQueue.filter((q) => q.status === 'waiting'),
        in: rawQueue.filter((q) => q.status === 'called'),
        done: rawQueue.filter((q) => q.status === 'completed'),
        stats: {
          totalWaiting: rawQueue.filter((q) => q.status === 'waiting').length,
          totalIn: rawQueue.filter((q) => q.status === 'called').length,
          totalDone: rawQueue.filter((q) => q.status === 'completed').length,
          totalToday: rawQueue.length,
        },
        dateKey: new Date().toLocaleDateString('ar-QA'),
      });

      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchQueueStatus();

    if (!autoRefresh || !clinicId) return undefined;

    const interval = setInterval(fetchQueueStatus, GENERAL_REFRESH_INTERVAL || 1000);
    const channel = supabase
      .channel(`queue_monitor_${clinicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'unified_queue',
        filter: `clinic_id=eq.${clinicId}`,
      }, () => {
        fetchQueueStatus();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [clinicId, autoRefresh, fetchQueueStatus]);

  if (loading && !queueData) {
    return (
      <div className="text-center p-4" data-test="queue-monitor-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
        <p className="mt-2 text-gray-400">{t('Loading queue...')}</p>
      </div>
    );
  }

  if (error && !queueData) {
    return (
      <div className="bg-red-900/20 border border-red-900/50 rounded p-4" data-test="queue-monitor-error">
        <p className="text-red-400 font-medium">{t('Error loading queue')}</p>
        <p className="text-red-300 text-sm mt-1">{error}</p>
        <button
          onClick={fetchQueueStatus}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          data-test="queue-monitor-retry"
        >
          {t('Retry')}
        </button>
      </div>
    );
  }

  if (!queueData) return null;

  const { waiting = [], in: inService = [], done = [], stats, dateKey } = queueData;

  return (
    <div className="space-y-4" data-test="queue-monitor">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white" data-test="clinic-name">
            {t('Clinic')}: {clinicId}
          </h3>
          <p className="text-sm text-gray-400" data-test="date-key">
            {t('Date')}: {dateKey}
          </p>
        </div>
        <button
          onClick={fetchQueueStatus}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          data-test="queue-monitor-refresh"
        >
          {loading ? t('Refreshing...') : t('Refresh')}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4" data-test="queue-stats">
          <div className="bg-yellow-900/20 p-3 rounded border border-yellow-900/30">
            <p className="text-sm text-gray-400">{t('Waiting')}</p>
            <p className="text-2xl font-bold text-yellow-500" data-test="stat-waiting">{stats.totalWaiting}</p>
          </div>
          <div className="bg-blue-900/20 p-3 rounded border border-blue-900/30">
            <p className="text-sm text-gray-400">{t('In Service')}</p>
            <p className="text-2xl font-bold text-blue-500" data-test="stat-in">{stats.totalIn}</p>
          </div>
          <div className="bg-green-900/20 p-3 rounded border border-green-900/30">
            <p className="text-sm text-gray-400">{t('Completed')}</p>
            <p className="text-2xl font-bold text-green-500" data-test="stat-done">{stats.totalDone}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded border border-gray-700">
            <p className="text-sm text-gray-400">{t('Total')}</p>
            <p className="text-2xl font-bold text-gray-300" data-test="stat-total">{stats.totalToday}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div data-test="queue-list-waiting">
          <h4 className="font-medium mb-2 text-yellow-500">{t('Waiting')} ({waiting.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {waiting.length === 0 ? (
              <p className="text-sm text-gray-500 italic">{t('No one waiting')}</p>
            ) : (
              waiting.map((entry) => (
                <div
                  key={`waiting-${entry.id}`}
                  className="bg-gray-800 p-2 rounded border border-gray-700 hover:border-yellow-500/50 transition-colors"
                  data-test={`waiting-ticket-${entry.display_number}`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-yellow-500 text-lg">#{entry.display_number}</p>
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-1 rounded">{entry.exam_type}</span>
                  </div>
                  <p className="text-xs text-gray-300 truncate">{formatPatientIdentity(entry).idLabel}{formatPatientIdentity(entry).genderLabel ? ` • ${formatPatientIdentity(entry).genderLabel}` : ''}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{new Date(entry.entered_at).toLocaleTimeString('ar-QA')}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div data-test="queue-list-in">
          <h4 className="font-medium mb-2 text-blue-500">{t('In Service')} ({inService.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {inService.length === 0 ? (
              <p className="text-sm text-gray-500 italic">{t('No one in service')}</p>
            ) : (
              inService.map((entry) => (
                <div
                  key={`in-${entry.id}`}
                  className="bg-blue-900/20 p-2 rounded border border-blue-900/50"
                  data-test={`in-ticket-${entry.display_number}`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-blue-400 text-lg">#{entry.display_number}</p>
                    <span className="text-[10px] bg-blue-900/40 text-blue-300 px-1 rounded">{entry.status}</span>
                  </div>
                  <p className="text-xs text-gray-200 truncate">{formatPatientIdentity(entry).idLabel}{formatPatientIdentity(entry).genderLabel ? ` • ${formatPatientIdentity(entry).genderLabel}` : ''}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {t('Called')}: {new Date(entry.called_at || entry.entered_at).toLocaleTimeString('ar-QA')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div data-test="queue-list-done">
          <h4 className="font-medium mb-2 text-green-500">{t('Completed')} ({done.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {done.length === 0 ? (
              <p className="text-sm text-gray-500 italic">{t('None completed yet')}</p>
            ) : (
              done.slice(-10).reverse().map((entry) => (
                <div
                  key={`done-${entry.id}`}
                  className="bg-green-900/10 p-2 rounded border border-green-900/30 opacity-70"
                  data-test={`done-ticket-${entry.display_number}`}
                >
                  <p className="font-bold text-green-500">#{entry.display_number}</p>
                  <p className="text-xs text-gray-400 truncate">{formatPatientIdentity(entry).idLabel}{formatPatientIdentity(entry).genderLabel ? ` • ${formatPatientIdentity(entry).genderLabel}` : ''}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {t('Done')}: {new Date(entry.completed_at || entry.updated_at).toLocaleTimeString('ar-QA')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {lastRefresh && (
        <p className="text-[10px] text-gray-600 text-center" data-test="last-refresh">
          {t('Last updated')}: {lastRefresh.toLocaleTimeString('ar-QA')}
        </p>
      )}
    </div>
  );
}

export default AdminQueueMonitor;