import { expect, it } from 'vitest';
import { assessMetaPromotion } from '../meta-promotion-recommendation';
const property={title:'Cișmigiu',status:'Activ',price:130000,transactionType:'Vânzare',location:'București',description:'Descriere exactă CRM',images:[{url:'https://example.com/photo.jpg'}]};
it('explains a complete candidate without promising performance',()=>{const row=assessMetaPromotion(property);expect(row.recommended).toBe(true);expect(row.reason).toContain('buget și zonă');expect(row.nextStep).toContain('nu sunt confirmate');});
it.each([{status:'Vândut'},{price:0},{price:-1},{price:NaN},{price:'130000'},{transactionType:'necunoscut'},{location:''},{title:''},{description:''},{images:[]}])('requires actual usable listing data %j',patch=>expect(assessMetaPromotion({...property,...patch}).recommended).toBe(false));
it('does not count duplicate or malformed images as distinct photos',()=>{const row=assessMetaPromotion({...property,images:[...property.images,...property.images,{url:'http://example.com/a'},{url:'https://user:secret@example.com/a'},null]});expect(row.facts).toContain('distincte: 1');});
it('accepts Romanian rental and city/zone without estimating conversion',()=>expect(assessMetaPromotion({...property,transactionType:'Închiriere',location:'',city:'București',zone:'Titan'}).recommended).toBe(true));
