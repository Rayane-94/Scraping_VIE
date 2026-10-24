// Source des offres : l'API utilisée par le site mon-vie-via.businessfrance.fr
import { fetchRetry } from './http.ts';
import type { SearchResponse, VieOffer } from './types.ts';

export const SITE = 'https://mon-vie-via.businessfrance.fr';
const API = 'https://civiweb-api-prd.azurewebsites.net/api/Offers/search';
const PAGE_SIZE = 100; // l'API refuse au-delà
const MAX_PAGES = 50;

export const offerUrl = (o: VieOffer): string => `${SITE}/offres/${encodeURIComponent(o.id)}`;

// La clé X-API-KEY est publique (injectée dans la config Nuxt du site) mais peut changer :
// on la relit à chaque exécution, sauf si elle est fournie.
async function getApiKey(provided?: string): Promise<string> {
  if (provided) return provided;
  const html = await (await fetchRetry(SITE + '/')).text();
  const m = html.match(/[,{]API_KEY:"([^"]+)"/);
  if (!m) throw new Error('API_KEY introuvable dans la page du site (structure changée ?)');
  return JSON.parse(`"${m[1]}"`) as string; // décode les séquences \u échappées (ex. /)
}

export async function fetchAllOffers(apiKeyOverride?: string): Promise<VieOffer[]> {
  const apiKey = await getApiKey(apiKeyOverride);
  const offers: VieOffer[] = [];
  let total = Infinity;
  for (let page = 0; page < MAX_PAGES && offers.length < total; page++) {
    const res = await fetchRetry(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ skip: page * PAGE_SIZE, limit: PAGE_SIZE, sort: 0 }),
    });
    const data = (await res.json()) as SearchResponse;
    const batch = data.result ?? data.results;
    if (!Array.isArray(batch)) throw new Error('Réponse API inattendue : pas de tableau "result"');
    // sans "count" exploitable, on s'arrête sur la première page incomplète
    const count = Number(data.count);
    total = Number.isFinite(count) && count > 0 ? count : Infinity;
    offers.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  if (offers.length === 0) throw new Error('0 offre renvoyée par l’API : on ne touche à rien');
  if (Number.isFinite(total) && offers.length < total) throw new Error(`Pagination incomplète : ${offers.length}/${total}`);
  // une offre publiée pendant la pagination décale les pages : dédoublonnage par id
  return [...new Map(offers.map((o) => [String(o.id), o])).values()];
}
