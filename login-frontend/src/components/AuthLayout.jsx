import { Link } from 'react-router-dom';

function AuthLayout({ title, description, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="UtkriX Technologies" className="h-9 w-auto mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">UTKRIX TECHNOLOGIES</h1>
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <p className="text-gray-600 mt-2">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthMessage({ error, success }) {
  if (error) {
    return (
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (success) {
    return (
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
        <p className="text-sm text-green-600">{success}</p>
      </div>
    );
  }
  return null;
}

function AuthLink({ to, children }) {
  return (
    <Link to={to} className="text-indigo-600 hover:text-indigo-800 font-medium">
      {children}
    </Link>
  );
}

export { AuthLayout, AuthMessage, AuthLink };
