import React from 'react';

export function Button({ className = '', children, ...props }) {
  return <button className={className} {...props}>{children}</button>;
}

export default Button;
