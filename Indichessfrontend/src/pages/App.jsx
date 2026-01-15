import React, { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { HomePage } from "./HomePage";
import { GamePage } from "./GamePage";

function RequireAuth({ children }) {
  const auth = useAuth();
  const loc = useLocation();
  if (auth.status === "loading") {
    return (
      <div style={{ padding: 24 }}>
        <h2>Loading…</h2>
      </div>
    );
  }
  if (auth.status !== "authed") {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

function RedirectIfAuthed({ children }) {
  const auth = useAuth();
  if (auth.status === "loading") return null;
  if (auth.status === "authed") return <Navigate to="/home" replace />;
  return children;
}

function LoginPage() {
  const auth = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await auth.login(username, password);
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            autoComplete="current-password"
          />
        </label>
        {err ? <div style={{ color: "#ff9a9a" }}>{err}</div> : null}
        <button disabled={submitting} style={{ padding: 10 }}>
          {submitting ? "Logging in…" : "Login"}
        </button>
      </form>
      <div style={{ marginTop: 12 }}>
        No account? <Link to="/signup">Create one</Link>
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <a href="http://localhost:8080/oauth2/authorization/google">Continue with Google</a>
      </div>
    </div>
  );
}

function SignupPage() {
  const auth = useAuth();
  const [username, setUsername] = useState("");
  const [emailId, setEmailId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await auth.signup(username, emailId, password);
    } catch (e2) {
      setErr(e2.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Signup</h2>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            autoComplete="username"
          />
        </label>
        <label>
          Email
          <input
            value={emailId}
            onChange={(e) => setEmailId(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            autoComplete="new-password"
          />
        </label>
        {err ? <div style={{ color: "#ff9a9a" }}>{err}</div> : null}
        <button disabled={submitting} style={{ padding: 10 }}>
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>
      <div style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Login</Link>
      </div>
    </div>
  );
}

function NotFound() {
  const loc = useLocation();
  return (
    <div style={{ padding: 24 }}>
      <h2>Not found</h2>
      <pre>{loc.pathname}</pre>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfAuthed>
              <SignupPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/game/:matchId"
          element={
            <RequireAuth>
              <GamePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}


