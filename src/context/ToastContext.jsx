import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);

  const showToast = useCallback((message, type = 'info') => {
    idCounter.current += 1;
    const id = idCounter.current;
    
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const types = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      bg: 'bg-green-50',
      border: 'border-green-100',
      text: 'text-green-800'
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      bg: 'bg-red-50',
      border: 'border-red-100',
      text: 'text-red-800'
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      text: 'text-amber-800'
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-500" />,
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      text: 'text-blue-800'
    }
  };

  const style = types[toast.type] || types.info;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 min-w-[300px] max-w-sm rounded-xl shadow-lg border pointer-events-auto transition-all animate-in slide-in-from-right-8 fade-in duration-300 ${style.bg} ${style.border}`}>
      <div className="shrink-0">{style.icon}</div>
      <p className={`flex-1 text-sm font-medium ${style.text}`}>{toast.message}</p>
      <button 
        onClick={() => onRemove(toast.id)} 
        className={`shrink-0 p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity ${style.text} hover:bg-black/5`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
