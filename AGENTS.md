# AGENTS.md — Reglas de Diseño: CivicFlow / In óolal Yucatan

## Paleta de Colores OBLIGATORIA

Este proyecto usa **exclusivamente** la paleta oficial del Gobierno del Estado de Yucatán.
**NUNCA usar azul (`blue-*`) en ningún elemento visible de la UI.**

### Colores definidos en `global.css`

| Token Tailwind         | Valor HEX | Uso                                      |
|------------------------|-----------|------------------------------------------|
| `yuc-green-dark`       | `#00382b` | Fondos de navbar, headers principales    |
| `yuc-green`            | `#005c42` | Botones primarios, acentos, íconos       |
| `yuc-green-light`      | `#008260` | Hover de botones verdes                  |
| `yuc-gold`             | `#c29b38` | Acentos dorados, borders activos, badges |
| `yuc-gold-light`       | `#e5c158` | Hover de elementos dorados               |
| `yuc-gold-dark`        | `#8e6d23` | Variante oscura del dorado               |

### Reglas de uso

**Fondos:**
- Fondo de pantalla principal: `bg-yuc-green-dark` (oscuro) o dark slate neutro
- Navbar del gestor: `bg-yuc-green-dark` + `border-yuc-gold/30`
- Cards blancas (contenido): `bg-white` con borde `border-slate-200`
- Cards oscuras (modales admin): `bg-slate-900` con borde `border-yuc-gold/20`

**Botones:**
- Primario: `bg-yuc-green hover:bg-yuc-green-light text-white`
- Secundario/Acción especial: `bg-yuc-gold hover:bg-yuc-gold-dark text-white`
- Destructivo: `bg-red-600 hover:bg-red-700 text-white` ✅ (rojo está permitido para alertas)
- Neutro: `bg-slate-800 hover:bg-slate-700 text-white`

**Badges de estado:**
| Estado               | Clases CORRECTAS                                              |
|----------------------|---------------------------------------------------------------|
| Recibido             | `bg-yuc-green/10 text-yuc-green border border-yuc-green/20`  |
| En revisión          | `bg-amber-500/10 text-amber-500 border border-amber-500/20`  |
| Doc. incompleta      | `bg-orange-500/10 text-orange-500 border border-orange-500/20`|
| Aprobado             | `bg-emerald-500/10 text-emerald-500 border border-emerald-500/20`|
| Rechazado/Declinado  | `bg-red-500/10 text-red-500 border border-red-500/20`        |

**Prohibido usar:**
- `text-blue-*`, `bg-blue-*`, `border-blue-*`, `ring-blue-*`
- `text-indigo-*`, `bg-indigo-*`
- Cualquier tono azul en elementos visibles

**Focus rings permitidos:**
- `focus:ring-yuc-gold` o `focus:ring-yuc-green` — NUNCA `focus:ring-blue-*`

**Texto de info/notificaciones:**
- Info: usar `text-yuc-gold` con ícono SVG dorado (no azul)
- En toasts de tipo `info`: usar ícono con color `text-yuc-gold` (en Layout.astro)

---

## Tipografía

- Fuente display (títulos): `font-display` → Montserrat
- Fuente body: `font-sans` → Plus Jakarta Sans
- Ambas se importan de Google Fonts en `Layout.astro`

---

## Estructura del Proyecto

```
frontend/src/
├── layouts/Layout.astro       # Layout global con nav, footer, toast
├── styles/global.css          # Tokens de color (@theme) y utilidades
├── pages/
│   ├── index.astro            # Landing page principal
│   ├── gestor/                # Módulo interno para funcionarios
│   │   ├── index.astro        # Login del gestor (verde oscuro)
│   │   ├── dashboard.astro    # Mesa de trabajo
│   │   ├── audit.astro        # Logs de auditoría
│   │   ├── cola.astro         # Bandeja de solicitudes
│   │   ├── vencidas.astro     # Solicitudes vencidas
│   │   └── solicitud.astro    # Vista detalle de expediente
│   └── ciudadano/             # Portal ciudadano
│       ├── index.astro        # Dashboard ciudadano
│       ├── login.astro        # Login ciudadano
│       ├── registro.astro     # Registro ciudadano
│       ├── tramite.astro      # Selección de trámite
│       ├── subida.astro       # Subida de documentos
│       ├── tracker.astro      # Rastreo de folio
│       └── exito.astro        # Pantalla de éxito
```

---

## Navbar del Gestor (patrón estándar)

Todas las páginas del gestor deben incluir:
- `bg-yuc-green-dark` en el header
- `border-yuc-gold/30` como separador
- Submenu con `border-yuc-gold/20`
- Tab "Administrar Cuentas" oculto por defecto, visible solo si `gestor_role === 'aprobador'`
- Info del funcionario y botón "Cerrar Sesión" en la barra

---

## Backend

- Node.js + Express en `backend/`
- Supabase para auth y base de datos
- Para operaciones administrativas (crear buckets, etc.) usar `supabaseAdmin` (service_role key)
- La `SUPABASE_SERVICE_KEY` debe estar en `backend/.env`