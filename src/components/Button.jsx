import React from 'react';

export function Button({ className = '', type = 'button', children, ...props }) {
  return <button type={type} className={`px-4 py-2 rounded-lg ${className}`.trim()} {...props}>{children}</button>;
}
