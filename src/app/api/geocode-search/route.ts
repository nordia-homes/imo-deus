import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
};

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
};

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    county?: string;
    district?: string;
    suburb?: string;
    state?: string;
    country?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

type AddressSuggestion = {
  label: string;
  addressLine: string;
  city?: string;
  zone?: string;
  latitude: number;
  longitude: number;
};

const ADDRESS_PREFIX_EXPANSIONS: Array<[RegExp, string]> = [
  [/^\s*str\.?\s+/i, 'Strada '],
  [/^\s*bd\.?\s+/i, 'Bulevardul '],
  [/^\s*b-dul\.?\s+/i, 'Bulevardul '],
  [/^\s*sos\.?\s+/i, 'Soseaua '],
  [/^\s*calea\s+/i, 'Calea '],
  [/^\s*aleea\s+/i, 'Aleea '],
  [/^\s*intr\.?\s+/i, 'Intrarea '],
  [/^\s*piata\s+/i, 'Piata '],
  [/^\s*splai\.?\s+/i, 'Splaiul '],
];

function normalizeAddressInput(address?: string | null) {
  const raw = (address || '').trim();
  if (!raw) return '';

  return ADDRESS_PREFIX_EXPANSIONS.reduce((current, [pattern, replacement]) => {
    if (pattern.test(current)) {
      return current.replace(pattern, replacement);
    }
    return current;
  }, raw).replace(/\s+/g, ' ');
}

function cityAliases(city?: string | null) {
  const cleaned = (city || '').trim();
  if (!cleaned) return [];
  if (cleaned === 'Bucuresti-Ilfov') {
    return ['Bucuresti', 'Ilfov', 'Bucuresti, Romania', 'Ilfov, Romania'];
  }
  return [cleaned];
}

function buildStreetVariants(address?: string | null) {
  const normalized = normalizeAddressInput(address);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);
  const shorter = normalized.replace(/\s+bl\.?.*$/i, '').replace(/\s+sc\.?.*$/i, '').replace(/\s+ap\.?.*$/i, '').trim();
  if (shorter && shorter !== normalized) {
    variants.add(shorter);
  }

  if (!/^strada\s/i.test(normalized) && !/^bulevardul\s/i.test(normalized) && !/^soseaua\s/i.test(normalized) && !/^calea\s/i.test(normalized)) {
    variants.add(`Strada ${normalized}`);
  }

  return Array.from(variants);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function buildQueries(address?: string | null, zone?: string | null, city?: string | null) {
  const streetVariants = buildStreetVariants(address);
  const zoneValue = (zone || '').trim();
  const cities = cityAliases(city);
  const queries = new Set<string>();

  for (const street of streetVariants) {
    for (const cityVariant of cities.length ? cities : ['']) {
      queries.add([street, zoneValue, cityVariant, 'Romania'].filter(Boolean).join(', '));
      queries.add([street, cityVariant, 'Romania'].filter(Boolean).join(', '));
      if (zoneValue) {
        queries.add([street, zoneValue, 'Romania'].filter(Boolean).join(', '));
      }
    }

    queries.add([street, 'Romania'].filter(Boolean).join(', '));
  }

  return Array.from(queries).filter((query) => query.length >= 6);
}

function pickSuggestionZone(address?: NominatimAddress | null) {
  return (
    address?.suburb ||
    address?.neighbourhood ||
    address?.quarter ||
    address?.city_district ||
    address?.state_district ||
    ''
  );
}

function pickSuggestionCity(address?: NominatimAddress | null) {
  return (
    address?.city ||
    address?.town ||
    address?.village ||
    address?.municipality ||
    address?.county ||
    ''
  );
}

function pickAddressLine(address?: NominatimAddress | null, fallbackLabel?: string) {
  const street = address?.road || address?.pedestrian || address?.footway || '';
  const houseNumber = address?.house_number || '';
  const line = [street, houseNumber].filter(Boolean).join(' ').trim();
  if (line) return line;
  return fallbackLabel || '';
}

function buildReadableLabel(addressLine: string, zone?: string, city?: string, fallbackLabel?: string) {
  const compact = [addressLine, zone, city, 'Romania'].filter(Boolean).join(', ').trim();
  return compact || fallbackLabel || '';
}

async function fetchNominatimSuggestions(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '8');
  url.searchParams.set('countrycodes', 'ro');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ImoDeus.ai/1.0 (property address search)',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const results = (await response.json()) as NominatimResult[];
  return results
    .filter((item) => item.display_name && item.lat && item.lon)
    .map((item) => {
      const city = pickSuggestionCity(item.address);
      const zone = pickSuggestionZone(item.address);
      const addressLine = pickAddressLine(item.address, item.display_name);

      return {
        label: buildReadableLabel(addressLine, zone, city, item.display_name),
        addressLine,
        city,
        zone,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      };
    });
}

async function fetchPhotonSuggestions(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'ro');
  url.searchParams.set('limit', '8');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ImoDeus.ai/1.0 (property address search fallback)',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { features?: PhotonFeature[] };
  const features = payload.features || [];

  return features
    .filter((feature) => feature.geometry?.coordinates?.length === 2)
    .map((feature) => {
      const props = feature.properties || {};
      const addressLine = [props.street || props.name, props.housenumber].filter(Boolean).join(' ').trim() || props.name || '';
      const city = props.city || props.county || '';
      const zone = props.suburb || props.district || '';

      return {
        label: buildReadableLabel(addressLine, zone, city, props.name),
        addressLine,
        city,
        zone,
        latitude: Number(feature.geometry!.coordinates![1]),
        longitude: Number(feature.geometry!.coordinates![0]),
      };
    });
}

function dedupeSuggestions(suggestions: AddressSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.latitude.toFixed(6)}-${suggestion.longitude.toFixed(6)}-${suggestion.addressLine.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const zone = searchParams.get('zone');
  const city = searchParams.get('city');

  const queries = unique(buildQueries(address, zone, city)).slice(0, 6);
  if (queries.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const nominatimResults = await Promise.all(queries.map((query) => fetchNominatimSuggestions(query)));
    let suggestions = dedupeSuggestions(nominatimResults.flat());

    if (suggestions.length < 6) {
      const photonResults = await Promise.all(queries.slice(0, 3).map((query) => fetchPhotonSuggestions(query)));
      suggestions = dedupeSuggestions([...suggestions, ...photonResults.flat()]);
    }

    return NextResponse.json({
      suggestions: suggestions.slice(0, 10),
    });
  } catch (error) {
    console.error('Address search failed:', error);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
