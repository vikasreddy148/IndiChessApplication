import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "../styles/home.css";

async function startMatch(gameType) {
  return await apiFetch("/game", {
    method: "POST",
    body: JSON.stringify({ gameType })
  });
}

async function checkMatch(gameType) {
  const qp = gameType ? `?type=${encodeURIComponent(gameType)}` : "";
  return await apiFetch(`/game/check-match${qp}`, { method: "GET" });
}

async function cancelWaiting(gameType) {
  const qp = gameType ? `?type=${encodeURIComponent(gameType)}` : "";
  return await apiFetch(`/game/cancel-waiting${qp}`, { method: "POST" });
}

export function HomePage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [activeType, setActiveType] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | waiting | matched | timeout | error
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const startedAtRef = useRef(null);

  async function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => {
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function begin(gameType) {
    setError(null);
    setActiveType(gameType);
    setStatus("waiting");
    startedAtRef.current = Date.now();

    try {
      const res = await startMatch(gameType);
      if (res?.status === "MATCHED" && res.matchId) {
        setStatus("matched");
        await stopPolling();
        nav(`/game/${res.matchId}`);
        return;
      }
    } catch (e) {
      setStatus("error");
      setError(e.message || "Failed to start match");
      return;
    }

    await stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const elapsed = Date.now() - startedAtRef.current;
        if (elapsed > 95_000) {
          // defensive: backend timeout is 90s
          setStatus("timeout");
          await stopPolling();
          return;
        }

        const res = await checkMatch(gameType);
        if (res?.status === "MATCHED" && res.matchId) {
          setStatus("matched");
          await stopPolling();
          nav(`/game/${res.matchId}`);
        } else if (res?.status === "TIMEOUT") {
          setStatus("timeout");
          await stopPolling();
        } else {
          setStatus("waiting");
        }
      } catch (e) {
        setStatus("error");
        setError(e.message || "Polling failed");
        await stopPolling();
      }
    }, 2000);
  }

  async function onCancel() {
    setError(null);
    try {
      await cancelWaiting(activeType);
    } catch (e) {
      // ignore cancel failures for now
    }
    await stopPolling();
    setStatus("idle");
    setActiveType(null);
  }

  return (
    <div className="ic-home">
      <aside className="ic-home-sidebar">
        <div className="ic-home-brand">
          <div className="ic-home-brand-mark" />
          <div>IndiChess</div>
        </div>

        <div className="ic-home-nav">
          <button className="ic-home-navbtn" type="button">
            <span className="ic-home-dot" /> <span>Play</span>
          </button>
          <button className="ic-home-navbtn" type="button">
            <span className="ic-home-dot" /> <span>Puzzles</span>
          </button>
          <button className="ic-home-navbtn" type="button">
            <span className="ic-home-dot" /> <span>Learn</span>
          </button>
          <button className="ic-home-navbtn" type="button">
            <span className="ic-home-dot" /> <span>Watch</span>
          </button>
          <button className="ic-home-navbtn" type="button">
            <span className="ic-home-dot" /> <span>News</span>
          </button>
        </div>

        <div className="ic-home-sidecard">
          <div className="ic-home-search">
            <input className="ic-home-input" placeholder="Search" />
            <button className="ic-home-btn" type="button">
              Go
            </button>
          </div>
        </div>

        <div className="ic-home-sidecard">
          <div style={{ opacity: 0.9 }}>
            Signed in as <b>{auth.user?.username}</b>
          </div>
          <button
            className="ic-home-btn"
            onClick={async () => {
              await onCancel();
              await auth.logout();
              nav("/login");
            }}
            type="button"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="ic-home-main">
        <div className="ic-home-mainwrap">
          <div className="ic-home-profile">
            <div className="ic-home-avatar" />
            <div>
              <div className="ic-home-username">{auth.user?.username}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Ready to play</div>
            </div>
          </div>

          <div className="ic-home-cards">
            <button
              className="ic-card"
              disabled={status === "waiting"}
              onClick={() => begin("RAPID")}
              type="button"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon">10</div>
                <div>
                  <div className="ic-card-title">Play 10 min</div>
                  <div className="ic-card-sub">Rapid matchmaking</div>
                </div>
              </div>
              <span style={{ opacity: 0.7 }}>→</span>
            </button>

            <button
              className="ic-card"
              disabled={status === "waiting"}
              onClick={() => begin("STANDARD")}
              type="button"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon">∞</div>
                <div>
                  <div className="ic-card-title">New Game</div>
                  <div className="ic-card-sub">Standard (no clock)</div>
                </div>
              </div>
              <span style={{ opacity: 0.7 }}>→</span>
            </button>

            <button
              className="ic-card"
              disabled={status === "waiting"}
              onClick={() => begin("BLITZ")}
              type="button"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon">3</div>
                <div>
                  <div className="ic-card-title">Play Blitz</div>
                  <div className="ic-card-sub">3+1 matchmaking</div>
                </div>
              </div>
              <span style={{ opacity: 0.7 }}>→</span>
            </button>

            <button
              className="ic-card"
              disabled
              type="button"
              title="Coming soon"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon">🤝</div>
                <div>
                  <div className="ic-card-title">Play a Friend</div>
                  <div className="ic-card-sub">Invite link (coming soon)</div>
                </div>
              </div>
              <span style={{ opacity: 0.4 }}>→</span>
            </button>
          </div>

          {status === "waiting" ? (
            <div className="ic-home-status">
              <div>
                Waiting for opponent (<b>{activeType}</b>)…
              </div>
              <button className="ic-home-btn ic-home-btn-primary" onClick={onCancel} type="button">
                Cancel
              </button>
            </div>
          ) : null}

          {status === "timeout" ? (
            <div className="ic-home-status">
              <div>No opponent found (timeout). Try again.</div>
              <button className="ic-home-btn" onClick={() => setStatus("idle")} type="button">
                OK
              </button>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="ic-home-status">
              <div style={{ color: "#ffb3b3" }}>{error}</div>
              <button className="ic-home-btn" onClick={() => setStatus("idle")} type="button">
                OK
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}


