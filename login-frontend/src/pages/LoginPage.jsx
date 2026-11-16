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
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-600">Remember me</span>
          </label>
          <AuthLink to="/forgot-password">Forgot password?</AuthLink>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        {error && error.includes('Verify your email') && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={loading || !email}
            className="w-full mt-3 text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resend verification email
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        New to UtkriX? <AuthLink to="/register">Create an account</AuthLink>
      </p>
    </AuthLayout>
  );
}

export default LoginPage;
