import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { t } from '../lib/i18n';

export function CompletionPage({ onLogout }) {
  return (
    <div className="min-h-screen p-4 flex items-center justify-center" data-test="completion-page">
      <Card>
        <CardHeader>
          <CardTitle>{t('completionTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t('completionMessage')}</p>
          <Button onClick={onLogout}>{t('exit')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
