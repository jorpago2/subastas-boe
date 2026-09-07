const numberPattern = '(\\d{1,3}(?:[.\\s]\\d{3})*(?:,\\d+)?|\\d+(?:,\\d+)?)';

const asNumber = value => Number(String(value).replace(/[.\\s]/g, '').replace(',', '.'));
const textOf = record => [record.description, ...(record.documentAnalysis?.points || []).flatMap(point => [point.title, point.text]), ...(record.documentAnalysis?.findings || []).map(finding => finding.text)].filter(Boolean).join(' ');
const firstMatch = (text, expressions) => {
  for (const [expression, kind] of expressions) {
    const match = text.match(expression);
    if (match) return { value: asNumber(match[1]), kind };
  }
  return null;
};

const surface = text => firstMatch(text, [
  [new RegExp('(' + numberPattern + ')\\s*m(?:²|2)\\s*(?:construid[oa]s?|de construcci[oó]n)', 'iu'), 'construida'],
  [new RegExp('(' + numberPattern + ')\\s*m(?:²|2)\\s*útiles?', 'iu'), 'útil'],
  [new RegExp('(' + numberPattern + ')\\s*m(?:²|2)\\s*(?:de\\s+)?(?:suelo|terreno|parcela|solar)', 'iu'), 'parcela'],
  [new RegExp('(' + numberPattern + ')\\s*m(?:²|2)', 'iu'), 'publicada'],
]);

const money = text => {
  const match = text.match(new RegExp('(?:valor de )?tasaci[oó]n|tasad[oa][^€]{0,120}?(' + numberPattern + ')\\s*€', 'iu'));
  if (!match) return null;
  const amount = match[1] || text.slice(match.index).match(new RegExp('(' + numberPattern + ')\\s*€', 'iu'))?.[1];
  return amount ? Math.round(asNumber(amount) * 100) : null;
};

const habitual = text => {
  const no = /(?:vivienda habitual\s*[:.-]?\s*no\b|no (?:es|constituye|tiene (?:el )?car[aá]cter de) (?:la )?vivienda habitual)/iu.test(text);
  const yes = /(?:vivienda habitual\s*[:.-]?\s*s[ií]\b|(?<!\bno )(?:es|constituye|tiene (?:el )?car[aá]cter de) (?:la )?vivienda habitual)/iu.test(text);
  return no === yes ? 'unknown' : no ? 'no' : 'yes';
};

const occupancy = text => {
  const unknown = /(?:no consta|se desconoce|desconoce|no se sabe|sin aclarar|no ha podido comprobarse?|no pudo comprobar|no puede comprobar|no fue posible|no confirma|no acredita)[^.]{0,120}(?:ocupad|ocupantes|ocupaci[oó]n|situaci[oó]n posesoria)|(?:ocupaci[oó]n|situaci[oó]n posesoria)[^.]{0,80}(?:desconocida|no consta|sin aclarar)/iu.test(text);
  if (unknown) return 'unknown';
  if (/\b(?:no|sin|ni)\s+(?:est[aá]\s+)?(?:estar\s+)?(?:arrendad[oa]|ocupad[oa])\b/iu.test(text) && !/\b(?:desocupad[oa]|libre de ocupantes)\b/iu.test(text)) return 'unknown';
  const empty = /(?:desocupad[oa]|libre de ocupantes|(?:no|sin) (?:est[aá] )?(?:estar )?ocupad[oa]|vac[ií]o[sa]?)/iu.test(text);
  const occupied = /(?<!des)ocupad[oa](?:\s+por|\b)|arrendad[oa]|ocupantes?\s+(?:con|distint|arrendat|persona)/iu.test(text);
  return empty === occupied ? 'unknown' : empty ? 'empty' : 'occupied';
};

const charges = text => {
  const none = /(?:sin|no constan?|no hay)[^.]{0,45}(?:cargas?|hipotecas?|embargos?)/iu.test(text);
  const present = /(?:cargas?|hipotec\w*|embarg\w*|usufruct\w*|arrendamient\w*|servidumbre|sustituci[oó]n fideicomisaria)/iu.test(text);
  return present && !none ? 'present' : none ? 'none' : 'unknown';
};

export function deriveFacts(record) {
  const text = textOf(record);
  const built = surface(text);
  const usefulMatch = text.match(new RegExp('(' + numberPattern + ')\\s*m(?:²|2)\\s*útiles?', 'iu'));
  const appraisalValue = money(text);
  const surfaceM2 = built?.value || null;
  return {
    surfaceM2: Number.isFinite(surfaceM2) ? surfaceM2 : null,
    surfaceKind: built?.kind || null,
    usefulSurfaceM2: usefulMatch ? asNumber(usefulMatch[1]) : null,
    appraisalValue,
    appraisalPricePerM2: appraisalValue != null && surfaceM2 ? appraisalValue / 100 / surfaceM2 : null,
    habitual: habitual(text),
    occupancy: occupancy(text),
    charges: charges(text),
  };
}
