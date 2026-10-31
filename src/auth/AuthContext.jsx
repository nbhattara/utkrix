import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SESSION_KEY = "utkrix-auth-session";
const TOKEN_KEY = "utkrix-auth-token";
const AuthContext = createContext(null);

function readSession() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    const session = JSON.parse(saved);
    if (!session?.token || !session?.user) return null;
    sessionStorage.setItem(TOKEN_KEY, session.token);
    return session;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setSession(null);
  }, []);

  useEffect(() => {
    window.addEventListener("utkrix:unauthorized", signOut);
    return () => window.removeEventListener("utkrix:unauthorized", signOut);
  }, [signOut]);

  const value = useMemo(() => ({
    user: session?.user || null,
    token: session?.token || null,
    signIn: ({ token, user }) => {
      const nextSession = { token, user };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      sessionStorage.setItem(TOKEN_KEY, token);
      setSession(nextSession);
    },
    signOut,
  }), [session, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
