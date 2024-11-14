import { formatInTimeZone } from 'date-fns-tz';
import { InputFile } from 'grammy';
import { Readable } from 'stream';
import { Event } from '@prisma/client';

import { bot } from '../bot';
import {
  ADMIN_CHAT_ID,
  CHANNEL_USERNAME,
  TIMEZONE,
  DATE_FORMAT,
} from '../constants/constants';
import { publishEvent } from '../controllers/eventController';
import {
  approveEvent,
  approveEditedEvent,
  findEventById,
  updateEvent,
} from '../models/eventModel';
import { MyContext } from '../types/context';
import { getLocale } from '../utils/localeUtils';
import { ICONS } from '../utils/iconUtils';
import {
  escapeMarkdownV2Text,
  escapeMarkdownV2Url,
} from '../utils/markdownUtils';

const locale = getLocale();

export async function notifyAdminsOfEvent(event: Event, isEdit = false) {
  const messageLines = [
    isEdit
      ? `✏️ *Bearbeitete Veranstaltung zur Überprüfung:*`
      : `📢 *Neue Veranstaltung eingereicht:*`,
    `*Von:* ${escapeMarkdownV2Text(event.submittedBy.toString())}`,
    `*Titel:* ${escapeMarkdownV2Text(event.title)}`,
  ];

  if (event.location) {
    messageLines.push(`*Ort:* ${escapeMarkdownV2Text(event.location)}`);
  }

  messageLines.push(
    `*Datum Start:* ${escapeMarkdownV2Text(
      formatInTimeZone(event.date, TIMEZONE, DATE_FORMAT, { locale }),
    )}`,
  );

  messageLines.push(
    `*Datum Ende:* ${escapeMarkdownV2Text(
      formatInTimeZone(event.endDate, TIMEZONE, DATE_FORMAT, { locale }),
    )}`,
  );

  if (event.category) {
    const categoryText = Array.isArray(event.category)
      ? event.category.join(', ')
      : event.category;
    messageLines.push(`*Kategorie:* ${escapeMarkdownV2Text(categoryText)}`);
  }

  messageLines.push(
    `*Beschreibung:* ${escapeMarkdownV2Text(event.description)}`,
  );

  if (event.links && event.links.length > 0) {
    const linksText = event.links
      .map((link) => {
        const escapedLinkText = escapeMarkdownV2Text(link);
        const escapedLinkUrl = escapeMarkdownV2Url(link);
        return `[${escapedLinkText}](${escapedLinkUrl})`;
      })
      .join('\n');
    messageLines.push(`*Links:*\n${linksText}`);
  }

  const messageText = messageLines.join('\n');
  const approveKeyboard = {
    inline_keyboard: [
      [
        {
          text: 'Annehmen',
          callback_data: isEdit
            ? `approve_edit_${event.id}`
            : `approve_${event.id}`,
        },
        {
          text: 'Ablehnen',
          callback_data: isEdit
            ? `reject_edit_${event.id}`
            : `reject_${event.id}`,
        },
      ],
    ],
  };

  if (event.imageBase64) {
    const imageBuffer = Buffer.from(event.imageBase64, 'base64');
    const stream = Readable.from(imageBuffer);
    await bot.api.sendPhoto(ADMIN_CHAT_ID, new InputFile(stream), {
      caption: messageText,
      parse_mode: 'MarkdownV2',
      reply_markup: approveKeyboard,
    });
  } else {
    await bot.api.sendMessage(ADMIN_CHAT_ID, messageText, {
      parse_mode: 'MarkdownV2',
      reply_markup: approveKeyboard,
    });
  }
}

export async function handleEventApproval(eventId: string, ctx: MyContext) {
  try {
    const event = await findEventById(eventId);

    if (!event) {
      await ctx.answerCallbackQuery({
        text: 'Veranstaltung nicht gefunden.',
        show_alert: true,
      });
      return;
    }

    if (event.status === 'APPROVED' || event.status === 'EDITED_APPROVED') {
      await ctx.answerCallbackQuery({
        text: 'Veranstaltung wurde bereits veröffentlicht.',
        show_alert: true,
      });
      return;
    }

    let approvedEvent: Event;

    if (event.status === 'PENDING') {
      approvedEvent = await approveEvent(eventId);
    } else if (event.status === 'EDITED_PENDING') {
      approvedEvent = await approveEditedEvent(eventId);
    } else {
      await ctx.answerCallbackQuery({
        text: 'Unbekannter Status der Veranstaltung.',
        show_alert: true,
      });
      return;
    }

    await publishEvent(approvedEvent);

    const message = escapeMarkdownV2Text(
      `${ICONS.approve} Die Veranstaltung "${event.title}" wurde erfolgreich im Kanal ${CHANNEL_USERNAME} veröffentlicht!`,
    );

    await bot.api.sendMessage(ADMIN_CHAT_ID, message, {
      parse_mode: 'MarkdownV2',
    });

    await ctx.answerCallbackQuery('Veranstaltung wurde veröffentlicht.');
  } catch (error) {
    console.error('Fehler beim Genehmigen der Veranstaltung:', error);
    await ctx.answerCallbackQuery({
      text: 'Fehler beim Veröffentlichen der Veranstaltung.',
      show_alert: true,
    });
  }
}

export async function handleEventRejection(eventId: string, ctx: MyContext) {
  try {
    ctx.session.eventId = eventId;
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('rejectEventConversation');
  } catch (error) {
    console.error('Fehler beim Ablehnen der Veranstaltung:', error);
    await ctx.answerCallbackQuery({
      text: 'Fehler beim Ablehnen der Veranstaltung.',
      show_alert: true,
    });
  }
}

export async function postEventToChannel(event: Event): Promise<void> {
  const messageLines = [
    `${ICONS.announcement} *${escapeMarkdownV2Text(event.title)}*`,
    `${ICONS.location} *Ort:* ${escapeMarkdownV2Text(event.location)}`,
    `${ICONS.date} *Start:* ${escapeMarkdownV2Text(
      formatInTimeZone(event.date, TIMEZONE, DATE_FORMAT, { locale }),
    )}\n`,
    `${ICONS.date} *Ende:* ${escapeMarkdownV2Text(
      formatInTimeZone(event.endDate, TIMEZONE, DATE_FORMAT, { locale }),
    )}\n`,
  ];

  if (event.category.length > 0) {
    messageLines.push(
      `${ICONS.category} *Kategorie:* ${escapeMarkdownV2Text(
        event.category.join(', '),
      )}`,
    );
  }

  messageLines.push(
    `${ICONS.description} *Beschreibung:* ${escapeMarkdownV2Text(
      event.description,
    )}`,
  );

  if (event.links && event.links.length > 0) {
    const linksText = event.links
      .map((link) => {
        const escapedLinkText = escapeMarkdownV2Text(link);
        const escapedLinkUrl = escapeMarkdownV2Url(link);
        return `[${escapedLinkText}](${escapedLinkUrl})`;
      })
      .join('\n');
    messageLines.push(`${ICONS.links} *Links:*\n${linksText}`);
  }

  const messageText = messageLines.join('\n');

  if (event.imageBase64) {
    const imageBuffer = Buffer.from(event.imageBase64, 'base64');
    const stream = Readable.from(imageBuffer);

    const sentMessage = await bot.api.sendPhoto(
      CHANNEL_USERNAME,
      new InputFile(stream),
      {
        caption: messageText,
        parse_mode: 'MarkdownV2',
      },
    );

    await updateEvent(event.id, { messageId: sentMessage.message_id });
  } else {
    const sentMessage = await bot.api.sendMessage(
      CHANNEL_USERNAME,
      messageText,
      {
        parse_mode: 'MarkdownV2',
      },
    );

    await updateEvent(event.id, { messageId: sentMessage.message_id });
  }
}

export async function updateEventInChannel(event: Event): Promise<void> {
  const messageLines = [
    `${ICONS.announcement} *${escapeMarkdownV2Text(event.title)}*`,
    `${ICONS.location} *Ort:* ${escapeMarkdownV2Text(event.location)}`,
    `${ICONS.date} *Start:* ${escapeMarkdownV2Text(
      formatInTimeZone(event.date, TIMEZONE, DATE_FORMAT, { locale }),
    )}\n`,
    `${ICONS.date} *Ende:* ${escapeMarkdownV2Text(
      formatInTimeZone(event.endDate, TIMEZONE, DATE_FORMAT, { locale }),
    )}\n`,
  ];

  if (event.category.length > 0) {
    messageLines.push(
      `${ICONS.category} *Kategorie:* ${escapeMarkdownV2Text(
        event.category.join(', '),
      )}`,
    );
  }

  messageLines.push(
    `${ICONS.description} *Beschreibung:* ${escapeMarkdownV2Text(
      event.description,
    )}`,
  );

  if (event.links && event.links.length > 0) {
    const linksText = event.links
      .map((link) => {
        const escapedLinkText = escapeMarkdownV2Text(link);
        const escapedLinkUrl = escapeMarkdownV2Url(link);
        return `[${escapedLinkText}](${escapedLinkUrl})`;
      })
      .join('\n');
    messageLines.push(`${ICONS.links} *Links:*\n${linksText}`);
  }

  const messageText = messageLines.join('\n');

  if (event.imageBase64) {
    const imageBuffer = Buffer.from(event.imageBase64, 'base64');
    const stream = Readable.from(imageBuffer);

    if (event.messageId) {
      await bot.api.deleteMessage(CHANNEL_USERNAME, event.messageId);
    }
    const sentMessage = await bot.api.sendPhoto(
      CHANNEL_USERNAME,
      new InputFile(stream),
      {
        caption: messageText,
        parse_mode: 'MarkdownV2',
      },
    );

    await updateEvent(event.id, { messageId: sentMessage.message_id });
  } else {
    if (event.messageId) {
      await bot.api.editMessageText(
        CHANNEL_USERNAME,
        event.messageId,
        messageText,
        {
          parse_mode: 'MarkdownV2',
        },
      );
    } else {
      const sentMessage = await bot.api.sendMessage(
        CHANNEL_USERNAME,
        messageText,
        {
          parse_mode: 'MarkdownV2',
        },
      );
      await updateEvent(event.id, { messageId: sentMessage.message_id });
    }
  }
}

export async function sendSearchToUser(
  events: Event[],
  dateText: string,
  chatId: string,
): Promise<void> {
  if (events.length === 0) {
    await bot.api.sendMessage(
      chatId,
      `Keine Veranstaltungen für ${escapeMarkdownV2Text(dateText)}\\.`,
      { parse_mode: 'MarkdownV2' },
    );
    return;
  }

  for (const [index, event] of events.entries()) {
    let message = `${ICONS.date} *Veranstaltung ${index + 1}/${
      events.length
    }*\n\n`;
    message += `${ICONS.announcement} *${escapeMarkdownV2Text(event.title)}*\n`;
    message += `${ICONS.location} *Location:* ${escapeMarkdownV2Text(
      event.location,
    )}\n`;
    message += `${ICONS.date} *Start:* ${escapeMarkdownV2Text(
      formatInTimeZone(event.date, TIMEZONE, DATE_FORMAT, { locale }),
    )}\n`;
    message += `${ICONS.date} *Ende:* ${escapeMarkdownV2Text(
      formatInTimeZone(event.endDate, TIMEZONE, DATE_FORMAT, { locale }),
    )}\n`;

    if (event.category.length > 0) {
      message += `${ICONS.category} *Kategorie:* ${escapeMarkdownV2Text(
        event.category.join(', '),
      )}\n`;
    }

    message += `${ICONS.description} *Beschreibung:* ${escapeMarkdownV2Text(
      event.description,
    )}\n`;

    if (event.links && event.links.length > 0) {
      message += `\n${ICONS.links} *Links:*\n`;
      message += event.links
        .map((link) => {
          const escapedLinkText = escapeMarkdownV2Text(link);
          const escapedLinkUrl = escapeMarkdownV2Url(link);
          return `[${escapedLinkText}](${escapedLinkUrl})`;
        })
        .join('\n');
    }

    if (event.imageBase64) {
      const imageBuffer = Buffer.from(event.imageBase64, 'base64');
      const stream = Readable.from(imageBuffer);
      await bot.api.sendPhoto(chatId, new InputFile(stream), {
        caption: message,
        parse_mode: 'MarkdownV2',
        has_spoiler: true,
      });
    } else {
      await bot.api.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
      });
    }
  }
}
