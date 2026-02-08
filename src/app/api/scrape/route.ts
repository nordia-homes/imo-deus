
import { NextResponse } from 'next/server';

// This route acts as a proxy to the Cloud Function to avoid CORS issues.
export async function GET() {
  const targetUrl = 'https://us-central1-studio-652232171-42fb6.cloudfunctions.net/scrapeOlxOwners';

  try {
    // Add cache: 'no-store' to ensure we always fetch fresh data
    const response = await fetch(targetUrl, { cache: 'no-store' });

    if (!response.ok) {
      return new NextResponse(`Error from external API: ${response.statusText}`, { status: response.status });
    }

    const data = await response.json();
    
    // Robustly find the array within the response data
    let listings: any[] = [];
    if (Array.isArray(data)) {
        listings = data;
    } else if (typeof data === 'object' && data !== null) {
        // Find the first property in the object that is an array.
        const arrayKey = Object.keys(data).find(key => Array.isArray(data[key]));
        if (arrayKey) {
            listings = data[arrayKey];
        }
    }
    
    return NextResponse.json(listings);

  } catch (error) {
    console.error('API Proxy Error for scrapeOlxOwners:', error);
    // Return an empty array on error to prevent frontend from crashing.
    return new NextResponse('Failed to fetch data from external API', { status: 500 });
  }
}
