import type { Property } from '@/lib/types';

export type NearbyObjectiveKind = 'metro' | 'bus' | 'tram' | 'school' | 'kindergarten' | 'grocery';

export type NearbyObjective = {
  kind: NearbyObjectiveKind;
  label: string;
  name: string;
  address?: string | null;
  walkingMinutes: number;
  walkingText: string;
  mapsUrl?: string | null;
};

type NearbySearchPlace = {
  name?: string;
  place_id?: string;
  vicinity?: string;
  formatted_address?: string;
  types?: string[];
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type NearbySearchResponse = {
  status?: string;
  results?: NearbySearchPlace[];
};

type DistanceMatrixResponse = {
  status?: string;
  rows?: Array<{
    elements?: Array<{
      status?: string;
      duration?: {
        text?: string;
        value?: number;
      };
      distance?: {
        text?: string;
        value?: number;
      };
    }>;
  }>;
};

type ObjectiveConfig = {
  kind: NearbyObjectiveKind;
  label: string;
  type?: string;
  keyword?: string;
  textQueries: string[];
  radius: number;
};

const METRO_CONFIG: ObjectiveConfig = {
  kind: 'metro',
  label: 'Cea mai apropiata statie de metrou',
  type: 'subway_station',
  keyword: 'metrou metro subway',
  textQueries: ['statie de metrou', 'metrou', 'metro station'],
  radius: 3500,
};

const BUS_CONFIG: ObjectiveConfig = {
  kind: 'bus',
  label: 'Cea mai apropiata statie de autobuz',
  type: 'transit_station',
  keyword: 'autobuz STB bus stop statie',
  textQueries: ['statie de autobuz', 'statie STB autobuz', 'bus stop'],
  radius: 2500,
};

const TRAM_CONFIG: ObjectiveConfig = {
  kind: 'tram',
  label: 'Cea mai apropiata statie de tramvai',
  type: 'transit_station',
  keyword: 'tramvai STB tram stop statie',
  textQueries: ['statie de tramvai', 'statie STB tramvai', 'tram stop'],
  radius: 2500,
};

const REQUIRED_OBJECTIVES: ObjectiveConfig[] = [
  {
    kind: 'kindergarten',
    label: 'Cea mai apropiata gradinita',
    type: 'school',
    keyword: 'gradinita cresa preschool kindergarten',
    textQueries: ['gradinita', 'cresa', 'kindergarten', 'preschool'],
    radius: 3000,
  },
  {
    kind: 'school',
    label: 'Cea mai apropiata scoala',
    type: 'school',
    keyword: 'scoala gimnaziala middle school liceu',
    textQueries: ['scoala gimnaziala', 'scoala', 'middle school', 'liceu'],
    radius: 3000,
  },
  {
    kind: 'grocery',
    label: 'Cel mai apropiat magazin alimentar',
    type: 'grocery_or_supermarket',
    keyword: 'Mega Image Shop&Go Kaufland Penny Lidl Aldi Froo Profi Carrefour supermarket magazin alimentar',
    textQueries: ['magazin alimentar', 'supermarket', 'Mega Image', 'Shop&Go', 'Kaufland Penny Lidl Aldi Froo Profi Carrefour'],
    radius: 2200,
  },
];

function readGoogleMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_STATIC_API_KEY ||
    ''
  ).trim();
}

function getPropertyOrigin(property: Property) {
  if (typeof property.latitude === 'number' && typeof property.longitude === 'number') {
    return {
      origin: `${property.latitude},${property.longitude}`,
      location: `${property.latitude},${property.longitude}`,
      textBias: [property.address, property.zone, property.city || property.location, 'Romania'].filter(Boolean).join(', '),
    };
  }

  const query = [property.address, property.zone, property.city || property.location, 'Romania']
    .filter(Boolean)
    .join(', ');

  return query ? { origin: query, location: query, textBias: query } : null;
}

async function nearbySearch(params: {
  apiKey: string;
  location: string;
  config: ObjectiveConfig;
}) {
  const { apiKey, location, config } = params;
  const search = new URLSearchParams({
    location,
    radius: String(config.radius),
    language: 'ro',
    key: apiKey,
  });

  if (config.type) search.set('type', config.type);
  if (config.keyword) search.set('keyword', config.keyword);

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${search.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as NearbySearchResponse;
  if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') return [];

  return (payload.results || [])
    .filter((place) => place.place_id && place.name)
    .slice(0, 10);
}

async function textSearch(params: {
  apiKey: string;
  location: string;
  textBias: string;
  config: ObjectiveConfig;
}) {
  const { apiKey, location, textBias, config } = params;
  const responses = await Promise.all(
    config.textQueries.map(async (query) => {
      const search = new URLSearchParams({
        query,
        location,
        radius: String(config.radius),
        language: 'ro',
        region: 'ro',
        key: apiKey,
      });

      const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${search.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) return [] as NearbySearchPlace[];

      const payload = (await response.json()) as NearbySearchResponse;
      if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') return [] as NearbySearchPlace[];

      const results = (payload.results || []).filter((place) => place.place_id && place.name).slice(0, 8);
      if (results.length) return results;

      const fallback = new URLSearchParams({
        query: `${query} ${textBias}`,
        language: 'ro',
        region: 'ro',
        key: apiKey,
      });
      const fallbackResponse = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${fallback.toString()}`, {
        cache: 'no-store',
      });
      if (!fallbackResponse.ok) return [] as NearbySearchPlace[];
      const fallbackPayload = (await fallbackResponse.json()) as NearbySearchResponse;
      if (fallbackPayload.status !== 'OK' && fallbackPayload.status !== 'ZERO_RESULTS') return [] as NearbySearchPlace[];
      return (fallbackPayload.results || []).filter((place) => place.place_id && place.name).slice(0, 8);
    })
  );

  return responses.flat();
}

async function findPlaces(params: {
  apiKey: string;
  location: string;
  textBias: string;
  config: ObjectiveConfig;
}) {
  const [nearby, text] = await Promise.all([
    nearbySearch(params),
    textSearch(params),
  ]);

  const byPlaceId = new Map<string, NearbySearchPlace>();
  [...nearby, ...text].forEach((place) => {
    if (place.place_id && !byPlaceId.has(place.place_id)) {
      byPlaceId.set(place.place_id, place);
    }
  });

  return Array.from(byPlaceId.values()).slice(0, 18);
}

async function walkingDurations(params: {
  apiKey: string;
  origin: string;
  places: NearbySearchPlace[];
}) {
  const { apiKey, origin, places } = params;
  const destinationPlaceIds = places
    .map((place) => place.place_id)
    .filter((placeId): placeId is string => Boolean(placeId));

  if (!destinationPlaceIds.length) return [];

  const search = new URLSearchParams({
    origins: origin,
    destinations: destinationPlaceIds.map((placeId) => `place_id:${placeId}`).join('|'),
    mode: 'walking',
    language: 'ro',
    units: 'metric',
    key: apiKey,
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${search.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as DistanceMatrixResponse;
  if (payload.status !== 'OK') return [];

  return payload.rows?.[0]?.elements || [];
}

function formatWalkingText(minutes: number) {
  return `${minutes} ${minutes === 1 ? 'minut' : 'minute'} pe jos`;
}

function isRelevantPlace(config: ObjectiveConfig, place: NearbySearchPlace) {
  const name = (place.name || '').toLowerCase();
  const address = (place.vicinity || place.formatted_address || '').toLowerCase();
  const types = (place.types || []).join(' ').toLowerCase();
  const text = `${name} ${address}`;

  if (config.kind === 'bus') {
    return types.includes('transit_station') || /(stb|autobuz|bus|troleibuz|sta[tț]ie|station)/i.test(text);
  }

  if (config.kind === 'metro') {
    return types.includes('subway_station') || /(metrou|metro|subway)/i.test(text);
  }

  if (config.kind === 'tram') {
    return types.includes('transit_station') || /(stb|tramvai|tram|sta[tț]ie|station)/i.test(text);
  }

  if (config.kind === 'kindergarten') {
    return /(gr[aă]dini[tț][aă]|cresa|cre[sș][aă]|kindergarten|preschool)/i.test(text);
  }

  if (config.kind === 'school') {
    return types.includes('school') || /(scoala|[sș]coal[aă]|liceu|colegiu|gimnazial[aă]|middle school|school)/i.test(text);
  }

  if (config.kind === 'grocery') {
    return types.includes('grocery_or_supermarket') || /(mega image|shop&go|shop & go|kaufland|penny|lidl|aldi|froo|supermarket|market|alimentar|profi|carrefour|auchan)/i.test(text);
  }

  return true;
}

async function resolveObjective(params: {
  apiKey: string;
  property: Property;
  origin: string;
  location: string;
  textBias: string;
  config: ObjectiveConfig;
}): Promise<NearbyObjective | null> {
  const { apiKey, property, origin, location, textBias, config } = params;
  const places = await findPlaces({ apiKey, location, textBias, config });
  if (!places.length) return null;

  const relevantPlaces = places.filter((place) => isRelevantPlace(config, place));
  if (!relevantPlaces.length) return null;

  const elements = await walkingDurations({ apiKey, origin, places: relevantPlaces });
  const candidates = relevantPlaces
    .map((place, index) => {
      const element = elements[index];
      if (element?.status !== 'OK' || !element.duration?.value) return null;
      return {
        place,
        durationSeconds: element.duration.value,
      };
    })
    .filter((item): item is { place: NearbySearchPlace; durationSeconds: number } => Boolean(item))
    .sort((left, right) => left.durationSeconds - right.durationSeconds);

  const closest = candidates[0];
  if (!closest?.place.name) return null;

  const minutes = Math.max(1, Math.round(closest.durationSeconds / 60));
  const mapsQuery =
    closest.place.place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(closest.place.name)}&query_place_id=${encodeURIComponent(closest.place.place_id)}`
      : null;

  return {
    kind: config.kind,
    label: config.label,
    name: closest.place.name,
    address: closest.place.vicinity || closest.place.formatted_address || property.location || null,
    walkingMinutes: minutes,
    walkingText: formatWalkingText(minutes),
    mapsUrl: mapsQuery,
  };
}

export async function getNearbyObjectivesForProperty(property: Property): Promise<NearbyObjective[]> {
  const apiKey = readGoogleMapsApiKey();
  const originData = getPropertyOrigin(property);

  if (!apiKey || !originData) return [];

  const resolve = (config: ObjectiveConfig) =>
    resolveObjective({
      apiKey,
      property,
      origin: originData.origin,
      location: originData.location,
      textBias: originData.textBias,
      config,
    }).catch(() => null);

  const [metro, bus, tram, ...required] = await Promise.all([
    resolve(METRO_CONFIG),
    resolve(BUS_CONFIG),
    resolve(TRAM_CONFIG),
    ...REQUIRED_OBJECTIVES.map(resolve),
  ]);

  const surfaceTransit = [bus, tram]
    .filter((item): item is NearbyObjective => Boolean(item))
    .sort((left, right) => left.walkingMinutes - right.walkingMinutes)[0] || null;

  const ordered: Array<NearbyObjective | null> = [
    metro && metro.walkingMinutes <= 25 ? metro : null,
    surfaceTransit,
    ...required,
  ];

  return ordered.filter((item): item is NearbyObjective => Boolean(item));
}
