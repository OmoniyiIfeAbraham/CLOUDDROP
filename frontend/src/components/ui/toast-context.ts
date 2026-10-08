import { createContext, useContext } from "react";

export interface ToastContextValue {
  notify: (message: string, tone?: "success" | "error") => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
};
