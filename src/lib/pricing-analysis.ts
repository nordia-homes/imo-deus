import { adminDb } from '@/firebase/admin';
import type { Property, PropertyDeletionEvent, PropertyStatusEvent } from '@/lib/types';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { parseArea, parsePriceNumber, parseRooms } from '@/lib/owner-listings/utils';
import { buildPropertyZoneFact } from '@/lib/zones/matching';
import { getAdjacentZones, getClusterPeers, normalizeRomanianText, preparedBucurestiIlfovOntology } from '@/lib/zones/ontology';

type ComparableSource = 'platform_sold' | 'agency_active' | 'portal_active';
type RejectionSeverity = 'info' | 'warning' | 'critical';

export type PricingComparable = {
  id: string;
  source: ComparableSource;
  title: string;
  address: string;
  imageUrl?: string | null;
  locationLabel: string;
  price: number;
  pricePerSqm: number;
  squareFootage: number;
  rooms: number | null;
  bathrooms: number | null;
  constructionYear: number | null;
  parkingIncluded?: boolean | null;
  similarityScore: number;
  similarityReasons: string[];
  statusLabel: string;
  agencyId?: string | null;
  url?: string | null;
  recordedAt?: string | null;
};

export type PricingRejectedComparable = {
  id: string;
  source: ComparableSource;
  title: string;
  locationLabel: string;
  price: number | null;
  squareFootage: number | null;
  pricePerSqm: number | null;
  similarityScore: number | null;
  reasonCode:
    | 'missing_price_or_surface'
    | 'wrong_transaction'
    | 'wrong_property_type'
    | 'weak_location_match'
    | 'room_mismatch'
    | 'surface_out_of_range'
    | 'stale_listing'
    | 'duplicate'
    | 'price_outlier';
  reason: string;
  severity: RejectionSeverity;
  url?: string | null;
};

export type PricingSourceDiagnostic = {
  source: 'platform_sold' | 'agency_active' | 'owner_listings';
  attempted: boolean;
  fetchedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  status: 'ok' | 'partial' | 'failed' | 'skipped';
  message: string;
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
  segment?: {
    key: string;
    sampleSize: number;
    medianAbsoluteErrorPercent: number | null;
    biasPercent: number | null;
    calibrationFactor: number;
    verdict: string;
  };
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
    propertyType: string | null;
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
  sourceDiagnostics: PricingSourceDiagnostic[];
  rejectedComparables: PricingRejectedComparable[];
  riskFlags: Array<{
    severity: RejectionSeverity;
    label: string;
    reason: string;
  }>;
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
  imageUrl?: string | null;
  locationLabel: string;
  price: number;
  squareFootage: number;
  rooms: number | null;
  bathrooms?: number | null;
  constructionYear?: number | null;
  parkingIncluded?: boolean | null;
  floor?: string | null;
  totalFloors?: number | null;
  partitioning?: string | null;
  interiorState?: string | null;
  url?: string | null;
  zoneMatchPriority?: number | null;
  lastSeenAt?: string | number | null;
};

type PortalFetchResult = {
  candidates: PortalComparableCandidate[];
  rejected: PricingRejectedComparable[];
  diagnostics: PricingSourceDiagnostic[];
};

type InternalComparableResult = {
  comparables: PricingComparable[];
  rejected: PricingRejectedComparable[];
  diagnostic: PricingSourceDiagnostic;
};

type PropertyFeatures = {
  propertyType: string;
  zoneTokens: string[];
  relatedZoneTokens: string[];
  broaderLocationTokens: string[];
  rawZoneText: string;
  zoneId: string | null;
  zoneName: string | null;
  adjacentZoneIds: Set<string>;
  clusterZoneIds: Set<string>;
  isIntermediateFloor: boolean | null;
  partitioning: string;
  interiorState: string;
  isRehabilitated: boolean;
  hasIncludedParking: boolean | null;
  sourceText: string;
};

function normalizeText(value?: string | null) {
  return normalizeRomanianText(value || '');
}

function normalizedContainsPhrase(text: string, phrase?: string | null) {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  return ` ${normalizeText(text)} `.includes(` ${normalizedPhrase} `);
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

function safePricePerSqm(price?: number | null, surface?: number | null) {
  if (!price || !surface) return null;
  return round(toPricePerSqm(price, surface), 0);
}

function getBalconySurface(property: Pick<Property, 'squareFootage' | 'totalSurface' | 'balconyTerrace'>) {
  if (!property.totalSurface || !property.squareFootage || property.totalSurface <= property.squareFootage) return 0;
  const balconyLabel = normalizeText(property.balconyTerrace);
  if (balconyLabel === 'fara' || balconyLabel.includes('fara balcon') || balconyLabel.includes('balcon francez')) return 0;
  return round(property.totalSurface - property.squareFootage, 2);
}

function getPricingSurface(property: Pick<Property, 'squareFootage' | 'totalSurface' | 'balconyTerrace'>) {
  return property.squareFootage + getBalconySurface(property) * 0.5;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function maxFinite(values: Array<number | null | undefined>) {
  const cleanValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return cleanValues.length ? Math.max(...cleanValues) : null;
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

function getConstructionEra(year?: number | null) {
  if (typeof year !== 'number' || !Number.isFinite(year)) return 'unknown';
  if (year < 1940) return 'historic';
  if (year < 1977) return 'pre_1977';
  if (year < 1990) return 'communist_post_1977';
  if (year < 2000) return 'post_1990';
  if (year < 2010) return 'post_2000';
  return 'modern';
}

function computeConstructionEraScore(subjectYear?: number | null, candidateYear?: number | null) {
  if (typeof subjectYear !== 'number' || typeof candidateYear !== 'number') return 3;

  const subjectEra = getConstructionEra(subjectYear);
  const candidateEra = getConstructionEra(candidateYear);
  if (subjectEra === candidateEra) {
    if (subjectYear >= 2000 && candidateYear >= 2000) return 20;
    return subjectEra === 'pre_1977' || subjectEra === 'historic' ? 12 : 10;
  }

  if (subjectYear < 1977 || candidateYear < 1977) return 0;
  if (subjectYear >= 2000 && candidateYear >= 2000) return Math.max(0, 16 - Math.abs(candidateYear - subjectYear) / 3);
  return Math.max(0, 8 - Math.abs(candidateYear - subjectYear) / 4);
}

function getConstructionEraReason(subjectYear?: number | null, candidateYear?: number | null) {
  if (typeof subjectYear !== 'number' || typeof candidateYear !== 'number') return null;
  const subjectEra = getConstructionEra(subjectYear);
  const candidateEra = getConstructionEra(candidateYear);
  if (subjectEra === candidateEra && (subjectEra === 'pre_1977' || subjectEra === 'historic')) {
    return 'aceeasi generatie seismica pre-1977';
  }
  if (subjectEra === candidateEra) return 'generatie constructie similara';
  if (subjectYear < 1977 || candidateYear < 1977) return 'generatie seismica diferita';
  return null;
}

function detectIncludedParking(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const negativeSignals = [
    'fara parcare',
    'fara loc',
    'fara garaj',
    'nu include parcare',
    'parcare neinclusa',
    'loc neinclus',
    'stradal',
  ];
  if (negativeSignals.some((signal) => normalized.includes(signal))) return false;

  const positiveSignals = [
    'loc de parcare',
    'parcare inclusa',
    'parcare subterana',
    'parcare supraterana',
    'parcare exterior',
    'loc exterior',
    'loc subteran',
    'garaj',
    'boxa auto',
    'in curte',
    'subteran',
  ];
  if (positiveSignals.some((signal) => normalized.includes(signal))) return true;

  if (normalized === 'fara') return false;
  return null;
}

function hasIncludedParking(property: Pick<Property, 'parking' | 'description' | 'keyFeatures' | 'amenities' | 'title'>) {
  const explicitParking = detectIncludedParking(property.parking);
  if (explicitParking !== null) return explicitParking;

  const sourceText = [
    property.title,
    property.description,
    property.keyFeatures,
    ...(property.amenities || []),
  ]
    .filter(Boolean)
    .join(' ');

  return detectIncludedParking(sourceText);
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
    if (normalizedContainsPhrase(normalized, phrase)) {
      candidates.add(phrase);
    }
  }

  if (zoneName) {
    candidates.add(normalizeText(zoneName));
  }

  if (!candidates.size && property.zone) {
    candidates.add(normalizeText(property.zone));
  }

  for (const zone of preparedBucurestiIlfovOntology.zones) {
    if (zone.zone_type === 'sector' || zone.zone_type === 'locality') continue;
    const labels = [zone.name, ...zone.aliases, ...zone.micro_zones, ...zone.commercial_clusters];
    if (labels.some((label) => normalizedContainsPhrase(normalized, label))) {
      candidates.add(normalizeText(zone.name));
      for (const alias of zone.aliases) {
        candidates.add(normalizeText(alias));
      }
      for (const microZone of zone.micro_zones) {
        candidates.add(normalizeText(microZone));
      }
    }
  }

  return Array.from(candidates).filter(Boolean);
}

function buildRelatedZoneTokens(zoneIds: Set<string>) {
  const tokens = new Set<string>();
  for (const zoneId of zoneIds) {
    const zone = preparedBucurestiIlfovOntology.zoneById.get(zoneId);
    if (!zone) continue;
    tokens.add(normalizeText(zone.name));
    for (const alias of zone.aliases) tokens.add(normalizeText(alias));
    for (const microZone of zone.micro_zones) tokens.add(normalizeText(microZone));
  }
  return Array.from(tokens).filter(Boolean);
}

function buildChildZoneTokens(zoneId: string | null) {
  if (!zoneId) return [];
  const zone = preparedBucurestiIlfovOntology.zoneById.get(zoneId);
  if (!zone) return [];

  const tokens = new Set<string>();
  const normalizedParentName = normalizeText(zone.name);
  const childZones = preparedBucurestiIlfovOntology.zones.filter((candidate) => {
    if (zone.sector && candidate.sector === zone.sector && candidate.zone_id !== zone.zone_id) return true;
    return normalizeText(candidate.parent) === normalizedParentName;
  });

  for (const childZone of childZones) {
    tokens.add(normalizeText(childZone.name));
    for (const alias of childZone.aliases) tokens.add(normalizeText(alias));
    for (const microZone of childZone.micro_zones) tokens.add(normalizeText(microZone));
  }

  return Array.from(tokens).filter(Boolean);
}

function buildBroaderLocationTokens(property: Property, zoneName: string | null) {
  const tokens = new Set<string>();
  const sourceText = normalizeText([property.zone, property.location, property.address, property.title, property.city].filter(Boolean).join(' '));
  const sectorMatch = sourceText.match(/\bsector(?:ul)?\s*([1-6])\b/);
  if (sectorMatch?.[1]) {
    tokens.add(`sector ${sectorMatch[1]}`);
    tokens.add(`sectorul ${sectorMatch[1]}`);
  }

  const normalizedZone = normalizeText(zoneName || property.zone);
  if (normalizedZone) tokens.add(normalizedZone);

  const zone = normalizedZone
    ? preparedBucurestiIlfovOntology.zones.find((candidate) => normalizeText(candidate.name) === normalizedZone)
    : null;
  if (zone?.parent) tokens.add(normalizeText(zone.parent));
  if (zone?.sector) {
    tokens.add(`sector ${zone.sector}`);
    tokens.add(`sectorul ${zone.sector}`);
  }

  if (sourceText.includes('bucuresti')) tokens.add('bucuresti');
  return Array.from(tokens).filter(Boolean);
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
    property.parking,
    property.keyFeatures,
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
  const childZoneTokens = buildChildZoneTokens(zoneFact.zoneId);

  return {
    propertyType: normalizePropertyType(property.propertyType),
    zoneTokens: buildZoneKeywords(property, zoneFact.zoneName),
    relatedZoneTokens: Array.from(new Set([...buildRelatedZoneTokens(new Set([...adjacentZoneIds, ...clusterZoneIds])), ...childZoneTokens])),
    broaderLocationTokens: buildBroaderLocationTokens(property, zoneFact.zoneName),
    rawZoneText: zoneFact.rawZoneText,
    zoneId: zoneFact.zoneId,
    zoneName: zoneFact.zoneName,
    adjacentZoneIds,
    clusterZoneIds,
    isIntermediateFloor: parseFloorInfo(property.floor, property.totalFloors ?? null).isIntermediateFloor,
    partitioning: normalizePartitioning(property.partitioning, sourceText),
    interiorState: normalizeInteriorState(property.interiorState, sourceText),
    isRehabilitated: isRehabilitatedProperty(sourceText, property),
    hasIncludedParking: hasIncludedParking(property),
    sourceText,
  } satisfies PropertyFeatures;
}

function extractPortalCandidateFeatures(candidate: PortalComparableCandidate, subjectFeatures: PropertyFeatures) {
  const sourceText = [
    candidate.title,
    candidate.address,
    candidate.locationLabel,
    candidate.partitioning,
    candidate.interiorState,
    candidate.parkingIncluded === true ? 'parcare inclusa' : candidate.parkingIncluded === false ? 'fara parcare' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const zoneFact = buildPropertyZoneFact({
    propertyId: candidate.id,
    rawZoneText: candidate.locationLabel || candidate.address || candidate.title,
    locality: candidate.locationLabel || null,
    address: candidate.address,
    title: candidate.title,
    description: sourceText,
  });
  const adjacentZoneIds = new Set(
    zoneFact.zoneId ? getAdjacentZones(zoneFact.zoneId).map((zone) => zone.zone_id) : []
  );
  const clusterZoneIds = new Set(
    zoneFact.zoneId ? getClusterPeers(zoneFact.zoneId).map((zone) => zone.zone_id) : []
  );
  const childZoneTokens = buildChildZoneTokens(zoneFact.zoneId);

  return {
    propertyType: subjectFeatures.propertyType,
    zoneTokens: buildZoneKeywords(
      {
        id: candidate.id,
        title: candidate.title,
        address: candidate.address,
        location: candidate.locationLabel,
        city: candidate.locationLabel,
        zone: candidate.locationLabel,
        description: sourceText,
        price: candidate.price,
        rooms: candidate.rooms || 0,
        bathrooms: candidate.bathrooms || 0,
        squareFootage: candidate.squareFootage,
        images: [],
        propertyType: subjectFeatures.propertyType,
        transactionType: 'Vanzare',
      } as Property,
      zoneFact.zoneName
    ),
    relatedZoneTokens: Array.from(new Set([...buildRelatedZoneTokens(new Set([...adjacentZoneIds, ...clusterZoneIds])), ...childZoneTokens])),
    broaderLocationTokens: buildBroaderLocationTokens(
      {
        id: candidate.id,
        title: candidate.title,
        address: candidate.address,
        location: candidate.locationLabel,
        city: candidate.locationLabel,
        zone: candidate.locationLabel,
        price: candidate.price,
        rooms: candidate.rooms || 0,
        bathrooms: candidate.bathrooms || 0,
        squareFootage: candidate.squareFootage,
        images: [],
        propertyType: subjectFeatures.propertyType,
        transactionType: 'Vanzare',
      } as Property,
      zoneFact.zoneName
    ),
    rawZoneText: zoneFact.rawZoneText,
    zoneId: zoneFact.zoneId,
    zoneName: zoneFact.zoneName,
    adjacentZoneIds,
    clusterZoneIds,
    isIntermediateFloor: candidate.floor ? parseFloorInfo(candidate.floor, candidate.totalFloors ?? null).isIntermediateFloor : null,
    partitioning: normalizePartitioning(candidate.partitioning, sourceText),
    interiorState: normalizeInteriorState(candidate.interiorState, sourceText),
    isRehabilitated: normalizeText(sourceText).includes('reabilitat') || normalizeText(sourceText).includes('anvelopat'),
    hasIncludedParking: candidate.parkingIncluded ?? detectIncludedParking(sourceText),
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
    if (token && normalizedContainsPhrase(normalizedCandidateText, token)) {
      return token === normalizeText(subjectFeatures.zoneName) ? 0.92 : 0.82;
    }
  }

  for (const token of subjectFeatures.relatedZoneTokens) {
    if (token && normalizedContainsPhrase(normalizedCandidateText, token)) {
      return 0.76;
    }
  }

  return 0.35;
}

function buildSimilarityReasons(subject: Property, subjectFeatures: PropertyFeatures, candidate: {
  zoneLabel?: string | null;
  squareFootage: number;
  rooms?: number | null;
  constructionYear?: number | null;
  parkingIncluded?: boolean | null;
  partitioning?: string | null;
  interiorState?: string | null;
  isIntermediateFloor?: boolean | null;
}, zoneScore: number) {
  const reasons: string[] = [];

  if (zoneScore >= 0.95) reasons.push('aceeasi microzona');
  else if (zoneScore >= 0.84) reasons.push('zona adiacenta relevanta');
  else if (zoneScore >= 0.74) reasons.push('zona adiacenta extinsa');
  else if (zoneScore >= 0.66) reasons.push('acelasi cluster comercial');

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
  const constructionEraReason = getConstructionEraReason(subject.constructionYear, candidate.constructionYear);
  if (constructionEraReason) reasons.push(constructionEraReason);

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

  if (candidate.parkingIncluded !== null && subjectFeatures.hasIncludedParking !== null) {
    if (candidate.parkingIncluded === subjectFeatures.hasIncludedParking) {
      reasons.push(candidate.parkingIncluded ? 'parcare inclusa similara' : 'fara parcare similara');
    }
  }

  return reasons.length ? reasons : ['comparabil util pentru calibrare'];
}

function computeSimilarityScore(subject: Property, subjectFeatures: PropertyFeatures, candidate: {
  propertyType?: string | null;
  squareFootage: number;
  rooms?: number | null;
  bathrooms?: number | null;
  constructionYear?: number | null;
  parkingIncluded?: boolean | null;
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
      relatedZoneTokens: [],
      broaderLocationTokens: [],
      rawZoneText: '',
      sourceText: candidate.sourceText || '',
      partitioning: candidate.partitioning || 'unknown',
      interiorState: candidate.interiorState || 'unknown',
      isIntermediateFloor: candidate.isIntermediateFloor ?? null,
      isRehabilitated: false,
      hasIncludedParking: candidate.parkingIncluded ?? null,
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

  score += computeConstructionEraScore(subject.constructionYear, candidate.constructionYear);

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

  if (candidate.parkingIncluded !== null && subjectFeatures.hasIncludedParking !== null) {
    score += candidate.parkingIncluded === subjectFeatures.hasIncludedParking ? 4 : 0.5;
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
  const imageUrl =
    'images' in candidate && Array.isArray(candidate.images)
      ? candidate.images.find((image) => image?.url)?.url || null
      : 'imageUrl' in candidate
        ? candidate.imageUrl || null
        : null;
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
      : extractPortalCandidateFeatures(candidate, subjectFeatures);

  const similarityScore = computeSimilarityScore(subject, subjectFeatures, {
    propertyType: 'propertyType' in candidate ? candidate.propertyType : subject.propertyType,
    squareFootage: candidate.squareFootage,
    rooms: candidate.rooms ?? null,
    bathrooms: 'bathrooms' in candidate ? candidate.bathrooms ?? null : null,
    constructionYear: 'constructionYear' in candidate ? candidate.constructionYear ?? null : null,
    parkingIncluded: candidateFeatures.hasIncludedParking,
    partitioning: 'partitioning' in candidate ? candidate.partitioning ?? null : null,
    interiorState: 'interiorState' in candidate ? candidate.interiorState ?? null : null,
    isIntermediateFloor: candidateFeatures.isIntermediateFloor,
    sourceText: candidateText,
    zoneFeatures: candidateFeatures,
  });

  const zoneScore = computeZoneScore(subjectFeatures, candidateFeatures, candidateText);
  const candidateZoneMatchPriority = 'zoneMatchPriority' in candidate ? candidate.zoneMatchPriority ?? null : null;
  const effectiveZoneScore =
    candidateZoneMatchPriority === 4
      ? 0.97
      : candidateZoneMatchPriority === 3
        ? 0.9
        : candidateZoneMatchPriority === 2
          ? 0.82
          : candidateZoneMatchPriority === 1
            ? 0.72
            : candidateZoneMatchPriority === 0.5
              ? 0.55
              : zoneScore;
  const effectiveSimilarityScore = candidateZoneMatchPriority
    ? clamp(round(similarityScore + (effectiveZoneScore - zoneScore) * 20, 1), 0, 100)
    : similarityScore;

  return {
    id: candidate.id,
    source,
    title: candidate.title,
    address: candidate.address,
    imageUrl,
    locationLabel,
    price: candidate.price,
    pricePerSqm: round(toPricePerSqm(candidate.price, candidate.squareFootage), 0),
    squareFootage: candidate.squareFootage,
    rooms: candidate.rooms ?? null,
    bathrooms: 'bathrooms' in candidate ? candidate.bathrooms ?? null : null,
    constructionYear: 'constructionYear' in candidate ? candidate.constructionYear ?? null : null,
    parkingIncluded: candidateFeatures.hasIncludedParking,
    similarityScore: effectiveSimilarityScore,
    similarityReasons: buildSimilarityReasons(
      subject,
      subjectFeatures,
      {
        zoneLabel: locationLabel,
        squareFootage: candidate.squareFootage,
        rooms: candidate.rooms ?? null,
        constructionYear: 'constructionYear' in candidate ? candidate.constructionYear ?? null : null,
        parkingIncluded: candidateFeatures.hasIncludedParking,
        partitioning: 'partitioning' in candidate ? candidate.partitioning ?? null : null,
        interiorState: 'interiorState' in candidate ? candidate.interiorState ?? null : null,
        isIntermediateFloor: candidateFeatures.isIntermediateFloor,
      },
      effectiveZoneScore
    ),
    statusLabel,
    agencyId: 'agencyId' in candidate ? candidate.agencyId ?? null : null,
    url: 'url' in candidate ? candidate.url ?? null : null,
    recordedAt: 'statusUpdatedAt' in candidate ? candidate.statusUpdatedAt ?? null : null,
  };
}

function isInternalComparable(subject: Property, subjectFeatures: PropertyFeatures, candidate: InternalComparableCandidate) {
  return evaluateInternalComparable(subject, subjectFeatures, candidate).comparable !== null;
}

function evaluateInternalComparable(
  subject: Property,
  subjectFeatures: PropertyFeatures,
  candidate: InternalComparableCandidate
): { comparable: PricingComparable | null; rejection: PricingRejectedComparable | null } {
  const source: ComparableSource = isSoldStatus(candidate.status) ? 'platform_sold' : 'agency_active';
  const statusLabel = isSoldStatus(candidate.status) ? 'Vandut' : 'Activ';
  const locationLabel = getLocationLabel(candidate);

  if (!candidate.squareFootage || !candidate.price) {
    return {
      comparable: null,
      rejection: createRejectedComparable({
        id: candidate.id,
        source,
        title: candidate.title,
        locationLabel,
        price: candidate.price || null,
        squareFootage: candidate.squareFootage || null,
        reasonCode: 'missing_price_or_surface',
        reason: 'Comparabila nu are pret si suprafata utila valide.',
        severity: 'warning',
      }),
    };
  }

  if (!isSaleTransaction(candidate.transactionType)) {
    return {
      comparable: null,
      rejection: createRejectedComparable({
        id: candidate.id,
        source,
        title: candidate.title,
        locationLabel,
        price: candidate.price,
        squareFootage: candidate.squareFootage,
        reasonCode: 'wrong_transaction',
        reason: 'Comparabila nu este o tranzactie de vanzare.',
      }),
    };
  }

  if (normalizePropertyType(candidate.propertyType) !== subjectFeatures.propertyType) {
    return {
      comparable: null,
      rejection: createRejectedComparable({
        id: candidate.id,
        source,
        title: candidate.title,
        locationLabel,
        price: candidate.price,
        squareFootage: candidate.squareFootage,
        reasonCode: 'wrong_property_type',
        reason: 'Tipul proprietatii nu se potriveste cu proprietatea evaluata.',
      }),
    };
  }

  const candidateComparable = createPricingComparable(source, subject, subjectFeatures, candidate, statusLabel);
  if (candidateComparable.similarityScore < 52) {
    return {
      comparable: null,
      rejection: createRejectedComparable({
        id: candidate.id,
        source,
        title: candidate.title,
        locationLabel,
        price: candidate.price,
        squareFootage: candidate.squareFootage,
        similarityScore: candidateComparable.similarityScore,
        reasonCode: 'weak_location_match',
        reason: 'Scorul de similaritate este sub pragul minim pentru evaluare.',
      }),
    };
  }

  return { comparable: candidateComparable, rejection: null };
}

function getComparableZonePriority(comparable: PricingComparable) {
  if (comparable.similarityReasons.some((reason) => reason.includes('aceeasi microzona'))) return 3;
  if (comparable.similarityReasons.some((reason) => reason.includes('zona adiacenta'))) return 2;
  if (comparable.similarityReasons.some((reason) => reason.includes('cluster'))) return 1;
  return 0;
}

function sortComparablesByRelevance(left: PricingComparable, right: PricingComparable) {
  return getComparableZonePriority(right) - getComparableZonePriority(left) || right.similarityScore - left.similarityScore;
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
  if (source === 'platform_sold') return 1.14;
  if (source === 'agency_active') return 0.78;
  return 0.62;
}

const ACTIVE_ASK_TO_SALE_DISCOUNT = 0.95;

function isSameMicrozoneComparable(comparable: PricingComparable) {
  return comparable.similarityReasons.some((reason) => reason.includes('aceeasi microzona'));
}

function computeComparableWeight(comparable: PricingComparable) {
  const similarityWeight = (comparable.similarityScore / 100) ** 1.75;
  const soldMicrozoneMultiplier =
    comparable.source === 'platform_sold' && isSameMicrozoneComparable(comparable)
      ? comparable.similarityScore >= 78
        ? 1.65
        : 1.35
      : comparable.source === 'platform_sold' && comparable.similarityScore >= 82
        ? 1.2
        : 1;
  return clamp(
    similarityWeight * computeSourceWeight(comparable.source) * computeRecencyWeight(comparable.recordedAt) * soldMicrozoneMultiplier,
    0.18,
    1.95
  );
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

function createRejectedComparable(params: {
  id: string;
  source: ComparableSource;
  title?: string | null;
  locationLabel?: string | null;
  price?: number | null;
  squareFootage?: number | null;
  similarityScore?: number | null;
  reasonCode: PricingRejectedComparable['reasonCode'];
  reason: string;
  severity?: RejectionSeverity;
  url?: string | null;
}): PricingRejectedComparable {
  return {
    id: params.id,
    source: params.source,
    title: params.title || 'Comparabila fara titlu',
    locationLabel: params.locationLabel || 'Locatie necunoscuta',
    price: params.price ?? null,
    squareFootage: params.squareFootage ?? null,
    pricePerSqm: safePricePerSqm(params.price, params.squareFootage),
    similarityScore: params.similarityScore ?? null,
    reasonCode: params.reasonCode,
    reason: params.reason,
    severity: params.severity || 'info',
    url: params.url ?? null,
  };
}

function createDiagnostic(params: PricingSourceDiagnostic): PricingSourceDiagnostic {
  return params;
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
  const directMicrozoneSoldCount = soldComparables.filter(isSameMicrozoneComparable).length;

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
        ? 'Analiza combina tranzactii inchise limitate cu oferta activa si ownerListings.'
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

  const surface = Math.max(getPricingSurface(subject), 1);
  const negotiationRoomPercent = confidenceScore >= 82 ? 3.5 : confidenceScore >= 68 ? 5 : 6.5;
  const overpricedMultiplier = marketHeat === 'hot' ? 1.08 : marketHeat === 'soft' ? 1.045 : 1.06;
  const rawOverpricedThreshold = round(recommendedListingPrice * overpricedMultiplier, 0);
  const overpricedThreshold = Math.max(stretchMaxPrice, Math.min(rawOverpricedThreshold, round(stretchMaxPrice * 1.01, 0)));

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
      fast: '30 zile',
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
  subject?: PricingAnalysisSnapshot['subject'];
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
    subject: snapshot.subject,
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
  const records = await loadBacktestRecords(agencyId);
  const errorPercents = records.map((record) => record.errorPercent).filter((value) => Number.isFinite(value));
  const signedErrors = records.map((record) => record.signedErrorPercent).filter((value) => Number.isFinite(value));
  const segment = computeSegmentBacktest(records, subject);
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
      segment,
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
    segment,
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

async function loadBacktestRecords(agencyId: string) {
  const snapshot = await adminDb.collection('agencies').doc(agencyId).collection('pricingAnalysisBacktests').get();
  return snapshot.docs.map((docSnapshot) => docSnapshot.data() as PricingBacktestRecord);
}

function getPricingSegmentKey(subject: {
  propertyType?: string | null;
  rooms?: number | null;
  city?: string | null;
  zone?: string | null;
  location?: string | null;
}) {
  return [
    normalizePropertyType(subject.propertyType),
    subject.rooms ? `${subject.rooms}cam` : 'cam_unknown',
    normalizeText(subject.city || subject.location || 'unknown_city'),
    normalizeText(subject.zone || 'unknown_zone'),
  ].join('|');
}

function computeSegmentBacktest(records: PricingBacktestRecord[], subject: Property): PricingBacktestSummary['segment'] {
  const segmentKey = getPricingSegmentKey(subject);
  const fallbackCityKey = normalizeText(subject.city || subject.location || '');
  const segmentRecords = records.filter((record) => {
    const snapshotSubject = (record as PricingBacktestRecord & { subject?: PricingAnalysisSnapshot['subject'] }).subject;
    if (!snapshotSubject) return false;
    const exactKey = getPricingSegmentKey({
      propertyType: snapshotSubject.propertyType || subject.propertyType,
      rooms: snapshotSubject.rooms,
      city: snapshotSubject.city || null,
      zone: snapshotSubject.zone || null,
      location: snapshotSubject.city || '',
    });
    return exactKey === segmentKey || (fallbackCityKey && normalizeText(snapshotSubject.city) === fallbackCityKey);
  });

  const usableRecords = segmentRecords.length >= 3 ? segmentRecords : records.slice(-20);
  const errorPercents = usableRecords.map((record) => record.errorPercent).filter((value) => Number.isFinite(value));
  const signedErrors = usableRecords.map((record) => record.signedErrorPercent).filter((value) => Number.isFinite(value));
  const biasPercent = round(average(signedErrors) || 0, 2);
  const medianAbsoluteErrorPercent = errorPercents.length ? round(median(errorPercents) || 0, 2) : null;
  const calibrationFactor = clamp(1 - biasPercent / 100, 0.94, 1.06);

  return {
    key: segmentKey,
    sampleSize: usableRecords.length,
    medianAbsoluteErrorPercent,
    biasPercent: usableRecords.length ? biasPercent : null,
    calibrationFactor: usableRecords.length >= 5 ? round(calibrationFactor, 4) : 1,
    verdict:
      usableRecords.length >= 5
        ? 'Exista suficienta memorie pentru calibrare segmentata usoara.'
        : 'Memoria segmentului este inca redusa; calibrarea este prudenta.',
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
  const normalizedLocation = normalizeText(location);
  const subjectIsBucharestArea =
    normalizedContainsPhrase(subjectFeatures.sourceText, 'bucuresti') ||
    normalizedContainsPhrase(subjectFeatures.sourceText, 'sector') ||
    normalizedContainsPhrase(subjectFeatures.sourceText, 'ilfov');
  const conflictingLocalities = [
    'iasi',
    'cluj',
    'timisoara',
    'brasov',
    'constanta',
    'craiova',
    'galati',
    'braila',
    'arad',
    'oradea',
    'sibiu',
    'ploiesti',
  ];

  if (subjectIsBucharestArea && conflictingLocalities.some((city) => normalizedContainsPhrase(normalizedLocation, city))) {
    return false;
  }

  return (
    subjectFeatures.zoneTokens.some((token) => token && normalizedContainsPhrase(normalized, token)) ||
    subjectFeatures.relatedZoneTokens.some((token) => token && normalizedContainsPhrase(normalized, token)) ||
    subjectFeatures.broaderLocationTokens.some((token) => token && normalizedContainsPhrase(normalized, token))
  );
}

function getOwnerListingZoneMatchPriority(subjectFeatures: PropertyFeatures, listing: OwnerListingSummary) {
  const titleDescriptionText = [listing.title, listing.description].filter(Boolean).join(' ');
  const locationText = listing.location || listing.scopeCity || '';

  if (subjectFeatures.zoneTokens.some((token) => normalizedContainsPhrase(titleDescriptionText, token))) return 4;
  if (subjectFeatures.zoneTokens.some((token) => normalizedContainsPhrase(locationText, token))) return 3;
  if (subjectFeatures.relatedZoneTokens.some((token) => normalizedContainsPhrase(titleDescriptionText, token))) return 2;
  if (subjectFeatures.relatedZoneTokens.some((token) => normalizedContainsPhrase(locationText, token))) return 1;
  if (subjectFeatures.broaderLocationTokens.some((token) => normalizedContainsPhrase(`${titleDescriptionText} ${locationText}`, token))) return 0.5;
  return 0;
}

function tokenToLocationLabel(token: string) {
  return token
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferRoomsFromListing(value?: string | number | null) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10) return value;
  const normalized = normalizeText(String(value || ''));
  if (!normalized) return null;
  if (normalizedContainsPhrase(normalized, 'garsoniera') || normalizedContainsPhrase(normalized, 'studio')) return 1;

  const explicitRooms = normalized.match(/\b([1-9])\s*(?:camere|camera|cam[a-z]*|rooms?)\b/);
  if (explicitRooms?.[1]) {
    const parsed = Number(explicitRooms[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function hasRentalIntent(listing: OwnerListingSummary) {
  if (listing.transactionType === 'rent') return true;
  const normalized = normalizeText([listing.title, listing.description].filter(Boolean).join(' '));
  const saleHints = ['vand', 'vanzare', 'de vanzare', 'se vinde'];
  if (saleHints.some((hint) => normalizedContainsPhrase(normalized, hint))) return false;

  return [
    'inchiriez',
    'inchiriere',
    'de inchiriat',
    'chirie',
    'luna',
    'lunar',
    'rent',
  ].some((hint) => normalizedContainsPhrase(normalized, hint));
}

function hasSaleIntent(listing: OwnerListingSummary, price: number) {
  if (hasRentalIntent(listing)) return false;
  if (listing.transactionType === 'sale') return true;

  const normalized = normalizeText([listing.title, listing.description].filter(Boolean).join(' '));
  const saleHints = ['vand', 'vanzare', 'de vanzare', 'se vinde', 'apartament de vanzare'];
  if (saleHints.some((hint) => normalizedContainsPhrase(normalized, hint))) return true;

  return price >= 15000;
}

function ownerListingToPortalCandidate(
  docId: string,
  listing: OwnerListingSummary,
  subjectFeatures: PropertyFeatures
): PortalComparableCandidate | null {
  const price = parsePriceNumber(listing.price);
  const squareFootage = parseArea(listing.area);
  const rooms = inferRoomsFromListing(listing.title) ?? inferRoomsFromListing(listing.rooms) ?? parseRooms(String(listing.rooms ?? ''));
  const zoneMatchPriority = getOwnerListingZoneMatchPriority(subjectFeatures, listing);

  if (!price || !squareFootage) return null;
  if (zoneMatchPriority <= 0) return null;
  if (!hasSaleIntent(listing, price)) return null;
  if (
    listing.propertyType &&
    listing.propertyType !== 'unknown' &&
    normalizePropertyType(listing.propertyType) !== subjectFeatures.propertyType
  ) {
    return null;
  }

  return {
    id: `owner-${docId}`,
    portalName: `${listing.sourceLabel || listing.source} proprietar`,
    title: listing.title,
    address: listing.location || listing.scopeCity || '',
    imageUrl:
      listing.imageUrl ||
      listing.image ||
      ((listing as OwnerListingSummary & { images?: string[] }).images || []).find(Boolean) ||
      null,
    locationLabel: listing.location || listing.scopeCity || '',
    price,
    squareFootage,
    rooms: rooms || null,
    constructionYear:
      typeof listing.constructionYear === 'number'
        ? listing.constructionYear
        : typeof listing.year === 'number'
          ? listing.year
          : null,
    interiorState: normalizeInteriorState(undefined, [listing.title, listing.description].filter(Boolean).join(' ')),
    partitioning: normalizePartitioning(undefined, [listing.title, listing.description].filter(Boolean).join(' ')),
    parkingIncluded: detectIncludedParking([listing.title, listing.description].filter(Boolean).join(' ')),
    url: listing.link,
    zoneMatchPriority,
    lastSeenAt: listing.lastSeenAt || listing.postedAt || null,
  };
}

function evaluatePortalCandidate(
  subject: Property,
  subjectFeatures: PropertyFeatures,
  candidate: PortalComparableCandidate,
  seen: Set<string>
): { comparable: PricingComparable | null; rejection: PricingRejectedComparable | null } {
  const key = `${normalizeText(candidate.title)}|${candidate.price}|${candidate.squareFootage}`;
  if (seen.has(key)) {
    return {
      comparable: null,
      rejection: createRejectedComparable({
        id: candidate.id,
        source: 'portal_active',
        title: candidate.title,
        locationLabel: candidate.locationLabel,
        price: candidate.price,
        squareFootage: candidate.squareFootage,
        reasonCode: 'duplicate',
        reason: 'Comparabila apare duplicat in sursele externe.',
      }),
    };
  }
  seen.add(key);

  if (candidate.rooms !== null && subject.rooms && candidate.rooms !== subject.rooms) {
    return {
      comparable: null,
      rejection: createRejectedComparable({
        id: candidate.id,
        source: 'portal_active',
        title: candidate.title,
        locationLabel: candidate.locationLabel,
        price: candidate.price,
        squareFootage: candidate.squareFootage,
        reasonCode: 'room_mismatch',
        reason: 'Numarul de camere nu se potriveste cu proprietatea evaluata.',
      }),
    };
  }

  if (subject.squareFootage && Math.abs(candidate.squareFootage - subject.squareFootage) / subject.squareFootage > 0.45) {
    return {
      comparable: null,
      rejection: createRejectedComparable({
        id: candidate.id,
        source: 'portal_active',
        title: candidate.title,
        locationLabel: candidate.locationLabel,
        price: candidate.price,
        squareFootage: candidate.squareFootage,
        reasonCode: 'surface_out_of_range',
        reason: 'Suprafata este prea departe de proprietatea evaluata.',
      }),
    };
  }

  const comparable = createPricingComparable('portal_active', subject, subjectFeatures, candidate, candidate.portalName);
  if (comparable.similarityScore < 52) {
    return {
      comparable: null,
      rejection: createRejectedComparable({
        id: candidate.id,
        source: 'portal_active',
        title: candidate.title,
        locationLabel: candidate.locationLabel,
        price: candidate.price,
        squareFootage: candidate.squareFootage,
        similarityScore: comparable.similarityScore,
        reasonCode: 'weak_location_match',
        reason: 'Comparabila externa nu trece pragul de similaritate.',
      }),
    };
  }

  return { comparable, rejection: null };
}

async function fetchOwnerListingComparables(subject: Property, subjectFeatures: PropertyFeatures) {
  const lookupTokens = Array.from(
    new Set([
      ...subjectFeatures.zoneTokens,
      ...subjectFeatures.relatedZoneTokens,
    ])
  )
    .filter((token) => token.length >= 3)
    .slice(0, 80);
  const targetedSnapshots = await Promise.all(
    lookupTokens.flatMap((token) =>
      [
        adminDb
          .collection('ownerListings')
          .where('normalizedLocation', '==', token)
          .limit(120)
          .get()
          .catch(() => null),
        adminDb
          .collection('ownerListings')
          .where('location', '==', tokenToLocationLabel(token))
          .limit(120)
          .get()
          .catch(() => null),
        adminDb
          .collection('ownerListings')
          .where('scopeCity', '==', tokenToLocationLabel(token))
          .limit(120)
          .get()
          .catch(() => null),
      ]
    )
  );
  const recentSnapshot = await adminDb.collection('ownerListings').orderBy('lastSeenAt', 'desc').limit(2000).get();
  const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();

  for (const snapshot of targetedSnapshots) {
    for (const docSnapshot of snapshot?.docs || []) {
      docsById.set(docSnapshot.id, docSnapshot);
    }
  }

  for (const docSnapshot of recentSnapshot.docs) {
    docsById.set(docSnapshot.id, docSnapshot);
  }

  if (docsById.size < 2500 && subjectFeatures.broaderLocationTokens.some((token) => token === 'bucuresti')) {
    const regionalSnapshot = await adminDb
      .collection('ownerListings')
      .where('scopeKey', '==', 'bucuresti-ilfov')
      .limit(5000)
      .get()
      .catch(() => null);

    for (const docSnapshot of regionalSnapshot?.docs || []) {
      docsById.set(docSnapshot.id, docSnapshot);
    }
  }

  const candidates: PortalComparableCandidate[] = [];
  const rejected: PricingRejectedComparable[] = [];

  for (const docSnapshot of docsById.values()) {
    const listing = docSnapshot.data() as OwnerListingSummary;
    const candidate = ownerListingToPortalCandidate(docSnapshot.id, listing, subjectFeatures);
    if (!candidate) {
      rejected.push(createRejectedComparable({
        id: docSnapshot.id,
        source: 'portal_active',
        title: listing.title,
        locationLabel: listing.location || listing.scopeCity || '',
        price: parsePriceNumber(listing.price) || null,
        squareFootage: parseArea(listing.area) || null,
        reasonCode: 'missing_price_or_surface',
        reason: 'Anuntul de proprietar nu are suficiente campuri valide sau nu se potriveste cu tipul si tranzactia evaluate.',
      }));
      continue;
    }
    if (!shouldKeepPortalCandidate(subjectFeatures, `${candidate.title} ${listing.description || ''}`, candidate.locationLabel)) {
      rejected.push(createRejectedComparable({
        id: candidate.id,
        source: 'portal_active',
        title: candidate.title,
        locationLabel: candidate.locationLabel,
        price: candidate.price,
        squareFootage: candidate.squareFootage,
        reasonCode: 'weak_location_match',
        reason: 'Anuntul de proprietar nu se potriveste suficient cu microzona sau zonele adiacente.',
      }));
      continue;
    }
    candidates.push(candidate);
  }

  const sortedCandidates = candidates
    .sort((left, right) => (right.zoneMatchPriority ?? 0) - (left.zoneMatchPriority ?? 0))
    .slice(0, 250);

  return {
    candidates: sortedCandidates,
    rejected: rejected.slice(0, 40),
    diagnostics: [
      createDiagnostic({
        source: 'owner_listings',
        attempted: true,
        fetchedCount: docsById.size,
        acceptedCount: sortedCandidates.length,
        rejectedCount: rejected.length,
        status: sortedCandidates.length ? 'ok' : rejected.length ? 'partial' : 'skipped',
        message: sortedCandidates.length
          ? 'Anunturile de proprietar salvate local au fost folosite ca oferta activa externa.'
          : 'Nu exista suficiente anunturi de proprietar potrivite pentru aceasta analiza.',
      }),
    ],
  } satisfies PortalFetchResult;
}

async function fetchPortalComparables(subject: Property, subjectFeatures: PropertyFeatures) {
  const ownerListingResults = await fetchOwnerListingComparables(subject, subjectFeatures).catch((error) => ({
    candidates: [] as PortalComparableCandidate[],
    rejected: [] as PricingRejectedComparable[],
    diagnostics: [
      createDiagnostic({
        source: 'owner_listings',
        attempted: true,
        fetchedCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Nu au putut fi citite anunturile de proprietar.',
      }),
    ],
  } satisfies PortalFetchResult));

  const merged = ownerListingResults.candidates;
  const seen = new Set<string>();
  const comparables: PricingComparable[] = [];
  const rejected: PricingRejectedComparable[] = [...ownerListingResults.rejected];

  for (const candidate of merged) {
    const evaluated = evaluatePortalCandidate(subject, subjectFeatures, candidate, seen);
    if (evaluated.rejection) rejected.push(evaluated.rejection);
    if (evaluated.comparable) comparables.push(evaluated.comparable);
  }

  const accepted = comparables
    .sort(sortComparablesByRelevance)
    .slice(0, 16);

  return {
    comparables: accepted,
    rejected: rejected.slice(0, 80),
    diagnostics: ownerListingResults.diagnostics,
  };
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
  const rejected: PricingRejectedComparable[] = [];
  const seenSoldKeys = new Set<string>();

  for (const docSnapshot of archivedDocs) {
    const data = { id: docSnapshot.id, ...docSnapshot.data() } as ArchivedSoldComparable;
    if (!data.marketAnalysisEligible) continue;

    const snapshotProperty = data.propertySnapshot;
    if (!snapshotProperty) continue;
    if (snapshotProperty.id === subject.id && !isSoldStatus(subject.status)) continue;

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

    const evaluated = evaluateInternalComparable(subject, subjectFeatures, archivedCandidate);
    if (evaluated.rejection) rejected.push(evaluated.rejection);
    if (!evaluated.comparable) continue;

    soldComparables.push({
      ...evaluated.comparable,
      statusLabel: 'changedAt' in data ? 'Vandut confirmat' : 'Vandut arhivat',
    });
  }

  for (const docSnapshot of snapshot.docs) {
    const data = { id: docSnapshot.id, ...docSnapshot.data() } as InternalComparableCandidate;
    if (data.id === subject.id && !isSoldStatus(subject.status)) continue;
    if (!isSoldStatus(data.status)) continue;

    const agencyId = docSnapshot.ref.path.split('/')[1] || null;
    const dedupeKey = `${agencyId || 'unknown'}:${data.id}`;
    if (seenSoldKeys.has(dedupeKey)) continue;
    seenSoldKeys.add(dedupeKey);

    const soldCandidate: InternalComparableCandidate = {
      ...data,
      price: typeof data.soldPrice === 'number' && data.soldPrice > 0 ? data.soldPrice : data.price,
    };
    const evaluated = evaluateInternalComparable(subject, subjectFeatures, { ...soldCandidate, agencyId });
    if (evaluated.rejection) rejected.push(evaluated.rejection);
    if (!evaluated.comparable) continue;

    soldComparables.push(evaluated.comparable);
  }

  const comparables = soldComparables
    .sort(sortComparablesByRelevance)
    .slice(0, 12);

  return {
    comparables,
    rejected: rejected.slice(0, 30),
    diagnostic: createDiagnostic({
      source: 'platform_sold',
      attempted: true,
      fetchedCount: archivedDocs.length + snapshot.docs.length,
      acceptedCount: comparables.length,
      rejectedCount: rejected.length,
      status: comparables.length ? 'ok' : rejected.length ? 'partial' : 'skipped',
      message: comparables.length
        ? 'Tranzactiile vandute au fost evaluate si ponderate dupa similaritate.'
        : 'Nu au fost gasite tranzactii vandute suficient de similare.',
    }),
  } satisfies InternalComparableResult;
}

async function fetchAgencyActiveComparables(subject: Property, subjectFeatures: PropertyFeatures, agencyId: string) {
  const snapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').get();
  const results: PricingComparable[] = [];
  const rejected: PricingRejectedComparable[] = [];

  for (const docSnapshot of snapshot.docs) {
    const data = { id: docSnapshot.id, ...docSnapshot.data() } as InternalComparableCandidate;
    if (data.id === subject.id) continue;
    if (!isActiveStatus(data.status)) continue;

    const evaluated = evaluateInternalComparable(subject, subjectFeatures, { ...data, agencyId });
    if (evaluated.rejection) rejected.push(evaluated.rejection);
    if (evaluated.comparable) results.push(evaluated.comparable);
  }

  const comparables = results
    .sort(sortComparablesByRelevance)
    .slice(0, 10);

  return {
    comparables,
    rejected: rejected.slice(0, 25),
    diagnostic: createDiagnostic({
      source: 'agency_active',
      attempted: true,
      fetchedCount: snapshot.docs.length,
      acceptedCount: comparables.length,
      rejectedCount: rejected.length,
      status: comparables.length ? 'ok' : 'partial',
      message: comparables.length
        ? 'Oferta activa din agentie a fost folosita ca reper secundar.'
        : 'Portofoliul activ nu contine suficiente comparabile directe.',
    }),
  } satisfies InternalComparableResult;
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
  const knownParkingComparables = referencePool.filter((item) => item.parkingIncluded !== null && item.parkingIncluded !== undefined);
  const parkingIncludedRate =
    knownParkingComparables.length > 0
      ? knownParkingComparables.filter((item) => item.parkingIncluded === true).length / knownParkingComparables.length
      : null;

  const adjustments: Array<{
    label: string;
    reason: string;
    pct: number;
    direction: 'positive' | 'negative' | 'neutral';
    appliesToPricing?: boolean;
  }> = [];

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

  const balconySurface = getBalconySurface(subject);
  const pricingSurface = getPricingSurface(subject);
  if (balconySurface > 0 && pricingSurface > 0) {
    adjustments.push({
      label: 'Balcon / terasa',
      reason: `Balconul/terasa de ${balconySurface.toLocaleString('ro-RO')} mp este inclusa in valoare cu pondere de 50% fata de suprafata utila.`,
      pct: clamp((balconySurface * 0.5) / pricingSurface, 0.005, 0.05),
      direction: 'positive',
      appliesToPricing: false,
    });
  }

  if (subjectFeatures.hasIncludedParking === true) {
    adjustments.push({
      label: 'Parcare inclusa',
      reason: 'Parcarea inclusa adauga valoare, dar ajustarea este moderata pentru ca o parte din comparabile pot include deja acelasi beneficiu.',
      pct: 0.05,
      direction: 'positive',
    });
  } else if (subjectFeatures.hasIncludedParking === false && parkingIncludedRate !== null && parkingIncludedRate >= 0.55) {
    adjustments.push({
      label: 'Parcare neinclusa',
      reason: 'Majoritatea comparabilelor clare par sa includa parcare, deci benchmarkul este corectat prudent in jos.',
      pct: -0.025,
      direction: 'negative',
    });
  }

  if (typeof subject.constructionYear === 'number' && subject.constructionYear >= 2000) {
    const pct = averageYear === null ? 0.03 : averageYear < 2000 ? 0.04 : 0.025;
    adjustments.push({
      label: 'Bloc nou / dupa 2000',
      reason:
        averageYear === null
          ? 'Anul de constructie dupa 2000 este tratat ca avantaj explicit, chiar daca lipsesc anii pentru o parte din comparabile.'
          : averageYear < 2000
            ? 'Constructia dupa 2000 este net superioara generatiei medii a comparabilelor.'
            : 'Constructia dupa 2000 ramane avantaj comercial, dar efectul este moderat fiindca multe comparabile sunt din generatie apropiata.',
      pct,
      direction: 'positive',
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

  if (typeof subject.constructionYear === 'number' && subject.constructionYear < 1977) {
    adjustments.push({
      label: 'Constructie inainte de 1977',
      reason: 'Anul pre-1977 este un factor major de risc perceput si reduce baza de cumparatori eligibili, mai ales pentru finantare bancara.',
      pct: -0.085,
      direction: 'negative',
    });
  }

  if (subject.bathrooms >= 2 && subject.bathrooms > averageBathrooms + 0.4) {
    adjustments.push({
      label: 'Baie suplimentara',
      reason: 'Numarul de bai este peste media comparabilelor directe.',
      pct: 0.015,
      direction: 'positive',
    });
  }

  if (typeof subject.constructionYear === 'number' && typeof averageYear === 'number') {
    if (subject.constructionYear < 1977) {
      // Penalizarea pre-1977 este tratata separat, fiind mult mai importanta decat diferenta liniara de vechime.
    } else if (subject.constructionYear >= 2000) {
      // Proprietatile dupa 2000 au ajustare dedicata, ca sa fie vizibila consecvent in analiza.
    } else if (subject.constructionYear - averageYear >= 10) {
      adjustments.push({
        label: 'An de constructie superior',
        reason: 'Diferenta de generatie a blocului este relevanta pentru cumparatori.',
        pct: subject.constructionYear >= 2000 ? 0.04 : 0.02,
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

  return adjustments.slice(0, 6);
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
    portalBenchmarkPricePerSqm ? `ownerListings ~${portalBenchmarkPricePerSqm} EUR/mp` : null,
  ].filter(Boolean);

  return `Pretul recomandat de listare pentru ${subject.title} este ${recommendedListingPrice.toLocaleString('ro-RO')} EUR (${recommendedListingPricePerSqm.toLocaleString('ro-RO')} EUR/mp). Algoritmul foloseste comparabile pe microzona, camere, suprafata, stare, etaj si vechime, plus ${portalCount} comparabile active din ownerListings; ${heatText}. Nivelul de incredere este ${confidenceScore} / 100, iar reperele dominante sunt ${anchors.join(', ')}.`;
}

function buildRiskFlags(params: {
  confidenceScore: number;
  dataQuality: PricingDataQuality;
  marketEvidence: PricingMarketEvidence;
  rejectedComparables: PricingRejectedComparable[];
  diagnostics: PricingSourceDiagnostic[];
  backtest: PricingBacktestSummary;
  subject: Property;
}) {
  const flags: PricingAnalysisResult['riskFlags'] = [];

  if (typeof params.subject.constructionYear === 'number' && params.subject.constructionYear < 1977) {
    flags.push({
      severity: 'critical',
      label: 'Constructie pre-1977',
      reason: 'Anul constructiei este inainte de 1977; evaluarea aplica penalizare dedicata si comparabilele din aceeasi generatie devin mult mai relevante.',
    });
  }

  if (params.marketEvidence.tier === 'weak') {
    flags.push({
      severity: 'critical',
      label: 'Evidenta slaba',
      reason: 'Sunt prea putine comparabile solide pentru o recomandare agresiva.',
    });
  } else if (params.marketEvidence.tier === 'listing_led') {
    flags.push({
      severity: 'warning',
      label: 'Condusa de oferte active',
      reason: 'Analiza se bazeaza mai mult pe preturi cerute din active si ownerListings decat pe tranzactii inchise.',
    });
  }

  if (params.dataQuality.level === 'low') {
    flags.push({
      severity: 'critical',
      label: 'Date incomplete',
      reason: `Lipsesc campuri importante: ${params.dataQuality.missingFields.slice(0, 4).join(', ')}.`,
    });
  }

  if (params.diagnostics.some((diagnostic) => diagnostic.status === 'failed')) {
    flags.push({
      severity: 'warning',
      label: 'ownerListings indisponibil',
      reason: 'Colectia ownerListings nu a putut fi citita in aceasta rulare.',
    });
  }

  if (params.backtest.segment?.sampleSize && params.backtest.segment.sampleSize >= 5 && Math.abs(params.backtest.segment.biasPercent || 0) > 7) {
    flags.push({
      severity: 'warning',
      label: 'Bias istoric detectat',
      reason: 'Memoria istorica arata o abatere sistematica pe segment; pretul a fost calibrat prudent.',
    });
  }

  const severeRejections = params.rejectedComparables.filter((item) => item.severity !== 'info').length;
  if (severeRejections >= 8) {
    flags.push({
      severity: 'warning',
      label: 'Multe comparabile respinse',
      reason: 'Selectia a eliminat multe anunturi incomplete sau slab potrivite; verifica microzona si datele proprietatii.',
    });
  }

  if (!flags.length && params.confidenceScore >= 82) {
    flags.push({
      severity: 'info',
      label: 'Risc controlat',
      reason: 'Dovezile si calitatea datelor sustin o recomandare comerciala robusta.',
    });
  }

  return flags.slice(0, 5);
}

export async function generatePricingAnalysis(params: {
  agencyId: string;
  propertyId: string;
  persist?: boolean;
}) {
  const { agencyId, propertyId, persist = true } = params;
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

  const balconySurface = getBalconySurface(subject);
  const pricingSurface = getPricingSurface(subject);
  const subjectFeatures = extractPropertyFeatures(subject);
  const dataQuality = buildDataQuality(subject, subjectFeatures);

  const [soldResult, activeResult, portalResult, historicalBacktests] = await Promise.all([
    fetchPlatformSoldComparables(subject, subjectFeatures),
    fetchAgencyActiveComparables(subject, subjectFeatures, agencyId),
    fetchPortalComparables(subject, subjectFeatures),
    loadBacktestRecords(agencyId).catch(() => [] as PricingBacktestRecord[]),
  ]);
  const soldComparables = soldResult.comparables;
  const activeComparables = activeResult.comparables;
  const portalComparables = portalResult.comparables;
  const preliminarySegmentBacktest = computeSegmentBacktest(historicalBacktests, subject);
  const marketEvidence = computeMarketEvidence({ soldComparables, activeComparables, portalComparables });

  const soldBenchmarkPricePerSqm = computeWeightedBenchmark(soldComparables, 1);
  const activeBenchmarkPricePerSqm = computeWeightedBenchmark(activeComparables, ACTIVE_ASK_TO_SALE_DISCOUNT);
  const portalBenchmarkPricePerSqm = computeWeightedBenchmark(portalComparables, ACTIVE_ASK_TO_SALE_DISCOUNT);

  const anchors = [
    soldBenchmarkPricePerSqm,
    activeBenchmarkPricePerSqm,
    portalBenchmarkPricePerSqm,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (!anchors.length) {
    throw new Error('Nu exista suficiente comparabile pentru analiza acestei proprietati.');
  }

  let baselinePricePerSqm = 0;
  let baselineSourceMix = {
    soldWeight: 0,
    activeWeight: 0,
    portalWeight: 0,
  };
  if (soldBenchmarkPricePerSqm !== null) {
    const directSoldWeight =
      marketEvidence.directMicrozoneSoldCount >= 1 ? 0.78 : 0.64;
    const activeWeight = marketEvidence.directMicrozoneSoldCount >= 1 ? 0.08 : 0.14;
    const ownerListingsWeight = 1 - directSoldWeight - activeWeight;
    baselineSourceMix = {
      soldWeight: round(directSoldWeight * 100, 0),
      activeWeight: round(activeWeight * 100, 0),
      portalWeight: round(ownerListingsWeight * 100, 0),
    };
    baselinePricePerSqm =
      soldBenchmarkPricePerSqm * directSoldWeight +
      (activeBenchmarkPricePerSqm ?? soldBenchmarkPricePerSqm) * activeWeight +
      (portalBenchmarkPricePerSqm ?? soldBenchmarkPricePerSqm) * ownerListingsWeight;
  } else {
    baselineSourceMix = {
      soldWeight: 0,
      activeWeight: activeBenchmarkPricePerSqm ? (portalBenchmarkPricePerSqm ? 45 : 100) : 0,
      portalWeight: portalBenchmarkPricePerSqm ? (activeBenchmarkPricePerSqm ? 55 : 100) : 0,
    };
    baselinePricePerSqm =
      (activeBenchmarkPricePerSqm ?? portalBenchmarkPricePerSqm ?? anchors[0]) * 0.45 +
      (portalBenchmarkPricePerSqm ?? activeBenchmarkPricePerSqm ?? anchors[0]) * 0.55;
  }
  marketEvidence.sourceMix = baselineSourceMix;

  const referencePool = [
    ...soldComparables.slice(0, 5),
    ...activeComparables.slice(0, 3),
    ...portalComparables.slice(0, 4),
  ];
  const rawAdjustments = computeAdjustmentSet(subject, subjectFeatures, referencePool);
  const totalAdjustmentPct = clamp(
    rawAdjustments.reduce((sum, item) => sum + (item.appliesToPricing === false ? 0 : item.pct), 0),
    -0.1,
    0.11
  );
  const anchorMedian = median(anchors) || baselinePricePerSqm;
  const strongestBenchmarkPricePerSqm = maxFinite([
    soldBenchmarkPricePerSqm,
    activeBenchmarkPricePerSqm,
    portalBenchmarkPricePerSqm,
  ]) || anchorMedian;
  const minimumStretchGap =
    marketEvidence.tier === 'transaction_led' ? 0.075 : marketEvidence.tier === 'hybrid' ? 0.07 : 0.08;
  const recommendationPremium =
    marketEvidence.tier === 'transaction_led' ? 0.012 : marketEvidence.tier === 'hybrid' ? 0 : -0.015;
  const stretchPremium =
    marketEvidence.tier === 'transaction_led' && portalBenchmarkPricePerSqm && soldBenchmarkPricePerSqm && portalBenchmarkPricePerSqm > soldBenchmarkPricePerSqm * 1.06
      ? 0.05
      : marketEvidence.tier === 'transaction_led'
        ? 0.04
        : marketEvidence.tier === 'hybrid'
          ? 0.03
          : 0.015;
  const stretchCeil = strongestBenchmarkPricePerSqm * (1 + stretchPremium);
  const recommendationCeil = Math.min(
    strongestBenchmarkPricePerSqm * (1 + recommendationPremium),
    stretchCeil / (1 + minimumStretchGap)
  );

  let benchmarkRecommendedPricePerSqm = baselinePricePerSqm * (1 + totalAdjustmentPct) * (preliminarySegmentBacktest?.calibrationFactor || 1);
  const sanityFloor = anchorMedian * (soldComparables.length > 0 ? 0.84 : 0.9);
  const sanityCeil = Math.min(anchorMedian * 1.1, recommendationCeil);
  benchmarkRecommendedPricePerSqm = clamp(benchmarkRecommendedPricePerSqm, sanityFloor, sanityCeil);
  benchmarkRecommendedPricePerSqm = round(benchmarkRecommendedPricePerSqm, 0);

  const benchmarkRecommendedPrice = round(benchmarkRecommendedPricePerSqm * pricingSurface, 0);
  const adjustments: PricingAdjustment[] = rawAdjustments.map((item) => {
    const impactPerSqm = round(anchorMedian * item.pct, 0);
    return {
      label: item.label,
      direction: item.direction,
      impactPerSqm,
      impactTotal: round(impactPerSqm * pricingSurface, 0),
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
  const conservativeMinPrice = round(benchmarkRecommendedPrice * (1 - spread), 0);
  const recommendedListingPrice = round(conservativeMinPrice * 1.07, 0);
  const recommendedListingPricePerSqm = round(recommendedListingPrice / pricingSurface, 0);
  const rawStretchMaxPrice = recommendedListingPrice * (1 + spread);
  const stretchMaxPrice = Math.max(
    recommendedListingPrice,
    round(Math.min(rawStretchMaxPrice, stretchCeil * pricingSurface), 0)
  );

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
      ? 'Nu exista inca tranzactii Vandut suficient de similare pentru aceasta microzona; recomandarea foloseste oferte active si ownerListings, cu incredere plafonata.'
      : null,
    soldComparables.length > 0 && soldComparables.length < 3
      ? 'Esantionul de tranzactii Vandut este inca redus; intervalul tactic trebuie tratat ca plaja de calibrare, nu ca evaluare bancara.'
      : null,
    marketEvidence.directMicrozoneSoldCount > 0
      ? 'Tranzactiile Vandut din aceeasi microzona au prioritate ridicata in benchmark fata de ofertele active si ownerListings.'
      : null,
    'Comparabilele din ownerListings sunt preturi active de listare, nu preturi finale de tranzactionare.',
    balconySurface > 0
      ? `Suprafata balconului/terasei (${balconySurface.toLocaleString('ro-RO')} mp) este inclusa in valoarea totala cu pondere de 50% fata de suprafata utila.`
      : null,
    'Pretul recomandat este calculat ca limita minima plus 7%, pentru o relatie comerciala clara intre vanzare rapida si listare recomandata.',
    'Pretul recomandat este tinut sub limita maxima tactica; daca benchmarkurile nu sustin o plaja reala, algoritmul coboara recomandarea in loc sa umfle maximul.',
    'Scorul final ramane dependent de calitatea datelor din proprietate: zona, suprafata, etaj, stare si anul constructiei.',
  ].filter((item): item is string => Boolean(item));
  const generatedAt = new Date().toISOString();

  const backtest = await buildBacktestSummary(agencyId, subject).catch((error) => {
    console.warn('Pricing backtest summary failed:', error);
    return {
      available: false,
      sampleSize: 0,
      meanAbsoluteErrorPercent: null,
      medianAbsoluteErrorPercent: null,
      biasPercent: null,
      verdict: 'Backtesting-ul nu a putut fi calculat pentru aceasta rulare.',
      segment: preliminarySegmentBacktest,
      latestBacktest: null,
    } satisfies PricingBacktestSummary;
  });
  const sourceDiagnostics: PricingSourceDiagnostic[] = [
    soldResult.diagnostic,
    activeResult.diagnostic,
    ...portalResult.diagnostics,
  ];
  const rejectedComparables = [
    ...soldResult.rejected,
    ...activeResult.rejected,
    ...portalResult.rejected,
  ].slice(0, 100);

  const analysis = {
    generatedAt,
    subject: {
      id: subject.id,
      title: subject.title,
      address: subject.address,
      city: subject.city || null,
      zone: subject.zone || null,
      propertyType: subject.propertyType || null,
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
      portalIndexPricePerSqm: null,
    },
    limitations,
    dataQuality,
    marketEvidence,
    pricingStrategy,
    backtest,
    sourceDiagnostics,
    rejectedComparables,
    riskFlags: buildRiskFlags({
      confidenceScore,
      dataQuality,
      marketEvidence,
      rejectedComparables,
      diagnostics: sourceDiagnostics,
      backtest,
      subject,
    }),
  } satisfies PricingAnalysisResult;

  if (persist) {
    void Promise.all([
      persistPricingAnalysisSnapshot(agencyId, analysis),
      reconcileAgencyBacktests(agencyId),
    ]).catch((error) => {
      console.warn('Pricing analysis background persistence failed:', error);
    });
  }

  return analysis;
}
