import mongoose, { Types } from 'mongoose';
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import url from 'url';
import bodyParser from 'body-parser';
import cors from 'cors';
import { MONGO_URL, PORT } from './config';

import { router as userRouter } from './routes/user';
import { router as chatRouter } from './routes/chat';

import { setUserWebsocket } from './services/user';

async function main() {
  await mongoose.connect(MONGO_URL, { autoIndex: true });

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    serveClient: false,
    cors: {
      origin: '*',
    },
  });
  app.use(bodyParser.json());
  app.use(cors());

  io.on('connection', (socket) => {
    const query = socket.handshake.query;
    const userId = query.user as string;

    if (!userId) {
      socket.disconnect();
      return;
    }

    console.log(`User socket connected: ${userId}`);

    setUserWebsocket(new Types.ObjectId(userId), socket);
  });

  app.use((req, res, next) => {
    //-- session middleware
    const userId = req.headers['x-user-id'] || '';

    (req as any).user = userId ? { userId } : undefined;

    next();
  });

  app.use(userRouter);
  app.use(chatRouter);

  server.listen(parseInt(PORT));

  console.log(`server is listening at ${PORT}`);
}

main().catch((err) => console.error(err));
