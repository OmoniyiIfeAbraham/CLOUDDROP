import { useId, useState } from "react";
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
  const fieldId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
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
  const isVerificationPage = isRegister && verificationStep;

  usePageTitle(
    isVerificationPage
      ? "Verify your email"
      : isRegister
        ? "Create account"
        : "Sign in",
  );

  const {
    register: bind,
    handleSubmit,
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
      email: "",
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

  const submit = handleSubmit(async (values) => {
    setRequestError("");

    try {
      if (isRegister) {
        const result = await register({
          ...values,
          firstName: (values.firstName ?? "").trim(),
          lastName: (values.lastName ?? "").trim(),
        });

        setVerificationEmail(result.user.email);
        setVerificationCode("");
        setVerificationStep(true);
        return;
      }

      await login({
        email: values.email,
        password: values.password,
      });

      navigateAfterAuth();
    } catch (error) {
      setRequestError(
        userMessage(
          error,
          isRegister
            ? "We could not create your account. Please try again."
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

    const code = verificationCode.trim();

    if (!/^\d{6}$/.test(code)) {
      setRequestError("Enter the six-digit verification code.");
      return;
    }

    setIsVerifying(true);

    try {
      await verifyEmail(verificationEmail, code);
      navigateAfterAuth();
    } catch (error) {
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
    setIsResending(true);

    try {
      await resendVerificationEmail(verificationEmail);
      setRequestError(
        USE_MOCK_API
          ? "Demo mode: use the verification code shown below."
          : "If the account is eligible, a new verification email will be sent.",
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

  return (
    <div className="auth-shell">
      <main className="auth-panel">
        <Link className="brand auth-brand" to="/">
          <span className="brand__mark">
            <Cloud size={23} strokeWidth={2.4} />
          </span>
          <span>CloudDrop</span>
        </Link>

        <div className="auth-form-wrap">
          <div className="auth-kicker">
            <ShieldCheck size={17} /> Secure workspace
          </div>

          <h1>
            {isVerificationPage
              ? "Verify your email"
              : isRegister
                ? "Create your account"
                : "Welcome back"}
          </h1>

          <p className="auth-subtitle">
            {isVerificationPage
              ? `Enter the six-digit verification code for ${verificationEmail}.`
              : isRegister
                ? "Your files, organized and within reach."
                : "Sign in to get back to your files."}
          </p>

          {isVerificationPage ? (
            <>
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
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    aria-labelledby={`${fieldId}-code-label`}
                    aria-invalid={!!requestError}
                    aria-describedby={
                      requestError ? `${fieldId}-verification-error` : undefined
                    }
                  />
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
                className="button auth-submit"
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
                  className="link-button"
                  onClick={() => {
                    setVerificationStep(false);
                    setVerificationCode("");
                    setRequestError("");
                  }}
                >
                  Back to registration
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
                    {...bind("email")}
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
        </div>

        <div className="auth-panel__foot">
          <LockKeyhole size={15} /> Private file storage
        </div>
      </main>

      <div className="auth-visual" aria-hidden="true">
        <div className="auth-visual__top">ONE PLACE FOR EVERY FILE</div>
        <div className="auth-visual__scene">
          <div className="auth-visual__file auth-visual__file--one">
            <span className="auth-visual__file-icon">PDF</span>
            <span>Project proposal</span>
            <small>Document</small>
          </div>
          <div className="auth-visual__file auth-visual__file--two">
            <span className="auth-visual__file-icon">IMG</span>
            <span>Brand assets</span>
            <small>Image</small>
          </div>
          <div className="auth-visual__file auth-visual__file--three">
            <span className="auth-visual__file-icon">MP4</span>
            <span>Product demo</span>
            <small>Video</small>
          </div>
        </div>
        <p>Store what matters. Find it when you need it.</p>
      </div>
    </div>
  );
};
