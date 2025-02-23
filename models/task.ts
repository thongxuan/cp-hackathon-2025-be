import { getModelForClass, index, prop } from "@typegoose/typegoose";
import { Types } from "mongoose";

@index({ user: 1, repo: 1 })
export class Task {
  _id!: Types.ObjectId;

  @prop({ required: true })
  user!: Types.ObjectId;

  @prop({ required: true })
  repo!: Types.ObjectId;

  @prop()
  requirements?: string[];

  @prop()
  pr_url?: string;

  @prop({ required: true, default: true })
  pending!: boolean;
}

export const TaskModel = getModelForClass(Task);
