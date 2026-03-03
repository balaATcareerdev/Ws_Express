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
    noServer: true,
    maxPayload: 1024 * 1024,
  });

  // Handle WebSocket upgrade at HTTP level for Arcjet protection
  server.on("upgrade", async (request, socket, head) => {
    if (request.url !== "/ws") {
      socket.destroy();
      return;
    }

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(request);
        if (decision.isDenied()) {
          const statusCode = decision.reason.isRateLimit() ? 429 : 403;
          const statusMessage = decision.reason.isRateLimit()
            ? "Too Many Requests"
            : "Forbidden";

          socket.write(
            `HTTP/1.1 ${statusCode} ${statusMessage}\r\n` +
              `Content-Type: text/plain\r\n` +
              `Connection: close\r\n\r\n` +
              statusMessage,
          );
          socket.destroy();
          return;
        }
      } catch (error) {
        console.error("Arcjet WebSocket Protection Error:", error);
        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\n" +
            "Content-Type: text/plain\r\n" +
            "Connection: close\r\n\r\n" +
            "Service Unavailable",
        );
        socket.destroy();
        return;
      }
    }

    // If allowed, proceed with WebSocket handshake
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket, request) => {
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
