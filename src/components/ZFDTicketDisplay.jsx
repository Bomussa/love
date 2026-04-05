import React from 'react';

export function ZFDTicketDisplay({ step }) {
  if (!step) return null;
  return <div className="rounded-lg border border-[#C9A54C]/30 p-2 text-sm text-[#C9A54C]">#{step?.ticket || step?.id || '-'}</div>;
}

export function ZFDBanner({ notice, onDismiss }) {
  if (!notice) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-40 bg-black/80 text-white p-3 flex justify-between items-center">
      <p>{notice.message}</p>
      <button onClick={onDismiss}>✕</button>
    </div>
  );
}
