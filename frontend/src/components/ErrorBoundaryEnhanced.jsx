import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

/**
 * Enhanced Error Boundary Component
 * معالج الأخطاء المحسّن مع خيارات الاسترجاع
 */
export class ErrorBoundaryEnhanced extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const now = Date.now();
    const timeSinceLastError = this.state.lastErrorTime ? now - this.state.lastErrorTime : Infinity;

    // تتبع عدد الأخطاء المتكررة
    let errorCount = this.state.errorCount + 1;
    if (timeSinceLastError > 60000) { // إعادة تعيين بعد دقيقة
      errorCount = 1;
    }

    this.setState({
      error,
      errorInfo,
      errorCount,
      lastErrorTime: now,
    });

    // تسجيل الخطأ
    console.error('Error caught by boundary:', error, errorInfo);

    // إرسال تقرير الخطأ إذا كان متكرراً
    if (errorCount > 3) {
      this.reportError(error, errorInfo);
    }
  }

  reportError = (error, errorInfo) => {
    // يمكن إرسال التقرير إلى خادم المراقبة
    console.error('🚨 Critical Error Reported:', {
      message: error?.toString(),
      stack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    });
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <h1 className="text-2xl font-bold text-gray-900">حدث خطأ</h1>
            </div>

            {/* Error Message */}
            <div className="mb-4">
              <p className="text-gray-600 text-sm mb-2">
                {this.state.error?.message || 'حدث خطأ غير متوقع'}
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    تفاصيل الخطأ
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
            </div>

            {/* Error Count Warning */}
            {this.state.errorCount > 2 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-800">
                  ⚠️ تم تسجيل {this.state.errorCount} أخطاء متكررة
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة محاولة
              </button>
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث الصفحة
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                <Home className="w-4 h-4" />
                العودة للرئيسية
              </button>
            </div>

            {/* Footer */}
            <p className="mt-4 text-xs text-gray-500 text-center">
              إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryEnhanced;
