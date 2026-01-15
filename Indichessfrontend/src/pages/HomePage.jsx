import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthContext";

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
    <div style={{ padding: 24, display: "grid", gap: 16, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Lobby</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ opacity: 0.9 }}>
            Logged in as <b>{auth.user?.username}</b>
          </span>
          <button
            onClick={async () => {
              await onCancel();
              await auth.logout();
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => begin("STANDARD")} disabled={status === "waiting"} style={{ padding: 10 }}>
          Start Standard (no clock)
        </button>
        <button onClick={() => begin("RAPID")} disabled={status === "waiting"} style={{ padding: 10 }}>
          Start Rapid (10 min)
        </button>
        <button onClick={() => begin("BLITZ")} disabled={status === "waiting"} style={{ padding: 10 }}>
          Start Blitz (3+1)
        </button>
      </div>

      {status === "waiting" ? (
        <div>
          Waiting for opponent ({activeType})…{" "}
          <button onClick={onCancel} style={{ marginLeft: 8 }}>
            Cancel
          </button>
        </div>
      ) : null}

      {status === "timeout" ? <div>No opponent found (timeout). Try again.</div> : null}
      {status === "error" ? <div style={{ color: "#ff9a9a" }}>{error}</div> : null}
    </div>
  );
}


