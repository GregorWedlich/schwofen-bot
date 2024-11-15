import { Event } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { getLocale } from '../utils/localeUtils';
import { ICONS } from '../utils/iconUtils';
import {
  escapeMarkdownV2Text,
  escapeMarkdownV2Url,
} from '../utils/markdownUtils';
import { TIMEZONE, DATE_FORMAT } from '../constants/constants';

const locale = getLocale();

interface FormatEventOptions {
  context: 'admin' | 'channel' | 'user' | 'summary';
  isEdit?: boolean;
  index?: number;
  total?: number;
  dateText?: string;
  includeIndex?: boolean;
}

export function formatEvent(event: Event, options: FormatEventOptions): string {
  const {
    context,
    isEdit = false,
    index = 0,
    total = 0,
    dateText = '',
    includeIndex = false,
  } = options;

  const messageLines: string[] = [];

  if (context === 'admin') {
    messageLines.push(
      isEdit
        ? `✏️ *Bearbeitete Veranstaltung zur Überprüfung:*`
        : `📢 *Neue Veranstaltung eingereicht:*`,
    );
    messageLines.push(
      `*Von:* ${escapeMarkdownV2Text(event.submittedBy.toString())}`,
    );
  } else if (context === 'user' && includeIndex) {
    messageLines.push(`${ICONS.date} *Veranstaltung ${index + 1}/${total}*\n`);
  }

  messageLines.push(
    `${ICONS.announcement} *${escapeMarkdownV2Text(event.title)}*`,
  );

  if (event.location) {
    messageLines.push(
      `${ICONS.location} *Ort:* ${escapeMarkdownV2Text(event.location)}`,
    );
  }

  const formattedStartDate = escapeMarkdownV2Text(
    formatInTimeZone(event.date, TIMEZONE, DATE_FORMAT, { locale }),
  );
  const formattedEndDate = escapeMarkdownV2Text(
    formatInTimeZone(event.endDate, TIMEZONE, DATE_FORMAT, { locale }),
  );

  messageLines.push(`${ICONS.date} *Start:* ${formattedStartDate}`);
  messageLines.push(`${ICONS.date} *Ende:* ${formattedEndDate}`);

  if (event.category && event.category.length > 0) {
    messageLines.push(
      `${ICONS.category} *Kategorie:* ${escapeMarkdownV2Text(
        event.category.join(', '),
      )}`,
    );
  }

  if (event.description) {
    messageLines.push(
      `${ICONS.description} *Beschreibung:* ${escapeMarkdownV2Text(
        event.description,
      )}`,
    );
  }

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

  if (context === 'user' && dateText) {
    messageLines.unshift(
      `Veranstaltungen für ${escapeMarkdownV2Text(dateText)}:`,
    );
  }

  return messageLines.join('\n');
}
