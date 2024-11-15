import { config } from 'dotenv';
config();

import { Bot, GrammyError, HttpError, InlineKeyboard, session } from 'grammy';
import { I18n } from '@grammyjs/i18n';
import { conversations, createConversation } from '@grammyjs/conversations';

import { TELEGRAM_TOKEN } from './constants/constants';
import { submitEventConversation } from './conversations/submitEventConversation';
import { rejectEventConversation } from './conversations/rejectEventConversation';
import { searchEventConversation } from './conversations/searchEventConversation';
import { editEventConversation } from './conversations/editEventConversation';
import { MyContext } from './types/context';
import {
  handleEventApproval,
  handleEventRejection,
} from './services/eventService';
import { ICONS } from './utils/iconUtils';

export const bot = new Bot<MyContext>(TELEGRAM_TOKEN || '');

// Internationalisierung (i18n) konfigurieren
const i18n = new I18n<MyContext>({
  defaultLocale: 'en',
  directory: 'locales',
  useSession: true,
});

// Session zuerst initialisieren
bot.use(session({ initial: () => ({}) }));

// i18n (Internationalisierung) initialisieren
bot.use(i18n);

// Middleware zur Sprachanwendung basierend auf gespeicherter Session-Locale
bot.use(async (ctx, next) => {
  if (ctx.session.locale) {
    await ctx.i18n.setLocale(ctx.session.locale);
  }
  await next();
});

// Fehlerbehandlung
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

// Konversations-Middleware registrieren
bot.use(conversations());
bot.use(createConversation(submitEventConversation, 'submitEventConversation'));
bot.use(createConversation(rejectEventConversation, 'rejectEventConversation'));
bot.use(createConversation(searchEventConversation, 'searchEventConversation'));
bot.use(createConversation(editEventConversation, 'editEventConversation'));

// Sprachwechsel-Befehl
bot.command('language', async (ctx) => {
  await ctx.reply(ctx.t('choose-language'), {
    reply_markup: {
      inline_keyboard: [
        [{ text: ctx.t('language-english'), callback_data: 'set_lang_en' }],
        [{ text: ctx.t('language-german'), callback_data: 'set_lang_de' }],
      ],
    },
  });
});

// Register commands
bot.command('submit', async (ctx) => {
  await ctx.reply(ctx.t('submit-event'), {
    reply_markup: new InlineKeyboard().text('Ja', 'submit_event'),
  });
});

bot.command('search', async (ctx) => {
  await ctx.reply(ctx.t('search-event', { icon: ICONS.search }), {
    reply_markup: new InlineKeyboard().text(
      ctx.t('start-search'),
      'start_search',
    ),
  });
});

bot.command('edit', async (ctx) => {
  await ctx.reply('Möchtest du eine deiner Veranstaltungen bearbeiten?', {
    reply_markup: new InlineKeyboard().text('Ja', 'edit_event'),
  });
});

// Callback für Sprachänderung
bot.callbackQuery(/^set_lang_(en|de)$/, async (ctx) => {
  const newLocale = ctx.match[1];
  await ctx.i18n.setLocale(newLocale); // Sprache direkt anwenden
  ctx.session.locale = newLocale; // Sprache in der Session speichern

  await ctx.answerCallbackQuery(
    ctx.t('language-set', {
      locale:
        newLocale === 'en'
          ? ctx.t('language-english')
          : ctx.t('language-german'),
    }),
  );

  await ctx.reply(
    ctx.t('language-set', {
      locale:
        newLocale === 'en'
          ? ctx.t('language-english')
          : ctx.t('language-german'),
    }),
  );
});

// Callback-Abfragen für Events
bot.callbackQuery('submit_event', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter('submitEventConversation');
});

bot.callbackQuery('start_search', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter('searchEventConversation');
});

bot.callbackQuery('edit_event', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter('editEventConversation');
});

bot.callbackQuery(/approve_(edit_)?(.+)/, async (ctx) => {
  const eventId = ctx.match[2];
  await handleEventApproval(eventId, ctx);
});

bot.callbackQuery(/reject_(edit_)?(.+)/, async (ctx) => {
  const eventId = ctx.match[2];
  await handleEventRejection(eventId, ctx);
});

// Debugging
// Chat-ID
// bot.on("message", (ctx) => {
//   console.log("Chat-ID:", ctx.chat.id);
// });

// Channel Post
// bot.on("channel_post", (ctx) => {
//   console.log("Channel Post Chat-ID:", ctx.chat.id);
// });

// Bot-Start
export function startBot() {
  bot.start();
}
