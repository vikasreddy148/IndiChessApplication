import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiLogin, apiLogout, apiMe, apiSignup } from "../api/auth";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthContext missing");
  return ctx;
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading"); // loading | authed | guest
  const [user, setUser] = useState(null);

  async function refresh() {
    try {
      const me = await apiMe();
      if (me?.authenticated) {
        setUser({ username: me.username });
        setStatus("authed");
      } else {
        setUser(null);
        setStatus("guest");
      }
    } catch {
      setUser(null);
      setStatus("guest");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      refresh,
      async login(username, password) {
        await apiLogin({ username, password });
        await refresh();
      },
      async signup(username, emailId, password) {
        await apiSignup({ username, emailId, password });
        await apiLogin({ username, password });
        await refresh();
      },
      async logout() {
        await apiLogout();
        await refresh();
      }
    }),
    [status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


