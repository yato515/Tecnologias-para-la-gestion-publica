# Plan: Actualización de Logo para Producción

## Fase 1 — Preparar el recurso de imagen (manual, fuera del proyecto)

El archivo `src/components/img/logo-estado-yucatan.webp` tiene fondo blanco opaco. Antes de aplicar cualquier cambio en el código, hay que convertirlo a un WebP con canal alfa (transparencia).

**Pasos:**

1. Abrir el archivo en una herramienta externa que soporte remoción de fondo:
   - Online: [remove.bg](https://www.remove.bg) o [squoosh.app](https://squoosh.app)
   - Local: Photoshop, GIMP, o Figma
2. Eliminar el fondo blanco y exportar con transparencia.
3. Guardar el resultado como `logo-estado-yucatan.webp` (el formato WebP sí soporta transparencia).
4. Reemplazar el archivo existente en la ruta: `src/components/img/logo-estado-yucatan.webp`

> ⚠️ No continuar con las fases 2 y 3 hasta tener este archivo listo. Sin transparencia, el logo mostrará un cuadro blanco sobre los fondos de color.

---

## Fase 2 — Logo del Header (ya preparado en código)

El header en `src/layouts/Layout.astro` ya fue actualizado: el SVG escudo fue reemplazado por el componente `<Image>` de Astro apuntando al archivo del logo.

**Verificar después de reemplazar el WebP:**

1. Levantar el proyecto con `npm run dev`.
2. Confirmar que el logo se ve limpio sobre el fondo blanco (modo claro) y oscuro (modo oscuro) del header.
3. Si el tamaño no se ve bien, ajustar la clase `h-12` en el `<Image>` dentro de `Layout.astro` (línea del bloque `<div class="h-12 flex items-center…">`).

---

## Fase 3 — Logo grande del Hero (pendiente de codificar)

En `src/pages/index.astro`, línea 18, hay un bloque con el SVG escudo animado grande que aparece centrado en la sección principal (Hero). Hay que reemplazarlo con el logo oficial.

**Qué se debe cambiar:**

1. Agregar el import del logo en el frontmatter de `index.astro`:
   ```
   import { Image } from 'astro:assets';
   import logoYucatan from '../components/img/logo-estado-yucatan.webp';
   ```
2. Reemplazar el bloque `<div class="w-24 h-28 … bg-yuc-green border-2 border-yuc-gold …"><svg…></div>` por un `<Image>` con tamaño generoso (sugerido: `h-28 w-auto`) y sin el contenedor verde ni el borde dorado, ya que el logo oficial ya tiene sus propios colores.
3. Decidir si se mantiene la clase `animate-pulse-soft` (efecto de pulso suave) o se elimina para un look más institucional.

---

## Orden de ejecución

1. Fase 1 → procesar el WebP con transparencia (manual)
2. Fase 2 → verificar header con el nuevo archivo
3. Fase 3 → aplicar cambio en el Hero (se codifica después de tener el WebP listo)
