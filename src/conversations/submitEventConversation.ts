import { Conversation } from '@grammyjs/conversations';
import { Prisma } from '@prisma/client';
import { parse } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

import { sendEventToAdmins } from '../controllers/eventController';
import { TIMEZONE, DATE_FORMAT } from '../constants/constants';
import { saveEvent } from '../models/eventModel';
import { MyContext } from '../types/context';
import { ICONS } from '../utils/iconUtils';
import { getLocale } from '../utils/localeUtils';

const locale = getLocale();

export async function submitEventConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const eventData: Prisma.EventCreateInput = {
    title: '',
    description: '',
    date: new Date(),
    endDate: new Date(),
    category: [],
    links: [],
    submittedById: ctx.from?.id || 0,
    submittedBy: ctx.from?.username || ctx.from?.first_name || 'Anonym',
    location: '',
    status: 'PENDING',
    imageBase64: null,
  };

  let validTitle = false;
  while (!validTitle) {
    await ctx.reply(
      'Bitte gib den **Titel der Veranstaltung** ein (max. 65 Zeichen):',
    );
    const titleResponse = await conversation.waitFor('message:text');
    if (titleResponse.message.text.length > 65) {
      await ctx.reply(
        `${ICONS.reject} Der Titel darf maximal 65 Zeichen lang sein!`,
      );
      continue;
    }
    eventData.title = titleResponse.message.text;
    validTitle = true;
  }

  let validDescription = false;
  while (!validDescription) {
    await ctx.reply('Bitte gib eine **Beschreibung** ein (max. 600 Zeichen):');
    const descriptionResponse = await conversation.waitFor('message:text');
    if (descriptionResponse.message.text.length > 600) {
      // Telegram max Image caption limit is 1024
      await ctx.reply(
        `${ICONS.reject} Die Beschreibung darf maximal 600 Zeichen lang sein!`,
      );
      continue;
    }
    eventData.description = descriptionResponse.message.text;
    validDescription = true;
  }

  let validLocation = false;
  while (!validLocation) {
    await ctx.reply(
      'Bitte gib die **Location** ein (mindestens 3 Buchstaben):',
    );
    const locationResponse = await conversation.waitFor('message:text');
    if (locationResponse.message.text.length < 3) {
      await ctx.reply(
        `${ICONS.reject} Die Location muss mindestens 3 Buchstaben lang sein!`,
      );
      continue;
    }
    eventData.location = locationResponse.message.text;
    validLocation = true;
  }

  let datesConfirmed = false;
  let parsedStartDate: Date = new Date();
  let parsedEndDate: Date = new Date();

  while (!datesConfirmed) {
    await ctx.reply(
      `Bitte gib das **Startdatum und die Startzeit** ein (Format: ${DATE_FORMAT}):`,
    );
    const startResponse = await conversation.waitFor('message:text');

    const parsedStartDateInTimeZone = parse(
      startResponse.message.text,
      DATE_FORMAT,
      new Date(),
      { locale },
    );

    if (isNaN(parsedStartDateInTimeZone.getTime())) {
      await ctx.reply(
        `${ICONS.reject} Ungültiges Startdatum! Bitte verwende das Format ${DATE_FORMAT}`,
      );
      continue;
    }

    parsedStartDate = fromZonedTime(parsedStartDateInTimeZone, TIMEZONE);

    await ctx.reply(
      `Bitte gib das **Enddatum und die Endzeit** ein (Format: ${DATE_FORMAT}):`,
    );
    const endResponse = await conversation.waitFor('message:text');

    const parsedEndDateInTimeZone = parse(
      endResponse.message.text,
      DATE_FORMAT,
      new Date(),
      { locale },
    );

    if (isNaN(parsedEndDateInTimeZone.getTime())) {
      await ctx.reply(
        `${ICONS.reject} Ungültiges Enddatum! Bitte verwende das Format ${DATE_FORMAT}`,
      );
      continue;
    }

    parsedEndDate = fromZonedTime(parsedEndDateInTimeZone, TIMEZONE);

    if (parsedEndDate <= parsedStartDate) {
      await ctx.reply(
        `${ICONS.reject} Das Enddatum muss nach dem Startdatum liegen!`,
      );
      continue;
    }

    const formattedStartDate = formatInTimeZone(
      parsedStartDate,
      TIMEZONE,
      DATE_FORMAT,
      { locale },
    );
    const formattedEndDate = formatInTimeZone(
      parsedEndDate,
      TIMEZONE,
      DATE_FORMAT,
      { locale },
    );

    await ctx.reply(
      `${ICONS.date} Zusammenfassung:\nStart: ${formattedStartDate}\nEnde: ${formattedEndDate}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `${ICONS.approve} Bestätigen`,
                callback_data: 'dates_confirm',
              },
            ],
            [
              {
                text: `${ICONS.reset} Neu eingeben`,
                callback_data: 'dates_reset',
              },
            ],
          ],
        },
      },
    );

    const confirmResponse = await conversation.waitForCallbackQuery([
      'dates_confirm',
      'dates_reset',
    ]);

    if (confirmResponse.callbackQuery.data === 'dates_confirm') {
      eventData.date = parsedStartDate;
      eventData.endDate = parsedEndDate;
      datesConfirmed = true;
      await confirmResponse.answerCallbackQuery('Termine gespeichert!');
    } else {
      await confirmResponse.answerCallbackQuery('Eingabe zurückgesetzt!');
    }
  }

  let selectedCategories: string[] = [];
  let categorySelectionComplete = false;

  while (!categorySelectionComplete) {
    if (selectedCategories.length === 0) {
      await ctx.reply('Bitte wähle eine **Kategorie** aus:', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Tanz', callback_data: 'cat_Tanz' },
              { text: 'Musik', callback_data: 'cat_Musik' },
              { text: 'Konzert', callback_data: 'cat_Konzert' },
            ],
            [
              { text: 'Unterhaltung', callback_data: 'cat_Unterhaltung' },
              { text: 'Politisch', callback_data: 'cat_Politisch' },
            ],
            [
              { text: 'Sport', callback_data: 'cat_Sport' },
              { text: 'Bildung', callback_data: 'cat_Bildung' },
            ],
            [{ text: `${ICONS.reset} Reset`, callback_data: 'cat_reset' }],
            [{ text: `${ICONS.approve} Fertig`, callback_data: 'cat_done' }],
          ],
        },
      });
    }

    const categoryResponse = await conversation.waitForCallbackQuery(/^cat_/);
    const selection = categoryResponse.callbackQuery.data.replace('cat_', '');

    if (selection === 'done') {
      if (selectedCategories.length > 0) {
        categorySelectionComplete = true;
        eventData.category = selectedCategories;
        await categoryResponse.answerCallbackQuery('Kategorien gespeichert!');
      } else {
        await categoryResponse.answerCallbackQuery(
          'Bitte mindestens eine Kategorie wählen!',
        );
      }
    } else if (selection === 'reset') {
      selectedCategories = [];
      await categoryResponse.answerCallbackQuery('Kategorien zurückgesetzt!');
      await ctx.reply(
        'Kategorieauswahl wurde zurückgesetzt. Bitte wähle erneut.',
      );
    } else {
      if (!selectedCategories.includes(selection)) {
        selectedCategories.push(selection);
        await categoryResponse.answerCallbackQuery(`${selection} hinzugefügt!`);
      } else {
        selectedCategories = selectedCategories.filter(
          (cat) => cat !== selection,
        );
        await categoryResponse.answerCallbackQuery(`${selection} entfernt!`);
      }
      await ctx.reply(
        `Ausgewählte Kategorien: ${selectedCategories.join(', ')}`,
      );
    }
  }

  await ctx.reply(
    'Bitte gib bis zu **2 Links** ein, getrennt durch Leerzeichen (oder schreibe "no" für keine Links):',
  );
  const linksResponse = await conversation.waitFor('message:text');
  const linksText = linksResponse.message.text;
  if (linksText.toLowerCase() !== 'no') {
    const links = linksText.split(' ').slice(0, 2);
    eventData.links = links;
  } else {
    eventData.links = [];
  }

  let validImageInput = false;

  while (!validImageInput) {
    await ctx.reply(
      'Bitte sende ein **Bild** für die Veranstaltung oder schreibe "no" für kein Bild:',
    );
    const imageResponse = await conversation.wait();

    if (imageResponse.message?.photo) {
      const photo =
        imageResponse.message.photo[imageResponse.message.photo.length - 1];
      const fileId = photo.file_id;
      const file = await ctx.api.getFile(fileId);
      const filePath = file.file_path || '';
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${filePath}`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        await ctx.reply('Fehler beim Herunterladen des Bildes.');
        continue;
      }
      const buffer = await response.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString('base64');

      eventData.imageBase64 = base64Image;
      validImageInput = true;
    } else if (imageResponse.message?.text?.toLowerCase() === 'no') {
      eventData.imageBase64 = null;
      validImageInput = true;
    } else {
      await ctx.reply(
        'Ungültige Eingabe. Bitte sende ein Bild oder schreibe "no" für kein Bild.',
      );
    }
  }

  const savedEvent = await saveEvent(eventData);

  await ctx.reply(
    'Danke! Deine Veranstaltung wurde zur Überprüfung an die Admins gesendet.',
  );

  await sendEventToAdmins(savedEvent);
}
