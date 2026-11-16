import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { postApi } from "../api/client.js";

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
    sessionStorage.removeItem("utkrix-refresh-attempt");
    setSession(null);
    postApi("/auth/logout", {}).catch(() => {});
  }, []);

  useEffect(() => {
    window.addEventListener("utkrix:unauthorized", signOut);
    return () => window.removeEventListener("utkrix:unauthorized", signOut);
  }, [signOut]);

  // Restore a centralized session from the HttpOnly refresh-token cookie.
  // Throttled via sessionStorage so StrictMode double-mounts and quick
  // reloads don't burn through the refresh rate limit.
  useEffect(() => {
    if (session) return;
    const attemptedAt = Number(sessionStorage.getItem("utkrix-refresh-attempt") || 0);
    if (Date.now() - attemptedAt < 60_000) return;
    sessionStorage.setItem("utkrix-refresh-attempt", String(Date.now()));
    postApi("/auth/refresh", {})
      .then((result) => {
        if (result?.accessToken && result?.user) {
          const nextSession = { token: result.accessToken, user: result.user };
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
          sessionStorage.setItem(TOKEN_KEY, result.accessToken);
          setSession(nextSession);
        }
      })
      .catch(() => {});
  }, [session]);

  const value = useMemo(() => ({
    user: session?.user || null,
    token: session?.token || null,
    signIn: ({ token, accessToken, user }) => {
      const resolvedToken = token || accessToken;
      const nextSession = { token: resolvedToken, user };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      sessionStorage.setItem(TOKEN_KEY, resolvedToken);
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
