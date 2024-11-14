import { Event } from '@prisma/client';
import { ConversationFlavor } from '@grammyjs/conversations';
import { Context, SessionFlavor } from 'grammy';

interface SessionData {
  state?: string;
  event?: Partial<Event>;
  bookmarks?: string[];
  eventId?: string;
}

export type MyContext = Context &
  ConversationFlavor &
  SessionFlavor<SessionData>;
