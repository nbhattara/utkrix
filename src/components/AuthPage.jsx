import { useEffect, useRef, useState } from "react";
import { postApi, startOAuth } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Logo from "./Logo.jsx";
import PasswordInput from "./PasswordInput.jsx";

const providers = [
  { id: "google", label: "Google", mark: "G" },
  { id: "facebook", label: "Facebook", mark: "f" },
  { id: "github", label: "GitHub", mark: "GH" },
];

const oauthMessages = {
  provider_not_configured: "This provider is not configured yet. Ask the site administrator to finish its OAuth setup.",
  email_verification_required: "Your account was created, but you must verify your email before signing in. Check your inbox or request another verification email.",
  account_inactive: "This account is unavailable. Contact the site administrator for help.",
  instructor_pending: "Your instructor account is awaiting administrator approval.",
  account_conflict: "This email already has an account. Sign in with its existing method.",
  oauth_cancelled: "Sign-in was cancelled. You can try again whenever you are ready.",
  invalid_state: "The sign-in request expired or could not be verified. Please try again.",
  email_required: "The provider did not share a usable email address. Choose another sign-in method.",
};

function AuthShell({ title, description, children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo className="auth-logo" />
          <h1 className="auth-title">{title}</h1>
          {description ? <p className="auth-subtitle">{description}</p> : null}
        </div>
        {children}
      </div>
      <p className="auth-footer">&copy; {new Date().getFullYear()} UtkriX Technologies. All rights reserved.</p>
    </div>
  );
}

function AuthAlert({ error, success }) {
  if (error) return <div className="auth-alert auth-alert--error" role="alert">{error}</div>;
  if (success) return <div className="auth-alert auth-alert--success" role="status">{success}</div>;
  return null;
}

function AuthField({ id, name, label, type = "text", value, onChange, required = false, autoComplete, minLength, maxLength, children }) {
  return (
    <div className="auth-field">
      <label htmlFor={id || name} className="auth-label">{label}</label>
      {children || (
        <input
          type={type}
          id={id || name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          className="auth-input"
        />
      )}
    </div>
  );
}

function SocialSignIn({ disabled, onError }) {
  return (
    <div className="social-auth">
      <p className="auth-divider"><span>or continue with</span></p>
      <div className="social-auth__buttons">
        {providers.map((provider) => (
          <button
            key={provider.id}
            className="social-auth__button"
            type="button"
            disabled={disabled}
            onClick={() => {
              try {
                startOAuth(provider.id);
              } catch {
                onError("Unable to start provider sign-in. Please try again.");
              }
            }}
          >
            <span className={`social-auth__mark social-auth__mark--${provider.id}`} aria-hidden="true">{provider.mark}</span>
            <span>{provider.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LoginPage({ query }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(
    oauthMessages[query.get("oauthError")] || (query.has("oauthError") ? "Social sign-in could not be completed. Please try again." : "")
  );
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await postApi("/auth/login", { email, password });
      signIn(result);
      window.location.hash = "#home";
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await postApi("/auth/resend-verification", { email });
      setSuccess(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" description="Sign in to continue learning with UtkriX.">
      <AuthAlert error={error} success={success} />
      <form className="auth-form" onSubmit={submit}>
        <AuthField
          id="email" name="email" label="Email address" type="email"
          autoComplete="email" required maxLength={254}
          value={email} onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordInput
          id="password" name="password" label="Password"
          autoComplete="current-password" required
          value={password} onChange={(event) => setPassword(event.target.value)}
        />
        <div className="auth-row">
          <label className="auth-remember">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span className="auth-remember-label">Remember me</span>
          </label>
          <a className="auth-link" href="#/forgot-password">Forgot password?</a>
        </div>
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        {error.includes("Verify your email") && (
          <button className="auth-text-button" type="button" disabled={loading || !email} onClick={resendVerification}>
            Resend verification email
          </button>
        )}
      </form>
      <SocialSignIn disabled={loading} onError={setError} />
      <p className="auth-switch">New to UtkriX? <a className="auth-link" href="#/register">Create an account</a></p>
    </AuthShell>
  );
}

function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "student" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = await postApi("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      setSuccess(`${result.message} Check your inbox for the verification link.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" description="Join UtkriX and start learning at your own pace.">
      <AuthAlert error={error} success={success} />
      <form className="auth-form" onSubmit={submit}>
        <AuthField id="name" name="name" label="Full name" autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={update("name")} />
        <AuthField id="email" name="email" label="Email address" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={update("email")} />
        <AuthField id="role" name="role" label="I want to join as" value={form.role} onChange={update("role")}>
          <select className="auth-input" value={form.role} onChange={update("role")}>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        </AuthField>
        <PasswordInput id="password" name="password" label="Password" autoComplete="new-password" required minLength={12} value={form.password} onChange={update("password")} />
        <PasswordInput id="confirmPassword" name="confirmPassword" label="Confirm password" autoComplete="new-password" required minLength={12} value={form.confirmPassword} onChange={update("confirmPassword")} />
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <SocialSignIn disabled={loading} onError={setError} />
      <p className="auth-switch">Already have an account? <a className="auth-link" href="#/login">Sign in</a></p>
    </AuthShell>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await postApi("/auth/password-reset/request", { email });
      setSuccess(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset your password" description="We’ll send a reset link if a verified account exists for that email.">
      <AuthAlert error={error} success={success} />
      <form className="auth-form" onSubmit={submit}>
        <AuthField id="email" name="email" label="Email address" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="auth-switch"><a className="auth-link" href="#/login">Back to sign in</a></p>
    </AuthShell>
  );
}

function VerifyEmailPage({ query }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const token = query.get("token") || "";

  const verify = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await postApi("/auth/verify-email", { token });
      setSuccess(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Verify your email" description="Confirm your email address to activate your account.">
      <AuthAlert error={error} success={success} />
      {token ? (
        <button className="auth-btn" type="button" disabled={loading || Boolean(success)} onClick={verify}>
          {loading ? "Verifying…" : success ? "Email verified" : "Verify email"}
        </button>
      ) : (
        <div className="auth-alert auth-alert--error" role="alert">This verification link is missing its token. Request another email from the sign-in page.</div>
      )}
      <p className="auth-switch"><a className="auth-link" href="#/login">Continue to sign in</a></p>
    </AuthShell>
  );
}

function PasswordResetPage({ query }) {
  const token = query.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = await postApi("/auth/password-reset/confirm", { token, password });
      setSuccess(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" description="Use at least 12 characters for your new password.">
      <AuthAlert error={error} success={success} />
      {token ? (
        <form className="auth-form" onSubmit={submit}>
          <PasswordInput id="password" name="password" label="New password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} />
          <PasswordInput id="confirmPassword" name="confirmPassword" label="Confirm new password" autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <button className="auth-btn" type="submit" disabled={loading || Boolean(success)}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      ) : (
        <div className="auth-alert auth-alert--error" role="alert">This reset link is missing its token. Request a new one from the sign-in page.</div>
      )}
      <p className="auth-switch"><a className="auth-link" href="#/login">Back to sign in</a></p>
    </AuthShell>
  );
}

function OAuthCallbackPage({ query }) {
  const { signIn } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const code = query.get("code");
    if (!code || started.current) {
      if (!code) setError("The provider sign-in could not be completed. Start again from the sign-in page.");
      return undefined;
    }
    started.current = true;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/auth/callback`);

    postApi("/auth/oauth/exchange", { code })
      .then((result) => {
        signIn(result);
        window.location.hash = "#home";
      })
      .catch((requestError) => setError(requestError.message));
    return undefined;
  }, [query, signIn]);

  return (
    <AuthShell title={error ? "Sign-in could not finish" : "Finishing sign-in"} description={error ? "Please try again or choose another sign-in method." : "Securely completing your sign-in…"}>
      <AuthAlert error={error} />
      {error && <a className="auth-btn auth-btn--ghost" href="#/login">Back to sign in</a>}
      {!error && <p className="collection-status" role="status">Please wait while we verify your account.</p>}
    </AuthShell>
  );
}

export default function AuthPage({ page, query }) {
  if (page === "register") return <RegisterPage />;
  if (page === "forgot-password") return <ForgotPasswordPage />;
  if (page === "verify-email") return <VerifyEmailPage query={query} />;
  if (page === "password-reset") return <PasswordResetPage query={query} />;
  if (page === "auth/callback") return <OAuthCallbackPage query={query} />;
  return <LoginPage query={query} />;
}
