// Offre telle que renvoyée par l'API Business France (seuls les champs utilisés sont typés).
// L'API n'est pas documentée : tout est optionnel sauf l'id, un champ peut manquer ou valoir null.
export interface VieOffer {
  id: number | string;
  missionTitle?: string | null;
  missionDescription?: string | null;
  missionProfile?: string | null;
  organizationName?: string | null;
  cityName?: string | null;
  countryId?: string | null;
  countryName?: string | null;
  missionDuration?: number | null;
  indemnite?: number | null;
  missionStartDate?: string | null;
  startBroadcastDate?: string | null;
  endBroadcastDate?: string | null;
}

export interface SearchResponse {
  result?: VieOffer[];
  results?: VieOffer[];
  count?: number;
}

// config.json
export interface Config {
  include: string[];
  exclude?: string[];
  countries?: string[];
  highlight?: string[];
}

// seen.json : id de l'offre -> titre et date d'envoi
export interface SeenEntry {
  title: string | null | undefined;
  at: string;
}
export type Seen = Record<string, SeenEntry>;

export interface Channels {
  telegram?: { token: string; chat: string };
  ntfy?: { topic: string };
}
