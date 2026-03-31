import { NextResponse } from 'next/server';
import { getFirstPropertyImage, getPropertyForAgency } from '@/lib/public-site-metadata';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agencyId = searchParams.get('agencyId');
  const propertyId = searchParams.get('propertyId');

  if (!agencyId || !propertyId) {
    return NextResponse.json({ message: 'agencyId si propertyId sunt obligatorii.' }, { status: 400 });
  }

  const property = await getPropertyForAgency(agencyId, propertyId);
  const imageUrl = getFirstPropertyImage(property);

  if (!imageUrl) {
    return NextResponse.json({ message: 'Proprietatea nu are imagine de share.' }, { status: 404 });
  }

  try {
    const imageResponse = await fetch(imageUrl, { cache: 'no-store' });
    if (!imageResponse.ok) {
      return NextResponse.json({ message: 'Nu am putut incarca imaginea proprietatii.' }, { status: 502 });
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageResponse.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    console.error('Failed to proxy public property image:', error);
    return NextResponse.json({ message: 'A aparut o eroare la preluarea imaginii proprietatii.' }, { status: 500 });
  }
}
