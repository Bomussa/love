import React from 'react';
import { t } from '../lib/i18n';
import { CheckCircle, AlertTriangle, XCircle, Loader } from 'lucide-react';

const SystemHealthStatus = ({ status, message, language }) => {
  let icon;
  let colorClass;
  let statusText;

  switch (status) {
    case 'healthy':
      icon = <CheckCircle className="icon icon-md me-2" />;
      colorClass = 'text-green-400 bg-green-900/50 border-green-500';
      statusText = language === 'ar' ? 'صحة النظام: ممتاز' : 'System Health: Excellent';
      break;
    case 'degraded':
      icon = <AlertTriangle className="icon icon-md me-2" />;
      colorClass = 'text-yellow-400 bg-yellow-900/50 border-yellow-500';
      statusText = language === 'ar' ? 'صحة النظام: متدهورة' : 'System Health: Degraded';
      break;
    case 'down':
      icon = <XCircle className="icon icon-md me-2" />;
      colorClass = 'text-red-400 bg-red-900/50 border-red-500';
      statusText = language === 'ar' ? 'صحة النظام: معطل' : 'System Health: Down';
      break;
    case 'checking':
    default:
      icon = <Loader className="icon icon-md me-2 animate-spin" />;
      colorClass = 'text-blue-400 bg-blue-900/50 border-blue-500';
      statusText = language === 'ar' ? 'صحة النظام: فحص...' : 'System Health: Checking...';
      break;
  }

  return (
    <div className={`flex items-center p-2 rounded-lg border ${colorClass}`}>
      {icon}
      <div className="flex flex-col text-sm">
        <span className="font-semibold text-white">{statusText}</span>
        <span className="text-xs text-gray-300">{message}</span>
      </div>
    </div>
  );
};

export default SystemHealthStatus;
