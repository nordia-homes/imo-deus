import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type SearchResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

function buildSearchQuery(address?: string | null, zone?: string | null, city?: string | null) {
  return [address, zone, city, 'Romania'].filter(Boolean).join(', ');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const zone = searchParams.get('zone');
  const city = searchParams.get('city');

  const query = buildSearchQuery(address, zone, city);
  if (!query || query.length < 6) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
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
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    const results = (await response.json()) as SearchResult[];
    const suggestions = results
      .filter((item) => item.display_name && item.lat && item.lon)
      .map((item) => ({
        label: item.display_name!,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Address search failed:', error);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
