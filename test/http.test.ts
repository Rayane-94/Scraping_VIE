import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRetry, TransientError } from '../src/http.ts';

const realFetch = globalThis.fetch;
const mockFetch = (impl: () => Promise<Response>) => {
  globalThis.fetch = impl as typeof fetch;
};

describe('fetchRetry', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('renvoie la réponse quand elle est OK', async () => {
    mockFetch(async () => new Response('ok'));
    const res = await fetchRetry('https://exemple.test');
    assert.equal(await res.text(), 'ok');
  });

  it('timeout ou réseau coupé : erreur passagère', async () => {
    mockFetch(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    await assert.rejects(fetchRetry('https://exemple.test', {}, { retries: 1 }), TransientError);
  });

  it('serveur en panne (5xx) ou limite atteinte (429) : erreur passagère', async () => {
    for (const status of [503, 429]) {
      mockFetch(async () => new Response('', { status }));
      await assert.rejects(fetchRetry('https://exemple.test', {}, { retries: 1 }), TransientError);
    }
  });

  it('requête refusée (4xx) : vraie erreur, sans retry', async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      return new Response('bad key', { status: 401 });
    });
    const err = await fetchRetry('https://exemple.test', {}, { retries: 3 }).catch((e: unknown) => e);
    assert.ok(err instanceof Error && !(err instanceof TransientError));
    assert.match(err.message, /HTTP 401/);
    assert.equal(calls, 1);
  });

  it('masque le token Telegram dans le message d’erreur', async () => {
    mockFetch(async () => new Response('', { status: 502 }));
    await assert.rejects(fetchRetry('https://api.telegram.org/bot123:SECRET/sendMessage', {}, { retries: 1 }), (err: Error) => {
      assert.doesNotMatch(err.message, /SECRET/);
      return true;
    });
  });
});
