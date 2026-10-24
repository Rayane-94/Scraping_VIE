import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pruneSeen } from '../src/seen.ts';
import { maskUrl } from '../src/http.ts';
import type { Seen } from '../src/types.ts';

describe('pruneSeen', () => {
  it('supprime les offres envoyées il y a plus de 180 jours', () => {
    const now = Date.parse('2026-10-24T00:00:00Z');
    const seen: Seen = {
      old: { title: 'vieille', at: '2026-04-01T00:00:00Z' },
      recent: { title: 'récente', at: '2026-10-01T00:00:00Z' },
    };
    pruneSeen(seen, now);
    assert.deepEqual(Object.keys(seen), ['recent']);
  });
});

describe('maskUrl', () => {
  it('masque le token Telegram et le topic ntfy dans les logs', () => {
    assert.equal(maskUrl('https://api.telegram.org/bot123:ABC/sendMessage'), 'https://api.telegram.org/bot***/sendMessage');
    assert.equal(maskUrl('https://ntfy.sh/mon-topic-secret'), 'https://ntfy.sh/***');
  });
});
