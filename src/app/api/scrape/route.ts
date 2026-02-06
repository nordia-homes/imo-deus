import { NextResponse } from 'next/server';

// This route acts as a proxy to the Cloud Function to avoid CORS issues.
export async function GET() {
  const targetUrl = 'https://us-central1-studio-652232171-42fb6.cloudfunctions.net/scrapeOlxOwners';

  try {
    const response = await fetch(targetUrl, {
      next: {
        // Revalidate every 60 minutes to get fresh data
        revalidate: 3600,
      }
    });

    if (!response.ok) {
      // If the function returned an error, forward it
      return new NextResponse(response.statusText, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Proxy Error for scrapeOlxOwners:', error);
    return new NextResponse('Internal Server Error while fetching from proxy.', { status: 500 });
  }
}
