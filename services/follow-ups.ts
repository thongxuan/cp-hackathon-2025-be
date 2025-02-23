import { Chat } from "../models/chat";
import { Project } from "../models/project";
import { User } from "../models/user";

import {
  determineDecisionMade,
  determineNewProjectName,
  determineTaskRequirementsCleared,
  PositiveResponse,
} from "./ai";
import { initNewProject } from "./project";

export class FollowUp<T = any> {
  private inited?: boolean = false;

  constructor(
    protected readonly user: User,
    protected readonly chatBack: (content?: string) => void,
    protected readonly initMessage: () => Promise<PositiveResponse>,
    protected readonly decisionFormat: string,
    protected readonly onDecide: (decision?: T) => void
  ) {}

  async handleFollowUpChats(chats: Chat[]) {
    console.log("handleFollowUpChats");
    if (!this.inited) {
      this.inited = true;

      console.log("not inited, sending init messsage");
      const message = await this.initMessage();

      this.chatBack(message.chat);

      console.log("response init", message);

      if (!message.positive) {
        this.onDecide(undefined);
      }
    } else {
      console.log("checking for decision");
      const decisionMade = await determineDecisionMade<T>(
        this.user,
        chats,
        this.decisionFormat
      );

      console.log("decision made", decisionMade);

      this.chatBack(decisionMade.chat);

      if (decisionMade.positive) {
        this.onDecide(decisionMade.decision);
      }
    }
  }
}

export const createProjectNameFollowUp = (
  user: User,
  project: Project,
  chats: Chat[],
  chatBack: (content?: string) => void,
  onFinish?: () => Promise<void>
) => {
  return new FollowUp<{
    isNew: boolean;
    projectName: string;
  }>(
    user,
    chatBack,
    () => determineNewProjectName(user, project, chats),
    `
    {
      isNew: boolean;
      projectName: string;
    }
    `,
    async (decision) => {
      if (decision) {
        if (decision.isNew) {
          await initNewProject(user, { name: decision.projectName });
        }
      }

      //-- decision made, clear followup
      await onFinish?.();
    }
  );
};

export const createTaskRequirementsFollowUp = (
  user: User,
  chats: Chat[],
  chatBack: (content?: string) => void,
  onFinish?: () => Promise<void>
) => {
  return new FollowUp<void>(
    user,
    chatBack,
    () => determineTaskRequirementsCleared(user, chats),
    "",
    async () => {
      //-- decision made
      await onFinish?.();
    }
  );
};
