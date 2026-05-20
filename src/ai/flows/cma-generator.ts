'use server';
/**
 * Deprecated compatibility wrapper for the old CMA flow.
 *
 * The production price analysis now lives in src/lib/pricing-analysis.ts and is
 * evidence-led. This wrapper stays deterministic so legacy callers do not get
 * unsupported LLM market commentary.
 */

import type { Property } from '@/lib/types';

type CmaInput = {
  subjectProperty: Property;
  allProperties: Property[];
  agencyId: string;
};

type ComparableProperty = {
  id: string;
  address: string;
  status: 'Activ' | 'Vândut' | 'Închiriat' | 'Inactiv';
  price: number;
  squareFootage: number;
  rooms: number;
  bathrooms: number;
  similarity: string;
};

type PriceAdjustment = {
  feature: string;
  adjustment: string;
  reason: string;
};

type CmaOutput = {
  subjectPropertyId: string;
  subjectPropertyAddress: string;
  comparableProperties: ComparableProperty[];
  priceAdjustments: PriceAdjustment[];
  estimatedValueRange: {
    min: number;
    max: number;
  };
  notes: string;
};

function normalizeText(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizePropertyType(value?: string | null) {
  const normalized = normalizeText(value);
  if (normalized.includes('apart')) return 'apartment';
  if (normalized.includes('garson')) return 'studio';
  if (normalized.includes('casa') || normalized.includes('vila')) return 'house';
  if (normalized.includes('teren')) return 'land';
  return normalized || 'other';
}

function isSale(value?: string | null) {
  const normalized = normalizeText(value);
  return normalized.includes('vanz') || normalized.includes('sell');
}

function round(value: number, precision = 0) {
  const power = 10 ** precision;
  return Math.round(value * power) / power;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function scoreComparable(subject: Property, candidate: Property) {
  if (candidate.id === subject.id) return 0;
  if (!candidate.price || !candidate.squareFootage) return 0;
  if (!isSale(candidate.transactionType) || !isSale(subject.transactionType)) return 0;
  if (normalizePropertyType(candidate.propertyType) !== normalizePropertyType(subject.propertyType)) return 0;

  let score = 0;
  const subjectZone = normalizeText(subject.zone || subject.location || subject.address);
  const candidateZone = normalizeText(candidate.zone || candidate.location || candidate.address);
  if (subjectZone && candidateZone.includes(subjectZone)) score += 40;
  else if (subject.city && normalizeText(candidate.city || candidate.location).includes(normalizeText(subject.city))) score += 22;

  score += Math.max(0, 24 - Math.abs((candidate.rooms || 0) - subject.rooms) * 10);
  score += Math.max(0, 24 - (Math.abs(candidate.squareFootage - subject.squareFootage) / Math.max(subject.squareFootage, 1)) * 80);
  if (candidate.status === 'Vândut') score += 12;
  return Math.min(100, round(score, 1));
}

export async function generateCMA(input: CmaInput): Promise<CmaOutput> {
  const { subjectProperty, allProperties } = input;
  const ranked = allProperties
    .map((property) => ({ property, score: scoreComparable(subjectProperty, property) }))
    .filter((entry) => entry.score >= 52)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const pricePerSqmValues = ranked.map(({ property }) => property.price / property.squareFootage).filter(Number.isFinite);
  const benchmarkPerSqm = median(pricePerSqmValues) || subjectProperty.price / Math.max(subjectProperty.squareFootage, 1);
  const estimated = benchmarkPerSqm * subjectProperty.squareFootage;
  const spread = ranked.length >= 3 ? 0.07 : 0.11;

  const comparableProperties: ComparableProperty[] = ranked.map(({ property, score }) => ({
    id: property.id,
    address: property.address,
    status: (property.status || 'Activ') as ComparableProperty['status'],
    price: property.price,
    squareFootage: property.squareFootage,
    rooms: property.rooms,
    bathrooms: property.bathrooms,
    similarity: `${score}/100 similaritate pe zona, camere, suprafata si status.`,
  }));

  const priceAdjustments: PriceAdjustment[] = [];
  if (subjectProperty.constructionYear && ranked.some(({ property }) => property.constructionYear)) {
    const averageYear =
      ranked.reduce((sum, { property }) => sum + (property.constructionYear || subjectProperty.constructionYear || 0), 0) /
      Math.max(ranked.length, 1);
    const gap = subjectProperty.constructionYear - averageYear;
    if (gap >= 10) {
      priceAdjustments.push({
        feature: 'An constructie superior',
        adjustment: '+2%',
        reason: 'Proprietatea este mai noua decat media comparabilelor selectate.',
      });
    } else if (gap <= -10) {
      priceAdjustments.push({
        feature: 'An constructie inferior',
        adjustment: '-2%',
        reason: 'Proprietatea este mai veche decat media comparabilelor selectate.',
      });
    }
  }

  return {
    subjectPropertyId: subjectProperty.id,
    subjectPropertyAddress: subjectProperty.address,
    comparableProperties,
    priceAdjustments,
    estimatedValueRange: {
      min: round(estimated * (1 - spread), 0),
      max: round(estimated * (1 + spread), 0),
    },
    notes:
      ranked.length > 0
        ? 'CMA legacy calculat determinist din portofoliul disponibil. Pentru analiza lider de piata foloseste pagina dedicata de analiza pret, care include audit pe surse, backtesting si comparabile externe.'
        : 'Nu exista suficiente comparabile in portofoliu pentru CMA legacy. Foloseste analiza dedicata de pret pentru surse extinse.',
  };
}
