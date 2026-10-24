import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatOffer } from '../src/format.ts';
import { escapeHtml, frDate, toPlain } from '../src/text.ts';
import type { VieOffer } from '../src/types.ts';

const full: VieOffer = {
  id: 247434,
  missionTitle: 'Développeur <Java> & Node',
  organizationName: 'ACME',
  cityName: 'MONTREAL',
  countryName: 'CANADA',
  missionDuration: 18,
  indemnite: 3813.78,
  missionStartDate: '2027-01-01T00:00:00',
  startBroadcastDate: '2026-10-23T00:00:00',
  endBroadcastDate: '2026-11-22T00:00:00',
};

describe('formatOffer', () => {
  const msg = formatOffer(full, ['java', 'node']);

  it('échappe le HTML venant de l’API', () => {
    assert.match(msg, /^<b>Développeur &lt;Java&gt; &amp; Node<\/b>$/m);
  });

  it('affiche durée, indemnité arrondie, dates et lien', () => {
    assert.match(msg, /⏱ 18 mois · 💶 3814 €\/mois/);
    assert.match(msg, /🗓 Début de mission : 01 janvier 2027/);
    assert.match(msg, /📢 Date de publication : 23 octobre 2026/);
    assert.match(msg, /⌛ Date d'expiration : 22 novembre 2026/);
    assert.match(msg, /🧩 java, node/);
    assert.ok(msg.endsWith('https://mon-vie-via.businessfrance.fr/offres/247434'));
  });

  it('omet les lignes dont la donnée manque', () => {
    const minimal = formatOffer({ id: 1, missionTitle: 'Dev', countryName: 'JAPON' }, []);
    assert.equal(
      minimal,
      ['<b>Dev</b>', '🏢 ', '📍 JAPON', '⏱ ? mois', 'https://mon-vie-via.businessfrance.fr/offres/1'].join('\n'),
    );
  });
});

describe('text', () => {
  it('toPlain retire les balises et décode les entités', () => {
    assert.equal(toPlain('<b>a &lt;b&gt; &amp; c</b>'), 'a <b> & c');
  });

  it('escapeHtml puis toPlain redonne le texte d’origine', () => {
    const s = 'R&D <Senior> > Junior';
    assert.equal(toPlain(escapeHtml(s)), s);
  });

  it('frDate ne décale pas le jour selon le fuseau', () => {
    assert.equal(frDate('2026-12-01T00:00:00'), '01 décembre 2026');
    assert.equal(frDate('2026-12-31T23:30:00+14:00'), '31 décembre 2026');
    assert.equal(frDate(null), null);
  });
});
