"""Recover sparse/image page text locally; all OCR stays explicitly unverified."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
from pathlib import Path
import shutil
import subprocess
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/document-text'
TEMP = ROOT / 'tmp/pdfs/ocr-pages'
local = threading.local()
processes = []
COMMON_WORDS = {'de','la','el','en','que','los','las','del','con','por','para','una','un','se','al','su','no','es','esta','este','y'}
counter_lock = threading.Lock()
attempted_pages = 0
started_at = time.monotonic()
image_plan = OUT / 'image-candidates.json'
image_candidates = {r['sha256']: set(r['pages']) for r in
    json.loads(image_plan.read_text(encoding='utf-8'))['candidates']} if image_plan.exists() else {}


def needs_ocr(page):
    words = re.findall(r'[a-záéíóúñü]+', page['text'].lower())
    doubtful_orientation = (page.get('method') == 'windows-ocr' and not page.get('ocrOrientationChecked') and
        len(words) > 30 and sum(w in COMMON_WORDS for w in words) / len(words) < 0.07)
    return (page.get('ocrError') and not page.get('ocrErrorRetried')) or doubtful_orientation or (page.get('imageDominant') and not page.get('ocrAttempted')) or (page.get('method') == 'windows-ocr' and 'ocrRotation' not in page and
            sum(c.isalpha() for c in page['text']) < 200) or (not page.get('ocrAttempted') and (page['status'] in ('no-text', 'sparse-text') or
        page.get('method') == 'pdftotext' and sum(c.isalnum() for c in page['text']) < 200)
    )


def process_document(path):
    global attempted_pages
    if not hasattr(local, 'ocr'):
        local.ocr = subprocess.Popen(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', str(ROOT / 'scripts/ocr-document-page.ps1')], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding='utf-8')
        processes.append(local.ocr)
    document = json.loads(path.read_text(encoding='utf-8'))
    for page in document['pages']:
        if page['page'] in image_candidates.get(document['sha256'], set()) and page['method'] == 'pdftotext':
            page['imageDominant'] = True
    recovered = errors = 0
    rendered = {}
    for page_index, page in enumerate(document['pages']):
        if not needs_ocr(page):
            continue
        stem = TEMP / f"{document['sha256']}-{page['page']}"
        image = stem.with_suffix('.jpg')
        page['ocrAttempted'] = True
        if page.get('ocrError'):
            page['ocrErrorRetried'] = True
        try:
            if page['page'] not in rendered:
                # Render contiguous scans together: opening a large PDF per page is costly.
                chunk = [page]
                for candidate in document['pages'][page_index + 1:page_index + 20]:
                    if not needs_ocr(candidate):
                        break
                    chunk.append(candidate)
                subprocess.run([shutil.which('pdftoppm'), '-f', str(page['page']), '-l', str(chunk[-1]['page']),
                    '-scale-to', '2200', '-jpeg', '-jpegopt', 'quality=95', str(ROOT / document['sourceFile']), str(stem)],
                    check=True, capture_output=True, timeout=600)
                for output in TEMP.glob(stem.name + '-*.jpg'):
                    rendered[int(output.stem.rsplit('-', 1)[1])] = output
            image = rendered.pop(page['page'])
            local.ocr.stdin.write(json.dumps({'image': str(image)}) + '\n')
            local.ocr.stdin.flush()
            response = json.loads(local.ocr.stdout.readline())
            if response.get('error'):
                raise RuntimeError(response['error'])
            page.setdefault('nativeText', page['text'])
            page.pop('ocrError', None)
            page['text'] = response['text']
            page['method'] = 'windows-ocr'
            page['status'] = 'ocr-unverified' if response['text'].strip() else 'no-text'
            page['ocrRotation'] = response.get('rotation', 0)
            page['ocrOrientationChecked'] = response.get('orientationChecked', False)
            words = re.findall(r'[a-záéíóúñü]+', response['text'].lower())
            low_quality = (sum(c.isalpha() for c in response['text']) < 200 or
                len(words) > 30 and sum(w in COMMON_WORDS for w in words) / len(words) < 0.07)
            page['ocrQuality'] = 'low' if low_quality else 'unverified'
            recovered += bool(response['text'].strip())
        except Exception as error:
            page['ocrError'] = str(error)
            errors += 1
        finally:
            image.unlink(missing_ok=True)
        document['status'] = 'needs-review'
        temporary = path.with_suffix('.ocr-tmp')
        temporary.write_text(json.dumps(document, ensure_ascii=False), encoding='utf-8')
        for attempt in range(50):
            try:
                temporary.replace(path)
                break
            except PermissionError:
                if attempt == 49:
                    raise
                time.sleep(0.1)
        with counter_lock:
            attempted_pages += 1
            if attempted_pages % 500 == 0:
                print(json.dumps(dict(attemptedPages=attempted_pages,
                    elapsedSeconds=round(time.monotonic()-started_at))), flush=True)
    return dict(sha256=document['sha256'], ocrPages=recovered, errors=errors)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--priority-only', action='store_true')
    parser.add_argument('--summary-only', action='store_true')
    args = parser.parse_args()
    if args.summary_only:
        summarize_corpus()
        return
    TEMP.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'data/documents/valencia-pdf-manifest.json').read_text(encoding='utf-8'))
    catalog = json.loads((ROOT / 'public/data/catalog.json').read_text(encoding='utf-8'))
    priority = {r['id'] for r in catalog['records'] if r['status'] in ('Activa', 'Próxima')}
    priority_hashes = {f['sha256'] for f in manifest['files'] if f['id'] in priority}
    paths = []
    for path in OUT.glob('*.json'):
        if len(path.stem) != 64 or args.priority_only and path.stem not in priority_hashes:
            continue
        document = json.loads(path.read_text(encoding='utf-8'))
        if any(needs_ocr(p) or (p['method'] == 'pdftotext' and
            p['page'] in image_candidates.get(document['sha256'], set())) for p in document['pages']):
            paths.append(path)
    paths.sort(key=lambda p: p.stem not in priority_hashes)
    print(json.dumps({'queuedDocuments': len(paths)}), flush=True)
    count = 0
    started = time.monotonic()
    try:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(process_document, path) for path in paths]
            for index, future in enumerate(as_completed(futures), 1):
                result = future.result()
                count += result['ocrPages']
                if index % 50 == 0 or result['errors'] or index == len(paths):
                    print(json.dumps(dict(processed=index, total=len(paths), ocrPages=count,
                        elapsedSeconds=round(time.monotonic()-started), **{'last':result})), flush=True)
    finally:
        for process in processes:
            process.stdin.close()
            process.wait(timeout=10)
    summarize_corpus()


def summarize_corpus():
    summary = dict(documents=0, pages=0, nativeTextPages=0, ocrPages=0, lowQualityOcrPages=0,
                   unreadablePages=0, ocrErrors=0, pendingPages=0, ocrAttemptedPages=0,
                   ocrWithTextPages=0, lowQualityOcrWithTextPages=0, emptyAfterOcrPages=0,
                   nativePagesWithoutOcr=0)
    for path in OUT.glob('*.json'):
        if len(path.stem) != 64:
            continue
        document = json.loads(path.read_text(encoding='utf-8'))
        summary['documents'] += 1
        for page in document['pages']:
            summary['pages'] += 1
            summary['nativeTextPages'] += page['method'] == 'pdftotext' and page['status'] == 'text'
            summary['nativePagesWithoutOcr'] += page['method'] == 'pdftotext'
            summary['ocrPages'] += page['method'] == 'windows-ocr'
            summary['ocrAttemptedPages'] += bool(page.get('ocrAttempted'))
            summary['ocrWithTextPages'] += page['method'] == 'windows-ocr' and bool(page['text'].strip())
            summary['lowQualityOcrWithTextPages'] += page.get('ocrQuality') == 'low' and bool(page['text'].strip())
            summary['emptyAfterOcrPages'] += page['method'] == 'windows-ocr' and not page['text'].strip()
            summary['lowQualityOcrPages'] += page.get('ocrQuality') == 'low'
            summary['unreadablePages'] += page['status'] == 'no-text'
            summary['ocrErrors'] += bool(page.get('ocrError'))
            summary['pendingPages'] += needs_ocr(page)
    assert summary['pages'] == summary['nativePagesWithoutOcr'] + summary['ocrPages']
    assert summary['ocrPages'] == summary['ocrWithTextPages'] + summary['emptyAfterOcrPages']
    (OUT / 'ocr-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    main()
