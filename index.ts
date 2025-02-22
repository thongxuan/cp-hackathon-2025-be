import mongoose, {Types} from "mongoose";
import express from "express";
import {WebSocketServer} from "ws";
import http from "http";
import url from "url";

import {MONGO_URL, PORT} from "./config";

import {router as userRouter} from "./routes/user";

import {setUserWebsocket} from "./services/user";

async function main() {
  await mongoose.connect(MONGO_URL, {autoIndex: true});

  const app = express();
  const server = http.createServer(app);
  const serverWs = new WebSocketServer({server});

  serverWs.on("connection", (ws, req) => {
    const query = url.parse(req.url || "", true).query;
    const userId = query.user as string;

    if (!userId) {
      ws.close(1008, "User ID required");
      return;
    }

    console.log(`User socket connected: ${userId}`);

    setUserWebsocket(new Types.ObjectId(userId), ws);
  });

  app.use((req, res, next) => {
    //-- session middleware
    const userId = req.headers["x-user-id"] || "";

    (req as any).user = userId ? {userId} : undefined;

    next();
  });

  app.use(userRouter);

  server.listen(parseInt(PORT));

  console.log(`server is listening at ${PORT}`);
}

main().catch((err) => console.error(err));
