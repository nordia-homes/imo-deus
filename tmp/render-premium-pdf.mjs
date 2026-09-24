import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const doc=await getDocument({data:new Uint8Array(fs.readFileSync('tmp/prezentare-proprietate-premium.pdf')),useSystemFonts:true}).promise;
const page=await doc.getPage(1);const viewport=page.getViewport({scale:2});
const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
fs.writeFileSync('tmp/prezentare-proprietate-premium.png',canvas.toBuffer('image/png'));
const text=await page.getTextContent();console.log('PDF verified:',doc.numPages,'page;',text.items.map(item=>item.str).join(' ').includes('Programează o vizionare')?'contact text present':'check contact');
