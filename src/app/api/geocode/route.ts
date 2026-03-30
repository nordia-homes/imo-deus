import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function normalizeAddressInput(address?: string | null) {
  return (address || '')
    .trim()
    .replace(/^\s*str\.?\s+/i, 'Strada ')
    .replace(/^\s*bd\.?\s+/i, 'Bulevardul ')
    .replace(/^\s*b-dul\.?\s+/i, 'Bulevardul ')
    .replace(/^\s*sos\.?\s+/i, 'Soseaua ')
    .replace(/\s+/g, ' ');
}

function cityAliases(city?: string | null) {
  const cleaned = (city || '').trim();
  if (!cleaned) return [];
  if (cleaned === 'Bucuresti-Ilfov') {
    return ['Bucuresti', 'Ilfov'];
  }
  return [cleaned];
}

function buildQueries(address?: string | null, zone?: string | null, city?: string | null) {
  const normalizedAddress = normalizeAddressInput(address);
  const normalizedZone = (zone || '').trim();
  const cities = cityAliases(city);
  const queries = new Set<string>();

  for (const currentCity of cities.length ? cities : ['']) {
    queries.add([normalizedAddress, normalizedZone, currentCity, 'Romania'].filter(Boolean).join(', '));
    queries.add([normalizedAddress, currentCity, 'Romania'].filter(Boolean).join(', '));
    queries.add([normalizedAddress, normalizedZone, 'Romania'].filter(Boolean).join(', '));
  }

  queries.add([normalizedAddress, 'Romania'].filter(Boolean).join(', '));

  return Array.from(queries).filter((query) => query.length >= 6);
}

async function geocodeViaNominatim(query: string) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ro');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ImoDeus.ai/1.0 (property geocoding)',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const first = results?.[0];
  if (!first?.lat || !first?.lon) {
    return null;
  }

  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };
}

async function geocodeViaPhoton(query: string) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'ro');
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ImoDeus.ai/1.0 (property geocoding fallback)',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] } }> };
  const coords = payload.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length !== 2) {
    return null;
  }

  return {
    latitude: Number(coords[1]),
    longitude: Number(coords[0]),
  };
}

async function geocodeViaGoogle(address?: string | null, zone?: string | null, city?: string | null) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    return null;
  }

  const queries = buildQueries(address, zone, city);
  for (const query of queries.slice(0, 4)) {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=ro&language=ro&key=${encodeURIComponent(apiKey)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
        address_components?: Array<GoogleAddressComponent & { long_name?: string; short_name?: string; types?: string[] }>;
      }>;
    };

    const first = payload.results?.[0];
    const location = first?.geometry?.location;
    if (payload.status === 'OK' && location?.lat && location?.lng) {
      return {
        latitude: Number(location.lat),
        longitude: Number(location.lng),
      };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const zone = searchParams.get('zone');
  const city = searchParams.get('city');

  const queries = buildQueries(address, zone, city);
  if (queries.length === 0) {
    return NextResponse.json({ message: 'Adresa este obligatorie pentru geocodare.' }, { status: 400 });
  }

  try {
    const google = await geocodeViaGoogle(address, zone, city);
    if (google) {
      return NextResponse.json(google);
    }

    for (const query of queries) {
      const nominatim = await geocodeViaNominatim(query);
      if (nominatim) {
        return NextResponse.json(nominatim);
      }
    }

    for (const query of queries.slice(0, 2)) {
      const photon = await geocodeViaPhoton(query);
      if (photon) {
        return NextResponse.json(photon);
      }
    }

    return NextResponse.json({ message: 'Nu am putut identifica coordonatele pentru aceasta adresa.' }, { status: 404 });
  } catch (error) {
    console.error('Geocoding failed:', error);
    return NextResponse.json({ message: 'A aparut o eroare la geocodare.' }, { status: 500 });
  }
}
