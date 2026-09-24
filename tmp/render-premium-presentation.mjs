import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { renderPropertyPresentationHtml } from '../src/lib/property-presentations/pdf-template.ts';
const photo = `data:image/png;base64,${fs.readFileSync('tmp/prezentare-fotografie.png').toString('base64')}`;
const input = {
  property: {
    id: 'demo', title: 'Apartament 3 camere Decomandat', propertyType: 'Apartament', transactionType: 'Vanzare',
    price: 134800, totalSurface: 79, rooms: 3, bathrooms: 2, constructionYear: 2014,
    address: 'Strada Ion Conea 12–14, Sector 5', location: 'Sector 5', city: 'București',
    floor: '2', totalFloors: 3, partitioning: 'Decomandat', heatingSystem: 'Centrală proprie', kitchen: 'Închisă',
    balconyTerrace: '3 balcoane', interiorState: 'Renovat', tagline: 'Un cămin pentru o viață mai bună.',
    keyFeatures: 'Bucătărie renovată, 3 balcoane, Centrală proprie', images: [{ url: photo, alt: 'Living' }],
    buyerCommissionValue: 0,
  },
  agency: { name: 'Nordia Homes' },
  agent: { name: 'Mirela', phone: '+40 744 128 805', email: 'nordia.vanzari@gmail.com' },
  generatedAt: new Date('2026-09-23T09:00:00Z'),
  nearbyObjectives: [
    { name: 'Depoul Alexandria', walkingMinutes: 9 },
    { name: 'Grădinița Paradisul Verde', walkingMinutes: 30 },
    { name: 'Școala Gimnazială Nr. 131', walkingMinutes: 21 },
    { name: 'Carrefour', walkingMinutes: 9 },
  ],
};
const browser = await chromium.launch({headless: true, executablePath:path.resolve('node_modules/playwright-core/.local-browsers/chromium_headless_shell-1217/chrome-headless-shell-win64/chrome-headless-shell.exe')});
try {
  const page = await browser.newPage({viewport:{width:794,height:1123},deviceScaleFactor:2});
  await page.emulateMedia({media:'print'});
  const html = renderPropertyPresentationHtml(input);
  fs.writeFileSync('tmp/prezentare-proprietate-premium.html',html);
  await page.setContent(html,{waitUntil:'networkidle'});
  await page.pdf({path:'tmp/prezentare-proprietate-premium.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:0,right:0,bottom:0,left:0}});
  await page.screenshot({path:'tmp/prezentare-proprietate-premium.png',fullPage:true});
  const doc=await PDFDocument.load(fs.readFileSync('tmp/prezentare-proprietate-premium.pdf'));
  console.log('PDF pages:',doc.getPageCount());
  console.log(await page.evaluate(()=>({brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,sections:[...document.querySelectorAll('.page > *')].map(el=>({class:el.className,y:Math.round(el.getBoundingClientRect().y),height:Math.round(el.getBoundingClientRect().height),scroll:el.scrollHeight,client:el.clientHeight}))})));
} finally {await browser.close();}
