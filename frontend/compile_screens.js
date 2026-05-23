import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, "dist");
const outputFile = path.join(__dirname, "..", "CivicFlow_Catalogo_Pantallas.html");
const astroAssetsDir = path.join(distDir, "_astro");

console.log("Initializing Node screen compiler...");

// Find the CSS file
let cssContent = "";
if (fs.existsSync(astroAssetsDir)) {
  const files = fs.readdirSync(astroAssetsDir);
  const cssFile = files.find(f => f.endsWith(".css"));
  if (cssFile) {
    console.log(`Loading styles from ${cssFile}...`);
    cssContent = fs.readFileSync(path.join(astroAssetsDir, cssFile), 'utf-8');
  } else {
    console.log("Warning: CSS file not found in _astro directory.");
  }
}

const pagesConfig = [
    {path: "index.html", title: "1. Portal de Bienvenida (Landing / Selector)", desc: "Pantalla de inicio del portal de trámites del Gobierno de Yucatán, que redirige al ciudadano o al servidor público."},
    {path: "ciudadano/registro/index.html", title: "2. Portal Ciudadano - Registro y Privacidad (Consentimiento)", desc: "Paso 1 del Onboarding: Creación de cuenta ciudadana con aceptación obligatoria de términos de intercambio de datos interdependencias."},
    {path: "ciudadano/login/index.html", title: "3. Portal Ciudadano - Acceso / Login", desc: "Acceso seguro para el ciudadano mediante correo y validación de CURP con formato oficial."},
    {path: "ciudadano/index.html", title: "4. Portal Ciudadano - Catálogo de Servicios, Bandeja y Expediente", desc: "Paso 2: Catálogo con búsqueda libre (SAT, SSP licencias/placas, pasaportes, INE), bandeja de trámites y expediente digital único."},
    {path: "ciudadano/tramite/index.html", title: "5. Portal Ciudadano - Validación de Requisitos por Token y Asistente", desc: "Formulario de validación de requisitos mediante Token del Expediente Único y chatbot asistente para resolver dudas de trámites."},
    {path: "ciudadano/exito/index.html", title: "6. Portal Ciudadano - Cierre y Comprobante (Token)", desc: "Paso 3: Pantalla de éxito con descarga de acuse PDF firmado digitalmente y emisión de Token de seguimiento único."},
    {path: "ciudadano/tracker/index.html", title: "7. Portal Ciudadano - Tracker y Timeline de Consulta", desc: "Paso 4: Buscador central por Token o Folio, timeline de 3 estados (Recibido, En revisión, Aprobado/Declinado) y comentarios."},
    {path: "gestor/index.html", title: "8. Panel Gestor - Acceso / Login", desc: "Inicio de sesión seguro para funcionarios estatales, con selector de roles (Revisor o Aprobador)."},
    {path: "gestor/dashboard/index.html", title: "9. Panel Gestor - Mesa de Trabajo (Mesa Ciudadana)", desc: "Mesa de trabajo principal: tarjetas/islas que exponen los datos y validaciones algorítmicas de cada expediente de forma ágil."},
    {path: "gestor/vencidas/index.html", title: "10. Panel Gestor - Solicitudes Vencidas (Monitoreo)", desc: "Vista de monitoreo y eficiencia enfocada en folios que superan el Plazo Máximo de Atención, destacando plazos con alertas rojas."},
    {path: "gestor/cola/index.html", title: "11. Panel Gestor - Cola de Solicitudes", desc: "Tabla operativa de expedientes con filtros detallados y exportación a formato Excel (CSV)."},
    {path: "gestor/solicitud/index.html", title: "12. Panel Gestor - Dictamen, Firma y Plantillas", desc: "Ficha del trámite para validación de requisitos, modales de rechazo con plantillas, y lienzo de firma digital para aprobadores."},
    {path: "gestor/audit/index.html", title: "13. Panel Gestor - Logs de Seguridad y Auditoría", desc: "Bitácora inalterable de accesos y transiciones de estados para transparencia y auditorías regulatorias."}
];

const bodyBlocks = [];

for (const config of pagesConfig) {
  const filePath = path.join(distDir, ...config.path.split('/'));
  if (fs.existsSync(filePath)) {
    console.log(`Processing page: ${config.title}...`);
    const html = fs.readFileSync(filePath, 'utf-8');
    
    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      let bodyInner = bodyMatch[1];
      
      // Remove scripts
      bodyInner = bodyInner.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
      
      const screenId = config.path.replace('/index.html', '').replace('index.html', '').replace(/\//g, '-') || 'home';
      const block = `
      <div class="screen-wrapper" id="screen-${screenId}">
          <div class="screen-title">${config.title}</div>
          <p class="screen-desc">${config.desc}</p>
          <div class="screen-frame">
              <div class="browser-header">
                  <span class="dot red"></span>
                  <span class="dot yellow"></span>
                  <span class="dot green"></span>
                  <span class="browser-address">https://civicflow.yucatan.gob.mx/${config.path.replace('/index.html', '').replace('index.html', '')}</span>
              </div>
              <div class="browser-body">
                  ${bodyInner}
              </div>
          </div>
      </div>
      `;
      bodyBlocks.push(block);
    }
  } else {
    console.log(`Warning: File not found: ${filePath}`);
  }
}

const compiledHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CivicFlow - Catálogo de Pantallas del Gobierno de Yucatán</title>
    <style>
        body {
            background-color: #f1f5f9;
            color: #0f172a;
            font-family: 'Plus Jakarta Sans', sans-serif;
            margin: 0;
            padding: 0;
        }
        .print-header {
            background: linear-gradient(135deg, #00382b 0%, #005c42 100%);
            color: white;
            padding: 3rem 2rem;
            text-align: center;
            border-bottom: 5px solid #c29b38;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        }
        .print-header h1 {
            margin: 0;
            font-size: 2.2rem;
            font-family: 'Outfit', sans-serif;
            font-weight: 800;
            letter-spacing: -0.025em;
        }
        .print-header p {
            margin: 0.5rem 0 0;
            font-size: 1rem;
            color: #e2e8f0;
        }
        .print-tip {
            display: inline-block;
            margin-top: 1.5rem;
            padding: 0.5rem 1.2rem;
            background: rgba(194, 155, 56, 0.2);
            border: 1px solid #c29b38;
            border-radius: 0.5rem;
            font-size: 0.8rem;
            font-weight: bold;
            color: #ffdf7e;
        }
        .screen-wrapper {
            max-width: 1200px;
            margin: 4rem auto;
            padding: 2rem;
            background: white;
            border-radius: 1.5rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
            page-break-after: always;
        }
        .screen-title {
            font-size: 1.6rem;
            font-weight: 800;
            color: #005c42;
            font-family: 'Outfit', sans-serif;
            margin: 0 0 0.5rem;
        }
        .screen-desc {
            font-size: 0.85rem;
            color: #64748b;
            margin: 0 0 2rem;
            line-height: 1.5;
        }
        .screen-frame {
            border: 1px solid #e2e8f0;
            border-radius: 1rem;
            overflow: hidden;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
            background: #ffffff;
        }
        .browser-header {
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            padding: 0.75rem 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .browser-header .dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            display: inline-block;
        }
        .browser-header .dot.red { background-color: #ef4444; }
        .browser-header .dot.yellow { background-color: #f59e0b; }
        .browser-header .dot.green { background-color: #10b981; }
        .browser-header .browser-address {
            flex-grow: 1;
            text-align: center;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 0.35rem;
            font-size: 0.7rem;
            color: #94a3b8;
            padding: 0.2rem 0;
            max-width: 500px;
            margin: 0 auto;
            font-family: monospace;
            letter-spacing: 0.025em;
        }
        .browser-body {
            position: relative;
            background: #f8fafc;
        }
        
        ${cssContent}

        header {
            position: relative !important;
            top: 0 !important;
        }
        .min-h-screen {
            min-height: auto !important;
        }
        main {
            padding-bottom: 2rem;
        }

        @media print {
            body {
                background-color: #ffffff;
            }
            .print-header {
                display: none;
            }
            .screen-wrapper {
                margin: 0;
                padding: 0;
                box-shadow: none;
                border: none;
                background: white;
            }
            .screen-frame {
                border: none;
                box-shadow: none;
            }
            .browser-header {
                border-bottom: 2px solid #005c42;
            }
            .browser-header .browser-address {
                border: none;
                color: #0f172a;
                font-weight: bold;
            }
        }
    </style>
</head>
<body>
    <div class="print-header">
        <h1>CivicFlow - Catálogo Completo de Pantallas</h1>
        <p>Prototipo Interactivo de la Ventanilla Única de Trámites del Gobierno del Estado de Yucatán</p>
        <div class="print-tip">🖨️ Presione CTRL + P y elija "Guardar como PDF" para descargar el catálogo completo</div>
    </div>
    
    ${bodyBlocks.join('')}

    <!-- Scoped Interactive Scripts for Offline Catalog Frames -->
    <script>
        document.querySelectorAll('.screen-wrapper').forEach(wrapper => {
            // Tab Switcher Logic
            const tabCatalog = wrapper.querySelector('#tab-btn-catalog');
            const tabInbox = wrapper.querySelector('#tab-btn-inbox');
            const tabFolder = wrapper.querySelector('#tab-btn-folder');
            
            const contentCatalog = wrapper.querySelector('#tab-content-catalog');
            const contentInbox = wrapper.querySelector('#tab-content-inbox');
            const contentFolder = wrapper.querySelector('#tab-content-folder');
            
            if (tabCatalog && tabInbox && tabFolder && contentCatalog && contentInbox && contentFolder) {
                const activeClass = "pb-4 px-1 text-sm font-extrabold border-b-2 border-yuc-green text-yuc-green dark:border-yuc-green-light dark:text-yuc-green-light focus:outline-none transition-all flex items-center gap-2";
                const inactiveClass = "pb-4 px-1 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 focus:outline-none transition-all flex items-center gap-2 relative";
                
                const activate = (tab) => {
                    tabCatalog.className = inactiveClass;
                    tabInbox.className = inactiveClass;
                    tabFolder.className = inactiveClass;
                    
                    contentCatalog.classList.add('hidden');
                    contentInbox.classList.add('hidden');
                    contentFolder.classList.add('hidden');
                    
                    if (tab === 'catalog') {
                        tabCatalog.className = activeClass;
                        contentCatalog.classList.remove('hidden');
                    } else if (tab === 'inbox') {
                        tabInbox.className = activeClass + " relative";
                        contentInbox.classList.remove('hidden');
                        
                        // Populate mock inbox list inside the catalog preview if empty
                        const tbody = contentInbox.querySelector('#inbox-tbody');
                        if (tbody && tbody.children.length === 0) {
                            tbody.innerHTML = \`
                                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors">
                                    <td class="px-6 py-4 font-mono font-bold text-slate-800 dark:text-white">TRM-2026-00201</td>
                                    <td class="px-6 py-4 font-semibold">Licencia de Conducir y Placas</td>
                                    <td class="px-6 py-4 text-xs text-slate-400 dark:text-slate-505 font-medium">Secretaría de Seguridad Pública (SSP)</td>
                                    <td class="px-6 py-4 text-xs">2026-05-18</td>
                                    <td class="px-6 py-4">
                                        <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">Recibido</span>
                                    </td>
                                    <td class="px-6 py-4 text-right">
                                        <a href="#screen-8" class="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-extrabold rounded-lg inline-flex items-center gap-1">Rastrear</a>
                                    </td>
                                </tr>
                            \`;
                            const emptyMsg = contentInbox.querySelector('#inbox-empty-msg');
                            if (emptyMsg) emptyMsg.classList.add('hidden');
                        }
                    } else if (tab === 'folder') {
                        tabFolder.className = activeClass;
                        contentFolder.classList.remove('hidden');
                        
                        // Populate mock dossier list inside the catalog preview
                        const grid = contentFolder.querySelector('#dossier-grid');
                        if (grid && grid.children.length === 0) {
                            grid.innerHTML = \`
                                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between h-44 shadow-sm">
                                    <div class="flex justify-between items-start gap-4">
                                        <h4 class="font-bold text-xs text-slate-800 dark:text-white">Identificación Oficial Vigente (INE)</h4>
                                        <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[9px] uppercase tracking-wide">✓ Cargado</span>
                                    </div>
                                    <div class="pt-4 border-t border-slate-100 dark:border-slate-850 mt-4 flex items-center justify-between gap-3 w-full">
                                        <div class="text-left">
                                            <p class="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">ine_ciudadano_yuc.pdf</p>
                                            <p class="text-[9px] text-slate-450">Fecha: 2026-05-18</p>
                                        </div>
                                        <button class="px-2.5 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">Descargar</button>
                                    </div>
                                </div>
                                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between h-44 shadow-sm">
                                    <div class="flex justify-between items-start gap-4">
                                        <h4 class="font-bold text-xs text-slate-800 dark:text-white">Comprobante de Domicilio</h4>
                                        <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[9px] uppercase tracking-wide">✓ Cargado</span>
                                    </div>
                                    <div class="pt-4 border-t border-slate-100 dark:border-slate-850 mt-4 flex items-center justify-between gap-3 w-full">
                                        <div class="text-left">
                                            <p class="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">comprobante_luz_merida.pdf</p>
                                            <p class="text-[9px] text-slate-450">Fecha: 2026-05-18</p>
                                        </div>
                                        <button class="px-2.5 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">Descargar</button>
                                    </div>
                                </div>
                            \`;
                        }
                    }
                };
                
                tabCatalog.addEventListener('click', () => activate('catalog'));
                tabInbox.addEventListener('click', () => activate('inbox'));
                tabFolder.addEventListener('click', () => activate('folder'));
            }

            // SAT warning modal Logic
            const satBtn = wrapper.querySelector('#btn-sat-tramite');
            const satModal = wrapper.querySelector('#sat-rfc-modal');
            const closeBtn = wrapper.querySelector('#btn-close-sat-modal');
            const closeBg = wrapper.querySelector('#sat-modal-close-bg');
            const saveBtn = wrapper.querySelector('#btn-save-rfc');
            const rfcInput = wrapper.querySelector('#sat-rfc-input');

            if (satBtn && satModal) {
                satBtn.addEventListener('click', () => {
                    satModal.classList.remove('hidden');
                });
                if (closeBtn) closeBtn.addEventListener('click', () => satModal.classList.add('hidden'));
                if (closeBg) closeBg.addEventListener('click', () => satModal.classList.add('hidden'));
                if (saveBtn) {
                    saveBtn.addEventListener('click', () => {
                        const rfc = rfcInput ? rfcInput.value.trim().toUpperCase() : 'XAXX010101000';
                        alert('RFC "' + rfc + '" guardado en simulación.');
                        satModal.classList.add('hidden');
                    });
                }
            }
        });

        // Intercept navigation links for offline catalog
        document.querySelectorAll('.screen-wrapper a, .screen-wrapper button').forEach(el => {
            el.addEventListener('click', (e) => {
                let href = el.getAttribute('href');
                if (!href && el.tagName === 'BUTTON') {
                    const parentAnchor = el.closest('a');
                    if (parentAnchor) href = parentAnchor.getAttribute('href');
                }
                
                if (href) {
                    if (href.includes('tab=folder')) {
                        e.preventDefault();
                        const target = document.getElementById('screen-ciudadano');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                            const tabFolder = target.querySelector('#tab-btn-folder');
                            if (tabFolder) tabFolder.click();
                        }
                    } else if (href.includes('tab=inbox')) {
                        e.preventDefault();
                        const target = document.getElementById('screen-ciudadano');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                            const tabInbox = target.querySelector('#tab-btn-inbox');
                            if (tabInbox) tabInbox.click();
                        }
                    } else if (href === '/ciudadano' || href === '/ciudadano/') {
                        e.preventDefault();
                        const target = document.getElementById('screen-ciudadano');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                            const tabCatalog = target.querySelector('#tab-btn-catalog');
                            if (tabCatalog) tabCatalog.click();
                        }
                    } else if (href.includes('/ciudadano/tracker')) {
                        e.preventDefault();
                        const target = document.getElementById('screen-ciudadano-tracker');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    } else if (href.includes('/ciudadano/tramite')) {
                        e.preventDefault();
                        const target = document.getElementById('screen-ciudadano-tramite');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    } else if (href === '/gestor' || href === '/gestor/') {
                        e.preventDefault();
                        const target = document.getElementById('screen-gestor');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    } else if (href.includes('/gestor/cola')) {
                        e.preventDefault();
                        const target = document.getElementById('screen-gestor-cola');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    } else if (href.includes('/gestor/dashboard')) {
                        e.preventDefault();
                        const target = document.getElementById('screen-gestor-dashboard');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    } else if (href.includes('/gestor/audit')) {
                        e.preventDefault();
                        const target = document.getElementById('screen-gestor-audit');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    } else if (href === '/' || href === '/index.html') {
                        e.preventDefault();
                        const target = document.getElementById('screen-home');
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                }
            });
        });
    </script>
</body>
</html>`;

fs.writeFileSync(outputFile, compiledHtml, 'utf-8');
console.log("Screen compiler completed successfully!");
console.log(`Unified catalog document saved to: ${outputFile}`);
