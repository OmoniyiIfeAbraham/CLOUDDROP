import { useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../components/layout/AuthLayout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../features/auth/auth-context";
import { isApiError } from "../features/files/api/api-error";
import { userMessage } from "../lib/messages";
import { USE_MOCK_API } from "../lib/runtime";
import { usePageTitle } from "../lib/use-page-title";

const authSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z.string().trim().pipe(z.email("Enter a valid email address")),
  password: z.string().min(8, "Use at least 8 characters"),
});

type FormValues = z.infer<typeof authSchema>;

export const AuthPage = ({ mode }: { mode: "login" | "register" }) => {
  const fieldId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestNotice, setRequestNotice] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const {
    login,
    register,
    verifyEmail,
    resendVerificationEmail,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = mode === "register";
  const isVerificationPage = verificationStep;
  const initialEmail = (location.state as { email?: unknown } | null)?.email;

  usePageTitle(
    alreadyVerified ? "Email already verified" : isVerificationPage
      ? "Verify your email"
      : isRegister
        ? "Create account"
        : "Sign in",
  );

  const {
    register: bind,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(
      authSchema.superRefine((values, context) => {
        if (!isRegister) return;

        if (!values.firstName) {
          context.addIssue({
            code: "custom",
            path: ["firstName"],
            message: "Enter your first name",
          });
        }

        if (!values.lastName) {
          context.addIssue({
            code: "custom",
            path: ["lastName"],
            message: "Enter your last name",
          });
        }
      }),
    ),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: typeof initialEmail === "string" ? initialEmail : "",
      password: "",
    },
  });

  const destination = (location.state as { from?: string } | null)?.from;
  const navigateAfterAuth = () => {
    navigate(
      destination && destination.startsWith("/") ? destination : "/",
      { replace: true },
    );
  };

  const openVerification = (email: string, notice: string, error = "") => {
    setVerificationEmail(email.trim().toLowerCase());
    setVerificationCode("");
    setCodeError("");
    setRecoveryEmail("");
    setAlreadyVerified(false);
    setRequestNotice(notice);
    setRequestError(error);
    resetField("password");
    setShowPassword(false);
    setVerificationStep(true);
  };

  const closeVerification = () => {
    setVerificationStep(false);
    setAlreadyVerified(false);
    setVerificationCode("");
    setCodeError("");
    setRequestError("");
    setRequestNotice("");
  };

  const submit = handleSubmit(async (values) => {
    setRequestError("");
    setRequestNotice("");
    setRecoveryEmail("");

    try {
      if (isRegister) {
        const result = await register({
          ...values,
          firstName: (values.firstName ?? "").trim(),
          lastName: (values.lastName ?? "").trim(),
        });

        openVerification(result.user.email, "Check your inbox and spam folder for your verification code.");
        return;
      }

      await login({
        email: values.email,
        password: values.password,
      });

      navigateAfterAuth();
    } catch (error) {
      if (isApiError(error)) {
        if (isRegister && error.code === "VERIFICATION_EMAIL_FAILED") {
          openVerification(values.email,
            "Your account was created. Request a new verification code to finish setting up your account.",
            userMessage(error));
          return;
        }
        if (!isRegister && error.code === "EMAIL_NOT_VERIFIED") {
          openVerification(values.email, userMessage(error));
          return;
        }
        if (isRegister && (error.code === "EMAIL_ALREADY_REGISTERED" ||
          error.code === "NETWORK_ERROR" || (error.status !== undefined && error.status >= 500))) {
          // A failed delivery or lost response can leave an account awaiting verification.
          // Offer recovery without asserting whether an ambiguous request created one.
          setRecoveryEmail(values.email.trim().toLowerCase());
        }
      }
      setRequestError(
        userMessage(
          error,
          isRegister
            ? "We could not confirm account creation. If you already submitted this form, try signing in or finishing email verification."
            : "Sign in failed. Check your details and try again.",
        ),
      );
    }
  });

  const submitVerification = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setRequestError("");
    setCodeError("");

    const code = verificationCode.trim();

    if (!/^\d{6}$/.test(code)) {
      setCodeError("Enter the six-digit verification code.");
      codeInput.current?.focus();
      return;
    }

    setIsVerifying(true);

    try {
      await verifyEmail(verificationEmail, code);
      navigateAfterAuth();
    } catch (error) {
      if (isApiError(error) && error.code === "EMAIL_ALREADY_VERIFIED") {
        setAlreadyVerified(true);
        setVerificationCode("");
        return;
      }
      if (isApiError(error) && ["INVALID_VERIFICATION_CODE", "VERIFICATION_ATTEMPTS_EXCEEDED"].includes(error.code)) {
        setCodeError(userMessage(error));
        codeInput.current?.focus();
        return;
      }
      setRequestError(
        userMessage(
          error,
          "Email verification failed. Check the code and try again.",
        ),
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const resendCode = async () => {
    setRequestError("");
    setRequestNotice("");
    setCodeError("");
    setVerificationCode("");
    setIsResending(true);

    try {
      await resendVerificationEmail(verificationEmail);
      setRequestNotice(
        USE_MOCK_API
          ? "Demo mode: use the verification code shown below."
          : "If the account is eligible, a new verification email will be sent. Check your inbox and spam folder, and allow a minute between requests.",
      );
    } catch (error) {
      setRequestError(
        userMessage(
          error,
          "We could not resend the verification email. Please try again.",
        ),
      );
    } finally {
      setIsResending(false);
    }
  };

  if (alreadyVerified) {
    return <AuthLayout key="already-verified" title="Email already verified"
      subtitle="Your email is already verified. Sign in to continue." focusTitle>
      <Link className="button button--primary auth-submit" to="/login"
        state={{ email: verificationEmail, from: destination }} onClick={closeVerification}>Sign in</Link>
    </AuthLayout>;
  }

  return (
    <AuthLayout
      title={isVerificationPage ? "Verify your email" : isRegister ? "Create your account" : "Welcome back"}
      subtitle={isVerificationPage
        ? `Enter the six-digit verification code for ${verificationEmail}.`
        : isRegister ? "Your files, organized and within reach." : "Sign in to get back to your files."}
      focusTitle={isVerificationPage}
    >
          {isVerificationPage ? (
            <>
              {requestNotice && <p className="auth-notice" role="status">{requestNotice}</p>}
              <form
                className="auth-form"
                onSubmit={submitVerification}
                noValidate
                aria-busy={isVerifying}
              >
                <label className="field">
                  <span id={`${fieldId}-code-label`}>
                    Verification code
                  </span>
                  <input
                    ref={codeInput}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(event) => {
                      setCodeError("");
                      setVerificationCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      );
                    }}
                    aria-labelledby={`${fieldId}-code-label`}
                    aria-invalid={!!codeError}
                    aria-describedby={
                      codeError ? `${fieldId}-code-error` : undefined
                    }
                  />
                  {codeError && <small id={`${fieldId}-code-error`} role="alert">{codeError}</small>}
                </label>

                {requestError && (
                  <div
                    className="inline-alert"
                    id={`${fieldId}-verification-error`}
                    role="alert"
                  >
                    {requestError}
                  </div>
                )}

                {USE_MOCK_API && (
                  <p className="demo-hint">
                    Demo mode: your verification code is 123456. No email is sent.
                  </p>
                )}

                <button
                  className="button button--primary auth-submit"
                  type="submit"
                  disabled={isVerifying || isResending}
                >
                  {isVerifying ? "Verifying..." : "Verify email"}
                </button>
              </form>

              <button
                className="button button--secondary auth-submit"
                type="button"
                onClick={() => void resendCode()}
                disabled={isResending || isVerifying}
              >
                {isResending ? "Resending..." : "Resend verification code"}
              </button>

              <p className="auth-switch">
                Wrong email?{" "}
                <button
                  type="button"
                  className="text-button"
                  disabled={isResending || isVerifying}
                  onClick={closeVerification}
                >
                  {isRegister ? "Back to registration" : "Back to sign in"}
                </button>
              </p>
            </>
          ) : (
            <>
              <form
                className="auth-form"
                onSubmit={submit}
                noValidate
                aria-busy={isSubmitting}
              >
                {isRegister && (
                  <div className="form-grid">
                    <label className="field">
                      <span id={`${fieldId}-first-label`}>First name</span>
                      <input
                        autoComplete="given-name"
                        {...bind("firstName")}
                        aria-labelledby={`${fieldId}-first-label`}
                        aria-invalid={!!errors.firstName}
                        aria-describedby={
                          errors.firstName
                            ? `${fieldId}-first-error`
                            : undefined
                        }
                      />
                      {errors.firstName && (
                        <small id={`${fieldId}-first-error`} role="alert">
                          {errors.firstName.message}
                        </small>
                      )}
                    </label>

                    <label className="field">
                      <span id={`${fieldId}-last-label`}>Last name</span>
                      <input
                        autoComplete="family-name"
                        {...bind("lastName")}
                        aria-labelledby={`${fieldId}-last-label`}
                        aria-invalid={!!errors.lastName}
                        aria-describedby={
                          errors.lastName
                            ? `${fieldId}-last-error`
                            : undefined
                        }
                      />
                      {errors.lastName && (
                        <small id={`${fieldId}-last-error`} role="alert">
                          {errors.lastName.message}
                        </small>
                      )}
                    </label>
                  </div>
                )}

                <label className="field">
                  <span id={`${fieldId}-email-label`}>Email address</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...bind("email", { onChange: () => {
                      setRecoveryEmail("");
                      setRequestError("");
                    } })}
                    aria-labelledby={`${fieldId}-email-label`}
                    aria-invalid={!!errors.email}
                    aria-describedby={
                      errors.email ? `${fieldId}-email-error` : undefined
                    }
                  />
                  {errors.email && (
                    <small id={`${fieldId}-email-error`} role="alert">
                      {errors.email.message}
                    </small>
                  )}
                </label>

                <label className="field">
                  <span id={`${fieldId}-password-label`}>Password</span>
                  <span
                    className={`password-field ${
                      errors.password ? "password-field--invalid" : ""
                    }`}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        isRegister ? "new-password" : "current-password"
                      }
                      placeholder={
                        isRegister
                          ? "At least 8 characters"
                          : "Enter your password"
                      }
                      {...bind("password")}
                      aria-labelledby={`${fieldId}-password-label`}
                      aria-invalid={!!errors.password}
                      aria-describedby={
                        errors.password
                          ? `${fieldId}-password-error`
                          : undefined
                      }
                    />
                    <button
                      className="icon-button"
                      type="button"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </span>
                  {errors.password && (
                    <small id={`${fieldId}-password-error`} role="alert">
                      {errors.password.message}
                    </small>
                  )}
                </label>

                {requestError && (
                  <div className="inline-alert" role="alert">
                    {requestError}
                  </div>
                )}

                {recoveryEmail && <div className="auth-recovery-actions">
                  <p>If you already signed up, sign in. If your email is still unverified, finish verification.</p>
                  <Link className="button button--secondary" to="/login" state={{ email: recoveryEmail, from: destination }}>Sign in instead</Link>
                  <button className="button button--secondary" type="button" onClick={() => openVerification(recoveryEmail,
                    "If this account still needs verification, enter your code or request a new one.")}>Finish email verification</button>
                </div>}

                {!isRegister && <Link className="auth-recovery-link" to="/forgot-password">Forgot password?</Link>}

                <button
                  className="button button--primary auth-submit"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Please wait..."
                    : isRegister
                      ? "Create account"
                      : "Sign in"}
                </button>
              </form>

              {USE_MOCK_API && !isRegister && (
                <p className="demo-hint">
                  Demo mode: sign in with any email and password of 8 or more
                  characters.
                </p>
              )}

              <p className="auth-switch">
                {isRegister
                  ? "Already have an account?"
                  : "New to CloudDrop?"}{" "}
                <Link to={isRegister ? "/login" : "/register"}>
                  {isRegister ? "Sign in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
    </AuthLayout>
  );
};
