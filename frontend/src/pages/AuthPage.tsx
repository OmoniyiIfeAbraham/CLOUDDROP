import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Cloud, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../features/auth/auth-context";
import { userMessage } from "../lib/messages";
import { USE_MOCK_API } from "../lib/runtime";
import { usePageTitle } from "../lib/use-page-title";

const authSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});

type FormValues = z.infer<typeof authSchema>;

export const AuthPage = ({ mode }: { mode: "login" | "register" }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [requestError, setRequestError] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = mode === "register";
  usePageTitle(isRegister ? "Create account" : "Sign in");
  const { register: bind, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setRequestError("");
    try {
      if (isRegister) {
        if (!values.firstName?.trim() || !values.lastName?.trim()) {
          setRequestError("Enter your first and last name.");
          return;
        }
        await register({ ...values, firstName: values.firstName.trim(), lastName: values.lastName.trim() });
      } else {
        await login({ email: values.email, password: values.password });
      }
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination && destination.startsWith("/") ? destination : "/", { replace: true });
    } catch (error) {
      setRequestError(userMessage(error, isRegister ? "We could not create your account. Please try again." : "Sign in failed. Check your details and try again."));
    }
  });

  return (
    <div className="auth-shell">
      <main className="auth-panel">
        <Link className="brand auth-brand" to="/">
          <span className="brand__mark"><Cloud size={23} strokeWidth={2.4} /></span>
          <span>CloudDrop</span>
        </Link>
        <div className="auth-form-wrap">
          <div className="auth-kicker"><ShieldCheck size={17} /> Secure workspace</div>
          <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-subtitle">{isRegister ? "Your files, organized and within reach." : "Sign in to get back to your files."}</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            {isRegister && (
              <div className="form-grid">
                <label className="field"><span>First name</span><input autoComplete="given-name" {...bind("firstName")} aria-invalid={!!errors.firstName} />{errors.firstName && <small role="alert">{errors.firstName.message}</small>}</label>
                <label className="field"><span>Last name</span><input autoComplete="family-name" {...bind("lastName")} aria-invalid={!!errors.lastName} />{errors.lastName && <small role="alert">{errors.lastName.message}</small>}</label>
              </div>
            )}
            <label className="field"><span>Email address</span><input type="email" autoComplete="email" placeholder="you@example.com" {...bind("email")} aria-invalid={!!errors.email} />{errors.email && <small role="alert">{errors.email.message}</small>}</label>
            <label className="field"><span>Password</span><span className={`password-field ${errors.password ? "password-field--invalid" : ""}`}><input type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "At least 8 characters" : "Enter your password"} {...bind("password")} aria-invalid={!!errors.password} /><button className="icon-button" type="button" title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>{errors.password && <small role="alert">{errors.password.message}</small>}</label>
            {requestError && <div className="inline-alert" role="alert">{requestError}</div>}
            <button className="button button--primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Please wait..." : isRegister ? "Create account" : "Sign in"}</button>
          </form>
          {USE_MOCK_API && !isRegister && <p className="demo-hint">Demo mode: sign in with any email and password of 8 or more characters.</p>}
          <p className="auth-switch">{isRegister ? "Already have an account?" : "New to CloudDrop?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
        </div>
        <div className="auth-panel__foot"><LockKeyhole size={15} /> Private file storage</div>
      </main>
      <div className="auth-visual" aria-hidden="true">
        <div className="auth-visual__top">ONE PLACE FOR EVERY FILE</div>
        <div className="auth-visual__scene">
          <div className="auth-visual__file auth-visual__file--one"><span className="auth-visual__file-icon">PDF</span><span>Project proposal</span><small>Document</small></div>
          <div className="auth-visual__file auth-visual__file--two"><span className="auth-visual__file-icon">IMG</span><span>Brand assets</span><small>Image</small></div>
          <div className="auth-visual__file auth-visual__file--three"><span className="auth-visual__file-icon">MP4</span><span>Product demo</span><small>Video</small></div>
        </div>
        <p>Store what matters. Find it when you need it.</p>
      </div>
    </div>
  );
};
