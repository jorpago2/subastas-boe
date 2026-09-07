"""Extract only explicit BOE closure outcomes; amounts are integer euro cents."""
import argparse
import bisect
import collections
import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MONEY = r"(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}"
RESULT = re.compile(
    r"La subasta(?P<lot> del lote)? (?:(?:concluyó (?P<no>sin pujas)\.)|"
    r"(?:concluyó con pujas \(puja máxima (?P<amount>" + MONEY + r") euros\)\.)|"
    r"(?:ha sido (?P<cancel>cancelada)\.))"
)


def parse(pages, auction_id):
    # Keep page offsets after whitespace normalization, including wrapped sentences.
    texts = [re.sub(r"\s+", " ", p["text"]).strip() for p in pages]
    starts, pos = [], 0
    for text in texts:
        starts.append(pos)
        pos += len(text) + 1
    text = " ".join(texts)
    if not re.search(r"CERTIFICACIÓN DE CIERRE DE SUBASTA", text) or not re.search(
        r"\bSUBASTA " + re.escape(auction_id) + r"\b", text
    ):
        raise ValueError("No se reconoce el certificado o su identificador")
    mode = re.search(r"Modalidad de subasta: (conjunta|separada por lotes)", text)
    if not mode:
        raise ValueError("Modalidad no reconocida")
    separate = mode[1] == "separada por lotes"
    results = []
    for match in RESULT.finditer(text):
        if re.search(r"\b(?:no|nunca|tampoco|si)\s+(?:\w+\s+){0,4}$", text[max(0, match.start() - 80):match.start()], re.I):
            raise ValueError("Resultado dentro de una negación o condición")
        if bool(match["lot"]) != separate and not match["cancel"]:
            raise ValueError("El ámbito del resultado no coincide con la modalidad")
        lot = None
        if match["lot"]:
            preceding = list(re.finditer(r"\bLote (\d+):", text[:match.start()]))
            if not preceding:
                raise ValueError("Resultado de lote sin número")
            lot = preceding[-1][1]
        amount = int(match["amount"].replace(".", "").replace(",", "")) if match["amount"] else None
        results.append({
            "lot": lot,
            "status": "Con pujas" if amount is not None else "Sin pujas" if match["no"] else "Cancelada",
            "highestBid": amount,
            "evidence": {
                "pages": list(range(bisect.bisect_right(starts, match.start()), bisect.bisect_right(starts, match.end() - 1) + 1)),
                "text": match[0],
            },
        })
    if not results:
        raise ValueError("No se reconoce una declaración explícita de resultado")
    if separate and not (len(results) == 1 and results[0]["status"] == "Cancelada"):
        expected = [m[1] for m in re.finditer(r"\bLote (\d+):", text)]
        found = [r["lot"] for r in results]
        if len(set(expected)) != len(expected) or found != expected:
            raise ValueError("Lotes ausentes, duplicados o resultados ambiguos")
        status, highest, lot_bids = "Por lotes", None, results
        counts = collections.Counter(r["status"] for r in results)
        summary = f"Cierre por lotes: {counts['Con pujas']} con pujas y {counts['Sin pujas']} sin pujas."
    else:
        if len(results) != 1:
            raise ValueError("Más de un resultado global")
        status, highest, lot_bids = results[0]["status"], results[0]["highestBid"], []
        if highest is not None:
            euros = f"{highest / 100:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
            summary = f"La puja más alta fue de {euros} €."
        else:
            summary = "Cerró sin recibir pujas." if status == "Sin pujas" else "La subasta fue cancelada."
    return {
        "status": status, "highestBid": highest, "lotBids": lot_bids,
        "mode": mode[1], "summary": summary,
        "adjudication": "No acreditada por este certificado; la puja máxima no es un precio de adjudicación confirmado.",
        "evidence": [r["evidence"] for r in results],
    }


def self_test():
    header = "CERTIFICACIÓN DE CIERRE DE SUBASTA SUBASTA SUB-TEST-2026-1 Modalidad de subasta: "
    def run(body, mode="conjunta"):
        return parse([{"text": header + mode + " " + body}], "SUB-TEST-2026-1")
    assert run("La subasta concluyó con pujas (puja máxima 184.000,00 euros).")['highestBid'] == 18400000
    assert run("La subasta concluyó sin pujas.")['highestBid'] is None
    assert run("La subasta ha sido cancelada.")['status'] == 'Cancelada'
    lots = run("Lote 1: piso La subasta del lote concluyó sin pujas. Lote 2: piso La subasta del lote concluyó con pujas (puja máxima 1,01 euros).", "separada por lotes")
    assert lots['highestBid'] is None and lots['lotBids'][1]['highestBid'] == 101
    for body in ["No consta que La subasta concluyó con pujas (puja máxima 100,00 euros).", "Puja mínima 100,00 euros. Valor de la subasta 400,00 euros.", "La subasta concluyó con pujas (puja máxima 1.23,00 euros)."]:
        try:
            run(body)
        except ValueError:
            pass
        else:
            raise AssertionError("Se aceptó un resultado no explícito o mal formado")
    try:
        run("Lote 1: piso Lote 2: piso La subasta del lote concluyó sin pujas.", "separada por lotes")
    except ValueError:
        pass
    else:
        raise AssertionError("Se omitió un lote sin resultado")
    actual = ROOT / "data/analysis/closures.json"
    if actual.exists():
        records = {r['id']: r for r in json.loads(actual.read_text(encoding='utf-8'))['records']}
        assert records['SUB-AT-2025-22R4686001005']['highestBid'] == 18400000
        assert records['SUB-AT-2026-25R4686001322']['status'] == 'Cancelada'
        multi = records['SUB-JA-2020-159627']
        assert len(multi['lotBids']) == 23
        assert multi['lotBids'][22]['highestBid'] == 12976600
        assert multi['lotBids'][22]['evidence']['pages'] == [9]
        # Real certificates whose narrow lot-label column wraps in Poppler extraction.
        for auction_id, expected in {
            'SUB-RC-2025-4690000146916': [('469161', 402130), ('469162', 369933)],
            'SUB-RC-2025-4690000146917': [('469171', 1677084), ('469172', None)],
            'SUB-RC-2026-4690000146930': [('469301', 833275), ('469302', 784429)],
            'SUB-RC-2026-4690000146932': [('469321', 434527), ('469322', 529222)],
        }.items():
            assert [(r['lot'], r['highestBid']) for r in records[auction_id]['lotBids']] == expected
    print("Self-check passed")


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--self-test", action="store_true")
    options = args.parse_args()
    if options.self_test:
        self_test()
        return
    manifest = json.loads((ROOT / "data/documents/valencia-pdf-manifest.json").read_text(encoding="utf-8"))
    files = [f for f in manifest["files"] if f["file"].endswith("certificado-cierre.pdf")]
    checked_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    records = []
    for source in files:
        record = {"id": source["id"], "source": source["url"], "file": source["file"], "sha256": source["sha256"], "checkedAt": checked_at}
        try:
            cache = ROOT / "data/document-text" / (source["sha256"] + ".json")
            if cache.exists():
                corpus = json.loads(cache.read_text(encoding="utf-8"))
                if corpus.get("sha256") != source["sha256"]:
                    raise ValueError("El SHA del corpus no coincide")
                # A recognized OCR amount is not sufficient evidence for a certified result.
                pages = [dict(p, text=p.get("nativeText", "") if p.get("method") == "windows-ocr" else p["text"])
                         for p in corpus["pages"]]
                record["extractionMethod"] = "shared-text-corpus"
            else:
                from pypdf import PdfReader
                pages = [{"page": n + 1, "text": p.extract_text() or ""} for n, p in enumerate(PdfReader(ROOT / source["file"]).pages)]
                record["extractionMethod"] = "pypdf"
            if len(pages) != source["pages"] or any(not p["text"].strip() for p in pages):
                raise ValueError("Faltan páginas o texto legible")
            try:
                outcome = parse(pages, source["id"])
            except ValueError as exc:
                if str(exc) != "Resultado de lote sin número" or record["extractionMethod"] != "shared-text-corpus":
                    raise
                # Poppler can interleave a wrapped lot label with the description column.
                # Re-read native PDF text; never repair identifiers or amounts using OCR.
                from pypdf import PdfReader
                pages = [{"page": n + 1, "text": p.extract_text() or ""} for n, p in enumerate(PdfReader(ROOT / source["file"]).pages)]
                if len(pages) != source["pages"] or any(not p["text"].strip() for p in pages):
                    raise ValueError("Faltan páginas o texto nativo legible")
                outcome = parse(pages, source["id"])
                record["extractionMethod"] = "pypdf-native-fallback"
            record.update(outcome)
            record["analysisStatus"] = "complete"
        except Exception as exc:
            record.update(analysisStatus="needs-review", status="No publicado", highestBid=None, lotBids=[], summary="El resultado del certificado necesita revisión.", error=str(exc))
        records.append(record)
    counts = collections.Counter(r["status"] for r in records)
    summary = {"certificates": len(records), "completed": sum(r["analysisStatus"] == "complete" for r in records), "needsReview": sum(r["analysisStatus"] != "complete" for r in records), "outcomes": dict(counts), "lotResults": sum(len(r["lotBids"]) for r in records)}
    output = ROOT / "data/analysis/closures.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"schemaVersion": 1, "checkedAt": checked_at, "method": "Extracción de declaraciones explícitas del certificado de cierre; importes en céntimos, sin inferir adjudicación.", "summary": summary, "records": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=True))
    print(json.dumps([(r['id'], r['error']) for r in records if r['analysisStatus'] != 'complete'], ensure_ascii=True))


if __name__ == "__main__":
    main()
