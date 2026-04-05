import React from 'react';

export const Input = React.forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`w-full px-3 py-2 rounded-lg border ${className}`.trim()} {...props} />;
});
