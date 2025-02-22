import { getModelForClass, index, prop } from "@typegoose/typegoose";
import { Types } from "mongoose";

@index({ project_repo: 1 })
export class ProjectRepoFile {
  _id!: Types.ObjectId;

  @prop({ required: true })
  project_repo!: Types.ObjectId;

  @prop({ required: true })
  uri!: string;

  @prop()
  sha1?: string;

  @prop()
  openai_file_id?: string;
}

export const ProjectRepoFileModel = getModelForClass(ProjectRepoFile);
