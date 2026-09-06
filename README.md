# Subastas BOE

Web app en preparación para consultar subastas de todos los tipos de bienes: pasadas desde 2016, activas y anunciadas pendientes de apertura.

- Web: https://jorpago2.github.io/subastas-boe/
- Interfaz prevista: Carbon Design System de IBM.
- Datos: SQLite como archivo maestro y archivos de consulta estáticos para el navegador.
- Fuente: BOE y Portal de Subastas. La cobertura histórica y la recuperación de estados todavía están pendientes de validar.

## Estado actual

Solo está publicada una portada provisional. El buscador, la base de datos y su actualización aún no están implementados. No se presenta ningún registro de ejemplo como dato real.

## Publicación

GitHub Pages publica la carpeta `docs` de la rama `main`. Los cambios que se suban a esa carpeta se publican automáticamente. No se necesitan secretos ni un servidor para esta portada.

## Siguiente paso

Validar una muestra real de 2016 y otra actual, con distintos tipos de bienes y estados, antes de definir la importación completa y construir el buscador con Carbon.

Proyecto independiente, sin afiliación con el BOE ni con IBM.
