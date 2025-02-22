import {Chat} from "../models/chat";

export type ChatEmitter = (chat: Partial<Chat>) => void;
