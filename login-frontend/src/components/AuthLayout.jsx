import { Link } from 'react-router-dom';

function AuthLayout({ title, description, children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo.png" alt="UtkriX Technologies" className="auth-logo" />
          <h1 className="auth-title">{title}</h1>
          {description && <p className="auth-subtitle">{description}</p>}
        </div>
        {children}
      </div>
      <p className="auth-footer">&copy; {new Date().getFullYear()} UtkriX Technologies. All rights reserved.</p>
    </div>
  );
}

function AuthMessage({ error, success }) {
  if (error) {
    return (
      <div className="auth-alert auth-alert--error" role="alert">
        {error}
      </div>
    );
  }
  if (success) {
    return (
      <div className="auth-alert auth-alert--success" role="status">
        {success}
      </div>
    );
  }
  return null;
}

function AuthLink({ to, children }) {
  return (
    <Link to={to} className="auth-link">
      {children}
    </Link>
  );
}

export { AuthLayout, AuthMessage, AuthLink };
