import React, { useEffect } from 'react';
import { QrCode, Loader } from 'lucide-react';
import { t } from '../lib/i18n';
import api from '../lib/api-unified';

export function QrScanPage({ onSessionStart }) {

  useEffect(() => {
    const startAnonymousSession = async () => {
      try {
        const response = await api.startSession();
        if (response.success) {
          onSessionStart(response.data.sessionId);
        } else {
          // Handle error - maybe show a retry button
          console.error("Failed to start anonymous session:", response.error);
        }
      } catch (error) {
        console.error("Error calling start session API:", error);
      }
    };

    startAnonymousSession();
  }, [onSessionStart]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <div className="space-y-4">
        <Loader className="mx-auto h-12 w-12 animate-spin text-white" />
        <h1 className="text-xl font-semibold text-white">{t('initializingSecureSession')}</h1>
        <p className="text-white/80">{t('pleaseWait')}</p>
      </div>
    </div>
  );
}
