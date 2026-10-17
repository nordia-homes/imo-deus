import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { MetaReviewDetails } from '@/components/ai/MetaReviewDetails';
afterEach(() => vi.unstubAllGlobals());
it('renders all media and historical events rather than a five-item preview', () => {
 vi.stubGlobal('React', React);
 const row = { mediaItems: Array.from({ length: 8 }, (_, i) => ({ url: 'photo-' + i })), events: Array.from({ length: 12 }, (_, i) => ({ message: 'event-' + i })), currency: 'RON', readyLocally: false, spend: null };
 const html = renderToStaticMarkup(React.createElement(MetaReviewDetails, { row, selection: false, busy: false, onPrompt: () => {} }));
 expect(html).toContain('photo-7'); expect(html).toContain('event-11'); expect(html).toContain('RON'); expect(html).toContain('Indisponibil'); expect(html).toContain('Nu');
});
it('renders CRM text as text and provides a disabled selection during execution', () => {
 vi.stubGlobal('React', React);
 const html = renderToStaticMarkup(React.createElement(MetaReviewDetails, { row: { id: 'a', primaryText: '<script>alert(1)</script>' }, selection: true, busy: true, onPrompt: () => {} }));
 expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('disabled'); expect(html).toContain('Selectează campania');
});
