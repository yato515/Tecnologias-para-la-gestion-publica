# FIXES — In óolal Yucatan

> Aplica estos cambios en orden. Reinicia backend y frontend al final.

---

## 1. BACKEND — `backend/controllers/tramiteController.js`

### Problema: `crearSolicitud` rechazaba solicitudes sin `tramite_id`
Reemplaza la validación original por esta:

```js
// POST /api/tramites/solicitudes
crearSolicitud: async (req, res) => {
  try {
    const { ciudadano_id, tramite_id, dependencia_id, campos_respuesta } = req.body;

    if (!ciudadano_id) {
      return res.status(400).json({ success: false, message: 'ciudadano_id es requerido' });
    }

    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    const folio = `TRM-${year}-${random}`;

    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('solicitudes')
      .insert([{
        folio,
        ciudadano_id,
        tramite_id: tramite_id || null,
        dependencia_id: dependencia_id || null,
        campos_respuesta: campos_respuesta || {},
        estado: 'recibido'
      }])
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
},
```

### Problema: `getSolicitudByFolio` no devolvía el token ni el audit_log
Reemplaza el método completo:

```js
// GET /api/tramites/solicitudes/folio/:folio
getSolicitudByFolio: async (req, res) => {
  try {
    const { folio } = req.params;
    const identifier = decodeURIComponent(folio || '').trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const client = supabaseAdmin || supabase;

    let query = client
      .from('solicitudes')
      .select('*, tramite:tramites_catalogo(nombre), dependencia:dependencias(nombre), ciudadano:perfiles!ciudadano_id(id, nombre_completo, curp)');

    query = isUUID ? query.eq('id', identifier) : query.eq('folio', identifier);
    const { data: rows, error } = await query.limit(1);
    if (error) throw error;
    const data = rows && rows.length > 0 ? rows[0] : null;
    if (!data) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });

    // Email del ciudadano desde auth
    let enriched = data;
    if (supabaseAdmin && data.ciudadano_id) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.ciudadano_id);
        if (authUser?.user?.email) {
          enriched = { ...data, ciudadano: data.ciudadano ? { ...data.ciudadano, email: authUser.user.email } : { email: authUser.user.email } };
        }
      } catch (_) {}
    }

    // Audit log real de la BD
    const { data: auditRows } = await client
      .from('audit_log')
      .select('*')
      .eq('solicitud_id', data.id)
      .order('created_at', { ascending: false });

    return res.status(200).json({ success: true, data: { ...enriched, audit_log: auditRows || [] } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
},
```

---

## 2. BACKEND — `backend/controllers/auth.controller.js`

### Problema: el login del gestor no devolvía `dependencia_id`
Busca el bloque `return res.status(200).json(...)` dentro de `login` y asegúrate que tenga `dependencia_id`:

```js
return res.status(200).json({
  success: true,
  user: {
    id: userProfile ? userProfile.id : authData.user.id,
    email: authData.user.email,
    nombre: nombreFinal,
    rol: rolFinal,
    dependencia_id: userProfile?.dependencia_id || null,  // <-- esta línea es clave
    tipo_solicitud,
    municipio
  }
});
```

---

## 3. BACKEND — `backend/controllers/gestorController.js`

### Problema: `getSolicitudes` usaba cliente anon (RLS bloqueaba datos)
Cambia la línea del cliente:

```js
// ANTES:
const { data, error } = await supabase.from('solicitudes')...

// DESPUÉS:
const listClient = supabaseAdmin || supabase;
let query = listClient.from('solicitudes').select(`...`);
```

### Problema: filtro `tipo_solicitud` excluía solicitudes sin tramite asignado
El filtro correcto:

```js
if (tipo_solicitud && tipo_solicitud !== 'null' && tipo_solicitud !== 'undefined') {
  const tipoLower = tipo_solicitud.toLowerCase();
  mappedData = mappedData.filter(s => {
    if (!s.tramite_id) return true; // sin tramite, siempre mostrar
    const nombre = (s.tramite?.nombre || '').toLowerCase();
    const fallback = (s.campos_respuesta?.tramite_nombre_fallback || '').toLowerCase();
    return nombre.includes(tipoLower) || fallback.includes(tipoLower);
  });
}
```

### Problema: filtro `dependencia_id` no mostraba solicitudes con dependencia null
```js
if (dependencia_id && dependencia_id !== 'null' && dependencia_id !== 'undefined') {
  query = query.or(`dependencia_id.eq.${dependencia_id},dependencia_id.is.null`);
}
```

### Problema: `getSolicitud` fallaba con `.maybeSingle()`
Reemplaza el helper de consulta:

```js
const runQuery = async (client) => {
  let q = client.from('solicitudes').select(selectFields);
  q = isUUID ? q.eq('id', identifier) : q.eq('folio', identifier);
  q = q.limit(1);
  const { data: rows, error: err } = await q;
  return { data: rows && rows.length > 0 ? rows[0] : null, error: err };
};

let { data, error } = await runQuery(supabase);
if ((!data || error) && supabaseAdmin) {
  const adminResult = await runQuery(supabaseAdmin);
  if (!adminResult.error && adminResult.data) { data = adminResult.data; error = null; }
}
```

---

## 4. FRONTEND — `frontend/src/pages/gestor/index.astro`

### Problema: guardaba un `dependencia_id` inventado en lugar del real
Busca donde se guarda en localStorage y elimina el valor hardcodeado:

```js
// ANTES (línea aprox 163):
const depId = loginResponseData?.user?.dependencia_id || 'a0000001-0000-0000-0000-000000000005';

// DESPUÉS:
const depId = loginResponseData?.user?.dependencia_id || null;
```

---

## 5. FRONTEND — `frontend/src/pages/gestor/cola.astro`

### Problema: datos inventados (Manuel Pech, Eduardo Chan, Marisela Puc) en lugar de datos reales
- Elimina completamente el array `defaultRequests` (o cualquier array con datos hardcodeados).
- En `loadRequests`, si el fetch falla, regresa `[]` (array vacío) — no leas de localStorage.

```js
const loadRequests = async () => {
  try {
    // ... fetch a la API ...
    if (json.success && Array.isArray(json.data)) {
      return json.data.map(s => ({ ... }));
    }
  } catch (_) {}
  return []; // <-- sin fallback a datos inventados
};
```

- Cambia `requests.reverse()` por `[...requests].reverse()` para no mutar el array.
- Cambia `new Date('2026-05-22')` por `new Date()`.

---

## 6. FRONTEND — `frontend/src/pages/ciudadano/login.astro`

### Problema: guardaba `citizen_nombre` pero otras páginas leían `citizen_fullname`
Asegúrate de guardar **ambas** claves:

```js
const nombre = json.data.nombre_completo || '';
localStorage.setItem('citizen_id', json.data.id);
localStorage.setItem('citizen_nombre', nombre);
localStorage.setItem('citizen_fullname', nombre); // <-- línea que faltaba
```

También en el fallback demo:
```js
localStorage.setItem('citizen_nombre', 'Ciudadano Demo');
localStorage.setItem('citizen_fullname', 'Ciudadano Demo');
```

---

## 7. FRONTEND — `frontend/src/pages/gestor/solicitud.astro`

### Problema: campos de datos del ciudadano no coincidían con los keys de `campos_respuesta`
Los campos correctos (el formulario guarda estos nombres):

```js
const cname  = req.ciudadano?.nombre_completo || req.campos_respuesta?.nombre_ciudadano || 'N/A';
const ccurp  = req.ciudadano?.curp             || req.campos_respuesta?.curp_ciudadano   || 'N/A';
const cemail = req.ciudadano?.email            || req.campos_respuesta?.correo_ciudadano || 'N/A';

document.getElementById('lbl-citizen-phone').textContent =
  req.campos_respuesta?.telefono || req.campos_respuesta?.telefono_ciudadano || 'N/A';

document.getElementById('lbl-citizen-address').textContent =
  req.campos_respuesta?.direccion || req.campos_respuesta?.municipio || 'N/A';

document.getElementById('lbl-solicitud-folio').textContent = req.folio || req.id;
```

---

## 8. FRONTEND — `frontend/src/pages/ciudadano/tracker.astro`

### Problema: mostraba `-` en el token y leía el audit log de localStorage
En el bloque donde se arma el objeto `req` desde la API:

```js
window.currentAuditLog = s.audit_log || [];
req = {
  folio: s.folio || s.id,
  name:  s.tramite?.nombre || s.campos_respuesta?.tramite_nombre_fallback || 'Trámite',
  dept:  s.dependencia?.nombre || s.campos_respuesta?.dependencia_nombre_fallback || '-',
  date:  (s.created_at || '').split('T')[0],
  status: s.estado || 'recibido',
  citizen_fullname: s.ciudadano?.nombre_completo || s.campos_respuesta?.nombre_ciudadano || 'N/A',
  token:  s.campos_respuesta?.token_expediente || s.token || '-',   // <-- clave
  comments: s.notas || ''
};
```

En la sección de la bitácora, reemplaza el bloque que lee `civicflow_audit_logs` de localStorage por:

```js
const folioLogs = window.currentAuditLog || [];
const tbody = document.getElementById('audit-tbody');
tbody.innerHTML = '';

const estadoLabel = {
  'recibido': 'Recibido',
  'en_revision': 'En revisión',
  'documentacion_incompleta': 'Doc. incompleta',
  'aprobado': 'Aprobado',
  'rechazado': 'Rechazado'
};

if (folioLogs.length === 0) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td colspan="4" class="px-6 py-4 text-center text-slate-400">Ningún cambio de estado registrado aún.</td>`;
  tbody.appendChild(tr);
} else {
  folioLogs.forEach(log => {
    const ant = estadoLabel[log.estado_anterior] || log.estado_anterior || '-';
    const nvo = estadoLabel[log.estado_nuevo]    || log.estado_nuevo    || '-';
    let color = 'text-yuc-green-dark';
    if (log.estado_nuevo === 'documentacion_incompleta') color = 'text-orange-600';
    else if (log.estado_nuevo === 'aprobado')  color = 'text-emerald-600';
    else if (log.estado_nuevo === 'rechazado') color = 'text-red-600';

    const fecha = log.created_at ? new Date(log.created_at).toLocaleString('es-MX') : '-';
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 border-b border-slate-100 transition-colors";
    tr.innerHTML = `
      <td class="px-6 py-4 font-mono">${fecha}</td>
      <td class="px-6 py-4 font-semibold">${log.usuario_id || 'Sistema'}</td>
      <td class="px-6 py-4 font-medium text-slate-700">${log.notas || 'Actualización de expediente.'}</td>
      <td class="px-6 py-4"><span class="font-bold">${ant}</span> → <span class="font-bold ${color}">${nvo}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
```

---

## Pasos para aplicar todo

```bash
# 1. Reiniciar el backend
cd backend
# Ctrl+C para detener el servidor actual, luego:
node server.js
# o si usa nodemon:
nodemon server.js

# 2. Reiniciar el frontend (en otra terminal)
cd frontend
npm run dev
```

---

## Flujo completo esperado después de los fixes

1. **Ciudadano** entra a `/ciudadano/login` → inicia sesión → `citizen_fullname` y `citizen_nombre` se guardan correctamente en localStorage.
2. **Ciudadano** va a `/ciudadano/tramite?id=residencia` → llena el formulario → el POST a `/api/tramites/solicitudes` acepta `tramite_id: null` y crea la solicitud con folio real.
3. **Ciudadano** llega a `/ciudadano/exito?folio=TRM-...&token=TK-...` → ve su folio y token.
4. **Ciudadano** hace clic en "Ir al Rastrear Estado" → `/ciudadano/tracker?folio=TRM-...` → el tracker llama `/api/tramites/solicitudes/folio/TRM-...` → muestra el token de `campos_respuesta.token_expediente` y la bitácora real de la BD.
5. **Gestor** entra a `/gestor` → su `dependencia_id` real se guarda en localStorage (ya no el UUID inventado).
6. **Gestor** va a `/gestor/cola` → ve solo solicitudes reales de la BD (sin datos inventados). Las solicitudes sin `tramite_id` asignado sí aparecen.
7. **Gestor** hace clic en "Atender" → va a `/gestor/solicitud?id=TRM-...` → ve el nombre, CURP, correo real del ciudadano desde `campos_respuesta`.
