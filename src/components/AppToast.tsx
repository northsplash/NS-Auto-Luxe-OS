import { useEffect, useState } from 'react';

type Toast = { title: string; body: string };

let current: Toast | null = null;
const listeners = new Set<(toast: Toast | null) => void>();

export function showToast(title: string, body = '') {
  current = { title, body };
  listeners.forEach((fn) => fn(current));
  window.setTimeout(() => {
    current = null;
    listeners.forEach((fn) => fn(null));
  }, 3400);
}

export default function AppToast() {
  const [toast, setToast] = useState<Toast | null>(current);
  useEffect(() => {
    const on = (next: Toast | null) => setToast(next);
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  if (!toast) return null;
  return (
    <button type="button" className="ns-app-toast" onClick={() => { current = null; listeners.forEach((fn) => fn(null)); }}>
      <strong>{toast.title}</strong>
      {toast.body ? <span>{toast.body}</span> : null}
    </button>
  );
}
