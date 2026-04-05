import React from 'react';

export function ZFDTicketDisplay({ step }) {
  if (!step) return null;
  return <div className="text-xs text-gray-300">{step.nameAr || step.name || step.id}</div>;
}

export function ZFDBanner({ notice, onDismiss }) {
  if (!notice) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-40 p-3 bg-blue-900/80 text-white flex justify-between">
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss}>✕</button>
    </div>
  );
}
