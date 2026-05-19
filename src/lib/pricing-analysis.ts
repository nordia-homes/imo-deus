import { adminDb } from '@/firebase/admin';
import type { Property, PropertyDeletionEvent, PropertyStatusEvent } from '@/lib/types';
import { buildPropertyZoneFact } from '@/lib/zones/matching';
import { getAdjacentZones, getClusterPeers, normalizeRomanianText } from '@/lib/zones/ontology';

type ComparableSource = 'platform_sold' | 'agency_active' | 'portal_active';

export type PricingComparable = {
  id: string;
  source: ComparableSource;
  title: string;
  address: string;
  locationLabel: string;
  price: number;
  pricePerSqm: number;
  squareFootage: number;
  rooms: number | null;
  bathrooms: number | null;
  constructionYear: number | null;
  similarityScore: number;
  similarityReasons: string[];
  statusLabel: string;
  agencyId?: string | null;
  url?: string | null;
  recordedAt?: string | null;
};

export type PricingAdjustment = {
  label: string;
  direction: 'positive' | 'negative' | 'neutral';
  impactPerSqm: number;
  impactTotal: number;
  reason: string;
};

export type PricingDataQuality = {
  score: number;
  level: 'high' | 'medium' | 'low';
  missingFields: string[];
  strengths: string[];
  warnings: string[];
};

export type PricingMarketEvidence = {
  tier: 'transaction_led' | 'hybrid' | 'listing_led' | 'weak';
  soldComparableCount: number;
  activeComparableCount: number;
  portalComparableCount: number;
  averageSoldComparableAgeDays: number | null;
  directMicrozoneSoldCount: number;
  evidenceScore: number;
  sourceMix: {
    soldWeight: number;
    activeWeight: number;
    portalWeight: number;
  };
  verdict: string;
};

export type PricingStrategy = {
  fastSalePrice: number;
  fastSalePricePerSqm: number;
  recommendedPrice: number;
  recommendedPricePerSqm: number;
  stretchPrice: number;
  stretchPricePerSqm: number;
  overpricedThreshold: number;
  overpricedThresholdPerSqm: number;
  expectedSaleWindowDays: {
    fast: string;
    recommended: string;
    stretch: string;
  };
  negotiationRoomPercent: number;
  ownerConversation: string[];
};

export type PricingBacktestSummary = {
  available: boolean;
  sampleSize: number;
  meanAbsoluteErrorPercent: number | null;
  medianAbsoluteErrorPercent: number | null;
  biasPercent: number | null;
  verdict: string;
  latestBacktest?: {
    soldPrice: number;
    predictedPrice: number;
    errorPercent: number;
    soldAt: string | null;
    analysisGeneratedAt: string;
  } | null;
};

export type PricingAnalysisResult = {
  generatedAt: string;
  subject: {
    id: string;
    title: string;
    address: string;
    city: string | null;
    zone: string | null;
    squareFootage: number;
    rooms: number;
    bathrooms: number;
    price: number;
  };
  recommendedListingPrice: number;
  recommendedListingPricePerSqm: number;
  conservativeMinPrice: number;
  stretchMaxPrice: number;
  confidenceScore: number;
  summary: string;
  soldBenchmarkPricePerSqm: number | null;
  activeBenchmarkPricePerSqm: number | null;
  portalBenchmarkPricePerSqm: number | null;
  soldComparables: PricingComparable[];
  activeComparables: PricingComparable[];
  portalComparables: PricingComparable[];
  adjustments: PricingAdjustment[];
  marketSignals: {
    soldCount: number;
    activeCount: number;
    portalCount: number;
    marketHeat: 'hot' | 'balanced' | 'soft';
    portalIndexPricePerSqm: number | null;
  };
  limitations: string[];
  dataQuality: PricingDataQuality;
  marketEvidence: PricingMarketEvidence;
  pricingStrategy: PricingStrategy;
  backtest: PricingBacktestSummary;
};

type InternalComparableCandidate = Property & {
  agencyId?: string | null;
};

type ArchivedDeletionComparable = PropertyDeletionEvent & {
  propertySnapshot: Property;
};

type ArchivedStatusComparable = PropertyStatusEvent & {
  propertySnapshot: Property;
};

type ArchivedSoldComparable = ArchivedDeletionComparable | ArchivedStatusComparable;

type PortalComparableCandidate = {
  id: string;
  portalName: string;
  title: string;
  address: string;
  locationLabel: string;
  price: number;
  squareFootage: number;
  rooms: number | null;
  bathrooms?: number | null;
  constructionYear?: number | null;
  floor?: string | null;
  totalFloors?: number | null;
  partitioning?: string | null;
  interiorState?: string | null;
  url?: string | null;
};

type PropertyFeatures = {
  propertyType: string;
  zoneTokens: string[];
  rawZoneText: string;
  zoneId: string | null;
  zoneName: string | null;
  adjacentZoneIds: Set<string>;
  clusterZoneIds: Set<string>;
  isIntermediateFloor: boolean | null;
  partitioning: string;
  interiorState: string;
  isRehabilitated: boolean;
  sourceText: string;
};

const IMOBILIARE_BASE_URL = (process.env.IMOBILIARE_API_BASE_URL || 'https://www.imobiliare.ro').replace(/\/+$/, '');
const OLX_BASE_URL = 'https://www.olx.ro';
const IMOBILIARE_NET_BASE_URL = 'https://www.imobiliare.net';

function normalizeText(value?: string | null) {
  return normalizeRomanianText(value || '');
}

function slugify(value?: string | null) {
  return normalizeText(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
}

function round(value: number, precision = 0) {
  const power = 10 ** precision;
  return Math.round(value * power) / power;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toPricePerSqm(price: number, surface: number) {
  if (!price || !surface) return 0;
  return price / surface;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function normalizePropertyType(value?: string | null) {
  const normalized = normalizeText(value);
  if (normalized.includes('apart')) return 'apartment';
  if (normalized.includes('garson')) return 'studio';
  if (normalized.includes('casa') || normalized.includes('vila')) return 'house';
  if (normalized.includes('teren')) return 'land';
  return normalized || 'other';
}

function isSaleTransaction(value?: string | null) {
  const normalized = normalizeText(value);
  return normalized.includes('vanz') || normalized.includes('sell');
}

function isSoldStatus(value?: string | null) {
  const normalized = normalizeText(value);
  return normalized.includes('vandut') || normalized.includes('sold');
}

function isActiveStatus(value?: string | null) {
  const normalized = normalizeText(value);
  return normalized.includes('activ') || normalized.includes('active');
}

function parseFloorInfo(floor?: string | null, totalFloors?: number | null) {
  const normalized = normalizeText(floor);
  const numericMatch = String(floor || '').match(/-?\d+/);
  const numericFloor = numericMatch ? Number(numericMatch[0]) : null;

  if (!normalized && typeof totalFloors !== 'number') {
    return { numericFloor: null, isIntermediateFloor: null };
  }

  if (normalized.includes('parter') || normalized.includes('demisol') || normalized.includes('subsol')) {
    return { numericFloor: numericFloor ?? 0, isIntermediateFloor: false };
  }

  if (normalized.includes('mansarda')) {
    return { numericFloor, isIntermediateFloor: false };
  }

  if (numericFloor === null || !Number.isFinite(numericFloor) || typeof totalFloors !== 'number' || totalFloors <= 1) {
    return { numericFloor, isIntermediateFloor: null };
  }

  return {
    numericFloor,
    isIntermediateFloor: numericFloor > 0 && numericFloor < totalFloors,
  };
}

function normalizePartitioning(value?: string | null, sourceText?: string | null) {
  const normalized = normalizeText([value, sourceText].filter(Boolean).join(' '));
  if (normalized.includes('decomandat')) return 'decomandat';
  if (normalized.includes('semidecomandat') || normalized.includes('semi decomandat')) return 'semidecomandat';
  if (normalized.includes('nedecomandat')) return 'nedecomandat';
  return 'unknown';
}

function normalizeInteriorState(value?: string | null, sourceText?: string | null) {
  const normalized = normalizeText([value, sourceText].filter(Boolean).join(' '));
  if (
    normalized.includes('lux') ||
    normalized.includes('premium') ||
    normalized.includes('renovat complet') ||
    normalized.includes('finisat') ||
    normalized.includes('modern')
  ) {
    return 'renovat';
  }
  if (normalized.includes('renovat')) return 'renovat';
  if (normalized.includes('nou') || normalized.includes('finalizata') || normalized.includes('finalizat')) return 'bun';
  if (normalized.includes('buna') || normalized.includes('intretinut')) return 'bun';
  if (normalized.includes('necesita renovare') || normalized.includes('de renovat')) return 'de_renovat';
  return 'unknown';
}

function isRehabilitatedProperty(sourceText: string, property: Pick<Property, 'buildingState' | 'amenities'>) {
  const normalized = normalizeText(
    [sourceText, property.buildingState, ...(property.amenities || [])].filter(Boolean).join(' ')
  );
  return normalized.includes('reabilitat') || normalized.includes('anvelopat');
}

function buildZoneKeywords(property: Property, zoneName: string | null) {
  const sourceText = [
    property.zone,
    property.city,
    property.location,
    property.address,
    property.title,
    property.description,
  ]
    .filter(Boolean)
    .join(' ');

  const normalized = normalizeText(sourceText);
  const candidates = new Set<string>();
  const phrases = [
    'petre ispirescu',
    'malcoci',
    'sebastian',
    'rahova',
    '13 septembrie',
    'margeanului',
    'antiaeriana',
  ];

  for (const phrase of phrases) {
    if (normalized.includes(phrase)) {
      candidates.add(phrase);
    }
  }

  if (zoneName) {
    candidates.add(normalizeText(zoneName));
  }

  if (!candidates.size && property.zone) {
    candidates.add(normalizeText(property.zone));
  }

  return Array.from(candidates).filter(Boolean);
}

function extractPropertyFeatures(property: Property) {
  const sourceText = [
    property.title,
    property.address,
    property.zone,
    property.city,
    property.location,
    property.description,
    property.interiorState,
    property.partitioning,
    property.floor,
    property.notes,
    ...(property.amenities || []),
  ]
    .filter(Boolean)
    .join(' ');

  const zoneFact = buildPropertyZoneFact({
    propertyId: property.id,
    rawZoneText: property.zone || property.location || property.address || property.title,
    locality: property.city || property.location || null,
    sector: property.address?.match(/sector\s+(\d)/i)?.[1] ? Number(property.address.match(/sector\s+(\d)/i)?.[1]) : null,
    address: property.address,
    title: property.title,
    description: property.description,
  });

  const adjacentZoneIds = new Set(
    zoneFact.zoneId ? getAdjacentZones(zoneFact.zoneId).map((zone) => zone.zone_id) : []
  );
  const clusterZoneIds = new Set(
    zoneFact.zoneId ? getClusterPeers(zoneFact.zoneId).map((zone) => zone.zone_id) : []
  );

  return {
    propertyType: normalizePropertyType(property.propertyType),
    zoneTokens: buildZoneKeywords(property, zoneFact.zoneName),
    rawZoneText: zoneFact.rawZoneText,
    zoneId: zoneFact.zoneId,
    zoneName: zoneFact.zoneName,
    adjacentZoneIds,
    clusterZoneIds,
    isIntermediateFloor: parseFloorInfo(property.floor, property.totalFloors ?? null).isIntermediateFloor,
    partitioning: normalizePartitioning(property.partitioning, sourceText),
    interiorState: normalizeInteriorState(property.interiorState, sourceText),
    isRehabilitated: isRehabilitatedProperty(sourceText, property),
    sourceText,
  } satisfies PropertyFeatures;
}

function getLocationLabel(property: Pick<Property, 'zone' | 'city' | 'location' | 'address'>) {
  return property.zone || property.city || property.location || property.address || 'Locatie necunoscuta';
}

function computeZoneScore(subjectFeatures: PropertyFeatures, candidateFeatures: PropertyFeatures, candidateText: string) {
  if (subjectFeatures.zoneId && candidateFeatures.zoneId) {
    if (subjectFeatures.zoneId === candidateFeatures.zoneId) return 1;
    if (subjectFeatures.adjacentZoneIds.has(candidateFeatures.zoneId)) return 0.86;
    if (subjectFeatures.clusterZoneIds.has(candidateFeatures.zoneId)) return 0.75;
  }

  const normalizedCandidateText = normalizeText(candidateText);
  for (const token of subjectFeatures.zoneTokens) {
    if (token && normalizedCandidateText.includes(token)) {
      return token === normalizeText(subjectFeatures.zoneName) ? 0.92 : 0.82;
    }
  }

  return 0.35;
}

function buildSimilarityReasons(subject: Property, subjectFeatures: PropertyFeatures, candidate: {
  zoneLabel?: string | null;
  squareFootage: number;
  rooms?: number | null;
  constructionYear?: number | null;
  partitioning?: string | null;
  interiorState?: string | null;
  isIntermediateFloor?: boolean | null;
}, zoneScore: number) {
  const reasons: string[] = [];

  if (zoneScore >= 0.95) reasons.push('aceeasi microzona');
  else if (zoneScore >= 0.84) reasons.push('zona adiacenta relevanta');
  else if (zoneScore >= 0.74) reasons.push('acelasi cluster comercial');

  const surfaceGap = Math.abs(candidate.squareFootage - subject.squareFootage);
  if (surfaceGap <= Math.max(10, subject.squareFootage * 0.12)) reasons.push('suprafata apropiata');
  if (typeof candidate.rooms === 'number' && candidate.rooms === subject.rooms) reasons.push('acelasi numar de camere');

  if (
    typeof candidate.constructionYear === 'number' &&
    typeof subject.constructionYear === 'number' &&
    Math.abs(candidate.constructionYear - subject.constructionYear) <= 8
  ) {
    reasons.push('vechime similara');
  }

  if (candidate.interiorState && candidate.interiorState !== 'unknown') {
    const subjectState = normalizeInteriorState(subject.interiorState, subject.description);
    if (candidate.interiorState === subjectState) reasons.push('stare interioara similara');
  }

  if (candidate.partitioning && candidate.partitioning !== 'unknown') {
    const subjectPartitioning = normalizePartitioning(subject.partitioning, subject.description);
    if (candidate.partitioning === subjectPartitioning) reasons.push('compartimentare similara');
  }

  if (candidate.isIntermediateFloor !== null && parseFloorInfo(subject.floor, subject.totalFloors ?? null).isIntermediateFloor === candidate.isIntermediateFloor) {
    reasons.push(candidate.isIntermediateFloor ? 'etaj intermediar similar' : 'pozitionare similara pe verticala');
  }

  return reasons.length ? reasons : ['comparabil util pentru calibrare'];
}

function computeSimilarityScore(subject: Property, subjectFeatures: PropertyFeatures, candidate: {
  propertyType?: string | null;
  squareFootage: number;
  rooms?: number | null;
  bathrooms?: number | null;
  constructionYear?: number | null;
  partitioning?: string | null;
  interiorState?: string | null;
  isIntermediateFloor?: boolean | null;
  sourceText?: string | null;
  zoneFeatures?: PropertyFeatures | null;
}) {
  const candidateType = normalizePropertyType(candidate.propertyType);
  if (subjectFeatures.propertyType !== candidateType) {
    return 0;
  }

  const zoneScore = computeZoneScore(
    subjectFeatures,
    candidate.zoneFeatures || {
      ...subjectFeatures,
      zoneId: null,
      zoneName: null,
      adjacentZoneIds: new Set<string>(),
      clusterZoneIds: new Set<string>(),
      zoneTokens: [],
      rawZoneText: '',
      sourceText: candidate.sourceText || '',
      partitioning: candidate.partitioning || 'unknown',
      interiorState: candidate.interiorState || 'unknown',
      isIntermediateFloor: candidate.isIntermediateFloor ?? null,
      isRehabilitated: false,
    },
    candidate.sourceText || ''
  );

  if (zoneScore < 0.5) {
    return 0;
  }

  let score = zoneScore * 36;
  const roomGap = typeof candidate.rooms === 'number' ? Math.abs(candidate.rooms - subject.rooms) : 1;
  const surfaceDiffRatio = Math.abs(candidate.squareFootage - subject.squareFootage) / Math.max(subject.squareFootage, 1);
  const bathroomGap = typeof candidate.bathrooms === 'number' ? Math.abs(candidate.bathrooms - subject.bathrooms) : 1;

  score += Math.max(0, 18 - roomGap * 8);
  score += Math.max(0, 18 - surfaceDiffRatio * 60);
  score += Math.max(0, 8 - bathroomGap * 4);

  if (typeof candidate.constructionYear === 'number' && typeof subject.constructionYear === 'number') {
    score += Math.max(0, 8 - Math.abs(candidate.constructionYear - subject.constructionYear) / 3);
  } else {
    score += 3;
  }

  const subjectState = subjectFeatures.interiorState;
  if (candidate.interiorState && candidate.interiorState !== 'unknown' && subjectState !== 'unknown') {
    score += candidate.interiorState === subjectState ? 8 : candidate.interiorState === 'renovat' || subjectState === 'renovat' ? 3 : 5;
  } else {
    score += 4;
  }

  if (candidate.partitioning && candidate.partitioning !== 'unknown' && subjectFeatures.partitioning !== 'unknown') {
    score += candidate.partitioning === subjectFeatures.partitioning ? 5 : 1;
  } else {
    score += 2;
  }

  if (candidate.isIntermediateFloor !== null && subjectFeatures.isIntermediateFloor !== null) {
    score += candidate.isIntermediateFloor === subjectFeatures.isIntermediateFloor ? 5 : 1;
  } else {
    score += 2;
  }

  return clamp(round(score, 1), 0, 100);
}

function createPricingComparable(
  source: ComparableSource,
  subject: Property,
  subjectFeatures: PropertyFeatures,
  candidate: InternalComparableCandidate | PortalComparableCandidate,
  statusLabel: string
) {
  const locationLabel = 'locationLabel' in candidate ? candidate.locationLabel : getLocationLabel(candidate);
  const candidateText = [
    'title' in candidate ? candidate.title : '',
    'address' in candidate ? candidate.address : '',
    locationLabel,
    'partitioning' in candidate ? candidate.partitioning : '',
    'interiorState' in candidate ? candidate.interiorState : '',
  ]
    .filter(Boolean)
    .join(' ');

  const candidateFeatures =
    'propertyType' in candidate
      ? extractPropertyFeatures(candidate)
      : {
          propertyType: subjectFeatures.propertyType,
          zoneTokens: [],
          rawZoneText: locationLabel,
          zoneId: null,
          zoneName: null,
          adjacentZoneIds: new Set<string>(),
          clusterZoneIds: new Set<string>(),
          isIntermediateFloor: candidate.floor ? parseFloorInfo(candidate.floor, candidate.totalFloors ?? null).isIntermediateFloor : null,
          partitioning: normalizePartitioning(candidate.partitioning, candidateText),
          interiorState: normalizeInteriorState(candidate.interiorState, candidateText),
          isRehabilitated: normalizeText(candidateText).includes('reabilitat') || normalizeText(candidateText).includes('anvelopat'),
          sourceText: candidateText,
        } satisfies PropertyFeatures;

  const similarityScore = computeSimilarityScore(subject, subjectFeatures, {
    propertyType: 'propertyType' in candidate ? candidate.propertyType : subject.propertyType,
    squareFootage: candidate.squareFootage,
    rooms: candidate.rooms ?? null,
    bathrooms: 'bathrooms' in candidate ? candidate.bathrooms ?? null : null,
    constructionYear: 'constructionYear' in candidate ? candidate.constructionYear ?? null : null,
    partitioning: 'partitioning' in candidate ? candidate.partitioning ?? null : null,
    interiorState: 'interiorState' in candidate ? candidate.interiorState ?? null : null,
    isIntermediateFloor: candidateFeatures.isIntermediateFloor,
    sourceText: candidateText,
    zoneFeatures: candidateFeatures,
  });

  const zoneScore = computeZoneScore(subjectFeatures, candidateFeatures, candidateText);

  return {
    id: candidate.id,
    source,
    title: candidate.title,
    address: candidate.address,
    locationLabel,
    price: candidate.price,
    pricePerSqm: round(toPricePerSqm(candidate.price, candidate.squareFootage), 0),
    squareFootage: candidate.squareFootage,
    rooms: candidate.rooms ?? null,
    bathrooms: 'bathrooms' in candidate ? candidate.bathrooms ?? null : null,
    constructionYear: 'constructionYear' in candidate ? candidate.constructionYear ?? null : null,
    similarityScore,
    similarityReasons: buildSimilarityReasons(
      subject,
      subjectFeatures,
      {
        zoneLabel: locationLabel,
        squareFootage: candidate.squareFootage,
        rooms: candidate.rooms ?? null,
        constructionYear: 'constructionYear' in candidate ? candidate.constructionYear ?? null : null,
        partitioning: 'partitioning' in candidate ? candidate.partitioning ?? null : null,
        interiorState: 'interiorState' in candidate ? candidate.interiorState ?? null : null,
        isIntermediateFloor: candidateFeatures.isIntermediateFloor,
      },
      zoneScore
    ),
    statusLabel,
    agencyId: 'agencyId' in candidate ? candidate.agencyId ?? null : null,
    url: 'url' in candidate ? candidate.url ?? null : null,
    recordedAt: 'statusUpdatedAt' in candidate ? candidate.statusUpdatedAt ?? null : null,
  };
}

function isInternalComparable(subject: Property, subjectFeatures: PropertyFeatures, candidate: InternalComparableCandidate) {
  if (!candidate.squareFootage || !candidate.price) return false;
  if (!isSaleTransaction(candidate.transactionType)) return false;
  if (normalizePropertyType(candidate.propertyType) !== subjectFeatures.propertyType) return false;

  const candidateComparable = createPricingComparable(
    isSoldStatus(candidate.status) ? 'platform_sold' : 'agency_active',
    subject,
    subjectFeatures,
    candidate,
    isSoldStatus(candidate.status) ? 'Vandut' : 'Activ'
  );

  if (candidateComparable.similarityScore < 60) return false;
  return true;
}

function filterBenchmarkOutliers(comparables: PricingComparable[]) {
  if (comparables.length < 5) return comparables;

  const benchmarkMedian = median(comparables.map((item) => item.pricePerSqm));
  if (!benchmarkMedian) return comparables;

  const absoluteDeviations = comparables.map((item) => Math.abs(item.pricePerSqm - benchmarkMedian));
  const medianAbsoluteDeviation = median(absoluteDeviations) || 0;
  const tolerance = Math.max(benchmarkMedian * 0.18, medianAbsoluteDeviation * 2.75, 120);

  return comparables.filter((item) => Math.abs(item.pricePerSqm - benchmarkMedian) <= tolerance);
}

function computeRecencyWeight(recordedAt?: string | null) {
  if (!recordedAt) return 0.82;
  const timestamp = Date.parse(recordedAt);
  if (!Number.isFinite(timestamp)) return 0.82;

  const ageDays = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (ageDays <= 90) return 1;
  if (ageDays <= 180) return 0.94;
  if (ageDays <= 365) return 0.86;
  if (ageDays <= 730) return 0.72;
  return 0.58;
}

function computeSourceWeight(source: ComparableSource) {
  if (source === 'platform_sold') return 1;
  if (source === 'agency_active') return 0.78;
  return 0.62;
}

function computeComparableWeight(comparable: PricingComparable) {
  const similarityWeight = (comparable.similarityScore / 100) ** 1.75;
  return clamp(similarityWeight * computeSourceWeight(comparable.source) * computeRecencyWeight(comparable.recordedAt), 0.18, 1.2);
}

function weightedMedian(items: Array<{ value: number; weight: number }>) {
  if (!items.length) return null;
  const sorted = [...items].sort((left, right) => left.value - right.value);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  let runningWeight = 0;

  for (const item of sorted) {
    runningWeight += item.weight;
    if (runningWeight >= totalWeight / 2) {
      return item.value;
    }
  }

  return sorted[sorted.length - 1]?.value ?? null;
}

function computeWeightedBenchmark(comparables: PricingComparable[], askDiscount = 1) {
  if (!comparables.length) return null;
  const cleanComparables = filterBenchmarkOutliers(comparables);
  const weightedValues = cleanComparables.map((comparable) => ({
    value: comparable.pricePerSqm * askDiscount,
    weight: computeComparableWeight(comparable),
  }));

  return round(weightedMedian(weightedValues) || 0, 0);
}

function ageInDays(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildDataQuality(subject: Property, subjectFeatures: PropertyFeatures): PricingDataQuality {
  const checks: Array<{ ok: boolean; field: string; strength: string; warning: string; weight: number }> = [
    {
      ok: Boolean(subject.price && subject.price > 0),
      field: 'pret',
      strength: 'Pret de listare disponibil.',
      warning: 'Lipseste pretul de listare.',
      weight: 14,
    },
    {
      ok: Boolean(subject.squareFootage && subject.squareFootage > 0),
      field: 'suprafata utila',
      strength: 'Suprafata utila este disponibila.',
      warning: 'Lipseste suprafata utila.',
      weight: 14,
    },
    {
      ok: Boolean(subject.rooms && subject.rooms > 0),
      field: 'camere',
      strength: 'Numarul de camere este disponibil.',
      warning: 'Lipseste numarul de camere.',
      weight: 10,
    },
    {
      ok: Boolean(subject.zone || subject.location || subject.address),
      field: 'zona/adresa',
      strength: 'Localizarea poate fi folosita pentru matching.',
      warning: 'Zona sau adresa sunt insuficiente.',
      weight: 12,
    },
    {
      ok: Boolean(subjectFeatures.zoneId || subjectFeatures.zoneTokens.length),
      field: 'microzona',
      strength: 'Microzona a fost identificata pentru comparabile.',
      warning: 'Microzona nu a fost identificata clar.',
      weight: 12,
    },
    {
      ok: typeof subject.constructionYear === 'number',
      field: 'an constructie',
      strength: 'Anul constructiei este disponibil.',
      warning: 'Lipseste anul constructiei.',
      weight: 8,
    },
    {
      ok: Boolean(subject.floor),
      field: 'etaj',
      strength: 'Etajul este disponibil.',
      warning: 'Lipseste etajul.',
      weight: 8,
    },
    {
      ok: subjectFeatures.interiorState !== 'unknown',
      field: 'stare interioara',
      strength: 'Starea interioara poate fi folosita in ajustari.',
      warning: 'Starea interioara este neclara.',
      weight: 8,
    },
    {
      ok: subjectFeatures.partitioning !== 'unknown',
      field: 'compartimentare',
      strength: 'Compartimentarea este disponibila.',
      warning: 'Compartimentarea este neclara.',
      weight: 6,
    },
    {
      ok: Boolean(subject.description && subject.description.length >= 80),
      field: 'descriere',
      strength: 'Descrierea ofera context comercial.',
      warning: 'Descrierea este prea scurta pentru extragerea completa a semnalelor.',
      weight: 4,
    },
    {
      ok: Array.isArray(subject.images) && subject.images.length >= 3,
      field: 'imagini',
      strength: 'Exista suficiente imagini pentru context comercial.',
      warning: 'Setul de imagini este redus.',
      weight: 4,
    },
  ];

  const totalWeight = checks.reduce((sum, item) => sum + item.weight, 0);
  const score = round((checks.filter((item) => item.ok).reduce((sum, item) => sum + item.weight, 0) / totalWeight) * 100, 0);
  const missingFields = checks.filter((item) => !item.ok).map((item) => item.field);
  const strengths = checks.filter((item) => item.ok).map((item) => item.strength).slice(0, 5);
  const warnings = checks.filter((item) => !item.ok).map((item) => item.warning);

  return {
    score,
    level: score >= 82 ? 'high' : score >= 62 ? 'medium' : 'low',
    missingFields,
    strengths,
    warnings,
  };
}

function computeMarketEvidence(params: {
  soldComparables: PricingComparable[];
  activeComparables: PricingComparable[];
  portalComparables: PricingComparable[];
}) {
  const { soldComparables, activeComparables, portalComparables } = params;
  const soldWeight = soldComparables.reduce((sum, item) => sum + computeComparableWeight(item), 0);
  const activeWeight = activeComparables.reduce((sum, item) => sum + computeComparableWeight(item), 0);
  const portalWeight = portalComparables.reduce((sum, item) => sum + computeComparableWeight(item), 0);
  const totalWeight = Math.max(soldWeight + activeWeight + portalWeight, 0.01);
  const soldAges = soldComparables.map((item) => ageInDays(item.recordedAt)).filter((value): value is number => value !== null);
  const directMicrozoneSoldCount = soldComparables.filter((item) =>
    item.similarityReasons.some((reason) => reason.includes('aceeasi microzona'))
  ).length;

  const evidenceScore = clamp(
    round(
      Math.min(42, soldComparables.length * 14) +
        Math.min(16, directMicrozoneSoldCount * 8) +
        Math.min(16, activeComparables.length * 3) +
        Math.min(10, portalComparables.length * 2) +
        (soldAges.length ? Math.max(0, 16 - (average(soldAges) || 0) / 45) : 0),
      0
    ),
    0,
    100
  );

  const tier: PricingMarketEvidence['tier'] =
    soldComparables.length >= 3 && directMicrozoneSoldCount >= 1
      ? 'transaction_led'
      : soldComparables.length >= 1
        ? 'hybrid'
        : activeComparables.length + portalComparables.length >= 4
          ? 'listing_led'
          : 'weak';

  const verdict =
    tier === 'transaction_led'
      ? 'Analiza este condusa de tranzactii inchise similare, cu suport din oferta activa.'
      : tier === 'hybrid'
        ? 'Analiza combina tranzactii inchise limitate cu oferta activa si portaluri.'
        : tier === 'listing_led'
          ? 'Analiza este condusa de oferta activa; lipsesc tranzactii inchise suficient de similare.'
          : 'Evidenta de piata este slaba; sunt necesare mai multe comparabile sau date mai complete.';

  return {
    tier,
    soldComparableCount: soldComparables.length,
    activeComparableCount: activeComparables.length,
    portalComparableCount: portalComparables.length,
    averageSoldComparableAgeDays: soldAges.length ? round(average(soldAges) || 0, 0) : null,
    directMicrozoneSoldCount,
    evidenceScore,
    sourceMix: {
      soldWeight: round((soldWeight / totalWeight) * 100, 0),
      activeWeight: round((activeWeight / totalWeight) * 100, 0),
      portalWeight: round((portalWeight / totalWeight) * 100, 0),
    },
    verdict,
  } satisfies PricingMarketEvidence;
}

function buildPricingStrategy(params: {
  subject: Property;
  recommendedListingPrice: number;
  recommendedListingPricePerSqm: number;
  conservativeMinPrice: number;
  stretchMaxPrice: number;
  confidenceScore: number;
  marketHeat: 'hot' | 'balanced' | 'soft';
}) {
  const {
    subject,
    recommendedListingPrice,
    recommendedListingPricePerSqm,
    conservativeMinPrice,
    stretchMaxPrice,
    confidenceScore,
    marketHeat,
  } = params;

  const surface = Math.max(subject.squareFootage, 1);
  const negotiationRoomPercent = confidenceScore >= 82 ? 3.5 : confidenceScore >= 68 ? 5 : 6.5;
  const overpricedMultiplier = marketHeat === 'hot' ? 1.08 : marketHeat === 'soft' ? 1.045 : 1.06;
  const overpricedThreshold = round(recommendedListingPrice * overpricedMultiplier, 0);

  return {
    fastSalePrice: conservativeMinPrice,
    fastSalePricePerSqm: round(conservativeMinPrice / surface, 0),
    recommendedPrice: recommendedListingPrice,
    recommendedPricePerSqm: recommendedListingPricePerSqm,
    stretchPrice: stretchMaxPrice,
    stretchPricePerSqm: round(stretchMaxPrice / surface, 0),
    overpricedThreshold,
    overpricedThresholdPerSqm: round(overpricedThreshold / surface, 0),
    expectedSaleWindowDays: {
      fast: marketHeat === 'soft' ? '30-60 zile' : '21-45 zile',
      recommended: marketHeat === 'hot' ? '30-60 zile' : '45-90 zile',
      stretch: marketHeat === 'hot' ? '60-100 zile' : '90+ zile',
    },
    negotiationRoomPercent,
    ownerConversation: [
      `Pretul recomandat este ${recommendedListingPrice.toLocaleString('ro-RO')} EUR, construit din comparabile ponderate dupa similaritate, sursa si recenta.`,
      `Sub ${conservativeMinPrice.toLocaleString('ro-RO')} EUR intram in zona de vanzare rapida; peste ${overpricedThreshold.toLocaleString('ro-RO')} EUR riscul de blocaj comercial creste.`,
      `Marja normala de negociere pentru acest nivel de incredere este aproximativ ${negotiationRoomPercent}%.`,
    ],
  } satisfies PricingStrategy;
}

type PricingAnalysisSnapshot = {
  id?: string;
  propertyId: string;
  generatedAt: string;
  recommendedListingPrice: number;
  recommendedListingPricePerSqm: number;
  conservativeMinPrice: number;
  stretchMaxPrice: number;
  confidenceScore: number;
  dataQualityScore: number;
  evidenceScore: number;
  evidenceTier: PricingMarketEvidence['tier'];
  subject: PricingAnalysisResult['subject'];
};

type PricingBacktestRecord = {
  id: string;
  propertyId: string;
  eventId: string;
  soldAt: string | null;
  soldPrice: number;
  predictedPrice: number;
  analysisGeneratedAt: string;
  absoluteError: number;
  errorPercent: number;
  signedErrorPercent: number;
};

function toSnapshot(result: PricingAnalysisResult): PricingAnalysisSnapshot {
  return {
    propertyId: result.subject.id,
    generatedAt: result.generatedAt,
    recommendedListingPrice: result.recommendedListingPrice,
    recommendedListingPricePerSqm: result.recommendedListingPricePerSqm,
    conservativeMinPrice: result.conservativeMinPrice,
    stretchMaxPrice: result.stretchMaxPrice,
    confidenceScore: result.confidenceScore,
    dataQualityScore: result.dataQuality.score,
    evidenceScore: result.marketEvidence.evidenceScore,
    evidenceTier: result.marketEvidence.tier,
    subject: result.subject,
  };
}

async function persistPricingAnalysisSnapshot(agencyId: string, result: PricingAnalysisResult) {
  const snapshot = toSnapshot(result);
  const snapshotsRef = adminDb.collection('agencies').doc(agencyId).collection('pricingAnalysisSnapshots');
  await snapshotsRef.add(snapshot);
  await adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('properties')
    .doc(result.subject.id)
    .set(
      {
        pricingAnalysis: {
          latestGeneratedAt: result.generatedAt,
          recommendedListingPrice: result.recommendedListingPrice,
          recommendedListingPricePerSqm: result.recommendedListingPricePerSqm,
          confidenceScore: result.confidenceScore,
          dataQualityScore: result.dataQuality.score,
          evidenceScore: result.marketEvidence.evidenceScore,
          evidenceTier: result.marketEvidence.tier,
        },
      },
      { merge: true }
    );
}

function buildBacktestRecord(params: {
  propertyId: string;
  eventId: string;
  soldAt: string | null;
  soldPrice: number;
  snapshot: PricingAnalysisSnapshot;
}): PricingBacktestRecord {
  const { propertyId, eventId, soldAt, soldPrice, snapshot } = params;
  const absoluteError = Math.abs(snapshot.recommendedListingPrice - soldPrice);
  const signedErrorPercent = round(((snapshot.recommendedListingPrice - soldPrice) / soldPrice) * 100, 2);

  return {
    id: `${propertyId}_${eventId}`,
    propertyId,
    eventId,
    soldAt,
    soldPrice,
    predictedPrice: snapshot.recommendedListingPrice,
    analysisGeneratedAt: snapshot.generatedAt,
    absoluteError: round(absoluteError, 0),
    errorPercent: round((absoluteError / soldPrice) * 100, 2),
    signedErrorPercent,
  };
}

function pickLatestSnapshotBeforeSale(snapshots: PricingAnalysisSnapshot[], soldAt: string | null) {
  const soldTimestamp = soldAt ? Date.parse(soldAt) : Number.POSITIVE_INFINITY;

  return snapshots
    .filter((snapshot) => {
      const generatedTimestamp = Date.parse(snapshot.generatedAt);
      return Number.isFinite(generatedTimestamp) && generatedTimestamp < soldTimestamp;
    })
    .sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt))[0] || null;
}

async function loadAgencyAnalysisSnapshots(agencyId: string) {
  const snapshot = await adminDb.collection('agencies').doc(agencyId).collection('pricingAnalysisSnapshots').get();
  return snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  })) as PricingAnalysisSnapshot[];
}

async function loadAgencySoldEvents(agencyId: string) {
  const [statusEventsSnapshot, deletionEventsSnapshot] = await Promise.all([
    adminDb.collection('agencies').doc(agencyId).collection('propertyStatusEvents').get(),
    adminDb.collection('agencies').doc(agencyId).collection('propertyDeletionEvents').get(),
  ]);

  const statusEvents = statusEventsSnapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() } as ArchivedStatusComparable))
    .filter((event) => event.marketAnalysisEligible && typeof event.soldPrice === 'number' && event.soldPrice > 0)
    .map((event) => ({
      id: event.id,
      propertyId: event.propertyId,
      soldAt: event.changedAt || event.propertySnapshot?.statusUpdatedAt || null,
      soldPrice: event.soldPrice || 0,
    }));

  const deletionEvents = deletionEventsSnapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() } as ArchivedDeletionComparable))
    .filter((event) => event.marketAnalysisEligible && typeof event.soldPrice === 'number' && event.soldPrice > 0)
    .map((event) => ({
      id: event.id,
      propertyId: event.propertyId,
      soldAt: event.deletedAt || event.propertySnapshot?.statusUpdatedAt || null,
      soldPrice: event.soldPrice || 0,
    }));

  return [...statusEvents, ...deletionEvents];
}

async function reconcileAgencyBacktests(agencyId: string) {
  const [snapshots, soldEvents] = await Promise.all([
    loadAgencyAnalysisSnapshots(agencyId),
    loadAgencySoldEvents(agencyId),
  ]);
  const snapshotsByPropertyId = new Map<string, PricingAnalysisSnapshot[]>();

  for (const snapshot of snapshots) {
    const current = snapshotsByPropertyId.get(snapshot.propertyId) || [];
    current.push(snapshot);
    snapshotsByPropertyId.set(snapshot.propertyId, current);
  }

  const backtestsRef = adminDb.collection('agencies').doc(agencyId).collection('pricingAnalysisBacktests');

  await Promise.all(
    soldEvents.map(async (event) => {
      const previousSnapshot = pickLatestSnapshotBeforeSale(snapshotsByPropertyId.get(event.propertyId) || [], event.soldAt);
      if (!previousSnapshot) return;

      const record = buildBacktestRecord({
        propertyId: event.propertyId,
        eventId: event.id,
        soldAt: event.soldAt,
        soldPrice: event.soldPrice,
        snapshot: previousSnapshot,
      });

      await backtestsRef.doc(record.id).set(record, { merge: true });
    })
  );
}

async function buildBacktestSummary(agencyId: string, subject: Property): Promise<PricingBacktestSummary> {
  const snapshot = await adminDb.collection('agencies').doc(agencyId).collection('pricingAnalysisBacktests').get();
  const records = snapshot.docs.map((docSnapshot) => docSnapshot.data() as PricingBacktestRecord);
  const errorPercents = records.map((record) => record.errorPercent).filter((value) => Number.isFinite(value));
  const signedErrors = records.map((record) => record.signedErrorPercent).filter((value) => Number.isFinite(value));
  const latestSubjectBacktest =
    records
      .filter((record) => record.propertyId === subject.id)
      .sort((left, right) => Date.parse(right.soldAt || '') - Date.parse(left.soldAt || ''))[0] || null;

  if (!errorPercents.length) {
    return {
      available: false,
      sampleSize: 0,
      meanAbsoluteErrorPercent: null,
      medianAbsoluteErrorPercent: null,
      biasPercent: null,
      verdict: 'Nu exista inca suficiente proprietati vandute dupa o analiza salvata pentru backtesting.',
      latestBacktest: null,
    };
  }

  const meanAbsoluteErrorPercent = round(average(errorPercents) || 0, 2);
  const medianAbsoluteErrorPercent = round(median(errorPercents) || 0, 2);
  const biasPercent = round(average(signedErrors) || 0, 2);
  const verdict =
    medianAbsoluteErrorPercent <= 5
      ? 'Precizie foarte buna pe esantionul vandut.'
      : medianAbsoluteErrorPercent <= 9
        ? 'Precizie buna, cu spatiu de calibrare pe microzone.'
        : 'Modelul are nevoie de mai multe tranzactii si recalibrare pe ponderi.';

  return {
    available: true,
    sampleSize: errorPercents.length,
    meanAbsoluteErrorPercent,
    medianAbsoluteErrorPercent,
    biasPercent,
    verdict,
    latestBacktest: latestSubjectBacktest
      ? {
          soldPrice: latestSubjectBacktest.soldPrice,
          predictedPrice: latestSubjectBacktest.predictedPrice,
          errorPercent: latestSubjectBacktest.errorPercent,
          soldAt: latestSubjectBacktest.soldAt,
          analysisGeneratedAt: latestSubjectBacktest.analysisGeneratedAt,
        }
      : null,
  };
}

function cleanHtmlToLines(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&euro;|&#8364;/gi, '€')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseEuroValue(value: string) {
  const match = value.match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?)\s*(€|EUR)/i);
  if (!match?.[1]) return null;
  const normalized = match[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSurfaceValue(value: string) {
  const match = value.match(/(\d{1,3}(?:,\d+)?)\s*(m²|mp)/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRoomValue(value: string) {
  const match = value.match(/(\d+)\s+camere/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseYearValue(value: string) {
  const match = value.match(/\b(19|20)\d{2}\b/);
  if (!match?.[0]) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldKeepPortalCandidate(subjectFeatures: PropertyFeatures, text: string, location: string) {
  const normalized = normalizeText(`${text} ${location}`);
  return subjectFeatures.zoneTokens.some((token) => normalized.includes(token));
}

function parseOlxComparables(html: string, subject: Property, subjectFeatures: PropertyFeatures, url: string) {
  const lines = cleanHtmlToLines(html);
  const results: PortalComparableCandidate[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const price = parseEuroValue(lines[index]);
    if (!price) continue;

    const title = lines[index - 1] || lines[index - 2] || '';
    const locationLabel = lines[index + 2] || '';
    const squareFootage = parseSurfaceValue(lines[index + 4] || '') ?? parseSurfaceValue(lines[index + 5] || '');
    const rooms = parseRoomValue(title) ?? subject.rooms;

    if (!title || !locationLabel || !squareFootage) continue;
    if (!normalizeText(locationLabel).includes('bucuresti')) continue;
    if (!shouldKeepPortalCandidate(subjectFeatures, title, locationLabel)) continue;

    const key = `${normalizeText(title)}|${price}|${squareFootage}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: `olx-${results.length + 1}`,
      portalName: 'OLX/Storia',
      title,
      address: locationLabel,
      locationLabel,
      price,
      squareFootage,
      rooms,
      interiorState: normalizeInteriorState(undefined, title),
      partitioning: normalizePartitioning(undefined, title),
      url,
    });
  }

  return results;
}

function parseImobiliareNetComparables(html: string, subject: Property, subjectFeatures: PropertyFeatures, url: string) {
  const lines = cleanHtmlToLines(html);
  const results: PortalComparableCandidate[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const price = parseEuroValue(lines[index]);
    if (!price || !/EUR/i.test(lines[index])) continue;

    const title = lines.slice(index + 1, index + 14).find((line) =>
      line &&
      !/^favorit$/i.test(line) &&
      !/^vezi telefon$/i.test(line) &&
      !/^vanzari apartamente/i.test(line) &&
      !/^an constructie:/i.test(line) &&
      !/^suprafata:/i.test(line) &&
      !/^etaj:/i.test(line) &&
      !/^confort:/i.test(line) &&
      !/^(decomandat|semidec|semidecomandat|nedecomandat)$/i.test(line)
    );

    if (!title) continue;
    if (!shouldKeepPortalCandidate(subjectFeatures, title, title)) continue;

    const metaWindow = lines.slice(index, index + 18);
    const yearLine = metaWindow.find((line) => /^an constructie:/i.test(line));
    const surfaceLine = metaWindow.find((line) => /^suprafata:/i.test(line));
    const floorLine = metaWindow.find((line) => /^etaj:/i.test(line));
    const partitioningLine = metaWindow.find((line) => /^(decomandat|semidec|semidecomandat|nedecomandat)$/i.test(line));
    const squareFootage = parseSurfaceValue(surfaceLine || '');
    if (!squareFootage) continue;

    const key = `${normalizeText(title)}|${price}|${squareFootage}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: `imobiliare-net-${results.length + 1}`,
      portalName: 'Imobiliare.net',
      title,
      address: title,
      locationLabel: title,
      price,
      squareFootage,
      rooms: parseRoomValue(title) ?? subject.rooms,
      constructionYear: parseYearValue(yearLine || ''),
      floor: floorLine?.replace(/^Etaj:\s*/i, '') || null,
      partitioning: partitioningLine || null,
      interiorState: normalizeInteriorState(undefined, metaWindow.join(' ')),
      url,
    });
  }

  return results;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchPortalIndexPrice(subject: Property) {
  const citySlug = slugify(subject.city || subject.location);
  if (!citySlug) return null;

  try {
    const text = await fetchHtml(`${IMOBILIARE_BASE_URL}/indicele-imobiliare-ro/${citySlug}`);
    const match = text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*€\/mp/i);
    if (!match?.[1]) return null;
    const numericValue = Number(match[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(numericValue) ? numericValue : null;
  } catch {
    return null;
  }
}

function buildOlxSearchUrls(subject: Property, subjectFeatures: PropertyFeatures) {
  const roomSegment = subject.rooms >= 4 ? '4-camere' : `${subject.rooms}-camere`;
  const primaryQuery = subjectFeatures.zoneTokens.join(' ').trim() || subject.zone || subject.location || subject.address;
  const fallbackQueries = subjectFeatures.zoneTokens.slice(0, 3);
  const queries = [primaryQuery, ...fallbackQueries]
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .map((item) => item.replace(/\s+/g, '-'));

  return Array.from(new Set(queries)).slice(0, 3).map(
    (query) => `${OLX_BASE_URL}/imobiliare/apartamente-garsoniere-de-vanzare/${roomSegment}/q-${query}/`
  );
}

function buildImobiliareNetUrls(subject: Property, subjectFeatures: PropertyFeatures) {
  const zoneCandidates = subjectFeatures.zoneTokens.length ? subjectFeatures.zoneTokens : [subject.zone || subject.location || ''];
  const roomSegment = subject.rooms >= 4 ? '4-camere' : `${subject.rooms}-camere`;
  return Array.from(
    new Set(
      zoneCandidates
        .map((item) => slugify(item))
        .filter(Boolean)
        .slice(0, 4)
        .map((slug) => `${IMOBILIARE_NET_BASE_URL}/${slug}/vanzari-apartamente-${roomSegment}`)
    )
  );
}

async function fetchPortalComparables(subject: Property, subjectFeatures: PropertyFeatures) {
  const requests = [
    ...buildOlxSearchUrls(subject, subjectFeatures).map((url) => ({ portal: 'olx', url })),
    ...buildImobiliareNetUrls(subject, subjectFeatures).map((url) => ({ portal: 'imobiliare-net', url })),
  ];

  const results = await Promise.all(
    requests.map(async ({ portal, url }) => {
      try {
        const html = await fetchHtml(url);
        if (portal === 'olx') {
          return parseOlxComparables(html, subject, subjectFeatures, url);
        }
        return parseImobiliareNetComparables(html, subject, subjectFeatures, url);
      } catch {
        return [] as PortalComparableCandidate[];
      }
    })
  );

  const merged = results.flat();
  const seen = new Set<string>();
  return merged
    .filter((candidate) => {
      const key = `${normalizeText(candidate.title)}|${candidate.price}|${candidate.squareFootage}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((candidate) =>
      createPricingComparable('portal_active', subject, subjectFeatures, candidate, candidate.portalName)
    )
    .filter((candidate) => candidate.similarityScore >= 60)
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, 10);
}

function isFailedPreconditionError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : null;
  const message = error instanceof Error ? error.message : String(error || '');
  return code === 9 || code === 'failed-precondition' || /FAILED_PRECONDITION/i.test(message);
}

async function fetchMarketAnalysisEventDocs(collectionGroup: 'propertyDeletionEvents' | 'propertyStatusEvents') {
  try {
    const snapshot = await adminDb
      .collectionGroup(collectionGroup)
      .where('marketAnalysisEligible', '==', true)
      .get();
    return snapshot.docs;
  } catch (error) {
    if (!isFailedPreconditionError(error)) {
      throw error;
    }

    const snapshot = await adminDb.collectionGroup(collectionGroup).get();
    return snapshot.docs.filter((docSnapshot) => Boolean(docSnapshot.data().marketAnalysisEligible));
  }
}

async function fetchArchivedSoldEventDocs() {
  const [statusEventDocs, deletionEventDocs] = await Promise.all([
    fetchMarketAnalysisEventDocs('propertyStatusEvents'),
    fetchMarketAnalysisEventDocs('propertyDeletionEvents'),
  ]);

  return [...statusEventDocs, ...deletionEventDocs];
}

async function fetchPlatformSoldComparables(subject: Property, subjectFeatures: PropertyFeatures) {
  const [snapshot, archivedDocs] = await Promise.all([
    adminDb.collectionGroup('properties').get(),
    fetchArchivedSoldEventDocs(),
  ]);
  const soldComparables: PricingComparable[] = [];
  const seenSoldKeys = new Set<string>();

  for (const docSnapshot of archivedDocs) {
    const data = { id: docSnapshot.id, ...docSnapshot.data() } as ArchivedSoldComparable;
    if (!data.marketAnalysisEligible) continue;

    const snapshotProperty = data.propertySnapshot;
    if (!snapshotProperty || snapshotProperty.id === subject.id) continue;

    const comparablePrice =
      typeof data.soldPrice === 'number' && data.soldPrice > 0
        ? data.soldPrice
        : typeof snapshotProperty.price === 'number'
          ? snapshotProperty.price
          : 0;

    const archivedCandidate: InternalComparableCandidate = {
      ...snapshotProperty,
      id: data.propertyId || snapshotProperty.id || docSnapshot.id,
      agencyId: data.agencyId || docSnapshot.ref.path.split('/')[1] || null,
      price: comparablePrice,
      status: 'Vândut',
      statusUpdatedAt:
        'changedAt' in data
          ? data.changedAt || snapshotProperty.statusUpdatedAt
          : data.deletedAt || snapshotProperty.statusUpdatedAt,
    };

    const dedupeKey = `${archivedCandidate.agencyId || 'unknown'}:${archivedCandidate.id}`;
    if (seenSoldKeys.has(dedupeKey)) continue;
    seenSoldKeys.add(dedupeKey);

    if (!isInternalComparable(subject, subjectFeatures, archivedCandidate)) continue;

    soldComparables.push(
      createPricingComparable(
        'platform_sold',
        subject,
        subjectFeatures,
        archivedCandidate,
        'changedAt' in data ? 'Vandut confirmat' : 'Vandut arhivat'
      )
    );
  }

  for (const docSnapshot of snapshot.docs) {
    const data = { id: docSnapshot.id, ...docSnapshot.data() } as InternalComparableCandidate;
    if (data.id === subject.id) continue;
    if (!isSoldStatus(data.status)) continue;

    const agencyId = docSnapshot.ref.path.split('/')[1] || null;
    const dedupeKey = `${agencyId || 'unknown'}:${data.id}`;
    if (seenSoldKeys.has(dedupeKey)) continue;
    seenSoldKeys.add(dedupeKey);

    const soldCandidate: InternalComparableCandidate = {
      ...data,
      price: typeof data.soldPrice === 'number' && data.soldPrice > 0 ? data.soldPrice : data.price,
    };
    if (!isInternalComparable(subject, subjectFeatures, soldCandidate)) continue;

    soldComparables.push(
      createPricingComparable('platform_sold', subject, subjectFeatures, { ...soldCandidate, agencyId }, 'Vandut')
    );
  }

  return soldComparables
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, 8);
}

async function fetchAgencyActiveComparables(subject: Property, subjectFeatures: PropertyFeatures, agencyId: string) {
  const snapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').get();
  const results: PricingComparable[] = [];

  for (const docSnapshot of snapshot.docs) {
    const data = { id: docSnapshot.id, ...docSnapshot.data() } as InternalComparableCandidate;
    if (data.id === subject.id) continue;
    if (!isActiveStatus(data.status)) continue;
    if (!isInternalComparable(subject, subjectFeatures, data)) continue;

    results.push(createPricingComparable('agency_active', subject, subjectFeatures, { ...data, agencyId }, 'Activ'));
  }

  return results
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, 6);
}

function computeAdjustmentSet(subject: Property, subjectFeatures: PropertyFeatures, referencePool: PricingComparable[]) {
  if (!referencePool.length) return [];

  const averageBathrooms =
    referencePool.reduce((sum, item) => sum + (item.bathrooms || 0), 0) / Math.max(referencePool.length, 1);
  const averageYearCandidates = referencePool.filter((item) => typeof item.constructionYear === 'number');
  const averageYear =
    averageYearCandidates.length > 0
      ? averageYearCandidates.reduce((sum, item) => sum + (item.constructionYear || 0), 0) / averageYearCandidates.length
      : null;
  const averageIntermediateFloorRate =
    referencePool.filter((item) => item.similarityReasons.some((reason) => reason.includes('etaj intermediar'))).length /
    Math.max(referencePool.length, 1);

  const adjustments: Array<{ label: string; reason: string; pct: number; direction: 'positive' | 'negative' | 'neutral' }> = [];

  if (subjectFeatures.interiorState === 'renovat') {
    adjustments.push({
      label: 'Apartament renovat',
      reason: 'Starea interioara sustine un pret peste media comparabilelor standard.',
      pct: 0.045,
      direction: 'positive',
    });
  } else if (subjectFeatures.interiorState === 'de_renovat') {
    adjustments.push({
      label: 'Necesita renovare',
      reason: 'Piata penalizeaza apartamentele care necesita investitii imediate.',
      pct: -0.06,
      direction: 'negative',
    });
  }

  if (subjectFeatures.isIntermediateFloor === true && averageIntermediateFloorRate < 0.55) {
    adjustments.push({
      label: 'Etaj intermediar',
      reason: 'Etajul intermediar este mai lichid comercial decat parterul sau ultimul etaj.',
      pct: 0.018,
      direction: 'positive',
    });
  } else if (subjectFeatures.isIntermediateFloor === false) {
    adjustments.push({
      label: 'Parter sau ultim etaj',
      reason: 'Pozitionarea pe verticala cere de obicei o mica ajustare fata de etajele intermediare.',
      pct: -0.02,
      direction: 'negative',
    });
  }

  if (subjectFeatures.isRehabilitated) {
    adjustments.push({
      label: 'Bloc reabilitat / anvelopat',
      reason: 'Blocul reabilitat sustine un nivel de incredere mai mare pentru cumparator.',
      pct: 0.02,
      direction: 'positive',
    });
  }

  if (subject.bathrooms > averageBathrooms + 0.4) {
    adjustments.push({
      label: 'Baie suplimentara',
      reason: 'Numarul de bai este peste media comparabilelor directe.',
      pct: 0.015,
      direction: 'positive',
    });
  }

  if (typeof subject.constructionYear === 'number' && typeof averageYear === 'number') {
    if (subject.constructionYear - averageYear >= 10) {
      adjustments.push({
        label: 'An de constructie superior',
        reason: 'Diferenta de generatie a blocului este relevanta pentru cumparatori.',
        pct: 0.02,
        direction: 'positive',
      });
    } else if (subject.constructionYear - averageYear <= -10) {
      adjustments.push({
        label: 'An de constructie inferior',
        reason: 'Vechimea cladirii poate cere o marja de pret mai prudenta.',
        pct: -0.02,
        direction: 'negative',
      });
    }
  }

  return adjustments.slice(0, 5);
}

function computeVolatility(comparables: PricingComparable[]) {
  if (comparables.length < 2) return 0.05;
  const average = comparables.reduce((sum, item) => sum + item.pricePerSqm, 0) / comparables.length;
  const variance =
    comparables.reduce((sum, item) => sum + (item.pricePerSqm - average) ** 2, 0) / Math.max(comparables.length - 1, 1);
  return clamp(Math.sqrt(variance) / Math.max(average, 1), 0.04, 0.12);
}

function buildSummary(params: {
  recommendedListingPrice: number;
  recommendedListingPricePerSqm: number;
  confidenceScore: number;
  soldBenchmarkPricePerSqm: number | null;
  activeBenchmarkPricePerSqm: number | null;
  portalBenchmarkPricePerSqm: number | null;
  subject: Property;
  marketHeat: 'hot' | 'balanced' | 'soft';
  portalCount: number;
}) {
  const {
    recommendedListingPrice,
    recommendedListingPricePerSqm,
    confidenceScore,
    soldBenchmarkPricePerSqm,
    activeBenchmarkPricePerSqm,
    portalBenchmarkPricePerSqm,
    subject,
    marketHeat,
    portalCount,
  } = params;

  const heatText =
    marketHeat === 'hot'
      ? 'cererea activa permite un pret de intrare mai ferm'
      : marketHeat === 'soft'
        ? 'competitia activa cere un pret de listare mai disciplinat'
        : 'piata este relativ echilibrata intre cerere si oferta';

  const anchors = [
    soldBenchmarkPricePerSqm ? `vanzari inchise ~${soldBenchmarkPricePerSqm} EUR/mp` : null,
    activeBenchmarkPricePerSqm ? `oferte active interne ~${activeBenchmarkPricePerSqm} EUR/mp` : null,
    portalBenchmarkPricePerSqm ? `portaluri externe ~${portalBenchmarkPricePerSqm} EUR/mp` : null,
  ].filter(Boolean);

  return `Pretul recomandat de listare pentru ${subject.title} este ${recommendedListingPrice.toLocaleString('ro-RO')} EUR (${recommendedListingPricePerSqm.toLocaleString('ro-RO')} EUR/mp). Algoritmul foloseste comparabile pe microzona, camere, suprafata, stare, etaj si vechime, plus ${portalCount} comparabile externe extrase fara API din OLX/Storia si imobiliare.net; ${heatText}. Nivelul de incredere este ${confidenceScore} / 100, iar reperele dominante sunt ${anchors.join(', ')}.`;
}

export async function generatePricingAnalysis(params: {
  agencyId: string;
  propertyId: string;
}) {
  const { agencyId, propertyId } = params;
  const propertySnapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();

  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const subject = {
    id: propertySnapshot.id,
    ...propertySnapshot.data(),
  } as Property;

  if (!subject.squareFootage || !subject.price) {
    throw new Error('Proprietatea are nevoie de pret si suprafata utila pentru analiza.');
  }

  const subjectFeatures = extractPropertyFeatures(subject);
  const dataQuality = buildDataQuality(subject, subjectFeatures);

  const [soldComparables, activeComparables, portalComparables, portalIndexPricePerSqm] = await Promise.all([
    fetchPlatformSoldComparables(subject, subjectFeatures),
    fetchAgencyActiveComparables(subject, subjectFeatures, agencyId),
    fetchPortalComparables(subject, subjectFeatures),
    fetchPortalIndexPrice(subject),
  ]);
  const marketEvidence = computeMarketEvidence({ soldComparables, activeComparables, portalComparables });

  const soldBenchmarkPricePerSqm = computeWeightedBenchmark(soldComparables, 1);
  const activeBenchmarkPricePerSqm = computeWeightedBenchmark(activeComparables, 0.965);
  const portalBenchmarkPricePerSqm = computeWeightedBenchmark(portalComparables, 0.955);

  const anchors = [
    soldBenchmarkPricePerSqm,
    activeBenchmarkPricePerSqm,
    portalBenchmarkPricePerSqm,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (!anchors.length) {
    throw new Error('Nu exista suficiente comparabile pentru analiza acestei proprietati.');
  }

  let baselinePricePerSqm = 0;
  if (soldBenchmarkPricePerSqm !== null) {
    baselinePricePerSqm =
      soldBenchmarkPricePerSqm * 0.58 +
      (activeBenchmarkPricePerSqm ?? soldBenchmarkPricePerSqm) * 0.18 +
      (portalBenchmarkPricePerSqm ?? soldBenchmarkPricePerSqm) * 0.24;
  } else {
    baselinePricePerSqm =
      (activeBenchmarkPricePerSqm ?? portalBenchmarkPricePerSqm ?? anchors[0]) * 0.45 +
      (portalBenchmarkPricePerSqm ?? activeBenchmarkPricePerSqm ?? anchors[0]) * 0.55;
  }

  const referencePool = [
    ...soldComparables.slice(0, 5),
    ...activeComparables.slice(0, 3),
    ...portalComparables.slice(0, 4),
  ];
  const rawAdjustments = computeAdjustmentSet(subject, subjectFeatures, referencePool);
  const totalAdjustmentPct = clamp(rawAdjustments.reduce((sum, item) => sum + item.pct, 0), -0.1, 0.11);
  const anchorMedian = median(anchors) || baselinePricePerSqm;

  let recommendedListingPricePerSqm = baselinePricePerSqm * (1 + totalAdjustmentPct);
  const sanityFloor = anchorMedian * (soldComparables.length > 0 ? 0.84 : 0.9);
  const sanityCeil = anchorMedian * 1.18;
  recommendedListingPricePerSqm = clamp(recommendedListingPricePerSqm, sanityFloor, sanityCeil);
  recommendedListingPricePerSqm = round(recommendedListingPricePerSqm, 0);

  const recommendedListingPrice = round(recommendedListingPricePerSqm * subject.squareFootage, 0);
  const adjustments: PricingAdjustment[] = rawAdjustments.map((item) => {
    const impactPerSqm = round(anchorMedian * item.pct, 0);
    return {
      label: item.label,
      direction: item.direction,
      impactPerSqm,
      impactTotal: round(impactPerSqm * subject.squareFootage, 0),
      reason: item.reason,
    };
  });

  const combinedComparables = [...soldComparables, ...activeComparables, ...portalComparables];
  const volatility = computeVolatility(combinedComparables);
  const averageSimilarity =
    combinedComparables.reduce((sum, item) => sum + item.similarityScore, 0) / Math.max(combinedComparables.length, 1);

  const rawConfidenceScore = round(
    36 +
      Math.min(28, soldComparables.length * 7) +
      Math.min(12, activeComparables.length * 3) +
      Math.min(18, portalComparables.length * 3) +
      averageSimilarity / 3.5,
    0
  );
  const confidenceCeiling = soldComparables.length >= 3 ? 96 : soldComparables.length >= 1 ? 84 : 72;
  const confidenceScore = clamp(rawConfidenceScore, 40, confidenceCeiling);

  const rangeBase = confidenceScore >= 82 ? 0.045 : confidenceScore >= 68 ? 0.06 : 0.08;
  const spread = clamp(rangeBase + volatility / 2, 0.05, 0.14);
  const conservativeMinPrice = round(recommendedListingPrice * (1 - spread), 0);
  const stretchMaxPrice = round(recommendedListingPrice * (1 + spread), 0);

  const marketHeat: 'hot' | 'balanced' | 'soft' =
    portalBenchmarkPricePerSqm && soldBenchmarkPricePerSqm
      ? portalBenchmarkPricePerSqm > soldBenchmarkPricePerSqm * 1.06
        ? 'hot'
        : portalBenchmarkPricePerSqm < soldBenchmarkPricePerSqm * 0.97
          ? 'soft'
          : 'balanced'
      : activeBenchmarkPricePerSqm && recommendedListingPricePerSqm < activeBenchmarkPricePerSqm * 0.96
        ? 'soft'
        : 'balanced';
  const pricingStrategy = buildPricingStrategy({
    subject,
    recommendedListingPrice,
    recommendedListingPricePerSqm,
    conservativeMinPrice,
    stretchMaxPrice,
    confidenceScore,
    marketHeat,
  });

  const limitations = [
    soldComparables.length === 0
      ? 'Nu exista inca tranzactii Vandut suficient de similare pentru aceasta microzona; recomandarea foloseste oferte active si portaluri, cu incredere plafonata.'
      : null,
    soldComparables.length > 0 && soldComparables.length < 3
      ? 'Esantionul de tranzactii Vandut este inca redus; intervalul tactic trebuie tratat ca plaja de calibrare, nu ca evaluare bancara.'
      : null,
    'Comparabilele din portaluri sunt preturi active de listare, nu preturi finale de tranzactionare.',
    'Scraping-ul fara API depinde de structura HTML a portalurilor si poate necesita recalibrare daca paginile se schimba.',
    'Scorul final ramane dependent de calitatea datelor din proprietate: zona, suprafata, etaj, stare si anul constructiei.',
  ].filter((item): item is string => Boolean(item));
  const generatedAt = new Date().toISOString();

  await reconcileAgencyBacktests(agencyId).catch((error) => {
    console.warn('Pricing backtest reconciliation failed:', error);
  });
  const backtest = await buildBacktestSummary(agencyId, subject).catch((error) => {
    console.warn('Pricing backtest summary failed:', error);
    return {
      available: false,
      sampleSize: 0,
      meanAbsoluteErrorPercent: null,
      medianAbsoluteErrorPercent: null,
      biasPercent: null,
      verdict: 'Backtesting-ul nu a putut fi calculat pentru aceasta rulare.',
      latestBacktest: null,
    } satisfies PricingBacktestSummary;
  });

  const analysis = {
    generatedAt,
    subject: {
      id: subject.id,
      title: subject.title,
      address: subject.address,
      city: subject.city || null,
      zone: subject.zone || null,
      squareFootage: subject.squareFootage,
      rooms: subject.rooms,
      bathrooms: subject.bathrooms,
      price: subject.price,
    },
    recommendedListingPrice,
    recommendedListingPricePerSqm,
    conservativeMinPrice,
    stretchMaxPrice,
    confidenceScore,
    summary: buildSummary({
      recommendedListingPrice,
      recommendedListingPricePerSqm,
      confidenceScore,
      soldBenchmarkPricePerSqm,
      activeBenchmarkPricePerSqm,
      portalBenchmarkPricePerSqm,
      subject,
      marketHeat,
      portalCount: portalComparables.length,
    }),
    soldBenchmarkPricePerSqm,
    activeBenchmarkPricePerSqm,
    portalBenchmarkPricePerSqm,
    soldComparables,
    activeComparables,
    portalComparables,
    adjustments,
    marketSignals: {
      soldCount: soldComparables.length,
      activeCount: activeComparables.length,
      portalCount: portalComparables.length,
      marketHeat,
      portalIndexPricePerSqm,
    },
    limitations,
    dataQuality,
    marketEvidence,
    pricingStrategy,
    backtest,
  } satisfies PricingAnalysisResult;

  await persistPricingAnalysisSnapshot(agencyId, analysis).catch((error) => {
    console.warn('Pricing analysis snapshot persistence failed:', error);
  });

  return analysis;
}
