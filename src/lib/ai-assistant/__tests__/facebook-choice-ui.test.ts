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

it('offers named group checkboxes and an initially disabled batch action',()=>{
 const html=render({type:'data',source:'facebookGroups',choiceSource:'facebookPublicationGroups',title:'Grupuri',rows:[{id:'a'.repeat(24),name:'Titan'},{id:'b'.repeat(24),name:'Cișmigiu'}]});
 expect(html.match(/type="checkbox"/g)).toHaveLength(2);
 expect(html).toContain('Publică în grupurile selectate (0)');expect(html).toContain('disabled');
 expect(html.replace(/<[^>]*>/g,'')).not.toContain('a'.repeat(24));
});

it('does not expose internal semantic continuation data in the panel',()=>{
 expect(render({type:'data',source:'facebookSemanticRequest',title:'intern',rows:[{id:'pending',prompt:'private original',input:{propertyId:'opaque'}}]})).toBe('');
});

it('does not render deferred candidate actions as executable panel controls',()=>{
 expect(render({type:'data',source:'semanticDeferredActions',title:'intern',rows:[{actions:[{kind:'create_contact',name:'Nume privat'}]}]})).toBe('');
});
