import { fetchRetry } from './http.ts';
import { toPlain } from './text.ts';
import type { Channels } from './types.ts';

async function sendTelegram({ token, chat }: NonNullable<Channels['telegram']>, html: string): Promise<void> {
  await fetchRetry(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

async function sendNtfy({ topic }: NonNullable<Channels['ntfy']>, html: string, url?: string): Promise<void> {
  await fetchRetry(`https://ntfy.sh/${topic}`, {
    method: 'POST',
    headers: { Title: 'Nouvelle offre VIE', ...(url && { Click: url }) },
    body: toPlain(html),
  });
}

export async function notify(channels: Channels, html: string, url?: string): Promise<void> {
  if (channels.telegram) await sendTelegram(channels.telegram, html);
  if (channels.ntfy) await sendNtfy(channels.ntfy, html, url);
}
