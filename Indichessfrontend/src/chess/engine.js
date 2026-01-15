// A small, dependency-free chess engine for legal move generation and state updates.
// Board representation matches existing UI:
// - 8x8 array
// - empty squares are ""
// - white pieces are uppercase, black pieces are lowercase

const FILES = "abcdefgh";

export function createInitialBoard() {
  return [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    ["R", "N", "B", "Q", "K", "B", "N", "R"],
  ];
}

export function createInitialState(overrides = {}) {
  return {
    board: createInitialBoard(),
    turn: "w", // 'w' | 'b'
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null, // {row, col} target square or null
    halfmoveClock: 0,
    fullmoveNumber: 1,
    ...overrides,
  };
}

export function cloneState(state) {
  return {
    ...state,
    board: state.board.map((r) => [...r]),
    castling: { ...state.castling },
    enPassant: state.enPassant ? { ...state.enPassant } : null,
  };
}

export function pieceColor(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? "w" : "b";
}

export function opposite(color) {
  return color === "w" ? "b" : "w";
}

export function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function isEmpty(state, r, c) {
  return state.board[r][c] === "";
}

function isEnemy(state, r, c, color) {
  const p = state.board[r][c];
  const pc = pieceColor(p);
  return pc && pc !== color;
}

function isFriend(state, r, c, color) {
  const p = state.board[r][c];
  const pc = pieceColor(p);
  return pc && pc === color;
}

function findKing(state, color) {
  const target = color === "w" ? "K" : "k";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (state.board[r][c] === target) return { row: r, col: c };
    }
  }
  return null;
}

export function isSquareAttacked(state, square, byColor) {
  const { row: tr, col: tc } = square;

  // Pawns (attacks only)
  const pawnDir = byColor === "w" ? -1 : 1;
  for (const dc of [-1, 1]) {
    const r = tr - pawnDir;
    const c = tc - dc;
    if (inBounds(r, c)) {
      const p = state.board[r][c];
      if (p && pieceColor(p) === byColor && p.toLowerCase() === "p") return true;
    }
  }

  // Knights
  const KN = [
    [-2, -1], [-2, 1], [2, -1], [2, 1],
    [-1, -2], [1, -2], [-1, 2], [1, 2],
  ];
  for (const [dr, dc] of KN) {
    const r = tr + dr;
    const c = tc + dc;
    if (!inBounds(r, c)) continue;
    const p = state.board[r][c];
    if (p && pieceColor(p) === byColor && p.toLowerCase() === "n") return true;
  }

  // King (adjacent)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = tr + dr;
      const c = tc + dc;
      if (!inBounds(r, c)) continue;
      const p = state.board[r][c];
      if (p && pieceColor(p) === byColor && p.toLowerCase() === "k") return true;
    }
  }

  // Sliders: rook/queen orthogonal, bishop/queen diagonal
  const dirs = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];
  for (const [dr, dc] of dirs) {
    let r = tr + dr;
    let c = tc + dc;
    while (inBounds(r, c)) {
      const p = state.board[r][c];
      if (p) {
        if (pieceColor(p) === byColor) {
          const t = p.toLowerCase();
          const isDiag = Math.abs(dr) === 1 && Math.abs(dc) === 1;
          const isOrtho = dr === 0 || dc === 0;
          if (isDiag && (t === "b" || t === "q")) return true;
          if (isOrtho && (t === "r" || t === "q")) return true;
        }
        break; // blocked
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

export function isInCheck(state, color) {
  const king = findKing(state, color);
  if (!king) return false;
  return isSquareAttacked(state, king, opposite(color));
}

function addMove(moves, from, to, extras = {}) {
  moves.push({ from, to, ...extras });
}

function genPawnMoves(state, r, c, color, moves) {
  const dir = color === "w" ? -1 : 1;
  const startRank = color === "w" ? 6 : 1;
  const promoteRank = color === "w" ? 0 : 7;

  // forward 1
  const r1 = r + dir;
  if (inBounds(r1, c) && isEmpty(state, r1, c)) {
    if (r1 === promoteRank) {
      for (const promo of ["q", "r", "b", "n"]) addMove(moves, { row: r, col: c }, { row: r1, col: c }, { promotion: promo });
    } else {
      addMove(moves, { row: r, col: c }, { row: r1, col: c });
    }

    // forward 2
    const r2 = r + 2 * dir;
    if (r === startRank && inBounds(r2, c) && isEmpty(state, r2, c)) {
      addMove(moves, { row: r, col: c }, { row: r2, col: c }, { doublePawnPush: true });
    }
  }

  // captures
  for (const dc of [-1, 1]) {
    const rr = r + dir;
    const cc = c + dc;
    if (!inBounds(rr, cc)) continue;
    if (isEnemy(state, rr, cc, color)) {
      if (rr === promoteRank) {
        for (const promo of ["q", "r", "b", "n"]) addMove(moves, { row: r, col: c }, { row: rr, col: cc }, { promotion: promo, capture: true });
      } else {
        addMove(moves, { row: r, col: c }, { row: rr, col: cc }, { capture: true });
      }
    }
  }

  // en passant
  if (state.enPassant) {
    const { row: er, col: ec } = state.enPassant;
    if (er === r + dir && Math.abs(ec - c) === 1) {
      // Capture the pawn behind enPassant square
      addMove(moves, { row: r, col: c }, { row: er, col: ec }, { enPassant: true, capture: true });
    }
  }
}

function genKnightMoves(state, r, c, color, moves) {
  const KN = [
    [-2, -1], [-2, 1], [2, -1], [2, 1],
    [-1, -2], [1, -2], [-1, 2], [1, 2],
  ];
  for (const [dr, dc] of KN) {
    const rr = r + dr;
    const cc = c + dc;
    if (!inBounds(rr, cc)) continue;
    if (isFriend(state, rr, cc, color)) continue;
    addMove(moves, { row: r, col: c }, { row: rr, col: cc }, { capture: !isEmpty(state, rr, cc) });
  }
}

function genSliderMoves(state, r, c, color, moves, dirs) {
  for (const [dr, dc] of dirs) {
    let rr = r + dr;
    let cc = c + dc;
    while (inBounds(rr, cc)) {
      if (isFriend(state, rr, cc, color)) break;
      const capture = isEnemy(state, rr, cc, color);
      addMove(moves, { row: r, col: c }, { row: rr, col: cc }, { capture });
      if (!isEmpty(state, rr, cc)) break;
      rr += dr;
      cc += dc;
    }
  }
}

function genKingMoves(state, r, c, color, moves) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (!inBounds(rr, cc)) continue;
      if (isFriend(state, rr, cc, color)) continue;
      addMove(moves, { row: r, col: c }, { row: rr, col: cc }, { capture: !isEmpty(state, rr, cc) });
    }
  }

  // Castling
  const rights = state.castling;
  const isWhite = color === "w";
  const homeRow = isWhite ? 7 : 0;
  const kingPiece = isWhite ? "K" : "k";
  if (r !== homeRow || c !== 4 || state.board[r][c] !== kingPiece) return;

  // Can't castle out of check
  if (isInCheck(state, color)) return;

  // King-side
  if ((isWhite ? rights.K : rights.k)) {
    const rookCol = 7;
    const rookPiece = isWhite ? "R" : "r";
    if (state.board[homeRow][rookCol] === rookPiece &&
        isEmpty(state, homeRow, 5) &&
        isEmpty(state, homeRow, 6) &&
        !isSquareAttacked(state, { row: homeRow, col: 5 }, opposite(color)) &&
        !isSquareAttacked(state, { row: homeRow, col: 6 }, opposite(color))) {
      addMove(moves, { row: homeRow, col: 4 }, { row: homeRow, col: 6 }, { castle: "K" });
    }
  }

  // Queen-side
  if ((isWhite ? rights.Q : rights.q)) {
    const rookCol = 0;
    const rookPiece = isWhite ? "R" : "r";
    if (state.board[homeRow][rookCol] === rookPiece &&
        isEmpty(state, homeRow, 3) &&
        isEmpty(state, homeRow, 2) &&
        isEmpty(state, homeRow, 1) &&
        !isSquareAttacked(state, { row: homeRow, col: 3 }, opposite(color)) &&
        !isSquareAttacked(state, { row: homeRow, col: 2 }, opposite(color))) {
      addMove(moves, { row: homeRow, col: 4 }, { row: homeRow, col: 2 }, { castle: "Q" });
    }
  }
}

export function generatePseudoLegalMoves(state) {
  const color = state.turn;
  const moves = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      if (pieceColor(p) !== color) continue;
      const t = p.toLowerCase();
      if (t === "p") genPawnMoves(state, r, c, color, moves);
      else if (t === "n") genKnightMoves(state, r, c, color, moves);
      else if (t === "b") genSliderMoves(state, r, c, color, moves, [[-1,-1],[-1,1],[1,-1],[1,1]]);
      else if (t === "r") genSliderMoves(state, r, c, color, moves, [[-1,0],[1,0],[0,-1],[0,1]]);
      else if (t === "q") genSliderMoves(state, r, c, color, moves, [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]);
      else if (t === "k") genKingMoves(state, r, c, color, moves);
    }
  }

  return moves;
}

export function makeMove(state, move) {
  const next = cloneState(state);
  const { from, to } = move;
  const piece = next.board[from.row][from.col];
  const color = pieceColor(piece);
  const opp = opposite(color);
  const target = next.board[to.row][to.col];
  const isPawn = piece.toLowerCase() === "p";

  // reset en passant by default
  next.enPassant = null;

  // update halfmove
  if (isPawn || target !== "" || move.enPassant) next.halfmoveClock = 0;
  else next.halfmoveClock += 1;

  // move piece
  next.board[from.row][from.col] = "";

  // en passant capture
  if (move.enPassant) {
    const capRow = color === "w" ? to.row + 1 : to.row - 1;
    if (inBounds(capRow, to.col)) next.board[capRow][to.col] = "";
  }

  // castling move: move rook too
  if (move.castle) {
    const homeRow = color === "w" ? 7 : 0;
    if (move.castle === "K") {
      // rook h -> f
      const rookPiece = color === "w" ? "R" : "r";
      next.board[homeRow][5] = rookPiece;
      next.board[homeRow][7] = "";
    } else {
      // rook a -> d
      const rookPiece = color === "w" ? "R" : "r";
      next.board[homeRow][3] = rookPiece;
      next.board[homeRow][0] = "";
    }
  }

  // promotion
  if (move.promotion) {
    const promo = move.promotion.toLowerCase();
    const promoted = color === "w" ? promo.toUpperCase() : promo;
    next.board[to.row][to.col] = promoted;
  } else {
    next.board[to.row][to.col] = piece;
  }

  // set enPassant target if double pawn push
  if (move.doublePawnPush && isPawn) {
    const epRow = color === "w" ? to.row + 1 : to.row - 1;
    next.enPassant = { row: epRow, col: to.col };
  }

  // castling rights updates (king move)
  if (piece.toLowerCase() === "k") {
    if (color === "w") { next.castling.K = false; next.castling.Q = false; }
    else { next.castling.k = false; next.castling.q = false; }
  }

  // castling rights updates (rook move or rook captured)
  // White rooks start (7,0) and (7,7); black rooks start (0,0) and (0,7)
  const rookStarts = {
    w: { a: { row: 7, col: 0, flag: "Q" }, h: { row: 7, col: 7, flag: "K" } },
    b: { a: { row: 0, col: 0, flag: "q" }, h: { row: 0, col: 7, flag: "k" } },
  };
  if (piece.toLowerCase() === "r") {
    const starts = rookStarts[color];
    for (const key of Object.keys(starts)) {
      const s = starts[key];
      if (from.row === s.row && from.col === s.col) next.castling[s.flag] = false;
    }
  }
  if (target && target.toLowerCase() === "r") {
    const starts = rookStarts[opp];
    for (const key of Object.keys(starts)) {
      const s = starts[key];
      if (to.row === s.row && to.col === s.col) next.castling[s.flag] = false;
    }
  }

  // update move counters
  next.turn = opp;
  if (next.turn === "w") next.fullmoveNumber += 1;

  return next;
}

export function generateLegalMoves(state) {
  const pseudo = generatePseudoLegalMoves(state);
  const color = state.turn;
  const legal = [];

  for (const mv of pseudo) {
    const next = makeMove(state, mv);
    if (!isInCheck(next, color)) {
      legal.push(mv);
    }
  }

  return legal;
}

export function legalMovesForSquare(state, fromRow, fromCol) {
  return generateLegalMoves(state).filter((m) => m.from.row === fromRow && m.from.col === fromCol);
}

export function getGameOutcome(state) {
  const legal = generateLegalMoves(state);
  const inCheck = isInCheck(state, state.turn);
  if (legal.length > 0) return { status: "ongoing", inCheck };
  if (inCheck) return { status: "checkmate", winner: opposite(state.turn), inCheck: true };
  return { status: "stalemate", inCheck: false };
}

export function moveToUci(move) {
  const from = `${FILES[move.from.col]}${8 - move.from.row}`;
  const to = `${FILES[move.to.col]}${8 - move.to.row}`;
  const promo = move.promotion ? move.promotion.toLowerCase() : "";
  return `${from}${to}${promo}`;
}


