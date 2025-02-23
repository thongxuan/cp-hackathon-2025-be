import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import crypto from "crypto";
import stream from "stream";

import { Project } from "../models/project";
import { ProjectRepo } from "../models/project-repo";
import { ProjectRepoFileModel } from "../models/project-repo-file";

import { openai } from "./ai";
import { withTransaction } from "../helpers/db";

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

export function readAllFiles(dirPath: string, ignored: string[] = []) {
  const result: string[] = [];

  function readDirectory(currentPath: string) {
    const items = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);
      if (ignored.includes(item.name)) continue;

      if (item.isFile()) {
        result.push(fullPath); // Only add files, ignore folders
      } else if (item.isDirectory()) {
        readDirectory(fullPath); // Recursively read subdirectories
      }
    }
  }

  readDirectory(dirPath);

  return result;
}

export const syncFilesToGpt = async (
  repoPath: string,
  projectRepo: ProjectRepo
) => {
  const dbFiles = await ProjectRepoFileModel.find(
    { project_repo: projectRepo._id },
    { uri: 1, sha1: 1, openai_file_id: 1 }
  ).lean();

  //-- read all the file locally recursively and compute hashes
  const fileUris = readAllFiles(repoPath, [".git"]);

  const localFiles = fileUris.map((uri) => {
    const content = fs.readFileSync(uri, "utf-8");
    const sha1 = crypto.createHash("sha1").update(content).digest("hex");
    return { uri, content, sha1 };
  });

  //-- add files which are not tracked
  const filesToAdd = localFiles.filter(
    (file) => !dbFiles.find((dbFile) => dbFile.uri === file.uri)
  );

  console.log(`Adding ${filesToAdd.length} files`);

  //-- update files that are tracked but sha1 had changed (delete from open ai and upload new files)
  const filesToUpdate = localFiles.flatMap((file) => {
    const matched = dbFiles.find(
      (dbFile) => dbFile.uri === file.uri && dbFile.sha1 !== file.sha1
    );

    if (!matched) return [];

    return [{ ...matched, ...file }];
  });

  console.log(`Updating ${filesToUpdate.length} files`);

  //-- remove files that nolonger exists
  const filesToRemove = dbFiles.filter(
    (dbFile) => !localFiles.find((localFile) => localFile.uri === dbFile.uri)
  );

  console.log(`Removing ${filesToRemove.length} files`);

  //- call openai to sync the changes files
  const removeIds = [
    ...filesToRemove.flatMap((r) =>
      r.openai_file_id ? [r.openai_file_id] : []
    ),
    ...filesToUpdate.flatMap((f) =>
      f.openai_file_id ? [f.openai_file_id] : []
    ),
  ];

  //-- remove files from open AI
  if (removeIds.length) {
    await Promise.all(removeIds.map((fileId) => openai.files.del(fileId)));
  }

  const uploadFiles = [
    ...filesToUpdate,
    ...filesToAdd.map((file) => ({ ...file, _id: undefined })),
  ];

  console.log(`Uploading ${uploadFiles.length} files`);

  const uploadResult = await Promise.all(
    uploadFiles.map(async (file) => {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(Buffer.from(file.content, "utf-8"));

      try {
        const response = await openai.files.create({
          file: fs.createReadStream(file.uri),
          purpose: "assistants",
        });

        return { ...file, openai_file_id: response.id };
      } catch (err) {
        console.log(`error uploading file: ${file.uri}`);
        throw err;
      }
    })
  );

  //-- update db
  console.log("Updating db");

  await withTransaction(async (session) => {
    await ProjectRepoFileModel.bulkWrite(
      uploadResult.flatMap((file) => {
        if (!file._id) {
          return [];
        }

        return {
          updateOne: {
            filter: { _id: file._id },
            update: { $set: { openai_file_id: file.openai_file_id } },
          },
        };
      })
    );

    await ProjectRepoFileModel.bulkWrite(
      uploadResult.flatMap((file) => {
        if (file._id) {
          return [];
        }

        return {
          insertOne: {
            document: { ...file, project_repo: projectRepo._id },
          },
        };
      })
    );
  });

  return await ProjectRepoFileModel.find(
    { project_repo: projectRepo._id },
    { uri: 1, openai_file_id: 1 }
  ).lean();
};
