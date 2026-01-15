import { createInitialState, generateLegalMoves, makeMove, legalMovesForSquare, getGameOutcome } from "./engine";

function applyUci(state, uci) {
  const file = (ch) => "abcdefgh".indexOf(ch);
  const rank = (ch) => 8 - parseInt(ch, 10);

  const from = { row: rank(uci[1]), col: file(uci[0]) };
  const to = { row: rank(uci[3]), col: file(uci[2]) };
  const promotion = uci.length === 5 ? uci[4] : undefined;

  const moves = legalMovesForSquare(state, from.row, from.col);
  const chosen = moves.find((m) => m.to.row === to.row && m.to.col === to.col && (promotion ? m.promotion === promotion : true));
  if (!chosen) throw new Error(`Illegal move: ${uci}`);
  return makeMove(state, { ...chosen, promotion: promotion || chosen.promotion });
}

test("initial position: 20 legal moves for white", () => {
  const s = createInitialState();
  expect(generateLegalMoves(s)).toHaveLength(20);
});

test("cannot castle through check", () => {
  // Setup: clear pieces, allow castling, put enemy rook attacking f1
  const s = createInitialState();
  // Clear board
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) s.board[r][c] = "";
  // White king/rook
  s.board[7][4] = "K";
  s.board[7][7] = "R";
  // Black rook attacks f1 (7,5)
  s.board[0][5] = "r";
  s.turn = "w";
  s.castling = { K: true, Q: false, k: false, q: false };

  const moves = generateLegalMoves(s);
  const hasCastle = moves.some((m) => m.castle === "K");
  expect(hasCastle).toBe(false);
});

test("en passant is legal only immediately and must not leave king in check", () => {
  // Construct a known ep scenario:
  // White: king e1, pawn e5
  // Black: king e8, pawn d7 that will play d5, rook e8 pinning e-file
  const s = createInitialState();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) s.board[r][c] = "";
  s.board[7][4] = "K";
  s.board[0][4] = "k";
  s.board[3][4] = "P"; // e5
  s.board[1][3] = "p"; // d7
  // Black rook pins e-file against white king
  s.board[0][4] = "r"; // rook e8
  s.turn = "b";

  const s1 = applyUci(s, "d7d5"); // black pawn double push
  expect(s1.enPassant).toEqual({ row: 2, col: 3 }); // d6 target (row 2)

  // White tries exd6 en passant; should be illegal because rook on e8 gives check after e5 pawn moves off file.
  const whiteMoves = generateLegalMoves(s1);
  const ep = whiteMoves.find((m) => m.enPassant);
  expect(ep).toBeUndefined();
});

test("promotion produces legal moves with promotion pieces", () => {
  const s = createInitialState();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) s.board[r][c] = "";
  s.board[7][4] = "K";
  s.board[0][4] = "k";
  s.board[1][0] = "P"; // a7
  s.turn = "w";

  const moves = legalMovesForSquare(s, 1, 0).filter((m) => m.to.row === 0 && m.to.col === 0);
  const promos = moves.map((m) => m.promotion).sort();
  expect(promos).toEqual(["b", "n", "q", "r"]);
});

test("simple checkmate detection: KQ vs K (corner mate pattern)", () => {
  const s = createInitialState();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) s.board[r][c] = "";
  // Black king a8, white king c6, white queen b7, black to move is mated
  s.board[0][0] = "k";
  s.board[2][2] = "K";
  s.board[1][1] = "Q";
  s.turn = "b";
  const out = getGameOutcome(s);
  expect(out.status).toBe("checkmate");
  expect(out.winner).toBe("w");
});


