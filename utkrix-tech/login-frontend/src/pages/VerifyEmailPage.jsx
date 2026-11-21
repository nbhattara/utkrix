import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { postApi } from '../api/authClient';
import { AuthLayout, AuthMessage, AuthLink } from '../components/AuthLayout';

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This verification link is missing its token. Request another email from the sign-in page.');
    }
  }, [token]);

  const handleVerify = async () => {
    if (!token) {
      setError('Invalid verification link.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await postApi('/auth/verify-email', { token });
      setSuccess(result.message);

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to verify email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      description="Confirm your email address to activate your account"
    >
      <AuthMessage error={error} success={success} />
      {token ? (
        <button
          onClick={handleVerify}
          disabled={loading || Boolean(success)}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying...' : success ? 'Email verified' : 'Verify email'}
        </button>
      ) : (
        <div className="text-center">
          <p className="text-gray-600 mb-4">This verification link is invalid or has expired.</p>
          <AuthLink to="/login">Back to sign in</AuthLink>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        <AuthLink to="/login">Continue to sign in</AuthLink>
      </p>
    </AuthLayout>
  );
}

export default VerifyEmailPage;
