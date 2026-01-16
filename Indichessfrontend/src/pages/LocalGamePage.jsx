import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applyMove, initialStateFromBoard } from "../chess/state";
import { legalMovesForSquare, detectGameEndBasic } from "../chess/legalMoves";
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

function Board({ board, selected, legalTargets, onSquareClick, orientation, lastMove }) {
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

            const isDark = (rowIndex + colIndex) % 2 === 1;
            const isSel = selected && selected.row === rowIndex && selected.col === colIndex;
            const isTarget = legalTargets?.some((t) => t.row === rowIndex && t.col === colIndex);
            const isLastMove = lastMove && (
              (lastMove.from.row === rowIndex && lastMove.from.col === colIndex) ||
              (lastMove.to.row === rowIndex && lastMove.to.col === colIndex)
            );

            return (
              <button
                key={`${dr}-${dc}`}
                onClick={() => onSquareClick(rowIndex, colIndex)}
                className={[
                  "ig-sq",
                  isDark ? "dark" : "light",
                  isSel ? "selected" : "",
                  isTarget ? "target" : "",
                  isLastMove ? "last-move" : ""
                ].filter(Boolean).join(" ")}
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
      className="ig-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ig-modal-content"
      >
        <h3 className="ig-modal-title">Promote Pawn</h3>
        <div className="ig-promotion-grid">
          {opts.map((p) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              className="ig-promotion-piece"
            >
              {PIECES[p] || p}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="ig-modal-btn ig-modal-btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const INITIAL_BOARD = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"]
];

export function LocalGamePage() {
  const nav = useNavigate();
  const [state, setState] = useState(() => initialStateFromBoard(INITIAL_BOARD));
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [moves, setMoves] = useState([]);
  const [promotion, setPromotion] = useState({ open: false, from: null, to: null, choices: null });
  const [gameEnd, setGameEnd] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  
  // Timer states
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [whiteTime, setWhiteTime] = useState(10 * 60 * 1000); // 10 minutes in milliseconds
  const [blackTime, setBlackTime] = useState(10 * 60 * 1000);
  const timerIntervalRef = React.useRef(null);

  const currentTurn = state.turn === "w" ? "white" : "black";
  const orientation = "white"; // Always show white at bottom for local play

  const gameEndStatus = useMemo(() => {
    if (!state) return null;
    return detectGameEndBasic(state);
  }, [state]);

  React.useEffect(() => {
    if (gameEndStatus?.over) {
      setGameEnd(gameEndStatus);
    }
  }, [gameEndStatus]);

  // Timer logic
  React.useEffect(() => {
    if (!timerEnabled || gameEnd?.over || !state) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    const isWhiteTurn = state.turn === "w";
    
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Start countdown for the active player
    timerIntervalRef.current = setInterval(() => {
      if (isWhiteTurn) {
        setWhiteTime((prev) => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            setGameEnd({ over: true, result: "black", reason: "time" });
            return 0;
          }
          return newTime;
        });
      } else {
        setBlackTime((prev) => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            setGameEnd({ over: true, result: "white", reason: "time" });
            return 0;
          }
          return newTime;
        });
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [state?.turn, gameEnd, timerEnabled, state]);

  // Format time as MM:SS
  function formatTime(ms) {
    if (ms <= 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  // Check if time is running low (under 1 minute)
  function isTimeLow(ms) {
    return ms > 0 && ms < 60 * 1000;
  }

  // Check if time is critical (under 10 seconds)
  function isTimeCritical(ms) {
    return ms > 0 && ms < 10 * 1000;
  }

  // Get clock class based on state
  function getClockClass(isActive, timeMs) {
    if (!isActive) return "ig-clock inactive";
    if (isTimeCritical(timeMs)) return "ig-clock active danger";
    if (isTimeLow(timeMs)) return "ig-clock active warning";
    return "ig-clock active";
  }

  function onSquareClick(row, col) {
    if (!state?.board) return;
    if (gameEnd?.over) return;

    const board = state.board;
    const piece = board[row][col];
    const isWhiteTurn = state.turn === "w";

    if (!selected) {
      if (!piece) return;
      if (isWhiteTurn && !isWhitePiece(piece)) return;
      if (!isWhiteTurn && !isBlackPiece(piece)) return;
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
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    // Promotion requires user selection
    const hasPromotion = candidates.some((m) => m.isPromotion);
    if (hasPromotion) {
      setPromotion({ open: true, from: { row: fromRow, col: fromCol }, to: { row, col }, choices: candidates });
      return;
    }

    const chosen = candidates[0];
    commitMove(chosen);
  }

  function commitMove(mv) {
    // Track last move for highlighting
    setLastMove({
      from: { row: mv.fromRow, col: mv.fromCol },
      to: { row: mv.toRow, col: mv.toCol }
    });

    const nextState = applyMove(state, mv);
    setState(nextState);
    setSelected(null);
    setLegalTargets([]);
    setPromotion({ open: false, from: null, to: null, choices: null });

    // Add move notation (simplified)
    const fromSquare = String.fromCharCode(97 + mv.fromCol) + (8 - mv.fromRow);
    const toSquare = String.fromCharCode(97 + mv.toCol) + (8 - mv.toRow);
    const notation = mv.isPromotion && mv.promotedTo ? `${fromSquare}${toSquare}${mv.promotedTo.toUpperCase()}` : `${fromSquare}${toSquare}`;
    setMoves((prev) => [...prev, notation]);
  }

  function handleReset() {
    setState(initialStateFromBoard(INITIAL_BOARD));
    setSelected(null);
    setLegalTargets([]);
    setMoves([]);
    setPromotion({ open: false, from: null, to: null, choices: null });
    setGameEnd(null);
    setLastMove(null);
    // Reset timers if enabled
    if (timerEnabled) {
      setWhiteTime(10 * 60 * 1000);
      setBlackTime(10 * 60 * 1000);
    }
  }

  function toggleTimer() {
    const newEnabled = !timerEnabled;
    setTimerEnabled(newEnabled);
    if (newEnabled) {
      // Reset timers when enabling
      setWhiteTime(10 * 60 * 1000);
      setBlackTime(10 * 60 * 1000);
    } else {
      // Stop timer when disabling
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }

  return (
    <div className="ig-game">
      <PromotionModal
        open={promotion.open}
        color={currentTurn}
        onClose={() => setPromotion({ open: false, from: null, to: null, choices: null })}
        onPick={(p) => {
          const mv = (promotion.choices || []).find((m) => m.promotedTo === p);
          if (mv) commitMove(mv);
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
              <span style={{ fontSize: 13, opacity: 0.9 }}>Local Play</span>
              <span className="ig-pill">1v1</span>
            </div>
            <div className="ig-row">
              <button 
                className={`ig-btn ${timerEnabled ? "ig-btn-primary" : ""}`} 
                type="button" 
                onClick={toggleTimer}
                title={timerEnabled ? "Disable 10 min timer" : "Enable 10 min timer"}
              >
                {timerEnabled ? "⏱️ Timer: ON" : "⏱️ Timer: OFF"}
              </button>
            </div>
            <div className="ig-row">
              <button className="ig-btn ig-btn-primary" type="button" onClick={handleReset}>
                New Game
              </button>
              <button className="ig-btn" type="button" onClick={() => nav("/home")}>
                Home
              </button>
            </div>
          </div>
        </aside>

        <main className="ig-center">
          <div className="ig-card ig-playerbar">
            <div className="ig-player-left">
              <div className="ig-avatar" />
              <div>
                <div className="ig-player-name">Black</div>
                <div className="ig-player-sub">Player 2</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {timerEnabled && (
                <div className={getClockClass(
                  currentTurn === "black",
                  blackTime
                )}>
                  {formatTime(blackTime)}
                </div>
              )}
              {!timerEnabled && (
                <div className={`ig-pill ${currentTurn === "black" ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400" : "bg-gray-500/20 border-gray-500/30"}`}>
                  {currentTurn === "black" ? "⏱️ Black's turn" : "⏳ Waiting"}
                </div>
              )}
            </div>
          </div>

          {gameEnd?.over ? (
            <div className="ig-status bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/30 animate-slide-up">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏁</span>
                <div>
                  <div className="font-bold">Game Over</div>
                  <div className="text-sm opacity-90">
                    {gameEnd.reason === "time" 
                      ? `Time expired - ${gameEnd.result === "white" ? "White" : "Black"} wins!`
                      : gameEnd.reason === "checkmate" 
                        ? "Checkmate!" 
                        : gameEnd.reason === "stalemate" 
                          ? "Stalemate" 
                          : gameEnd.reason}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="ig-card ig-boardwrap">
            {state?.board ? (
              <Board
                board={state.board}
                selected={selected}
                legalTargets={legalTargets}
                onSquareClick={onSquareClick}
                orientation={orientation}
                lastMove={lastMove}
              />
            ) : (
              <div className="flex items-center justify-center h-[448px]">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-chess-text/20 border-t-chess-text/60 rounded-full animate-spin"></div>
                  <div className="text-chess-text/70 font-medium">Loading board…</div>
                </div>
              </div>
            )}
          </div>

          <div className="ig-card ig-playerbar">
            <div className="ig-player-left">
              <div className="ig-avatar" />
              <div>
                <div className="ig-player-name">White</div>
                <div className="ig-player-sub">Player 1</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {timerEnabled && (
                <div className={getClockClass(
                  currentTurn === "white",
                  whiteTime
                )}>
                  {formatTime(whiteTime)}
                </div>
              )}
              {!timerEnabled && (
                <div className={`ig-pill ${currentTurn === "white" ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400" : "bg-gray-500/20 border-gray-500/30"}`}>
                  {currentTurn === "white" ? "⏱️ White's turn" : "⏳ Waiting"}
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="ig-right">
          <div className="ig-card">
            <div className="ig-panel-title">Move History</div>
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
                className="ig-action hover:bg-blue-500/20 hover:border-blue-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={handleReset}
              >
                🔄 New Game
              </button>
              <button
                className="ig-action hover:bg-white/12 transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={() => nav("/home")}
              >
                🏠 Home
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

