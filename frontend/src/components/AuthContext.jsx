import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as authApi from "../services/authService.js";
import { getErrorMessage } from "../services/client.js";

const AuthContext = createContext(null);
const GUEST_KEY = "fuelwise_guest";

/**
 * status: "loading" | "authenticated" | "guest" | "anonymous"
 * The REAL session lives in an httpOnly cookie checked by the backend (GET /auth/me).
 * "guest" is only a screen mode: the backend still treats a guest as not signed in.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null, notice: "", bootError: "" });
  const statusRef = useRef("loading");

  const apply = useCallback((next) => {
    statusRef.current = next.status;
    setState((s) => ({ ...s, notice: "", bootError: "", ...next }));
  }, []);

  const refreshUser = useCallback(async () => {
    try { apply({ status: "authenticated", user: await authApi.me() }); } catch { /* keep current state */ }
  }, [apply]);

  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then((user) => !cancelled && apply({ status: "authenticated", user }))
      .catch((err) => {
        if (cancelled) return;
        const guest = sessionStorage.getItem(GUEST_KEY) === "1";
        apply({ status: guest ? "guest" : "anonymous", user: null, bootError: err?.response?.status === 401 ? "" : getErrorMessage(err) });
      });
    return () => { cancelled = true; };
  }, [apply]);

  useEffect(() => {
    const onExpired = () => {
      if (statusRef.current === "authenticated") apply({ status: "anonymous", user: null, notice: "Your session has ended. Please sign in again." });
    };
    window.addEventListener("fuelwise:unauthorized", onExpired);
    return () => window.removeEventListener("fuelwise:unauthorized", onExpired);
  }, [apply]);

  const value = useMemo(() => ({
    ...state,
    isUser: state.status === "authenticated",
    isGuest: state.status === "guest",
    isAdmin: state.user?.role === "admin",
    refreshUser,
    async signIn(email, password, remember) {
      const user = await authApi.login({ email, password, remember });
      sessionStorage.removeItem(GUEST_KEY);
      apply({ status: "authenticated", user });
      return user;
    },
    async signUp(body) {
      const user = await authApi.register(body);
      sessionStorage.removeItem(GUEST_KEY);
      apply({ status: "authenticated", user });
      return user;
    },
    async signOut() {
      try { await authApi.logout(); } catch { /* the cookie is cleared by the server when reachable */ }
      sessionStorage.removeItem(GUEST_KEY);
      apply({ status: "anonymous", user: null });
    },
    continueAsGuest() {
      sessionStorage.setItem(GUEST_KEY, "1");
      apply({ status: "guest", user: null });
    },
  }), [state, apply, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
