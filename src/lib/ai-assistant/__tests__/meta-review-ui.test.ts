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
it('sends the exact pause confirmation from the campaign button', () => {
 vi.stubGlobal('React', React); const onPrompt=vi.fn();
 const props={row:{id:'selected',campaignName:'Campania aleasă',campaignRevision:'INTERNAL_HASH'},selection:true,busy:false,selectionPrefix:'Confirm pauza Meta',selectionLabel:'Confirmă pauza',onPrompt};
 const element:any=MetaReviewDetails(props); element.props.children[1].props.onClick(); expect(onPrompt).toHaveBeenCalledWith('Confirm pauza Meta: selected');
 const html=renderToStaticMarkup(React.createElement(MetaReviewDetails,props)); expect(html).toContain('Confirmă pauza'); expect(html).not.toContain('INTERNAL_HASH');
});
it('labels provider state separately from the saved CRM state', () => {
 vi.stubGlobal('React', React);
 const html=renderToStaticMarkup(React.createElement(MetaReviewDetails,{row:{localStatus:'published',providerStatus:'PAUSED',effectiveStatus:'PAUSED',checkedAt:'17.10.2026 18:30, București'},selection:false,busy:false,onPrompt:()=>{}}));
 expect(html).toContain('Stare CRM'); expect(html).toContain('Stare Meta'); expect(html).toContain('Stare efectivă Meta'); expect(html).toContain('București');
});
it('renders full period comparisons and sends the statistics selection',()=>{
 vi.stubGlobal('React',React);const onPrompt=vi.fn();
 const props={row:{id:'selected',snapshotRevision:'PRIVATE_HASH',selectedIds:['PRIVATE_ID'],current:{period:{since:'2026-10-10',until:'2026-10-16'},spend:120,leads:4,costPerLead:30},previous:{spend:100},changes:{spend:{difference:20,percent:20}}},selection:true,busy:false,selectionPrefix:'Statistici Meta',onPrompt};
 const element:any=MetaReviewDetails(props);element.props.children[1].props.onClick();expect(onPrompt).toHaveBeenCalledWith('Statistici Meta: selected');const html=renderToStaticMarkup(React.createElement(MetaReviewDetails,props));expect(html).toContain('2026-10-10');expect(html).toContain('Precedentele șapte zile');expect(html).toContain('Schimbare (%)');expect(html).not.toContain('PRIVATE_HASH');expect(html).not.toContain('PRIVATE_ID');
});
