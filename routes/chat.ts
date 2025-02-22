import express from 'express';
import { ChatModel } from '../models/chat';

const router = express.Router();

router.get('/chats', async (req: any, res) => {
  const messages = await ChatModel.find({ user: req.user.userId });
  res.json(messages);
});

router.post('/chats', async (req: any, res) => {
  const message = await ChatModel.insertOne({ user: req.user.userId, content: req.body.content });
  res.json(message);
});

export { router };
