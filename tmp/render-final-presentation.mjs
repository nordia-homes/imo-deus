import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {renderPropertyPresentationHtml} from '../src/lib/property-presentations/pdf-template.ts';
const data=JSON.parse(fs.readFileSync('tmp/presentation-real-source.json','utf8'));
const selected=[0,1,2,5,3,4,6,7];
const labels=['Living','Bucătărie','Dormitor','Baie','Hol','Baie de serviciu','Balcon','Dormitor secundar'];
const originals=data.property.images;
data.property.images=selected.map((i,j)=>({url:`data:image/jpeg;base64,${fs.readFileSync(originals[i].localPath).toString('base64')}`,alt:labels[j]}));
data.generatedAt=new Date('2026-09-24T10:00:00Z');
data.nearbyObjectives=[{name:'Depoul Alexandria',walkingMinutes:9},{name:'Grădinița Paradisul Verde',walkingMinutes:30},{name:'Școala Gimnazială Nr. 131',walkingMinutes:21},{name:'Carrefour',walkingMinutes:9}];
const browser=await chromium.launch({headless:true,executablePath:path.resolve('node_modules/playwright-core/.local-browsers/chromium_headless_shell-1217/chrome-headless-shell-win64/chrome-headless-shell.exe')});
try{
 const page=await browser.newPage({viewport:{width:794,height:1123},deviceScaleFactor:2});await page.emulateMedia({media:'print'});
 const html=renderPropertyPresentationHtml(data);fs.writeFileSync('tmp/prezentare-proprietate-finala.html',html);
 await page.setContent(html,{waitUntil:'networkidle'});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 const issues=await page.evaluate(()=>{const issues=[];for(const sheet of document.querySelectorAll('.page')){const p=sheet.getBoundingClientRect();for(const e of sheet.querySelectorAll('*')){if(e.closest('svg'))continue;const r=e.getBoundingClientRect();if(r.bottom>p.bottom+1||r.right>p.right+1||r.left<p.left-1)issues.push(`${e.className}: beyond page`);if(e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX!=='hidden')issues.push(`${e.className}: overflow`);}}const info=document.querySelector('.information');const contact=document.querySelector('.contact');for(const e of info.querySelectorAll('*')){if(e.getBoundingClientRect().bottom>contact.getBoundingClientRect().top+1)issues.push(`${e.className}: overlap contact`);}return [...new Set(issues)];});
 assert.deepEqual(issues,[]);
 const bytes=await page.pdf({path:'tmp/prezentare-proprietate-finala.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
 const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),3);
 await page.locator('.cover').screenshot({path:'tmp/prezentare-proprietate-finala.png'});
 for(let i=1;i<3;i++)await page.locator('.page').nth(i).screenshot({path:`tmp/prezentare-proprietate-finala-p${i+1}.png`});
 console.log(JSON.stringify({pages:pdf.getPageCount(),layoutIssues:issues,photos:originals.length,coverGallery:['Bucătărie','Dormitor','Baie'],qr:data.publicPropertyUrl,loadedFont:await page.evaluate(()=>document.fonts.check('12px Presentation'))}));
}finally{await browser.close();}
