import express from "express";

import { createOrGetUser, initDeveloper } from "../services/user";
import { executeTask, getPendingTask } from "../services/task";

const router = express.Router();

router.post("/users", async (req, res) => {
  const user = await createOrGetUser(req.body.name);

  if (!user.memory?.length) {
    await initDeveloper(user);
  }

  res.json(user);
});

router.get("/task", async (req, res) => {
  const user = await createOrGetUser("thongdx");

  const task = await getPendingTask(user._id);

  console.log("task here", task);
  if (task) {
    await executeTask(user, task, (message) => {
      console.log(`< ${message}`);
    });
  }
  res.send();
});

export { router };
