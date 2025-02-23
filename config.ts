import dotenv from "dotenv";

dotenv.config();

export const OPEN_AI_KEY = process.env.OPEN_AI_KEY as string;
export const MONGO_URL = process.env.MONGO_URL as string;
export const GPT_MODEL = process.env.GPT_MODEL as string;
export const PORT = process.env.PORT as string;
export const GPT_ASSISTANT_ID = process.env.GPT_ASSISTANT_ID as string;
