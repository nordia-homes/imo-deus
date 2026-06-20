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
  const descriptionParagraphs = truncateDescriptionParagraphs(splitDescriptionParagraphs(property.description), 1260);
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
      background: #ffffff;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      padding: 10mm;
      background: #ffffff;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .cover-hero {
      display: grid;
      grid-template-columns: 43% 57%;
      height: 60mm;
      border-radius: 26px;
      overflow: hidden;
      background: #062f36;
      border: 1px solid rgba(15, 118, 110, 0.72);
      box-shadow: 0 4mm 10mm rgba(15, 23, 42, 0.16);
    }
    .hero-copy {
      padding: 6mm 8mm 6mm 3mm;
      background: transparent;
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
      border: 1px solid rgba(167, 243, 208, 0.75);
      border-radius: 999px;
      background: rgba(236, 253, 245, 0.96);
      color: #047857;
      padding: 0 3.5mm;
      font-size: 14px;
      font-weight: 800;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .zone-wow svg {
      width: 6.4mm;
      height: 6.4mm;
      flex: 0 0 auto;
      color: #0f766e;
    }
    .zone-wow span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kicker {
      width: var(--title-width, 62mm);
      margin: 0 0 2.5mm;
      color: rgba(224, 242, 254, 0.84);
      font-size: 8.8px;
      letter-spacing: 0.38em;
      text-align: center;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: #ffffff;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 24px;
      font-weight: 400;
      line-height: 1;
      white-space: nowrap;
    }
    h1 span {
      display: inline;
      color: #99f6e4;
    }
    .title-block {
      display: inline-block;
      --title-width: 62mm;
      width: var(--title-width);
    }
    .accent-line {
      width: 100%;
      height: 0.8mm;
      background: #34d399;
      margin: 3mm auto 2.5mm;
    }
    .location-line {
      display: grid;
      grid-template-columns: 5mm 1fr;
      gap: 3mm;
      align-items: start;
      color: rgba(224, 242, 254, 0.84);
      font-size: 11px;
      line-height: 1.4;
      margin-bottom: 2.8mm;
    }
    .property-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3mm;
      width: var(--title-width, 62mm);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 16px;
      height: 8.8mm;
      padding: 0 4mm;
      background: rgba(255,255,255,0.1);
      color: #ffffff;
      font-size: 11px;
    }
    .address-wow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      width: var(--title-width, 62mm);
      margin-top: 1.2mm;
      margin-bottom: 3.2mm;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 16px;
      background: rgba(255,255,255,0.1);
      color: rgba(224, 242, 254, 0.9);
      height: 8.8mm;
      padding: 0 4mm;
      font-size: 9.2px;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .address-wow svg {
      width: 3.6mm;
      height: 3.6mm;
      flex: 0 0 auto;
      color: #99f6e4;
    }
    .address-wow span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .hero-text {
      margin: 2.8mm 0 0;
      color: rgba(240, 253, 250, 0.88);
      font-size: 9px;
      line-height: 1.34;
    }
    .hero-image {
      width: calc(100% - 5mm);
      height: calc(100% - 10mm);
      margin: 5mm 5mm 5mm 0;
      object-fit: contain;
      object-position: center;
      border-radius: 24px;
      border: 1px solid rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.92);
    }
    .benefits {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      margin: 4mm 0 4mm;
      padding: 2.4mm 1.5mm;
      border-radius: 22px;
      background: #ffffff;
      border: 1px solid #d6dee8;
      box-shadow: 0 2mm 7mm rgba(15, 23, 42, 0.12);
    }
    .benefit {
      min-height: 18mm;
      padding: 0 0.35mm;
      text-align: center;
      border-right: 1px solid #e2e8f0;
    }
    .benefit:last-child { border-right: 0; }
    .benefit-icon {
      color: #0f766e;
      font-size: 14px;
      line-height: 1;
      margin-bottom: 1.2mm;
    }
    .benefit-title {
      color: #0f172a;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    .benefit p {
      margin: 0;
      color: #475569;
      font-size: 9.2px;
      line-height: 1.2;
    }
    .section-title {
      margin: 0 0 2.5mm;
      text-align: center;
      color: #0f172a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 13.5px;
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
      background: #e2e8f0;
      display: block;
    }
    .photo.hero-image {
      width: calc(100% - 5mm);
      height: calc(100% - 10mm);
      object-fit: contain;
      object-position: center;
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
      border-top: 1px solid #e2e8f0;
      margin: -6mm 0 6mm;
    }
    .card {
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid #d6dee8;
      padding: 4.2mm;
      overflow: hidden;
      box-shadow: 0 2.4mm 7mm rgba(15, 23, 42, 0.13);
    }
    .card h2 {
      margin: 0 0 2.5mm;
      color: #0f172a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12.5px;
      font-weight: 400;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .detail-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 3mm;
      border-bottom: 1px solid #e2e8f0;
      padding: 1.45mm 0;
      color: #475569;
      font-size: 9.8px;
    }
    .detail-row strong {
      color: #0f172a;
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
      border-bottom: 1px solid #e2e8f0;
      padding: 1.45mm 0 1.45mm 6mm;
      color: #334155;
      font-size: 9.8px;
      line-height: 1.28;
    }
    .check-list li:last-child { border-bottom: 0; }
    .check-list li:before {
      content: "✓";
      position: absolute;
      left: 0;
      top: 1.55mm;
      width: 3.8mm;
      height: 3.8mm;
      border: 1px solid #99f6e4;
      border-radius: 50%;
      color: #0f766e;
      font-size: 8px;
      text-align: center;
      line-height: 3.8mm;
    }
    .contact-card {
      background: linear-gradient(135deg, #0f172a, #0f766e);
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
      font-size: 10px;
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
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 9.2px;
    }
    .page-map {
      position: relative;
      height: 36mm;
      margin-top: 8mm;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      overflow: hidden;
      background: #e2e8f0;
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
      padding: 2.5mm 3.2mm;
      color: #475569;
      font-size: 9.2px;
      line-height: 1.3;
    }
    .map-label strong {
      display: block;
      margin-bottom: 0.8mm;
      color: #0f172a;
      font-size: 10.4px;
    }
    .qr-cta {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6mm;
      align-items: center;
      min-height: 23mm;
      margin-top: 3mm;
      border-radius: 22px;
      background: linear-gradient(135deg, #0f172a, #0f766e);
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
      font-size: 10px;
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
      background: #ffffff;
    }
    .topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: calc(var(--page-one-footer-height) + 1.4mm);
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0;
      color: #69665e;
      font-size: 9.4px;
      line-height: 1.2;
    }
    .description-grid {
      display: grid;
      grid-template-columns: 1.08fr 0.92fr;
      gap: 6mm;
      height: 154mm;
      min-height: 0;
      overflow: visible;
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
      height: 100%;
    }
    .description-panel {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    .page-two-panel {
      border: 1px solid #d6dee8;
      border-radius: 18px;
      background: #ffffff;
      padding: 4.2mm;
      overflow: hidden;
      box-shadow: 0 2.4mm 7mm rgba(15, 23, 42, 0.13);
    }
    .page-two h2 {
      margin: 0 0 3mm;
      color: #0f172a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 22px;
      font-weight: 400;
    }
    .page-two .kicker {
      width: auto;
      margin-bottom: 2mm;
      text-align: left;
      color: #0f766e;
      letter-spacing: 0.36em;
    }
    .description {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
      padding-bottom: 5mm;
      color: #0f172a;
      font-size: 12.4px;
      line-height: 1.46;
    }
    .description:after {
      content: "...";
      position: absolute;
      right: 0;
      bottom: 0;
      padding-left: 12mm;
      background: linear-gradient(90deg, rgba(255,255,255,0), #fff 38%);
      color: #0f172a;
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
      gap: 1.8mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .facility-list li {
      border: 1px solid #e2e8f0;
      border-radius: 2.6mm;
      background: #fff;
      padding: 2.4mm 2.7mm;
      color: #334155;
      font-size: 11px;
      line-height: 1.25;
    }
    .nearby-list {
      display: grid;
      gap: 1mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .nearby-list li {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2.2mm;
      align-items: center;
      border: 1px solid #d6dee8;
      border-radius: 12px;
      background: #ffffff;
      padding: 1.45mm 2.1mm;
      box-shadow: 0 1.3mm 4mm rgba(15, 23, 42, 0.08);
    }
    .nearby-label {
      display: block;
      color: #0f766e;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 0.45mm;
    }
    .nearby-name {
      display: block;
      color: #0f172a;
      font-size: 10.2px;
      font-weight: 700;
      line-height: 1.25;
    }
    .nearby-address {
      display: block;
      margin-top: 0.6mm;
      color: #64748b;
      font-size: 7.9px;
      line-height: 1.15;
    }
    .nearby-time {
      min-width: 20mm;
      border-radius: 999px;
      background: #ccfbf1;
      color: #0f766e;
      padding: 1.5mm 2mm;
      font-size: 8.7px;
      font-weight: 800;
      text-align: center;
      white-space: nowrap;
    }
    .map-card {
      margin-top: 4mm;
      height: 51mm;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background:
        linear-gradient(90deg, rgba(15, 118, 110, 0.08) 1px, transparent 1px),
        linear-gradient(rgba(15, 118, 110, 0.08) 1px, transparent 1px),
        #e2e8f0;
      background-size: 10mm 10mm;
    }
    .map-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .buyer-cta-grid {
      display: grid;
      grid-template-rows: repeat(3, 1fr);
      gap: 1.6mm;
      margin-top: 2mm;
      flex: 1;
      min-height: 0;
    }
    .buyer-cta-card {
      display: grid;
      grid-template-columns: 6.4mm 1fr;
      gap: 1.8mm;
      align-items: center;
      border: 1px solid #d6dee8;
      border-radius: 18px;
      background: #ffffff;
      padding: 1.8mm 2.4mm;
      color: #334155;
      box-shadow: 0 2.4mm 7mm rgba(15, 23, 42, 0.13);
    }
    .buyer-cta-card.featured {
      background: linear-gradient(135deg, #0f172a, #0f766e);
      border-color: #0f766e;
      color: #fff;
    }
    .buyer-cta-card.featured strong {
      margin-bottom: 0;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.08;
    }
    .buyer-cta-card.featured span {
      display: none;
    }
    .buyer-cta-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 6.4mm;
      height: 6.4mm;
      border-radius: 50%;
      background: #ccfbf1;
      color: #0f766e;
      font-size: 9.6px;
      line-height: 1;
    }
    .buyer-cta-card.featured .buyer-cta-icon {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }
    .buyer-cta-card strong {
      display: block;
      margin-bottom: 0.35mm;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11.6px;
      font-weight: 400;
      line-height: 1.15;
    }
    .buyer-cta-card span {
      display: block;
      color: inherit;
      opacity: 0.84;
      font-size: 8.2px;
      line-height: 1.12;
    }
    .page-two-cta-stack {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
      margin-top: 0;
    }
    .page-two-divider {
      height: 0;
      margin-top: 4mm;
      border-top: 1px solid #e2e8f0;
    }
    .page-two-photo-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2mm;
      height: 39mm;
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
      border-radius: 22px;
      border: 1px solid #d6dee8;
      background: #ffffff;
      padding: 3mm 5mm;
      color: #334155;
      box-shadow: 0 2mm 6mm rgba(15, 23, 42, 0.11);
    }
    .page-two-wide-cta.dark {
      background: linear-gradient(135deg, #0f172a, #0f766e);
      border-color: #0f766e;
      color: #fff;
    }
    .page-two-wide-cta h2 {
      margin: 0 0 1.4mm;
      font-size: 16px;
    }
    .page-two-wide-cta.dark h2 {
      color: #fff;
    }
    .page-two-wide-cta p {
      margin: 0;
      color: inherit;
      opacity: 0.82;
      font-size: 9.8px;
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
      font-size: 12px;
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
      font-size: 9.2px;
      line-height: normal;
    }
    .buyer-page {
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 5mm;
      background: #ffffff;
    }
    .buyer-hero {
      display: grid;
      grid-template-columns: 1fr 52mm;
      gap: 8mm;
      align-items: center;
      min-height: 58mm;
      border-radius: 24px;
      background: linear-gradient(135deg, #0f172a 0%, #0f766e 100%);
      color: #fff;
      padding: 8mm;
      box-shadow: 0 4mm 10mm rgba(15, 23, 42, 0.16);
    }
    .buyer-hero .kicker {
      width: auto;
      margin: 0 0 3mm;
      color: rgba(204, 251, 241, 0.9);
      text-align: left;
      letter-spacing: 0.34em;
    }
    .buyer-hero h2 {
      margin: 0;
      max-width: 118mm;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 30px;
      font-weight: 400;
      line-height: 1.05;
    }
    .buyer-hero p {
      margin: 4mm 0 0;
      max-width: 112mm;
      color: rgba(240, 253, 250, 0.9);
      font-size: 12.2px;
      line-height: 1.42;
    }
    .zero-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 48mm;
      height: 48mm;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.12);
      box-shadow: inset 0 0 0 1mm rgba(255,255,255,0.06);
      text-align: center;
    }
    .zero-badge strong {
      display: block;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 42px;
      line-height: 0.95;
    }
    .zero-badge span {
      display: block;
      margin-top: 2mm;
      color: rgba(240, 253, 250, 0.86);
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .buyer-proof-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3mm;
    }
    .buyer-proof-card,
    .buyer-step-card,
    .buyer-final-card {
      border: 1px solid #d6dee8;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 2.4mm 7mm rgba(15, 23, 42, 0.13);
    }
    .buyer-proof-card {
      padding: 4mm;
      min-height: 39mm;
    }
    .buyer-proof-card strong {
      display: block;
      margin-bottom: 2mm;
      color: #0f172a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.14;
    }
    .buyer-proof-card p {
      margin: 0;
      color: #475569;
      font-size: 10px;
      line-height: 1.35;
    }
    .buyer-proof-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 8mm;
      height: 8mm;
      margin-bottom: 2.5mm;
      border-radius: 50%;
      background: #ccfbf1;
      color: #0f766e;
      font-size: 12px;
      font-weight: 800;
    }
    .buyer-section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 8mm;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3mm;
    }
    .buyer-section-heading h2 {
      margin: 0;
      color: #0f172a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 21px;
      font-weight: 400;
      line-height: 1.1;
    }
    .buyer-section-heading p {
      margin: 0;
      max-width: 78mm;
      color: #64748b;
      font-size: 10px;
      line-height: 1.35;
      text-align: right;
    }
    .buyer-steps {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3mm;
    }
    .buyer-step-card {
      padding: 3.5mm;
      min-height: 43mm;
    }
    .buyer-step-card b {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 7mm;
      height: 7mm;
      margin-bottom: 2.5mm;
      border-radius: 50%;
      background: #0f766e;
      color: #fff;
      font-size: 10px;
    }
    .buyer-step-card strong {
      display: block;
      margin-bottom: 1.8mm;
      color: #0f172a;
      font-size: 12px;
      line-height: 1.18;
    }
    .buyer-step-card span {
      display: block;
      color: #475569;
      font-size: 9.4px;
      line-height: 1.28;
    }
    .buyer-final-card {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6mm;
      align-items: center;
      padding: 5mm 6mm;
      background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
    }
    .buyer-final-card h2 {
      margin: 0 0 2mm;
      color: #0f172a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 22px;
      font-weight: 400;
      line-height: 1.08;
    }
    .buyer-final-card p {
      margin: 0;
      max-width: 126mm;
      color: #475569;
      font-size: 10.6px;
      line-height: 1.38;
    }
    .buyer-final-actions {
      display: grid;
      gap: 2mm;
      min-width: 39mm;
    }
    .buyer-final-phone {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 10mm;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      padding: 0 4mm;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .buyer-final-qr {
      justify-self: center;
      width: 22mm;
      height: 22mm;
      border-radius: 2mm;
      background: #fff;
      padding: 1mm;
      object-fit: contain;
      border: 1px solid #e2e8f0;
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
              <strong>Comision cumparator: 0%</strong>
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

  <section class="page buyer-page">
    <div class="topline">
      <span>${escapeHtml(agency?.name || 'ImoDeus')}</span>
      <span>Avantaje pentru cumparator</span>
    </div>
    <div class="buyer-hero">
      <div>
        <p class="kicker">CUMPERI CU GHIDARE, NU CU PRESIUNE</p>
        <h2>Ai langa tine o echipa care te ajuta sa cumperi mai sigur, mai clar si cu 0% comision.</h2>
        <p>Nu platesti comision agentiei noastre. Primesti insa un proces coordonat: informatii clare, verificari, sprijin in negociere, conexiune cu finantarea si asistenta pana la semnare.</p>
      </div>
      <div class="zero-badge">
        <strong>0%</strong>
        <span>comision cumparator</span>
      </div>
    </div>
    <div class="buyer-proof-grid">
      <div class="buyer-proof-card">
        <div class="buyer-proof-icon">1</div>
        <strong>Claritate inainte de oferta</strong>
        <p>Iti explicam proprietatea, pretul, zona, documentele disponibile si pasii reali ai tranzactiei, ca sa nu iei decizia pe fuga.</p>
      </div>
      <div class="buyer-proof-card">
        <div class="buyer-proof-icon">2</div>
        <strong>Sprijin in negociere</strong>
        <p>Te ajutam sa formulezi o oferta corecta, argumentata si usor de sustinut, fara presiune inutila si fara promisiuni vagi.</p>
      </div>
      <div class="buyer-proof-card">
        <div class="buyer-proof-icon">3</div>
        <strong>Finantare mai usoara</strong>
        <p>Te putem conecta cu brokeri de credit pentru simulare, preaprobare si intelegerea costurilor totale inainte de angajament.</p>
      </div>
    </div>
    <div>
      <div class="buyer-section-heading">
        <h2>Ce primesti concret in proces</h2>
        <p>Un traseu simplu, cu fiecare pas clar, de la vizionare pana la semnarea contractului.</p>
      </div>
      <div class="buyer-steps" style="margin-top: 3mm;">
        <div class="buyer-step-card">
          <b>01</b>
          <strong>Vizionare pregatita</strong>
          <span>Stii ce vezi, ce trebuie intrebat si ce merita verificat la fata locului.</span>
        </div>
        <div class="buyer-step-card">
          <b>02</b>
          <strong>Documente si context</strong>
          <span>Centralizam informatiile relevante si iti semnalam ce trebuie clarificat mai departe.</span>
        </div>
        <div class="buyer-step-card">
          <b>03</b>
          <strong>Oferta si negociere</strong>
          <span>Transformam interesul intr-o oferta coerenta, cu pasi si termene usor de urmarit.</span>
        </div>
        <div class="buyer-step-card">
          <b>04</b>
          <strong>Coordonare pana la final</strong>
          <span>Tinem legatura cu partile implicate, pentru ca tranzactia sa avanseze ordonat.</span>
        </div>
      </div>
    </div>
    <div class="buyer-final-card">
      <div>
        <h2>O achizitie buna nu inseamna doar o proprietate buna. Inseamna si un proces bun.</h2>
        <p>Scopul nostru este sa ajungi la decizie cu incredere: sa intelegi ce cumperi, cat te costa, ce urmeaza si cine te ajuta in fiecare etapa.</p>
      </div>
      <div class="buyer-final-actions">
        <div class="buyer-final-phone">${escapeHtml(agentPhone)}</div>
        ${
          qrCodeUrl
            ? `<img class="buyer-final-qr" src="${escapeHtml(qrCodeUrl)}" alt="Cod QR pentru pagina publica a proprietatii" />`
            : '<div class="qr-placeholder">Link public indisponibil</div>'
        }
      </div>
    </div>
    <div class="footer-line">
      <span>0% comision pentru cumparator</span>
      <span>${escapeHtml(agency?.name || 'ImoDeus')} · Ghidare clara pana la semnare.</span>
    </div>
  </section>
</body>
</html>`;
}
