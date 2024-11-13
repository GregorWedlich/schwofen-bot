import { Event } from "@prisma/client";
import { Context, SessionFlavor } from "grammy";
import { ConversationFlavor } from "@grammyjs/conversations";

interface SessionData {
  state?: string;
  event?: Partial<Event>;
  bookmarks?: string[];
  eventId?: string;
}

export type MyContext = Context &
  ConversationFlavor &
  SessionFlavor<SessionData>;
