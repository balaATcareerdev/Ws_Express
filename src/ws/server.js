import { WebSocketServer, WebSocket } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }
    client.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", async (socket, request) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(request);
        if (decision.isDenied) {
          const code = decision.reason.isRateLimit ? 1013 : 1008; // 1013 for rate limit, 1008 for policy violation

          const reason = decision.reason.isRateLimit
            ? "Rate limit exceeded"
            : "Access Denied";
          socket.close(code, reason);
          return;
        }
      } catch (error) {
        console.error("Arcjet WebSocket Protection Error:", error);
        socket.close(1011, "Server Security Error");
        return;
      }
    }

    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    sendJson(socket, { type: "Welcome" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  function broadCastMatchCreated(match) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadCastMatchCreated };
}
