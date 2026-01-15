import React from "react";
import { Link } from "react-router-dom";
import "../styles/landing.css";

function SidebarItem({ label }) {
  return (
    <button className="ic-side-item" type="button">
      <span className="ic-side-dot" />
      <span>{label}</span>
    </button>
  );
}

function BoardPreview() {
  return (
    <div className="ic-board">
      {Array.from({ length: 8 }).map((_, r) =>
        Array.from({ length: 8 }).map((__, c) => {
          const dark = (r + c) % 2 === 1;
          return (
            <div
              key={`${r}-${c}`}
              className={dark ? "ic-board-sq dark" : "ic-board-sq light"}
            />
          );
        })
      )}
      <div className="ic-board-glow" />
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="ic-landing">
      <aside className="ic-sidebar">
        <div className="ic-brand">
          <div className="ic-brand-mark" />
          <div className="ic-brand-text">IndiChess</div>
        </div>

        <nav className="ic-side-nav">
          <SidebarItem label="Play" />
          <SidebarItem label="Puzzles" />
          <SidebarItem label="Learn" />
          <SidebarItem label="Watch" />
          <SidebarItem label="News" />
          <SidebarItem label="Social" />
          <SidebarItem label="More" />
        </nav>

        <div className="ic-side-search">
          <input className="ic-input" placeholder="Search" />
          <button className="ic-btn ic-btn-ghost" type="button">
            Go
          </button>
        </div>

        <div className="ic-side-actions">
          <Link className="ic-btn ic-btn-primary" to="/signup">
            Sign Up
          </Link>
          <Link className="ic-btn ic-btn-secondary" to="/login">
            Log In
          </Link>
        </div>

        <div className="ic-side-footer">
          <span>English</span>
          <span>Support</span>
        </div>
      </aside>

      <main className="ic-main">
        <div className="ic-hero-card">
          <div className="ic-hero-left">
            <BoardPreview />
          </div>

          <div className="ic-hero-right">
            <h1 className="ic-title">
              Play Chess Online
              <br />
              on IndiChess
            </h1>
            <p className="ic-subtitle">
              Match instantly, play smoothly, and improve with analysis and puzzles.
            </p>
            <div className="ic-cta-row">
              <Link className="ic-btn ic-btn-primary ic-btn-lg" to="/signup">
                Get Started
              </Link>
              <Link className="ic-btn ic-btn-ghost ic-btn-lg" to="/login">
                I already have an account
              </Link>
            </div>
            <div className="ic-hero-note">
              Tip: Login with Google is available from the login screen.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


