import { useEffect, useRef } from 'react';
import { GENERAL_REFRESH_INTERVAL, NEAR_TURN_REFRESH_INTERVAL } from '../core/config/refresh.constants';
import api from '../lib/api-unified';

const MAX_RETRY = 3;
const RECOVERY_DELAY = 5000; // 5 ثواني

export default function useQueueWatcher({ 
  fetchFunction, // يفضل تمرير دالة من lib/api-unified دائماً
  onSuccess, 
  onError,
  enabled = true,
  useNearTurnInterval = false
}) {
  const retryCountRef = useRef(0);
  const lastStateRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const interval = useNearTurnInterval ? NEAR_TURN_REFRESH_INTERVAL : GENERAL_REFRESH_INTERVAL;

    const safeFetch = async () => {
      if (document.hidden) return;
      try {
        // استخدم الدالة الممررة أو الديفولت api.getQueueStatus
        const newState = await (fetchFunction || api.getQueueStatus)();
        if (JSON.stringify(newState) === JSON.stringify(lastStateRef.current)) {
          return;
        }
        lastStateRef.current = newState;
        retryCountRef.current = 0;
        if (onSuccess) {
          onSuccess(newState);
        }
      } catch (err) {
        retryCountRef.current++;
        if (onError) {
          onError(err);
        }
        if (retryCountRef.current <= MAX_RETRY) {
          setTimeout(safeFetch, RECOVERY_DELAY);
        } else {
          try {
            await api.logRecovery ? api.logRecovery({
              source: 'queue-watcher',
              retries: retryCountRef.current,
              timestamp: new Date().toISOString()
            }) : fetch('/api/v1/events/recovery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source: 'queue-watcher',
                retries: retryCountRef.current,
                timestamp: new Date().toISOString()
              })
            });
          } catch {}
          window.location.reload();
        }
      }
    };

    safeFetch();
    timerRef.current = setInterval(safeFetch, interval);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchFunction, onSuccess, onError, enabled, useNearTurnInterval]);

  return {
    retryCount: retryCountRef.current,
    lastState: lastStateRef.current
  };
}
