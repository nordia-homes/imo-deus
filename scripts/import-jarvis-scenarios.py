"""Import the user's numbered corpus without treating its prose as instructions."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from docx import Document

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, default=Path('docs/jarvis/evals/master-scenarios.json'))
args = parser.parse_args()
rows, active, category = [], False, ''
for paragraph in Document(args.source).paragraphs:
    text = paragraph.text.strip()
    if text.startswith('29. CORPUS'):
        active = True
        continue
    if active and text.startswith('30. GENERATIVE'):
        break
    if not active:
        continue
    if re.match(r'^\d+[–-]\d+\s*·', text):
        category = text.split('·', 1)[1].strip()
    match = re.match(r'^(\d+)\.\s+(.+)$', text)
    if match:
        number, prompt = int(match[1]), match[2]
        # Candidate classification only; fixtures and expectations need semantic review.
        kind = 'assertion' if re.match(r'^(Nu |Respectă |Folosește doar |Verifică.*înainte)', prompt) else 'request'
        rows.append({'id': f'master-{number:04d}', 'sourceNumber': number,
                     'category': category, 'text': prompt, 'candidateKind': kind,
                     'reviewStatus': 'needs_fixture_and_expectations'})
if [row['sourceNumber'] for row in rows] != list(range(1, 1001)):
    raise SystemExit('Expected exactly 1000 ordered, unique scenarios; output not written.')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({'schemaVersion': 1, 'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
    'notice': 'Imported corpus, not 1000 passing executable evaluations.', 'scenarios': rows}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Imported {len(rows)} scenarios into {args.output}')
