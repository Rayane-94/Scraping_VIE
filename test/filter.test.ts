import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeFilter, highlights } from '../src/filter.ts';
import type { VieOffer } from '../src/types.ts';

const offer = (missionTitle: string, extra: Partial<VieOffer> = {}): VieOffer => ({ id: 1, missionTitle, ...extra });

describe('makeFilter', () => {
  const keep = makeFilter({
    include: ['developpeu(r|se)', '\\bweb\\b'],
    exclude: ['developpeu(r|se) d.affaires'],
  });

  it('garde un titre qui contient un mot inclus', () => {
    assert.ok(keep(offer('Développeur Full Stack (H/F)')));
  });

  it('ignore les accents et la casse', () => {
    assert.ok(keep(offer('DÉVELOPPEUSE REACT')));
  });

  it('écarte un titre exclu même s’il contient un mot inclus', () => {
    assert.equal(keep(offer("Développeur d'affaires Asie")), false);
  });

  it('écarte un titre sans mot inclus', () => {
    assert.equal(keep(offer('Contrôleur de gestion')), false);
  });

  it('respecte les limites de mot (\\b)', () => {
    assert.equal(keep(offer('Webinar manager')), false);
    assert.ok(keep(offer('Chef de projet web')));
  });

  it('supporte un titre manquant', () => {
    assert.equal(keep(offer('', { missionTitle: null })), false);
  });

  it('filtre par pays via le code ou le nom', () => {
    const inCanada = makeFilter({ include: ['dev'], countries: ['CA', 'belgique'] });
    assert.ok(inCanada(offer('dev', { countryId: 'CA', countryName: 'CANADA' })));
    assert.ok(inCanada(offer('dev', { countryId: 'BE', countryName: 'BELGIQUE' })));
    assert.equal(inCanada(offer('dev', { countryId: 'US', countryName: 'ETATS-UNIS' })), false);
  });
});

describe('highlights', () => {
  it('relève les technos citées dans le titre, la description ou le profil, sans doublon', () => {
    const o = offer('Développeur React', {
      missionDescription: 'Stack : React, Node et Docker',
      missionProfile: 'Une expérience Docker est un plus',
    });
    assert.deepEqual(highlights(o, ['react', 'node', 'docker', 'php']), ['react', 'node', 'docker']);
  });

  it('renvoie le texte réellement trouvé pour un motif regex', () => {
    const o = offer('Développeur full-stack');
    assert.deepEqual(highlights(o, ['full.?stack']), ['full-stack']);
  });
});
