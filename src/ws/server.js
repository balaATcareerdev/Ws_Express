import { WebSocketServer, WebSocket } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }

  matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanUpSubscriptions(socket) {
  for (const matchId of socket.subcriptions) {
    unsubscribe(matchId, socket);
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }
    client.send(JSON.stringify(payload));
  }
}

function handleMessage(socket, data) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
  }

  if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
    subscribe(message.matchId, socket);
    socket.subcriptions.add(message.matchId);
    sendJson(socket, { type: "subscribed", matchId: message.matchId });
    return;
  }

  if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unsubscribe(message.matchId, socket);
    socket.subcriptions.delete(message.matchId);
    sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
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

    socket.subcriptions = new Set();

    sendJson(socket, { type: "Welcome" });

    socket.on("message", (data) => handleMessage(socket, data));

    socket.on("error", () => socket.terminate());

    socket.on("close", () => {
      cleanUpSubscriptions(socket);
    });

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
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadCastCommentary(matchId, comments) {
    broadcastToMatch(matchId, { type: "commentary", data: comments });
  }

  return { broadCastMatchCreated, broadCastCommentary };
}
