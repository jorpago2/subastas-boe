# Subastas BOE · Inmuebles en Valencia

Buscador con React y Carbon de IBM, limitado a inmuebles de toda la provincia de Valencia. Incluye viviendas, locales, garajes, trasteros, terrenos y otros inmuebles. El objetivo temporal se mantiene desde 2016.

## Cobertura actual

Consultadas el 6 de septiembre de 2026 todas las subastas que el BOE devolvió con los filtros «Inmuebles» y «Valencia/València»: **24 activas y 10 próximas**. También se han recuperado todos los resultados por fecha de inicio de 2025 (984 fichas) y de 2026 hasta el 6 de septiembre (598 fichas, incluidas las 24 activas ya guardadas). El catálogo contiene **1.590 subastas sin duplicados**: 1.459 pasadas, 94 canceladas, 3 suspendidas, 24 activas y 10 próximas. Se excluyen SUB-JV-2026-264894 y SUB-JV-2026-265556: sus edictos acreditan que los únicos bienes son vehículos, aunque el BOE los devolvió como inmuebles. Sus documentos y análisis se conservan. La selección se hace por provincia del bien, no por sede de la autoridad gestora. Cada consulta conserva el total del BOE, el número importado y si se completó.

Falta el histórico de Valencia de 2016 a 2024. La descarga de los PDF disponibles del catálogo está completada. El análisis documental distingue resultados certificados, resúmenes revisados individualmente y extracciones automáticas pendientes de revisión. De las subastas pasadas se han recuperado los resultados publicados en el HTML y los enlaces de documentación. No hay actualización periódica configurada; los estados reflejan la última consulta. Una subasta con varios lotes puede incluir otros bienes: deben revisarse las condiciones de cada lote en el BOE.

En 97 fichas canceladas o suspendidas el BOE permite encontrarlas por periodo, pero no publica la fecha de inicio en el detalle. Se conserva como desconocida: esas fichas no aparecen al filtrar por año, aunque sí en el catálogo y en el filtro de estado.

Los filtros de la web permiten buscar por texto, año, estado, municipio, rangos de superficie, precio tasado y €/m², además de vivienda habitual, ocupación y cargas documentales. Estos tres últimos campos y los importes documentales solo se rellenan cuando el anexo contiene una afirmación explícita; «No consta» se mantiene como un estado independiente.

## Desarrollo y publicación

Requiere Node.js 24 o posterior.

```sh
npm ci
npm run dev
npm test
npm run build
```

La compilación genera `docs/`, incluidos datos y fuentes IBM Plex. GitHub Pages publica esa carpeta desde `main` cuando se suben los cambios. Web: https://jorpago2.github.io/subastas-boe/.

## Base de datos e importación

`data/subastas.sqlite` es el archivo maestro local, excluido de Git. Guarda las tablas `auctions` y `scans`. `public/data/catalog.json` contiene únicamente el ámbito actual y permite reconstruirlo al clonar el proyecto. Los registros de la muestra anterior permanecen en SQLite, junto con sus análisis, pero quedan fuera de la exportación y de la web.

Todos los modos de importación están restringidos a inmuebles de Valencia:

```sh
# Activas y próximas; comprueba los totales de cada consulta
npm run import -- --current --limit 1000
# Un periodo del histórico; límite por consulta
npm run import -- --from 2016-01-01 --to 2016-01-31 --limit 50
# Muestra de enero de 2016, activas y próximas, hasta cuatro por consulta
npm run import -- --sample
# Actualizar resultados o enlaces de documentos de fichas del ámbito actual
npm run import -- --results-only
npm run import -- --documents-only
# Exportar sin consultar el BOE
npm run import -- --export-only
npm run build
```

En la importación por fechas, `--state` acepta EJ, PU, PC, FS, CA y SU. El importador usa el HTML público, no una API. Las fichas se procesan de una en una, con hasta tres lecturas simultáneas por ficha, pausa de 650 ms y tiempo límite de 30 s por petición; los errores detienen la importación conservando el progreso. El límite puede dejar una consulta incompleta: `scans` refleja esa situación.

Importes en céntimos; `null` significa dato no recuperado, no cero. Fechas ISO con zona horaria. El año del identificador puede diferir del de inicio.

## Documentos y resultados

Se conservan los enlaces oficiales y se indica si los documentos requieren sesión o ya no son accesibles. `documentAnalysis` guarda resúmenes, estado de revisión, fuentes, páginas y huellas SHA-256. La importación no descarga ni analiza automáticamente los PDF nuevos.

Los 75 PDF y los análisis de las 33 fichas anteriores siguen conservados localmente en `data/documents/` y SQLite, fuera de la selección de Valencia. Los originales no se publican en Git. No se guardan credenciales ni cookies en el catálogo o la base de datos.

Los resultados certificados (`certifiedOutcome`) tienen prioridad sobre los consultados con sesión y los del HTML público. La puja máxima no se presenta como precio de adjudicación definitiva. La exportación pública usa títulos genéricos de inmueble y anonimiza nombres de particulares; conserva una consulta de dirección separada para centrar el mapa de Google Maps. La vista general muestra los resultados filtrados agrupados por municipio con coordenadas del Nomenclátor Geográfico del IGN/CNIG y teselas de OpenStreetMap; no pretende señalar la parcela exacta. La descripción registral completa se conserva solo localmente. Las importaciones conservan los análisis y resultados contrastados existentes.

## Limitaciones

El histórico anterior a 2025 está pendiente y no se importan todos los datos individuales de cada lote. Cambios en el HTML del BOE pueden exigir ajustes. El robots.txt del portal indica `Disallow: /`; antes de una descarga masiva o periódica, resolver el acceso automatizado con el BOE o una fuente autorizada.

Fuentes: https://subastas.boe.es/ y documentación oficial de Carbon consultada mediante Carbon MCP. Proyecto independiente, sin afiliación con el BOE ni IBM.

## Descarga local de PDF

La descarga iniciada el 6 de septiembre de 2026 se completó el día 7: **4.118 archivos PDF verificados**, correspondientes a 2.563 anexos y 1.555 certificados de cierre, con 38.400 páginas y 10,25 GB. Los archivos se comprobaron con SHA-256, tamaño y lectura de su estructura PDF. Se guardan en `data/documents/<id>/`, fuera de Git. El recuento es de archivos: algunas copias públicas y autenticadas descargadas inicialmente tienen el mismo contenido; en el tramo final se reutilizan las copias públicas verificadas.

La descarga pública está completada para las 1.592 fichas. También se completó la revisión con sesión de las 783 fichas cuyos anexos siguen disponibles, incluidos sus enlaces de bienes y lotes. No quedan fichas pendientes de esta descarga. En las otras 809 fichas el BOE indica que los anexos están retirados; esto no impide conservar sus certificados de cierre cuando están disponibles.

El manifiesto `data/documents/valencia-pdf-manifest.json` contiene los archivos verificados, sus fuentes y huellas. `data/documents/valencia-download-status.json` registra el estado de cada subasta y lo pendiente. Son inventarios locales; no contienen credenciales ni cookies.

Los documentos se conservan dentro del directorio de trabajo, en `data/documents/`. Se retiraron de Descargas 812 copias cuya igualdad con los originales del proyecto se comprobó mediante SHA-256. El registro local es `data/documents/downloads-relocation.json`. La rutina del navegador retira cada archivo temporal de Descargas después de guardar y verificar su copia en el proyecto.

```sh
# Descargar o reanudar los PDF públicos del catálogo actual
node scripts/download-pdfs.mjs
```

Este script recorre también los enlaces públicos de bienes y lotes, conserva los originales y no guarda respuestas HTML como PDF. Los anexos restringidos requieren la sesión del navegador; el script público no completa esa parte. La descarga no genera resúmenes ni publica los PDF en GitHub Pages.

## Análisis documental local

Los 4.118 archivos representan **3.492 PDF distintos por SHA-256**, con 28.406 páginas sin contar copias idénticas. El texto se extrae una sola vez por huella y se conserva por página en `data/document-text/`. Los escaneos se procesan con OCR de Windows en el equipo local. Tanto el texto original como el reconocido y sus limitaciones permanecen fuera de Git.

Se han analizado los **1.555 certificados de cierre**: 984 resultados con pujas, 275 sin pujas, 94 cancelaciones y 202 resultados por lotes, que contienen 1.878 resultados individuales. En las 1.461 fichas pasadas, el estado y la puja máxima coinciden con los datos HTML recuperados. La puja máxima no se convierte en precio de adjudicación.

Los anexos tienen dos niveles de análisis: extracción automática conservadora y revisión individual por agentes de las 34 fichas activas/próximas y 746 históricas. Los resúmenes conservan fuente, SHA y páginas; las fuentes o páginas sin revisar quedan identificadas. No debe confundirse un resumen parcial, ni haber ejecutado OCR, con una revisión integral del expediente. Las contradicciones entre documentos se conservan y las diferencias entre lotes se distinguen cuando se han podido comprobar.

El procesamiento terminó sin errores técnicos ni intentos pendientes: 11.308 páginas conservan texto nativo y 17.098 pasaron por OCR. De estas, 16.030 tienen texto reconocido (1.023 con calidad baja) y 1.068 siguen sin texto reconocible. Estas últimas pueden ser páginas en blanco, imágenes o escaneos ilegibles; no se clasifican automáticamente. La revisión individual registra 26390 páginas consultadas entre ambos grupos (los PDF compartidos se cuentan una vez dentro de cada grupo): 400 fichas tienen revisión completa de sus anexos disponibles y 378 conservan limitaciones de revisión. Las 34 actuales/próximas tienen sus 986 páginas físicas consultadas; Senyera conserva una certificación incompleta de origen. Otras 0 fichas con anexos siguen con extracción automática pendiente de revisión individual. El procesamiento técnico de OCR no equivale a terminar el análisis documental. `data/analysis/summary.json` recoge los recuentos actuales.

Los informes locales están en `data/analysis/`: `closures.json`, `annexes.json`, `active-annexes.json` e `historical-reviews.json`. `apply-document-analysis.mjs` valida las referencias, hace una copia previa de SQLite y combina los resultados sin sustituir revisiones individuales por extracciones automáticas. La web muestra los resúmenes desde el catálogo exportado; los originales, el corpus y la copia de seguridad no se publican.

Con Python, Poppler y los PDF locales disponibles, el proceso se puede reanudar:

```sh
python scripts/extract-document-text.py --workers 6
python scripts/ocr-document-text.py --workers 8
python scripts/analyze-closure-certificates.py
python scripts/analyze-annexes.py
node scripts/apply-document-analysis.mjs
node scripts/import.mjs --export-only
npm run build
```

El paso OCR requiere Windows y su reconocedor de español. Las revisiones individuales son artefactos locales de los agentes; los scripts de extracción no las recrean ni las marcan como completas automáticamente. Las autopruebas se ejecutan con `--self-test` en los dos scripts de análisis.

## Referencias de mercado: Idealista

Las fichas incluyen barrio y distrito cuando hay coincidencia única de calle y número con los portales oficiales de Valencia y su intersección con los límites municipales actuales. `node scripts/assign-neighborhoods.mjs` regenera `public/data/property-neighborhoods.json` desde el catálogo público y el Geoportal municipal (capas 217, 223, 224 y 225). No traduce nombres de calles ni fuerza coincidencias aproximadas. Cobertura inicial: 24 fichas verificadas; 94 direcciones de Valencia sin coincidencia inequívoca. La asignación se descarta si cambia la dirección de la ficha.

Los precios eligen el ámbito más concreto con valor del mismo mes, por separado para venta y alquiler. Se han recuperado 14 históricos de distrito; no históricos propios de barrio. Si falta el distrito se utiliza el municipio y se indica junto a la cifra. Para importar distritos, las fuentes añaden `level: "district"` y `municipality: "València"`. La importación reemplaza el conjunto completo: incluir también las fuentes municipales que se quieran conservar.

El dashboard consulta `public/data/idealista-history.json`: series mensuales desde 2016 de los informes públicos de precios de vivienda de Idealista para localidades de la provincia de Valencia. La cobertura es parcial y venta y alquiler pueden tener meses o localidades distintos. Cada serie conserva el enlace al histórico y la fecha de consulta. Los valores están en euros por m² (venta) y euros por m² y mes (alquiler), no en céntimos.

La referencia se selecciona por localidad exacta, con equivalencias explícitas de algunos nombres, y mes de inicio de la subasta. No disponemos de la fecha del anuncio; el año del identificador BOE no se usa como sustituto. No se extrapolan meses, no se asignan barrios sin ubicación verificada y no se rellena con medias provinciales. Se muestra contexto del mercado residencial, no una valoración del bien ni una referencia aplicable a locales, terrenos o garajes.

La descarga HTTP directa respondió 403; las tablas se recuperaron mediante consulta web. Para importar nuevas consultas, `node scripts/idealista.mjs ruta/fuentes.json` acepta una lista de objetos `{name, url, operation, retrievedAt, text}` con las tablas de los históricos. El texto puede llevar prefijos de línea `L123:`. El importador excluye `n.d.` y periodos anteriores a 2016, registra tablas no recuperables y no reemplaza el archivo si todas fallan. Después se ejecuta `npm run build`. No hay actualización automática ni credenciales de Idealista en la web.

El dashboard calcula el valor de subasta por m² con el importe del BOE y la superficie publicada. Aplica los umbrales del artículo 670 vigente: 70 % para la aprobación directa al mejor postor; si la postura queda por debajo, 60 % para la mejora de tercero; sin mejora, 50 % para la regla general o 40 % cuando la postura satisface íntegramente el derecho del ejecutante. En vivienda habitual se muestra la regla especial del 70 %, con suelo del 60 % en la excepción por deuda. Son referencias informativas y no sustituyen el decreto de aprobación del remate ([artículo 670 en el BOE](https://boe.es/buscar/act.php?id=BOE-A-2025-76)).
