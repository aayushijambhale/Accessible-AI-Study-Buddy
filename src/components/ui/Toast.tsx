import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000); // auto remove after 5s
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-4 min-w-[300px] bg-white border-l-4 rounded shadow-lg animate-fadeIn transition-all ${
              toast.type === 'success' ? 'border-green-500' :
              toast.type === 'error' ? 'border-red-500' :
              toast.type === 'warning' ? 'border-yellow-500' :
              'border-blue-500'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="text-green-500" size={20} />}
            {toast.type === 'error' && <XCircle className="text-red-500" size={20} />}
            {toast.type === 'warning' && <AlertCircle className="text-yellow-500" size={20} />}
            {toast.type === 'info' && <Info className="text-blue-500" size={20} />}
            <p className="flex-1 text-sm font-medium text-slate-700">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
