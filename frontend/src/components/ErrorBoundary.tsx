import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <div style={{padding: '20px', textAlign: 'center'}}>خطأ غير متوقع</div>;
    return this.props.children;
  }
}
