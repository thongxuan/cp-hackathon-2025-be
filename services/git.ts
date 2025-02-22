import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";

import { Project } from "../models/project";
import { ProjectRepo } from "../models/project-repo";
import { ProjectRepoFileModel } from "../models/project-repo-file";

const execCommand = async (cmd: string, base?: string) => {
  return await new Promise<{ success: boolean; message?: string }>(
    (resolve) => {
      exec(cmd, { cwd: base }, (error) => {
        if (error) {
          return resolve({ success: false, message: error.message });
        }

        return resolve({ success: true });
      });
    }
  );
};

export const cloneRepoSourceCode = async (
  project: Project,
  repo: ProjectRepo
) => {
  const projectBasePath = path.join(
    os.homedir(),
    "aids",
    project._id.toHexString()
  );

  if (!fs.existsSync(projectBasePath)) {
    fs.mkdirSync(projectBasePath, { recursive: true });
  }

  const repoPath = path.join(projectBasePath, repo._id.toHexString());

  if (!fs.existsSync(repoPath)) {
    const result = await execCommand(`git clone ${repo.repo_url} ${repoPath}`);

    if (!result.success) {
      throw new Error(result.message);
    }
  } else {
    //-- fetch and checkout at the base branch
    const result = await execCommand(
      `git stash && git fetch && git checkout origin/${repo.repo_base_branch}`,
      repoPath
    );

    if (!result.success) {
      throw new Error(result.message);
    }
  }

  return repoPath;
};

export const syncFilesToGpt = async (
  repoPath: string,
  projectRepo: ProjectRepo
) => {
  //-- read all the file locally and compute hashes
  //-- compare with hash stored on DB
  // const allFiles = await ProjectRepoFileModel.find({});
  //-- detect changes files
  //- call openai to sync the changes files
};
