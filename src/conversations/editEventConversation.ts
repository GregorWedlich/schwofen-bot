import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { parse } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { Event } from '@prisma/client';

import { sendEventToAdmins } from '../controllers/eventController';
import {
  updateEvent,
  findUserApprovedEvents,
  findEventById,
} from '../models/eventModel';
import { MyContext } from '../types/context';
import { ICONS } from '../utils/iconUtils';
import { escapeMarkdownV2Text } from '../utils/markdownUtils';
import { getLocale } from '../utils/localeUtils';
import { TIMEZONE, DATE_FORMAT } from '../constants/constants';

const locale = getLocale();

export async function editEventConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply('Benutzer nicht gefunden.');
    return;
  }

  const events = await findUserApprovedEvents(userId);

  if (events.length === 0) {
    await ctx.reply(
      'Du hast keine genehmigten Veranstaltungen in der Zukunft zur Bearbeitung.',
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  events.forEach((event) => {
    keyboard.text(event.title, `edit_event_${event.id}`).row();
  });

  await ctx.reply('Wähle die Veranstaltung, die du bearbeiten möchtest:', {
    reply_markup: keyboard,
  });

  const eventSelection = await conversation.waitForCallbackQuery(
    new RegExp(`^edit_event_(${events.map((e) => e.id).join('|')})$`),
  );
  const eventId = eventSelection.callbackQuery.data.replace('edit_event_', '');
  await eventSelection.answerCallbackQuery();

  let event = (await findEventById(eventId)) as Event;

  await ctx.reply('Aktueller Inhalt der Veranstaltung:');

  const formattedStartDate = formatInTimeZone(
    event.date,
    TIMEZONE,
    DATE_FORMAT,
    { locale },
  );
  const formattedEndDate = formatInTimeZone(
    event.endDate,
    TIMEZONE,
    DATE_FORMAT,
    { locale },
  );

  await ctx.reply(`*Titel:* ${escapeMarkdownV2Text(event.title)}`, {
    parse_mode: 'MarkdownV2',
  });
  await ctx.reply(
    `*Beschreibung:* ${escapeMarkdownV2Text(event.description)}`,
    { parse_mode: 'MarkdownV2' },
  );
  await ctx.reply(`*Startdatum:* ${escapeMarkdownV2Text(formattedStartDate)}`, {
    parse_mode: 'MarkdownV2',
  });
  await ctx.reply(`*Enddatum:* ${escapeMarkdownV2Text(formattedEndDate)}`, {
    parse_mode: 'MarkdownV2',
  });
  await ctx.reply(`*Ort:* ${escapeMarkdownV2Text(event.location)}`, {
    parse_mode: 'MarkdownV2',
  });
  await ctx.reply(
    `*Kategorie:* ${escapeMarkdownV2Text(event.category.join(', '))}`,
    { parse_mode: 'MarkdownV2' },
  );
  await ctx.reply(
    `*Links:* ${
      event.links.length > 0
        ? escapeMarkdownV2Text(event.links.join(', '))
        : 'Keine'
    }`,
    { parse_mode: 'MarkdownV2' },
  );

  const fieldsToEdit: Partial<Event> = {};

  const editableFields: Array<keyof Event> = [
    'title',
    'description',
    'date',
    'endDate',
    'location',
    'category',
    'links',
    'imageBase64',
  ];

  for (const field of editableFields) {
    await ctx.reply(`Möchtest du **${field}** ändern?`, {
      reply_markup: new InlineKeyboard()
        .text('Ja', `edit_${field}`)
        .text('Nein', `skip_${field}`),
    });

    const editResponse = await conversation.waitForCallbackQuery([
      `edit_${field}`,
      `skip_${field}`,
    ]);
    await editResponse.answerCallbackQuery();

    if (editResponse.callbackQuery.data === `edit_${field}`) {
      switch (field) {
        case 'title': {
          await ctx.reply('Bitte gib den neuen Titel ein:');
          const newTitleResponse = await conversation.waitFor('message:text');
          fieldsToEdit.title = newTitleResponse.message.text;
          break;
        }
        case 'description': {
          await ctx.reply('Bitte gib die neue Beschreibung ein:');
          const newDescriptionResponse = await conversation.waitFor(
            'message:text',
          );
          fieldsToEdit.description = newDescriptionResponse.message.text;
          break;
        }
        case 'date': {
          let validStartDate = false;
          while (!validStartDate) {
            await ctx.reply(
              `Bitte gib das neue Startdatum und die Startzeit ein (Format: ${DATE_FORMAT}):`,
            );
            const newStartDateResponse = await conversation.waitFor(
              'message:text',
            );
            const parsedStartDateInTimeZone = parse(
              newStartDateResponse.message.text,
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

            const parsedStartDate = fromZonedTime(
              parsedStartDateInTimeZone,
              TIMEZONE,
            );

            fieldsToEdit.date = parsedStartDate;
            validStartDate = true;
          }
          break;
        }
        case 'endDate': {
          let validEndDate = false;
          while (!validEndDate) {
            await ctx.reply(
              `Bitte gib das neue Enddatum und die Endzeit ein (Format: ${DATE_FORMAT}):`,
            );
            const newEndDateResponse = await conversation.waitFor(
              'message:text',
            );
            const parsedEndDateInTimeZone = parse(
              newEndDateResponse.message.text,
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

            const parsedEndDate = fromZonedTime(
              parsedEndDateInTimeZone,
              TIMEZONE,
            );

            const startDate = fieldsToEdit.date || event.date;
            if (parsedEndDate <= startDate) {
              await ctx.reply(
                `${ICONS.reject} Das Enddatum muss nach dem Startdatum liegen!`,
              );
              continue;
            }

            fieldsToEdit.endDate = parsedEndDate;
            validEndDate = true;
          }
          break;
        }
        case 'location': {
          await ctx.reply('Bitte gib die neue Location ein:');
          const newLocationResponse = await conversation.waitFor(
            'message:text',
          );
          fieldsToEdit.location = newLocationResponse.message.text;
          break;
        }
        case 'category': {
          let selectedCategories: string[] = [];
          let categorySelectionComplete = false;

          while (!categorySelectionComplete) {
            await ctx.reply('Bitte wähle die neuen Kategorien aus:', {
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
                  [
                    {
                      text: `${ICONS.reset} Reset`,
                      callback_data: 'cat_reset',
                    },
                  ],
                  [
                    {
                      text: `${ICONS.approve} Fertig`,
                      callback_data: 'cat_done',
                    },
                  ],
                ],
              },
            });

            const categoryResponse = await conversation.waitForCallbackQuery(
              /^cat_/,
            );
            const selection = categoryResponse.callbackQuery.data.replace(
              'cat_',
              '',
            );

            if (selection === 'done') {
              if (selectedCategories.length > 0) {
                categorySelectionComplete = true;
                fieldsToEdit.category = selectedCategories;
                await categoryResponse.answerCallbackQuery(
                  'Kategorien gespeichert!',
                );
              } else {
                await categoryResponse.answerCallbackQuery(
                  'Bitte mindestens eine Kategorie wählen!',
                );
              }
            } else if (selection === 'reset') {
              selectedCategories = [];
              await categoryResponse.answerCallbackQuery(
                'Kategorien zurückgesetzt!',
              );
              await ctx.reply(
                'Kategorieauswahl wurde zurückgesetzt. Bitte wähle erneut.',
              );
            } else {
              if (!selectedCategories.includes(selection)) {
                selectedCategories.push(selection);
                await categoryResponse.answerCallbackQuery(
                  `${selection} hinzugefügt!`,
                );
              } else {
                selectedCategories = selectedCategories.filter(
                  (cat) => cat !== selection,
                );
                await categoryResponse.answerCallbackQuery(
                  `${selection} entfernt!`,
                );
              }
              await ctx.reply(
                `Ausgewählte Kategorien: ${selectedCategories.join(', ')}`,
              );
            }
          }
          break;
        }
        case 'links': {
          await ctx.reply(
            'Bitte gib bis zu **2 Links** ein, getrennt durch Leerzeichen (oder schreibe "no" für keine Links):',
          );
          const linksResponse = await conversation.waitFor('message:text');
          const linksText = linksResponse.message.text;
          if (linksText.toLowerCase() !== 'no') {
            const links = linksText.split(' ').slice(0, 2);
            fieldsToEdit.links = links;
          } else {
            fieldsToEdit.links = [];
          }
          break;
        }
        case 'imageBase64': {
          let validImageInput = false;

          while (!validImageInput) {
            await ctx.reply(
              'Bitte sende ein **neues Bild** für die Veranstaltung oder schreibe "no" für kein Bild:',
            );
            const imageResponse = await conversation.wait();

            if (imageResponse.message?.photo) {
              const photo =
                imageResponse.message.photo[
                  imageResponse.message.photo.length - 1
                ];
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

              fieldsToEdit.imageBase64 = base64Image;
              validImageInput = true;
            } else if (imageResponse.message?.text?.toLowerCase() === 'no') {
              fieldsToEdit.imageBase64 = null;
              validImageInput = true;
            } else {
              await ctx.reply(
                'Ungültige Eingabe. Bitte sende ein Bild oder schreibe "no" für kein Bild.',
              );
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  if (Object.keys(fieldsToEdit).length === 0) {
    await ctx.reply('Keine Änderungen vorgenommen.');
    return;
  }

  const updatedEvent = { ...event, ...fieldsToEdit };

  const updatedFormattedStartDate = formatInTimeZone(
    updatedEvent.date,
    TIMEZONE,
    DATE_FORMAT,
    { locale },
  );
  const updatedFormattedEndDate = formatInTimeZone(
    updatedEvent.endDate,
    TIMEZONE,
    DATE_FORMAT,
    { locale },
  );

  await ctx.reply('Zusammenfassung der Änderungen:');
  await ctx.reply(`*Titel:* ${escapeMarkdownV2Text(updatedEvent.title)}`, {
    parse_mode: 'MarkdownV2',
  });
  await ctx.reply(
    `*Beschreibung:* ${escapeMarkdownV2Text(updatedEvent.description)}`,
    { parse_mode: 'MarkdownV2' },
  );
  await ctx.reply(
    `*Startdatum:* ${escapeMarkdownV2Text(updatedFormattedStartDate)}`,
    { parse_mode: 'MarkdownV2' },
  );
  await ctx.reply(
    `*Enddatum:* ${escapeMarkdownV2Text(updatedFormattedEndDate)}`,
    { parse_mode: 'MarkdownV2' },
  );
  await ctx.reply(`*Ort:* ${escapeMarkdownV2Text(updatedEvent.location)}`, {
    parse_mode: 'MarkdownV2',
  });
  await ctx.reply(
    `*Kategorie:* ${escapeMarkdownV2Text(updatedEvent.category.join(', '))}`,
    { parse_mode: 'MarkdownV2' },
  );
  await ctx.reply(
    `*Links:* ${
      updatedEvent.links.length > 0
        ? escapeMarkdownV2Text(updatedEvent.links.join(', '))
        : 'Keine'
    }`,
    { parse_mode: 'MarkdownV2' },
  );

  await ctx.reply('Möchtest du die Änderungen speichern?', {
    reply_markup: new InlineKeyboard()
      .text('Ja', 'save_changes')
      .text('Nein', 'discard_changes'),
  });

  const saveChanges = await conversation.waitForCallbackQuery([
    'save_changes',
    'discard_changes',
  ]);
  await saveChanges.answerCallbackQuery();

  if (saveChanges.callbackQuery.data === 'save_changes') {
    await updateEvent(eventId, {
      ...fieldsToEdit,
      status: 'EDITED_PENDING',
    });

    event = (await findEventById(eventId)) as Event;

    await sendEventToAdmins(event, true);

    await ctx.reply(
      'Deine Änderungen wurden gespeichert und zur Überprüfung an die Admins gesendet.',
    );
  } else {
    await ctx.reply('Änderungen wurden verworfen.');
  }
}
