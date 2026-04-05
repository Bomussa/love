import React from 'react';

export function Card({ className = '', children, ...props }) {
  return <div className={`rounded-xl border ${className}`.trim()} {...props}>{children}</div>;
}
export function CardHeader({ className = '', children, ...props }) {
  return <div className={className} {...props}>{children}</div>;
}
export function CardTitle({ className = '', children, ...props }) {
  return <h3 className={className} {...props}>{children}</h3>;
}
export function CardContent({ className = '', children, ...props }) {
  return <div className={className} {...props}>{children}</div>;
}
