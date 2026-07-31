import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ZFDTicketDisplay } from './ZFDTicketDisplay';
import { t } from '../lib/i18n';
import api from '../lib/api-unified';

const DISPLAY_REFRESH_MS = 5000;

/**
 * Public clinic display backed by the sanitized application API.
 * No patient identity is requested or rendered on this screen.
 */
export function DisplayPage({ clinicId, language }) {
  const resolvedClinicId = clinicId || (() => {
    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/^\/clinic\/([^/]+)\/display$/);
    return match ? decodeURIComponent(match[1]) : null;
  })();

  const [currentStep, setCurrentStep] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const refreshTimerRef = useRef(null);

  const fetchCurrentStatus = useCallback(async () => {
    if (!resolvedClinicId) return;

    try {
      const response = await api.getQueueStatus(resolvedClinicId);
      if (response?.success === false) {
        throw new Error(response?.error || 'QUEUE_STATUS_FAILED');
      }

      const snapshot = response?.data || response || {};
      const queue = Array.isArray(snapshot.queue) ? snapshot.queue : [];
      const current = snapshot.currentPatient
        || queue.find((row) => ['called', 'serving', 'in_progress', 'in_service'].includes(String(row?.status || '').toLowerCase()))
        || null;

      if (current?.display_number) {
        setCurrentStep({
          status: 'OK',
          assigned: { ticket: current.display_number },
          clinicId: resolvedClinicId,
          calledAt: current.called_at || null,
        });
      } else {
        setCurrentStep(null);
      }

      setIsConnected(true);
      setLastUpdate(new Date().toLocaleTimeString('ar-QA'));
    } catch (error) {
      console.error('[DisplayPage] Failed to load queue status:', error);
      setIsConnected(false);
    }
  }, [resolvedClinicId]);

  useEffect(() => {
    if (!resolvedClinicId) return undefined;

    void fetchCurrentStatus();
    refreshTimerRef.current = window.setInterval(() => {
      void fetchCurrentStatus();
    }, DISPLAY_REFRESH_MS);

    return () => {
      if (refreshTimerRef.current) {
        window.clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [fetchCurrentStatus, resolvedClinicId]);

  const reconnect = () => {
    void fetchCurrentStatus();
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-sm">{isConnected ? 'متصل' : 'غير متصل'}</span>
      </div>

      <img
        src="/mms-logo.png"
        alt="اللجنة الطبية العسكرية"
        className="w-24 h-24 object-contain mb-4"
        loading="lazy"
      />

      <h1 className="text-4xl font-bold mb-12">{t('Current Patient')}</h1>

      <div className="scale-150 transform">
        <ZFDTicketDisplay
          step={currentStep}
          className="bg-gray-800 rounded-3xl p-12 min-w-[400px]"
        />
      </div>

      <div className="mt-12 text-2xl text-gray-500">
        {t('Clinic')}: {resolvedClinicId}
      </div>

      {lastUpdate && (
        <div className="mt-4 text-sm text-gray-400">
          آخر تحديث: {lastUpdate}
        </div>
      )}

      {!isConnected && (
        <button
          onClick={reconnect}
          className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
        >
          إعادة الاتصال
        </button>
      )}
    </div>
  );
}

export default DisplayPage;
