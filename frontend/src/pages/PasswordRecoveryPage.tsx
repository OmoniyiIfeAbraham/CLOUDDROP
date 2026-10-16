import { useId, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "../components/layout/AuthLayout";
import { useAuth } from "../features/auth/auth-context";
import { DEMO_RESET_TOKEN, passwordRecoveryService } from "../features/auth/password-recovery-service";
import { isApiError } from "../features/files/api/api-error";
import { userMessage } from "../lib/messages";
import { USE_MOCK_API } from "../lib/runtime";
import { usePageTitle } from "../lib/use-page-title";

const emailSchema = z.object({
  email: z.email("Enter a valid email address").max(254, "Email address is too long"),
});
const resetSchema = z.object({
  newPassword: z.string().min(8, "Use at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm your new password"),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match",
});

const BackToSignIn = () => <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>;

export const ForgotPasswordPage = () => {
  const id = useId();
  const [sent, setSent] = useState(false);
  const [requestError, setRequestError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
  });
  usePageTitle(sent ? "Check your email" : "Forgot password");
  const submit = handleSubmit(async ({ email }) => {
    setRequestError("");
    try {
      await passwordRecoveryService.requestReset(email);
      setSent(true);
    } catch (error) {
      setRequestError(userMessage(error, "We could not request a reset link. Please try again."));
    }
  });

  return (
    <AuthLayout title={sent ? "Check your email" : "Forgot your password?"}
      subtitle={sent
        ? "If an account exists for that email, password-reset instructions will be sent."
        : "Enter your email address and we'll help you reset your password."}
      focusTitle={sent}>
      {sent ? <div className="recovery-message">
        <p>Check your inbox and spam folder. Reset links expire after 30 minutes and can only be used once.</p>
        <Link className="button auth-submit" to="/forgot-password" onClick={() => setSent(false)}>Try another email</Link>
        {USE_MOCK_API && <p className="demo-hint">Demo mode: no email is sent and no real password is changed. <Link to={`/reset-password?token=${DEMO_RESET_TOKEN}`}>Try the reset form</Link>.</p>}
      </div> : <form className="auth-form" onSubmit={submit} noValidate aria-busy={isSubmitting}>
        <label className="field" htmlFor={`${id}-email`}>
          <span id={`${id}-email-label`}>Email address</span>
          <input id={`${id}-email`} type="email" autoComplete="email" placeholder="you@example.com"
            disabled={isSubmitting} {...register("email", { setValueAs: (value: string) => value.trim() })}
            aria-labelledby={`${id}-email-label`} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id}-email-error` : undefined} />
          {errors.email && <small id={`${id}-email-error`} role="alert">{errors.email.message}</small>}
        </label>
        {requestError && <div className="inline-alert" role="alert">{requestError}</div>}
        {USE_MOCK_API && <p className="demo-hint">Demo mode: no email is sent and no real password is changed.</p>}
        <button className="button button--primary auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Requesting link..." : "Send reset link"}
        </button>
      </form>}
      <BackToSignIn />
    </AuthLayout>
  );
};

const RecoveryPasswordField = ({ id, label, binding, error, disabled }: {
  id: string; label: string; binding: UseFormRegisterReturn; error: string | undefined; disabled: boolean;
}) => {
  const [visible, setVisible] = useState(false);
  return <label className="field" htmlFor={id}>
    <span id={`${id}-label`}>{label}</span>
    <span className={`password-field ${error ? "password-field--invalid" : ""}`}>
      <input id={id} type={visible ? "text" : "password"} autoComplete="new-password" disabled={disabled}
        {...binding} aria-labelledby={`${id}-label`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
      <button className="icon-button" type="button" disabled={disabled} aria-pressed={visible}
        aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        onClick={() => setVisible((value) => !value)}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
    {error && <small id={`${id}-error`} role="alert">{error}</small>}
  </label>;
};

const UnusableResetLink = ({ missing = false }: { missing?: boolean }) => (
  <AuthLayout title={missing ? "Reset link required" : "This reset link is no longer valid"}
    subtitle={missing
      ? "Open the full link from your password-reset email, or request a new one."
      : "The link may have expired or already been used. Request a new link to reset your password."}
    focusTitle>
    <Link className="button button--primary auth-submit" to="/forgot-password">Request a new reset link</Link>
    <BackToSignIn />
  </AuthLayout>
);

const ResetPasswordForm = ({ token }: { token: string }) => {
  const id = useId();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [invalidLink, setInvalidLink] = useState(false);
  const [requestError, setRequestError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });
  const submit = handleSubmit(async ({ newPassword }) => {
    setRequestError("");
    try {
      await passwordRecoveryService.resetPassword(token, newPassword);
      logout();
      // Remove the consumed token from this browser-history entry and unmount the password fields.
      navigate("/reset-password", { replace: true, state: { passwordResetComplete: true } });
    } catch (error) {
      if (isApiError(error) && error.code === "INVALID_OR_EXPIRED_RESET_TOKEN") {
        setInvalidLink(true);
      } else {
        setRequestError(userMessage(error, "We could not reset your password. Please try again."));
      }
    }
  });

  if (invalidLink) return <UnusableResetLink />;
  return <AuthLayout title="Set a new password" subtitle="Use at least 8 characters. Your reset link expires after 30 minutes and can only be used once.">
    <form className="auth-form" onSubmit={submit} noValidate aria-busy={isSubmitting}>
      <RecoveryPasswordField id={`${id}-new-password`} label="New password" binding={register("newPassword")}
        error={errors.newPassword?.message} disabled={isSubmitting} />
      <RecoveryPasswordField id={`${id}-confirm-password`} label="Confirm password" binding={register("confirmPassword")}
        error={errors.confirmPassword?.message} disabled={isSubmitting} />
      {requestError && <div className="inline-alert" role="alert">{requestError}</div>}
      {USE_MOCK_API && <p className="demo-hint">Demo mode: no real password is changed.</p>}
      <button className="button button--primary auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Resetting password..." : "Reset password"}
      </button>
    </form>
    <BackToSignIn />
  </AuthLayout>;
};

export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const location = useLocation();
  usePageTitle("Reset password");
  if ((location.state as { passwordResetComplete?: boolean } | null)?.passwordResetComplete) {
    return <AuthLayout title={USE_MOCK_API ? "Reset preview complete" : "Password updated"}
      subtitle={USE_MOCK_API ? "Demo mode: your real password has not changed." : "Your password has been reset. Sign in with your new password."} focusTitle>
      <Link className="button button--primary auth-submit" to="/login">Sign in</Link>
    </AuthLayout>;
  }
  const tokens = params.getAll("token");
  const token = tokens.length === 1 ? tokens[0]?.trim() : undefined;
  if (!token) return <UnusableResetLink missing />;
  return <ResetPasswordForm key={token} token={token} />;
};
