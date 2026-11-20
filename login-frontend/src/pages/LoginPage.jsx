import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postApi, getRedirectUrl } from '../api/authClient';
import { AuthLayout, AuthMessage, AuthLink } from '../components/AuthLayout';
import PasswordInput from '../components/PasswordInput';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await postApi('/auth/login', { email, password });
      setSuccess(result.message);

      setTimeout(() => {
        const redirectUrl = getRedirectUrl(result?.user?.role);
        window.location.href = redirectUrl;
      }, 500);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await postApi('/auth/resend-verification', { email });
      setSuccess(result.message);
    } catch (err) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" description="Sign in to continue with UtkriX Technologies">
      <AuthMessage error={error} success={success} />
      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">
            Email address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            maxLength={254}
            className="auth-input"
          />
        </div>

        <PasswordInput
          label="Password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <div className="auth-row">
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="auth-checkbox"
            />
            <span className="auth-remember-label">Remember me</span>
          </label>
          <AuthLink to="/forgot-password">Forgot password?</AuthLink>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-btn"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        {error && error.includes('Verify your email') && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={loading || !email}
            className="auth-btn auth-btn--ghost"
          >
            Resend verification email
          </button>
        )}
      </form>

      <p className="auth-switch">
        New to UtkriX? <AuthLink to="/register">Create an account</AuthLink>
      </p>
    </AuthLayout>
  );
}

export default LoginPage;
