import {Chat} from "../models/chat";
import {Project} from "../models/project";

import {DeveloperAction} from "./ai";

const guidesOnJsonResponse = [
  "Here are some guides on the response:",
  "- the response must be a valid JSON",
  "- do not include extra format character likes ```",
  "- do not include any placeholder brackets in the response text",
  "The response should be:",
];
export const getDetermineActionsPrompt = (chats: Chat[]) => {
  return `
  As a developer, me and my boss are having this conversation:

  ${chats
    .map((chat) => `${chat.outbound ? "my boss" : "me"}: ${chat.content}`)
    .join("\n")}

  Based on the last message and the conversation, I woud like to determine the actions to do.
  Please list all possible actions in an valid JSON array.
  Please remember to wrap ActionType in quotes.
  
  ${guidesOnJsonResponse.join("\n")}
  [
    {
      "type": ActionType, 
      "chat": string, 
      "project": string
    },
  ]

  Some information that help on providing the response:
  - ActionType is one of ${Object.values(DeveloperAction).join(",")}
  - if the last message is to answer the question, the ActionType must be ${
    DeveloperAction.ANSWER_PREVIOUS_QUESTION
  }
  - if ActionType is ${
    DeveloperAction.JUST_A_CHAT
  }, suggest the appropriate response in the "chat" field
  - if ActionType is ${
    DeveloperAction.ASSIGN_NEW_PROJECT
  }, suggest the appropriate project name in the "project" field and suggest an appropriate response in the "chat" field that tells my boss I'm happy to join the project
  
  `;
};

export const getDetermineDecisionPrompt = (
  chats: Chat[],
  expectedDecision: string,
) => {
  return `
  As a developer, my boss and me are discussing this: 
  ${chats
    .map((chat) => `${chat.outbound ? "my boss" : "me"}: ${chat.content}`)
    .join("\n")}

  Please help me determine that my boss had given the decision on the current problem.
  ${guidesOnJsonResponse.join("\n")}

  {
    "chat": string,
    "positive": boolean,
    "decision": JSON
  }

  Some information that help on providing the response:
  - if my boss affirms on the situation, set "positive" to "true", otherwise set to "false"
  - if positive is "false", please suggest a question in the "chat" field that I can ask him to clarify the problem
  - the "desicion" contains additional information of his decision on the problem must be a valid JSON
  - the "decision" must have this JSON format ${expectedDecision}
  - please check the keys of "decision" to populate the relevant information

  `;
};

export const getVerifyExistingProjectPrompt = (project: Project) => {
  return `
  As a developer, my boss tells me that he added me to this project: "${
    project.name
  }" in "${project.created_at.toISOString()}".
  
  Because I already been added to a project with a same name, please suggest a reply so that I can send to my boss to confirm if this is the same project or a new project.
  ${guidesOnJsonResponse.join("\n")}

  {
    "chat": string
  }
  `;
};

export const getResolveCurrentFollowUpPrompt = (chats: Chat[]) => {
  return `
  As a developer, my boss and me are discussing this: 
  ${chats
    .map((chat) => `${chat.outbound ? "my boss" : "me"}: ${chat.content}`)
    .join("\n")}
  
  Please suggest a response to tell him that we have a pending decision to make and should finish it before talking about something else.
  ${guidesOnJsonResponse.join("\n")}

  {
    "chat": string
  }
  `;
};

export const getFollowUpUntilDecisionPrompt = (chats: Chat[]) => {
  return `
  As a developer, my boss and me are discussing this: 
  ${chats
    .map((chat) => `${chat.outbound ? "my boss" : "me"}: ${chat.content}`)
    .join("\n")}

  Please determine if my boss had a decision "yes" or "no". if yes then return "true" in the "decision" field, otherwise return "false".

  Please also suggest an appropriate response in the "chat" field for the latest message

  ${guidesOnJsonResponse.join("\n")}

  {
    "decision": boolean, 
    "chat": string
  }
  `;
};
