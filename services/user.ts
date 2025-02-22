import {ClientSession} from "mongoose";
import assert from "assert";

import {User, UserModel} from "../models/user";

import {withTransaction} from "../helpers/db";

const getInitialUserMemory = (user: User) => [
  `I'm a virtual developer, my name is ${user.name}`,
];

export const getUserFromReq = (req: Request) => {
  return (req as any).user as {userId: string} | undefined;
};

export const initDeveloper = async (user: User) => {
  const memory = getInitialUserMemory(user);

  await UserModel.updateOne({_id: user._id}, {$set: {memory}});

  user.memory = memory;
};

export const createOrGetUser = async (
  name: string,
  session?: ClientSession,
) => {
  let user = await UserModel.findOne({name}).lean();

  if (!user) {
    await withTransaction(async (session) => {
      user = new UserModel({name});

      await UserModel.create([user], {session});
    }, session);
  }

  assert.ok(user);

  return user;
};
