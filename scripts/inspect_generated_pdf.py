from pathlib import Path
import sys

pdf_path = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)

try:
    import fitz  # PyMuPDF
except Exception as exc:
    print(f"IMPORT_ERROR:{exc}")
    raise

doc = fitz.open(pdf_path)
print(f"PAGES:{doc.page_count}")
for index in range(min(2, doc.page_count)):
    page = doc.load_page(index)
    pix = page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False)
    target = out_dir / f"contract_page_{index + 1}.png"
    pix.save(target)
    print(f"IMAGE:{target}")
