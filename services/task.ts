import { Types } from "mongoose";
import assert from "assert";

import { GPT_ASSISTANT_ID } from "../config";

import { Task, TaskModel } from "../models/task";
import { ProjectModel } from "../models/project";
import { ProjectRepoModel } from "../models/project-repo";
import { User, UserModel } from "../models/user";

import { cloneRepoSourceCode, syncFilesToGpt } from "./git";
import { determinedTaskSuccess, openai } from "./ai";

export const getPendingTask = async (user: Types.ObjectId) => {
  return await TaskModel.findOne({ user, pending: true }).lean();
};

export const createAndExecuteTask = async (
  task: Task,
  updateWithMessage: (message: string) => void
) => {
  assert.ok(task.user && task.repo && task.requirements?.length);

  await TaskModel.create([task]);

  const user = await UserModel.findById(task.user).lean();

  assert.ok(user);

  await executeTask(user, task, updateWithMessage);
};

const generateSolutionFromTask = async (
  requirements: string[],
  files: { uri: string; open_ai_id: string }[],
  updateWithMessage: (message: string) => void
) => {
  console.log("generateSolutionFromTask", requirements, files);

  const refFiles = files.filter((f) => f.uri.endsWith(".ts")).slice(0, 20);

  console.log("refFiles", refFiles);

  openai.beta.assistants.update(GPT_ASSISTANT_ID, {
    tool_resources: {
      code_interpreter: {
        file_ids: refFiles.map((f) => f.open_ai_id),
      },
    },
  });

  const thread = await openai.beta.threads.create();

  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: `
    Generate a Git diff based on these requirements:\n\n${requirements.join(
      "\n"
    )}
    
    The response must have the following format, just like git diff

    # id of the file uploaded to open AI
    + [line-number]: the suggested code line
    - [line-number]: the original code line
    + [line-number]: the suggested code line
    - [line-number]: the original code line

    # id of other file uploaded to open AI
    + [line-number]: the suggested code line
    - [line-number]: the original code line
    + [line-number]: the suggested code line
    - [line-number]: the original code line

    `,
  });

  console.log("creat run");

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: GPT_ASSISTANT_ID,
  });

  let status = run.status;

  const now = Date.now();

  while (status === "queued" || status === "in_progress") {
    console.log("checking run status...", status);
    updateWithMessage(
      `Working on the solution... ${Math.ceil((Date.now() - now) / 1000)}s`
    );
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s

    const updatedRun = await openai.beta.threads.runs.retrieve(
      thread.id,
      run.id
    );

    status = updatedRun.status;
  }

  console.log("run finished");

  // Step 6: Retrieve response and determined if this is a success run
  if (status === "completed") {
    const messages = await openai.beta.threads.messages.list(thread.id);

    return { success: true, solution: messages.data[0].content.join("\n") };
  } else {
    return { success: false };
  }
};

export const executeTask = async (
  user: User,
  task: Task,
  updateWithMessage: (message: string) => void
) => {
  //-- check and clone the repo
  const repo = await ProjectRepoModel.findById(task.repo).lean();
  assert.ok(repo);

  const project = await ProjectModel.findById(repo.project).lean();
  assert.ok(project);

  //-- clone source code
  // await listAndRemoveAllUploadedFiles();
  updateWithMessage("Cloning source code...");
  const repoPath = await cloneRepoSourceCode(project, repo);

  updateWithMessage("Syncing files...");
  const files = await syncFilesToGpt(repoPath, repo);

  updateWithMessage("Generating solution...");

  const result = await generateSolutionFromTask(
    task.requirements || [],
    files.flatMap((file) =>
      file.openai_file_id
        ? [{ uri: file.uri, open_ai_id: file.openai_file_id }]
        : []
    ),
    updateWithMessage
  );

  if (!result.success || !result.solution) {
    updateWithMessage("Sorry I failed to execute the task");

    return;
  } else {
    //-- determine result from solution
    const response = await determinedTaskSuccess(
      user,
      task.requirements || [],
      result.solution
    );

    if (response.positive) {
      updateWithMessage(`Here is my solution: ${result.solution}`);
      updateWithMessage(
        "Cannot creating PR right now because we don't have time left =)))"
      );
    } else {
      updateWithMessage(response.chat || "Sorry I cannot complete the task");
    }
  }

  await TaskModel.updateOne(task._id, { $set: { pending: false } });
};
