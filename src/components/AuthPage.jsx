import { useEffect, useRef, useState } from "react";
import { postApi, startOAuth } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

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

function AuthLayout({ title, description, children }) {
  return (
    <section className="auth-section" aria-labelledby="auth-title">
      <div className="auth-card">
        <div className="auth-card__intro">
          <span className="auth-eyebrow">UTKRIX LEARNING</span>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function AuthMessage({ error, success }) {
  if (error) return <p className="auth-message auth-message--error" role="alert">{error}</p>;
  if (success) return <p className="auth-message auth-message--success" role="status">{success}</p>;
  return null;
}

function LoginPage({ query }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <AuthLayout title="Welcome back" description="Sign in to continue learning with UtkriX.">
      <AuthMessage error={error} success={success} />
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Email address</span>
          <input type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <a className="auth-form__forgot" href="#/forgot-password">Forgot password?</a>
        <button className="btn btn--primary auth-form__submit" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        {error.includes("Verify your email") && (
          <button className="auth-text-button" type="button" disabled={loading || !email} onClick={resendVerification}>
            Resend verification email
          </button>
        )}
      </form>
      <SocialSignIn disabled={loading} onError={setError} />
      <p className="auth-switch">New to UtkriX? <a href="#/register">Create an account</a></p>
    </AuthLayout>
  );
}

function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "student" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

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
    <AuthLayout title="Create your account" description="Join UtkriX and start learning at your own pace.">
      <AuthMessage error={error} success={success} />
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Full name</span>
          <input type="text" name="name" autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field">
          <span>Email address</span>
          <input type="email" name="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label className="field">
          <span>I want to join as</span>
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        </label>
        <label className="field">
          <span>Password <small className="field__opt">At least 12 characters</small></span>
          <input type="password" name="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input type="password" name="confirmPassword" autoComplete="new-password" required minLength={12} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
        </label>
        <button className="btn btn--primary auth-form__submit" type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <SocialSignIn disabled={loading} onError={setError} />
      <p className="auth-switch">Already have an account? <a href="#/login">Sign in</a></p>
    </AuthLayout>
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
    <AuthLayout title="Reset your password" description="We’ll send a reset link if a verified account exists for that email.">
      <AuthMessage error={error} success={success} />
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Email address</span>
          <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button className="btn btn--primary auth-form__submit" type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="auth-switch"><a href="#/login">Back to sign in</a></p>
    </AuthLayout>
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
    <AuthLayout title="Verify your email" description="Confirm your email address to activate your account.">
      <AuthMessage error={error} success={success} />
      {token ? (
        <button className="btn btn--primary auth-form__submit" type="button" disabled={loading || Boolean(success)} onClick={verify}>
          {loading ? "Verifying…" : success ? "Email verified" : "Verify email"}
        </button>
      ) : (
        <p className="auth-message auth-message--error" role="alert">This verification link is missing its token. Request another email from the sign-in page.</p>
      )}
      <p className="auth-switch"><a href="#/login">Continue to sign in</a></p>
    </AuthLayout>
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
    <AuthLayout title="Choose a new password" description="Use at least 12 characters for your new password.">
      <AuthMessage error={error} success={success} />
      {token ? (
        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>New password</span>
            <input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input type="password" autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          <button className="btn btn--primary auth-form__submit" type="submit" disabled={loading || Boolean(success)}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      ) : (
        <p className="auth-message auth-message--error" role="alert">This reset link is missing its token. Request a new one from the sign-in page.</p>
      )}
      <p className="auth-switch"><a href="#/login">Back to sign in</a></p>
    </AuthLayout>
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
    <AuthLayout title={error ? "Sign-in could not finish" : "Finishing sign-in"} description={error ? "Please try again or choose another sign-in method." : "Securely completing your sign-in…"}>
      <AuthMessage error={error} />
      {error && <a className="btn btn--primary auth-form__submit" href="#/login">Back to sign in</a>}
      {!error && <p className="collection-status" role="status">Please wait while we verify your account.</p>}
    </AuthLayout>
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
