import React from 'react';
import { Input } from './Input';
import { Button } from './Button';

export function QRScanner({ onResult, onError }) {
  const [value, setValue] = React.useState('');

  return (
    <div className="p-4 space-y-3 text-white">
      <p className="text-sm text-gray-300">Camera scanner fallback: paste or type scanned code.</p>
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Scan result" />
      <Button onClick={() => {
        try {
          onResult?.(value.trim());
        } catch (error) {
          onError?.(error);
        }
      }}>Use code</Button>
    </div>
  );
}
