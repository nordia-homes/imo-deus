import fs from 'node:fs';
import crypto from 'node:crypto';
const data=JSON.parse(fs.readFileSync('tmp/presentation-real-source.json','utf8'));
fs.mkdirSync('tmp/presentation-photos',{recursive:true});
await Promise.all(data.property.images.map(async(image,i)=>{const r=await fetch(image.url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`Image ${i+1}: ${r.status}`);const b=Buffer.from(await r.arrayBuffer());fs.writeFileSync(`tmp/presentation-photos/photo-${i+1}.jpg`,b);image.localPath=`tmp/presentation-photos/photo-${i+1}.jpg`;image.sha256=crypto.createHash('sha256').update(b).digest('hex');}));
const page=await fetch(data.publicPropertyUrl,{signal:AbortSignal.timeout(25000)});const html=await page.text();fs.writeFileSync('tmp/property-public-page.html',html);
console.log('Public page:',page.status,'matches title:',html.includes('Ion Conea'),'Distinct photo files:',new Set(data.property.images.map(i=>i.sha256)).size);
fs.writeFileSync('tmp/presentation-real-source.json',JSON.stringify(data,null,2));
