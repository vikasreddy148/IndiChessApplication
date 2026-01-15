import React, { useState, useEffect, useRef } from "react";
import BoardLayout from "./BoardLayout";
import GamePlayControlContainer from "./GamePlayControlContainer";

const GameContainer = ({ matchId, stompClient, isConnected, playerColor, initialGameData }) => {
  const [moves, setMoves] = useState([]);
  const [isMyTurn, setIsMyTurn] = useState(initialGameData?.isMyTurn || (playerColor === 'white'));
  const [gameStatus, setGameStatus] = useState(initialGameData?.status || "Game started");
  const [opponentMove, setOpponentMove] = useState(null); // To trigger board updates
  const moveSubscriptionRef = useRef(null);

  // Listen for WebSocket messages
  useEffect(() => {
    if (!stompClient || !isConnected) return;

    // Subscribe to move updates
    moveSubscriptionRef.current = stompClient.subscribe(`/topic/moves/${matchId}`, (message) => {
      try {
        const moveData = JSON.parse(message.body);
        console.log("Received opponent move:", moveData);
        
        // Set opponent move to trigger board update
        setOpponentMove(moveData);
        
        // Update turn
        setIsMyTurn(true);
        setGameStatus("Your turn!");
        
        // Add move to history if provided
        if (moveData.move) {
          addMove(moveData.move);
        }
      } catch (error) {
        console.error("Error parsing move data:", error);
      }
    });

    // Subscribe to game state updates
    stompClient.subscribe(`/topic/game-state/${matchId}`, (message) => {
      try {
        const state = JSON.parse(message.body);
        console.log("Game state update:", state);
        
        if (state.isMyTurn !== undefined) {
          setIsMyTurn(state.isMyTurn);
        }
        if (state.status) {
          setGameStatus(state.status);
        }
        
        if (state.result) {
          // Game ended
          setGameStatus(`Game Over: ${state.result}`);
          alert(`Game Over: ${state.result}`);
        }
      } catch (error) {
        console.error("Error parsing game state:", error);
      }
    });

    return () => {
      if (moveSubscriptionRef.current) {
        moveSubscriptionRef.current.unsubscribe();
      }
    };
  }, [stompClient, isConnected, matchId]);

  const addMove = (move) => {
    // Your existing move adding logic
    if(move.piece !== move.piece.toLowerCase()) {
      // White's move
      const newMove = {
        move: move,
        moveToWhite: move.moveTo,
        fen: move.fen,
        tc: `White's Turn: ${move.tc || ''}`,
        tr: move.tr || ''
      };
      setMoves((moves) => [...moves, newMove]);
    } else {
      // Black's move - update last move
      setMoves((prevMoves) => {
        if (prevMoves.length === 0) return prevMoves;
        
        const newMoves = [...prevMoves];
        const lastMove = { 
          ...newMoves[newMoves.length - 1], 
          moveToBlack: move.moveTo,
          tc: `Black's Turn: ${move.tc || ''}`,
          tr: move.tr || '',
          fen: move.fen
        };
        newMoves[newMoves.length - 1] = lastMove;
        return newMoves;
      });
    }
  };

  // Function to send move to server
  const sendMove = (moveData) => {
    if (!stompClient || !isConnected) {
      alert("Not connected to server!");
      return false;
    }

    if (!isMyTurn) {
      alert("It's not your turn!");
      return false;
    }

    console.log("Sending move to server:", moveData);
    
    // Send move via WebSocket
    stompClient.publish({
      destination: `/app/game/${matchId}/move`,
      body: JSON.stringify({
        ...moveData,
        playerColor: playerColor,
        timestamp: new Date().toISOString(),
        matchId: matchId
      })
    });

    setIsMyTurn(false);
    setGameStatus("Waiting for opponent...");
    return true;
  };

  // Function to handle game actions
  const handleGameAction = (action, data = {}) => {
    if (!stompClient || !isConnected) {
      alert("Not connected to server!");
      return;
    }

    console.log(`Sending ${action} action:`, data);
    
    stompClient.publish({
      destination: `/app/game/${matchId}/${action}`,
      body: JSON.stringify({
        ...data,
        playerColor: playerColor,
        timestamp: new Date().toISOString(),
        matchId: matchId
      })
    });
  };

  return (
    <div className="game-container">
      {/* Game status bar */}
      <div className="game-status-bar">
        <div className="status-info">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span className="player-info">Playing as: <strong>{playerColor}</strong></span>
          <span className="turn-info">{gameStatus}</span>
          <span className="turn-indicator">{isMyTurn ? '✓ Your turn' : '⏳ Opponent\'s turn'}</span>
        </div>
        <div className="game-actions">
          <button 
            className="btn-action btn-resign"
            onClick={() => {
              if (window.confirm("Are you sure you want to resign?")) {
                handleGameAction('resign');
              }
            }}
          >
            Resign
          </button>
          <button 
            className="btn-action btn-draw"
            onClick={() => handleGameAction('draw')}
          >
            Offer Draw
          </button>
        </div>
      </div>
      
      <BoardLayout 
        addMove={addMove}
        sendMove={sendMove}
        opponentMove={opponentMove} // Pass opponent's move down
        playerColor={playerColor}
        isMyTurn={isMyTurn}
        matchId={matchId}
        isConnected={isConnected}
      />
      <GamePlayControlContainer 
        moves={moves}
        matchId={matchId}
        stompClient={stompClient}
        isConnected={isConnected}
        playerColor={playerColor}
      />
    </div>
  );
};

export default GameContainer;