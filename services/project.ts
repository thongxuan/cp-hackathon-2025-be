import {ClientSession} from "mongoose";

import {withTransaction} from "../helpers/db";

import {Project, ProjectModel} from "../models/project";
import {User} from "../models/user";

export const initNewProject = async (
  user: User,
  project: Partial<Project>,
  session?: ClientSession,
) => {
  await withTransaction(async (session) => {
    await ProjectModel.create([{...project, user: user._id}], {session});
  }, session);
};
