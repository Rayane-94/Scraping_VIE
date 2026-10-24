import { compile, norm } from './text.ts';
import type { Config, VieOffer } from './types.ts';

export function makeFilter(config: Config): (o: VieOffer) => boolean {
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
export function highlights(o: VieOffer, patterns: readonly string[]): string[] {
  const text = norm(`${o.missionTitle} ${o.missionDescription} ${o.missionProfile}`);
  const found = compile(patterns)
    .map((r) => text.match(r)?.[0])
    .filter((m): m is string => Boolean(m));
  return [...new Set(found)];
}
