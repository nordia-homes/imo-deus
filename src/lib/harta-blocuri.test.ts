import { describe, expect, it } from 'vitest';

import {
  buildHartaBlocuriResult,
  cleanHartaBlocuriText,
  normalizeHartaBlocuriAddressInput,
  parseHartaBlocuriDetails,
  selectHartaBlocuriCandidates,
} from './harta-blocuri';

describe('HartaBlocuri address lookup', () => {
  it('extracts and normalizes a complete address with the city first', () => {
    expect(normalizeHartaBlocuriAddressInput('București, Str. 11 Iunie, nr 75, Sector 4'))
      .toBe('Strada 11 Iunie nr. 75');
  });

  it('normalizes boulevard abbreviations and a trailing street number', () => {
    expect(normalizeHartaBlocuriAddressInput('Bd. Mircea Vodă 52, București'))
      .toBe('Bulevardul Mircea Vodă nr. 52');
  });

  it.each([
    ['Calea Victoriei 101 Bucuresti', 'Calea Victoriei nr. 101'],
    ['Calea Victoriei 101 sector 1', 'Calea Victoriei nr. 101'],
    ['Strada Patriotilor 9 bloc PM27', 'Strada Patriotilor nr. 9'],
    ['Strada Patrioților nr. 9, bloc PM27, București', 'Strada Patrioților nr. 9'],
    ['București Sector 1 Calea Victoriei 101', 'Calea Victoriei nr. 101'],
    ['Strada 11 Iunie 75 București', 'Strada 11 Iunie nr. 75'],
  ])('removes location and building details from %s', (input, expected) => {
    expect(normalizeHartaBlocuriAddressInput(input)).toBe(expected);
  });

  it('keeps city words that are part of the street name', () => {
    expect(normalizeHartaBlocuriAddressInput('Șoseaua București-Ploiești 42'))
      .toBe('Șoseaua București-Ploiești nr. 42');
  });

  it('removes external HTML while preserving its text', () => {
    expect(cleanHartaBlocuriText('9 apartamente <span style="color:red">(trimiteți tabel)</span> &amp; planuri'))
      .toBe('9 apartamente (trimiteți tabel) & planuri');
  });

  it('selects only non-saturated map features and prioritizes the exact number', () => {
    const candidates = selectHartaBlocuriCandidates({
      features: [
        { geometry: { coordinates: [26.1, 44.4] }, properties: { id: 1, title: '.75A.', s: false } },
        { geometry: { coordinates: [26.2, 44.5] }, properties: { id: 2, title: '.75.', s: false } },
        { geometry: { coordinates: [26.3, 44.6] }, properties: { id: 3, title: '.74.', s: true } },
      ],
    }, 'Strada 11 Iunie nr. 75');

    expect(candidates.map((candidate) => candidate.id)).toEqual([2, 1]);
  });

  it('parses result details and marks an exact address match', () => {
    const rawDetails = [
      { key: 'Nume', value: 'Fără nume' },
      { key: 'Adresă', value: 'Strada 11 Iunie nr. 75' },
      { key: 'Anul finalizării', value: '1925 conform AMCCRS' },
      { key: 'Apartamente', value: '9 <span>apartamente</span>' },
    ];
    const details = parseHartaBlocuriDetails(rawDetails);
    const result = buildHartaBlocuriResult({
      id: 31734992,
      title: '.75.',
      latitude: 44.4195,
      longitude: 26.09515,
    }, rawDetails, 'Strada 11 Iunie nr. 75');

    expect(details).toContainEqual({ label: 'Apartamente', value: '9 apartamente' });
    expect(result).toMatchObject({
      id: 31734992,
      constructionYear: '1925 conform AMCCRS',
      exactMatch: true,
    });
  });
});
