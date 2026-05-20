import type { Agency, MatchedBuyer, Property, UserProfile } from '@/lib/types';
import type { PricingAnalysisResult } from '@/lib/pricing-analysis';

export type PricingAnalysisPdfInput = {
  property: Property;
  agency: Agency | null;
  agent: UserProfile | null;
  analysis: PricingAnalysisResult;
  generatedAt: Date;
  manualMinPrice: number;
  manualRecommendedPrice: number;
  matchedBuyers?: MatchedBuyer[];
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value?: number | null) {
  if (!value || !Number.isFinite(value)) return '-';
  return `${Math.round(value).toLocaleString('ro-RO')} EUR`;
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return Math.round(value).toLocaleString('ro-RO');
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${value.toLocaleString('ro-RO')}%`;
}

function pricePerSqm(price: number, surface: number) {
  if (!price || !surface) return 0;
  return Math.round(price / surface);
}

function pickImage(property: Property) {
  return property.images?.find((image) => image?.url)?.url || '';
}

function getAgentName(property: Property, agent: UserProfile | null) {
  return agent?.name || property.agentName || property.agent?.name || 'Consultant imobiliar';
}

function getAgentPhone(agent: UserProfile | null, agency: Agency | null) {
  return agent?.phone || agency?.phone || '';
}

function getAgentEmail(agent: UserProfile | null, agency: Agency | null) {
  return agent?.email || agency?.email || '';
}

function buildMarketLabel(analysis: PricingAnalysisResult) {
  if (analysis.marketSignals.marketHeat === 'hot') return 'Piata activa';
  if (analysis.marketSignals.marketHeat === 'soft') return 'Piata sensibila la pret';
  return 'Piata echilibrata';
}

function formatBuyerBudget(buyer: MatchedBuyer) {
  const min = buyer.preferences?.desiredPriceRangeMin;
  const max = buyer.preferences?.desiredPriceRangeMax || buyer.budget;

  if (min && max) return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  if (max) return `pana la ${formatCurrency(max)}`;
  return 'Buget nespecificat';
}

function buyerLocationLabel(buyer: MatchedBuyer) {
  const zones = buyer.zones?.filter(Boolean).slice(0, 2) ?? [];
  if (buyer.city && zones.length) return `${buyer.city} Â· ${zones.join(', ')}`;
  if (buyer.city) return buyer.city;
  if (zones.length) return zones.join(', ');
  return buyer.generalZone || 'Zona flexibila';
}

function renderMatchedBuyers(matchedBuyers: MatchedBuyer[] = []) {
  const items = matchedBuyers.slice(0, 20);

  if (!items.length) {
    return '<div class="muted-row">Nu au fost gasiti cumparatori potriviti pentru criteriile acestei proprietati.</div>';
  }

  return items
    .map(
      (buyer) => `
        <article class="buyer-card">
          <div class="buyer-topline">
            <strong>${escapeHtml(buyer.name)}</strong>
            <em>${formatNumber(buyer.matchScore)}/100</em>
          </div>
          <span>${escapeHtml(formatBuyerBudget(buyer))}</span>
          <small>${escapeHtml(buyerLocationLabel(buyer))}</small>
          <p>${escapeHtml(buyer.reasoning || 'Compatibilitate buna pe criteriile esentiale.')}</p>
          <footer>${escapeHtml([buyer.phone, buyer.email].filter(Boolean).join(' Â· ') || buyer.status || 'Lead activ')}</footer>
        </article>
      `
    )
    .join('');
}

function renderComparableRows(analysis: PricingAnalysisResult) {
  const items = [
    ...analysis.soldComparables.slice(0, 2),
    ...analysis.activeComparables.slice(0, 2),
    ...analysis.portalComparables.slice(0, 4),
  ].slice(0, 7);

  if (!items.length) {
    return '<tr><td colspan="5" class="muted-row">Nu au fost gasite comparabile suficient de relevante.</td></tr>';
  }

  return items
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.statusLabel)} · ${escapeHtml(item.locationLabel)}</span>
          </td>
          <td>${formatCurrency(item.price)}</td>
          <td>${formatNumber(item.pricePerSqm)} EUR/mp</td>
          <td>${item.rooms ?? '-'} cam. · ${formatNumber(item.squareFootage)} mp</td>
          <td>${formatNumber(item.similarityScore)}/100</td>
        </tr>
      `
    )
    .join('');
}

function renderComparableCards(analysis: PricingAnalysisResult) {
  const items = [
    ...analysis.portalComparables,
  ].slice(0, 5);

  if (!items.length) {
    return '<div class="muted-row">Nu au fost gasite comparabile suficient de relevante.</div>';
  }

  return items
    .map(
      (item) => `
        <article class="comparable-card">
          <div class="comparable-image">
            ${
              item.imageUrl
                ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" />`
                : '<span>Fara poza</span>'
            }
          </div>
          <div class="comparable-main">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.statusLabel)} Â· ${escapeHtml(item.locationLabel)}</span>
            <small>${item.rooms ?? '-'} camere Â· ${formatNumber(item.squareFootage)} mp</small>
          </div>
          <div class="comparable-price">
            <strong>${formatCurrency(item.price)}</strong>
            <span>${formatNumber(item.pricePerSqm)} EUR/mp</span>
          </div>
          <div class="comparable-score">${formatNumber(item.similarityScore)}/100</div>
        </article>
      `
    )
    .join('');
}

function renderAdjustments(analysis: PricingAnalysisResult, surface: number) {
  if (!analysis.adjustments.length) {
    return '<li>Nu au fost necesare ajustari suplimentare fata de baza comparabila.</li>';
  }

  return analysis.adjustments
    .slice(0, 6)
    .map((adjustment) => {
      const sign = adjustment.impactPerSqm > 0 ? '+' : '';
      const tone = adjustment.impactPerSqm < 0 ? 'negative' : 'positive';
      return `
        <li class="${tone}">
          <div class="adjustment-copy">
            <strong>${escapeHtml(adjustment.label)}</strong>
            <span>${escapeHtml(adjustment.reason)}</span>
            <small>Calcul: ${sign}${formatNumber(adjustment.impactPerSqm)} EUR/mp x ${formatNumber(surface)} mp = ${sign}${formatCurrency(Math.abs(adjustment.impactTotal))}</small>
          </div>
          <em>${sign}${formatNumber(adjustment.impactPerSqm)} EUR/mp</em>
        </li>
      `;
    })
    .join('');
}

export function renderPricingAnalysisPdfHtml(input: PricingAnalysisPdfInput) {
  const { property, agency, agent, analysis, generatedAt, manualMinPrice, manualRecommendedPrice, matchedBuyers = [] } = input;
  const heroImage = pickImage(property);
  const surface = analysis.subject.squareFootage || property.squareFootage || 1;
  const maxPrice = analysis.stretchMaxPrice;
  const overpriceThreshold = analysis.pricingStrategy?.overpricedThreshold || Math.round(maxPrice * 1.01);
  const agentName = getAgentName(property, agent);
  const agentPhone = getAgentPhone(agent, agency);
  const agentEmail = getAgentEmail(agent, agency);
  const location = [property.zone || analysis.subject.zone, property.city || analysis.subject.city, property.address || analysis.subject.address]
    .filter(Boolean)
    .join(' · ');

  const recommendedPerSqm = pricePerSqm(manualRecommendedPrice, surface);
  const minPerSqm = pricePerSqm(manualMinPrice, surface);
  const visibleAdjustmentPerSqm = analysis.adjustments.reduce((sum, adjustment) => sum + adjustment.impactPerSqm, 0);
  const visibleAdjustmentTotal = analysis.adjustments.reduce((sum, adjustment) => sum + adjustment.impactTotal, 0);
  const estimatedBasePerSqm = recommendedPerSqm - visibleAdjustmentPerSqm;
  const estimatedBaseTotal = estimatedBasePerSqm * surface;
  const missingForOwner = [...analysis.dataQuality.missingFields, ...analysis.dataQuality.warnings].slice(0, 3);
  const displayTitle = (property.title || analysis.subject.title || 'Proprietate analizata')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  const heroSummary = `Pozitionare recomandata la ${formatCurrency(manualRecommendedPrice)} (${formatNumber(
    recommendedPerSqm
  )} EUR/mp), cu prag minim de colaborare ${formatCurrency(manualMinPrice)} si argumente clare pentru proprietar.`;
  const heroDetails = [
    { label: 'Suprafata', value: `${formatNumber(surface)} mp` },
    { label: 'Camere', value: `${analysis.subject.rooms || property.rooms || '-'} cam.` },
    { label: 'Incredere', value: `${analysis.confidenceScore}/100` },
  ];

  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(property.title)} - analiza pret</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #eef4f3;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 12mm 14mm;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      background:
        radial-gradient(circle at top right, rgba(20, 184, 166, 0.18), transparent 34%),
        linear-gradient(180deg, #f8fafc 0%, #ffffff 42%, #f4f7fb 100%);
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6mm;
      color: #475569;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      color: #0f766e;
    }
    .brand-mark {
      width: 26px;
      height: 26px;
      border-radius: 9px;
      background: linear-gradient(135deg, #0f766e, #14b8a6);
      box-shadow: 0 12px 28px rgba(15, 118, 110, 0.24);
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
      gap: 6mm;
      align-items: stretch;
      padding: 5mm;
      border-radius: 26px;
      background:
        radial-gradient(circle at 16% 12%, rgba(20, 184, 166, 0.26), transparent 30%),
        linear-gradient(135deg, #07111f 0%, #0f2f36 52%, #ecfeff 100%);
      border: 1px solid rgba(15, 118, 110, 0.14);
      box-shadow: 0 28px 70px rgba(15, 23, 42, 0.16);
    }
    .hero-copy {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
    }
    .hero-copy h1 {
      margin: 0 0 3mm;
      font-size: 24px;
      line-height: 1.08;
      letter-spacing: 0;
      color: #ffffff;
      max-width: 132mm;
    }
    .hero-copy .location {
      color: rgba(224, 242, 254, 0.84);
      font-size: 11px;
      line-height: 1.55;
      margin-bottom: 3mm;
    }
    .pill {
      display: inline-flex;
      border-radius: 999px;
      padding: 7px 11px;
      background: rgba(236, 253, 245, 0.96);
      border: 1px solid rgba(167, 243, 208, 0.75);
      color: #047857;
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 3mm;
      align-self: flex-start;
    }
    .hero-summary {
      color: rgba(240, 253, 250, 0.88);
      font-size: 11px;
      line-height: 1.5;
      margin: 0;
      max-width: 118mm;
    }
    .hero-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 2mm;
      margin-top: 4mm;
    }
    .hero-stat {
      border-radius: 16px;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: #ffffff;
    }
    .hero-stat span {
      display: block;
      color: rgba(224, 242, 254, 0.78);
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .hero-stat strong {
      display: block;
      font-size: 13px;
      line-height: 1.15;
    }
    .hero-photo {
      min-height: 66mm;
      overflow: hidden;
      border-radius: 24px;
      background: linear-gradient(135deg, #0f172a, #115e59);
      border: 1px solid rgba(255, 255, 255, 0.28);
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
      position: relative;
    }
    .hero-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .hero-photo .fallback {
      height: 100%;
      display: grid;
      place-items: center;
      color: #ccfbf1;
      font-size: 18px;
      font-weight: 700;
      padding: 20px;
      text-align: center;
    }
    .price-band {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
      margin-top: 9mm;
    }
    .price-card {
      border-radius: 20px;
      padding: 17px;
      border: 1px solid #dbeafe;
      background: #ffffff;
      box-shadow: inset 4px 0 0 #0ea5e9;
    }
    .price-card.primary {
      border-color: #6ee7b7;
      background: #d1fae5;
      box-shadow: 0 20px 45px rgba(5, 150, 105, 0.15), inset 4px 0 0 #059669;
    }
    .price-card.warning {
      border-color: #fed7aa;
      background: #fff7ed;
      box-shadow: inset 4px 0 0 #ea580c;
    }
    .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: #64748b;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .value {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #020617;
    }
    .hint {
      margin-top: 5px;
      color: #475569;
      font-size: 11px;
      line-height: 1.45;
    }
    .section {
      margin-top: 7mm;
      border-radius: 22px;
      border: 1px solid #e2e8f0;
      background: rgba(255,255,255,0.92);
      padding: 6mm;
      box-shadow: 0 22px 54px rgba(15, 23, 42, 0.08);
    }
    .section h2 {
      margin: 0 0 4mm;
      font-size: 19px;
      letter-spacing: -0.02em;
    }
    .summary {
      color: #334155;
      font-size: 13px;
      line-height: 1.7;
      margin: 0;
    }
    .reading-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 3mm;
      margin-top: 4mm;
    }
    .reading-card {
      border-radius: 14px;
      padding: 14px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      box-shadow: inset 4px 0 0 #94a3b8;
    }
    .reading-card.recommended {
      background: #ecfdf5;
      border-color: #a7f3d0;
      box-shadow: inset 4px 0 0 #059669;
    }
    .reading-card.tactical {
      background: #f0f9ff;
      border-color: #bae6fd;
      box-shadow: inset 4px 0 0 #0284c7;
    }
    .reading-card.caution {
      background: #fff1f2;
      border-color: #fecdd3;
      box-shadow: inset 4px 0 0 #e11d48;
    }
    .reading-card strong {
      display: block;
      font-size: 15px;
      letter-spacing: 0;
      color: #020617;
      margin-bottom: 7px;
    }
    .reading-card span {
      display: block;
      margin-top: 0;
      font-size: 11.5px;
      line-height: 1.45;
      color: #475569;
    }
    .two-col {
      display: grid;
      grid-template-columns: 0.92fr 1.08fr;
      gap: 6mm;
      align-items: start;
    }
    ul.adjustments {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 10px;
    }
    .calculation-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3mm;
      margin: 4mm 0 5mm;
    }
    .calculation-card {
      border-radius: 16px;
      border: 1px solid #dbeafe;
      background: #f8fafc;
      padding: 12px;
    }
    .calculation-card span {
      display: block;
      color: #64748b;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .calculation-card strong {
      display: block;
      color: #020617;
      font-size: 16px;
      letter-spacing: -0.02em;
    }
    .calculation-card small {
      display: block;
      color: #64748b;
      font-size: 9.5px;
      line-height: 1.35;
      margin-top: 5px;
    }
    .missing-note {
      border-radius: 16px;
      border: 1px dashed #cbd5e1;
      background: #ffffff;
      color: #475569;
      font-size: 11px;
      line-height: 1.45;
      padding: 12px 14px;
      margin: 0 0 5mm;
    }
    .missing-note strong {
      color: #0f172a;
    }
    ul.adjustments li {
      border-radius: 18px;
      border: 1px solid #dbeafe;
      background:
        linear-gradient(90deg, rgba(236, 253, 245, 0.85), rgba(255, 255, 255, 0.98) 38%),
        #ffffff;
      padding: 15px 16px 15px 18px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 16px;
      box-shadow: inset 4px 0 0 #10b981, 0 12px 26px rgba(15, 23, 42, 0.05);
    }
    ul.adjustments li.negative {
      background:
        linear-gradient(90deg, rgba(255, 241, 242, 0.9), rgba(255, 255, 255, 0.98) 38%),
        #ffffff;
      border-color: #fecdd3;
      box-shadow: inset 4px 0 0 #e11d48, 0 12px 26px rgba(15, 23, 42, 0.05);
    }
    .adjustment-copy {
      min-width: 0;
    }
    ul.adjustments strong {
      display: block;
      font-size: 15px;
      letter-spacing: -0.01em;
      color: #020617;
    }
    ul.adjustments span {
      display: block;
      color: #475569;
      font-size: 12px;
      line-height: 1.5;
      margin-top: 6px;
    }
    ul.adjustments small {
      display: block;
      color: #64748b;
      font-size: 10px;
      line-height: 1.4;
      margin-top: 7px;
    }
    ul.adjustments em {
      font-style: normal;
      color: #047857;
      font-weight: 800;
      font-size: 13px;
      white-space: nowrap;
      border-radius: 999px;
      background: #d1fae5;
      border: 1px solid #86efac;
      padding: 8px 10px;
    }
    ul.adjustments li.negative em {
      color: #be123c;
      background: #ffe4e6;
      border-color: #fda4af;
    }
    .owner-box {
      border-radius: 22px;
      background: linear-gradient(135deg, #0f766e, #064e3b);
      color: #ecfdf5;
      padding: 18px;
      min-height: 100%;
    }
    .owner-box h3 {
      margin: 0 0 8px;
      font-size: 19px;
      letter-spacing: -0.02em;
    }
    .owner-box p {
      margin: 0 0 12px;
      color: rgba(236,253,245,0.86);
      font-size: 12px;
      line-height: 1.55;
    }
    .owner-box .big {
      font-size: 28px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.04em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 16px;
      font-size: 10.5px;
    }
    th {
      text-align: left;
      background: #f1f5f9;
      color: #475569;
      padding: 9px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    td {
      border-top: 1px solid #e2e8f0;
      padding: 9px;
      vertical-align: top;
      color: #334155;
    }
    td strong {
      display: block;
      color: #0f172a;
      font-size: 11px;
      margin-bottom: 3px;
    }
    td span {
      display: block;
      color: #64748b;
      line-height: 1.35;
    }
    .muted-row {
      color: #64748b;
      text-align: center;
      padding: 18px;
    }
    .comparable-grid {
      display: grid;
      gap: 4mm;
      margin-top: 5mm;
    }
    .comparable-card {
      display: grid;
      grid-template-columns: 34mm minmax(0, 1fr) 30mm 17mm;
      gap: 4mm;
      align-items: center;
      border-radius: 20px;
      border: 1px solid #dbeafe;
      background: linear-gradient(90deg, #ffffff 0%, #f8fafc 100%);
      padding: 12px;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
    }
    .comparable-image {
      height: 25mm;
      border-radius: 14px;
      overflow: hidden;
      background: linear-gradient(135deg, #e2e8f0, #f8fafc);
      display: grid;
      place-items: center;
      color: #64748b;
      font-size: 10px;
      font-weight: 700;
    }
    .comparable-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .comparable-main {
      min-width: 0;
    }
    .comparable-main strong {
      display: block;
      color: #020617;
      font-size: 13px;
      line-height: 1.25;
      margin-bottom: 5px;
    }
    .comparable-main span,
    .comparable-main small {
      display: block;
      color: #64748b;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .comparable-price strong {
      display: block;
      color: #020617;
      font-size: 14px;
      line-height: 1.15;
    }
    .comparable-price span {
      display: block;
      color: #0f766e;
      font-size: 11px;
      font-weight: 800;
      margin-top: 4px;
    }
    .comparable-score {
      justify-self: end;
      border-radius: 999px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #3730a3;
      font-size: 11px;
      font-weight: 900;
      padding: 8px 9px;
      white-space: nowrap;
    }
    .buyer-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3mm;
      margin-top: 5mm;
    }
    .buyer-card {
      border-radius: 18px;
      border: 1px solid #dbeafe;
      background: #ffffff;
      padding: 12px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
      break-inside: avoid;
    }
    .buyer-topline {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .buyer-topline strong {
      color: #020617;
      font-size: 13px;
      line-height: 1.25;
    }
    .buyer-topline em {
      border-radius: 999px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #3730a3;
      font-style: normal;
      font-size: 10px;
      font-weight: 900;
      padding: 5px 7px;
      white-space: nowrap;
    }
    .buyer-card span {
      display: block;
      color: #0f766e;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 3px;
    }
    .buyer-card small {
      display: block;
      color: #64748b;
      font-size: 10px;
      line-height: 1.35;
    }
    .buyer-card p {
      margin: 7px 0 0;
      color: #475569;
      font-size: 10px;
      line-height: 1.4;
    }
    .buyer-card footer {
      margin-top: 8px;
      color: #64748b;
      font-size: 9.5px;
      line-height: 1.3;
    }
    .footer {
      position: absolute;
      left: 14mm;
      right: 14mm;
      bottom: 10mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #64748b;
      font-size: 10px;
      border-top: 1px solid #e2e8f0;
      padding-top: 4mm;
    }
    .cta {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8mm;
      align-items: center;
      border-radius: 28px;
      padding: 10mm;
      color: #ffffff;
      background:
        radial-gradient(circle at top right, rgba(251,191,36,0.28), transparent 32%),
        linear-gradient(135deg, #0f172a, #0f766e);
      box-shadow: 0 30px 70px rgba(15, 23, 42, 0.22);
      margin-top: 8mm;
    }
    .cta h2 {
      margin: 0 0 8px;
      font-size: 28px;
      letter-spacing: -0.04em;
    }
    .cta p {
      margin: 0;
      color: rgba(255,255,255,0.82);
      font-size: 13px;
      line-height: 1.6;
    }
    .contact-card {
      min-width: 62mm;
      border-radius: 20px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.22);
      padding: 15px;
    }
    .contact-card strong {
      display: block;
      font-size: 16px;
      margin-bottom: 7px;
    }
    .contact-card span {
      display: block;
      color: rgba(255,255,255,0.82);
      font-size: 11px;
      line-height: 1.55;
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="brand-row">
      <div class="brand"><div class="brand-mark"></div>${escapeHtml(agency?.name || 'ImoDeus.ai')}</div>
      <div>${generatedAt.toLocaleDateString('ro-RO')} · Analiza pret</div>
    </div>

    <div class="hero">
      <div class="hero-copy">
        <div class="pill">Analiza premium pentru proprietar</div>
        <h1>${escapeHtml(displayTitle)}</h1>
        <div class="location">${escapeHtml(location || 'Localizare disponibila in fisa proprietatii')}</div>
        <p class="hero-summary">${escapeHtml(heroSummary)}</p>
        <div class="hero-stats">
          ${heroDetails
            .map(
              (detail) => `
                <div class="hero-stat">
                  <span>${escapeHtml(detail.label)}</span>
                  <strong>${escapeHtml(detail.value)}</strong>
                </div>
              `
            )
            .join('')}
        </div>
      </div>
      <div class="hero-photo">
        ${
          heroImage
            ? `<img src="${escapeHtml(heroImage)}" alt="${escapeHtml(property.title)}" />`
            : '<div class="fallback">Analiza premium de pret pentru proprietar</div>'
        }
      </div>
    </div>

    <div class="price-band">
      <div class="price-card warning">
        <div class="label">Pret minim colaborare</div>
        <div class="value">${formatCurrency(manualMinPrice)}</div>
        <div class="hint">${formatNumber(minPerSqm)} EUR/mp · vanzare rapida in 30 zile</div>
      </div>
      <div class="price-card primary">
        <div class="label">Pret recomandat</div>
        <div class="value">${formatCurrency(manualRecommendedPrice)}</div>
        <div class="hint">${formatNumber(recommendedPerSqm)} EUR/mp · pozitionare comerciala optima</div>
      </div>
      <div class="price-card">
        <div class="label">Prag supraevaluare</div>
        <div class="value">${formatCurrency(overpriceThreshold)}</div>
        <div class="hint">Peste acest nivel creste riscul de stagnare in piata.</div>
      </div>
    </div>

    <div class="section">
      <h2>Cum citim recomandarea</h2>
      <div class="reading-grid">
        <div class="reading-card recommended">
          <strong>Pret recomandat</strong>
          <span>Nivelul optim pentru listarea initiala, construit din tranzactii, concurenta si ajustarile proprietatii.</span>
        </div>
        <div class="reading-card tactical">
          <strong>Interval tactic</strong>
          <span>Plaja utila pentru negociere si testarea pietei fara sa blocheze interesul cumparatorilor.</span>
        </div>
        <div class="reading-card caution">
          <strong>Atentie comerciala</strong>
          <span>OwnerListings sunt cereri active, nu inchideri, asa ca sunt ponderate sub comparabilele vandute.</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <span>Analiza orientativa, construita din comparabile si semnale comerciale locale.</span>
      <span>${escapeHtml(agency?.name || 'ImoDeus.ai')}</span>
    </div>
  </section>

  <section class="page">
    <div class="brand-row">
      <div class="brand"><div class="brand-mark"></div>${escapeHtml(agency?.name || 'ImoDeus.ai')}</div>
      <div>Argumente pentru proprietar</div>
    </div>

    <div class="section" style="margin-top:0">
      <h2>Ajustari cheie</h2>
      <div class="calculation-grid">
        <div class="calculation-card">
          <span>Baza comparabila</span>
          <strong>${formatNumber(estimatedBasePerSqm)} EUR/mp</strong>
          <small>${formatCurrency(estimatedBaseTotal)} pentru ${formatNumber(surface)} mp</small>
        </div>
        <div class="calculation-card">
          <span>Ajustari vizibile</span>
          <strong>${visibleAdjustmentPerSqm > 0 ? '+' : ''}${formatNumber(visibleAdjustmentPerSqm)} EUR/mp</strong>
          <small>${visibleAdjustmentTotal > 0 ? '+' : visibleAdjustmentTotal < 0 ? '-' : ''}${formatCurrency(Math.abs(visibleAdjustmentTotal))} impact total</small>
        </div>
        <div class="calculation-card">
          <span>Pret rezultat</span>
          <strong>${formatNumber(recommendedPerSqm)} EUR/mp</strong>
          <small>${formatCurrency(manualRecommendedPrice)} pret recomandat</small>
        </div>
      </div>
      <div class="missing-note">
        <strong>Ce mai poate rafina pretul:</strong> ${
          missingForOwner.length
            ? escapeHtml(missingForOwner.join('; '))
            : 'datele principale sunt complete pentru o recomandare comerciala coerenta.'
        }
      </div>
      <ul class="adjustments">${renderAdjustments(analysis, surface)}</ul>
    </div>

    <div class="footer">
      <span>Document generat automat din analiza AI si ajustarile consultantului.</span>
      <span>${escapeHtml(agency?.name || 'ImoDeus.ai')}</span>
    </div>
  </section>

  <section class="page">
    <div class="brand-row">
      <div class="brand"><div class="brand-mark"></div>${escapeHtml(agency?.name || 'ImoDeus.ai')}</div>
      <div>Comparabile pentru proprietar</div>
    </div>

    <div class="section" style="margin-top:0">
      <h2>Comparabile relevante</h2>
      <div class="comparable-grid">${renderComparableCards(analysis)}</div>
    </div>

    <div class="cta">
      <div>
        <h2>Hai sa intram in piata cu un pret care vinde.</h2>
        <p>O pozitionare corecta din prima luna creste sansele de vizionari calificate, oferte rapide si o colaborare predictibila intre proprietar si agentie.</p>
      </div>
      <div class="contact-card">
        <strong>${escapeHtml(agentName)}</strong>
        <span>${escapeHtml(agentPhone || 'Telefon disponibil in agentie')}</span>
        <span>${escapeHtml(agentEmail || 'Email disponibil in agentie')}</span>
      </div>
    </div>

    <div class="footer">
      <span>Document generat automat din analiza AI si ajustarile consultantului.</span>
      <span>${escapeHtml(agency?.name || 'ImoDeus.ai')}</span>
    </div>
  </section>

  <section class="page">
    <div class="brand-row">
      <div class="brand"><div class="brand-mark"></div>${escapeHtml(agency?.name || 'ImoDeus.ai')}</div>
      <div>Oportunitati active</div>
    </div>

    <div class="section" style="margin-top:0">
      <h2>Cumparatori potriviti</h2>
      <p class="summary">Lista este limitata la 20 de lead-uri active, ordonate dupa compatibilitatea cu proprietatea.</p>
      <div class="buyer-grid">${renderMatchedBuyers(matchedBuyers)}</div>
    </div>

    <div class="footer">
      <span>Cumparatorii sunt calculati din criteriile si preferintele salvate in CRM.</span>
      <span>${escapeHtml(agency?.name || 'ImoDeus.ai')}</span>
    </div>
  </section>
</body>
</html>`;
}
