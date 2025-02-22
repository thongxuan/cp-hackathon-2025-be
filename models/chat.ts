import { getModelForClass, index, prop } from "@typegoose/typegoose";
import { Types } from "mongoose";

@index({ user: 1, created_at: -1 })
export class Chat {
  _id!: Types.ObjectId;

  @prop({ required: true })
  user!: Types.ObjectId;

  @prop()
  outbound?: boolean;

  @prop({ required: true })
  content!: string;

  @prop({ required: true, default: Date.now })
  created_at!: Date;
}

export const ChatModel = getModelForClass(Chat);
