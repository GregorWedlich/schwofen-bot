import { config } from 'dotenv';
config();

import { Bot, session, InlineKeyboard, GrammyError, HttpError } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';

import { MyContext } from './types/context';
import { submitEventConversation } from './conversations/submitEventConversation';
import { rejectEventConversation } from './conversations/rejectEventConversation';
import { searchEventConversation } from './conversations/searchEventConversation';
import { TELEGRAM_TOKEN } from './constants/constants';
import {
  handleEventApproval,
  handleEventRejection,
} from './services/eventService';

export const bot = new Bot<MyContext>(TELEGRAM_TOKEN || '');

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error('Error in request:', e.description);
  } else if (e instanceof HttpError) {
    console.error('Could not contact Telegram:', e);
  } else {
    console.error('Unknown error:', e);
  }
});

// Middleware
bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

// Register conversations
bot.use(createConversation(submitEventConversation, 'submitEventConversation'));
bot.use(createConversation(rejectEventConversation, 'rejectEventConversation'));
bot.use(createConversation(searchEventConversation, 'searchEventConversation'));

// Register commands
bot.command('einreichen', async (ctx) => {
  await ctx.reply('Willkommen! Möchtest du eine Veranstaltung einreichen?', {
    reply_markup: new InlineKeyboard().text('Ja', 'submit_event'),
  });
});

bot.command('suchen', async (ctx) => {
  await ctx.reply('🔍 Veranstaltungssuche', {
    reply_markup: new InlineKeyboard().text('Suche starten', 'start_search'),
  });
});

bot.callbackQuery('submit_event', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter('submitEventConversation');
});

bot.callbackQuery('start_search', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter('searchEventConversation');
});

bot.callbackQuery(/approve_(.+)/, async (ctx) => {
  await handleEventApproval(ctx.match[1], ctx);
});

bot.callbackQuery(/reject_(.+)/, async (ctx) => {
  await handleEventRejection(ctx.match[1], ctx);
});

// Debugging

// Chat-ID
// bot.on("message", (ctx) => {
//   console.log("Chat-ID:", ctx.chat.id);
// });

// // Channel Post
// bot.on("channel_post", (ctx) => {
//   console.log("Channel Post Chat-ID:", ctx.chat.id);
// });

export function startBot() {
  bot.start();
}
