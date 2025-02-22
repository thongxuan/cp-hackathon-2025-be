import { getModelForClass, index, prop } from "@typegoose/typegoose";
import { Types } from "mongoose";

@index({ name: 1 }, { unique: true })
export class User {
  _id!: Types.ObjectId;

  @prop({ required: true })
  name!: string;

  @prop()
  sanbox_container_id?: string;

  //-- store the user info
  @prop()
  memory?: string[];
}

export const UserModel = getModelForClass(User);
