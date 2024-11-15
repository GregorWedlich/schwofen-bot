import { MyContext } from '../types/context';
import { TranslationVariables } from '@grammyjs/i18n';

export function escapeMarkdownV2Text(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export function escapeMarkdownV2Url(url: string): string {
  return url.replace(/([\\()])/g, '\\$1');
}

export function tEscaped(
  ctx: MyContext,
  key: string,
  params?: TranslationVariables<string>,
): string {
  return escapeMarkdownV2Text(ctx.t(key, params));
}
