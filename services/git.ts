import {ProjectRepo} from "../models/project-repo";
import {
  ProjectRepoFile,
  ProjectRepoFileModel,
} from "../models/project-repo-file";

export const syncFilesToGpt = async (
  projectRepo: ProjectRepo,
  branch: string,
) => {
  //-- check out repo to branch
  //-- read all the file locally and compute hashes
  //-- compare with hash stored on DB
  const allFiles = await ProjectRepoFileModel.find({});

  //-- detect changes files

  //- call openai to sync the changes files
};
