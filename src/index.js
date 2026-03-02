import express from "express";
import { matchesRouter } from "./routes/matches.js";
import http from "http";
import { attachWebSocketServer } from "./ws/server.js";

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello From Express Server!");
});

app.use("/matches", matchesRouter);

const { broadCastMatchCreated } = attachWebSocketServer(server);
app.locals.broadCastMatchCreated = broadCastMatchCreated;

server.listen(PORT, HOST, () => {
  const baseURL =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on port ${baseURL}`);
  console.log(
    `Websocket Server Running on Port ${baseURL.replace("http", "ws")}/ws`,
  );
});
