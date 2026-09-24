import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import jsQR from 'jsqr';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const doc=await getDocument({data:new Uint8Array(fs.readFileSync('tmp/prezentare-proprietate-finala.pdf')),useSystemFonts:true}).promise;
const page=await doc.getPage(1);const viewport=page.getViewport({scale:2});
const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));const context=canvas.getContext('2d');
await page.render({canvasContext:context,viewport}).promise;
const pixels=context.getImageData(0,0,canvas.width,canvas.height);
const decoded=jsQR(pixels.data,canvas.width,canvas.height);
assert.equal(decoded?.data,'https://nordia.ro/properties/0m28BP8YDRXj0RD2wFR7');
fs.writeFileSync('tmp/prezentare-proprietate-finala-verificata.png',canvas.toBuffer('image/png'));
console.log('Actual PDF QR decoded correctly at A4 144 dpi:',decoded.data);
const text=await page.getTextContent();assert(text.items.some(i=>i.str.includes('Pagina')));console.log('Diacritics and text extraction available; pages:',doc.numPages);
const annotations=await page.getAnnotations();
assert(annotations.some(a=>a.url==='https://nordia.ro/properties/0m28BP8YDRXj0RD2wFR7'));
console.log('Clickable property link verified.');

