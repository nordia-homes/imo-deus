from pathlib import Path
p=Path('src/lib/property-presentations/pdf-template.ts')
s=p.read_text(encoding='utf-8-sig')
start=s.index('  return `<!doctype html>')
s=s[:start]+r'''  return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8" /><title>${escapeHtml(property.title)} — prezentare</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  :root { --paper: #faf7f0; --gold: #9a7540; --ink: #302a22; --muted: #716655; --line: #d9c8ab; }
  html, body { margin: 0; background: #fff; color: var(--ink); font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  a { color: inherit; text-decoration: none; }
  svg { display: block; width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.35; stroke-linecap: round; stroke-linejoin: round; }
  .page { position: relative; width: 210mm; height: 297mm; display: flex; flex-direction: column; background: radial-gradient(ellipse at 12% 76%, #fffdf9, transparent 65%), #f6f0e6; break-after: page; }
  .page:last-child { break-after: auto; }
  .hero { position: relative; flex: 0 0 157mm; margin: 0; }
  .hero-frame { position: absolute; inset: 0 0 0 63mm; background: #e8dfcd; }
  .photo { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
  .hero-frame .photo { object-position: 60% center; }
  .hero-frame::after { content: ''; position: absolute; inset: 0; background: linear-gradient(0deg, #f6f0e6, transparent 12%); pointer-events: none; }
  .hero-curve { position: absolute; inset: 0; width: 100%; height: 100%; stroke: none; }
  .hero-copy { position: absolute; left: 8mm; top: 8mm; width: 70mm; }
  .brand { display: flex; flex-direction: column; align-items: center; gap: 1.5mm; color: var(--gold); text-align: center; }
  .brand-mark { display: block; width: 17mm; height: 13mm; }
  .brand-mark svg { stroke-width: 1; }
  .brand-logo { max-width: 52mm; max-height: 15mm; object-fit: contain; }
  .brand > span:last-child { font-family: Georgia, 'Times New Roman', serif; font-size: 23px; letter-spacing: .045em; text-transform: uppercase; line-height: 1.05; overflow-wrap: anywhere; }
  .brand-caption { font-family: Georgia, 'Times New Roman', serif; text-align: center; font-style: italic; font-size: 9px; margin: 2mm 0 0; color: #756549; }
  .ornament { display: flex; align-items: center; justify-content: center; gap: 2.5mm; color: var(--gold); margin: 3mm 7mm 0; font-size: 7px; }
  .ornament::before, .ornament::after { content: ''; height: 1px; width: 25mm; background: linear-gradient(90deg, transparent, #af8f5b); }
  .ornament::after { transform: rotate(180deg); }
  .intro { margin-top: 9mm; }
  .eyebrow { display: block; font-size: 8px; font-weight: 600; line-height: 1.4; letter-spacing: .17em; text-transform: uppercase; color: var(--gold); }
  h1 { font-size: 27px; font-family: Georgia, 'Times New Roman', serif; font-weight: 400; line-height: 1.12; letter-spacing: -.03em; margin: 2.5mm 0 0; overflow-wrap: anywhere; }
  h1 .property-kind { display: block; text-transform: uppercase; font-family: Arial, Helvetica, sans-serif; font-size: 23px; letter-spacing: .025em; }
  h1 em { display: block; font-size: 43px; line-height: 1.06; font-style: normal; color: var(--gold); margin-top: .8mm; }
  .title-medium h1 .property-kind { font-size: 19px; }
  .title-small h1 .property-kind { font-size: 17px; }
  .title-medium h1 em, .title-small h1 em { font-size: 34px; }
  .partition { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .11em; margin: 2mm 0 0; }
  .address { display: flex; align-items: flex-start; gap: 2mm; margin: 5mm 0 0; max-width: 64mm; font-size: 9px; line-height: 1.5; color: var(--muted); }
  .address i { flex-shrink: 0; width: 4mm; height: 4mm; color: var(--gold); }
  .address span { overflow-wrap: anywhere; }
  .tagline { font-family: 'Segoe Script', 'URW Chancery L', cursive; font-size: 16px; font-style: italic; line-height: 1.4; color: var(--gold); margin: 4mm 0 0; max-width: 63mm; }
  .hero-stamp { position: absolute; top: 7mm; right: 7mm; max-width: 64mm; border: 1px solid #fff9; border-radius: 99px; background: #faf7f0ee; padding: 2.3mm 4mm; color: #755b34; font-size: 8px; letter-spacing: .09em; text-transform: uppercase; }
  .price-card { position: absolute; left: 8mm; bottom: 18mm; width: 70mm; border: 1px solid #d8bf96; border-radius: 3mm 7mm 3mm 3mm; background: linear-gradient(105deg, #ecddc1, #faf3e6 75%); padding: 3.2mm 4mm; box-shadow: 0 2mm 5mm #8f71430b; }
  .price-card .eyebrow { font-size: 7px; }
  .price { display: block; font-family: Georgia, 'Times New Roman', serif; font-size: 29px; font-weight: 400; line-height: 1.15; letter-spacing: -.025em; margin-top: .7mm; white-space: nowrap; }
  .price small { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: var(--muted); letter-spacing: 0; }
  .price-long { font-size: 23px; }
  .commission { font-size: 7px; color: #776343; margin-top: 1mm; }
  .specs { position: relative; z-index: 2; flex: 0 0 28mm; margin: -9mm 7mm 0; padding: 4mm 3mm 3mm; border: 1px solid #fff; border-radius: 5mm; background: linear-gradient(120deg, #fffcf7, #efe4d2); box-shadow: 0 2mm 6mm #795c2412; display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); align-items: center; }
  .spec { display: grid; grid-template-columns: 9mm 1fr; align-items: center; gap: 2.8mm; padding: 0 3.5mm; border-left: 1px solid #d4c0a0; }
  .spec:first-child { border: 0; }
  .spec-icon { display: block; width: 9mm; height: 10mm; color: var(--gold); }
  .spec strong { display: block; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 400; line-height: 1.1; white-space: nowrap; }
  .spec strong small { font-size: 14px; }
  .spec-label { display: block; font-size: 6.2px; line-height: 1.3; letter-spacing: .04em; text-transform: uppercase; margin-top: 1mm; color: var(--muted); }
  .specs-empty { display: flex; justify-content: center; font-size: 11px; color: var(--muted); }
  .cover-gallery { flex: 0 0 45mm; margin: 4mm 7mm 0; }
  .gallery-heading { display: flex; justify-content: space-between; align-items: center; padding: 0 1mm 2mm; font-size: 6.5px; text-transform: uppercase; letter-spacing: .12em; color: #8b7757; }
  .gallery-heading strong { font-weight: 600; }
  .cover-photos { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); gap: 3mm; height: 39mm; }
  .cover-photos figure { position: relative; margin: 0; min-width: 0; border: 1.5px solid #fffdf9; border-radius: 5mm; box-shadow: 0 1mm 3mm #6f552419; background: #efe7d8; }
  .cover-photo-frame { height: 100%; border-radius: 4.5mm; overflow: hidden; position: relative; }
  .photo-crop .photo { position: absolute; width: 200%; height: 200%; max-width: none; top: -40%; }
  .photo-crop-0 .photo { left: 0; }
  .photo-crop-1 .photo { left: -50%; }
  .photo-crop-2 .photo { left: -100%; }
  .cover-photos figcaption { position: absolute; bottom: -2mm; left: 10%; width: 80%; border: 1px solid #b79662; border-radius: 99px; background: linear-gradient(110deg, #e7d4b2, #f4e8d3); color: #684d27; text-align: center; font-size: 7px; font-weight: 600; text-transform: uppercase; padding: 1.2mm 2mm; line-height: 1.25; }
  .information { flex: 1; min-height: 0; display: grid; grid-template-columns: 1.1fr 1fr; gap: 6mm; margin: 7mm 8mm 3mm; }
  .section-title { display: flex; align-items: center; gap: 2.4mm; font-family: Georgia, 'Times New Roman', serif; font-size: 17px; font-weight: 400; margin: 0 0 3mm; white-space: nowrap; }
  .section-title::after { content: ''; height: 1px; flex: 1; background: linear-gradient(90deg, #bba17a, transparent); }
  .section-title i { display: block; width: 5mm; height: 5mm; color: var(--gold); }
  .details-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3mm 2mm; margin: 0; }
  .detail { text-align: center; padding: 0 1mm; border-left: 1px solid #ddd0bd; }
  .detail:nth-child(3n+1) { border: 0; }
  .detail dt { font-size: 6.3px; color: var(--muted); margin-bottom: 1mm; }
  .detail dd { font-family: Georgia, 'Times New Roman', serif; font-size: 9px; line-height: 1.3; margin: 0; overflow-wrap: anywhere; }
  .nearby-panel { border: 1px solid #d6c09c; border-radius: 4mm 4mm 9mm 4mm; padding: 3mm 4mm; background: linear-gradient(120deg, #f1e5d1, #fbf7ef); align-self: start; }
  .nearby-panel .section-title { font-size: 16px; margin-bottom: 1.6mm; }
  .nearby-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2mm; border-top: 1px solid #dfd0b9; padding: 1.5mm 0; font-size: 7.5px; line-height: 1.3; }
  .nearby-row strong { font-weight: 400; overflow-wrap: anywhere; }
  .nearby-row span { color: #8a6632; font-weight: 600; white-space: nowrap; }
  .nearby-note { font-size: 6px; color: var(--muted); margin: 1mm 0 0; }
  .detail-note, .area-address { font-size: 9px; color: var(--muted); line-height: 1.5; margin: 0; overflow-wrap: anywhere; }
  .area-note { font-size: 8px; color: var(--muted); line-height: 1.5; margin: 2mm 0 0; }
  .contact { flex-shrink: 0; min-height: 21mm; display: flex; align-items: center; gap: 5mm; padding: 3mm 8mm; border-top: 1px solid #d3bea0; border-bottom: 1px solid #e7ddcf; background: linear-gradient(105deg, #fffdf8, #eee2cf); box-shadow: 0 -1mm 3mm #92744908; }
  .contact-invite { flex: 1; min-width: 0; }
  .contact-invite .eyebrow { font-size: 6px; letter-spacing: .1em; }
  .contact h2 { display: flex; align-items: center; gap: 2mm; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 400; line-height: 1.15; margin: 1.8mm 0 0; color: #75552e; }
  .inline-arrow { display: inline-block; flex-shrink: 0; width: 6mm; height: 4mm; }
  .contact-person { width: 65mm; min-width: 0; overflow-wrap: anywhere; border-left: 1px solid #c8b28f; padding-left: 5mm; }
  .contact-person strong { display: block; font-size: 8px; margin-bottom: 1mm; }
  .contact-phone { display: block; font-size: 15px; font-weight: 600; letter-spacing: .015em; }
  .contact-email { display: block; font-size: 7px; color: var(--muted); margin-top: 1mm; line-height: 1.25; }
  .qr-link { flex-shrink: 0; width: 16mm; text-align: center; }
  .qr-link img { display: block; width: 16mm; height: 16mm; background: #fff; }
  .qr-link span { display: block; font-size: 6px; color: var(--gold); margin-top: .5mm; }
  .footer { display: flex; justify-content: space-between; align-items: center; gap: 3mm; flex-shrink: 0; min-height: 7mm; padding: 1.5mm 8mm; font-size: 6px; color: #8c7a60; line-height: 1.3; }
  .footer > span:first-child { max-width: 100mm; overflow-wrap: anywhere; }
  .footer > span:last-child { white-space: nowrap; }
  .footer-divider { margin: 0 2mm; }
  .page-number { margin-left: 3mm; }
  .photo-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5mm; height: 100%; color: #8c795a; background: linear-gradient(135deg, #ebe0cd, #faf7f0); font-size: 10px; }
  .photo-empty svg { width: 24mm; height: 24mm; color: #c4af87; }
  .no-photos .information { margin-top: 12mm; }
  .no-photos .details-grid { gap: 6mm 2mm; }
  .gallery-page { padding: 8mm 8mm 0; }
  .masthead { flex: 0 0 16mm; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); gap: 8mm; }
  .masthead .brand { flex-direction: row; text-align: left; gap: 3mm; }
  .masthead .brand-mark { width: 8mm; height: 8mm; }
  .masthead .brand > span:last-child { font-size: 16px; }
  .masthead .brand-logo { max-height: 9mm; max-width: 25mm; }
  .masthead-note { font-size: 7px; line-height: 1.5; letter-spacing: .1em; text-align: right; color: var(--muted); text-transform: uppercase; }
  .gallery-intro { flex-shrink: 0; padding: 7mm 0 5mm; }
  .gallery-intro h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 34px; font-weight: 400; margin: 2mm 0 0; color: #51412d; }
  .gallery-intro h2 em { color: var(--gold); }
  .gallery { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: 1.1fr 1fr; gap: 4mm; padding-bottom: 5mm; }
  .gallery figure { display: flex; flex-direction: column; min-width: 0; min-height: 0; margin: 0; }
  .gallery figure:first-child { grid-column: 1 / -1; }
  .gallery-image { flex: 1; min-height: 0; border: 2px solid #fff; border-radius: 5mm; overflow: hidden; }
  .gallery figcaption { display: flex; gap: 2mm; font-size: 8px; color: var(--muted); line-height: 1.3; padding: 2mm 2mm 0; }
  .gallery figcaption b { color: var(--gold); font-weight: 400; }
  .gallery[data-count="1"] { grid-template-rows: 1fr; }
  .gallery[data-count="2"] { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .gallery-details { display: flex; flex-wrap: wrap; gap: 2mm 4mm; padding: 2mm 0 4mm; font-size: 8px; color: var(--muted); }
  .gallery-details span::before { content: '◇'; color: var(--gold); margin-right: 2mm; }
  .gallery-page .contact, .gallery-page .footer { margin-left: -8mm; margin-right: -8mm; }
</style></head><body>
  <section class="page cover${coverGallery.length ? '' : ' no-photos'}">
    <div class="hero">
      <div class="hero-frame">${renderPhoto(images[0])}</div>
      <svg class="hero-curve" viewBox="0 0 210 157" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ivory" x1="0" x2="1"><stop stop-color="#fffdf9"/><stop offset="1" stop-color="#f6f0e5"/></linearGradient><linearGradient id="gold" x1="0" x2="1"><stop stop-color="#a5824b"/><stop offset=".6" stop-color="#e4d3b2"/><stop offset="1" stop-color="#c4a674"/></linearGradient></defs><path fill="url(#gold)" d="M0 0H66C110 36 96 70 85 100C75 127 91 148 123 157H0Z"/><path fill="url(#ivory)" d="M0 0H63C105 36 92 70 81 100C71 127 87 148 119 157H0Z"/></svg>
      <div class="hero-stamp">${escapeHtml(shorten(location || transaction, 54))}</div>
      <div class="hero-copy">
        ${brand}<p class="brand-caption">Proprietăți. Oameni. Acasă.</p><div class="ornament">◆</div>
        <div class="intro${titleSize}"><span class="eyebrow">${escapeHtml(transaction)}</span><h1><span class="property-kind">${escapeHtml(headline)}</span>${secondaryHeadline ? `<em>${escapeHtml(secondaryHeadline)}</em>` : ''}</h1>${property.partitioning && roomHeadline ? `<p class="partition">${escapeHtml(shorten(property.partitioning, 30))}</p>` : ''}<p class="address"><i>${icon('pin')}</i><span>${escapeHtml(shorten(address, 100))}</span></p>${property.tagline ? `<p class="tagline">${escapeHtml(shorten(property.tagline, 65))}</p>` : ''}</div>
      </div>
      <div class="price-card"><span class="eyebrow">${isRental ? 'Chirie lunară' : 'Preț de prezentare'}</span><strong class="price${price.length > 11 ? ' price-long' : ''}">${escapeHtml(price)}${isRental && positive(property.price) ? '<small> / lună</small>' : ''}</strong>${commission ? `<div class="commission">${escapeHtml(commission)}</div>` : ''}</div>
    </div>
    <div class="specs${specs.length ? '' : ' specs-empty'}" style="--count:${specs.length || 1}">${specs.length ? specs.map((spec) => `<div class="spec"><i class="spec-icon">${icon(spec.icon)}</i><div><strong>${escapeHtml(spec.value)}${spec.unit ? ` <small>${spec.unit}</small>` : ''}</strong><span class="spec-label">${escapeHtml(spec.label)}</span></div></div>`).join('') : 'Detalii despre proprietate, la cerere.'}</div>
    ${coverGallery.length ? `<section class="cover-gallery"><div class="gallery-heading"><strong>Acasă, în detaliu</strong><span>${isPhotoDetail ? 'Cadre din fotografia principală' : 'Galeria proprietății'}</span></div><div class="cover-photos" style="--count:${coverGallery.length}">${coverGallery.map((photo, index) => `<figure><div class="cover-photo-frame${isPhotoDetail ? ` photo-crop photo-crop-${index}` : ''}">${renderPhoto(photo)}</div><figcaption>${escapeHtml(isPhotoDetail ? `Detaliu ${String(index + 1).padStart(2, '0')}` : shorten(photo.alt || `Fotografie ${index + 2}`, 30))}</figcaption></figure>`).join('')}</div></section>` : ''}
    <div class="information">
      <section><h2 class="section-title"><i>${icon('key')}</i>Confort &amp; detalii</h2>${details.length ? `<dl class="details-grid">${details.slice(0, 6).map(([label, value]) => `<div class="detail"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(shorten(value, 34))}</dd></div>`).join('')}</dl>` : `<p class="detail-note">${escapeHtml(shorten(property.description, 180) || 'Contactează consultantul pentru specificații și informații suplimentare despre proprietate.')}</p>`}</section>
      <section class="nearby-panel"><h2 class="section-title"><i>${icon('pin')}</i>${nearby.length ? 'Totul, aproape de tine' : 'Descoperă zona'}</h2>${nearby.length ? `${nearby.map((item) => `<div class="nearby-row"><strong>${escapeHtml(shorten(item.name, 42))}</strong><span>${escapeHtml(formatNumber(item.walkingMinutes))} min</span></div>`).join('')}<p class="nearby-note">Timp estimat de mers pe jos.</p>` : `<p class="area-address">${escapeHtml(shorten(address, 100))}</p><p class="area-note">Descoperă proprietatea și împrejurimile la o vizionare.</p>`}</section>
    </div>
    ${contact}${footer(1)}
  </section>
  ${photoGroups.map((group, pageIndex) => `<section class="page gallery-page">
    <header class="masthead">${brand}<div class="masthead-note">${escapeHtml(shorten(location || headline, 65))}<br />Galerie foto</div></header>
    <div class="gallery-intro"><span class="eyebrow">${escapeHtml(transaction)} · ${escapeHtml(headline)}${roomHeadline ? ` · ${escapeHtml(roomHeadline)}` : ''}</span><h2>O privire <em>mai aproape.</em></h2></div>
    <div class="gallery" data-count="${group.length}">${group.map((photo, index) => `<figure><div class="gallery-image">${renderPhoto(photo)}</div><figcaption><b>${String(pageIndex * 3 + index + 5).padStart(2, '0')}</b>${escapeHtml(shorten(photo.alt || property.title, 72))}</figcaption></figure>`).join('')}</div>
    ${features.length && pageIndex === 0 ? `<div class="gallery-details">${features.map((feature) => `<span>${escapeHtml(shorten(feature, 65))}</span>`).join('')}</div>` : ''}
    ${contact}${footer(pageIndex + 2)}
  </section>`).join('')}
</body></html>`;
}
'''
p.write_text(s,encoding='utf-8')
