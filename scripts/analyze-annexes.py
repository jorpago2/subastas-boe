"""Conservative, page-cited extraction; never equates missing text with no risks."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def normalize(text):
    return re.sub(r'\s+', ' ', ''.join(c for c in unicodedata.normalize('NFKD', text)
                                      if not unicodedata.combining(c))).lower().strip()


# Only literal, bounded statements are extracted. Amounts in mortgages are not balances.
RULES = [
    ('occupation-unknown', 'Ocupación sin aclarar',
     r'no consta (?:en (?:el (?:proceso|procedimiento|expediente)|autos) )?si.{0,100}ocupad',
     'El edicto dice que no consta si el inmueble está ocupado por otras personas.'),
    ('occupation-unknown', 'Ocupación sin aclarar',
     r'situacion (?:posesoria|ocupacional)\s*[:.\-]?\s*(?:no consta|desconocida|se desconoce)',
     'El documento no aclara la situación de ocupación del inmueble.'),
    ('occupation-empty', 'Ocupación según el documento',
     r'situacion (?:posesoria|ocupacional)\s*[:.\-]?\s*(?:desocupad[oa]|libre de ocupantes)',
     'El documento señala que está desocupado. Describe la situación documentada, no una comprobación actual.'),
    ('occupation-occupied', 'Ocupación según el documento',
     r'situacion (?:posesoria|ocupacional)\s*[:.\-]?\s*ocupad[oa]',
     'El documento señala que está ocupado. No acredita por sí solo cuándo podría entregarse la posesión.'),
    ('habitual-no', 'Uso de vivienda habitual',
     r'(?:vivienda habitual\s*[:.\-]\s*no\b(?!\s+(?:consta|se|hay|ha|esta|puede|es|figura|acredita|determinad))|no (?:es|constituye|tiene (?:el )?caracter de) (?:la )?vivienda habitual)',
     'El documento indica que no es vivienda habitual.'),
    ('habitual-yes', 'Uso de vivienda habitual',
     r'(?:vivienda habitual\s*[:.\-]\s*si\b|(?<!no )\bes (?:la )?vivienda habitual)',
     'El documento indica que es vivienda habitual.'),
    ('registry-uncoordinated', 'Registro y Catastro',
     r'(?:no coordinad[oa] (?:graficamente )?con (?:el )?catastro|estado de coordinacion.{0,20}no coordinad)',
     'El documento indica que Registro y Catastro no están coordinados gráficamente; conviene contrastar la delimitación del inmueble.'),
    ('prior-charges-condition', 'Condición sobre cargas anteriores',
     r'(?:cargas|gravamenes).{0,120}anteriores.{0,130}(?:continuaran subsistentes|quedaran subsistentes|subsistiran)',
     'El edicto advierte que las cargas anteriores al crédito ejecutado, si existen, siguen vigentes. Esta cláusula no identifica cuáles existen ni su saldo.'),
    ('inspection-condition', 'Visita al inmueble',
     r'(?:solicitar (?:del|al) tribunal inspeccionar el inmueble|solicitar.{0,35}inspeccion del inmueble)',
     'El edicto contempla solicitar una visita al tribunal; no garantiza que se autorice ni que se pueda acceder.'),
]


def page_findings(text, allow_numbers=True):
    text = normalize(text)
    findings = []
    for code, title, pattern, explanation in RULES:
        for match in re.finditer(pattern, text):
            prefix = text[max(0, match.start()-180):match.start()]
            # Conditions and statements of uncertainty are not property facts.
            if code.startswith('habitual-'):
                clause = re.split(r'[.;:]', prefix)[-1]
                if re.search(r'\b(?:si|cuando|supuesto|caso de|no consta|no resulta|no se sabe|desconoce|no se acredita)\b', clause):
                    continue
            if code == 'prior-charges-condition' and re.search(r'\bno\s+(?:continuaran|quedaran|subsistiran)', match.group()):
                continue
            if code == 'inspection-condition' and re.search(r'\bno\s+(?:\w+\s+){0,4}$', prefix):
                continue
            # Keep context locally for audit; only fixed paraphrases go to the website.
            findings.append(dict(code=code, title=title, text=explanation,
                                 excerpt=text[max(0, match.start()-65):match.end()+100]))
            break
    if not allow_numbers:
        return findings
    principal = re.search(r'en reclamacion de\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s*(?:euros|€)\s*de principal', text)
    if principal:
        amount = principal.group(1)
        findings.append(dict(code='claimed-principal', title='Cantidad reclamada',
                             text=f'El edicto reclama {amount} € de principal. No es el precio de venta ni el saldo total de todas las cargas.',
                             excerpt=principal.group(0)))
    # Avoid extracting ownership percentages from community participation quotas.
    share = re.search(r'se subasta\s+(?:el |un |una )?(\d+(?:[.,]\d+)?)\s*%\s*(?:del pleno dominio|de la nuda propiedad)', text)
    if share:
        right = 'nuda propiedad' if 'nuda propiedad' in share.group() else 'pleno dominio'
        findings.append(dict(code='share-sale', title='Derecho que se vende',
                             text=f'El documento indica que se subasta el {share.group(1)} % de {right}.',
                             excerpt=share.group()))
    return findings


def extracted_page_findings(page):
    native = page.get('status') == 'text' and page.get('method') == 'pdftotext'
    ocr = page.get('status') == 'ocr-unverified' and page.get('method') == 'windows-ocr' and page.get('ocrQuality') != 'low'
    if not (native or ocr):
        return []
    findings = page_findings(page.get('text', ''), allow_numbers=native)
    for item in findings:
        item.update(page=page['page'], method=page['method'], extractionStatus=page['status'])
        if ocr:
            item['text'] = 'Lectura automática del escaneo, sin verificar: ' + item['text']
    return findings


def main():
    manifest = json.loads((ROOT/'data/documents/valencia-pdf-manifest.json').read_text('utf-8'))
    rows = json.loads((ROOT/'public/data/catalog.json').read_text('utf-8'))['records']
    files_by_id = defaultdict(dict)
    for f in manifest['files']:
        if 'verCertificadoCierre' not in f['url']:
            files_by_id[f['id']].setdefault(f['sha256'], f)
    documents, records = {}, []
    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        files = list(files_by_id[row['id']].values())
        if not files:
            continue
        sources, all_findings, gaps = [], [], []
        for f in files:
            sha = f['sha256']
            if sha not in documents:
                path = ROOT/'data/document-text'/f'{sha}.json'
                corpus = json.loads(path.read_text('utf-8')) if path.exists() else {'status':'missing', 'pages':[]}
                findings = []
                for page in corpus.get('pages', []):
                    findings.extend(extracted_page_findings(page))
                missing = [p['page'] for p in corpus.get('pages', []) if p.get('status') != 'text' or p.get('method') != 'pdftotext']
                if not corpus.get('pages'):
                    missing = list(range(1, f['pages']+1))
                documents[sha] = dict(sha256=sha, file=f['file'], pageCount=f['pages'],
                    status='partial' if missing else 'automatic-extraction',
                    pagesNeedingReview=missing,
                    ocrPagesAnalyzed=[p['page'] for p in corpus.get('pages', []) if p.get('method') == 'windows-ocr' and p.get('status') == 'ocr-unverified' and p.get('ocrQuality') != 'low'],
                    findings=findings)
            doc = documents[sha]
            sources.append(dict(title=f['title'],url=f['url'],sha256=sha,pages=f['pages'],
                                status=doc['status'],pagesNeedingReview=doc['pagesNeedingReview'],ocrPagesAnalyzed=doc['ocrPagesAnalyzed']))
            if doc['pagesNeedingReview']:
                gaps.append(dict(sha256=sha, pages=doc['pagesNeedingReview']))
            for finding in doc['findings']:
                all_findings.append(dict(finding,sha256=sha,url=f['url'],sourceTitle=f['title']))
        by_code = defaultdict(list)
        for finding in all_findings:
            by_code[finding['code']].append(finding)
        points = []
        for code, group in by_code.items():
            unique_text = list(dict.fromkeys(f['text'] for f in group))
            # Keep distinct findings; conflicting documents are reported, never arbitrarily resolved.
            refs = list({(f['sha256'],f['page']):dict(sha256=f['sha256'],page=f['page'],url=f['url'],method=f['method'],extractionStatus=f['extractionStatus']) for f in group}.values())
            points.append(dict(code=code,title=group[0]['title'],text=' '.join(unique_text),
                               evidence='; '.join(dict.fromkeys(f"{f['sourceTitle']}, p. {f['page']}" + (' (OCR sin verificar)' if f['method']=='windows-ocr' else ' (texto nativo)') for f in group)),references=refs))
        conflicts = []
        if 'habitual-no' in by_code and 'habitual-yes' in by_code:
            conflicts.append('Los anexos contienen indicaciones distintas sobre vivienda habitual; pueden referirse a bienes o fechas diferentes.')
            points = [p for p in points if p['code'] not in ('habitual-no','habitual-yes')]
        if sum(code in by_code for code in ('occupation-empty','occupation-occupied','occupation-unknown'))>1:
            conflicts.append('Los anexos contienen indicaciones distintas sobre ocupación; deben contrastarse por bien y fecha.')
            points = [p for p in points if not p['code'].startswith('occupation-')]
        for conflict in conflicts:
            points.insert(0,dict(code='conflicting-documents',title='Datos que requieren contraste',text=conflict,
                evidence='Indicaciones de ocupación o uso de los anexos relacionados en las fuentes.'))
        if not points:
            points = [dict(code='no-safe-findings',title='Lectura pendiente de revisión',
                          text='No se han extraído datos concretos con suficiente seguridad para resumir este inmueble.',
                          evidence='Anexos relacionados en las fuentes.')]
        limitations = 'Extracción automática de afirmaciones explícitas, pendiente de revisión individual. No determina la deuda vigente ni garantiza la ocupación actual.'
        if gaps:
            limitations += f' Hay {sum(len(g["pages"]) for g in gaps)} páginas escaneadas, con texto insuficiente o pendientes de revisión.'
        ocr_pages = sum(len(s['ocrPagesAnalyzed']) for s in sources)
        if ocr_pages:
            limitations += ' El OCR puede omitir palabras o negaciones: sus indicaciones requieren comprobar la imagen original. No se extraen importes ni porcentajes del OCR.'
        if row.get('lots') != 'Sin lotes':
            limitations += ' Las afirmaciones pueden corresponder a lotes distintos; no se han atribuido automáticamente a un lote.'
        records.append(dict(id=row['id'],documentAnalysis=dict(reviewedAt=now,
            method='Extracción automática por página de texto nativo y, cuando existe, lectura OCR cualitativa sin verificar; sin revisión individual completa.',
            status='partial' if gaps else 'automatic-extraction',sources=sources,points=points,
            limitations=limitations,portalSource=row['url'],coverage=dict(uniqueAnnexes=len(files),pagesNeedingReview=sum(len(g['pages']) for g in gaps),ocrPagesAnalyzed=ocr_pages))))
    out=ROOT/'data/analysis'; out.mkdir(parents=True,exist_ok=True)
    report=dict(generatedAt=now,summary=dict(auctions=len(records),uniqueAnnexes=len(documents),
        statuses=dict(Counter(d['status'] for d in documents.values())),
        findings=sum(len(d['findings']) for d in documents.values()),
        ocrPagesAnalyzed=sum(len(d['ocrPagesAnalyzed']) for d in documents.values())),records=records,documents=list(documents.values()))
    (out/'annexes.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
    print(json.dumps(report['summary']))


def self_test():
    assert not any(f['code']=='habitual-yes' for f in page_findings('No es vivienda habitual.'))
    assert not any(f['code']=='share-sale' for f in page_findings('CUOTA DE PARTICIPACIÓN: 12,50%'))
    assert not any(f['code']=='occupation-empty' for f in page_findings('Si se encontrase desocupado, podrá solicitarse visita.'))
    assert any(f['code']=='occupation-unknown' for f in page_findings('No consta en el proceso si el inmueble se encuentra ocupado.'))
    assert any(f['code']=='claimed-principal' for f in page_findings('En reclamación de 81.368,36 euros de principal.'))
    assert not any(f['code']=='claimed-principal' for f in page_findings('Hipoteca de 81.368,36 euros de principal.'))
    for sentence in ('Si es vivienda habitual, el porcentaje cambia.', 'Si no es vivienda habitual, el porcentaje cambia.',
                     'Vivienda habitual: no consta.', 'No consta si la finca es la vivienda habitual del deudor.',
                     'Se desconoce si es vivienda habitual.'):
        assert not any(f['code'].startswith('habitual-') for f in page_findings(sentence)), sentence
    assert not any(f['code']=='prior-charges-condition' for f in page_findings('Las cargas anteriores no continuarán subsistentes.'))
    assert not any(f['code']=='inspection-condition' for f in page_findings('No se puede solicitar del tribunal inspeccionar el inmueble.'))
    assert any(f['code']=='habitual-yes' for f in page_findings('La finca subastada es vivienda habitual de los ejecutados.'))
    assert any(f['code']=='habitual-no' for f in page_findings('La finca subastada no constituye vivienda habitual.'))
    # Real edict contains both alternatives; aggregation must flag the conflict.
    actual = page_findings('La finca que se subasta no es vivienda habitual es la vivienda habitual del deudor.')
    assert {'habitual-no','habitual-yes'} <= {f['code'] for f in actual}
    ocr = extracted_page_findings(dict(page=2,method='windows-ocr',status='ocr-unverified',
        text='Situación posesoria: ocupada. En reclamación de 81.368,36 euros de principal. Se subasta el 50% del pleno dominio.'))
    assert {f['code'] for f in ocr} == {'occupation-occupied'}
    assert ocr[0]['method']=='windows-ocr' and ocr[0]['extractionStatus']=='ocr-unverified'
    assert ocr[0]['text'].startswith('Lectura automática del escaneo, sin verificar:')
    assert not extracted_page_findings(dict(page=2,method='windows-ocr',status='error',text='Situación posesoria: ocupada.'))
    assert not extracted_page_findings(dict(page=2,method='windows-ocr',status='ocr-unverified',ocrQuality='low',text='Situación posesoria: ocupada.'))
    assert not any(f['code']=='habitual-yes' for f in page_findings('No resulta expresamente del Registro que la finca es la vivienda habitual.'))
    assert not any(f['code']=='claimed-principal' for f in page_findings('En reclamación de 81.36,36 euros de principal.'))
    print('Comprobaciones de contexto, negaciones y límites OCR correctas')


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--self-test',action='store_true')
    if parser.parse_args().self_test:self_test()
    else:main()
