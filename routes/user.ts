import express from "express";

import { createOrGetUser, initDeveloper } from "../services/user";
import { AiDeveloper } from "../services/developer";
import { ChatModel } from "../models/chat";

const router = express.Router();

router.post("/users", async (req, res) => {
  const user = await createOrGetUser(req.body.name);

  if (!user.memory?.length) {
    await initDeveloper(user);
  }

  res.json(user);
});

router.get("/test", async (req, res) => {
  const user = await createOrGetUser("thongdx");

  if (!user.memory?.length) {
    await initDeveloper(user);
  }

  const aid = new AiDeveloper(user, (chat) => {
    //-- store chat
    ChatModel.create([chat]);
    console.log("chat back: ", chat.content);
  });

  await aid.receiveChat("Hi");

  // await aid.receiveChat("What's your name");

  await aid.receiveChat(
    "I've added you to a new project called 'Hackathon 2025'"
  );

  await aid.receiveChat("This is a new project");

  await aid.receiveChat(
    "You must perform your task more careful. Also for typescript repo, please always format with trailing semi-colon."
  );

  await aid.receiveChat("I got a new task for you");

  // await aid.receiveChat("This is a new project");

  // await aid.receiveChat("Sorry it should be called Hackathon 2026");
  // await aid.receiveChat("Sorry is the same project");

  // await aid.receiveChat(
  //   "I have a task for you. I would like to update the button color in the home page to a nice red color.",
  // );

  res.send();
});

export { router };
