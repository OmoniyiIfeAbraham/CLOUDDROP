import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { ToastContext } from "./toast-context";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts([{ id, message, tone }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone}`} key={toast.id} role={toast.tone === "error" ? "alert" : "status"}>
            {toast.tone === "error" ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
            <button className="icon-button" title="Dismiss notification" aria-label="Dismiss notification" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
