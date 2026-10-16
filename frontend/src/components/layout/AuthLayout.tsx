import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Cloud, LockKeyhole, ShieldCheck } from "lucide-react";

export const AuthLayout = ({ title, subtitle, children, focusTitle = false }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  focusTitle?: boolean;
}) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusTitle) heading.current?.focus(); }, [focusTitle]);
  return (
  <div className="auth-shell">
    <main className="auth-panel">
      <Link className="brand auth-brand" to="/">
        <span className="brand__mark"><Cloud size={23} strokeWidth={2.4} /></span>
        <span>CloudDrop</span>
      </Link>
      <div className="auth-form-wrap">
        <div className="auth-kicker"><ShieldCheck size={17} /> Secure workspace</div>
        <h1 ref={heading} tabIndex={focusTitle ? -1 : undefined}>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
      </div>
      <div className="auth-panel__foot"><LockKeyhole size={15} /> Private file storage</div>
    </main>
    <div className="auth-visual" aria-hidden="true">
      <div className="auth-visual__top">ONE PLACE FOR EVERY FILE</div>
      <div className="auth-visual__scene">
        <div className="auth-visual__file auth-visual__file--one">
          <span className="auth-visual__file-icon">PDF</span>
          <span>Project proposal</span><small>Document</small>
        </div>
        <div className="auth-visual__file auth-visual__file--two">
          <span className="auth-visual__file-icon">IMG</span>
          <span>Brand assets</span><small>Image</small>
        </div>
        <div className="auth-visual__file auth-visual__file--three">
          <span className="auth-visual__file-icon">MP4</span>
          <span>Product demo</span><small>Video</small>
        </div>
      </div>
      <p>Store what matters. Find it when you need it.</p>
    </div>
  </div>
  );
};
