import data from '../src/data/imobiliare-locations-index.json' with { type: 'json' };

const needles = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);

if (!needles.length) {
  console.error('Usage: node scripts/lookup-imobiliare-location.mjs <id-or-text> [...]');
  process.exit(1);
}

const results = [];

for (const needle of needles) {
  const numeric = Number(needle);
  const matches = data.filter((item) => {
    if (Number.isFinite(numeric)) {
      return item.id === numeric || item.old_id === numeric;
    }

    const text = needle.toLowerCase();
    return [item.title, item.slug]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text));
  });

  results.push({
    needle,
    matches,
  });
}

console.log(JSON.stringify(results, null, 2));
