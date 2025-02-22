import { ClientSession, Types } from "mongoose";
import assert from "assert";
import { Socket } from "socket.io";

import { User, UserModel } from "../models/user";
import { ChatModel } from "../models/chat";

import { withTransaction } from "../helpers/db";

const getInitialUserMemory = (user: User) => [
  `I'm a virtual developer, my name is ${user.name}`,
];

const userWebsockets: Record<string, Socket | undefined> = {};

export const getUserFromReq = (req: Request) => {
  return (req as any).user as { userId: string } | undefined;
};

export const getUserWebsocket = (user: Types.ObjectId) => {
  return userWebsockets[user.toHexString()];
};

export const setUserWebsocket = (user: Types.ObjectId, ws?: Socket) => {
  return (userWebsockets[user.toHexString()] = ws);
};

export const initDeveloper = async (user: User) => {
  const memory = getInitialUserMemory(user);

  await UserModel.updateOne({ _id: user._id }, { $set: { memory } });

  user.memory = memory;
};

export const createOrGetUser = async (
  name: string,
  session?: ClientSession
) => {
  let user = await UserModel.findOne({ name }).lean();

  if (!user) {
    await withTransaction(async (session) => {
      user = new UserModel({ name });

      await UserModel.create([user], { session });
      await ChatModel.create(
        [{ user: user._id, content: "How can I help you today?" }],
        {
          session,
        }
      );
    }, session);
  }

  assert.ok(user);

  return user;
};
