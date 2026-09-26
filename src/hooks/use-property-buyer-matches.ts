'use client';

import { useEffect, useState } from 'react';
import { buyerMatcherFromProperty } from '@/ai/flows/property-matcher';
import { createBuyerMatchCache } from '@/lib/buyer-match-cache';
import type { Contact, MatchedBuyer, Property } from '@/lib/types';

const matchBuyers = createBuyerMatchCache(buyerMatcherFromProperty);

export function usePropertyBuyerMatches(
  scope: string,
  property: Property | null,
  contacts: Contact[] | null,
  enabled: boolean,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    scope: string;
    property: Property;
    contacts: Contact[];
    attempt: number;
    buyers: MatchedBuyer[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !property || !contacts) return;
    let active = true;
    matchBuyers(scope, property, contacts).then(
      ({ matchedBuyers }) => {
        if (active) setResult({ scope, property, contacts, attempt, buyers: matchedBuyers, error: null });
      },
      (error) => {
        console.error('Buyer matching failed:', error);
        if (active) setResult({ scope, property, contacts, attempt, buyers: [], error: 'Recomandările nu au putut fi încărcate. Încearcă din nou.' });
      },
    );
    return () => { active = false; };
  }, [scope, property, contacts, enabled, attempt]);

  const current = result?.scope === scope && result.property === property
    && result.contacts === contacts && result.attempt === attempt ? result : null;

  return {
    matchedBuyers: current?.buyers || [],
    isMatching: !current,
    matchingError: current?.error || null,
    retryMatches: () => setAttempt((value) => value + 1),
  };
}
