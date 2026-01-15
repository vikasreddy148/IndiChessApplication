import Header from "../components/Header";
import SideNav from "../components/SideNav";
import GameContainer from "../components/game-page-components/GameContainer";
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

const Game = () => {
  const { matchId } = useParams();
  const [stompClient, setStompClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);

  useEffect(() => {
    if (!matchId) {
      setError("No match ID provided");
      return;
    }

    let cancelled = false;

    const loadGame = async () => {
      try {
        // Match details are served by MatchController under /game/{matchId}
        const response = await fetch(`${API_BASE_URL}/game/${matchId}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) throw new Error("Failed to fetch game data");
        const data = await response.json();

        if (cancelled) return;

        setPlayerColor(data.playerColor || "white");
        setGameData(data);
        setError(null);
        console.log("Game data loaded:", data);
      } catch (e) {
        console.error("Error fetching game details:", e);
        if (!cancelled) setError("Failed to load game details");
      }
    };

    loadGame();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (!matchId || !playerColor) return;

    // WebSocket connection
    const socket = new SockJS(`${API_BASE_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str) => console.log('STOMP: ' + str),
      
      onConnect: (frame) => {
        console.log("Connected to WebSocket:", frame);
        setIsConnected(true);
        setError(null);

        // Notify server that player has joined
        client.publish({
          destination: `/app/game/${matchId}/join`,
          body: JSON.stringify({ 
            type: 'PLAYER_JOINED',
            playerColor: playerColor,
            timestamp: new Date().toISOString()
          })
        });
      },
      
      onStompError: (frame) => {
        console.error("STOMP error:", frame);
        setError(`Connection error: ${frame.headers?.message || 'Unknown error'}`);
        setIsConnected(false);
      },
      
      onWebSocketError: (error) => {
        console.error("WebSocket error:", error);
        setError("Failed to connect to game server");
        setIsConnected(false);
      },
      
      onDisconnect: () => {
        console.log("Disconnected from WebSocket");
        setIsConnected(false);
      }
    });
    
    client.activate();
    setStompClient(client);

    return () => {
      if (client) {
        client.deactivate();
      }
    };
  }, [matchId, playerColor]);

  if (error) {
    return (
      <div className="app-container">
        <SideNav />
        <div className="main-container">
          <Header />
          <div className="error-container">
            <h2>Error</h2>
            <p>{error}</p>
            <button onClick={() => window.location.href = '/'}>Return to Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameData || !isConnected) {
    return (
      <div className="app-container">
        <SideNav />
        <div className="main-container">
          <Header />
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading game...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <SideNav />
      <div className="main-container">
        <Header />
        <GameContainer 
          matchId={matchId}
          stompClient={stompClient}
          isConnected={isConnected}
          playerColor={playerColor}
          initialGameData={gameData}
        />
      </div>
    </div>
  );
};

export default Game;