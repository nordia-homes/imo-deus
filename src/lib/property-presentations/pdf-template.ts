import type { Agency, Property, UserProfile } from '@/lib/types';

export type PropertyPresentationTemplateInput = {
  property: Property;
  agency: Agency | null;
  agent: UserProfile | null;
  generatedAt: Date;
  publicPropertyUrl?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(value?: number | null) {
  if (!value || !Number.isFinite(value)) return 'Pret la cerere';
  return `${value.toLocaleString('ro-RO')} EUR`;
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString('ro-RO');
}

function truncateText(value: string | undefined, maxLength: number) {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function splitFeatureText(value?: string | null) {
  return (value || '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildHighlights(property: Property) {
  const explicit = splitFeatureText(property.keyFeatures);
  const derived = [
    property.nearMetro ? 'Acces rapid la metrou' : null,
    property.zone ? `Zona ${property.zone}` : null,
    property.interiorState ? property.interiorState : null,
    property.balconyTerrace ? property.balconyTerrace : null,
    property.parking ? `Parcare: ${property.parking}` : null,
    ...(property.amenities || []),
  ].filter(Boolean) as string[];

  return Array.from(new Set([...explicit, ...derived])).slice(0, 6);
}

function buildNearbyFacilities(property: Property) {
  const derived = [
    property.nearMetro ? 'Metrou in apropiere' : null,
    property.zone ? `Acces facil in zona ${property.zone}` : null,
    property.lift ? 'Lift in imobil' : null,
    property.parking ? 'Parcare disponibila' : null,
    property.city ? `Conectivitate urbana in ${property.city}` : null,
    ...(property.amenities || []),
  ].filter(Boolean) as string[];

  return Array.from(new Set(derived)).slice(0, 12);
}

function buildMapImageUrl(property: Property) {
  const apiKey = (
    process.env.GOOGLE_MAPS_STATIC_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();

  if (!apiKey || !property.latitude || !property.longitude) return null;

  const center = `${property.latitude},${property.longitude}`;
  const params = new URLSearchParams({
    center,
    zoom: '15',
    size: '900x360',
    scale: '2',
    maptype: 'roadmap',
    language: 'ro',
    region: 'RO',
    key: apiKey,
  });
  params.append('markers', `color:0x8d8065|${center}`);

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function buildGoogleMapsEmbedUrl(property: Property) {
  const query =
    property.latitude && property.longitude
      ? `${property.latitude},${property.longitude}`
      : [property.address, property.zone, property.city || property.location, 'Romania'].filter(Boolean).join(', ');

  if (!query.trim()) return null;

  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&hl=ro&output=embed`;
}

function renderPhoto(url: string | undefined, alt: string, className = '') {
  if (!url) {
    return `<div class="photo empty ${className}">${escapeHtml(alt)}</div>`;
  }

  return `<img class="photo ${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`;
}

function renderList(items: string[]) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function getAgentName(property: Property, agent: UserProfile | null) {
  return agent?.name || property.agentName || property.agent?.name || 'Agent imobiliar';
}

function getAgentPhone(agent: UserProfile | null, agency: Agency | null) {
  return agent?.phone || agency?.phone || '07XX XXX XXX';
}

function getAgentEmail(agent: UserProfile | null, agency: Agency | null) {
  return agent?.email || agency?.email || 'contact@agentie.ro';
}

export function renderPropertyPresentationHtml(input: PropertyPresentationTemplateInput) {
  const { property, agency, agent, publicPropertyUrl } = input;
  const images = property.images || [];
  const displaySurface = property.totalSurface ?? property.squareFootage;
  const location = [property.zone || property.location, property.address].filter(Boolean).join(' - ');
  const shortDescription =
    truncateText(property.description, 230) ||
    'O locuinta luminoasa, intr-o zona linistita, cu acces rapid la punctele importante ale orasului.';
  const fullDescription = truncateText(
    property.description?.trim() ||
      'Descrierea proprietatii va fi completata cu detalii despre pozitionare, compartimentare, finisaje si avantajele relevante pentru cumparator.',
    1700
  );
  const highlights = buildHighlights(property);
  const facilities = buildNearbyFacilities(property);
  const agentName = getAgentName(property, agent);
  const agentPhone = getAgentPhone(agent, agency);
  const agentEmail = getAgentEmail(agent, agency);
  const mapImageUrl = buildMapImageUrl(property);
  const mapEmbedUrl = buildGoogleMapsEmbedUrl(property);
  const qrCodeUrl = publicPropertyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(publicPropertyUrl)}`
    : '';

  const details = [
    ['Suprafata utila', `${formatNumber(displaySurface)} mp`],
    ['Etaj', property.floor ? `${property.floor}${property.totalFloors ? ` / ${property.totalFloors}` : ''}` : '-'],
    ['Camere', property.rooms || '-'],
    ['An constructie', property.constructionYear || '-'],
    ['Compartimentare', property.partitioning || '-'],
    ['Tip proprietate', property.propertyType || '-'],
  ];

  const reasons = highlights.length
    ? highlights
    : ['Locatie excelenta', 'Proprietate pregatita pentru mutare', 'Acces rapid la facilitati urbane', 'Potrivita pentru locuit sau investitie'];

  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(property.title)} - prezentare proprietate</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #efece5;
      color: #2f302b;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      padding: 10mm;
      background: #fbfaf6;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .cover-hero {
      display: grid;
      grid-template-columns: 43% 57%;
      height: 58mm;
      border-radius: 0 0 5mm 5mm;
      overflow: hidden;
      background: #f7f4ee;
    }
    .hero-copy {
      padding: 5mm 7mm 4mm 1mm;
      background:
        radial-gradient(circle at 0 0, rgba(141,128,101,0.14), transparent 37mm),
        #fbfaf6;
    }
    .mark {
      width: 12mm;
      height: 12mm;
      border: 1px solid #b6aa8c;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #a39268;
      font-size: 13px;
      margin-bottom: 4mm;
    }
    .kicker {
      margin: 0 0 2.5mm;
      color: #3d4039;
      font-size: 8px;
      letter-spacing: 0.38em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: #36342f;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 21px;
      font-weight: 400;
      line-height: 0.95;
    }
    h1 span {
      display: block;
      color: #a9966d;
    }
    .accent-line {
      width: 15mm;
      height: 0.8mm;
      background: #b19c72;
      margin: 3mm 0 3mm;
    }
    .location-line {
      display: grid;
      grid-template-columns: 5mm 1fr;
      gap: 3mm;
      align-items: start;
      color: #3f403a;
      font-size: 10px;
      line-height: 1.4;
      margin-bottom: 2.8mm;
    }
    .property-pill {
      display: inline-flex;
      align-items: center;
      gap: 3mm;
      max-width: 100%;
      border: 1px solid #d8cfbc;
      border-radius: 2mm;
      padding: 2mm 4mm;
      background: rgba(255,255,255,0.7);
      color: #3f403a;
      font-size: 10px;
    }
    .hero-text {
      margin: 2.8mm 0 0;
      color: #525149;
      font-size: 7.8px;
      line-height: 1.34;
    }
    .hero-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }
    .benefits {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      margin: 4mm 0 4mm;
      padding: 3mm 6mm;
      border-radius: 3mm;
      background: #ffffff;
      box-shadow: 0 5mm 14mm rgba(51,49,42,0.08);
    }
    .benefit {
      min-height: 18mm;
      padding: 0 4mm;
      text-align: center;
      border-right: 1px solid #e4ded2;
    }
    .benefit:last-child { border-right: 0; }
    .benefit-icon {
      color: #a9966d;
      font-size: 14px;
      line-height: 1;
      margin-bottom: 1.8mm;
    }
    .benefit-title {
      color: #30312d;
      font-size: 7.8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 1.4mm;
    }
    .benefit p {
      margin: 0;
      color: #646158;
      font-size: 7.1px;
      line-height: 1.24;
    }
    .section-title {
      margin: 0 0 2.5mm;
      text-align: center;
      color: #34332f;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12px;
      font-weight: 400;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2mm;
      height: 41mm;
      margin-bottom: 12mm;
      overflow: hidden;
      position: relative;
      z-index: 1;
    }
    .photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 56%;
      border-radius: 2mm;
      background: #ebe7dd;
      display: block;
    }
    .photo.empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8c8576;
      font-size: 9px;
      text-align: center;
      padding: 3mm;
    }
    .bottom-grid {
      display: grid;
      grid-template-columns: 1.08fr 1.15fr 0.9fr;
      gap: 3mm;
      height: 50mm;
      margin-top: 0;
      position: relative;
      z-index: 2;
    }
    .gallery-separator {
      height: 0;
      border-top: 1px solid #e8dfcf;
      margin: -6mm 0 6mm;
    }
    .card {
      border-radius: 3mm;
      background: #ffffff;
      border: 1px solid #ebe5d8;
      padding: 4.2mm;
      overflow: hidden;
    }
    .card h2 {
      margin: 0 0 2.5mm;
      color: #3b3934;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .detail-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 3mm;
      border-bottom: 1px solid #eee7dc;
      padding: 1.45mm 0;
      color: #605d54;
      font-size: 8.6px;
    }
    .detail-row strong {
      color: #3c3b36;
      font-weight: 600;
      text-align: right;
    }
    .check-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .check-list li {
      position: relative;
      padding: 1.35mm 0 1.35mm 6mm;
      color: #56534b;
      font-size: 9px;
      line-height: 1.28;
    }
    .check-list li:before {
      content: "✓";
      position: absolute;
      left: 0;
      top: 1.55mm;
      width: 3.8mm;
      height: 3.8mm;
      border: 1px solid #b9aa85;
      border-radius: 50%;
      color: #9b895d;
      font-size: 8px;
      text-align: center;
      line-height: 3.8mm;
    }
    .contact-card {
      background: #65705f;
      color: #fff;
      border: 0;
    }
    .contact-card h2 {
      color: #fff;
      border-bottom: 1px solid rgba(255,255,255,0.16);
      padding-bottom: 2.4mm;
      margin-bottom: 3mm;
    }
    .contact-line {
      display: flex;
      gap: 3mm;
      align-items: center;
      color: rgba(255,255,255,0.9);
      font-size: 9px;
      line-height: 1.35;
      margin: 2.5mm 0;
    }
    .signature {
      margin-top: 4.5mm;
      color: rgba(255,255,255,0.92);
      font-family: Georgia, 'Times New Roman', serif;
      font-style: italic;
      font-size: 16px;
      text-align: center;
    }
    .footer-line {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10mm;
      margin-top: 3mm;
      padding-top: 3mm;
      border-top: 1px solid #e6dfd3;
      color: #69665e;
      font-size: 8.5px;
    }
    .page-map {
      position: relative;
      height: 38mm;
      margin-top: 4mm;
      border: 1px solid #e5ded1;
      border-radius: 3mm;
      overflow: hidden;
      background: #ede9df;
    }
    .page-map iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }
    .page-map-fallback {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .map-label {
      position: absolute;
      left: 4mm;
      bottom: 4mm;
      max-width: 96mm;
      border-radius: 2.5mm;
      background: rgba(255,255,255,0.95);
      box-shadow: 0 5mm 14mm rgba(51,49,42,0.14);
      padding: 2.5mm 3.2mm;
      color: #4f4b43;
      font-size: 8px;
      line-height: 1.3;
    }
    .map-label strong {
      display: block;
      margin-bottom: 0.8mm;
      color: #34332f;
      font-size: 9.4px;
    }
    .qr-cta {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6mm;
      align-items: center;
      min-height: 23mm;
      margin-top: 4mm;
      border-radius: 3mm;
      background: #65705f;
      color: #fff;
      padding: 4mm 5mm;
    }
    .qr-cta h2 {
      margin: 0 0 1.5mm;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px;
      font-weight: 400;
    }
    .qr-cta p {
      margin: 0;
      max-width: 118mm;
      color: rgba(255,255,255,0.82);
      font-size: 8.8px;
      line-height: 1.35;
    }
    .qr-code {
      width: 18mm;
      height: 18mm;
      border-radius: 2mm;
      background: #fff;
      padding: 1mm;
      object-fit: contain;
    }
    .qr-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18mm;
      height: 18mm;
      border-radius: 2mm;
      background: rgba(255,255,255,0.16);
      color: rgba(255,255,255,0.8);
      font-size: 7px;
      text-align: center;
      padding: 2mm;
    }
    .page-two {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 7mm;
    }
    .topline {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e6dfd3;
      padding-bottom: 4mm;
      color: #6b675e;
      font-size: 9px;
    }
    .description-grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 8mm;
      min-height: 0;
    }
    .page-two h2 {
      margin: 0 0 4mm;
      color: #34332f;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 21px;
      font-weight: 400;
    }
    .description {
      color: #34332f;
      font-size: 10.7px;
      line-height: 1.58;
      white-space: pre-line;
    }
    .facility-list {
      display: grid;
      gap: 2.4mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .facility-list li {
      border: 1px solid #e5ded1;
      border-radius: 2.6mm;
      background: #fff;
      padding: 3mm;
      color: #4e4b43;
      font-size: 9.5px;
      line-height: 1.35;
    }
    .map-card {
      margin-top: 6mm;
      height: 57mm;
      border-radius: 3mm;
      overflow: hidden;
      border: 1px solid #e5ded1;
      background:
        linear-gradient(90deg, rgba(141,128,101,0.09) 1px, transparent 1px),
        linear-gradient(rgba(141,128,101,0.09) 1px, transparent 1px),
        #ede9df;
      background-size: 10mm 10mm;
    }
    .map-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="cover-hero">
      <div class="hero-copy">
        <div class="mark">⌂</div>
        <p class="kicker">Acasa. In mijlocul naturii.</p>
        <h1>Proprietate <span>de vanzare</span></h1>
        <div class="accent-line"></div>
        <div class="location-line">
          <span>⌖</span>
          <span>${escapeHtml(location || property.location || 'Locatie disponibila la cerere')}</span>
        </div>
        <div class="property-pill">▭ ${escapeHtml(property.rooms || '-')} camere · ${escapeHtml(formatNumber(displaySurface))} mp · ${escapeHtml(formatPrice(property.price))}</div>
        <p class="hero-text">${escapeHtml(shortDescription)}</p>
      </div>
      ${renderPhoto(images[0]?.url, images[0]?.alt || property.title, 'hero-image')}
    </div>

    <div class="benefits">
      <div class="benefit">
        <div class="benefit-icon">♧</div>
        <div class="benefit-title">Zona verde</div>
        <p>${escapeHtml(property.nearMetro ? 'Aproape de parc si acces rapid la metrou.' : 'Zona linistita, potrivita pentru locuit.')}</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">▤</div>
        <div class="benefit-title">Acces excelent</div>
        <p>${escapeHtml(property.zone ? `Conectivitate buna in zona ${property.zone}.` : 'Acces facil la mijloace de transport.')}</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">▥</div>
        <div class="benefit-title">Confort</div>
        <p>${escapeHtml(property.partitioning ? `Compartimentare ${property.partitioning}.` : 'Spatii gandite pentru folosire eficienta.')}</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">◇</div>
        <div class="benefit-title">Siguranta</div>
        <p>Proprietate prezentata clar, cu date utile pentru decizie.</p>
      </div>
    </div>

    <h2 class="section-title">Poze proprietate</h2>
    <div class="gallery">
      ${renderPhoto(images[0]?.url, images[0]?.alt || 'Living')}
      ${renderPhoto(images[1]?.url, images[1]?.alt || 'Bucatarie')}
      ${renderPhoto(images[2]?.url, images[2]?.alt || 'Dormitor')}
      ${renderPhoto(images[3]?.url, images[3]?.alt || 'Baie')}
    </div>

    <div class="gallery-separator"></div>

    <div class="bottom-grid">
      <div class="card">
        <h2>Detalii proprietate</h2>
        ${details.map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
      </div>
      <div class="card">
        <h2>De ce aceasta proprietate?</h2>
        <ul class="check-list">${renderList(reasons.slice(0, 6))}</ul>
      </div>
      <div class="card contact-card">
        <h2>Contact</h2>
        <div class="contact-line">☎ ${escapeHtml(agentPhone)}</div>
        <div class="contact-line">✉ ${escapeHtml(agentEmail)}</div>
        <div class="contact-line">♙ ${escapeHtml(agentName)}</div>
        <div class="contact-line">⌂ Programeaza o vizionare</div>
        <div class="signature">Te asteptam!</div>
      </div>
    </div>

    <div class="page-map">
      ${
        mapEmbedUrl
          ? `<iframe src="${escapeHtml(mapEmbedUrl)}" loading="eager" referrerpolicy="no-referrer-when-downgrade"></iframe>`
          : mapImageUrl
            ? `<img class="page-map-fallback" src="${escapeHtml(mapImageUrl)}" alt="Harta proprietatii" />`
            : ''
      }
      <div class="map-label">
        <strong>Pozitionarea proprietatii</strong>
        ${escapeHtml(location || property.location || 'Locatia proprietatii')}
      </div>
    </div>

    <div class="qr-cta">
      <div>
        <h2>Scaneaza codul QR</h2>
        <p>Deschide pagina publica a proprietatii pentru galeria completa, detalii actualizate si programarea unei vizionari.</p>
      </div>
      ${
        qrCodeUrl
          ? `<img class="qr-code" src="${escapeHtml(qrCodeUrl)}" alt="Cod QR pentru pagina publica a proprietatii" />`
          : '<div class="qr-placeholder">Link public indisponibil</div>'
      }
    </div>

    <div class="footer-line">
      <span>⌖ ${escapeHtml(location || property.location || '')}</span>
      <span>${escapeHtml(agency?.name || 'ImoDeus')} · O locuinta prezentata clar, pentru o decizie buna.</span>
    </div>
  </section>

  <section class="page page-two">
    <div class="topline">
      <span>${escapeHtml(agency?.name || 'ImoDeus')}</span>
      <span>${escapeHtml(property.title)}</span>
    </div>
    <div class="description-grid">
      <main>
        <p class="kicker">Descriere premium</p>
        <h2>Contextul proprietatii</h2>
        <div class="description">${escapeHtml(fullDescription)}</div>
        <div class="map-card">${mapImageUrl ? `<img src="${escapeHtml(mapImageUrl)}" alt="Harta proprietatii" />` : ''}</div>
      </main>
      <aside>
        <p class="kicker">Facilitati apropiate</p>
        <h2>Ce conteaza in zona</h2>
        <ul class="facility-list">${renderList(facilities.length ? facilities : ['Transport public', 'Magazine si servicii', 'Zone verzi', 'Scoli si gradinite', 'Acces rutier rapid'])}</ul>
      </aside>
    </div>
  </section>
</body>
</html>`;
}
