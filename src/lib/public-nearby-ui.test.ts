import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { PublicNearbyObjectives } from '@/components/public/PublicNearbyObjectives';

afterEach(() => vi.unstubAllGlobals());
it('renders saved objectives and walking time without network requests', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const html = renderToStaticMarkup(React.createElement(PublicNearbyObjectives, { property: {
    publicNearby: { status: 'ready', calculatedAt: '2026-10-28T12:00:00Z', objectives: [{
      kind: 'metro', label: 'Metrou', name: 'Stație de test', walkingMinutes: 6,
      walkingText: '6 minute pe jos', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=test',
    }] },
  } }));
  expect(html).toContain('Stație de test');
  expect(html).toContain('6 minute pe jos');
  expect(html).toContain('Date Google Maps');
  expect(fetch).not.toHaveBeenCalled();
});
it('does not start a lookup when a legacy property has no snapshot', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const html = renderToStaticMarkup(React.createElement(PublicNearbyObjectives, { property: {} }));
  expect(html).toContain('nu sunt încă disponibile');
  expect(fetch).not.toHaveBeenCalled();
});
