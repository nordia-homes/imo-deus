import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach,expect,it,vi } from 'vitest';
import { AssistantResultCard } from '@/components/ai/AssistantResultCard';
import type { AssistantCard } from '../contracts';
afterEach(()=>vi.unstubAllGlobals());
const render=(card:AssistantCard,busy=false)=>{vi.stubGlobal('React',React);const noop=()=>{};return renderToStaticMarkup(React.createElement(AssistantResultCard,{card,busy,onPrompt:noop,onPrepare:noop,onConsent:noop,onContinue:noop,onCrm:noop,onArtifact:noop}));};
it('shows the named account choice only for an actionable offered card',()=>{
 const card:AssistantCard={type:'data',source:'facebookConnections',title:'Conturi Facebook',rows:[{id:'opaque-internal',label:'Contul Nordia'}]};
 expect(render(card)).not.toContain('Publică folosind contul');
 const html=render({...card,choiceSource:'facebookPublicationAccount'});
 expect(html).toContain('Contul Nordia');expect(html).toContain('Publică folosind contul');
 expect(html.replace(/<[^>]*>/g,'')).not.toContain('opaque-internal');
 expect(render({...card,choiceSource:'facebookPublicationAccount'},true)).toContain('disabled');
});
it('keeps the property name visible beside its publication choice',()=>{
 const html=render({type:'data',source:'properties',choiceSource:'facebookPublicationProperty',title:'Proprietăți',rows:[{id:'p',title:'Apartament Cișmigiu'}]});
 expect(html).toContain('Apartament Cișmigiu');expect(html).toContain('Publică proprietatea');
});
