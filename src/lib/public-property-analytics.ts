'use client';

type PublicPropertyEvent = 'view' | 'favorite' | 'unfavorite';

const VISITOR_ID_KEY = 'imodeus-public-visitor-id';
const SESSION_ID_KEY = 'imodeus-public-session-id';

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateStorageValue(storage: Storage, key: string) {
  const current = storage.getItem(key);
  if (current) return current;

  const value = createClientId();
  storage.setItem(key, value);
  return value;
}

function favoriteStorageKey(agencyId: string, propertyId: string) {
  return `imodeus-public-favorite:${agencyId}:${propertyId}`;
}

export function isPublicPropertyFavorite(agencyId: string, propertyId: string) {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(favoriteStorageKey(agencyId, propertyId)) === '1';
  } catch {
    return false;
  }
}

export function setPublicPropertyFavorite(agencyId: string, propertyId: string, isFavorite: boolean) {
  if (typeof window === 'undefined') return;

  try {
    const key = favoriteStorageKey(agencyId, propertyId);
    if (isFavorite) {
      window.localStorage.setItem(key, '1');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Favoritele raman functionale in interfata chiar daca browserul blocheaza storage-ul.
  }
}

export async function trackPublicPropertyEvent(params: {
  agencyId: string;
  propertyId: string;
  event: PublicPropertyEvent;
}) {
  if (typeof window === 'undefined') return;

  let visitorId = createClientId();
  let sessionId = createClientId();

  try {
    visitorId = getOrCreateStorageValue(window.localStorage, VISITOR_ID_KEY);
    sessionId = getOrCreateStorageValue(window.sessionStorage, SESSION_ID_KEY);
  } catch {
    // Identificatorii efemeri pastreaza requestul functional in modurile restrictive.
  }

  const response = await fetch('/api/public-property-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, visitorId, sessionId }),
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error('Statistica proprietatii nu a putut fi actualizata.');
  }
}
