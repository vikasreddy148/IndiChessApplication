import { Client } from "@stomp/stompjs";
import { API_BASE_URL } from "../config/api";

export function createStompClient() {
  // Use native WebSocket endpoint (avoids SockJS + Vite "global is not defined" issue)
  // Backend registers a non-SockJS endpoint at /ws.
  const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws";

  const client = new Client({
    brokerURL: wsUrl,
    reconnectDelay: 2000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000
  });

  return client;
}


