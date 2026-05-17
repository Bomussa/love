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
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    stoppedRef.current = false;
    const interval = useNearTurnInterval ? NEAR_TURN_REFRESH_INTERVAL : GENERAL_REFRESH_INTERVAL;

    const safeFetch = async () => {
      if (stoppedRef.current || document.hidden) return;
      try {
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
          stoppedRef.current = true;
          if (onError) {
            onError(new Error('queue-watcher-recovery-exhausted'));
          }
        }
      }
    };

    safeFetch();
    timerRef.current = setInterval(safeFetch, interval);
    return () => {
      stoppedRef.current = true;
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