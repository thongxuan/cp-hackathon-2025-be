import express from "express";

import {createOrGetUser, initDeveloper} from "../services/user";
import {AiDeveloper} from "../developer";
import {ChatModel} from "../models/chat";

const router = express.Router();

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
    "I've added you to a new project called 'Hackathon 2025'",
  );

  await aid.receiveChat("This is a new project");

  // await aid.receiveChat(
  //   "This project had one repo, here is the repo git url: ''. I added you to the repo and here is your Git personal access token.",
  // );

  // await aid.receiveChat(
  //   "I have a task for you. I would like to update the button color in the home page to a nice red color.",
  // );
});

export {router};
