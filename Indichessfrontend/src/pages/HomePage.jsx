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

async function searchUsers(query) {
  return await apiFetch(`/users/search?query=${encodeURIComponent(query)}`, { method: "GET" });
}

async function sendChallenge(opponentUsername, gameType) {
  return await apiFetch("/game/challenge", {
    method: "POST",
    body: JSON.stringify({ opponentUsername, gameType })
  });
}

async function getIncomingChallenges() {
  return await apiFetch("/game/challenges/incoming", { method: "GET" });
}

async function getOutgoingChallenges() {
  return await apiFetch("/game/challenges/outgoing", { method: "GET" });
}

async function acceptChallenge(challengeId) {
  return await apiFetch(`/game/challenge/${challengeId}/accept`, { method: "POST" });
}

async function declineChallenge(challengeId) {
  return await apiFetch(`/game/challenge/${challengeId}/decline`, { method: "POST" });
}

async function cancelChallenge(challengeId) {
  return await apiFetch(`/game/challenge/${challengeId}/cancel`, { method: "POST" });
}

export function HomePage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [activeType, setActiveType] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | waiting | matched | timeout | error
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const startedAtRef = useRef(null);
  
  // One-on-one play state
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedGameType, setSelectedGameType] = useState("STANDARD");
  const [incomingChallenges, setIncomingChallenges] = useState([]);
  const [outgoingChallenges, setOutgoingChallenges] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);

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

  // Load challenges periodically
  useEffect(() => {
    if (!auth.user) return;
    
    async function loadChallenges() {
      try {
        const [incoming, outgoing] = await Promise.all([
          getIncomingChallenges(),
          getOutgoingChallenges()
        ]);
        setIncomingChallenges(incoming || []);
        setOutgoingChallenges(outgoing || []);
      } catch (e) {
        // Ignore errors
      }
    }
    
    loadChallenges();
    const interval = setInterval(loadChallenges, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [auth.user]);

  // Search users with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      try {
        const results = await searchUsers(searchQuery);
        setSearchResults(results || []);
      } catch (e) {
        setSearchResults([]);
      }
    }, 300);
    
    setSearchTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

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

  async function handleSendChallenge(opponentUsername) {
    try {
      await sendChallenge(opponentUsername, selectedGameType);
      setSearchQuery("");
      setSearchResults([]);
      setShowChallengeModal(false);
      // Refresh challenges
      const [incoming, outgoing] = await Promise.all([
        getIncomingChallenges(),
        getOutgoingChallenges()
      ]);
      setIncomingChallenges(incoming || []);
      setOutgoingChallenges(outgoing || []);
    } catch (e) {
      setError(e.message || "Failed to send challenge");
    }
  }

  async function handleAcceptChallenge(challengeId) {
    try {
      const response = await acceptChallenge(challengeId);
      if (response?.status === "MATCHED" && response.matchId) {
        nav(`/game/${response.matchId}`);
      }
    } catch (e) {
      setError(e.message || "Failed to accept challenge");
    }
  }

  async function handleDeclineChallenge(challengeId) {
    try {
      await declineChallenge(challengeId);
      const incoming = await getIncomingChallenges();
      setIncomingChallenges(incoming || []);
    } catch (e) {
      // Ignore errors
    }
  }

  async function handleCancelChallenge(challengeId) {
    try {
      await cancelChallenge(challengeId);
      const outgoing = await getOutgoingChallenges();
      setOutgoingChallenges(outgoing || []);
    } catch (e) {
      // Ignore errors
    }
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
              className="ic-card group"
              disabled={status === "waiting"}
              onClick={() => nav("/local-game")}
              type="button"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-200">♟</div>
                <div>
                  <div className="ic-card-title">Play 1|1</div>
                  <div className="ic-card-sub">Local two-player game</div>
                </div>
              </div>
              <span className="opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">→</span>
            </button>

            <button
              className="ic-card group"
              disabled={status === "waiting"}
              onClick={() => begin("RAPID")}
              type="button"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-200">10</div>
                <div>
                  <div className="ic-card-title">Play 10 min</div>
                  <div className="ic-card-sub">Rapid matchmaking</div>
                </div>
              </div>
              <span className="opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">→</span>
            </button>

            <button
              className="ic-card group"
              disabled={status === "waiting"}
              onClick={() => begin("STANDARD")}
              type="button"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon group-hover:scale-110 group-hover:bg-green-500/20 transition-all duration-200">∞</div>
                <div>
                  <div className="ic-card-title">New Game</div>
                  <div className="ic-card-sub">Standard (no clock)</div>
                </div>
              </div>
              <span className="opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">→</span>
            </button>

            <button
              className="ic-card group"
              disabled={status === "waiting"}
              onClick={() => begin("BLITZ")}
              type="button"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon group-hover:scale-110 group-hover:bg-orange-500/20 transition-all duration-200">3</div>
                <div>
                  <div className="ic-card-title">Play Blitz</div>
                  <div className="ic-card-sub">3+1 matchmaking</div>
                </div>
              </div>
              <span className="opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">→</span>
            </button>

            <button
              className="ic-card group"
              disabled={status === "waiting"}
              onClick={() => setShowChallengeModal(true)}
              type="button"
            >
              <div className="ic-card-left">
                <div className="ic-card-icon group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-200">🤝</div>
                <div>
                  <div className="ic-card-title">Play a Friend</div>
                  <div className="ic-card-sub">Challenge someone directly</div>
                </div>
              </div>
              <span className="opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">→</span>
            </button>
          </div>

          {status === "waiting" ? (
            <div className="ic-home-status bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-3 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                <div>
                  <div className="font-semibold">Waiting for opponent</div>
                  <div className="text-sm opacity-80">Game type: <b>{activeType}</b></div>
                </div>
              </div>
              <button
                className="ic-home-btn ic-home-btn-primary hover:scale-105 active:scale-95 transition-transform duration-200"
                onClick={onCancel}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : null}

          {status === "timeout" ? (
            <div className="ic-home-status bg-yellow-500/10 border-yellow-500/30 animate-slide-up">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏱️</span>
                <div>
                  <div className="font-semibold">No opponent found</div>
                  <div className="text-sm opacity-80">Timeout reached. Try again.</div>
                </div>
              </div>
              <button
                className="ic-home-btn hover:scale-105 active:scale-95 transition-transform duration-200"
                onClick={() => setStatus("idle")}
                type="button"
              >
                OK
              </button>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="ic-home-status bg-red-500/10 border-red-500/30 animate-slide-up">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <div className="text-red-300 font-medium">{error}</div>
              </div>
              <button
                className="ic-home-btn hover:scale-105 active:scale-95 transition-transform duration-200"
                onClick={() => setStatus("idle")}
                type="button"
              >
                OK
              </button>
            </div>
          ) : null}

          {/* Incoming Challenges */}
          {incomingChallenges.length > 0 && (
            <div className="ic-home-status bg-green-500/10 border-green-500/30 animate-slide-up">
              <div className="flex flex-col gap-2">
                <div className="font-semibold text-green-300">Incoming Challenges</div>
                {incomingChallenges.map((challenge) => (
                  <div key={challenge.challengeId} className="flex items-center justify-between gap-3 p-2 bg-white/5 rounded-lg">
                    <div>
                      <div className="font-medium">{challenge.fromUsername}</div>
                      <div className="text-sm opacity-70">{challenge.gameType}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="ic-home-btn ic-home-btn-primary text-sm py-1 px-3"
                        onClick={() => handleAcceptChallenge(challenge.challengeId)}
                        type="button"
                      >
                        Accept
                      </button>
                      <button
                        className="ic-home-btn text-sm py-1 px-3"
                        onClick={() => handleDeclineChallenge(challenge.challengeId)}
                        type="button"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing Challenges */}
          {outgoingChallenges.length > 0 && (
            <div className="ic-home-status bg-blue-500/10 border-blue-500/30 animate-slide-up">
              <div className="flex flex-col gap-2">
                <div className="font-semibold text-blue-300">Outgoing Challenges</div>
                {outgoingChallenges.map((challenge) => (
                  <div key={challenge.challengeId} className="flex items-center justify-between gap-3 p-2 bg-white/5 rounded-lg">
                    <div>
                      <div className="font-medium">{challenge.toUsername}</div>
                      <div className="text-sm opacity-70">{challenge.gameType}</div>
                    </div>
                    <button
                      className="ic-home-btn text-sm py-1 px-3"
                      onClick={() => handleCancelChallenge(challenge.challengeId)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Challenge Modal */}
      {showChallengeModal && (
        <div
          onClick={() => setShowChallengeModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-chess-card border border-white/15 rounded-2xl p-6 w-96 shadow-2xl animate-slide-up max-h-[80vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-4 text-chess-text">Challenge a Friend</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-chess-text/90">Game Type</label>
              <select
                value={selectedGameType}
                onChange={(e) => setSelectedGameType(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-chess-text focus:outline-none focus:border-white/30"
              >
                <option value="STANDARD">Standard (no clock)</option>
                <option value="RAPID">Rapid (10 min)</option>
                <option value="BLITZ">Blitz (3+1)</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-chess-text/90">Search User</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter username..."
                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-chess-text placeholder-chess-text/50 focus:outline-none focus:border-white/30"
                autoFocus
              />
              
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.userId}
                      onClick={() => handleSendChallenge(user.username)}
                      className="w-full text-left px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-200 text-chess-text"
                      type="button"
                    >
                      {user.username}
                    </button>
                  ))}
                </div>
              )}
              
              {searchQuery && searchResults.length === 0 && (
                <div className="mt-2 text-sm text-chess-text/70">No users found</div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowChallengeModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-200 font-semibold text-chess-text"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


