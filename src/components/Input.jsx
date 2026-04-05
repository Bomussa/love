import React from 'react';

export function Input({ className = '', ...props }) {
  return <input className={className} {...props} />;
}

export default Input;
