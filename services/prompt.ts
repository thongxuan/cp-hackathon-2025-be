import {Chat} from "../models/chat";
import {Project} from "../models/project";
import {ProjectRepo} from "../models/project-repo";

import {DeveloperAction} from "./ai";

const guidesOnJsonResponse = [
  "Here are some guides on the response:",
  "- the response must be a valid JSON",
  "- do not format the response",
  "- do not include any placeholder brackets in the response text",
  "The response should be:",
];
export const getDetermineActionsPrompt = (
  projects: Project[],
  repos: ProjectRepo[],
  chats: Chat[],
) => {
  return `
  I am a software developer.

  I've been added to the following projects:
  #PROJECTS#
  ${
    !projects.length
      ? "none"
      : projects.map((project) => project.name).join("\n")
  }

  And corresponding repos:
  #REPOS#
  ${
    !repos.length
      ? "none"
      : repos
          .map((repo) => {
            const project = projects.find((project) =>
              project._id.equals(repo.project),
            );

            return `${project?.name}: ${repo.name}`;
          })
          .join("\n")
  }
  
  Me and my boss are having this conversation:

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
      "project": string,
      "repo": string,
      "gitUrl: string,
      "gitAccessToken": string,
      "memory": string[],
      "requirements": string[]
    },
  ]

  Some information that help on providing the response:
  - ActionType is one of ${Object.values(DeveloperAction).join(",")}
  - if the last message is to answer the question, the ActionType must be ${
    DeveloperAction.ANSWER_PREVIOUS_QUESTION
  } and it must be the only action in the response array
  - if ActionType is ${
    DeveloperAction.JUST_A_CHAT
  }, suggest the appropriate response in the "chat" field
  - if the message is to define my working style or any reminder for me, then the ActionType is ${
    DeveloperAction.UPDATE_PERSONAL_INFO
  } and the "memory" field must be a string array contains the reminders and working style suggestions. Suggest an appropirate response in the "chat" field to tell that I understood.
  - if ActionType is ${
    DeveloperAction.ASSIGN_NEW_PROJECT
  }, suggest the appropriate project name in the "project" field and suggest an appropriate response in the "chat" field that tells my boss I'm happy to join the project
  - If a Git Personal Access Token (PAT) is provided, the the ActionType must be ${
    DeveloperAction.UPDATE_PROJECT_INFO
  }, the project field should match the project names listed above in #PROJECTS# section, the "gitAccessToken" field must includes the provided token. If the project name is not detected then suggest a reply in "chat" field to ask for the project name. If the project name is provided but it is not one of the project that I'm assigned, then suggest a reply in "chat" field to ask for the correct project name.
  - If a Git repository URL is provided, the ActionType must be ${
    DeveloperAction.UPDATE_PROJECT_GIT_REPO
  }, the "project" field should match the related project name listed above in #PROJECTS# section, the "gitUrl" field must contains the provided git url. If the repository name (not the git repository name) cannot be detected then suggest a reply in "chat" field to ask for the repository name, otherwise include the repository name in the "repo" field.
  - If the messages request me to perform some tasks then the ActionType is ${
    DeveloperAction.GENERATE_PULL_REQUEST_FROM_REQUIREMENTS
  }, the "project" field should match the related project name listed above in #PROJECTS# section, the "repo" field should match the related repo name listed above in #REPOS# session. If the project name is not detected then suggest a reply in "chat" field to ask for the project name. If the project name is provided but it is not one of the project that I'm assigned, then suggest a reply in "chat" field to ask for the correct project name. If the project repo (not git repository) is missng then suggest a reply in "chat" field to ask for the project repo. If the project repo is provided but it is not one of the repo that I'm assigned, then suggest a reply in "chat" field to ask for the correct repo name. 
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

export const getDetermineNewProjectNamePrompt = (
  project: Project,
  chats: Chat[],
) => {
  return `
  As a developer, my boss and me are discussing this: 
  ${chats
    .map((chat) => `${chat.outbound ? "my boss" : "me"}: ${chat.content}`)
    .join("\n")}

  Please help me determine if my boss want to start a new project or it is an existing project.
  ${guidesOnJsonResponse.join("\n")}
  
  {
    "positive": boolean,
    "chat": string
  }

  Some information that help on providing the response:
  - if he decided to create new project set "positive" to "true", otherwise set to "false", 
  - if positive is true, please suggest a reply in "chat" field so that I can ask him which is new the project name. The project name must not equal to ${
    project.name
  }
  - if positive is false, please suggest a reply in "chat" field saying that I'm assigned to the project and is ready to accept task
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
