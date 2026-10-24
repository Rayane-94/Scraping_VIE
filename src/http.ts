export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// les logs Actions d'un repo public sont visibles : on masque token et topic
export const maskUrl = (url: string): string =>
  url.replace(/\/bot[^/]+/, '/bot***').replace(/ntfy\.sh\/.+/, 'ntfy.sh/***');

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
      lastErr = new Error(`HTTP ${res.status} sur ${maskUrl(url)} ${body.slice(0, 200)}`);
      if (res.status < 500 && res.status !== 429) break; // 4xx : inutile de réessayer
    }
    if (attempt < retries) await sleep(2 ** attempt * 1000);
  }
  throw lastErr;
}
