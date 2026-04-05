import React from 'react';

export function QRScanner({ onResult }) {
  return (
    <div className="h-full flex items-center justify-center text-white">
      <button type="button" onClick={() => onResult?.('')}>Scanner Ready</button>
    </div>
  );
}

export default QRScanner;
