"""Extract each verified PDF once by SHA, retaining page-level coverage gaps."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/document-text'


def extract(item):
    target = OUT / (item['sha256'] + '.json')
    if target.exists():
        cached = json.loads(target.read_text(encoding='utf-8'))
        if cached.get('status') != 'error':
            return cached
    result = dict(schemaVersion=1, sha256=item['sha256'], sourceFile=item['file'],
                  pageCount=item['pages'], status='error', pages=[])
    try:
        process = subprocess.run([shutil.which('pdftotext'), '-layout', '-enc', 'UTF-8',
                                  str(ROOT / item['file']), '-'], capture_output=True, timeout=180)
        if process.returncode:
            raise RuntimeError(process.stderr.decode('utf-8', errors='replace')[:1000])
        texts = process.stdout.decode('utf-8', errors='replace').split('\f')
        if texts and not texts[-1].strip():
            texts.pop()
        if len(texts) != item['pages']:
            raise ValueError(f"Page count mismatch: {len(texts)} extracted, {item['pages']} expected")
        for number, text in enumerate(texts, 1):
            count = sum(c.isalnum() for c in text)
            result['pages'].append(dict(page=number, text=text.strip(), method='pdftotext',
                                        status='text' if count >= 40 else 'sparse-text' if count else 'no-text'))
        result['status'] = 'needs-ocr' if any(p['status'] != 'text' for p in result['pages']) else 'complete'
    except Exception as error:
        result['error'] = str(error)
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    temporary.replace(target)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'data/documents/valencia-pdf-manifest.json').read_text(encoding='utf-8'))
    catalog = json.loads((ROOT / 'public/data/catalog.json').read_text(encoding='utf-8'))
    priority = {r['id'] for r in catalog['records'] if r['status'] in ('Activa', 'Próxima')}
    unique = {}
    for item in sorted(manifest['files'], key=lambda f: f['id'] not in priority):
        unique.setdefault(item['sha256'], item)
    summary = dict(createdAt=datetime.now(timezone.utc).isoformat(), files=len(manifest['files']),
                   uniquePdfs=len(unique), complete=0, needsOcr=0, errors=[], pages=0, textPages=0,
                   sparsePages=0, emptyPages=0, ocrPages=0)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(extract, item) for item in unique.values()]
        for index, future in enumerate(as_completed(futures), 1):
            result = future.result()
            summary['pages'] += len(result['pages'])
            for page in result['pages']:
                summary[{'text': 'textPages', 'sparse-text': 'sparsePages', 'no-text': 'emptyPages',
                         'ocr-unverified': 'ocrPages'}[page['status']]] += 1
            if result['status'] == 'error':
                summary['errors'].append(dict(sha256=result['sha256'], error=result['error']))
            else:
                summary['complete' if result['status'] == 'complete' else 'needsOcr'] += 1
            if index % 100 == 0:
                print(json.dumps(dict(processed=index, total=len(unique), textPages=summary['textPages'],
                                      emptyPages=summary['emptyPages'])), flush=True)
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
