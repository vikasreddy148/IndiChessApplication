import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { createStompClient } from "../ws/stompClient";
import { applyMove, initialStateFromBoard, parseFEN, toFEN } from "../chess/state";
import { legalMovesForSquare, detectGameEndBasic } from "../chess/legalMoves";
import { pieceColor } from "../chess/board";
import { useAuth } from "../auth/AuthContext";
import "../styles/gamepage.css";

const PIECES = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟"
};

function isWhitePiece(p) {
  return p && p.toUpperCase() === p;
}
function isBlackPiece(p) {
  return p && p.toLowerCase() === p;
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function Board({ board, selected, legalTargets, onSquareClick, orientation }) {
  // Render using display coordinates (dr,dc) and map to actual board coordinates.
  // This avoids mismatches where we flip rows but not columns (or vice versa).
  const isBlack = orientation === "black";
  const ranks = isBlack ? ["1", "2", "3", "4", "5", "6", "7", "8"] : ["8", "7", "6", "5", "4", "3", "2", "1"];
  const files = isBlack ? ["h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h"];

  return (
    <div className="ig-boardframe">
      <div className="ig-coords-ranks">
        {ranks.map((r) => (
          <div key={r}>{r}</div>
        ))}
      </div>
      <div className="ig-boardgrid">
      {Array.from({ length: 8 }).map((_, dr) =>
        Array.from({ length: 8 }).map((__, dc) => {
          const rowIndex = isBlack ? 7 - dr : dr;
          const colIndex = isBlack ? 7 - dc : dc;
          const piece = board[rowIndex][colIndex];

          // Use actual coordinates for coloring so a1 stays dark.
          const isDark = (rowIndex + colIndex) % 2 === 1;
          const isSel = selected && selected.row === rowIndex && selected.col === colIndex;
          const isTarget = legalTargets?.some((t) => t.row === rowIndex && t.col === colIndex);

          return (
            <button
              key={`${dr}-${dc}`}
              onClick={() => onSquareClick(rowIndex, colIndex)}
              className={[
                "ig-sq",
                isDark ? "dark" : "light",
                isSel ? "selected" : "",
                isTarget ? "target" : ""
              ].join(" ")}
            >
              {PIECES[piece] || ""}
            </button>
          );
        })
      )}
      </div>
      <div className="ig-coords-files">
        {files.map((f) => (
          <div key={f}>{f}</div>
        ))}
      </div>
    </div>
  );
}

function PromotionModal({ open, color, onPick, onClose }) {
  if (!open) return null;
  const opts = color === "white" ? ["Q", "R", "B", "N"] : ["q", "r", "b", "n"];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 50
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          padding: 16,
          width: 320
        }}
      >
        <h3 style={{ marginTop: 0 }}>Promote pawn</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {opts.map((p) => (
            <button key={p} onClick={() => onPick(p)} style={{ padding: 10, width: 64 }}>
              {PIECES[p] || p}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DrawOfferModal({ open, from, onAccept, onClose }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 60
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          padding: 16,
          width: 360
        }}
      >
        <h3 style={{ marginTop: 0 }}>Draw offer</h3>
        <div style={{ marginBottom: 12 }}>{from ? <b>{from}</b> : "Opponent"} offered a draw.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onAccept} style={{ padding: 10 }}>
            Accept
          </button>
          <button onClick={onClose} style={{ padding: 10 }}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

export function GamePage() {
  const { matchId } = useParams();
  const nav = useNavigate();
  const auth = useAuth();
  const [state, setState] = useState(null); // chess state (board + turn + rights)
  const [playerColor, setPlayerColor] = useState(null); // "white" | "black"
  const [myTurn, setMyTurn] = useState(false);
  const [moves, setMoves] = useState([]);
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [error, setError] = useState(null);
  const [gameEnd, setGameEnd] = useState(null);
  const [promotion, setPromotion] = useState({ open: false, from: null, to: null, choices: null });
  const [drawOffer, setDrawOffer] = useState({ open: false, from: null });
  const [statusText, setStatusText] = useState(null);

  const stompRef = useRef(null);
  const connectedRef = useRef(false);

  const orientation = useMemo(() => (playerColor === "black" ? "black" : "white"), [playerColor]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      const game = await apiFetch(`/api/games/${matchId}`, { method: "GET" });
      if (cancelled) return;

      // NOTE: Backend DTO booleans can serialize as "myTurn" or "isMyTurn" depending on getters.
      const nextMyTurn = Boolean(game?.myTurn ?? game?.isMyTurn);
      setMyTurn(nextMyTurn);
      setPlayerColor(game?.playerColor || null);
      const fen = game?.fen || null;
      const parsed = fen ? parseFEN(fen) : null;
      const nextState = parsed && parsed.board ? parsed : initialStateFromBoard(game?.board || null);
      // If backend gave board but fen parse failed, fall back
      if (!nextState?.board) {
        setState(null);
      } else {
        setState(nextState);
        setGameEnd(detectGameEndBasic(nextState));
      }
    }
    load().catch((e) => setError(e.message || "Failed to load game"));
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;

    const client = createStompClient();
    stompRef.current = client;
    connectedRef.current = false;

    client.onConnect = () => {
      connectedRef.current = true;

      client.subscribe(`/topic/moves/${matchId}`, (msg) => {
        try {
          const payload = JSON.parse(msg.body);
          if (payload?.board) {
            setState((prev) => {
              if (!prev) return initialStateFromBoard(payload.board);
              // Prefer fenAfter from payload if present (best for rights/turn/ep)
              const next = payload?.fenAfter ? parseFEN(payload.fenAfter) : null;
              if (next && next.board) return next;
              // Otherwise keep previous rights but replace board + flip turn based on payload
              return { ...prev, board: payload.board, turn: payload?.isWhiteTurn ? "w" : "b" };
            });
          }
          if (typeof payload?.isWhiteTurn === "boolean") {
            const isWhiteTurn = payload.isWhiteTurn;
            const amWhite = playerColor === "white";
            setMyTurn((amWhite && isWhiteTurn) || (!amWhite && !isWhiteTurn));
          }
          if (payload?.moveNotation) {
            setMoves((prev) => [...prev, payload.moveNotation]);
          }
          setSelected(null);
          setLegalTargets([]);
          setGameEnd((prevEnd) => prevEnd); // will recompute in separate effect
        } catch {
          // ignore
        }
      });

      client.subscribe(`/topic/game-state/${matchId}`, (msg) => {
        try {
          const payload = JSON.parse(msg.body);
          // Possible payloads:
          // - { type: "RESIGNATION", player, matchId, ... }
          // - GameStatusDTO { status: "RESIGNED", ... }
          // - { type: "DRAW_ACCEPTED", status: "DRAW", ... }
          if (payload?.type === "RESIGNATION") {
            setStatusText(`${payload.player} resigned`);
            setGameEnd({ over: true, result: "ended", reason: "resignation" });
            return;
          }
          if (payload?.status === "RESIGNED") {
            setStatusText("Game ended by resignation");
            setGameEnd({ over: true, result: "ended", reason: "resignation" });
            return;
          }
          if (payload?.type === "DRAW_ACCEPTED" || payload?.status === "DRAW") {
            setStatusText("Draw agreed");
            setGameEnd({ over: true, result: "draw", reason: "draw" });
            return;
          }
        } catch {
          // ignore
        }
      });

      // Draw offers are delivered to the opponent's user queue by backend
      client.subscribe(`/user/queue/draw-offers`, (msg) => {
        try {
          const payload = JSON.parse(msg.body);
          if (payload?.type === "DRAW_OFFER") {
            setDrawOffer({ open: true, from: payload.from || null });
          }
        } catch {
          // ignore
        }
      });

      // Join (server uses Principal from cookie-auth handshake)
      client.publish({
        destination: `/app/game/${matchId}/join`,
        body: JSON.stringify({
          type: "JOIN",
          playerColor,
          timestamp: new Date().toISOString()
        })
      });
    };

    client.onStompError = () => {
      setError("WebSocket error");
    };
    client.onWebSocketError = () => {
      setError("WebSocket error");
    };

    client.activate();

    return () => {
      try {
        client.deactivate();
      } catch {
        // ignore
      }
    };
  }, [matchId, playerColor]);

  useEffect(() => {
    if (!state) return;
    setGameEnd(detectGameEndBasic(state));
  }, [state]);

  function onSquareClick(row, col) {
    if (!state?.board) return;
    if (!playerColor) return;

    const board = state.board;
    const piece = board[row][col];
    const amWhite = playerColor === "white";

    if (!selected) {
      if (!piece) return;
      if (amWhite && !isWhitePiece(piece)) return;
      if (!amWhite && !isBlackPiece(piece)) return;
      setSelected({ row, col });
      const legal = legalMovesForSquare(state, row, col);
      setLegalTargets(legal.map((m) => ({ row: m.toRow, col: m.toCol })));
      return;
    }

    // same square = deselect
    if (selected.row === row && selected.col === col) {
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    if (!myTurn) {
      setError("Not your turn");
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    const fromRow = selected.row;
    const fromCol = selected.col;
    const movingPiece = board[fromRow][fromCol];
    if (!movingPiece) {
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    // validate target square is legal
    const legal = legalMovesForSquare(state, fromRow, fromCol);
    const candidates = legal.filter((m) => m.toRow === row && m.toCol === col);
    if (candidates.length === 0) {
      setError("Illegal move");
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    // Promotion requires user selection (4 candidate moves with different promotedTo)
    const hasPromotion = candidates.some((m) => m.isPromotion);
    if (hasPromotion) {
      setPromotion({ open: true, from: { row: fromRow, col: fromCol }, to: { row, col }, choices: candidates });
      return;
    }

    const chosen = candidates[0];
    commitMove(chosen);
  }

  function commitMove(mv) {
    const board = state.board;
    const movingPiece = board[mv.fromRow][mv.fromCol];
    const capturedPiece = board[mv.toRow][mv.toCol] || "";

    // Optimistic local update; authoritative sync comes from WS broadcast
    const fenBefore = toFEN(state);
    const nextState = applyMove(state, mv);
    const fenAfter = toFEN(nextState);
    setState(nextState);
    setMyTurn(false);
    setSelected(null);
    setLegalTargets([]);
    setError(null);
    setPromotion({ open: false, from: null, to: null, choices: null });

    const client = stompRef.current;
    if (!client || !connectedRef.current) {
      setError("WebSocket not connected");
      return;
    }

    client.publish({
      destination: `/app/game/${matchId}/move`,
      body: JSON.stringify({
        fromRow: mv.fromRow,
        fromCol: mv.fromCol,
        toRow: mv.toRow,
        toCol: mv.toCol,
        piece: movingPiece,
        playerColor,
        capturedPiece,
        castled: Boolean(mv.castled),
        isEnPassant: Boolean(mv.isEnPassant),
        isPromotion: Boolean(mv.isPromotion),
        promotedTo: mv.promotedTo ?? null,
        fenBefore,
        fenAfter,
        board: nextState.board,
        isWhiteTurn: null,
        matchId: Number(matchId),
        timestamp: new Date().toISOString()
      })
    });
  }

  return (
    <div className="ig-game">
      <PromotionModal
        open={promotion.open}
        color={playerColor}
        onClose={() => setPromotion({ open: false, from: null, to: null, choices: null })}
        onPick={(p) => {
          const mv = (promotion.choices || []).find((m) => m.promotedTo === p);
          if (mv) commitMove(mv);
        }}
      />
      <DrawOfferModal
        open={drawOffer.open}
        from={drawOffer.from}
        onClose={() => setDrawOffer({ open: false, from: null })}
        onAccept={() => {
          const client = stompRef.current;
          if (!client || !connectedRef.current) {
            setError("WebSocket not connected");
            return;
          }
          client.publish({
            destination: `/app/game/${matchId}/draw/accept`,
            body: JSON.stringify({ type: "DRAW_ACCEPT", matchId: Number(matchId), timestamp: new Date().toISOString() })
          });
          setDrawOffer({ open: false, from: null });
        }}
      />
      <div className="ig-shell">
        <aside className="ig-sidebar">
          <div className="ig-brand">
            <div className="ig-brand-mark" />
            <div>IndiChess</div>
          </div>

          <div className="ig-nav">
            <button className="ig-navbtn" type="button" onClick={() => nav("/home")}>
              <span className="ig-dot" /> <span>Home</span>
            </button>
            <button className="ig-navbtn" type="button">
              <span className="ig-dot" /> <span>Play</span>
            </button>
            <button className="ig-navbtn" type="button">
              <span className="ig-dot" /> <span>Puzzles</span>
            </button>
            <button className="ig-navbtn" type="button">
              <span className="ig-dot" /> <span>Learn</span>
            </button>
          </div>

          <div className="ig-sidecard">
            <div className="ig-row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, opacity: 0.9 }}>Signed in</span>
              <span className="ig-pill">{auth.user?.username || "…"}</span>
            </div>
            <div className="ig-row">
              <button
                className="ig-btn ig-btn-primary"
                type="button"
                onClick={() => {
                  let type = null;
                  try {
                    type = localStorage.getItem("lastGameType");
                  } catch {
                    type = null;
                  }
                  if (!type) type = "STANDARD";
                  nav(`/home?start=${encodeURIComponent(type)}`);
                }}
                title="Start a new match in the same mode"
              >
                Rematch
              </button>
              <button
                className="ig-btn"
                type="button"
                onClick={async () => {
                  try {
                    await auth.logout();
                  } finally {
                    nav("/login");
                  }
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        <main className="ig-center">
          <div className="ig-card ig-playerbar">
            <div className="ig-player-left">
              <div className="ig-avatar" />
              <div>
                <div className="ig-player-name">Opponent</div>
                <div className="ig-player-sub">{playerColor === "white" ? "Black" : "White"}</div>
              </div>
            </div>
            <div className="ig-pill">{myTurn ? "Your move" : "Waiting"}</div>
          </div>

          {gameEnd?.over ? (
            <div className="ig-status">
              Game over: <b>{gameEnd.reason}</b> ({gameEnd.result})
            </div>
          ) : null}
          {statusText ? <div className="ig-status">{statusText}</div> : null}
          {error ? <div className="ig-error">{error}</div> : null}

          <div className="ig-card ig-boardwrap">
            {state?.board ? (
              <Board
                board={state.board}
                selected={selected}
                legalTargets={legalTargets}
                onSquareClick={onSquareClick}
                orientation={orientation}
              />
            ) : (
              <div style={{ padding: 12 }}>Loading board…</div>
            )}
          </div>

          <div className="ig-card ig-playerbar">
            <div className="ig-player-left">
              <div className="ig-avatar" />
              <div>
                <div className="ig-player-name">{auth.user?.username || "You"}</div>
                <div className="ig-player-sub">{playerColor || "…"}</div>
              </div>
            </div>
            <div className="ig-pill">Game #{matchId}</div>
          </div>
        </main>

        <aside className="ig-right">
          <div className="ig-card">
            <div className="ig-panel-title">Move Explorer</div>
            <div className="ig-moves">
              {moves.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No moves yet</div>
              ) : (
                Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
                  const whiteMove = moves[i * 2];
                  const blackMove = moves[i * 2 + 1];
                  return (
                    <div className="ig-move-row" key={i}>
                      <div className="ig-move-no">{i + 1}.</div>
                      <div className="ig-move">{whiteMove || ""}</div>
                      <div className="ig-move">{blackMove || ""}</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="ig-actions">
              <button
                className="ig-action"
                disabled={Boolean(gameEnd?.over)}
                onClick={() => {
                  const client = stompRef.current;
                  if (!client || !connectedRef.current) {
                    setError("WebSocket not connected");
                    return;
                  }
                  client.publish({
                    destination: `/app/game/${matchId}/draw`,
                    body: JSON.stringify({ type: "DRAW_OFFER", matchId: Number(matchId), timestamp: new Date().toISOString() })
                  });
                  setStatusText("Draw offer sent");
                }}
              >
                🤝 Draw
              </button>
              <button className="ig-action" onClick={() => nav("/home")}>
                🏠 Home
              </button>
              <button
                className="ig-action ig-action-danger"
                disabled={Boolean(gameEnd?.over)}
                onClick={() => {
                  const client = stompRef.current;
                  if (!client || !connectedRef.current) {
                    setError("WebSocket not connected");
                    return;
                  }
                  client.publish({
                    destination: `/app/game/${matchId}/resign`,
                    body: JSON.stringify({ type: "RESIGN", matchId: Number(matchId), timestamp: new Date().toISOString() })
                  });
                  setStatusText("You resigned");
                  setGameEnd({ over: true, result: "ended", reason: "resignation" });
                }}
              >
                🏳️ Resign
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}


