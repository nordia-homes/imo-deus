from pathlib import Path
p=Path('tmp/validate-premium-presentation.mjs')
s=p.read_text(encoding='utf-8-sig')
s=s.replace("if(el.closest('svg'))continue;", "if(el.closest('svg') || el.matches('.photo-crop .photo'))continue;")
s=s.replace("const intro=document.querySelector('.intro'); const hero=document.querySelector('.hero');", "const intro=document.querySelector('.intro'); const hero=document.querySelector('.price-card');")
s=s.replace("Intro overlaps hero", "Intro overlaps price")
s=s.replace("1+Math.ceil((data.property.images.length-1)/3)", "1+Math.ceil(Math.max(0,data.property.images.length-4)/3)")
s=s.replace("if(name==='gallery-4')", "if(name==='gallery-7')")
p.write_text(s,encoding='utf-8')
