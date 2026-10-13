import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "normal" | "wide";
  closeDisabled?: boolean;
  returnFocusTo?: HTMLElement | null;
}

export const Dialog = ({ title, open, onClose, children, size = "normal", closeDisabled = false, returnFocusTo }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const invokingControl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      invokingControl.current = returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
      const target = invokingControl.current;
      if (target?.isConnected && !target.matches(":disabled")) target.focus({ preventScroll: true });
      else dialog.closest<HTMLElement>("main")?.focus({ preventScroll: true });
      invokingControl.current = null;
    }
  }, [open, returnFocusTo]);

  return (
    <dialog ref={ref} className={`dialog dialog--${size}`} onClose={() => { if (open) onClose(); }} onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose(); }} aria-label={title}>
      <div className="dialog__header">
        <h2>{title}</h2>
        <button className="icon-button" type="button" onClick={onClose} disabled={closeDisabled} aria-label="Close dialog" title="Close dialog"><X size={18} /></button>
      </div>
      {children}
    </dialog>
  );
};
