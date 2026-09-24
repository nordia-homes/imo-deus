import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { renderPropertyPresentationHtml } from '../src/lib/property-presentations/pdf-template.ts';
const photo = `data:image/png;base64,${fs.readFileSync('tmp/prezentare-fotografie.png').toString('base64')}`;
const property = {id:'qa',title:'Proprietate',propertyType:'Apartament',transactionType:'Vanzare',price:134800,rooms:3,bathrooms:2,squareFootage:72,totalSurface:79,constructionYear:2014,address:'Strada Ion Conea 12–14',city:'București',images:[{url:photo,alt:'Living'}],floor:'0',partitioning:'Decomandat',heatingSystem:'Centrală proprie',kitchen:'Închisă',balconyTerrace:'3 balcoane',interiorState:'Renovat'};
const input = {property,agency:{name:'Nordia Homes'},agent:{name:'Mirela',phone:'+40 744 128 805',email:'nordia.vanzari@gmail.com'},generatedAt:new Date('2026-09-23')};
const placeholderImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
const cases = [
  ['missing', {...input,property:{id:'empty',title:'Proprietate',images:[]},agency:null,agent:null}],
  ['long', {...input,property:{...property,propertyType:'Apartament deosebit într-un ansamblu rezidențial',price:123456789,title:'Titlu lung '.repeat(20),address:'Strada cu un nume foarte lung '.repeat(8),location:'Cartier rezidențial cu o denumire foarte lungă',tagline:'Un cămin special '.repeat(20),partitioning:'Compartimentare foarte lungă '.repeat(6),heatingSystem:'Centrală individuală '.repeat(8)},agency:{name:'Agenție imobiliară cu un nume foarte lung '.repeat(5)},agent:{name:'Consultant imobiliar '.repeat(5),phone:'+40 744 128 805',email:'adresa-de-email-foarte-lunga-pentru-testare@agentie-imobiliara-exemplu.ro'},publicPropertyUrl:'https://example.com/property/qa',nearbyObjectives:Array.from({length:4},()=>({name:'Școală cu un nume foarte lung '.repeat(6),walkingMinutes:25}))}],
  ['rental', {...input,property:{...property,transactionType:'Închiriere',price:1200,buyerCommissionValue:50,buyerCommissionType:'percentage'}}],
  ['duplicates', {...input,property:{...property,images:Array(5).fill(property.images[0])}}],
  ...[2,3,4,5,7].map(count=>[`gallery-${count}`,{...input,property:{...property,images:Array.from({length:count},(_,i)=>({url:`https://images.example.test/${i}.png`,alt:`Fotografie de test ${i+1}`})),keyFeatures:'Terasă, Parcare, Mobilat'},publicPropertyUrl:'https://example.com/property/qa'}]),
];
const browser=await chromium.launch({executablePath:path.resolve('node_modules/playwright-core/.local-browsers/chromium_headless_shell-1217/chrome-headless-shell-win64/chrome-headless-shell.exe')});
try {
 const page=await browser.newPage({viewport:{width:794,height:1123}});
 await page.emulateMedia({media:'print'});
 await page.route('https://images.example.test/**',route=>route.fulfill({contentType:'image/png',body:fs.readFileSync('tmp/prezentare-fotografie.png')}));
 await page.route('https://api.qrserver.com/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from(placeholderImage.split(',')[1],'base64')}));
 for(const [name,data] of cases) {
   const html=renderPropertyPresentationHtml(data);
   if(name==='missing') {assert(!html.includes('07XX'));assert(!html.includes('contact@agentie'));assert(!html.includes('Comision cumpărător:'));assert(!html.includes('Scanează'));}
   if(name==='rental') {assert(html.includes('Chirie lunară'));assert(html.includes('Comision chiriaș: 50%'));}

   await page.setContent(html,{waitUntil:'networkidle'});
   const issues=await page.evaluate(()=> {
     const result=[];
     for(const sheet of document.querySelectorAll('.page')) {
       const bounds=sheet.getBoundingClientRect();
       for(const el of sheet.querySelectorAll('*')) {
         if(el.closest('svg') || el.matches('.photo-crop .photo'))continue;
         const rect=el.getBoundingClientRect();
         if(rect.right>bounds.right+1 || rect.bottom>bounds.bottom+1 || rect.left<bounds.left-1)result.push(`${el.className}: outside page`);
         if(el.scrollWidth>el.clientWidth+2 && !['svg','path'].includes(el.tagName.toLowerCase()) && getComputedStyle(el).overflowX !== 'hidden')result.push(`${el.className}: horizontal overflow`);
       }
     }
     const intro=document.querySelector('.intro'); const hero=document.querySelector('.price-card');
     if(intro&&hero)for(const child of intro.children)if(child.getBoundingClientRect().bottom>hero.getBoundingClientRect().top)result.push('Intro overlaps price');
     const info=document.querySelector('.information');const contact=document.querySelector('.contact');
     if(info&&contact)for(const child of info.querySelectorAll('*'))if(child.getBoundingClientRect().bottom>contact.getBoundingClientRect().top)result.push('Details overlap contact');
     return [...new Set(result)];
   });
   const bytes=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
   const pdf=await PDFDocument.load(bytes);const sheets=await page.locator('.page').count(); if(name==='gallery-4')fs.writeFileSync('tmp/presentation-qr-qa.pdf',bytes);
   assert.equal(pdf.getPageCount(),sheets,`${name}: unexpected blank pages`);
   if(name==='duplicates')assert.equal(sheets,1);
   if(name.startsWith('gallery'))assert.equal(sheets,1+Math.ceil(Math.max(0,data.property.images.length-4)/3));
   if(name==='gallery-7')await page.locator('.page').nth(1).screenshot({path:'tmp/premium-gallery-qa.png'});
   if(name==='long')await page.screenshot({path:'tmp/premium-long-qa.png',fullPage:true});
   console.log(name,JSON.stringify({pages:sheets,issues}));assert.deepEqual(issues,[],`${name}: layout errors`);
 }
 console.log('All presentation checks passed.');
}finally{await browser.close();}


