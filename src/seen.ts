// seen.json : mémoire des offres déjà envoyées, commitée par le workflow après chaque passage
import { readFile, writeFile, rename } from 'node:fs/promises';
import type { Seen } from './types.ts';

const SEEN_FILE = new URL('../seen.json', import.meta.url);
const SEEN_TMP = new URL('../seen.json.tmp', import.meta.url);
const PRUNE_DAYS = 180;

export async function loadSeen(): Promise<Seen> {
  try {
    return JSON.parse(await readFile(SEEN_FILE, 'utf8')) as Seen;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`seen.json illisible, abandon pour ne pas le perdre : ${(err as Error).message}`);
  }
}

// écriture atomique : un run interrompu ne laisse jamais un seen.json à moitié écrit
export async function saveSeen(seen: Seen): Promise<void> {
  await writeFile(SEEN_TMP, JSON.stringify(seen, null, 2) + '\n');
  await rename(SEEN_TMP, SEEN_FILE);
}

export function pruneSeen(seen: Seen, now = Date.now()): void {
  const cutoff = now - PRUNE_DAYS * 86_400_000;
  for (const [id, v] of Object.entries(seen)) if (Date.parse(v.at) < cutoff) delete seen[id];
}
