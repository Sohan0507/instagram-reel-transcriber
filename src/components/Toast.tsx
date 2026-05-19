'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export interface ToastType {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastType[];
  onClose: (id: string) => void;
}

export default function Toast({ toasts, onClose }: ToastProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full sm:w-96 px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastType; onClose: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-500/20 bg-emerald-950/20',
    error: 'border-rose-500/20 bg-rose-950/20',
    info: 'border-blue-500/20 bg-blue-950/20',
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-slide-in ${borderColors[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1 text-sm font-medium text-zinc-200 leading-relaxed">
        {toast.message}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded-lg transition-colors duration-150"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
