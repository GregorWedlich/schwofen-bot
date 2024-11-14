import { de, enUS, Locale } from 'date-fns/locale';

import { LOCALE } from '../constants/constants';

/**
 * Mapping of available locales.
 */
export const locales: { [key: string]: Locale } = {
  de: de,
  en: enUS,
  'en-US': enUS,
};

/**
 * Returns the Locale object based on the LOCALE environment variable.
 * Falls back to enUS if LOCALE is not found.
 */
export const getLocale = (): Locale => {
  return locales[LOCALE] || enUS;
};
