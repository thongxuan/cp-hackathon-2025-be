import {getModelForClass, index, prop} from "@typegoose/typegoose";
import {Types} from "mongoose";

@index({user: 1, name: 1}, {unique: true})
export class Project {
  _id!: Types.ObjectId;

  @prop({required: true})
  user!: Types.ObjectId;

  @prop({required: true})
  name!: string;

  //-- store the project conventions
  @prop()
  memory?: string[];

  @prop({required: true, default: Date.now})
  created_at!: Date;

  @prop()
  git_access_token?: string;
}

export const ProjectModel = getModelForClass(Project);
