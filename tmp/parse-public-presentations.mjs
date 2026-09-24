import fs from 'node:fs';
const html=fs.readFileSync('tmp/nordia-properties.html','utf8');
const chunks=[...html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)].flatMap(m=>{try{return [JSON.parse(m[1])[1]||'']}catch{return []}}).join('');
fs.writeFileSync('tmp/nordia-properties-rsc.txt',chunks);
for(const needle of ['Conea','134800','"properties"','"customDomain"']){const i=chunks.indexOf(needle);console.log(needle,i,i>=0?chunks.slice(Math.max(0,i-200),i+400):'');}
console.log('links', [...html.matchAll(/href="([^" ]*properties\/[^" ]*)"/g)].map(m=>m[1]).slice(0,30));
