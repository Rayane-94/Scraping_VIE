// sans accents, pour des regex simples dans config.json
export const stripAccents = (s: unknown): string => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '');
export const norm = (s: unknown): string => stripAccents(s).toLowerCase();

// pas de toLowerCase sur les motifs : il transformerait \S, \W, \B en \s, \w, \b
export const compile = (list: readonly string[] = []): RegExp[] => list.map((p) => new RegExp(stripAccents(p), 'i'));

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
export const escapeHtml = (s: unknown): string => String(s ?? '').replace(/[&<>]/g, (c) => HTML_ESCAPES[c] ?? c);

export const toPlain = (html: string): string =>
  html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// "2026-12-01T00:00:00" -> "01 décembre 2026" (UTC pour ne pas décaler d'un jour selon le fuseau)
export const frDate = (iso: string | null | undefined): string | null =>
  iso
    ? new Date(iso.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : null;
