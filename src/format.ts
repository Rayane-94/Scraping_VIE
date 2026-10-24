import { escapeHtml, frDate } from './text.ts';
import { offerUrl } from './vie.ts';
import type { VieOffer } from './types.ts';

// tout ce qui vient de l'API est échappé : un "<" mal placé ferait refuser le message par Telegram
export function formatOffer(o: VieOffer, tags: readonly string[]): string {
  const indemnite = Number(o.indemnite);
  const lines = [
    `<b>${escapeHtml(o.missionTitle)}</b>`,
    `🏢 ${escapeHtml(o.organizationName)}`,
    `📍 ${escapeHtml([o.cityName, o.countryName].filter(Boolean).join(', '))}`,
    `⏱ ${escapeHtml(o.missionDuration ?? '?')} mois` + (indemnite > 0 ? ` · 💶 ${Math.round(indemnite)} €/mois` : ''),
  ];
  if (o.missionStartDate) lines.push(`🗓 Début de mission : ${frDate(o.missionStartDate)}`);
  if (tags.length) lines.push(`🧩 ${escapeHtml(tags.join(', '))}`);
  if (o.startBroadcastDate) lines.push(`📢 Date de publication : ${frDate(o.startBroadcastDate)}`);
  if (o.endBroadcastDate) lines.push(`⌛ Date d'expiration : ${frDate(o.endBroadcastDate)}`);
  lines.push(offerUrl(o));
  return lines.join('\n');
}
