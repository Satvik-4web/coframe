import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          let bgClass = 'bg-white border-slate-200 text-[#172033] shadow-lg';
          let Icon = Info;
          let iconClass = 'text-blue-600';

          if (toast.type === 'success') {
            bgClass = 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-md';
            Icon = CheckCircle2;
            iconClass = 'text-emerald-600';
          } else if (toast.type === 'error') {
            bgClass = 'bg-rose-50 border-rose-300 text-rose-950 shadow-md';
            Icon = AlertCircle;
            iconClass = 'text-rose-600';
          } else if (toast.type === 'warning') {
            bgClass = 'bg-amber-50 border-amber-300 text-amber-950 shadow-md';
            Icon = AlertTriangle;
            iconClass = 'text-amber-600';
          } else if (toast.type === 'info') {
            bgClass = 'bg-blue-50 border-blue-300 text-blue-950 shadow-md';
            Icon = Info;
            iconClass = 'text-blue-600';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border ${bgClass} transition-all duration-200 animate-in fade-in slide-in-from-bottom-3`}
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconClass}`} />
              <div className="flex-1 text-xs font-medium leading-relaxed">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
