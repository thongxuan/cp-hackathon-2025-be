import {Chat, ChatModel} from "./models/chat";
import {ProjectModel} from "./models/project";
import {User} from "./models/user";

import {
  ChatResponse,
  DeveloperAction,
  determineActionsFromChat,
  determineDecisionMade,
  resolveCurrentFollowUp,
  verifyExistingProject,
} from "./services/ai";
import {ChatEmitter} from "./services/chat";
import {initNewProject} from "./services/project";

class FollowUp<T = any> {
  constructor(
    protected readonly developer: AiDeveloper,
    protected readonly initMessage: () => Promise<ChatResponse>,
    protected readonly decisionFormat: string,
    protected readonly onFinishInit: () => void,
    protected readonly onDecide: (decision: T) => void,
  ) {
    initMessage().then((chat) => {
      this.developer.chatBack(chat.chat);
      this.onFinishInit();
    });
  }

  async handleFollowUpChats(chats: Chat[]) {
    console.log("handle follow up");

    const decisionMade = await determineDecisionMade<T>(
      this.developer.user,
      chats,
      this.decisionFormat,
    );

    this.developer.chatBack(decisionMade.chat);

    if (decisionMade.positive) {
      this.onDecide(decisionMade.decision);
    }
  }
}

export class AiDeveloper {
  //-- store recent chats to follow up
  protected readonly chats: Chat[] = [];
  protected followUp?: FollowUp;

  constructor(
    public readonly user: User,
    protected readonly chatEmitter: ChatEmitter,
  ) {}

  protected storeChat(content: string) {
    const chat = new ChatModel({user: this.user._id, outbound: true, content});

    ChatModel.create([chat]);

    this.chats.push(chat);

    return chat;
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
    const actions = await determineActionsFromChat(this.user, this.chats);

    for (const action of actions) {
      console.log("detected action", action);
      switch (action.type) {
        case DeveloperAction.ANSWER_PREVIOUS_QUESTION:
          this.followUp?.handleFollowUpChats(this.chats);
          break;

        case DeveloperAction.JUST_A_CHAT:
          this.chatBack(action.chat);
          break;

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
                  this.chats,
                );
                this.chatBack(chat.chat);
              } else {
                const chat = await verifyExistingProject(this.user, project);
                this.chatBack(chat.chat);

                await new Promise<void>((resolve) => {
                  console.log("[follow up created]");

                  this.followUp = new FollowUp<{
                    isNew: boolean;
                    projectName: string;
                  }>(
                    this,
                    () => verifyExistingProject(this.user, project),
                    `
                    {
                      isNew: boolean;
                      projectName: string;
                    }
                    `,
                    () => resolve(),
                    ({isNew, projectName}) => {
                      if (isNew) {
                        initNewProject(this.user, {name: projectName});
                      }

                      //-- decision made, clear followup
                      this.followUp = undefined;
                    },
                  );
                });
              }
            } else {
              this.chatBack(action.chat);
              //-- create new project for this user
              await initNewProject(this.user, {name: action.project});
            }
          }
          break;
        }
      }
    }
  }
}
