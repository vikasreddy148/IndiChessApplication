import { inBounds, isEmpty, pieceColor, sameColor } from "./board";
import { applyMove, enPassantSquare, kingSquare } from "./state";

function addRayMoves(state, fromRow, fromCol, deltas, moves) {
  const board = state.board;
  const moving = board[fromRow][fromCol];
  for (const [dr, dc] of deltas) {
    let r = fromRow + dr;
    let c = fromCol + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (isEmpty(target)) {
        moves.push({ fromRow, fromCol, toRow: r, toCol: c });
      } else {
        if (!sameColor(moving, target)) moves.push({ fromRow, fromCol, toRow: r, toCol: c });
        break;
      }
      r += dr;
      c += dc;
    }
  }
}

function addKnightMoves(state, fromRow, fromCol, moves) {
  const board = state.board;
  const moving = board[fromRow][fromCol];
  const deltas = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1]
  ];
  for (const [dr, dc] of deltas) {
    const r = fromRow + dr;
    const c = fromCol + dc;
    if (!inBounds(r, c)) continue;
    const target = board[r][c];
    if (isEmpty(target) || !sameColor(moving, target)) {
      moves.push({ fromRow, fromCol, toRow: r, toCol: c });
    }
  }
}

function addKingMoves(state, fromRow, fromCol, moves) {
  const board = state.board;
  const moving = board[fromRow][fromCol];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = fromRow + dr;
      const c = fromCol + dc;
      if (!inBounds(r, c)) continue;
      const target = board[r][c];
      if (isEmpty(target) || !sameColor(moving, target)) {
        moves.push({ fromRow, fromCol, toRow: r, toCol: c });
      }
    }
  }

  // Castling
  // Conditions:
  // - correct starting square
  // - castling right available
  // - squares between empty
  // - king not in check, and does not pass through / land on attacked squares
  const color = pieceColor(moving);
  const opp = color === "w" ? "b" : "w";
  const row = color === "w" ? 7 : 0;
  if (fromRow === row && fromCol === 4) {
    const rights = state.castling || { K: false, Q: false, k: false, q: false };
    const canK = color === "w" ? rights.K : rights.k;
    const canQ = color === "w" ? rights.Q : rights.q;

    // Kingside: squares f,g empty; squares e,f,g not attacked
    const rookK = board[row][7];
    const rookKOk = color === "w" ? rookK === "R" : rookK === "r";
    if (canK && rookKOk && isEmpty(board[row][5]) && isEmpty(board[row][6])) {
      // Note: isSquareAttacked is defined below
      if (
        !isSquareAttacked(board, { row, col: 4 }, opp) &&
        !isSquareAttacked(board, { row, col: 5 }, opp) &&
        !isSquareAttacked(board, { row, col: 6 }, opp)
      ) {
        moves.push({ fromRow, fromCol, toRow: row, toCol: 6, castled: true });
      }
    }

    // Queenside: squares b,c,d empty; squares e,d,c not attacked
    const rookQ = board[row][0];
    const rookQOk = color === "w" ? rookQ === "R" : rookQ === "r";
    if (canQ && rookQOk && isEmpty(board[row][1]) && isEmpty(board[row][2]) && isEmpty(board[row][3])) {
      if (
        !isSquareAttacked(board, { row, col: 4 }, opp) &&
        !isSquareAttacked(board, { row, col: 3 }, opp) &&
        !isSquareAttacked(board, { row, col: 2 }, opp)
      ) {
        moves.push({ fromRow, fromCol, toRow: row, toCol: 2, castled: true });
      }
    }
  }
}

function addPawnMoves(state, fromRow, fromCol, moves) {
  const board = state.board;
  const moving = board[fromRow][fromCol];
  const color = pieceColor(moving); // w/b
  const dir = color === "w" ? -1 : 1;
  const startRow = color === "w" ? 6 : 1;
  const promotionRow = color === "w" ? 0 : 7;

  const promoPieces = color === "w" ? ["Q", "R", "B", "N"] : ["q", "r", "b", "n"];

  // forward 1
  const r1 = fromRow + dir;
  if (inBounds(r1, fromCol) && isEmpty(board[r1][fromCol])) {
    if (r1 === promotionRow) {
      for (const pp of promoPieces) {
        moves.push({ fromRow, fromCol, toRow: r1, toCol: fromCol, isPromotion: true, promotedTo: pp });
      }
    } else {
      moves.push({ fromRow, fromCol, toRow: r1, toCol: fromCol });
    }
    // forward 2
    const r2 = fromRow + 2 * dir;
    if (fromRow === startRow && inBounds(r2, fromCol) && isEmpty(board[r2][fromCol])) {
      moves.push({ fromRow, fromCol, toRow: r2, toCol: fromCol });
    }
  }

  // captures (diagonal only)
  for (const dc of [-1, 1]) {
    const r = fromRow + dir;
    const c = fromCol + dc;
    if (!inBounds(r, c)) continue;
    const target = board[r][c];
    // Pawns can only capture diagonally if there's an enemy piece
    if (!isEmpty(target) && !sameColor(moving, target)) {
      if (r === promotionRow) {
        for (const pp of promoPieces) {
          moves.push({ fromRow, fromCol, toRow: r, toCol: c, isPromotion: true, promotedTo: pp });
        }
      } else {
        moves.push({ fromRow, fromCol, toRow: r, toCol: c });
      }
    }
  }

  // En-passant capture
  const ep = enPassantSquare(state);
  if (ep) {
    if (ep.row === fromRow + dir && Math.abs(ep.col - fromCol) === 1) {
      // target square must be empty; capture pawn behind it
      if (isEmpty(board[ep.row][ep.col])) {
        const capRow = fromRow; // pawn being captured is on our current rank
        const capCol = ep.col;
        const capPiece = board?.[capRow]?.[capCol] || "";
        const expected = color === "w" ? "p" : "P";
        if (capPiece === expected) {
          moves.push({ fromRow, fromCol, toRow: ep.row, toCol: ep.col, isEnPassant: true });
        }
      }
    }
  }
}

export function pseudoLegalMovesForSquare(state, fromRow, fromCol) {
  const board = state.board;
  const moving = board[fromRow][fromCol];
  if (!moving) return [];

  const pt = moving.toLowerCase();
  const moves = [];

  if (pt === "p") addPawnMoves(state, fromRow, fromCol, moves);
  else if (pt === "n") addKnightMoves(state, fromRow, fromCol, moves);
  else if (pt === "b") addRayMoves(state, fromRow, fromCol, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves);
  else if (pt === "r") addRayMoves(state, fromRow, fromCol, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves);
  else if (pt === "q")
    addRayMoves(
      state,
      fromRow,
      fromCol,
      [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]],
      moves
    );
  else if (pt === "k") addKingMoves(state, fromRow, fromCol, moves);

  return moves;
}

function attacksFromSquare(board, fromRow, fromCol) {
  const piece = board[fromRow][fromCol];
  if (!piece) return [];
  const color = pieceColor(piece);
  const pt = piece.toLowerCase();
  const out = [];

  const push = (r, c) => {
    if (inBounds(r, c)) out.push({ row: r, col: c });
  };

  if (pt === "p") {
    const dir = color === "w" ? -1 : 1;
    push(fromRow + dir, fromCol - 1);
    push(fromRow + dir, fromCol + 1);
    return out;
  }

  if (pt === "n") {
    const deltas = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1]
    ];
    for (const [dr, dc] of deltas) push(fromRow + dr, fromCol + dc);
    return out;
  }

  if (pt === "k") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        push(fromRow + dr, fromCol + dc);
      }
    }
    return out;
  }

  const ray = (deltas) => {
    for (const [dr, dc] of deltas) {
      let r = fromRow + dr;
      let c = fromCol + dc;
      while (inBounds(r, c)) {
        out.push({ row: r, col: c });
        if (!isEmpty(board[r][c])) break;
        r += dr;
        c += dc;
      }
    }
  };

  if (pt === "b") ray([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  else if (pt === "r") ray([[-1, 0], [1, 0], [0, -1], [0, 1]]);
  else if (pt === "q") ray([[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);

  return out;
}

export function isSquareAttacked(board, square, byColor /* 'w'|'b' */) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (pieceColor(p) !== byColor) continue;
      const attacks = attacksFromSquare(board, r, c);
      if (attacks.some((a) => a.row === square.row && a.col === square.col)) return true;
    }
  }
  return false;
}

export function isInCheck(state, color /* 'w'|'b' */) {
  const ksq = kingSquare(state.board, color);
  if (!ksq) return false;
  const opp = color === "w" ? "b" : "w";
  return isSquareAttacked(state.board, ksq, opp);
}

export function legalMovesForSquare(state, fromRow, fromCol) {
  const board = state.board;
  const moving = board[fromRow][fromCol];
  if (!moving) return [];
  if (pieceColor(moving) !== state.turn) return [];

  const pseudo = pseudoLegalMovesForSquare(state, fromRow, fromCol);
  const legal = [];

  for (const mv of pseudo) {
    const nextState = applyMove(state, mv);
    // If our king is in check after the move, it's illegal
    if (!isInCheck(nextState, state.turn)) {
      legal.push(mv);
    }
  }
  return legal;
}

export function allLegalMoves(state) {
  const out = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      if (pieceColor(p) !== state.turn) continue;
      out.push(...legalMovesForSquare(state, r, c));
    }
  }
  return out;
}

export function detectGameEndBasic(state) {
  // Basic checkmate/stalemate detection; special rules integrated later.
  const moves = allLegalMoves(state);
  if (moves.length > 0) return { over: false, result: null, reason: null };

  const inCheck = isInCheck(state, state.turn);
  if (inCheck) {
    return { over: true, result: state.turn === "w" ? "black" : "white", reason: "checkmate" };
  }
  return { over: true, result: "draw", reason: "stalemate" };
}


