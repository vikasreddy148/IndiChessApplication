import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { createStompClient } from "../ws/stompClient";
import { applyMove, initialStateFromBoard, parseFEN, toFEN } from "../chess/state";
import { legalMovesForSquare, detectGameEndBasic } from "../chess/legalMoves";
import { pieceColor } from "../chess/board";
import { useAuth } from "../auth/AuthContext";

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
  const rows = orientation === "black" ? [...board].reverse() : board;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 56px)",
        gridTemplateRows: "repeat(8, 56px)",
        border: "1px solid rgba(255,255,255,0.2)",
        width: 56 * 8
      }}
    >
      {rows.map((row, rIdx) =>
        row.map((piece, cIdx) => {
          const rowIndex = orientation === "black" ? 7 - rIdx : rIdx;
          const colIndex = orientation === "black" ? 7 - cIdx : cIdx;
          const isDark = (rowIndex + colIndex) % 2 === 1;
          const isSel =
            selected &&
            selected.row === rowIndex &&
            selected.col === colIndex;
          const isTarget = legalTargets?.some((t) => t.row === rowIndex && t.col === colIndex);
          return (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => onSquareClick(rowIndex, colIndex)}
              style={{
                width: 56,
                height: 56,
                cursor: "pointer",
                border: isSel ? "2px solid #74b9ff" : "1px solid transparent",
                background: isDark ? "#1d2b3a" : "#e8ecf3",
                color: isDark ? "#e8ecf3" : "#0b1020",
                fontSize: 30,
                display: "grid",
                placeItems: "center",
                outline: isTarget ? "3px solid rgba(46, 213, 115, 0.75)" : "none",
                outlineOffset: isTarget ? "-3px" : "0"
              }}
            >
              {PIECES[piece] || ""}
            </button>
          );
        })
      )}
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
        // placeholder for draw/resign/time updates
        // console.log("game-state", msg.body);
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
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "auto 1fr", gap: 24 }}>
      <PromotionModal
        open={promotion.open}
        color={playerColor}
        onClose={() => setPromotion({ open: false, from: null, to: null, choices: null })}
        onPick={(p) => {
          const mv = (promotion.choices || []).find((m) => m.promotedTo === p);
          if (mv) commitMove(mv);
        }}
      />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ marginTop: 0 }}>Game #{matchId}</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ opacity: 0.9 }}>
              <b>{auth.user?.username}</b>
            </span>
            <button
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
        <div style={{ marginBottom: 12, opacity: 0.9 }}>
          You are <b>{playerColor || "…"}</b> — {myTurn ? "your move" : "waiting"}
        </div>
        {gameEnd?.over ? (
          <div style={{ marginBottom: 12, padding: 10, border: "1px solid rgba(255,255,255,0.2)" }}>
            Game over: <b>{gameEnd.reason}</b> ({gameEnd.result})
          </div>
        ) : null}
        {error ? <div style={{ color: "#ff9a9a", marginBottom: 12 }}>{error}</div> : null}
        {state?.board ? (
          <Board
            board={state.board}
            selected={selected}
            legalTargets={legalTargets}
            onSquareClick={onSquareClick}
            orientation={orientation}
          />
        ) : (
          <div>Loading board…</div>
        )}
      </div>

      <div style={{ maxWidth: 360 }}>
        <h3 style={{ marginTop: 0 }}>Moves</h3>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: 12,
            minHeight: 240,
            background: "rgba(255,255,255,0.03)"
          }}
        >
          {moves.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No moves yet</div>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {moves.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}


