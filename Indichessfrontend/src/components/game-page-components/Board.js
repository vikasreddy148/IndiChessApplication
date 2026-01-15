import React, { useState, useEffect, useRef } from "react";
import "../component-styles/Board.css";  // Importing CSS file
import PromotionModal from "../game-page-components/PromotionModal"
import { legalMovesForSquare, makeMove, isInCheck, getGameOutcome } from "../../chess/engine";

// MODIFICATION 1: Update props to include WebSocket functionality
const Board = ({ 
  addMove, 
  // NEW PROPS:
  sendMove,           // Function to send move to server via WebSocket
  opponentMove,       // Move data received from opponent via WebSocket
  playerColor,        // 'white' or 'black' - which color this player is
  isMyTurn,           // Boolean - whether it's currently this player's turn
  isConnected,        // Boolean - WebSocket connection status
  matchId             // Game match ID
}) => {
  const [boardSize, setBoardSize] = useState(500); // Initial size of the board
  const [board, setBoard] = useState([
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    ["R", "N", "B", "Q", "K", "B", "N", "R"]
  ]);  // Initial position of pieces
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [isSquareSelected, setIsSquareSelected] = useState(false);
  const [validMoves, setValidMoves] = useState([]);
  
  // MODIFICATION 2: Initialize turn based on player color and isMyTurn
  const [isWhiteTurn, setIsWhiteTurn] = useState(
    playerColor === 'white' ? isMyTurn : !isMyTurn
  );

  const boardRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [promotingPawn, setPromotingPawn] = useState(null); 
  // Legacy check/castling state is no longer used for rules correctness.
  // The engine tracks castling + check legality; we keep only the engine state.

  // Engine state for full rules correctness
  const [castling, setCastling] = useState({ K: true, Q: true, k: true, q: true });
  const [enPassant, setEnPassant] = useState(null); // {row,col} or null
  const [halfmoveClock, setHalfmoveClock] = useState(0);
  const [fullmoveNumber, setFullmoveNumber] = useState(1);

  // MODIFICATION 3: Add state for opponent's move
  const lastOpponentMoveRef = useRef(null);

  // Handle window resize
  const updateBoardSize = () => {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.6;  // 60% of the viewport size
    setBoardSize(size);
  };

  useEffect(() => {
    updateBoardSize();  // Set initial size
    window.addEventListener("resize", updateBoardSize);

    return () => {
      window.removeEventListener("resize", updateBoardSize);
    };
  }, []);

  useEffect(() => {
    const testElement = document.createElement('div');
    testElement.draggable = true;
    
    testElement.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('test', 'hello');
        console.log("Data set:", e.dataTransfer.getData('test'));
    });
    
    testElement.addEventListener('dragend', (e) => {
        console.log("Can get data after drag?", e.dataTransfer.getData('test'));
    });
}, []);

  // MODIFICATION 4: Update turn when isMyTurn changes
  useEffect(() => {
    if (playerColor === 'white') {
      setIsWhiteTurn(isMyTurn);
    } else {
      setIsWhiteTurn(!isMyTurn);
    }
  }, [isMyTurn, playerColor]);

  // Legal move generation happens on-demand via the engine (see handleSquareClick/handleDragStart/handleDrop).

  // MODIFICATION 5: Handle opponent's move from WebSocket
  // Update the validation in useEffect or applyOpponentMove:
useEffect(() => {
    if (!opponentMove) return;
    if (opponentMove === lastOpponentMoveRef.current) return;

        console.log("📥 New opponent move received:", opponentMove);
        
        // Accept BOTH structures:
        // 1. Nested: opponentMove.from && opponentMove.to
        // 2. Flat: opponentMove.fromRow !== undefined && opponentMove.fromCol !== undefined
        const hasNestedStructure = opponentMove.from && opponentMove.to;
    const hasFlatStructure =
      opponentMove.fromRow !== undefined &&
      opponentMove.fromCol !== undefined &&
      opponentMove.toRow !== undefined &&
      opponentMove.toCol !== undefined;
        
        if (!hasNestedStructure && !hasFlatStructure) {
            console.error("❌ Invalid opponent move structure:", opponentMove);
            return;
        }
        
        // Check if this is actually opponent's move (not our own echo)
        if (opponentMove.playerColor === playerColor) {
            console.log("👤 Ignoring own move (echo)");
      lastOpponentMoveRef.current = opponentMove;
            return;
        }
        
        console.log(`👤 Processing opponent's (${opponentMove.playerColor}) move`);
        applyOpponentMove(opponentMove);
    lastOpponentMoveRef.current = opponentMove;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentMove, playerColor]);

const applyOpponentMove = (moveData) => {
    console.log("📬 Applying opponent move:", moveData);
    
    // Check if moveData is valid
    if (!moveData) {
        console.error("❌ moveData is undefined");
        return;
    }
    
    // Check for BOTH possible structures:
    // 1. Flat fields: fromRow, fromCol, toRow, toCol (what backend sends)
    // 2. Nested objects: from: {row, col}, to: {row, col} (what you expect)
    
    let from, to;
    
    if (moveData.from && moveData.to) {
        // Structure 2: Nested objects
        from = moveData.from;
        to = moveData.to;
        console.log("📋 Using nested object structure");
    } else if (moveData.fromRow !== undefined && moveData.fromCol !== undefined && 
               moveData.toRow !== undefined && moveData.toCol !== undefined) {
        // Structure 1: Flat fields
        from = { row: moveData.fromRow, col: moveData.fromCol };
        to = { row: moveData.toRow, col: moveData.toCol };
        console.log("📋 Using flat field structure");
    } else {
        console.error("❌ moveData missing coordinates:", {
            hasFromTo: !!(moveData.from && moveData.to),
            hasFlatFields: !!(moveData.fromRow !== undefined && moveData.fromCol !== undefined),
            moveData
        });
        return;
    }
    
    const { piece, promotedTo, capturedPiece, castled, isPromotion, isEnPassant, board: newBoardFromData } = moveData;
    const computedFenBefore = moveData.fenBefore || convertBoardToFEN(board);
    let boardAfter = null;
    
    // Validate coordinates
    const fromRow = Number(from?.row);
    const fromCol = Number(from?.col);
    const toRow = Number(to?.row);
    const toCol = Number(to?.col);

    const isValidCoord = (n) => Number.isInteger(n) && n >= 0 && n < 8;

    if (![fromRow, fromCol, toRow, toCol].every(isValidCoord)) {
        console.error("❌ Invalid coordinates:", { from, to, fromRow, fromCol, toRow, toCol });
        return;
    }
    
    console.log(`🎯 Opponent move: ${piece} from [${fromRow},${fromCol}] to [${toRow},${toCol}]`);
    
    // OPTION 1: If board is provided in moveData, use it directly (simpler and more reliable)
    const isValidBoard =
        newBoardFromData &&
        Array.isArray(newBoardFromData) &&
        newBoardFromData.length === 8 &&
        newBoardFromData.every((r) => Array.isArray(r) && r.length === 8);

    if (isValidBoard) {
        console.log("✅ Using board from move data");
        setBoard(newBoardFromData);
        boardAfter = newBoardFromData;
        
        // Update king coordinates based on new board
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                // UI king coordinates are derived from board; no separate tracking needed.
            }
        }
        
    } else {
        // OPTION 2: Apply move manually to current board
        console.log("⚠️ No board in move data, applying move manually");
        const newBoard = board.map((r) => [...r]);
        
        // Handle promotion
        if (isPromotion && promotedTo) {
            console.log(`♟️ Promotion to: ${promotedTo}`);
            newBoard[toRow][toCol] = promotedTo;
        } else {
            newBoard[toRow][toCol] = piece;
        }
        
        newBoard[fromRow][fromCol] = "";
        
        // Handle en passant capture
        if (isEnPassant) {
            console.log("⚡ En passant capture");
            if (piece === 'p') {
                if (toRow - 1 >= 0) newBoard[toRow - 1][toCol] = "";
            } else if (piece === 'P') {
                if (toRow + 1 < 8) newBoard[toRow + 1][toCol] = "";
            }
        }
        
        // Handle castling
        if (castled) {
            console.log("🏰 Castling move");
            if (piece === 'K') {
                if (to.col === 6) { // Short castle
                    newBoard[7][5] = 'R';
                    newBoard[7][7] = "";
                } else if (to.col === 2) { // Long castle
                    newBoard[7][3] = 'R';
                    newBoard[7][0] = "";
                }
            } else if (piece === 'k') {
                if (to.col === 6) { // Short castle
                    newBoard[0][5] = 'r';
                    newBoard[0][7] = "";
                } else if (to.col === 2) { // Long castle
                    newBoard[0][3] = 'r';
                    newBoard[0][0] = "";
                }
            }
        }
        
        // Update board
        setBoard(newBoard);
        boardAfter = newBoard;
        
        // UI king coordinates are derived from board; no separate tracking needed.
        
    // Note: castling rights / rook movement are tracked by the engine state when playing locally.
    // Opponent-move application is legacy and is being kept only for backward compatibility.
    }
    
    // Update move history locally
    const moveNotation = moveData.moveNotation || createMoveNotation(from, to, piece, capturedPiece, castled);
    const computedFenAfter =
        moveData.fenAfter || (boardAfter ? convertBoardToFEN(boardAfter) : convertBoardToFEN(board));
    
    // Add to move history
    const moveToAdd = {
        piece,
        moveFrom: `${String.fromCharCode('a'.charCodeAt(0) + fromCol)}${8-fromRow}`,
        moveTo: `${String.fromCharCode('a'.charCodeAt(0) + toCol)}${8-toRow}`,
        sqnumfrom: 8-fromRow,
        sqnumto: 8-toRow,
        tc: toCol,
        tr: toRow,
        moveNotation,
        fenBefore: computedFenBefore,
        fenAfter: computedFenAfter,
        createdAt: new Date().toISOString(),
        isOpponentMove: true,
        playerColor: moveData.playerColor || 'unknown'
    };
    
    addMove(moveToAdd);
    
    // Update turn locally
    if (typeof moveData.isWhiteTurn === "boolean") {
        setIsWhiteTurn(moveData.isWhiteTurn);
    } else {
        setIsWhiteTurn((prev) => !prev);
    }
    
    console.log("✅ Opponent move applied successfully");
};

// Helper function to create move notation (if not provided)
const createMoveNotation = (from, to, piece, capturedPiece, castled) => {
    if (castled) {
        return to.col === 6 ? "O-O" : "O-O-O";
    }
    
    const fromSquare = `${String.fromCharCode('a'.charCodeAt(0) + from.col)}${8-from.row}`;
    const toSquare = `${String.fromCharCode('a'.charCodeAt(0) + to.col)}${8-to.row}`;
    
    const pieceSymbol = piece.toUpperCase();
    if (piece === 'p' || piece === 'P') {
        if (capturedPiece) {
            return `${fromSquare[0]}x${toSquare}`;
        }
        return toSquare;
    }
    
    return `${pieceSymbol}${capturedPiece ? 'x' : ''}${toSquare}`;
};

  // MODIFICATION 7: Helper function to create move notation
  // const createMoveNotation = (from, to, piece, capturedPiece, castled, newBoard) => {
  //   const fromNotation = `${String.fromCharCode('a'.charCodeAt(0) + from.col)}${8-from.row}`;
  //   const toNotation = `${String.fromCharCode('a'.charCodeAt(0) + to.col)}${8-to.row}`;
    
  //   if (castled) {
  //     return to.col === 6 ? "O-O" : "O-O-O";
  //   }
    
  //   if (capturedPiece) {
  //     return `${piece.toLowerCase() === 'p' ? fromNotation[0] : piece}x${toNotation}`;
  //   }
    
  //   return `${piece.toLowerCase() === 'p' ? '' : piece}${toNotation}`;
  // };

  // ALL YOUR EXISTING FUNCTIONS - KEPT EXACTLY AS IS
  const getPieceIcon = (piece) => {
    switch (piece) {
      case 'r': return '♜';
      case 'n': return '♞';
      case 'b': return '♝';
      case 'q': return '♛';
      case 'k': return '♚';
      case 'p': return '♟';
      case 'R': return '♖';
      case 'N': return '♘';
      case 'B': return '♗';
      case 'Q': return '♕';
      case 'K': return '♔';
      case 'P': return '♙';
      default: return '';
    }
  };

  function isUpperCase(str) {
    return str === str.toUpperCase();
  }

  // Legacy move-generation helpers removed: move legality is handled exclusively by `src/chess/engine.js`.

  // MODIFICATION 8: Update handleSquareClick with connection check
  const handleSquareClick = (row, col) => {
    // Check if connected and it's our turn
    if (!isConnected) {
      alert("Not connected to server!");
      return;
    }
    
    if (!isMyTurn) {
      alert("It's not your turn!");
      return;
    }
    
    const piece = board[row][col];
    if(isSquareSelected && selectedSquare[0] === row && selectedSquare[1] === col){
      setSelectedSquare([]);
      setIsSquareSelected(false);
      setValidMoves([]);
      return;
    }
    if (!piece || (isWhiteTurn && !isUpperCase(piece)) || (!isWhiteTurn && isUpperCase(piece))) return;
    setIsSquareSelected(true);
    setSelectedSquare([row, col]);
    const state = {
      board,
      turn: isWhiteTurn ? "w" : "b",
      castling,
      enPassant,
      halfmoveClock,
      fullmoveNumber,
    };
    const legal = legalMovesForSquare(state, row, col);
    setValidMoves(legal.map((m) => [m.to.row, m.to.col]));
  };

  // MODIFICATION 9: Update handleDragStart with connection check
  const handleDragStart = (e, row, col) => {
    // Check if connected and it's our turn
    if (!isConnected || !isMyTurn) {
      e.preventDefault();
      return;
    }
    
    const piece = board[row][col];
    if (!piece || (isWhiteTurn && !isUpperCase(piece)) || (!isWhiteTurn && isUpperCase(piece))) {
      e.preventDefault();
      return;
    }
    
    setIsSquareSelected(true);
    setSelectedSquare([row, col]);
    const state = {
      board,
      turn: isWhiteTurn ? "w" : "b",
      castling,
      enPassant,
      halfmoveClock,
      fullmoveNumber,
    };
    const legal = legalMovesForSquare(state, row, col);
    setValidMoves(legal.map((m) => [m.to.row, m.to.col]));
    e.dataTransfer.setData("piece", piece);
    e.dataTransfer.setData("fromRow", row);
    e.dataTransfer.setData("fromCol", col);
  };

  // Legacy `isKingInCheck` removed (engine handles check + legality).

  const convertBoardToFEN = (
    b,
    {
      turn = isWhiteTurn ? "w" : "b",
      castling: cs = castling,
      enPassant: ep = enPassant,
      halfmoveClock: half = halfmoveClock,
      fullmoveNumber: full = fullmoveNumber,
    } = {}
  ) => {
    const rows = [];
    for (let row of b) {
      let rowStr = '';
      let emptyCount = 0;

      for (let square of row) {
        if (square === '') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount;
            emptyCount = 0;
          }
          rowStr += square;
        }
      }

      if (emptyCount > 0) {
        rowStr += emptyCount;
      }

      rows.push(rowStr);
    }

    const boardFEN = rows.join('/');
    const activeColor = turn;
    const castlingRights = ["K","Q","k","q"].filter((k) => cs?.[k]).join("") || "-";
    const enPassantStr = ep ? `${String.fromCharCode("a".charCodeAt(0) + ep.col)}${8 - ep.row}` : "-";
    const fen = `${boardFEN} ${activeColor} ${castlingRights} ${enPassantStr} ${half} ${full}`;

    return fen;
  };

  const updatePrevMove = (fr, fc, tr, tc, piece, capturedPiece, castled, fenBefore, fenAfter, opponentInCheck) => {
    const sqnumfrom = 8-fr;
    const sqnumto = 8-tr;
    let moveFrom = String.fromCharCode('a'.charCodeAt(0) + fc);
    let moveTo = String.fromCharCode('a'.charCodeAt(0) + tc);

    if(castled){
      if(tc === 2){
        moveTo = "O-O-O";
      }
      else{
        moveTo = "O-O";
      } 
    }
    else{
      if(capturedPiece === ""){
        moveFrom += sqnumfrom;
        moveTo = "" + (piece.toLowerCase() === "p" ? "" : piece) + moveTo + sqnumto;
      }
      else{
        moveTo = (piece.toLowerCase() === "p" ? moveFrom : piece) + "x" + moveTo + sqnumto;
        moveFrom += sqnumfrom;
      }
    }

    if (opponentInCheck) {
      moveTo += "+";
    }
    
    const createdAt = new Date().toISOString();
    // prevMove is no longer used for rules logic; move history is tracked via addMove
    
    // MODIFICATION 10: Add move to local history
    addMove({piece, moveFrom, moveTo, sqnumfrom, sqnumto, tc , tr, fenBefore, fenAfter, createdAt});

    // Note: castling rights and king/rook movement are tracked by engine state; UI coordinates are
    // updated at move-apply time.
  }

  // MODIFICATION 11: Update handlePromotion to send move to server
  const handlePromotion = (promotionPiece) => {
    if (!promotingPawn?.baseMove) return;

    const state = {
      board,
      turn: isWhiteTurn ? "w" : "b",
      castling,
      enPassant,
      halfmoveClock,
      fullmoveNumber,
    };

    const promo = String(promotionPiece).toLowerCase(); // q/r/b/n
    const move = { ...promotingPawn.baseMove, promotion: promo };
    const fenBefore = promotingPawn.fenBefore;
    const piece = promotingPawn.piece;
    const capturedPiece = promotingPawn.capturedPiece || "";
    const castled = !!move.castle;

    const next = makeMove(state, move);

    // sync board + engine state
    setBoard(next.board);
    setCastling(next.castling);
    setEnPassant(next.enPassant);
    setHalfmoveClock(next.halfmoveClock);
    setFullmoveNumber(next.fullmoveNumber);
    setIsWhiteTurn(next.turn === "w");

    // UI coordinates are derived from board; no separate king/rook moved flags are needed.

    const opponentInCheck = isInCheck(next, next.turn);
    const fenAfter = convertBoardToFEN(next.board, next);
    updatePrevMove(move.from.row, move.from.col, move.to.row, move.to.col, piece, capturedPiece, castled, fenBefore, fenAfter, opponentInCheck);

    // Endgame detection
    const outcome = getGameOutcome(next);
    if (outcome.status === "checkmate") alert("Checkmate!");
    if (outcome.status === "stalemate") alert("Stalemate!");

    setShowModal(false);
    setPromotingPawn(null);
  };

  // MODIFICATION 13: Update handleDrop to send move to server
  const handleDrop = (e, row, col) => {
    // Check connection and turn
    if (!isConnected) {
      alert("Not connected to server!");
      return;
    }
    
    if (!isMyTurn) {
      alert("It's not your turn!");
      return;
    }
    
    let piece = e.dataTransfer.getData("piece");
    const fromRow = parseInt(e.dataTransfer.getData("fromRow"));
    const fromCol = parseInt(e.dataTransfer.getData("fromCol"));
    const state = {
      board,
      turn: isWhiteTurn ? "w" : "b",
      castling,
      enPassant,
      halfmoveClock,
      fullmoveNumber,
    };
    const fenBefore = convertBoardToFEN(board, state);
    
    if (validMoves.some(([r, c]) => r === row && c === col)) {
      const legal = legalMovesForSquare(state, fromRow, fromCol);
      const chosen = legal.find((m) => m.to.row === row && m.to.col === col);
      if (!chosen) {
        console.warn("Illegal move (no matching legal move found).");
        return;
      }

      // If promotion, delay until modal choice
      if (chosen.promotion) {
        setPromotingPawn({
          baseMove: chosen,
          piece,
          capturedPiece: board[row][col],
          fenBefore,
        });
        setShowModal(true);
        setIsSquareSelected(false);
        setSelectedSquare([]);
        setValidMoves([]);
        return;
      }

      const next = makeMove(state, chosen);

      setBoard(next.board);
      setCastling(next.castling);
      setEnPassant(next.enPassant);
      setHalfmoveClock(next.halfmoveClock);
      setFullmoveNumber(next.fullmoveNumber);
      setIsWhiteTurn(next.turn === "w");

      // UI coordinates are derived from board; no separate king/rook moved flags are needed.

      const castled = !!chosen.castle;
      const capturedPiece = chosen.enPassant ? (piece === "P" ? "p" : "P") : board[row][col];
      const opponentInCheck = isInCheck(next, next.turn);
      const fenAfter = convertBoardToFEN(next.board, next);

      updatePrevMove(fromRow, fromCol, row, col, piece, capturedPiece || "", castled, fenBefore, fenAfter, opponentInCheck);

      const outcome = getGameOutcome(next);
      if (outcome.status === "checkmate") alert("Checkmate!");
      if (outcome.status === "stalemate") alert("Stalemate!");
    }
    setIsSquareSelected(false);
    setSelectedSquare([]);
    setValidMoves([]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="chessboard-container">
      {/* MODIFICATION 15: Add connection status indicator */}
      <div className="connection-indicator">
        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢' : '🔴'}
        </span>
        <span className="status-text">
          {isConnected ? 'Connected' : 'Disconnected'} | 
          {isMyTurn ? ' Your turn' : ' Opponent\'s turn'} | 
          Playing as: <strong>{playerColor}</strong>
        </span>
      </div>
      
      <div
        ref={boardRef}
        className="chessboard"
        style={{ width: boardSize, height: boardSize }}
      >
        {/* Render the board */}
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((piece, colIndex) => (
              <div
                key={colIndex}
                className={`square ${((rowIndex + colIndex) % 2 === 0) ? 'light' : 'dark'}`}
                style={{ width: `${100 / 8}%` }}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
                onDragStart={(e) => handleDragStart(e, rowIndex, colIndex)}
                onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                onDragOver={handleDragOver}
                draggable={piece !== "" && isConnected && isMyTurn}  // MODIFICATION 16: Update draggable condition
              >
                {getPieceIcon(piece)}
                {validMoves.some(([r, c]) => r === rowIndex && c === colIndex) && (
                  <div className="valid-move-overlay"></div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <PromotionModal
        showModal={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handlePromotion}
      />
    </div>
  );
};

export default Board;