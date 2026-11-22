# Reordenación de paneles por arrastre

Implementación nativa (HTML/CSS/JS, sin librerías) en `index.html`.

## Decisiones tomadas sobre las preguntas abiertas

| Pregunta | Decisión aplicada |
|---|---|
| P1 Unidad | Un panel = un widget (línea + parada). |
| P2 Fijación | Opción a): los fijados siguen siempre arriba. El arrastre (y el teclado) reordena **dentro del grupo** del panel (fijados / no fijados) y nunca cambia su estado de fijación. Al fijar un panel pasa al final de los fijados, igual que antes. |
| P3 Nuevos widgets | Al final de su grupo. Como "Añadir" fija el widget (comportamiento previo), aparece al final de los fijados. |
| P4 Gesto | Ratón: mover > 5 px. Táctil/lápiz: mantener 250 ms o mover > 8 px desde el asa. Vibración de 10 ms si el navegador la admite (no en iOS). |
| P5 Ids / esquema | Los widgets conservan ahora su `id` entre recargas (antes se regeneraba). Se valida con `^[A-Za-z0-9_-]{1,64}$`; si no es válido o está duplicado se genera uno nuevo. |
| P6 Accesibilidad | Incluida: asa enfocable con nombre accesible "Mover panel Línea X – Parada Y"; las flechas ↑/↓ sobre el asa mueven una posición y se anuncia "Panel movido a la posición N de M" en `#reorderAnnouncer` (`aria-live`). No hay un "modo mover" separado: cada pulsación ya mueve el panel y lo guarda. |
| P8 Diseño | El dashboard es de una columna (`.grid`): el arrastre es solo vertical. |
| P9 Un solo panel | El asa se oculta (`.grid.single-panel`). |
| P10 Librerías | Ninguna. |
| P12 Modo edición | Las asas siempre son visibles. |
| RF12 Refresco | Se **aplaza**: si salta el auto-refresco o se pulsa Actualizar durante un arrastre, el refresco se lanza al soltar o cancelar. Las cuentas atrás en segundos siguen funcionando. |

## Formato en `localStorage`

- `panel_order`: `{ "v": 1, "ids": ["<instanceId>", ...] }`. Orden explícito y fuente de verdad (ya agrupado: fijados primero).
- `panel_instances`: `[{ id, lineCode, pinned, stop, favorite }, ...]`, igual que antes pero guardado en orden de visualización.
- `pinned_instances`: igual que antes (solo indica qué paneles están fijados). Al cargar se eliminan los ids obsoletos.

Migración: si no existe `panel_order`, se usa el orden que mostraba la versión anterior (fijados en el orden de `pinned_instances` y después el resto por código de línea), para que nada cambie de sitio al actualizar.

Recuperación: los ids de `panel_order` que no existen o están repetidos se descartan, y los widgets que falten se añaden al final. Ningún widget válido se pierde.

Restauración al cargar: mientras se recrean los paneles guardados (`restoringPanels`) no se escribe en `localStorage`, para no guardar listas a medias. Si un widget falla al restaurarse, se registra en consola y se sigue con los demás. Al terminar se guarda una sola vez.

## Cancelación

Escape, `pointercancel`, pérdida de captura del puntero, pérdida de foco de la ventana y pestaña oculta. El panel vuelve a su sitio y no se guarda nada. Si se suelta en la posición original tampoco se escribe en `localStorage`.

## Pruebas

`npm run factory:test` (equivale a `node --test tests/panel-order.test.js`, sin dependencias). Prueba la lógica pura del bloque `PANEL_ORDER_LOGIC` y hace comprobaciones estáticas del marcado y el CSS. La interacción real (gestos, animaciones, auto-scroll) hay que validarla a mano en los navegadores de referencia.
