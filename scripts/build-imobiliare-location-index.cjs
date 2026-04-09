const fs = require('fs');
const path = require('path');

const source = process.env.IMOBILIARE_LOCATIONS_SQL_PATH || 'C:\\Users\\Cristian\\Desktop\\Imodeus\\API imobiliare\\locations.sql';
const out = path.join(process.cwd(), 'src', 'data', 'imobiliare-locations-index.json');

function parseTuple(tuple) {
  const values = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < tuple.length; i += 1) {
    const char = tuple[i];
    const next = tuple[i + 1];

    if (char === "'") {
      if (inString && next === "'") {
        current += "'";
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (char === ',' && !inString) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

if (!fs.existsSync(source)) {
  throw new Error(`Missing source SQL: ${source}`);
}

const rows = fs.readFileSync(source, 'utf8')
  .split(/\r?\n/)
  .filter((line) => line.startsWith('insert into `locations`'))
  .map((line) => {
    const match = line.match(/values\((.*)\);$/i);
    if (!match?.[1]) return null;
    const values = parseTuple(match[1]);
    const id = Number(values[0]);
    if (!Number.isFinite(id)) return null;
    const oldId = values[1] && values[1].toUpperCase() !== 'NULL' ? Number(values[1]) : null;
    const parentId = values[6] && values[6].toUpperCase() !== 'NULL' ? Number(values[6]) : null;
    const depth = values[7] ? Number(values[7]) : null;
    return {
      id,
      old_id: Number.isFinite(oldId) ? oldId : null,
      title: values[2] || null,
      slug: values[4] || null,
      parent_id: Number.isFinite(parentId) ? parentId : null,
      depth: Number.isFinite(depth) ? depth : null,
      is_hidden: values[10] === '1',
    };
  })
  .filter(Boolean);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(rows));
console.log(`Wrote ${rows.length} locations to ${out}`);
