import { Conversation } from '@grammyjs/conversations';
import { addDays, parse } from 'date-fns';
import { de } from 'date-fns/locale';
import { InlineKeyboard } from 'grammy';

import { MyContext } from '../types/context';
import { findEventsForDay } from '../models/eventModel';
import { sendSearchResultsToUser } from '../controllers/eventController';
import { ICONS } from '../utils/iconUtils';

export async function searchEventConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const searchKeyboard = new InlineKeyboard()
    .text(`${ICONS.date} Heute`, 'search_today')
    .row()
    .text(`${ICONS.date} Morgen`, 'search_tomorrow')
    .row()
    .text(`${ICONS.date} Datum wählen`, 'search_specific')
    .row()
    .text(`${ICONS.reject} Beenden`, 'search_exit');

  const searchMessage = await ctx.reply(
    `${ICONS.search} Wähle eine Suchoption:`,
    {
      reply_markup: searchKeyboard,
    },
  );

  const response = await conversation.waitForCallbackQuery(
    /^(search_today|search_tomorrow|search_specific|search_exit)$/,
  );
  const choice = response.callbackQuery.data;

  await ctx.api.editMessageReplyMarkup(
    ctx.chat!.id,
    searchMessage.message_id,
    undefined,
  );

  if (choice === 'search_exit') {
    await response.answerCallbackQuery();
    await ctx.reply('Suche beendet!');
    return;
  }

  await response.answerCallbackQuery();

  switch (choice) {
    case 'search_today':
      await handleTodaySearch(ctx);
      break;
    case 'search_tomorrow':
      await handleTomorrowSearch(ctx);
      break;
    case 'search_specific':
      await handleSpecificDateSearch(conversation, ctx);
      break;
  }

  await ctx.reply(
    'Suche abgeschlossen. Du kannst eine neue Suche starten, indem du den Befehl erneut ausführst.',
  );
}

async function handleTodaySearch(ctx: MyContext) {
  const today = new Date();
  const events = await findEventsForDay(today, today);
  await sendSearchResultsToUser(events, 'Heute', ctx.chat!.id.toString());
}

async function handleTomorrowSearch(ctx: MyContext) {
  const tomorrow = addDays(new Date(), 1);
  const events = await findEventsForDay(tomorrow, tomorrow);
  await sendSearchResultsToUser(events, 'Morgen', ctx.chat!.id.toString());
}

async function handleSpecificDateSearch(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  let validDate = false;
  let searchDate: Date | null = null;
  let dateText: string = '';

  while (!validDate) {
    await ctx.reply('Bitte gib ein Datum ein (Format: TT.MM.JJJJ):');
    const dateResponse = await conversation.waitFor('message:text');
    dateText = dateResponse.message.text;
    searchDate = parse(dateText, 'dd.MM.yyyy', new Date(), { locale: de });

    if (isNaN(searchDate.getTime())) {
      await ctx.reply(
        `${ICONS.reject} Ungültiges Datumsformat! Bitte verwende das Format TT.MM.JJJJ.`,
      );
    } else {
      validDate = true;
    }
  }

  if (searchDate !== null) {
    const events = await findEventsForDay(searchDate, searchDate);
    await sendSearchResultsToUser(events, dateText, ctx.chat!.id.toString());
  }
}
