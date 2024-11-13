import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export function formatDate(
  date: Date,
  dateFormat: string = 'dd.MM.yyyy HH:mm',
): string {
  return format(date, dateFormat, { locale: de });
}
