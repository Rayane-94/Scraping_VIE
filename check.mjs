// vie-watcher : récupère les offres VIE, filtre, notifie les nouvelles, met à jour seen.json.
// Usage : node check.mjs [--dry-run]   (--dry-run : affiche sans notifier ni écrire)
import { readFile, writeFile, rename } from 'node:fs/promises';

const SITE = 'https://mon-vie-via.businessfrance.fr';
const API = 'https://civiweb-api-prd.azurewebsites.net/api/Offers/search';
const PAGE_SIZE = 100;          // l'API refuse au-delà
const MAX_PAGES = 50;
const MAX_NOTIFS = 25;          // au-delà : un message récapitulatif
const PRUNE_DAYS = 180;
const SEEN_FILE = new URL('./seen.json', import.meta.url);
const CONFIG_FILE = new URL('./config.json', import.meta.url);

const DRY_RUN = process.argv.includes('--dry-run');
const { TG_TOKEN, TG_CHAT, NTFY_TOPIC, VIE_API_KEY } = process.env;

// ---------- utilitaires ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// minuscules + sans accents, pour des regex simples dans config.json
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const compile = (list = []) => list.map((p) => new RegExp(norm(p), 'i'));

const escapeHtml = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

async function fetchRetry(url, options = {}, { retries = 3, timeout = 30_000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
    } catch (err) {
      lastErr = err; // réseau / timeout : on réessaie
    }
    if (res?.ok) return res;
    if (res) {
      const body = await res.text().catch(() => '');
      // les logs Actions d'un repo public sont visibles : on masque token et topic
      const safeUrl = url.replace(/\/bot[^/]+/, '/bot***').replace(/ntfy\.sh\/.+/, 'ntfy.sh/***');
      lastErr = new Error(`HTTP ${res.status} sur ${safeUrl} ${body.slice(0, 200)}`);
      if (res.status < 500 && res.status !== 429) break; // 4xx : inutile de réessayer
    }
    if (attempt < retries) await sleep(2 ** attempt * 1000);
  }
  throw lastErr;
}

// ---------- source ----------

// La clé X-API-KEY est publique (injectée dans la config Nuxt du site) mais peut changer :
// on la relit à chaque exécution, sauf si VIE_API_KEY est fournie.
async function getApiKey() {
  if (VIE_API_KEY) return VIE_API_KEY;
  const html = await (await fetchRetry(SITE + '/')).text();
  const m = html.match(/[,{]API_KEY:"([^"]+)"/);
  if (!m) throw new Error('API_KEY introuvable dans la page du site (structure changée ?)');
  return JSON.parse(`"${m[1]}"`); // décode les /
}

async function fetchAllOffers() {
  const apiKey = await getApiKey();
  const offers = [];
  let total = Infinity;
  for (let page = 0; page < MAX_PAGES && offers.length < total; page++) {
    const res = await fetchRetry(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ skip: page * PAGE_SIZE, limit: PAGE_SIZE, sort: 0 }),
    });
    const data = await res.json();
    const batch = data.result ?? data.results;
    if (!Array.isArray(batch)) throw new Error('Réponse API inattendue : pas de tableau "result"');
    total = Number(data.count ?? 0);
    offers.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  if (offers.length === 0) throw new Error('0 offre renvoyée par l’API : on ne touche à rien');
  if (offers.length < total) throw new Error(`Pagination incomplète : ${offers.length}/${total}`);
  return offers;
}

// ---------- filtre ----------

function makeFilter(config) {
  const include = compile(config.include);
  const exclude = compile(config.exclude);
  const countries = (config.countries ?? []).map(norm);
  return (o) => {
    const title = norm(o.missionTitle);
    if (!include.some((r) => r.test(title))) return false;
    if (exclude.some((r) => r.test(title))) return false;
    if (countries.length && !countries.includes(norm(o.countryId)) && !countries.includes(norm(o.countryName))) return false;
    return true;
  };
}

// technos du profil citées dans l'offre (affichées dans la notif)
function highlights(o, patterns) {
  const text = norm(`${o.missionTitle} ${o.missionDescription} ${o.missionProfile}`);
  const found = compile(patterns).map((r) => text.match(r)?.[0]).filter(Boolean);
  return [...new Set(found)];
}

// ---------- notifications ----------

function formatOffer(o, tags) {
  const lines = [
    `<b>${escapeHtml(o.missionTitle)}</b>`,
    `🏢 ${escapeHtml(o.organizationName)}`,
    `📍 ${escapeHtml([o.cityName, o.countryName].filter(Boolean).join(', '))}`,
    `⏱ ${o.missionDuration ?? '?'} mois` + (o.indemnite ? ` · 💶 ${Math.round(o.indemnite)} €/mois` : ''),
  ];
  if (o.missionStartDate) lines.push(`🗓 Début : ${o.missionStartDate.slice(0, 10)}`);
  if (tags.length) lines.push(`🧩 ${escapeHtml(tags.join(', '))}`);
  lines.push(`${SITE}/offres/${o.id}`);
  return lines.join('\n');
}

async function sendTelegram(html) {
  await fetchRetry(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

const toPlain = (html) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function sendNtfy(html, url) {
  await fetchRetry(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: { Title: 'Nouvelle offre VIE', ...(url && { Click: url }) },
    body: toPlain(html),
  });
}

async function notify(html, url) {
  if (TG_TOKEN && TG_CHAT) await sendTelegram(html);
  if (NTFY_TOPIC) await sendNtfy(html, url);
}

// ---------- seen.json ----------

async function loadSeen() {
  try {
    return JSON.parse(await readFile(SEEN_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`seen.json illisible, abandon pour ne pas le perdre : ${err.message}`);
  }
}

async function saveSeen(seen) {
  const tmp = new URL('./seen.json.tmp', import.meta.url);
  await writeFile(tmp, JSON.stringify(seen, null, 2) + '\n');
  await rename(tmp, SEEN_FILE);
}

// ---------- main ----------

async function main() {
  const config = JSON.parse(await readFile(CONFIG_FILE, 'utf8'));
  if (!DRY_RUN && !(TG_TOKEN && TG_CHAT) && !NTFY_TOPIC) {
    throw new Error('Aucun canal de notif : définir TG_TOKEN + TG_CHAT ou NTFY_TOPIC (ou lancer avec --dry-run)');
  }

  const seen = await loadSeen();
  const offers = await fetchAllOffers();
  const matching = offers.filter(makeFilter(config));
  const fresh = matching.filter((o) => !seen[o.id]);
  console.log(`${offers.length} offres, ${matching.length} pertinentes, ${fresh.length} nouvelles`);

  if (DRY_RUN) {
    for (const o of fresh) console.log('\n' + toPlain(formatOffer(o, highlights(o, config.highlight ?? []))));
    return;
  }

  const now = new Date().toISOString();
  let sent = 0;
  try {
    for (const o of fresh.slice(0, MAX_NOTIFS)) {
      await notify(formatOffer(o, highlights(o, config.highlight ?? [])), `${SITE}/offres/${o.id}`);
      seen[o.id] = { title: o.missionTitle, at: now };
      sent++;
      await sleep(1100); // reste sous les limites Telegram
    }
    const rest = fresh.slice(MAX_NOTIFS);
    if (rest.length) {
      await notify(`<b>+${rest.length} autres offres VIE</b> correspondent :\n${SITE}/offres`);
      for (const o of rest) seen[o.id] = { title: o.missionTitle, at: now };
    }
  } finally {
    // on n'enregistre que ce qui a vraiment été notifié ; le reste sera retenté au prochain run
    const cutoff = Date.now() - PRUNE_DAYS * 86_400_000;
    for (const [id, v] of Object.entries(seen)) if (Date.parse(v.at) < cutoff) delete seen[id];
    if (sent > 0) await saveSeen(seen);
    console.log(`${sent} notification(s) envoyée(s)`);
  }
}

main().catch((err) => {
  console.error('ERREUR :', err.message, err.cause?.code ?? err.cause?.message ?? '');
  process.exit(1);
});
