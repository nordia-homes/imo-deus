import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function buildSearchQuery(address?: string | null, zone?: string | null, city?: string | null) {
  return [address, zone, city, 'Romania'].filter(Boolean).join(', ');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const zone = searchParams.get('zone');
  const city = searchParams.get('city');

  const query = buildSearchQuery(address, zone, city);
  if (!query) {
    return NextResponse.json({ message: 'Adresa este obligatorie pentru geocodare.' }, { status: 400 });
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'ro');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ImoDeus.ai/1.0 (property geocoding)',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ message: 'Serviciul de geocodare nu a raspuns corect.' }, { status: 502 });
    }

    const results = await response.json() as Array<{ lat: string; lon: string }>;
    const firstResult = results?.[0];

    if (!firstResult?.lat || !firstResult?.lon) {
      return NextResponse.json({ message: 'Nu am putut identifica coordonatele pentru aceasta adresa.' }, { status: 404 });
    }

    return NextResponse.json({
      latitude: Number(firstResult.lat),
      longitude: Number(firstResult.lon),
    });
  } catch (error) {
    console.error('Geocoding failed:', error);
    return NextResponse.json({ message: 'A aparut o eroare la geocodare.' }, { status: 500 });
  }
}
