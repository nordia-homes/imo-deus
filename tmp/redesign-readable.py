from pathlib import Path
p=Path('src/lib/property-presentations/pdf-template.ts')
s=p.read_text(encoding='utf-8-sig')
start=s.index('  return `<!doctype html>')
s=s[:start]+r'''  return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8" /><title>${escapeHtml(property.title)} — prezentare</title>
<style>
  ${presentationFont()}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  :root { --paper: #faf7f0; --gold: #80602f; --ink: #252a26; --muted: #50564f; --line: #c9b58f; }
  html, body { margin: 0; background: #fff; color: var(--ink); font-family: Presentation, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  a { color: inherit; text-decoration: none; }
  svg { display: block; width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .page { position: relative; width: 210mm; height: 297mm; display: flex; flex-direction: column; background: var(--paper); break-after: page; }
  .page:last-child { break-after: auto; }
  .hero { position: relative; flex: 0 0 132mm; margin: 0; }
  .hero-frame { position: absolute; inset: 0 0 0 64mm; background: #ede4d2; }
  .photo { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
  .hero-frame .photo { object-position: 60% center; }
  .hero-curve { position: absolute; inset: 0; width: 100%; height: 100%; stroke: none; }
  .hero-copy { position: absolute; left: 8mm; top: 8mm; width: 70mm; }
  .brand { display: flex; align-items: center; gap: 3mm; color: var(--ink); }
  .brand-mark { display: block; width: 11mm; height: 11mm; color: var(--gold); flex-shrink: 0; }
  .brand-logo { max-width: 23mm; max-height: 12mm; object-fit: contain; }
  .brand > span:last-child { font-size: 20px; font-weight: 750; letter-spacing: -.025em; text-transform: uppercase; line-height: 1.15; overflow-wrap: anywhere; }
  .brand-rule { height: 1px; width: 51mm; background: var(--line); margin-top: 5mm; }
  .intro { margin-top: 8mm; }
  .eyebrow { display: block; font-size: 12px; font-weight: 650; line-height: 1.35; letter-spacing: .055em; color: var(--gold); }
  h1 { margin: 2mm 0 0; font-weight: 650; line-height: 1.12; letter-spacing: -.045em; overflow-wrap: anywhere; }
  h1 .property-kind { display: block; font-size: 28px; }
  h1 em { display: block; font-size: 42px; font-style: normal; font-weight: 750; color: var(--gold); margin-top: 1mm; }
  .title-medium h1 .property-kind { font-size: 24px; }
  .title-small h1 .property-kind { font-size: 20px; }
  .title-medium h1 em, .title-small h1 em { font-size: 35px; }
  .partition { font-size: 13px; font-weight: 600; margin: 2.5mm 0 0; }
  .address { display: flex; align-items: flex-start; gap: 2mm; margin: 5mm 0 0; max-width: 66mm; font-size: 12px; line-height: 1.45; color: var(--muted); }
  .address i { flex-shrink: 0; width: 4mm; height: 5mm; color: var(--gold); }
  .address span { overflow-wrap: anywhere; }
  .compact-copy .brand > span:last-child { font-size: 16px; }
  .compact-copy .intro { margin-top: 5mm; }
  .compact-copy .address { margin-top: 3mm; }
  .hero-stamp { position: absolute; top: 7mm; right: 7mm; max-width: 68mm; border: 1px solid #e3d3b5; border-radius: 99px; background: #faf7f0; padding: 2.3mm 4mm; color: #56452c; font-size: 11px; font-weight: 600; line-height: 1.35; }
  .price-card { position: absolute; left: 8mm; bottom: 13mm; width: 71mm; border: 1px solid #cfb48a; border-radius: 3mm 7mm 3mm 3mm; background: linear-gradient(110deg, #ecddc1, #faf3e6); padding: 3mm 4mm; }
  .price-card .eyebrow { font-size: 11px; letter-spacing: 0; }
  .price { display: block; font-size: 30px; font-weight: 750; line-height: 1.18; letter-spacing: -.04em; margin-top: 1mm; white-space: nowrap; }
  .price small { font-size: 12px; font-weight: 500; letter-spacing: 0; }
  .price-long { font-size: 24px; }
  .commission { font-size: 11px; line-height: 1.3; color: #56452c; margin-top: 1.4mm; }
  .specs { position: relative; z-index: 2; flex: 0 0 25mm; margin: -5mm 7mm 0; padding: 3mm 2mm; border: 1px solid #d9c9ab; border-radius: 4mm; background: linear-gradient(120deg, #fffcf7, #f0e6d4); display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); align-items: center; }
  .spec { display: grid; grid-template-columns: 7mm 1fr; align-items: center; gap: 2mm; padding: 0 3mm; border-left: 1px solid #cdbb9c; min-width: 0; }
  .spec:first-child { border: 0; }
  .spec-icon { display: block; width: 7mm; height: 8mm; color: var(--gold); }
  .spec strong { display: block; font-size: 24px; font-weight: 700; line-height: 1.1; letter-spacing: -.035em; white-space: nowrap; }
  .spec strong small { font-size: 14px; font-weight: 500; }
  .spec-label { display: block; font-size: 11px; line-height: 1.25; margin-top: 1.6mm; color: var(--muted); }
  .specs-empty { display: flex; justify-content: center; font-size: 12px; color: var(--muted); }
  .cover-gallery { flex: 0 0 52mm; margin: 5mm 7mm 0; }
  .gallery-heading { display: flex; justify-content: space-between; align-items: center; padding: 0 1mm 2.5mm; font-size: 12px; color: var(--ink); }
  .gallery-heading strong { font-weight: 650; }
  .cover-photos { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); grid-template-rows: minmax(0, 1fr); gap: 3mm; height: 43mm; }
  .cover-photos figure { display: flex; flex-direction: column; margin: 0; min-width: 0; min-height: 0; border: 1px solid #d4c1a0; border-radius: 4mm; background: #f0e5d2; overflow: hidden; }
  .cover-photo-frame { flex: 1; min-height: 0; overflow: hidden; }
  .cover-photos figcaption { font-size: 11px; font-weight: 600; color: #493c28; text-align: center; padding: 1.5mm 2mm; line-height: 1.25; }
  .information { flex: 1; min-height: 0; display: grid; grid-template-columns: 1.12fr 1fr; gap: 5mm; margin: 6mm 8mm 4mm; align-items: center; }
  .section-title { display: flex; align-items: center; gap: 2mm; font-size: 16px; line-height: 1.2; font-weight: 700; margin: 0 0 2mm; }
  .section-title i { display: block; width: 5mm; height: 5mm; color: var(--gold); flex-shrink: 0; }
  .nearby-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2mm; border-top: 1px solid #ddd0b9; padding: 1.4mm 0; font-size: 12px; line-height: 1.3; }
  .nearby-row strong { font-weight: 500; overflow-wrap: anywhere; }
  .nearby-row span { color: #56401f; font-weight: 750; white-space: nowrap; }
  .nearby-note { font-size: 10px; line-height: 1.35; color: var(--muted); margin: 1mm 0 0; }
  .area-address { font-size: 12px; color: var(--muted); line-height: 1.4; margin: 2mm 0; overflow-wrap: anywhere; }
  .online-panel { display: flex; align-items: center; gap: 2mm; padding: 3mm 2mm; border: 1px solid #d4bd94; border-radius: 4mm; background: #f0e5d2; }
  .qr-code { flex-shrink: 0; width: 31mm; height: 31mm; background: #fff; stroke: none; border-radius: 1mm; }
  .qr-code path, .qr-code rect { stroke: none; }
  .online-panel h2 { font-size: 14px; font-weight: 750; line-height: 1.25; margin: 0 0 2mm; }
  .online-panel p { font-size: 11px; line-height: 1.45; margin: 0; color: #4b463d; }
  .online-link { display: block; font-size: 11px; font-weight: 750; margin-top: 2mm; color: #58401e; }
  .online-pending { flex-direction: column; align-items: flex-start; padding: 5mm; }
  .contact { flex: 0 0 27mm; display: flex; align-items: center; gap: 6mm; padding: 3mm 8mm; border-top: 1px solid #c8b18a; border-bottom: 1px solid #e0d4bf; background: linear-gradient(105deg, #fffdf8, #eee2cf); }
  .contact-invite { flex: 1; min-width: 0; }
  .contact-invite .eyebrow { font-size: 11px; letter-spacing: 0; }
  .contact h2 { font-size: 19px; font-weight: 700; line-height: 1.15; margin: 1.5mm 0 0; }
  .inline-arrow { display: inline-block; width: 6mm; height: 4mm; color: var(--gold); }
  .contact-person { width: 96mm; min-width: 0; overflow-wrap: anywhere; border-left: 1px solid #c8b28f; padding-left: 6mm; }
  .contact-person strong { display: block; font-size: 12px; font-weight: 650; margin-bottom: 1mm; }
  .contact-phone { display: block; font-size: 20px; font-weight: 750; line-height: 1.2; letter-spacing: -.02em; }
  .contact-email { display: block; font-size: 12px; color: var(--muted); margin-top: 1mm; line-height: 1.25; }
  .footer { display: flex; justify-content: space-between; align-items: center; gap: 3mm; flex: 0 0 7mm; padding: 1.5mm 8mm; font-size: 10px; color: var(--muted); line-height: 1.3; }
  .footer > span:first-child { max-width: 166mm; overflow-wrap: anywhere; }
  .footer > span:last-child { white-space: nowrap; }
  .photo-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5mm; height: 100%; color: #5e503b; background: #ede3d1; font-size: 12px; text-align: center; }
  .photo-empty svg { width: 20mm; height: 20mm; color: #997746; }
  .no-gallery .hero { flex-basis: 168mm; }
  .no-gallery .information { flex: 1; }
  .gallery-page { padding: 8mm 8mm 0; }
  .masthead { flex: 0 0 18mm; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); gap: 8mm; }
  .masthead .brand-mark { width: 8mm; height: 8mm; }
  .masthead .brand > span:last-child { font-size: 18px; }
  .masthead .brand-logo { max-height: 9mm; max-width: 25mm; }
  .masthead-note { max-width: 74mm; font-size: 11px; line-height: 1.4; text-align: right; color: var(--muted); }
  .gallery-intro { flex-shrink: 0; padding: 6mm 0 5mm; }
  .gallery-intro h2 { font-size: 29px; font-weight: 650; letter-spacing: -.035em; margin: 2mm 0 0; }
  .gallery { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: 1.1fr 1fr; gap: 4mm; padding-bottom: 5mm; }
  .gallery figure { display: flex; flex-direction: column; min-width: 0; min-height: 0; margin: 0; }
  .gallery figure:first-child { grid-column: 1 / -1; }
  .gallery-image { flex: 1; min-height: 0; border: 1px solid #d4c1a0; border-radius: 4mm; overflow: hidden; }
  .gallery figcaption { display: flex; gap: 2mm; font-size: 12px; color: var(--muted); line-height: 1.3; padding: 2mm 1mm 0; }
  .gallery figcaption b { color: var(--gold); font-weight: 650; }
  .gallery[data-count="1"] { grid-template-rows: 1fr; }
  .gallery[data-count="2"] { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .gallery-details { display: flex; flex-wrap: wrap; gap: 2mm 4mm; padding: 2mm 0 4mm; font-size: 12px; color: var(--muted); }
  .gallery-details span::before { content: '·'; color: var(--gold); margin-right: 2mm; }
  .gallery-page .contact, .gallery-page .footer { margin-left: -8mm; margin-right: -8mm; }
</style></head><body>
  <section class="page cover${coverGallery.length ? '' : ' no-gallery'}">
    <div class="hero">
      <div class="hero-frame">${renderPhoto(images[0])}</div>
      <svg class="hero-curve" viewBox="0 0 210 157" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ivory" x1="0" x2="1"><stop stop-color="#fffdf9"/><stop offset="1" stop-color="#faf7f0"/></linearGradient><linearGradient id="gold" x1="0" x2="1"><stop stop-color="#a5824b"/><stop offset=".6" stop-color="#e4d3b2"/><stop offset="1" stop-color="#c4a674"/></linearGradient></defs><path fill="url(#gold)" d="M0 0H66C110 36 96 70 85 100C75 127 91 148 123 157H0Z"/><path fill="url(#ivory)" d="M0 0H63C105 36 92 70 81 100C71 127 87 148 119 157H0Z"/></svg>
      <div class="hero-stamp">${escapeHtml(shorten(location || transaction, 54))}</div>
      <div class="hero-copy${agencyName.length > 24 || headline.length > 23 ? ' compact-copy' : ''}">
        ${brand}<div class="brand-rule"></div>
        <div class="intro${titleSize}"><span class="eyebrow">${escapeHtml(transaction)}</span><h1><span class="property-kind">${escapeHtml(headline)}</span>${secondaryHeadline ? `<em>${escapeHtml(secondaryHeadline)}</em>` : ''}</h1>${property.partitioning && roomHeadline ? `<p class="partition">${escapeHtml(shorten(property.partitioning, 30))}</p>` : ''}<p class="address"><i>${icon('pin')}</i><span>${escapeHtml(shorten(address, 110))}</span></p></div>
      </div>
      <div class="price-card"><span class="eyebrow">${isRental ? 'Chirie lunară' : 'Preț de vânzare'}</span><strong class="price${price.length > 11 ? ' price-long' : ''}">${escapeHtml(price)}${isRental && positive(property.price) ? '<small> / lună</small>' : ''}</strong>${commission ? `<div class="commission">${escapeHtml(commission)}</div>` : ''}</div>
    </div>
    <div class="specs${specs.length ? '' : ' specs-empty'}" style="--count:${specs.length || 1}">${specs.length ? specs.map((spec) => `<div class="spec"><i class="spec-icon">${icon(spec.icon)}</i><div><strong>${escapeHtml(spec.value)}${spec.unit ? ` <small>${spec.unit}</small>` : ''}</strong><span class="spec-label">${escapeHtml(spec.label)}</span></div></div>`).join('') : 'Detalii despre proprietate, la cerere.'}</div>
    ${coverGallery.length ? `<section class="cover-gallery"><div class="gallery-heading"><strong>Descoperă proprietatea</strong>${publicUrl ? `<a href="${escapeHtml(publicUrl)}">Toate fotografiile ↗</a>` : ''}</div><div class="cover-photos" style="--count:${coverGallery.length}">${coverGallery.map((photo, index) => `<figure><div class="cover-photo-frame">${renderPhoto(photo)}</div><figcaption>${escapeHtml(shorten(photo.alt || `Fotografie ${index + 2}`, 30))}</figcaption></figure>`).join('')}</div></section>` : ''}
    <div class="information">
      <section class="nearby-panel"><h2 class="section-title"><i>${icon('pin')}</i>${nearby.length ? 'În apropiere' : 'Localizare'}</h2>${nearby.length ? `${nearby.map((item) => `<div class="nearby-row"><strong>${escapeHtml(shorten(item.name, 45))}</strong><span>${escapeHtml(formatNumber(item.walkingMinutes))} min</span></div>`).join('')}<p class="nearby-note">Timp estimat de mers pe jos.</p>` : `<p class="area-address">${escapeHtml(shorten(address, 110))}</p>`}</section>
      ${online}
    </div>
    ${contact}${footer(1)}
  </section>
  ${photoGroups.map((group, pageIndex) => `<section class="page gallery-page">
    <header class="masthead">${brand}<div class="masthead-note">${escapeHtml(shorten(location || headline, 65))}<br />Galerie foto</div></header>
    <div class="gallery-intro"><span class="eyebrow">${escapeHtml(transaction)} · ${escapeHtml(headline)}${roomHeadline ? ` · ${escapeHtml(roomHeadline)}` : ''}</span><h2>Proprietatea, în imagini.</h2></div>
    <div class="gallery" data-count="${group.length}">${group.map((photo, index) => `<figure><div class="gallery-image">${renderPhoto(photo)}</div><figcaption><b>${String(pageIndex * 3 + index + 5).padStart(2, '0')}</b>${escapeHtml(shorten(photo.alt || property.title, 72))}</figcaption></figure>`).join('')}</div>
    ${features.length && pageIndex === 0 ? `<div class="gallery-details">${features.map((feature) => `<span>${escapeHtml(shorten(feature, 65))}</span>`).join('')}</div>` : ''}
    ${contact}${footer(pageIndex + 2)}
  </section>`).join('')}
</body></html>`;
}
'''
p.write_text(s,encoding='utf-8')
