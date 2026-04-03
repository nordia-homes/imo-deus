import type { Contact, ContactPreferences, MatchedBuyer, MatchedProperty, Property } from '@/lib/types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalize = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const tokenize = (value?: string | null) =>
  normalize(value)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

const unique = <T>(items: T[]) => Array.from(new Set(items));

const joinDefined = (parts: Array<string | undefined | null>) => parts.filter(Boolean).join(' ');

const roundScore = (value: number) => Math.round(clamp(value, 0, 100));

const formatReasoning = (positives: string[], caution?: string) => {
  const parts = unique(positives).slice(0, 3);
  if (caution) {
    parts.push(caution);
  }
  return parts.join('. ');
};

export function derivePreferencesFromContact(contact: Contact): ContactPreferences {
  const priceMax = contact.preferences?.desiredPriceRangeMax ?? contact.budget ?? 999999;
  const priceMin =
    contact.preferences?.desiredPriceRangeMin ??
    (contact.budget ? Math.round(contact.budget * 0.8) : 0);

  return {
    desiredPriceRangeMin: Math.max(0, priceMin),
    desiredPriceRangeMax: Math.max(priceMin, priceMax),
    desiredRooms: contact.preferences?.desiredRooms ?? 0,
    desiredBathrooms: contact.preferences?.desiredBathrooms ?? 0,
    desiredSquareFootageMin: contact.preferences?.desiredSquareFootageMin ?? 0,
    desiredSquareFootageMax: contact.preferences?.desiredSquareFootageMax ?? 999999,
    desiredFeatures: contact.preferences?.desiredFeatures ?? '',
    locationPreferences: contact.preferences?.locationPreferences ?? contact.city ?? '',
  };
}

function scoreRange(value: number, min: number, max: number, weight: number) {
  if (!value || (min <= 0 && max <= 0)) {
    return { score: Math.round(weight * 0.45), label: '' };
  }

  if (value >= min && value <= max) {
    return { score: weight, label: '' };
  }

  const safeMax = max > 0 ? max : min || value;
  const overflow = value < min ? (min - value) / Math.max(min, 1) : (value - safeMax) / Math.max(safeMax, 1);
  const score = weight * Math.max(0, 1 - overflow * 1.35);
  return { score: Math.round(score), label: '' };
}

function scoreTarget(value: number, target: number, weight: number) {
  if (!target || !value) {
    return Math.round(weight * 0.45);
  }

  if (value === target) {
    return weight;
  }

  const distance = Math.abs(value - target);
  if (distance === 1) {
    return Math.round(weight * 0.72);
  }

  return Math.round(Math.max(0, weight * (1 - distance / Math.max(target + 1, 4))));
}

function propertyText(property: Property) {
  return joinDefined([
    property.title,
    property.description,
    property.location,
    property.address,
    property.city,
    property.zone,
    property.propertyType,
    property.interiorState,
    property.furnishing,
    property.heatingSystem,
    property.parking,
    property.keyFeatures,
    property.amenities?.join(' '),
  ]);
}

function contactText(contact: Contact) {
  return joinDefined([
    contact.city,
    contact.zones?.join(' '),
    contact.description,
    contact.preferences?.desiredFeatures,
    contact.preferences?.locationPreferences,
    contact.generalZone || undefined,
  ]);
}

function scoreTokenOverlap(source: string, target: string, weight: number) {
  const sourceTokens = unique(tokenize(source));
  const targetTokens = unique(tokenize(target));

  if (sourceTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

  const overlaps = sourceTokens.filter((token) => targetTokens.includes(token));
  const ratio = overlaps.length / Math.max(1, Math.min(sourceTokens.length, targetTokens.length));
  return Math.round(weight * ratio);
}

function locationScore(property: Property, preferences: ContactPreferences, contact?: Contact) {
  let score = 0;
  const positives: string[] = [];

  const desiredLocation = preferences.locationPreferences || contact?.city || '';
  const propertyLocationBlob = joinDefined([property.location, property.address, property.city, property.zone]);
  const locationTokensScore = scoreTokenOverlap(desiredLocation, propertyLocationBlob, 16);
  if (locationTokensScore > 0) {
    score += locationTokensScore;
    positives.push('zona este apropiata de cautarea clientului');
  }

  const normalizedPropertyCity = normalize(property.city || property.location.split(',')[0]);
  const normalizedContactCity = normalize(contact?.city || preferences.locationPreferences);
  if (normalizedPropertyCity && normalizedContactCity && normalizedPropertyCity.includes(normalizedContactCity)) {
    score += 8;
    positives.push('orasul se potriveste');
  }

  const zoneTokens = (contact?.zones || []).map(normalize).filter(Boolean);
  const propertyZoneBlob = normalize(joinDefined([property.zone, property.location, property.address]));
  if (zoneTokens.length > 0 && zoneTokens.some((zone) => propertyZoneBlob.includes(zone))) {
    score += 10;
    positives.push('zona preferata este acoperita');
  }

  return { score: clamp(score, 0, 24), positives };
}

function featureScore(property: Property, preferences: ContactPreferences) {
  const score = scoreTokenOverlap(preferences.desiredFeatures, propertyText(property), 16);
  return {
    score,
    positives: score > 0 ? ['dotarile si descrierea sunt compatibile cu preferintele'] : [],
  };
}

export function scorePropertyForPreferences(property: Property, preferences: ContactPreferences, contact?: Contact) {
  const positives: string[] = [];
  let caution: string | undefined;

  const price = scoreRange(property.price || 0, preferences.desiredPriceRangeMin || 0, preferences.desiredPriceRangeMax || 0, 28).score;
  if (price >= 22) {
    positives.push('pretul este in intervalul dorit');
  } else if (property.price && preferences.desiredPriceRangeMax && property.price > preferences.desiredPriceRangeMax) {
    caution = 'pretul este peste plafonul dorit';
  }

  const rooms = scoreTarget(property.rooms || 0, preferences.desiredRooms || 0, 16);
  if (rooms >= 12 && (preferences.desiredRooms || 0) > 0) {
    positives.push('numarul de camere este potrivit');
  }

  const bathrooms = scoreTarget(property.bathrooms || 0, preferences.desiredBathrooms || 0, 8);
  if (bathrooms >= 6 && (preferences.desiredBathrooms || 0) > 0) {
    positives.push('numarul de bai este potrivit');
  }

  const area = scoreRange(
    property.squareFootage || 0,
    preferences.desiredSquareFootageMin || 0,
    preferences.desiredSquareFootageMax || 0,
    16
  ).score;
  if (area >= 12 && (preferences.desiredSquareFootageMin || 0) > 0) {
    positives.push('suprafata este aproape de tinta');
  }

  const location = locationScore(property, preferences, contact);
  positives.push(...location.positives);

  const features = featureScore(property, preferences);
  positives.push(...features.positives);

  const score = roundScore(price + rooms + bathrooms + area + location.score + features.score + 8);
  return {
    score,
    reasoning: formatReasoning(positives, caution),
  };
}

export function getDeterministicMatchedProperties(
  contact: Contact,
  properties: Property[],
  limit = 12
): MatchedProperty[] {
  const preferences = derivePreferencesFromContact(contact);

  return properties
    .filter((property) => property.status !== 'Vândut' && property.status !== 'Închiriat' && property.status !== 'Rezervat')
    .map((property) => {
      const scored = scorePropertyForPreferences(property, preferences, contact);
      return {
        ...property,
        matchScore: scored.score,
        reasoning: scored.reasoning || 'Compatibilitate buna pe criteriile esentiale.',
      };
    })
    .filter((property) => property.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

export function scoreBuyerForProperty(contact: Contact, property: Property) {
  const preferences = derivePreferencesFromContact(contact);
  return scorePropertyForPreferences(property, preferences, contact);
}

export function getDeterministicMatchedBuyers(
  property: Property,
  contacts: Contact[],
  limit = 12
): MatchedBuyer[] {
  return contacts
    .filter((contact) => contact.contactType === 'Cumparator')
    .filter((contact) => contact.status !== 'Câștigat' && contact.status !== 'Pierdut')
    .map((contact) => {
      const scored = scoreBuyerForProperty(contact, property);
      return {
        ...contact,
        matchScore: scored.score,
        reasoning: scored.reasoning || 'Compatibilitate buna pe criteriile esentiale.',
      };
    })
    .filter((contact) => contact.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
