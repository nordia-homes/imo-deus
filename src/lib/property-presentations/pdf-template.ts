import type { Agency, Property, UserProfile } from '@/lib/types';
import type { NearbyObjective } from '@/lib/property-presentations/nearby-google';

export type PropertyPresentationTemplateInput = {
  property: Property;
  agency: Agency | null;
  agent: UserProfile | null;
  generatedAt: Date;
  publicPropertyUrl?: string | null;
  nearbyObjectives?: NearbyObjective[];
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

function splitDescriptionParagraphs(value?: string | null) {
  const source = (value || '').trim();
  if (!source) {
    return [
      'Descrierea proprietatii va fi completata cu detalii despre pozitionare, compartimentare, finisaje si avantajele relevante pentru cumparator.',
    ];
  }

  return source
    .split(/\r?\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function truncateDescriptionParagraphs(paragraphs: string[], maxLength: number) {
  const output: string[] = [];
  let used = 0;

  for (const paragraph of paragraphs) {
    const separatorLength = output.length ? 2 : 0;
    if (used + separatorLength + paragraph.length <= maxLength) {
      output.push(paragraph);
      used += separatorLength + paragraph.length;
      continue;
    }

    const remaining = maxLength - used - separatorLength;
    if (remaining > 24) {
      output.push(`${paragraph.slice(0, remaining - 3).trim()}...`);
    }
    break;
  }

  return output.length ? output : paragraphs.slice(0, 1);
}

function renderParagraphs(paragraphs: string[]) {
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
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
  const { property, agency, agent, publicPropertyUrl, nearbyObjectives = [] } = input;
  const images = property.images || [];
  const displaySurface = property.totalSurface ?? property.squareFootage;
  const location = [property.zone || property.location, property.address].filter(Boolean).join(' - ');
  const shortDescription =
    truncateText(property.description, 230) ||
    'O locuinta luminoasa, intr-o zona linistita, cu acces rapid la punctele importante ale orasului.';
  const descriptionParagraphs = truncateDescriptionParagraphs(splitDescriptionParagraphs(property.description), 1550);
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
      padding: 6mm 8mm 5mm 3mm;
      background:
        linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,0.68)),
        radial-gradient(circle at 0 0, rgba(141,128,101,0.16), transparent 36mm),
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
      flex: 0 0 auto;
    }
    .mark-row {
      display: flex;
      align-items: center;
      margin-bottom: 2.6mm;
    }
    .zone-wow {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 2mm;
      width: var(--title-width, 62mm);
      height: 12mm;
      border: 1px solid rgba(177, 156, 114, 0.36);
      border-radius: 2mm;
      background: linear-gradient(135deg, rgba(248, 242, 229, 0.98), rgba(255, 252, 246, 0.98));
      color: #8e7a51;
      padding: 0 3.5mm;
      font-size: 13px;
      font-weight: 800;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 3mm 8mm rgba(177, 156, 114, 0.14);
    }
    .zone-wow svg {
      width: 6.4mm;
      height: 6.4mm;
      flex: 0 0 auto;
      color: #b19c72;
    }
    .zone-wow span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kicker {
      width: var(--title-width, 62mm);
      margin: 0 0 2.5mm;
      color: #3d4039;
      font-size: 8px;
      letter-spacing: 0.38em;
      text-align: center;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: #36342f;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 22px;
      font-weight: 400;
      line-height: 1;
      white-space: nowrap;
    }
    h1 span {
      display: inline;
      color: #a9966d;
    }
    .title-block {
      display: inline-block;
      --title-width: 62mm;
      width: var(--title-width);
    }
    .accent-line {
      width: 100%;
      height: 0.8mm;
      background: #b19c72;
      margin: 3mm auto 2.5mm;
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
      justify-content: center;
      gap: 3mm;
      width: var(--title-width, 62mm);
      border: 1px solid #d8cfbc;
      border-radius: 2mm;
      height: 8.8mm;
      padding: 0 4mm;
      background: rgba(255,255,255,0.86);
      color: #3f403a;
      font-size: 10px;
    }
    .address-wow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      width: var(--title-width, 62mm);
      margin-top: 1.2mm;
      margin-bottom: 1mm;
      border: 1px solid #ded2bd;
      border-radius: 2mm;
      background: linear-gradient(135deg, #fffaf0, #ffffff);
      color: #514b40;
      height: 8.8mm;
      padding: 0 4mm;
      font-size: 8.2px;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 3mm 10mm rgba(108, 94, 62, 0.10);
    }
    .address-wow svg {
      width: 3.6mm;
      height: 3.6mm;
      flex: 0 0 auto;
      color: #a9966d;
    }
    .address-wow span {
      overflow: hidden;
      text-overflow: ellipsis;
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
      padding: 0 0.8mm;
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
      --page-one-footer-height: calc(3mm + 10.2px + 1px);
      display: grid;
      grid-template-rows: auto auto auto auto;
      align-content: start;
      gap: 1.6mm;
      padding-top: 2mm;
      padding-bottom: 4mm;
      background:
        radial-gradient(circle at 24mm 24mm, rgba(177,156,114,0.10), transparent 42mm),
        linear-gradient(180deg, #fbfaf6, #f8f5ef);
    }
    .topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: calc(var(--page-one-footer-height) + 1.4mm);
      border-bottom: 1px solid #e6dfd3;
      padding-bottom: 0;
      color: #69665e;
      font-size: 8.5px;
      line-height: 1.2;
    }
    .description-grid {
      display: grid;
      grid-template-columns: 1.08fr 0.92fr;
      gap: 6mm;
      height: 168mm;
      min-height: 0;
      overflow: hidden;
    }
    .description-grid main,
    .description-grid aside {
      min-height: 0;
    }
    .description-grid main {
      display: flex;
    }
    .description-grid aside {
      display: flex;
      flex-direction: column;
    }
    .description-panel {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    .page-two-panel {
      border: 1px solid #ebe5d8;
      border-radius: 3.5mm;
      background: rgba(255,255,255,0.92);
      box-shadow: 0 6mm 18mm rgba(51,49,42,0.06);
      padding: 4.5mm;
      overflow: hidden;
    }
    .page-two h2 {
      margin: 0 0 3mm;
      color: #34332f;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      font-weight: 400;
    }
    .page-two .kicker {
      width: auto;
      margin-bottom: 2mm;
      text-align: left;
      color: #8e7a51;
      letter-spacing: 0.36em;
    }
    .description {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
      padding-bottom: 5mm;
      color: #34332f;
      font-size: 9.5px;
      line-height: 1.45;
    }
    .description:after {
      content: "...";
      position: absolute;
      right: 0;
      bottom: 0;
      padding-left: 12mm;
      background: linear-gradient(90deg, rgba(255,255,255,0), #fff 38%);
      color: #34332f;
      font-weight: 700;
    }
    .description p {
      margin: 0 0 2.6mm;
    }
    .description p:last-child {
      margin-bottom: 0;
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
    .nearby-list {
      display: grid;
      gap: 1.8mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .nearby-list li {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4mm;
      align-items: center;
      border: 1px solid #e5ded1;
      border-radius: 2.6mm;
      background: rgba(255,255,255,0.96);
      padding: 2.5mm 3mm;
    }
    .nearby-label {
      display: block;
      color: #8e7a51;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 0.7mm;
    }
    .nearby-name {
      display: block;
      color: #403c34;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.25;
    }
    .nearby-address {
      display: block;
      margin-top: 0.6mm;
      color: #756f63;
      font-size: 7.4px;
      line-height: 1.2;
    }
    .nearby-time {
      min-width: 20mm;
      border-radius: 999px;
      background: #f8f2e5;
      color: #8e7a51;
      padding: 1.8mm 2.5mm;
      font-size: 8px;
      font-weight: 800;
      text-align: center;
      white-space: nowrap;
    }
    .map-card {
      margin-top: 4mm;
      height: 51mm;
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
    .buyer-cta-grid {
      display: grid;
      gap: 2.2mm;
      margin-top: 4mm;
    }
    .buyer-cta-card {
      display: grid;
      grid-template-columns: 8mm 1fr;
      gap: 2.8mm;
      align-items: start;
      border: 1px solid #e5ded1;
      border-radius: 3mm;
      background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,242,229,0.92));
      padding: 3mm;
      color: #4c483f;
    }
    .buyer-cta-card.featured {
      background: #65705f;
      border-color: #65705f;
      color: #fff;
    }
    .buyer-cta-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 8mm;
      height: 8mm;
      border-radius: 50%;
      background: #f8f2e5;
      color: #9b895d;
      font-size: 12px;
      line-height: 1;
    }
    .buyer-cta-card.featured .buyer-cta-icon {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }
    .buyer-cta-card strong {
      display: block;
      margin-bottom: 0.9mm;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11px;
      font-weight: 400;
      line-height: 1.15;
    }
    .buyer-cta-card span {
      display: block;
      color: inherit;
      opacity: 0.84;
      font-size: 8.2px;
      line-height: 1.32;
    }
    .page-two-cta-stack {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
      margin-top: 0;
    }
    .page-two-divider {
      height: 0;
      margin-top: 2.4mm;
      border-top: 1px solid #e6dfd3;
    }
    .page-two-photo-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2mm;
      height: 41mm;
      margin-top: 3mm;
      margin-bottom: 4mm;
      overflow: hidden;
      position: relative;
      z-index: 1;
    }
    .page-two-photo-strip .photo {
      width: 100%;
      height: 100%;
      border-radius: 2mm;
      object-fit: cover;
      object-position: center 56%;
      box-shadow: none;
    }
    .page-two-wide-cta {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 5mm;
      align-items: center;
      min-height: 23mm;
      border-radius: 3mm;
      border: 1px solid #e5ded1;
      background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,242,229,0.96));
      box-shadow: 0 6mm 18mm rgba(51,49,42,0.06);
      padding: 3mm 5mm;
      color: #403c34;
    }
    .page-two-wide-cta.dark {
      background: #65705f;
      border-color: #65705f;
      color: #fff;
    }
    .page-two-wide-cta h2 {
      margin: 0 0 1.4mm;
      font-size: 15px;
    }
    .page-two-wide-cta.dark h2 {
      color: #fff;
    }
    .page-two-wide-cta p {
      margin: 0;
      color: inherit;
      opacity: 0.82;
      font-size: 8.8px;
      line-height: 1.35;
    }
    .page-two-phone {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 35mm;
      height: 10mm;
      border-radius: 2mm;
      background: rgba(255,255,255,0.16);
      color: #fff;
      padding: 0 4mm;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .page-two-qr {
      width: 20mm;
      height: 20mm;
      border-radius: 2mm;
      background: #fff;
      padding: 1mm;
      object-fit: contain;
    }
    .page-two .footer-line {
      height: auto;
      margin-top: 3mm;
      padding-top: 3mm;
      font-size: 8.5px;
      line-height: normal;
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="cover-hero">
      <div class="hero-copy">
        <div class="mark-row">
          <div class="zone-wow">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/></svg>
            <span>${escapeHtml(property.zone || property.location || 'Zona proprietatii')}</span>
          </div>
        </div>
        <p class="kicker">ACASA POATE INCEPE AICI!</p>
        <div class="title-block">
          <h1>Proprietate <span>de vanzare</span></h1>
          <div class="accent-line"></div>
        </div>
        <div class="property-pill">▭ ${escapeHtml(property.rooms || '-')} camere · ${escapeHtml(formatNumber(displaySurface))} mp · ${escapeHtml(formatPrice(property.price))}</div>
        <div class="address-wow">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          <span>${escapeHtml(property.address || 'Adresa disponibila la cerere')}</span>
        </div>
      </div>
      ${renderPhoto(images[0]?.url, images[0]?.alt || property.title, 'hero-image')}
    </div>

    <div class="benefits">
      <div class="benefit">
        <div class="benefit-icon">♧</div>
        <div class="benefit-title">Zona dezvoltata</div>
        <p>Ai aproape servicii utile,<br />comert, scoli si transport<br />pentru ritmul zilnic.</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">▤</div>
        <div class="benefit-title">Acces excelent</div>
        <p>Te misti usor prin oras,<br />cu legaturi rapide catre<br />puncte importante.</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">▥</div>
        <div class="benefit-title">Confort zilnic</div>
        <p>Spatii clare si practice,<br />gandite pentru folosire<br />usoara in fiecare zi.</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">◇</div>
        <div class="benefit-title">Alegerea ideala</div>
        <p>O optiune echilibrata,<br />usor de evaluat si buna<br />pentru locuit sau investitie.</p>
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
        <div class="page-two-panel description-panel">
          <p class="kicker">Descriere premium</p>
          <h2>Contextul proprietatii</h2>
          <div class="description">${renderParagraphs(descriptionParagraphs)}</div>
        </div>
      </main>
      <aside>
        <div class="page-two-panel">
          <p class="kicker">Facilitati apropiate</p>
          <h2>Obiective importante in apropiere</h2>
          ${
            nearbyObjectives.length
              ? `<ul class="nearby-list">${nearbyObjectives.map((item) => `<li><span><span class="nearby-label">${escapeHtml(item.label)}</span><span class="nearby-name">${escapeHtml(item.name)}</span>${item.address ? `<span class="nearby-address">${escapeHtml(item.address)}</span>` : ''}</span><strong class="nearby-time">${escapeHtml(item.walkingText)}</strong></li>`).join('')}</ul>`
              : `<ul class="facility-list">${renderList(facilities.length ? facilities : ['Transport public', 'Magazine si servicii', 'Zone verzi', 'Scoli si gradinite', 'Acces rutier rapid'])}</ul>`
          }
        </div>
        <div class="buyer-cta-grid">
          <div class="buyer-cta-card featured">
            <div class="buyer-cta-icon">%</div>
            <div>
              <strong>Comision cumparator: 0</strong>
              <span>Comisionul perceput de agentia noastra este zero.</span>
            </div>
          </div>
          <div class="buyer-cta-card">
            <div class="buyer-cta-icon">EUR</div>
            <div>
              <strong>Finantare prin brokerul nostru</strong>
              <span>Te putem conecta cu un broker de credite pentru simulare, preaprobare si alegerea solutiei potrivite.</span>
            </div>
          </div>
          <div class="buyer-cta-card">
            <div class="buyer-cta-icon">OK</div>
            <div>
              <strong>Alaturi de tine in tot procesul</strong>
              <span>Te ghidam de la prima vizionare pana la verificari, oferta, acte si semnarea tranzactiei.</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
    <div class="page-two-divider"></div>
    <div class="page-two-photo-strip">
      ${renderPhoto(images[0]?.url, images[0]?.alt || 'Imagine proprietate 1')}
      ${renderPhoto(images[1]?.url, images[1]?.alt || 'Imagine proprietate 2')}
      ${renderPhoto(images[2]?.url, images[2]?.alt || 'Imagine proprietate 3')}
      ${renderPhoto(images[3]?.url, images[3]?.alt || 'Imagine proprietate 4')}
    </div>
    <div class="page-two-cta-stack">
      <div class="page-two-wide-cta dark">
        <div>
          <h2>Contacteaza consultantul tau</h2>
          <p>Suna agentul pentru disponibilitate, detalii si urmatorii pasi.</p>
        </div>
        <div class="page-two-phone">${escapeHtml(agentPhone)}</div>
      </div>
      <div class="page-two-wide-cta">
        <div>
          <h2>Scaneaza codul QR</h2>
          <p>Acceseaza pagina publica a proprietatii pentru galerie, detalii actualizate si solicitare rapida.</p>
        </div>
        ${
          qrCodeUrl
            ? `<img class="page-two-qr" src="${escapeHtml(qrCodeUrl)}" alt="Cod QR pentru pagina publica a proprietatii" />`
            : '<div class="qr-placeholder">Link public indisponibil</div>'
        }
      </div>
    </div>
    <div class="footer-line">
      <span>⌖ ${escapeHtml(location || property.location || '')}</span>
      <span>${escapeHtml(agency?.name || 'ImoDeus')} · O locuinta prezentata clar, pentru o decizie buna.</span>
    </div>
  </section>
</body>
</html>`;
}
