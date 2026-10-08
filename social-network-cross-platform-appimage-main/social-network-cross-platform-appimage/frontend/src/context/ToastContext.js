import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const success = useCallback((m) => add(m, 'success'), [add]);
  const error   = useCallback((m) => add(m, 'error'),   [add]);
  const info    = useCallback((m) => add(m, 'info'),     [add]);

  const ICONS = { success: '✓', error: '✕', info: 'ℹ' };
  const COLORS = {
    success: 'bg-emerald-600',
    error:   'bg-red-600',
    info:    'bg-blue-600',
  };

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id}
            className={`${COLORS[t.type]} text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-medium anim-slide min-w-[220px] max-w-xs`}>
            <span className="text-base">{ICONS[t.type]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
