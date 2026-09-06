# Subastas BOE

Buscador con React y Carbon de IBM para todos los bienes, con objetivo de histórico desde 2016.

## Estado local

Primera versión con 33 subastas reales: 12 antiguas de enero de 2016, 12 activas y 9 próximas al comprobarlas. El histórico está incompleto. Hay búsqueda sin tildes, filtros por tipo de bien, año de inicio, provincia y estado, ordenación y fichas con enlaces oficiales.

La revisión visual e interactiva está pendiente porque el navegador interno no aparece conectado. Web pública: https://jorpago2.github.io/subastas-boe/.

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

- Validar visualmente y probar la interacción antes de publicar.
- Recuperar el histórico completo por periodos y dividir las exportaciones por año antes de ampliar el volumen. Por ahora se usa un único archivo para la muestra.
- El importador usa el HTML público, no una API de subastas. Cambios en el portal pueden exigir ajustes. El robots.txt del portal indica Disallow: /; antes de una descarga masiva o periódica, resolver el acceso automatizado con el BOE o una fuente autorizada.
- La muestra no es aleatoria ni representativa del mercado. Los estados son los de la última consulta, no datos en directo.
- Los lotes individuales no se han importado; se enlazan al BOE. Las ubicaciones e importes no recuperados se indican como tales.
- Algunos documentos antiguos ya no son accesibles.

Fuentes: https://subastas.boe.es/ y documentación y ejemplos oficiales de Carbon consultados mediante Carbon MCP. Proyecto independiente, sin afiliación con el BOE ni IBM. Las credenciales de Carbon permanecen fuera del repositorio.
