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

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

function shorten(value: unknown, max: number) {
  const text = clean(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '').trim()}…`;
}

function formatPrice(value?: number | null) {
  return value && Number.isFinite(value)
    ? `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)} €`
    : 'LA CERERE';
}

function formatNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(value)
    : '—';
}

function unique(values: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = clean(raw);
    const key = value.toLocaleLowerCase('ro-RO');
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function splitList(value?: string | null) {
  return String(value ?? '').split(/[,;\n]/).map(clean).filter(Boolean);
}

function renderPhoto(url: string | undefined, alt: string, className = '') {
  return url
    ? `<img class="photo ${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`
    : `<div class="photo photo-empty ${className}"><span>IMAGINE<br />PROPRIETATE</span></div>`;
}

function icon(name: 'area' | 'bath' | 'room' | 'heat' | 'kitchen' | 'floor' | 'building' | 'leaf' | 'finish' | 'pin' | 'person' | 'phone' | 'mail' | 'home') {
  const paths = {
    area: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 8h8v8H8z"/>',
    bath: '<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Zm2 0V7a3 3 0 0 1 6 0"/>',
    room: '<path d="M5 3v18M19 3v18M5 17h14M8 17V8h8v9M3 21h18"/>',
    heat: '<path d="M7 20c-2-4 2-5 0-9S9 6 8 3M12 20c-2-4 2-5 0-9s2-5 1-8M17 20c-2-4 2-5 0-9s2-5 1-8"/>',
    kitchen: '<path d="M4 4h16v16H4zM12 4v16M7 7v4M17 7v4M7 15h2M16 15h2"/>',
    floor: '<path d="M3 20h4v-4h4v-4h4V8h4V4h2"/>',
    building: '<path d="M5 21V6h9v15M14 10h5v11M8 9h3M8 13h3M8 17h3M16 13h1M16 17h1M3 21h18"/>',
    leaf: '<path d="M20 4C10 4 5 9 5 15c0 3 2 5 5 5 6 0 10-6 10-16ZM4 21c3-7 7-10 13-13"/>',
    finish: '<path d="M4 5h11v6H4zM15 8h3a2 2 0 0 1 2 2v3h-8v7M9 20h6"/>',
    pin: '<path d="M12 22s7-6 7-13A7 7 0 1 0 5 9c0 7 7 13 7 13Z"/><circle cx="12" cy="9" r="2"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
    phone: '<path d="M6 3h4l2 5-3 2c2 4 4 6 8 8l2-3 5 2v4c0 2-2 3-4 3C10 22 2 14 2 6c0-2 2-3 4-3Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    home: '<path d="m3 11 9-8 9 8M6 10v11h12V10M10 21v-7h4v7"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

export function renderPropertyPresentationHtml(input: PropertyPresentationTemplateInput) {
  const { property, agency, agent, publicPropertyUrl, nearbyObjectives = [] } = input;
  const images = property.images || [];
  const surface = property.totalSurface ?? property.squareFootage;
  const agencyName = clean(agency?.name) || 'ImoDeus';
  const agentName = clean(agent?.name || property.agentName || property.agent?.name) || 'Consultant imobiliar';
  const agentPhone = clean(agent?.phone || agency?.phone) || '07XX XXX XXX';
  const agentEmail = clean(agent?.email || agency?.email) || 'contact@agentie.ro';
  const location = unique([property.address, property.zone || property.location, property.city], 3).join(', ') || 'Adresă disponibilă la cerere';
  const title = property.propertyType
    ? unique([
        property.propertyType,
        property.rooms ? `${property.rooms} camere` : null,
        property.partitioning,
      ], 3).join(' ')
    : shorten(property.title, 48) || 'Proprietate deosebită';
  const titleSize = title.length > 42 ? 28 : title.length > 30 ? 31 : 35;
  const subline = unique([
    property.bathrooms ? `${property.bathrooms} ${property.bathrooms === 1 ? 'baie' : 'băi'}` : null,
    property.heatingSystem,
    property.balconyTerrace,
  ], 3).join('  •  ');
  const sellingLine = shorten(property.tagline, 70) || 'Un cămin pentru o viață mai bună.';
  const qrUrl = publicPropertyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(publicPropertyUrl)}`
    : '';
  const logo = agency?.logoUrl
    ? `<img src="${escapeHtml(agency.logoUrl)}" alt="${escapeHtml(agencyName)}" />`
    : `<div class="logo-house">${icon('home')}</div><strong>${escapeHtml(agencyName)}</strong>`;

  const primarySpecs = [
    { icon: 'area' as const, value: `${formatNumber(surface)} m²`, label: 'Suprafață', note: 'Spațiu bine valorificat' },
    { icon: 'bath' as const, value: `${property.bathrooms || '—'} ${property.bathrooms === 1 ? 'baie' : 'băi'}`, label: 'Confort', note: 'Pentru ritmul familiei' },
    { icon: 'room' as const, value: `${property.rooms || '—'} camere`, label: 'Compartimentare', note: clean(property.partitioning) || 'Funcțională și practică' },
    { icon: 'heat' as const, value: shorten(property.heatingSystem, 24) || 'Confort termic', label: 'Încălzire', note: 'Control și eficiență' },
    { icon: 'kitchen' as const, value: shorten(property.kitchen, 22) || shorten(property.interiorState, 22) || 'Bucătărie', label: 'Funcționalitate', note: 'Gândită pentru zi de zi' },
  ];

  const secondarySpecs = [
    { icon: 'floor' as const, value: property.floor ? `Etaj ${property.floor}${property.totalFloors ? ` / ${property.totalFloors}` : ''}` : 'Etaj —' },
    { icon: 'building' as const, value: property.constructionYear ? `Construit în ${property.constructionYear}` : property.buildingState || 'Imobil îngrijit' },
    { icon: 'leaf' as const, value: property.orientation ? `Orientare ${property.orientation}` : 'Lumină naturală' },
    { icon: 'finish' as const, value: shorten(property.interiorState, 26) || 'Finisaje atent alese' },
  ];

  const galleryLabels = unique([
    ...splitList(property.keyFeatures),
    'Living spațios', 'Bucătărie funcțională', 'Dormitor luminos', 'Spațiu exterior',
  ], 4);
  const galleryNotes = ['Atmosferă primitoare', 'Confort pentru fiecare zi', 'Un loc bun pentru relaxare', 'Mai mult aer și libertate'];
  const nearby = nearbyObjectives.slice(0, 4);

  return `<!doctype html><html lang="ro"><head><meta charset="utf-8" /><title>${escapeHtml(property.title)} — prezentare</title><style>
    @page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#ddd;color:#211d19;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{position:relative;width:210mm;height:297mm;overflow:hidden;background:radial-gradient(circle at 12% 8%,#fff 0,#f8f3ea 35%,#eee5d8 100%);padding:5.5mm}.photo{display:block;width:100%;height:100%;min-width:0;min-height:0;object-fit:cover}.photo-empty{display:grid;place-items:center;background:linear-gradient(145deg,#d8cdbc,#a99070);color:#fff;font-size:7px;font-weight:700;letter-spacing:.13em;text-align:center}svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.hero{position:relative;height:119mm;overflow:hidden;border-radius:0 0 5mm 5mm}.hero-photo{position:absolute;inset:0 0 0 65mm;overflow:hidden}.hero-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(51,39,26,.04),rgba(51,39,26,.02) 68%,rgba(51,39,26,.16))}.hero-copy{position:absolute;z-index:3;top:-8mm;bottom:-8mm;left:-6mm;width:88mm;border-radius:0 48% 48% 0;background:linear-gradient(105deg,#fff 0,#fffaf2 75%,#eee3d3 100%);padding:14mm 11mm}.brand{display:flex;flex-direction:column;align-items:center;width:62mm;color:#4e361e;text-align:center}.brand img{display:block;max-width:52mm;max-height:15mm;object-fit:contain;filter:brightness(0) saturate(100%) sepia(36%) saturate(702%) hue-rotate(352deg) brightness(76%) contrast(88%)}.brand>strong{font-family:Georgia,serif;font-size:16px;font-weight:400;letter-spacing:.06em;text-transform:uppercase}.logo-house{width:14mm;height:10mm;margin-bottom:1mm}.brand:after{content:"";width:39mm;height:1px;margin-top:3mm;background:#b9a78d}.brand-tag{margin:1.5mm 0 0;color:#6e6153;font-size:6px;font-weight:700;letter-spacing:.34em;text-transform:uppercase}.title{margin:7mm 0 2.5mm;font-family:Georgia,'Times New Roman',serif;font-weight:400;line-height:.98;letter-spacing:-.025em}.subline{max-width:67mm;margin:0;color:#9c7042;font-family:Georgia,serif;font-size:11px;line-height:1.25}.address{display:grid;grid-template-columns:7mm 1fr;gap:2.5mm;align-items:start;max-width:67mm;margin-top:4.5mm;border-top:1px solid #bba98f;padding-top:3.5mm;font-family:Georgia,serif;font-size:9px;line-height:1.35}.address svg{color:#a67a48}.script{max-width:64mm;margin:6mm 0 0;color:#5b3e24;font-family:'Segoe Script','Bradley Hand',cursive;font-size:17px;font-style:italic;line-height:1.18;transform:rotate(-2deg)}.top-nav{position:absolute;z-index:2;top:5mm;right:8mm;color:#4d4338;font-size:6px;font-weight:700;letter-spacing:.17em;text-transform:uppercase}.promise{position:absolute;z-index:2;top:12mm;right:0;width:43mm;border-radius:3mm 0 0 3mm;background:rgba(52,53,40,.88);color:#fff;padding:4mm 5mm;font-size:8px;font-weight:700;line-height:1.45;letter-spacing:.06em;text-transform:uppercase}.price-band{position:absolute;z-index:4;right:0;bottom:4mm;display:grid;grid-template-columns:1fr 45mm;width:122mm;min-height:25mm;overflow:hidden;border:1px solid rgba(255,255,255,.9);border-radius:4mm;background:rgba(250,246,238,.9);box-shadow:0 2mm 6mm rgba(70,51,29,.12)}.price-main{background:linear-gradient(110deg,#9b7447,#b99768);color:#fff;padding:3.5mm 6mm}.price-main span{display:block;font-size:8px;letter-spacing:.15em;text-transform:uppercase}.price-main strong{display:block;font-family:Georgia,serif;font-size:27px;font-weight:400;line-height:1}.commission{display:grid;grid-template-columns:9mm 1fr;gap:3mm;align-items:center;padding:4mm;color:#30271f;font-size:7.5px;font-weight:700;line-height:1.3;text-transform:uppercase}.commission svg{color:#8b6337}.commission small{display:block;margin-top:1.5mm;border-top:1px solid #b8a990;padding-top:1.2mm;font-size:6.8px}
    .spec-panel{height:44mm;margin-top:2.5mm;border:1px solid rgba(145,119,85,.18);border-radius:4mm;background:rgba(255,255,255,.68);padding:3mm 4mm}.primary-specs{display:grid;grid-template-columns:repeat(5,1fr);height:27mm}.spec{text-align:center;border-left:1px solid rgba(132,107,75,.2);padding:0 2mm}.spec:first-child{border:0}.spec-icon{display:grid;place-items:center;width:10mm;height:10mm;margin:0 auto 1mm;border-radius:3mm;background:#f0e8dc;color:#75512f;padding:2mm}.spec strong{display:block;overflow:hidden;font-family:Georgia,serif;font-size:9px;line-height:1.15;white-space:nowrap;text-overflow:ellipsis}.spec span{display:block;margin-top:.8mm;color:#61564a;font-size:5.4px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}.spec em{display:block;margin-top:.5mm;color:#7c7064;font-size:5.3px;font-style:normal;line-height:1.15}.secondary-specs{display:grid;grid-template-columns:repeat(4,1fr);height:10mm;margin-top:2mm;border-top:1px solid rgba(132,107,75,.25);padding-top:2mm}.mini-spec{display:flex;align-items:center;justify-content:center;gap:2mm;border-left:1px solid rgba(132,107,75,.25);font-family:Georgia,serif;font-size:7px;font-weight:700}.mini-spec:first-child{border:0}.mini-spec i{display:block;width:6mm;height:6mm;color:#8e6336}
    .gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2mm;height:43mm;margin-top:2.5mm;overflow:hidden}.gallery-card{display:grid;grid-template-rows:minmax(0,30mm) 6mm 7mm;min-width:0;min-height:0;height:43mm;overflow:hidden;text-align:center}.gallery-card .photo{width:100%;height:30mm;min-height:0;border-radius:2.5mm}.gallery-card strong{position:relative;z-index:1;align-self:center;max-width:calc(100% - 4mm);margin:-2mm 2mm 0;border-radius:99px;background:#a47c4e;color:#fff;padding:1.4mm 1mm;font-size:6px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gallery-card span{align-self:end;overflow:hidden;color:#51483f;font-family:Georgia,serif;font-size:6.2px;line-height:1.15;white-space:nowrap;text-overflow:ellipsis}
    .bottom{display:grid;grid-template-columns:1.14fr .86fr;gap:3mm;height:43mm;margin-top:3mm}.nearby-title{display:flex;align-items:center;gap:3mm;margin:0 0 2mm;font-family:Georgia,serif;font-size:12px}.nearby-title:after{content:"";flex:1;height:1px;background:#a99072}.nearby-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5mm;height:34mm}.nearby-card{display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:2.5mm;background:rgba(255,255,255,.72);padding:2mm;text-align:center}.nearby-card i{display:block;width:7mm;height:7mm;margin-bottom:1mm;color:#9a6f3e}.nearby-card strong{font-family:Georgia,serif;font-size:6.5px;line-height:1.15}.nearby-card span{margin-top:1mm;color:#8b6036;font-family:Georgia,serif;font-size:6px}.contact{display:grid;grid-template-columns:1fr 25mm;gap:3mm;align-items:center;height:43mm;border-radius:3mm;background:linear-gradient(120deg,#464638,#25291f);color:#fff;padding:4mm}.contact-intro{margin:0 0 2mm;color:#ddd7cd;font-family:Georgia,serif;font-size:7px}.contact-row{display:grid;grid-template-columns:6mm 1fr;gap:2mm;align-items:center;margin:1.5mm 0}.contact-row i{display:block;width:5mm;height:5mm;color:#e7ddcc}.contact-row strong{font-family:Georgia,serif;font-size:9px;font-weight:400}.contact-row span{font-size:6.2px}.qr{width:25mm;height:25mm;border-radius:2mm;background:#fff;padding:1.2mm;object-fit:contain}.qr-empty{display:grid;place-items:center;color:#4d493f;font-size:5.5px;font-weight:700;text-align:center}.qr-label{margin-top:1mm;font-size:5px;font-weight:700;text-align:center;text-transform:uppercase}.footer{display:flex;align-items:center;justify-content:space-between;height:14mm;margin-top:2.5mm;border-top:1px solid rgba(124,99,69,.3);padding:2mm 4mm 0;color:#694a2b}.footer-benefits{display:flex;gap:7mm}.footer-benefits span{display:flex;align-items:center;gap:1.5mm;font-size:5.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.footer-benefits i{display:block;width:5mm;height:5mm}.footer-brand{font-family:Georgia,serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
  </style></head><body><section class="page">
    <div class="hero">
      <div class="hero-photo">${renderPhoto(images[0]?.url, images[0]?.alt || property.title)}</div>
      <div class="top-nav">CONFORT &nbsp; | &nbsp; LOCAȚIE &nbsp; | &nbsp; CALITATE &nbsp; | &nbsp; VIITOR ACASĂ</div>
      <div class="promise">Spațiu real.<br />Confort autentic.<br />Acasă.</div>
      <div class="hero-copy">
        <div class="brand">${logo}</div><p class="brand-tag">Mai mult decât o locuință</p>
        <h1 class="title" style="font-size:${titleSize}px">${escapeHtml(title)}</h1>
        <p class="subline">${escapeHtml(subline || `${property.rooms || '—'} camere • ${formatNumber(surface)} m²`)}</p>
        <div class="address">${icon('pin')}<span>${escapeHtml(location)}</span></div>
        <p class="script">${escapeHtml(sellingLine)}</p>
      </div>
      <div class="price-band"><div class="price-main"><span>Preț</span><strong>${escapeHtml(formatPrice(property.price))}</strong></div><div class="commission">${icon('home')}<div>Reprezentare profesionistă<small>0% comision cumpărător</small></div></div></div>
    </div>
    <div class="spec-panel">
      <div class="primary-specs">${primarySpecs.map((item) => `<div class="spec"><i class="spec-icon">${icon(item.icon)}</i><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span><em>${escapeHtml(item.note)}</em></div>`).join('')}</div>
      <div class="secondary-specs">${secondarySpecs.map((item) => `<div class="mini-spec"><i>${icon(item.icon)}</i><span>${escapeHtml(item.value)}</span></div>`).join('')}</div>
    </div>
    <div class="gallery">${[0, 1, 2, 3].map((index) => `<div class="gallery-card">${renderPhoto(images[index]?.url || images[0]?.url, images[index]?.alt || galleryLabels[index])}<strong>${escapeHtml(galleryLabels[index])}</strong><span>${escapeHtml(galleryNotes[index])}</span></div>`).join('')}</div>
    <div class="bottom">
      <div><h2 class="nearby-title">Facilități în apropiere</h2><div class="nearby-grid">${(nearby.length ? nearby : [
        { name: property.nearMetro ? 'Metrou în apropiere' : 'Transport public', walkingText: 'acces rapid' },
        { name: 'Magazine și servicii', walkingText: 'în zonă' }, { name: 'Școli și grădinițe', walkingText: 'în apropiere' }, { name: 'Zone verzi', walkingText: 'ușor accesibile' },
      ]).map((item) => `<div class="nearby-card"><i>${icon('pin')}</i><strong>${escapeHtml(shorten(item.name, 30))}</strong><span>${escapeHtml(item.walkingText)}</span></div>`).join('')}</div></div>
      <div class="contact"><div><p class="contact-intro">Sună sau scrie pentru detalii:</p><div class="contact-row"><i>${icon('person')}</i><strong>${escapeHtml(agentName)}</strong></div><div class="contact-row"><i>${icon('phone')}</i><strong>${escapeHtml(agentPhone)}</strong></div><div class="contact-row"><i>${icon('mail')}</i><span>${escapeHtml(agentEmail)}</span></div></div><div>${qrUrl ? `<img class="qr" src="${escapeHtml(qrUrl)}" alt="Cod QR proprietate" />` : '<div class="qr qr-empty">PAGINA<br />PROPRIETĂȚII</div>'}<div class="qr-label">Scanează pentru detalii</div></div></div>
    </div>
    <footer class="footer"><div class="footer-benefits"><span><i>${icon('home')}</i>Achiziție sigură</span><span><i>${icon('leaf')}</i>Zonă bine dezvoltată</span><span><i>${icon('person')}</i>Consultanță dedicată</span></div><div class="footer-brand">${escapeHtml(agencyName)}</div></footer>
  </section></body></html>`;
}
