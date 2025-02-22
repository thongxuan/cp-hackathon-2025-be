import {getModelForClass, index, prop} from "@typegoose/typegoose";
import {Types} from "mongoose";

@index({project: 1})
export class ProjectRepo {
  _id!: Types.ObjectId;

  @prop({required: true})
  project!: Types.ObjectId;

  @prop({required: true})
  name!: string;

  @prop()
  repo_url?: string;

  //-- store the repo conventions
  @prop()
  memory?: string[];

  //-- folder location on disk
  @prop()
  repo_location?: string;
}

export const ProjectRepoModel = getModelForClass(ProjectRepo);
