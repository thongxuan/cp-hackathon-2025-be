import mongoose from "mongoose";
import express from "express";

import {MONGO_URL, PORT} from "./config";

import {router as userRouter} from "./routes/user";

async function main() {
  await mongoose.connect(MONGO_URL, {autoIndex: true});

  const app = express();

  app.use((req, res, next) => {
    //-- session middleware
    const userId = req.headers["x-user-id"] || "";

    (req as any).user = userId ? {userId} : undefined;

    next();
  });

  app.use(userRouter);

  app.listen(parseInt(PORT));

  console.log(`server is listening at ${PORT}`);
}

main().catch((err) => console.error(err));
