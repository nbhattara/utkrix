import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { postApi } from '../api/authClient';
import { AuthLayout, AuthMessage, AuthLink } from '../components/AuthLayout';
import PasswordInput from '../components/PasswordInput';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This reset link is missing its token. Request a new one from the sign-in page.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const result = await postApi('/auth/password-reset/confirm', { token, password });
      setSuccess(result.message);

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      description="Use at least 12 characters for your new password"
    >
      <AuthMessage error={error} success={success} />
      {token ? (
        <form onSubmit={handleSubmit}>
          <PasswordInput
            label="New password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <PasswordInput
            label="Confirm new password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={loading || Boolean(success)}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Updating...' : success ? 'Password updated' : 'Update password'}
          </button>
        </form>
      ) : (
        <div className="text-center">
          <p className="text-gray-600 mb-4">This reset link is invalid or has expired.</p>
          <AuthLink to="/forgot-password">Request a new reset link</AuthLink>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        <AuthLink to="/login">Back to sign in</AuthLink>
      </p>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
