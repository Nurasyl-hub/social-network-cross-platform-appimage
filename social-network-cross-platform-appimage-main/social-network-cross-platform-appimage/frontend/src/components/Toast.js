import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg) => addToast(msg, 'error'), [addToast]);
  const info = useCallback((msg) => addToast(msg, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm animate-slide-in-right min-w-[280px] max-w-md
              ${toast.type === 'success' ? 'bg-green-500/90 text-white' : ''}
              ${toast.type === 'error' ? 'bg-red-500/90 text-white' : ''}
              ${toast.type === 'info' ? 'bg-blue-500/90 text-white' : ''}
            `}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <span className="text-xl">✓</span>}
              {toast.type === 'error' && <span className="text-xl">✕</span>}
              {toast.type === 'info' && <span className="text-xl">ℹ</span>}
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
