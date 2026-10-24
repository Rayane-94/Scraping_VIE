// vie-watcher : récupère les offres VIE, filtre, notifie les nouvelles, met à jour seen.json.
// Usage : node src/main.ts [--dry-run]   (--dry-run : affiche sans notifier ni écrire)
import { readFile } from 'node:fs/promises';
import { makeFilter, highlights } from './filter.ts';
import { formatOffer } from './format.ts';
import { sleep } from './http.ts';
import { notify } from './notify.ts';
import { loadSeen, pruneSeen, saveSeen } from './seen.ts';
import { toPlain } from './text.ts';
import { fetchAllOffers, offerUrl } from './vie.ts';
import type { Channels, Config, VieOffer } from './types.ts';

const CONFIG_FILE = new URL('../config.json', import.meta.url);
const DRY_RUN = process.argv.includes('--dry-run');

// trim : un espace ou un retour à la ligne collé dans un secret GitHub suffit à tout casser
const env = (k: string): string | undefined => process.env[k]?.trim() || undefined;

function channelsFromEnv(): Channels {
  const token = env('TELEGRAM_TOKEN');
  const chat = env('TELEGRAM_CHAT');
  const topic = env('NTFY_TOPIC');
  return {
    ...(token && chat && { telegram: { token, chat } }),
    ...(topic && { ntfy: { topic } }),
  };
}

async function main(): Promise<void> {
  const config = JSON.parse(await readFile(CONFIG_FILE, 'utf8')) as Config;
  const channels = channelsFromEnv();
  if (!DRY_RUN && !channels.telegram && !channels.ntfy) {
    throw new Error('Aucun canal de notif : définir TELEGRAM_TOKEN + TELEGRAM_CHAT ou NTFY_TOPIC (ou lancer avec --dry-run)');
  }

  const seen = await loadSeen();
  const offers = await fetchAllOffers(env('VIE_API_KEY'));
  const matching = offers.filter(makeFilter(config));
  const fresh = matching.filter((o) => !seen[o.id]);
  console.log(`${offers.length} offres, ${matching.length} pertinentes, ${fresh.length} nouvelles`);

  const format = (o: VieOffer): string => formatOffer(o, highlights(o, config.highlight ?? []));

  if (DRY_RUN) {
    for (const o of fresh) console.log('\n' + toPlain(format(o)));
    return;
  }

  const now = new Date().toISOString();
  let sent = 0;
  try {
    for (const o of fresh) {
      await notify(channels, format(o), offerUrl(o));
      seen[o.id] = { title: o.missionTitle, at: now };
      sent++;
      await sleep(1100); // ~1 msg/s : limite Telegram pour un chat privé
    }
  } finally {
    // on n'enregistre que ce qui a vraiment été notifié ; le reste sera retenté au prochain run
    pruneSeen(seen);
    if (sent > 0) await saveSeen(seen);
    console.log(`${sent} notification(s) envoyée(s)`);
  }
}

main().catch((err: Error) => {
  const cause = err.cause as { code?: string; message?: string } | undefined;
  console.error('ERREUR :', err.message, cause?.code ?? cause?.message ?? '');
  process.exit(1);
});
