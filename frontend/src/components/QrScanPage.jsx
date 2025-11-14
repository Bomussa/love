/**
 * QrScanPage - Simplified for direct session initiation
 */

import React, { useEffect } from 'react';
import { Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { t } from '../lib/i18n';

export function QrScanPage({ onSessionStart }) {
  useEffect(() => {
    // Automatically start a new session
    onSessionStart();
  }, [onSessionStart]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('qrScanTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-2 py-4">
          <Loader className="w-5 h-5 animate-spin" />
          <span>{t('initiatingSession')}</span>
        </CardContent>
      </Card>
    </div>
  );
}
