import fs from 'node:fs';

const filePath = new URL('../src/lib/zones/bucuresti-ilfov-zone-ontology.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

for (const name of ['Tei', 'Doamna Ghica', 'Teiul Doamnei']) {
  const zone = data.zones.find((item) => item.name === name);
  console.log(`=== ${name} ===`);
  console.log(JSON.stringify(zone ?? null, null, 2));
}
