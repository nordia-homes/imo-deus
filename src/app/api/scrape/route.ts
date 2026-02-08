import { NextResponse } from 'next/server';

// This route acts as a proxy to the Cloud Function to avoid CORS issues.
export async function GET() {
  const targetUrl = 'https://us-central1-studio-652232171-42fb6.cloudfunctions.net/scrapeOlxOwners';

  try {
    const response = await fetch(targetUrl, { cache: 'no-store' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from external API: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json(
        { error: `Eroare la preluarea datelor de la serverul extern: ${response.statusText}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Robustly find the array within the response data
    if (Array.isArray(data)) {
        return NextResponse.json(data);
    } 
    
    if (typeof data === 'object' && data !== null) {
        // Find the first property in the object that is an array.
        const arrayKey = Object.keys(data).find(key => Array.isArray(data[key]));
        if (arrayKey) {
            return NextResponse.json(data[arrayKey]);
        }
    }
    
    console.error("Unexpected data format from external API:", data);
    return NextResponse.json(
      { error: "Format de date neașteptat primit de la server." }, 
      { status: 500 }
    );

  } catch (error: any) {
    console.error('API Proxy Error for scrapeOlxOwners:', error);
    return NextResponse.json(
      { error: "Nu s-a putut stabili conexiunea cu serverul de anunțuri." }, 
      { status: 500 }
    );
  }
}
