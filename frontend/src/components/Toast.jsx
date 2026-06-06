import { useState, useEffect, createContext, useContext, useCallback } from 'react';

/**
 * نظام Toast احترافي للإشعارات
 * بديل عن alert() و window.confirm()
 */

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItem = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration !== 'persistent') {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
      }, toast.duration || 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getTypeStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-600 border-green-400';
      case 'error':
        return 'bg-red-600 border-red-400';
      case 'warning':
        return 'bg-yellow-600 border-yellow-400';
      case 'info':
      default:
        return 'bg-blue-600 border-blue-400';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div
      className={`
        ${getTypeStyles()}
        text-white px-4 py-3 rounded-xl shadow-2xl
        flex items-start gap-3 min-w-[300px] max-w-[450px]
        border-2 backdrop-blur-sm
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      style={{ animation: isExiting ? '' : 'slideIn 0.3s ease-out' }}
    >
      <span className="text-xl flex-shrink-0 mt-0.5">{getIcon()}</span>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-bold text-base mb-1">{toast.title}</div>
        )}
        <div className="text-sm opacity-95 whitespace-pre-wrap">{toast.message}</div>
        {toast.actions && (
          <div className="flex gap-2 mt-3">
            {toast.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick?.();
                  if (action.closeOnClick !== false) handleClose();
                }}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${action.primary 
                    ? 'bg-white text-gray-800 hover:bg-gray-100' 
                    : 'bg-white/20 hover:bg-white/30'}
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={handleClose}
        className="text-white/80 hover:text-white text-xl leading-none p-1"
        aria-label="إغلاق"
      >
        ×
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback({
    success: (message, options = {}) => addToast({ type: 'success', message, ...options }),
    error: (message, options = {}) => addToast({ type: 'error', message, ...options }),
    warning: (message, options = {}) => addToast({ type: 'warning', message, ...options }),
    info: (message, options = {}) => addToast({ type: 'info', message, ...options }),
    confirm: (message, options = {}) => {
      return new Promise((resolve) => {
        addToast({
          type: 'warning',
          message,
          duration: 'persistent',
          ...options,
          actions: [
            {
              label: options.confirmLabel || 'تأكيد',
              primary: true,
              onClick: () => resolve(true)
            },
            {
              label: options.cancelLabel || 'إلغاء',
              onClick: () => resolve(false)
            }
          ]
        });
      });
    }
  }, [addToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.__mmcToast = toast;

    const handleToastEvent = (event) => {
      const detail = event?.detail || {};
      const type = detail.type || 'info';
      const message = detail.message || detail.text || '';
      if (!message) return;
      addToast({
        type,
        title: detail.title,
        message,
        duration: detail.duration,
        actions: detail.actions,
      });
    };

    window.addEventListener('mmc:toast', handleToastEvent);
    return () => {
      window.removeEventListener('mmc:toast', handleToastEvent);
      if (window.__mmcToast === toast) {
        delete window.__mmcToast;
      }
    };
  }, [addToast, toast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
