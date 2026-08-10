import { useState, useEffect, useCallback } from 'react';

let toastCounter = 0;

export const toastEvents = {
  listeners: [],
  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(f => f !== fn);
    };
  },
  emit(toast) {
    this.listeners.forEach(fn => fn(toast));
  },
};

export function toast({ message, type = 'info', duration = 4000 }) {
  const id = ++toastCounter;
  toastEvents.emit({ id, message, type, duration });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = toastEvents.subscribe((t) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration);
    });
    return unsubscribe;
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            {t.type === 'success' && '✓'}
            {t.type === 'error' && '✕'}
            {t.type === 'warning' && '⚠'}
            {t.type === 'info' && 'ℹ'}
          </span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" onClick={() => remove(t.id)}>&times;</button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;