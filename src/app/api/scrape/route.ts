
import { NextResponse } from 'next/server';

// This route acts as a proxy to the Cloud Function to avoid CORS issues.
export async function GET() {
  const targetUrl = 'https://us-central1-studio-652232171-42fb6.cloudfunctions.net/scrapeOlxOwners';

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      // If the function returned an error, forward it
      return new NextResponse(response.statusText, { status: response.status });
    }

    const data = await response.json();

    // The external API might wrap the array in an object.
    // This logic extracts the array, making the API response consistent for our frontend.
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
    return NextResponse.json([], { status: 500 });
  }
}
