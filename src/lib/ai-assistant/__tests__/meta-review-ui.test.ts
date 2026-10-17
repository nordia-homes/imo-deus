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
it('selects the indicated photo and hides revision hashes from the rendered detail', () => {
 vi.stubGlobal('React', React); const onPrompt=vi.fn();
 const props={row:{id:'2',description:'Fotografia din bucătărie',propertyRevision:'INTERNAL_HASH',campaignRevision:'OTHER_HASH'},selection:true,busy:false,selectionPrefix:'Material Meta',selectionLabel:'Selectează fotografia',onPrompt};
 const element:any=MetaReviewDetails(props); element.props.children[1].props.onClick(); expect(onPrompt).toHaveBeenCalledWith('Material Meta: 2');
 const html=renderToStaticMarkup(React.createElement(MetaReviewDetails,props)); expect(html).toContain('Selectează fotografia'); expect(html).not.toContain('INTERNAL_HASH'); expect(html).not.toContain('OTHER_HASH');
});
