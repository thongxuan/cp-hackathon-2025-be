import { Types } from "mongoose";
import assert from "assert";

import { Chat, ChatModel } from "../models/chat";
import { Project, ProjectModel } from "../models/project";
import { ProjectRepo, ProjectRepoModel } from "../models/project-repo";
import { User, UserModel } from "../models/user";
import { TaskModel } from "../models/task";

import {
  DeveloperAction,
  determineActionsFromChat,
  resolveCurrentFollowUp,
  verifyExistingProject,
} from "./ai";
import { ChatEmitter } from "./chat";
import { initNewProject } from "./project";
import { getUserWebsocket } from "./user";
import { createAndExecuteTask, getPendingTask } from "./task";

import {
  createProjectNameFollowUp,
  createTaskRequirementsFollowUp,
  FollowUp,
} from "./follow-ups";

const developers: Record<string, AiDeveloper | undefined> = {};

export class AiDeveloper {
  //-- store recent chats to follow up
  protected readonly chats: Chat[] = [];

  protected projects: Project[] = [];
  protected repos: ProjectRepo[] = [];

  protected followUp?: FollowUp;

  constructor(
    protected readonly user: User,
    protected readonly chatEmitter: ChatEmitter
  ) {}

  protected storeChat(content: string) {
    const chat = new ChatModel({
      user: this.user._id,
      outbound: true,
      content,
    });

    ChatModel.create([chat]);

    this.chats.push(chat);

    return chat;
  }

  async reload() {
    this.projects = await ProjectModel.find({ user: this.user._id }).lean();
    const projectIds = this.projects.map((p) => p._id);

    this.repos = await ProjectRepoModel.find({
      project: { $in: projectIds },
    }).lean();
  }

  chatBack(content?: string) {
    if (!content) return;

    const chat = new ChatModel({
      user: this.user._id,
      content,
    });

    this.chats.push(chat);

    this.chatEmitter(chat);

    return chat;
  }

  async receiveChat(content: string) {
    this.storeChat(content);

    await this.followUp?.handleFollowUpChats(this.chats);

    //-- check what kind of this content is
    const actions = await determineActionsFromChat(
      this.user,
      this.projects,
      this.repos,
      this.chats
    );

    console.log("detected actions: ", actions);

    for (const action of actions) {
      switch (action.type) {
        case DeveloperAction.JUST_A_CHAT:
          this.chatBack(action.chat);
          break;

        case DeveloperAction.UPDATE_PERSONAL_INFO: {
          if (action.memory?.length) {
            await UserModel.updateOne(
              { _id: this.user._id },
              { $push: { memory: { $each: action.memory } } }
            );
          }
        }

        case DeveloperAction.UPDATE_PROJECT_INFO: {
          if (action.project) {
            const project = await ProjectModel.findOneAndUpdate(
              {
                name: action.project,
                user: this.user._id,
              },
              {
                $set: {
                  ...(action.gitAccessToken && {
                    git_access_token: action.gitAccessToken,
                  }),
                },
              }
            );

            if (project) {
              await this.reload();
              this.chatBack(action.chat);
            }
          } else {
            this.chatBack(action.chat);
          }
          break;
        }

        case DeveloperAction.UPDATE_PROJECT_GIT_REPO: {
          if (action.project) {
            const project = await ProjectModel.findOne({
              name: action.project,
              user: this.user._id,
            });

            if (project && action.repo) {
              const repo = await ProjectRepoModel.findOneAndUpdate(
                { project: project._id, name: action.repo },
                {
                  $set: {
                    ...(action.gitUrl && { repo_url: action.gitUrl }),
                    ...(action.baseBranch && {
                      repo_base_branch: action.baseBranch,
                    }),
                  },
                },
                { upsert: true }
              );

              if (repo) {
                this.chatBack(action.chat);
                await this.reload();
              }
            } else {
              this.chatBack(action.chat);
            }
          } else {
            this.chatBack(action.chat);
          }
          break;
        }

        case DeveloperAction.ASSIGN_NEW_PROJECT: {
          if (action.project) {
            //-- check if project exists with this name
            const project = await ProjectModel.findOne({
              user: this.user._id,
              name: action.project,
            }).lean();

            if (project) {
              if (this.followUp) {
                const chat = await resolveCurrentFollowUp(
                  this.user,
                  this.chats
                );
                this.chatBack(chat.chat);
              } else {
                const chat = await verifyExistingProject(this.user, project);
                this.chatBack(chat.chat);

                this.followUp = createProjectNameFollowUp(
                  this.user,
                  project,
                  this.chats,
                  this.chatBack.bind(this),
                  async () => {
                    this.followUp = undefined;
                    await this.reload();
                  }
                );
              }
            } else {
              this.chatBack(action.chat);
              //-- create new project for this user
              await initNewProject(this.user, { name: action.project });
              await this.reload();
            }
          }
          break;
        }

        case DeveloperAction.GENERATE_PULL_REQUEST_FROM_REQUIREMENTS: {
          const pendingTask = await getPendingTask(this.user._id);

          if (pendingTask) {
            this.chatBack("Hi, please wait until I finish my current task");
          } else {
            this.chatBack(action.chat);

            const project = !action.project
              ? undefined
              : await ProjectModel.findOne({
                  name: action.project,
                  user: this.user._id,
                }).lean();

            const repo =
              !project || !action.repo
                ? undefined
                : await ProjectRepoModel.findOne({
                    project: project._id,
                    name: action.repo,
                  }).lean();

            const baseBranch = action.baseBranch || repo?.repo_base_branch;

            if (
              !project ||
              !repo ||
              !baseBranch ||
              !action.requirements?.length
            ) {
              this.followUp = createTaskRequirementsFollowUp(
                this.user,
                this.chats,
                this.chatBack.bind(this),
                async () => {
                  this.followUp = undefined;
                }
              );
            } else {
              if (!repo.repo_base_branch) {
                await ProjectRepoModel.updateOne(
                  { _id: repo._id },
                  { $set: { repo_base_branch: baseBranch } }
                );
              }

              createAndExecuteTask(
                new TaskModel({
                  user: this.user._id,
                  repo: repo._id,
                  requirements: action.requirements,
                }),
                (message) => this.chatBack(message)
              ).catch((err) =>
                this.chatBack(
                  `Error happenned when I try executing my task: ${err.message}`
                )
              );
            }
          }

          break;
        }
      }
    }
  }
}

export const getDeveloperOfUser = async (userId: Types.ObjectId) => {
  let developer = developers[userId.toHexString()];

  if (!developer) {
    const user = await UserModel.findById(userId).lean();

    assert.ok(user);

    developer = new AiDeveloper(user, (chat) => {
      const socket = getUserWebsocket(userId);

      ChatModel.create([chat]);

      if (socket) {
        socket.emit(userId.toHexString(), chat);
      }
    });

    developers[userId.toHexString()] = developer;

    await developer.reload();
  }

  return developer;
};
