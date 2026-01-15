export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function isEmpty(piece) {
  return piece == null || piece === "";
}

export function pieceColor(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? "w" : "b";
}

export function sameColor(a, b) {
  const ca = pieceColor(a);
  const cb = pieceColor(b);
  return ca != null && ca === cb;
}

export function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function algebraicToSquare(sq) {
  if (!sq || sq.length !== 2) return null;
  const file = sq.charCodeAt(0) - "a".charCodeAt(0);
  const rank = sq.charCodeAt(1) - "1".charCodeAt(0);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  // rank 1 is bottom (row 7)
  return { row: 7 - rank, col: file };
}

export function squareToAlgebraic(row, col) {
  const file = String.fromCharCode("a".charCodeAt(0) + col);
  const rank = String.fromCharCode("1".charCodeAt(0) + (7 - row));
  return `${file}${rank}`;
}


