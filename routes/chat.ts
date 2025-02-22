import express from "express";

import { ChatModel } from "../models/chat";

import { getUserFromReq } from "../services/user";
import { getDeveloperOfUser } from "../services/developer";

const router = express.Router();

router.get("/chats", async (req: any, res) => {
  const user = getUserFromReq(req);

  const messages = !user
    ? []
    : await ChatModel.find({ user: req.user.userId }, null, {
        sort: { created_at: 1 },
      });

  res.json(messages);
});

router.post("/chats", async (req: any, res) => {
  const user = getUserFromReq(req);

  if (!user) {
    return;
  }

  const message = await ChatModel.insertOne({
    user: user.userId,
    content: req.body.content,
    outbound: true,
  });

  getDeveloperOfUser(user.userId).then((developer) =>
    developer.receiveChat(message.content)
  );

  res.json(message);
});

export { router };
