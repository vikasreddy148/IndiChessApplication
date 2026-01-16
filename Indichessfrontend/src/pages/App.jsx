import React, { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { HomePage } from "./HomePage";
import { GamePage } from "./GamePage";
import { LocalGamePage } from "./LocalGamePage";
import { LandingPage } from "./LandingPage";
import "../styles/auth.css";

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
    <div className="ic-auth">
      <div className="ic-auth-card">
        <div className="ic-auth-header">
          <div className="ic-auth-brand">
            <div className="ic-auth-mark" />
            <h2 className="ic-auth-title">Welcome back</h2>
          </div>
          <Link className="ic-link" to="/">
            Home
          </Link>
        </div>
        <p className="ic-auth-subtitle">Login to start matchmaking and continue your games.</p>

        <form onSubmit={onSubmit} className="ic-form">
          <div className="ic-field">
            <div className="ic-label">Username</div>
            <input
              className="ic-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Your username"
            />
          </div>
          <div className="ic-field">
            <div className="ic-label">Password</div>
            <input
              className="ic-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {err ? <div className="ic-error">{err}</div> : null}

          <button disabled={submitting} className="ic-btn ic-btn-primary" type="submit">
            {submitting ? "Logging in…" : "Login"}
          </button>

          <div className="ic-divider">or</div>

          <a className="ic-btn ic-btn-secondary" href="http://localhost:8080/oauth2/authorization/google">
            Continue with Google
          </a>
        </form>

        <div className="ic-auth-footer">
          No account?{" "}
          <Link className="ic-link" to="/signup">
            Create one
          </Link>
        </div>
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
    <div className="ic-auth">
      <div className="ic-auth-card">
        <div className="ic-auth-header">
          <div className="ic-auth-brand">
            <div className="ic-auth-mark" />
            <h2 className="ic-auth-title">Create your account</h2>
          </div>
          <Link className="ic-link" to="/">
            Home
          </Link>
        </div>
        <p className="ic-auth-subtitle">Sign up to play Standard, Rapid, and Blitz matches.</p>

        <form onSubmit={onSubmit} className="ic-form">
          <div className="ic-field">
            <div className="ic-label">Username</div>
            <input
              className="ic-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Pick a username"
            />
          </div>
          <div className="ic-field">
            <div className="ic-label">Email</div>
            <input
              className="ic-input"
              value={emailId}
              onChange={(e) => setEmailId(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="ic-field">
            <div className="ic-label">Password</div>
            <input
              className="ic-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Minimum 6 characters"
            />
          </div>

          {err ? <div className="ic-error">{err}</div> : null}

          <button disabled={submitting} className="ic-btn ic-btn-primary" type="submit">
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="ic-auth-footer">
          Already have an account?{" "}
          <Link className="ic-link" to="/login">
            Login
          </Link>
        </div>
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
        <Route
          path="/"
          element={
            <RedirectIfAuthed>
              <LandingPage />
            </RedirectIfAuthed>
          }
        />
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
        <Route
          path="/local-game"
          element={
            <RequireAuth>
              <LocalGamePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}


