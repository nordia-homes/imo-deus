from pathlib import Path
p=Path('tmp/validate-premium-presentation.mjs')
s=p.read_text(encoding='utf-8-sig').replace("const pdf=await PDFDocument.load(bytes);const sheets=await page.locator('.page').count();", "const pdf=await PDFDocument.load(bytes);const sheets=await page.locator('.page').count(); if(name==='gallery-4')fs.writeFileSync('tmp/presentation-qr-qa.pdf',bytes);")
p.write_text(s,encoding='utf-8')
