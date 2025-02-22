import { Types } from "mongoose";
import assert from "assert";

import { Task, TaskModel } from "../models/task";
import { ProjectModel } from "../models/project";
import { ProjectRepoModel } from "../models/project-repo";

import { cloneRepoSourceCode, syncFilesToGpt } from "./git";

export const getPendingTask = async (user: Types.ObjectId) => {
  return await TaskModel.findOne({ user, pending: true }).lean();
};

export const createAndExecuteTask = async (
  task: Task,
  updateWithMessage: (message: string) => void
) => {
  assert.ok(task.user && task.repo && task.requirements?.length);

  await TaskModel.create([task]);

  await executeTask(task, updateWithMessage);
};

export const executeTask = async (
  task: Task,
  updateWithMessage: (message: string) => void
) => {
  //-- check and clone the repo
  const repo = await ProjectRepoModel.findById(task.repo).lean();
  assert.ok(repo);

  const project = await ProjectModel.findById(repo.project).lean();
  assert.ok(project);

  //-- clone source code
  updateWithMessage("Cloning source code...");
  const repoPath = await cloneRepoSourceCode(project, repo);

  updateWithMessage("Syncing files...");
  await syncFilesToGpt(repoPath, repo);

  updateWithMessage("Generating solution...");

  updateWithMessage("Creating PR...");

  updateWithMessage("Finish");
};
