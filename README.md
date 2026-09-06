# Subastas BOE

Buscador con React y Carbon de IBM para todos los bienes, con objetivo de histórico desde 2016.

## Estado local

Primera versión con 33 subastas reales: 12 antiguas de enero de 2016, 12 activas y 9 próximas al comprobarlas. El histórico está incompleto. Hay búsqueda sin tildes, filtros por tipo de bien, año de inicio, provincia y estado, ordenación y fichas con enlaces oficiales.

La ficha de resultados por lotes se ha comprobado en el navegador interno en escritorio. Web pública: https://jorpago2.github.io/subastas-boe/.

## Desarrollo

Requiere Node.js 24 o posterior.

```sh
npm ci
npm run dev
npm test
npm run build
```

La compilación genera `docs/`, incluidos datos y fuentes IBM Plex. GitHub Pages publica esa carpeta desde `main` cuando se suben los cambios.

## Base de datos e importación

`data/subastas.sqlite` es el archivo maestro local, excluido de Git. Guarda las tablas `auctions` y `scans`. La copia `public/data/catalog.json` alimenta el navegador y permite reconstruir SQLite al clonar el proyecto. La importación actualiza por identificador y conserva el historial de consultas.

```sh
npm run import -- --sample
npm run import -- --from 2016-01-01 --to 2016-01-31 --limit 50
```

La muestra consulta hasta cuatro fichas por tipo de bien para enero de 2016 y los estados activa y próxima. El límite de la importación por fechas se aplica a cada categoría. Opcionalmente `--state EJ` filtra un estado BOE; también acepta PU, PC, FS, CA y SU.

Las peticiones son secuenciales, con pausa de 650 ms y tiempo límite de 30 s. Ante un error se detiene la importación y se conserva el progreso. No hay actualización periódica configurada.

Importes en céntimos; null significa dato no recuperado, no cero. Fechas ISO con zona horaria; se conserva el texto original del estado. El año del identificador puede diferir del año de inicio.

## Cobertura y pendientes

- Completar la revisión visual e interactiva del resto de flujos y en móvil.
- Recuperar el histórico completo por periodos y dividir las exportaciones por año antes de ampliar el volumen. Por ahora se usa un único archivo para la muestra.
- El importador usa el HTML público, no una API de subastas. Cambios en el portal pueden exigir ajustes. El robots.txt del portal indica Disallow: /; antes de una descarga masiva o periódica, resolver el acceso automatizado con el BOE o una fuente autorizada.
- La muestra no es aleatoria ni representativa del mercado. Los estados son los de la última consulta, no datos en directo.
- Los lotes individuales no se han importado; se enlazan al BOE. Las ubicaciones e importes no recuperados se indican como tales.
- Algunos documentos antiguos ya no son accesibles.

Fuentes: https://subastas.boe.es/ y documentación y ejemplos oficiales de Carbon consultados mediante Carbon MCP. Proyecto independiente, sin afiliación con el BOE ni IBM. Las credenciales de Carbon permanecen fuera del repositorio.

## Resultados de subastas finalizadas

Las fichas y tarjetas muestran «Sin pujas», la puja máxima publicada o el resultado por lotes. Los importes vacíos se conservan como «No publicado». Ninguna puja se presenta como adjudicación definitiva.

Para recuperar solo los resultados de las subastas pasadas ya guardadas:

```sh
npm run import -- --results-only
```

Se conserva la URL de origen y una fecha de comprobación independiente. La importación normal también consulta los resultados de las subastas pasadas.

La subasta `SUB-JV-2015-1849` incluye los resultados de sus cuatro lotes comprobados el 6 de septiembre de 2026 con sesión del BOE: 51.000,00 €, 127.708,95 €, 141.151,99 € y sin pujas. Se guardan en `authenticatedOutcome`, con procedencia y fecha, y se muestran con esa indicación en la web. La importación pública conserva estos datos. No se guardan credenciales ni cookies en la base de datos o el catálogo.

Para exportar la base de datos local sin consultar el BOE y reconstruir la web:

```sh
npm run import -- --export-only
npm run build
```

## Documentación y anexos

Las fichas enlazan a la documentación del BOE e indican si los anexos ya no son accesibles o requieren sesión. Se ha consultado la información general de las 33 subastas de la muestra. El certificado de cierre se enlaza cuando aparece; no se presupone que pueda descargarse.

Se han identificado con sesión tres documentos de `SUB-AT-2026-25R2986001105`: condiciones generales, certificado de dominio y cargas y catastro. Sus enlaces se conservan en `authenticatedDocuments`; el inventario de anexos de bienes y lotes sigue siendo parcial. Los archivos permanecen alojados en el BOE y no se han copiado al repositorio.

```sh
npm run import -- --documents-only
npm run build
```
