import { algebraicToSquare, isEmpty, squareToAlgebraic } from "./board";

export function initialStateFromBoard(board) {
  // Infer castling rights from piece positions (prevents "ghost castling" when rook is missing)
  const castling = { K: false, Q: false, k: false, q: false };
  if (board?.[7]?.[4] === "K") {
    if (board?.[7]?.[7] === "R") castling.K = true;
    if (board?.[7]?.[0] === "R") castling.Q = true;
  }
  if (board?.[0]?.[4] === "k") {
    if (board?.[0]?.[7] === "r") castling.k = true;
    if (board?.[0]?.[0] === "r") castling.q = true;
  }
  return {
    board,
    turn: "w",
    castling,
    enPassant: "-", // algebraic square or "-"
    halfmove: 0,
    fullmove: 1
  };
}

export function parseFEN(fen) {
  // FEN: pieces turn castling ep halfmove fullmove
  const parts = (fen || "").trim().split(/\s+/);
  if (parts.length < 2) return null;

  const [placement, turn, castlingRaw = "-", ep = "-", half = "0", full = "1"] = parts;
  const rows = placement.split("/");
  if (rows.length !== 8) return null;

  const board = Array.from({ length: 8 }, () => Array(8).fill(""));
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (c > 7) return null;
      if (ch >= "1" && ch <= "8") {
        c += Number(ch);
      } else {
        board[r][c] = ch;
        c += 1;
      }
    }
    if (c !== 8) return null;
  }

  const castling = { K: false, Q: false, k: false, q: false };
  if (castlingRaw !== "-") {
    for (const ch of castlingRaw) {
      if (castling.hasOwnProperty(ch)) castling[ch] = true;
    }
  }

  return {
    board,
    turn: turn === "b" ? "b" : "w",
    castling,
    enPassant: ep,
    halfmove: Number(half) || 0,
    fullmove: Number(full) || 1
  };
}

export function toFEN(state) {
  const { board, turn, castling, enPassant, halfmove, fullmove } = state;

  const rows = [];
  for (let r = 0; r < 8; r++) {
    let out = "";
    let empties = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (isEmpty(p)) {
        empties++;
      } else {
        if (empties) {
          out += String(empties);
          empties = 0;
        }
        out += p;
      }
    }
    if (empties) out += String(empties);
    rows.push(out);
  }

  const cast =
    (castling?.K ? "K" : "") +
    (castling?.Q ? "Q" : "") +
    (castling?.k ? "k" : "") +
    (castling?.q ? "q" : "");

  return `${rows.join("/")} ${turn} ${cast || "-"} ${enPassant || "-"} ${halfmove ?? 0} ${fullmove ?? 1}`;
}

export function applyBasicMove(state, move) {
  // NOTE: This is a "basic" move applier; special moves are added later.
  const { fromRow, fromCol, toRow, toCol, promotedTo } = move;
  const board = state.board.map((r) => r.slice());
  const moving = board[fromRow][fromCol];
  const captured = board[toRow][toCol];

  board[fromRow][fromCol] = "";
  board[toRow][toCol] = promotedTo ? promotedTo : moving;

  const nextTurn = state.turn === "w" ? "b" : "w";
  const nextHalf =
    !moving ||
    moving.toLowerCase() === "p" ||
    (captured && captured !== "")
      ? 0
      : (state.halfmove ?? 0) + 1;
  const nextFull = state.turn === "b" ? (state.fullmove ?? 1) + 1 : state.fullmove ?? 1;

  // En-passant target (only set on double pawn push; special-move logic later)
  let enPassant = "-";
  if (moving && moving.toLowerCase() === "p" && Math.abs(toRow - fromRow) === 2) {
    const midRow = (toRow + fromRow) / 2;
    if (Number.isInteger(midRow)) enPassant = squareToAlgebraic(midRow, fromCol);
  }

  // Basic castling-rights removal: if king/rook moves from home squares
  const castling = { ...(state.castling || { K: true, Q: true, k: true, q: true }) };
  if (moving === "K") {
    castling.K = false;
    castling.Q = false;
  } else if (moving === "k") {
    castling.k = false;
    castling.q = false;
  } else if (moving === "R") {
    if (fromRow === 7 && fromCol === 0) castling.Q = false;
    if (fromRow === 7 && fromCol === 7) castling.K = false;
  } else if (moving === "r") {
    if (fromRow === 0 && fromCol === 0) castling.q = false;
    if (fromRow === 0 && fromCol === 7) castling.k = false;
  }

  return { ...state, board, turn: nextTurn, enPassant, halfmove: nextHalf, fullmove: nextFull, castling };
}

export function enPassantSquare(state) {
  if (!state?.enPassant || state.enPassant === "-") return null;
  return algebraicToSquare(state.enPassant);
}

export function kingSquare(board, color) {
  const target = color === "w" ? "K" : "k";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === target) return { row: r, col: c };
    }
  }
  return null;
}

function removeCastlingRightsForRookSquare(castling, rookRow, rookCol) {
  // White rooks: a1 (7,0)=Q, h1(7,7)=K. Black rooks: a8(0,0)=q, h8(0,7)=k
  if (rookRow === 7 && rookCol === 0) castling.Q = false;
  if (rookRow === 7 && rookCol === 7) castling.K = false;
  if (rookRow === 0 && rookCol === 0) castling.q = false;
  if (rookRow === 0 && rookCol === 7) castling.k = false;
}

/**
 * Apply a move including special rules:
 * - castling (moves rook)
 * - en-passant (captures pawn behind target square)
 * - promotion (sets promoted piece)
 * Also maintains castling rights + en-passant target + halfmove/fullmove.
 */
export function applyMove(state, move) {
  const {
    fromRow,
    fromCol,
    toRow,
    toCol,
    promotedTo,
    castled = false,
    isEnPassant = false,
    isPromotion = false
  } = move;

  const board = state.board.map((r) => r.slice());
  const moving = board[fromRow][fromCol];
  const movingLower = moving ? moving.toLowerCase() : "";

  // Track capture for halfmove clock + castling-rights updates
  let captured = board[toRow][toCol];

  // En-passant capture: target square is empty; captured pawn sits behind it
  if (isEnPassant && movingLower === "p" && isEmpty(captured)) {
    const dir = state.turn === "w" ? -1 : 1; // white moves up (-1), black down (+1)
    const capRow = toRow - dir;
    const capCol = toCol;
    captured = board[capRow]?.[capCol] || "";
    board[capRow][capCol] = "";
  }

  // Move piece
  board[fromRow][fromCol] = "";

  // Castling: move king to destination and rook accordingly
  if (castled && movingLower === "k") {
    board[toRow][toCol] = moving;
    // kingside: king to g-file (col 6), rook h->f
    if (toCol === 6) {
      const rookFromCol = 7;
      const rookToCol = 5;
      const rook = board[toRow][rookFromCol];
      if (rook === (state.turn === "w" ? "R" : "r")) {
        board[toRow][rookFromCol] = "";
        board[toRow][rookToCol] = rook;
      }
    }
    // queenside: king to c-file (col 2), rook a->d
    if (toCol === 2) {
      const rookFromCol = 0;
      const rookToCol = 3;
      const rook = board[toRow][rookFromCol];
      if (rook === (state.turn === "w" ? "R" : "r")) {
        board[toRow][rookFromCol] = "";
        board[toRow][rookToCol] = rook;
      }
    }
  } else {
    // Promotion sets the promoted piece (already case-correct in move generation)
    if (isPromotion && promotedTo) {
      board[toRow][toCol] = promotedTo;
    } else {
      board[toRow][toCol] = moving;
    }
  }

  const nextTurn = state.turn === "w" ? "b" : "w";

  // Halfmove clock resets on pawn move or capture
  const nextHalf =
    movingLower === "p" || (!isEmpty(captured) && captured !== "")
      ? 0
      : (state.halfmove ?? 0) + 1;

  const nextFull = state.turn === "b" ? (state.fullmove ?? 1) + 1 : state.fullmove ?? 1;

  // En-passant target square (only set on double pawn push)
  let enPassant = "-";
  if (movingLower === "p" && Math.abs(toRow - fromRow) === 2) {
    const midRow = (toRow + fromRow) / 2;
    if (Number.isInteger(midRow)) enPassant = squareToAlgebraic(midRow, fromCol);
  }

  // Update castling rights
  const castling = { ...(state.castling || { K: true, Q: true, k: true, q: true }) };

  // If king moves, rights gone
  if (moving === "K") {
    castling.K = false;
    castling.Q = false;
  } else if (moving === "k") {
    castling.k = false;
    castling.q = false;
  }

  // If rook moves from home squares, remove that side's right
  if (moving === "R" || moving === "r") {
    removeCastlingRightsForRookSquare(castling, fromRow, fromCol);
  }

  // If rook is captured on a home square, remove that right
  if (captured === "R" || captured === "r") {
    removeCastlingRightsForRookSquare(castling, toRow, toCol);
  }

  return { ...state, board, turn: nextTurn, enPassant, halfmove: nextHalf, fullmove: nextFull, castling };
}

export function validateState(state) {
  if (!state || !state.board) return false;
  if (!Array.isArray(state.board) || state.board.length !== 8) return false;
  for (const row of state.board) {
    if (!Array.isArray(row) || row.length !== 8) return false;
  }
  if (state.turn !== "w" && state.turn !== "b") return false;
  if (state.enPassant && state.enPassant !== "-" && !algebraicToSquare(state.enPassant)) return false;
  return true;
}


