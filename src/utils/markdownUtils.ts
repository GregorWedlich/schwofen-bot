export function escapeMarkdownV2Text(text: string): string {
  return text.replace(/([_*[\]()~`>#+-=|{}.!\\])/g, '\\$1');
}

export function escapeMarkdownV2Url(url: string): string {
  return url.replace(/([\\()])/g, '\\$1');
}
