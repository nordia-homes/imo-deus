import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type AddressSuggestion = {
  label: string;
  addressLine?: string;
  city?: string;
  zone?: string;
  latitude: number;
  longitude: number;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
};

function normalizeAddressInput(address?: string | null) {
  return (address || '')
    .trim()
    .replace(/^\s*str\.?\s+/i, 'Strada ')
    .replace(/^\s*strada\s+/i, 'Strada ')
    .replace(/^\s*bd\.?\s+/i, 'Bulevardul ')
    .replace(/^\s*b-dul\.?\s+/i, 'Bulevardul ')
    .replace(/^\s*blvd\.?\s+/i, 'Bulevardul ')
    .replace(/^\s*sos\.?\s+/i, 'Soseaua ')
    .replace(/^\s*șos\.?\s+/i, 'Soseaua ')
    .replace(/^\s*calea\s+/i, 'Calea ')
    .replace(/^\s*alee?a\.?\s+/i, 'Aleea ')
    .replace(/^\s*piata\s+/i, 'Piata ')
    .replace(/^\s*piața\s+/i, 'Piata ')
    .replace(/^\s*dr\.?\s+/i, 'Drumul ')
    .replace(/^\s*drumul\s+/i, 'Drumul ')
    .replace(/\s+/g, ' ');
}

function cityAliases(city?: string | null) {
  const cleaned = (city || '').trim();
  if (!cleaned) return [];
  if (cleaned === 'Bucuresti-Ilfov') {
    return ['București', 'Bucuresti', 'Ilfov', 'Sector 1 București', 'Sector 1 Bucuresti'];
  }
  const normalized = normalizeText(cleaned);
  const variants = new Set([cleaned]);
  if (normalized === 'iasi') variants.add('Iași');
  if (normalized === 'brasov') variants.add('Brașov');
  if (normalized === 'timisoara') variants.add('Timișoara');
  if (normalized === 'clujnapoca') variants.add('Cluj-Napoca');
  return Array.from(variants);
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripStreetNumber(value?: string | null) {
  return (value || '')
    .replace(/\s+\d+[a-zA-Z\-\/]*\s*$/, '')
    .trim();
}

function buildQueries(address?: string | null, zone?: string | null, city?: string | null) {
  const normalizedAddress = normalizeAddressInput(address);
  const baseStreetOnly = stripStreetNumber(normalizedAddress);
  const normalizedZone = (zone || '').trim();
  const cities = cityAliases(city);
  const queries = new Set<string>();

  for (const currentCity of cities.length ? cities : ['']) {
    queries.add([normalizedAddress, normalizedZone, currentCity, 'Romania'].filter(Boolean).join(', '));
    queries.add([normalizedAddress, currentCity, 'Romania'].filter(Boolean).join(', '));
    queries.add([baseStreetOnly, normalizedZone, currentCity, 'Romania'].filter(Boolean).join(', '));
    queries.add([baseStreetOnly, currentCity, 'Romania'].filter(Boolean).join(', '));
  }

  queries.add([normalizedAddress, normalizedZone, 'Romania'].filter(Boolean).join(', '));
  queries.add([baseStreetOnly, normalizedZone, 'Romania'].filter(Boolean).join(', '));
  queries.add([normalizedAddress, 'Romania'].filter(Boolean).join(', '));
  queries.add([baseStreetOnly, 'Romania'].filter(Boolean).join(', '));

  return Array.from(queries).filter((query) => normalizeText(query).length >= 3);
}

function pickComponent(components: GoogleAddressComponent[] | undefined, acceptedTypes: string[]) {
  if (!components?.length) {
    return '';
  }

  for (const acceptedType of acceptedTypes) {
    const found = components.find((component) => component.types?.includes(acceptedType));
    if (found?.longText) {
      return found.longText;
    }
    if (found?.shortText) {
      return found.shortText;
    }
  }

  return '';
}

function extractCityFromGoogleComponents(components: GoogleAddressComponent[] | undefined) {
  return (
    pickComponent(components, ['locality']) ||
    pickComponent(components, ['administrative_area_level_2']) ||
    pickComponent(components, ['administrative_area_level_1']) ||
    ''
  );
}

function extractZoneFromGoogleComponents(components: GoogleAddressComponent[] | undefined) {
  return (
    pickComponent(components, ['neighborhood']) ||
    pickComponent(components, ['sublocality_level_1']) ||
    pickComponent(components, ['sublocality']) ||
    ''
  );
}

function extractStreetLineFromGoogleComponents(components: GoogleAddressComponent[] | undefined) {
  const route = pickComponent(components, ['route']);
  const streetNumber = pickComponent(components, ['street_number']);
  return [route, streetNumber].filter(Boolean).join(' ').trim();
}

function fixRomanianDiacritics(value?: string | null) {
  return (value || '')
    .replace(/\bBucuresti\b/gi, 'București')
    .replace(/\bBrasov\b/gi, 'Brașov')
    .replace(/\bIasi\b/gi, 'Iași')
    .replace(/\bTimisoara\b/gi, 'Timișoara')
    .replace(/\bSoseaua\b/gi, 'Șoseaua')
    .replace(/\bPiata\b/gi, 'Piața')
    .replace(/\bRomania\b/gi, 'România')
    .trim();
}

function scoreSuggestion(
  suggestion: AddressSuggestion,
  address?: string | null,
  zone?: string | null,
  city?: string | null
) {
  const normalizedNeedle = normalizeText(address);
  const normalizedZone = normalizeText(zone);
  const normalizedCity = normalizeText(city);
  const normalizedAddressLine = normalizeText(suggestion.addressLine || suggestion.label);
  const normalizedLabel = normalizeText(suggestion.label);
  const normalizedSuggestionZone = normalizeText(suggestion.zone);
  const normalizedSuggestionCity = normalizeText(suggestion.city);

  let score = 0;

  if (normalizedNeedle && normalizedAddressLine.startsWith(normalizedNeedle)) score += 80;
  else if (normalizedNeedle && normalizedAddressLine.includes(normalizedNeedle)) score += 55;
  else if (normalizedNeedle && normalizedLabel.includes(normalizedNeedle)) score += 35;

  if (normalizedZone && normalizedSuggestionZone === normalizedZone) score += 30;
  else if (normalizedZone && normalizedSuggestionZone.includes(normalizedZone)) score += 15;

  if (normalizedCity && normalizedSuggestionCity === normalizedCity) score += 40;
  else if (normalizedCity && normalizedLabel.includes(normalizedCity)) score += 20;

  if (normalizedLabel.includes('romania')) score += 5;

  return score;
}

async function googlePlaceDetails(placeId: string, apiKey: string): Promise<AddressSuggestion | null> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,shortFormattedAddress,location,addressComponents',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    formattedAddress?: string;
    shortFormattedAddress?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    addressComponents?: GoogleAddressComponent[];
  };

  if (!payload.location?.latitude || !payload.location?.longitude) {
    return null;
  }

  const label =
    payload.formattedAddress ||
    payload.shortFormattedAddress ||
    payload.displayName?.text ||
    '';

  if (!label) {
    return null;
  }

  return {
    label: fixRomanianDiacritics(label),
    addressLine: fixRomanianDiacritics(payload.shortFormattedAddress || payload.formattedAddress || label),
    city: fixRomanianDiacritics(extractCityFromGoogleComponents(payload.addressComponents)),
    zone: fixRomanianDiacritics(extractZoneFromGoogleComponents(payload.addressComponents)),
    latitude: Number(payload.location.latitude),
    longitude: Number(payload.location.longitude),
  };
}

async function searchViaGoogle(address?: string | null, zone?: string | null, city?: string | null) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    return null;
  }

  const queries = buildQueries(address, zone, city);
  const unique = new Map<string, AddressSuggestion>();

  for (const query of queries.slice(0, 4)) {
    const autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
      },
      body: JSON.stringify({
        input: query,
        languageCode: 'ro',
        regionCode: 'RO',
        includedRegionCodes: ['ro'],
        includePureServiceAreaBusinesses: false,
      }),
      cache: 'no-store',
    });

    if (!autocompleteResponse.ok) {
      continue;
    }

    const autocompletePayload = (await autocompleteResponse.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          place?: string;
          placeId?: string;
          text?: { text?: string };
        };
      }>;
    };

    const candidates = autocompletePayload.suggestions
      ?.map((entry) => entry.placePrediction)
      .filter(Boolean)
      .slice(0, 6) || [];

    const detailedResults = await Promise.all(
      candidates.map(async (prediction) => {
        const placeId =
          prediction?.placeId ||
          prediction?.place?.replace(/^places\//, '') ||
          '';

        if (!placeId) {
          return null;
        }

        return googlePlaceDetails(placeId, apiKey);
      })
    );

    for (const suggestion of detailedResults) {
      if (!suggestion) {
        continue;
      }
      const key = `${normalizeText(suggestion.addressLine || suggestion.label)}-${suggestion.latitude}-${suggestion.longitude}`;
      if (!unique.has(key)) {
        unique.set(key, suggestion);
      }
    }
  }

  for (const query of queries.slice(0, 4)) {
    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=ro&language=ro&key=${encodeURIComponent(apiKey)}`,
      { cache: 'no-store' }
    );

    if (!geocodeResponse.ok) {
      continue;
    }

    const geocodePayload = (await geocodeResponse.json()) as {
      status?: string;
      results?: GoogleGeocodeResult[];
    };

    if (geocodePayload.status !== 'OK') {
      continue;
    }

    for (const result of geocodePayload.results || []) {
      const latitude = result.geometry?.location?.lat;
      const longitude = result.geometry?.location?.lng;
      if (!latitude || !longitude || !result.formatted_address) {
        continue;
      }

      const components = (result.address_components || []).map((component) => ({
        longText: component.long_name,
        shortText: component.short_name,
        types: component.types,
      }));

      const suggestion: AddressSuggestion = {
        label: fixRomanianDiacritics(result.formatted_address),
        addressLine: fixRomanianDiacritics(extractStreetLineFromGoogleComponents(components) || result.formatted_address),
        city: fixRomanianDiacritics(extractCityFromGoogleComponents(components)),
        zone: fixRomanianDiacritics(extractZoneFromGoogleComponents(components)),
        latitude: Number(latitude),
        longitude: Number(longitude),
      };

      const key = `${normalizeText(suggestion.addressLine || suggestion.label)}-${suggestion.latitude}-${suggestion.longitude}`;
      if (!unique.has(key)) {
        unique.set(key, suggestion);
      }
    }
  }

  for (const query of queries.slice(0, 4)) {
    const textSearchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.formattedAddress,places.shortFormattedAddress,places.location,places.addressComponents',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'ro',
        regionCode: 'RO',
        maxResultCount: 6,
      }),
      cache: 'no-store',
    });

    if (!textSearchResponse.ok) {
      continue;
    }

    const textSearchPayload = (await textSearchResponse.json()) as {
      places?: Array<{
        id?: string;
        formattedAddress?: string;
        shortFormattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        addressComponents?: GoogleAddressComponent[];
      }>;
    };

    for (const place of textSearchPayload.places || []) {
      const latitude = place.location?.latitude;
      const longitude = place.location?.longitude;
      if (!latitude || !longitude || !place.formattedAddress) {
        continue;
      }

      const suggestion: AddressSuggestion = {
        label: fixRomanianDiacritics(place.formattedAddress),
        addressLine:
          fixRomanianDiacritics(
            extractStreetLineFromGoogleComponents(place.addressComponents) ||
              place.shortFormattedAddress ||
              place.formattedAddress
          ),
        city: fixRomanianDiacritics(extractCityFromGoogleComponents(place.addressComponents)),
        zone: fixRomanianDiacritics(extractZoneFromGoogleComponents(place.addressComponents)),
        latitude: Number(latitude),
        longitude: Number(longitude),
      };

      const key = `${normalizeText(suggestion.addressLine || suggestion.label)}-${suggestion.latitude}-${suggestion.longitude}`;
      if (!unique.has(key)) {
        unique.set(key, suggestion);
      }
    }
  }

  if (unique.size > 0) {
    return Array.from(unique.values());
  }

  return [];
}

async function searchViaNominatim(query: string) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'ro');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ImoDeus.ai/1.0 (property address autocomplete)',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const results = (await response.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: Record<string, string>;
  }>;

  return results
    .filter((result) => result.display_name && result.lat && result.lon)
    .map((result) => ({
      label: fixRomanianDiacritics(result.display_name!),
      addressLine:
        fixRomanianDiacritics(
          [
            result.address?.road,
            result.address?.house_number,
          ]
            .filter(Boolean)
            .join(' ') || result.display_name!
        ),
      city:
        fixRomanianDiacritics(
          result.address?.city ||
            result.address?.town ||
            result.address?.municipality ||
            result.address?.county ||
            ''
        ),
      zone:
        fixRomanianDiacritics(
          result.address?.suburb ||
            result.address?.neighbourhood ||
            result.address?.quarter ||
            ''
        ),
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    }));
}

async function searchViaPhoton(query: string) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'ro');
  url.searchParams.set('limit', '6');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ImoDeus.ai/1.0 (property address autocomplete fallback)',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    features?: Array<{
      properties?: Record<string, string>;
      geometry?: { coordinates?: [number, number] };
    }>;
  };

  return (payload.features || [])
    .filter((feature) => feature.geometry?.coordinates?.length === 2)
    .map((feature) => {
      const props = feature.properties || {};
      const coords = feature.geometry!.coordinates!;

      return {
        label: fixRomanianDiacritics(
          props.name ||
            [props.street, props.city, props.county, 'Romania'].filter(Boolean).join(', ')
        ),
        addressLine:
          fixRomanianDiacritics(
            [props.street, props.housenumber].filter(Boolean).join(' ') ||
              props.name ||
              ''
          ),
        city: fixRomanianDiacritics(props.city || props.county || ''),
        zone: fixRomanianDiacritics(props.district || props.suburb || props.neighbourhood || ''),
        latitude: Number(coords[1]),
        longitude: Number(coords[0]),
      };
    });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const zone = searchParams.get('zone');
  const city = searchParams.get('city');

  if (!normalizeText(address)) {
    return NextResponse.json([]);
  }

  try {
    const queries = buildQueries(address, zone, city);
    const unique = new Map<string, AddressSuggestion>();

    const googleResults = await searchViaGoogle(address, zone, city);
    if (googleResults && googleResults.length > 0) {
      for (const result of googleResults) {
        const key = `${normalizeText(result.addressLine || result.label)}-${result.latitude}-${result.longitude}`;
        if (!unique.has(key)) {
          unique.set(key, result);
        }
      }
    }

    for (const query of queries.slice(0, 4)) {
      const results = await searchViaNominatim(query);
      for (const result of results) {
        const key = `${normalizeText(result.addressLine || result.label)}-${result.latitude}-${result.longitude}`;
        if (!unique.has(key)) {
          unique.set(key, result);
        }
      }
      if (unique.size >= 8) {
        break;
      }
    }

    if (unique.size < 4) {
      for (const query of queries.slice(0, 2)) {
        const results = await searchViaPhoton(query);
        for (const result of results) {
          const key = `${normalizeText(result.addressLine || result.label)}-${result.latitude}-${result.longitude}`;
          if (!unique.has(key)) {
            unique.set(key, result);
          }
        }
        if (unique.size >= 8) {
          break;
        }
      }
    }

    return NextResponse.json(
      Array.from(unique.values())
        .sort((a, b) => scoreSuggestion(b, address, zone, city) - scoreSuggestion(a, address, zone, city))
        .slice(0, 6)
    );
  } catch (error) {
    console.error('Address suggestion search failed:', error);
    return NextResponse.json([], { status: 200 });
  }
}
