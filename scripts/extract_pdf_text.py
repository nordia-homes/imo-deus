from pathlib import Path
import sys

pdf_path = Path(sys.argv[1])

try:
    from pypdf import PdfReader
except Exception as exc:
    print(f"IMPORT_ERROR:{exc}")
    raise

reader = PdfReader(str(pdf_path))
print(f"PAGES:{len(reader.pages)}")
for index, page in enumerate(reader.pages[:2], start=1):
    text = page.extract_text() or ""
    print(f"--- PAGE {index} ---")
    print(text[:5000])
