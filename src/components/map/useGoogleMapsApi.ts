'use client';

import { useEffect, useState } from 'react';

type GoogleMapsWindow = Window & {
  google?: { maps?: any };
  __googleMapsLoaderPromise?: Promise<void>;
};

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-js-api';

async function fetchBrowserApiKey() {
  const response = await fetch('/api/maps/browser-key', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Nu am putut încărca cheia Google Maps.');
  }

  const payload = (await response.json()) as { apiKey?: string };
  if (!payload.apiKey) {
    throw new Error('Cheia Google Maps lipsește.');
  }

  return payload.apiKey;
}

async function injectGoogleMapsScript(apiKey: string) {
  const googleWindow = window as GoogleMapsWindow;

  if (googleWindow.google?.maps) {
    return;
  }

  if (googleWindow.__googleMapsLoaderPromise) {
    return googleWindow.__googleMapsLoaderPromise;
  }

  googleWindow.__googleMapsLoaderPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google Maps script failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=ro&region=RO`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps script failed to load.'));
    document.head.appendChild(script);
  });

  return googleWindow.__googleMapsLoaderPromise;
}

export function useGoogleMapsApi() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const googleWindow = window as GoogleMapsWindow;
        if (googleWindow.google?.maps) {
          if (!cancelled) {
            setIsLoaded(true);
          }
          return;
        }

        const apiKey = await fetchBrowserApiKey();
        await injectGoogleMapsScript(apiKey);

        if (!cancelled) {
          setIsLoaded(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Google Maps nu este disponibil momentan.'
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isLoaded,
    error,
  };
}
