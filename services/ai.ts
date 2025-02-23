import assert from "assert";
import OpenAI from "openai";

import { GPT_MODEL, OPEN_AI_KEY } from "../config";

import { Project } from "../models/project";
import { User } from "../models/user";
import { Chat } from "../models/chat";
import { ProjectRepo } from "../models/project-repo";

import {
  getDetermineActionsPrompt,
  getDetermineDecisionPrompt,
  getDetermineNewProjectNamePrompt,
  getDetermineTaskRequirementClearedPrompt,
  getResolveCurrentFollowUpPrompt,
  getVerifyExistingProjectPrompt,
} from "./prompt";

export enum DeveloperAction {
  JUST_A_CHAT = "JUST_A_CHAT",
  UPDATE_PERSONAL_INFO = "UPDATE_PERSONAL_INFO",
  ASSIGN_NEW_PROJECT = "ASSIGN_NEW_PROJECT",
  UPDATE_PROJECT_INFO = "UPDATE_PROJECT_INFO",
  UPDATE_PROJECT_GIT_REPO = "UPDATE_PROJECT_GIT_REPO",
  GENERATE_PULL_REQUEST_FROM_REQUIREMENTS = "GENERATE_PULL_REQUEST_FROM_REQUIREMENTS",
}

export const openai = new OpenAI({ apiKey: OPEN_AI_KEY });

export interface ChatResponse {
  chat?: string; //-- chat back message
}

export interface PositiveResponse extends ChatResponse {
  positive?: boolean;
}

export interface DecisionResponse<T> extends ChatResponse {
  positive: boolean;
  decision: T;
}

export interface ActionResponse extends ChatResponse {
  type: DeveloperAction;
  project?: string; //-- name of the project
  repo?: string;
  gitUrl?: string;
  gitAccessToken?: string;
  memory?: string[];
  baseBranch?: string;
  requirements?: string[];
}
const request = async <T>(user: User, content: string) => {
  assert.ok(user.memory?.length);

  const memory = user.memory.map(
    (m) => ({ role: "system", content: m } as const)
  );

  const response = await openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [...memory, { role: "user", content }],
  });

  try {
    const json = JSON.parse(response.choices[0].message.content as string);

    return json as T;
  } catch (err) {
    //-- TODO: could not parse JSON, retry or do something?
    console.log("cannot parse JSON", response.choices[0].message.content);
    throw err;
  }
};

export const determineActionsFromChat = async (
  user: User,
  projects: Project[],
  repos: ProjectRepo[],
  chats: Chat[]
) => {
  return await request<ActionResponse[]>(
    user,
    getDetermineActionsPrompt(projects, repos, chats)
  );
};

export const determineDecisionMade = async <T>(
  user: User,
  chats: Chat[],
  decisionFormat: string
) => {
  return await request<DecisionResponse<T>>(
    user,
    getDetermineDecisionPrompt(chats, decisionFormat)
  );
};

interface DetermineNewProjectNameResponse extends ChatResponse {
  isNewProject?: boolean;
}
export const determineNewProjectName = async (
  user: User,
  project: Project,
  chats: Chat[]
) => {
  return await request<DetermineNewProjectNameResponse>(
    user,
    getDetermineNewProjectNamePrompt(project, chats)
  );
};

export const verifyExistingProject = async (user: User, project: Project) => {
  return await request<ChatResponse>(
    user,
    getVerifyExistingProjectPrompt(project)
  );
};

export const resolveCurrentFollowUp = async (user: User, chats: Chat[]) => {
  return await request<ChatResponse>(
    user,
    getResolveCurrentFollowUpPrompt(chats)
  );
};

interface DetermineNewProjectNameResponse extends ChatResponse {
  isNewProject?: boolean;
}
export const determineTaskRequirementsCleared = async (
  user: User,
  chats: Chat[]
) => {
  return await request<DetermineNewProjectNameResponse>(
    user,
    getDetermineTaskRequirementClearedPrompt(chats)
  );
};
