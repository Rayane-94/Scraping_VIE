export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// les logs Actions d'un repo public sont visibles : on masque token et topic
export const maskUrl = (url: string): string =>
  url.replace(/\/bot[^/]+/, '/bot***').replace(/ntfy\.sh\/.+/, 'ntfy.sh/***');

// Service distant indisponible (réseau, timeout, 5xx, 429) malgré les retries :
// ce n'est pas un bug de notre côté, le run suivant réessaiera.
export class TransientError extends Error {
  override name = 'TransientError';
}

interface RetryOptions {
  retries?: number;
  timeout?: number;
}

export async function fetchRetry(
  url: string,
  options: RequestInit = {},
  { retries = 3, timeout = 30_000 }: RetryOptions = {},
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    let res: Response | undefined;
    try {
      res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
    } catch (err) {
      lastErr = err; // réseau / timeout : on réessaie
    }
    if (res?.ok) return res;
    if (res) {
      const body = await res.text().catch(() => '');
      const message = `HTTP ${res.status} sur ${maskUrl(url)} ${body.slice(0, 200)}`;
      // 4xx : requête refusée (clé, token, URL…), inutile de réessayer, c'est à corriger
      if (res.status < 500 && res.status !== 429) throw new Error(message);
      lastErr = new Error(message);
    }
    if (attempt < retries) await sleep(2 ** attempt * 1000);
  }
  const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new TransientError(`${maskUrl(url)} injoignable après ${retries} tentative(s) : ${reason}`, { cause: lastErr });
}
