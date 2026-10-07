import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "normal" | "wide";
}

export const Dialog = ({ title, open, onClose, children, size = "normal" }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`dialog dialog--${size}`} onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-label={title}>
      <div className="dialog__header">
        <h2>{title}</h2>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog" title="Close dialog"><X size={18} /></button>
      </div>
      {children}
    </dialog>
  );
};
