import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function readBrowserApiKey() {
  return (
    process.env.GOOGLE_MAPS_BROWSER_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

export async function GET() {
  const apiKey = readBrowserApiKey();

  if (!apiKey || apiKey === 'PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    return NextResponse.json(
      { message: 'Google Maps browser key is missing.' },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { apiKey },
    {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    }
  );
}
