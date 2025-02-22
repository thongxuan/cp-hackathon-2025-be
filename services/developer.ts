import { Types } from "mongoose";
import assert from "assert";

import { Chat, ChatModel } from "../models/chat";
import { Project, ProjectModel } from "../models/project";
import { ProjectRepo, ProjectRepoModel } from "../models/project-repo";
import { User, UserModel } from "../models/user";

import {
  DeveloperAction,
  determineActionsFromChat,
  resolveCurrentFollowUp,
  verifyExistingProject,
} from "./ai";
import { ChatEmitter } from "./chat";
import { initNewProject } from "./project";

import { createProjectNameFollowUp, FollowUp } from "./follow-ups";
import { getUserWebsocket } from "./user";

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
    console.log("receive chat:", content);
    this.storeChat(content);
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
        case DeveloperAction.ANSWER_PREVIOUS_QUESTION:
          await this.followUp?.handleFollowUpChats(this.chats);
          this.chatBack(action.chat);
          break;

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
              this.chatBack(action.chat);
            }
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
                  },
                },
                { upsert: true }
              );

              if (repo) {
                this.chatBack(action.chat);
              }
            }
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
                  () => {
                    this.followUp = undefined;
                  }
                );
              }
            } else {
              this.chatBack(action.chat);
              //-- create new project for this user
              await initNewProject(this.user, { name: action.project });
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
  }

  return developer;
};
