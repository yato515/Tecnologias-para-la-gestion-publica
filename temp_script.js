
		// Protect page access
		const gestorLogged = localStorage.getItem('gestor_logged');
		const overlay = document.getElementById('gestor-overlay');
		const content = document.getElementById('gestor-dashboard-content');

		if (gestorLogged !== 'true') {
			overlay.classList.remove('hidden');
			content.classList.add('hidden');
		} else {
			
			// Populate manager credentials
			const gestorEmail = localStorage.getItem('gestor_email') || 'N/A';
			document.getElementById('lbl-gestor-email').textContent = gestorEmail;
			const role = localStorage.getItem('gestor_role') || 'N/A';
			document.getElementById('lbl-gestor-role').textContent = role;

			// Enable admin tab if Aprobador
			if (role.toLowerCase() === 'aprobador') {
				document.getElementById('tab-admin').classList.remove('hidden');
			}

			// Tab Switching Logic
			const tabAdmin = document.getElementById('tab-admin');
			const tabDashboard = document.querySelector('a[href="/gestor/dashboard"]');
			const mainView = document.getElementById('main-dashboard-view');
			const adminView = document.getElementById('admin-view');

			if (tabAdmin) {
				tabAdmin.addEventListener('click', (e) => {
					e.preventDefault();
					mainView.classList.add('hidden');
					adminView.classList.remove('hidden');
					tabAdmin.classList.add('border-yuc-gold', 'text-yuc-gold');
					tabAdmin.classList.remove('border-transparent', 'text-slate-300');
					tabDashboard.classList.remove('border-yuc-gold', 'text-yuc-gold');
					tabDashboard.classList.add('border-transparent', 'text-slate-300');
					loadPersonal();
				});
			}

			if (tabDashboard) {
				tabDashboard.addEventListener('click', (e) => {
					// We can either let it reload the page (default link behavior) or switch tabs locally.
					// Since it's an actual link, let's just let it act as a link to reload the dashboard state.
				});
			}

			// Logout handler
			document.getElementById('btn-gestor-logout').addEventListener('click', () => {
				localStorage.removeItem('gestor_logged');
				localStorage.removeItem('gestor_email');
				localStorage.removeItem('gestor_role');
				window.showToast("Sesión de gestor cerrada", "info");
				setTimeout(() => {
					window.location.href = '/gestor';
				}, 600);
			});

			const statusMap = {
				'recibido': 'Recibido',
				'en_revision': 'En revisión',
				'documentacion_incompleta': 'Documentación incompleta',
				'aprobado': 'Aprobado',
				'rechazado': 'Rechazado'
			};

			const getRequests = async () => {
				try {
					const depId = localStorage.getItem('gestor_dependencia_id');
					const tipoSolicitud = localStorage.getItem('gestor_tipo_solicitud');
					const municipio = localStorage.getItem('gestor_municipio');

					let url = `${API_URL}/api/gestores/solicitudes?`;
					const params = [];
					if (depId) params.push(`dependencia_id=${depId}`);
					if (tipoSolicitud && tipoSolicitud !== 'null' && tipoSolicitud !== 'undefined') {
						params.push(`tipo_solicitud=${encodeURIComponent(tipoSolicitud)}`);
					}
					if (municipio && municipio !== 'null' && municipio !== 'undefined') {
						params.push(`municipio=${encodeURIComponent(municipio)}`);
					}
					url += params.join('&');

					const res = await fetch(url);
					const json = await res.json();
					if (json.success) {
						return json.data.map(r => ({
							id: r.id,
							folio: r.folio,
							name: r.tramite?.nombre || 'Trámite Genérico',
							dept: r.dependencia?.nombre || 'Dependencia',
							date: r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
							status: statusMap[r.estado] || r.estado,
							citizen_fullname: r.ciudadano?.nombre_completo || 'Ciudadano',
							token: r.id ? `TK-${r.id.substring(0, 6).toUpperCase()}` : 'TK-0000',
							delegation: r.campos_respuesta?.municipio || r.ciudadano?.municipio || 'Mérida Centro',
							algorithmic_result: r.estado === 'aprobado' ? 'Aprobado' : (r.estado === 'rechazado' ? 'Declinado' : 'Pendiente')
						}));
					}
					return [];
				} catch (e) {
					console.error(e);
					return [];
				}
			};

			const renderDashboard = async () => {
				const reqs = await getRequests();
				const currentDate = new Date('2026-05-22'); // system reference date

				// Filter calculations
				const pending = reqs.filter(r => r.status === 'Recibido' || r.status === 'En revisión' || r.status === 'En revisión con sistemas oficiales').length;
				const approved = reqs.filter(r => r.status === 'Aprobado').length;

				// Overdue calculation (older than 3 days)
				let overdueCount = 0;
				reqs.forEach(r => {
					if (r.status === 'Recibido' || r.status === 'En revisión' || r.status === 'En revisión con sistemas oficiales') {
						const reqDate = new Date(r.date);
						const diffTime = Math.abs(currentDate - reqDate);
						const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
						if (diffDays >= 3) {
							overdueCount++;
						}
					}
				});

				// Update metrics
				document.getElementById('metric-pending').textContent = pending;
				document.getElementById('metric-overdue').textContent = overdueCount;
				document.getElementById('metric-approved').textContent = approved;
				
				// Update overdue badge count in subnav
				const badgeOverdue = document.getElementById('badge-vencidas-count');
				if (overdueCount > 0) {
					badgeOverdue.textContent = overdueCount;
					badgeOverdue.classList.remove('hidden');
				} else {
					badgeOverdue.classList.add('hidden');
				}

				// Semáforo status
				const semLight = document.getElementById('semaforo-light');
				const semTitle = document.getElementById('semaforo-title');
				const semDesc = document.getElementById('semaforo-desc');
				const semBg = document.getElementById('semaforo-bg');

				if (overdueCount > 0) {
					semLight.className = "w-12 h-12 rounded-full shadow-inner flex items-center justify-center shrink-0 bg-red-600 animate-pulse text-white font-black";
					semLight.textContent = "!";
					semTitle.textContent = "SITUACIÓN CRÍTICA: ROJO";
					semTitle.className = "font-extrabold text-sm text-red-650 dark:text-red-500";
					semDesc.textContent = `${overdueCount} solicitudes han excedido el plazo límite de 3 días.`;
					semBg.className = "flex items-center gap-4 p-4 rounded-xl border border-red-200 bg-red-600/5 dark:bg-red-950/10";
				} else if (pending >= 5) {
					semLight.className = "w-12 h-12 rounded-full shadow-inner flex items-center justify-center shrink-0 bg-amber-500 text-white font-extrabold";
					semLight.textContent = "⚠";
					semTitle.textContent = "CARGA ELEVADA: AMARILLO";
					semTitle.className = "font-extrabold text-sm text-amber-600 dark:text-amber-500";
					semDesc.textContent = "Existen expedientes acumulados en espera de firma.";
					semBg.className = "flex items-center gap-4 p-4 rounded-xl border border-amber-200 bg-amber-500/5 dark:bg-amber-950/10";
				} else {
					semLight.className = "w-12 h-12 rounded-full shadow-inner flex items-center justify-center shrink-0 bg-emerald-500 text-white font-extrabold";
					semLight.textContent = "✓";
					semTitle.textContent = "SITUACIÓN ESTABLE: VERDE";
					semTitle.className = "font-extrabold text-sm text-emerald-600 dark:text-emerald-500";
					semDesc.textContent = "Tiempos de respuesta y colas dentro de la norma.";
					semBg.className = "flex items-center gap-4 p-4 rounded-xl border border-emerald-250 bg-emerald-500/5 dark:bg-emerald-950/10";
				}

				// Render Islands Grid
				const grid = document.getElementById('requests-islands-grid');
				const emptyMsg = document.getElementById('islands-empty-msg');
				grid.innerHTML = '';

				if (reqs.length === 0) {
					emptyMsg.classList.remove('hidden');
					document.getElementById('lbl-island-count').textContent = "0";
					return;
				}

				emptyMsg.classList.add('hidden');
				document.getElementById('lbl-island-count').textContent = reqs.length;

				// Loop and render cards dynamically matching SolicitudCard styles
				reqs.reverse().forEach(r => {
					const isApproved = r.algorithmic_result === 'Aprobado';
					
					const card = document.createElement('div');
					card.className = "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group";
					
					card.innerHTML = `
						<div class="absolute top-0 left-0 w-full h-1.5 ${isApproved ? 'bg-emerald-500' : 'bg-red-500'}"></div>
						<div class="space-y-4">
							<div class="flex justify-between items-center text-[10px] text-slate-400 font-bold tracking-wider">
								<span class="font-mono bg-slate-50 px-2 py-0.5 rounded text-slate-700 border border-slate-200">${r.folio}</span>
								<span>${r.date}</span>
							</div>

							<div class="space-y-1">
								<span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Ciudadano</span>
								<h4 class="text-sm font-bold text-slate-800 leading-tight font-display">${r.citizen_fullname || 'N/A'}</h4>
							</div>

							<div class="grid grid-cols-2 gap-3 pt-1 text-xs">
								<div>
									<span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Área / Trámite</span>
									<span class="font-semibold text-slate-700 block mt-0.5 leading-tight truncate">${r.name}</span>
								</div>
								<div>
									<span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Delegación</span>
									<span class="font-semibold text-slate-700 block mt-0.5 leading-tight truncate">${r.delegation || 'Mérida'}</span>
								</div>
							</div>

							<div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
								<div>
									<span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Token</span>
									<code class="font-mono text-xs font-bold text-yuc-green tracking-wider">${r.token}</code>
								</div>
								<a href="/gestor/solicitud?id=${r.folio}" class="px-2.5 py-1 bg-slate-100 hover:bg-yuc-green text-slate-700 hover:text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-0.5 shadow-sm">
									<span>Atender</span>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
								</a>
							</div>

							<div class="pt-4 border-t border-slate-100 space-y-2">
								<div class="flex items-center justify-between">
									<span class="text-[8.5px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
										<span class="w-1.5 h-1.5 rounded-full bg-yuc-green animate-ping"></span>
										Validación Algorítmica
									</span>
									<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${isApproved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}">
										${isApproved ? 'Aprobado' : 'Declinado'}
									</span>
								</div>
								
								<div class="grid grid-cols-2 gap-1 text-[9px] text-slate-500">
									<div class="flex items-center gap-1">
										<svg class="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
										<span>Cruce RENAPO</span>
									</div>
									<div class="flex items-center gap-1">
										<svg class="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
										<span>INE Cotejado</span>
									</div>
								</div>
							</div>
						</div>

						<div class="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase">
							<span>Estatus:</span>
							<span class="${r.status === 'Aprobado' ? 'text-emerald-500' : (r.status === 'Rechazado' || r.status === 'Declinado' ? 'text-red-500' : 'text-slate-600')}">${r.status}</span>
						</div>
					\`;
					grid.appendChild(card);
				});

			};

			renderDashboard();

			// Storage Event listener for Live Sync (now handled differently or just disabled for mock)
			window.addEventListener('storage', (e) => {
				if (e.key === 'civicflow_refresh') {
					renderDashboard();
					window.showToast("Bandeja actualizada", "info");
				}
			});

			// Render Analytics
			const renderCharts = async () => {
				const resCtx = document.getElementById('chart-resolution-time').getContext('2d');
				const distCtx = document.getElementById('chart-distribution').getContext('2d');

				// Bar chart
				new Chart(resCtx, {
					type: 'bar',
					data: {
						labels: ['SSP', 'SAT', 'SRE / Pasaporte', 'Registro Civil'],
						datasets: [{
							data: [1.2, 0.4, 2.5, 0.2],
							backgroundColor: 'rgba(0, 92, 66, 0.8)',
							borderRadius: 6,
							barThickness: 32
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: { legend: { display: false } },
						scales: {
							y: { beginAtZero: true, grid: { color: 'rgba(156,163,175,0.08)' } },
							x: { grid: { display: false } }
						}
					}
				});

				// Doughnut chart (approved vs declinado algorithms)
				const reqs = await getRequests();
				const approvedCount = reqs.filter(r => r.algorithmic_result === 'Aprobado').length;
				const declinadoCount = reqs.filter(r => r.algorithmic_result === 'Declinado').length;

				new Chart(distCtx, {
					type: 'doughnut',
					data: {
						labels: ['Aprobación Algorítmica', 'Cruce de Datos Fallido'],
						datasets: [{
							data: [approvedCount || 2, declinadoCount || 1],
							backgroundColor: ['#005c42', '#c29b38'],
							borderWidth: 2,
							borderColor: '#ffffff'
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: {
								position: 'bottom',
								labels: { boxWidth: 10, font: { size: 10 } }
							}
						}
					}
				});
			};

			setTimeout(renderCharts, 200);

			// Staff Table Logic
			const loadPersonal = async () => {
				const tbody = document.getElementById('tbl-personal-body');
				tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-400">Cargando personal...</td></tr>';
				try {
					const res = await fetch(`${API_URL}/api/gestores/personal`);
					const json = await res.json();
					if (json.success && json.data) {
						tbody.innerHTML = '';
						if (json.data.length === 0) {
							tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-400">No hay personal registrado</td></tr>';
						} else {
							json.data.forEach(p => {
								const tr = document.createElement('tr');
								const filterTramite = p.tipo_solicitud || 'Todos';
								const filterLugar = p.municipio || 'Todos';

								tr.innerHTML = `
									<td class="py-4 font-semibold">${p.nombre_completo || 'Sin nombre'}</td>
									<td class="py-4">
										<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.rol === 'aprobador' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}">
											${p.rol}
										</span>
									</td>
									<td class="py-4 text-xs font-semibold text-slate-500">${filterTramite}</td>
									<td class="py-4 text-xs font-semibold text-slate-500">${filterLugar}</td>
									<td class="py-4 text-right">
										<button class="btn-edit-staff px-3 py-1.5 text-[10px] font-bold text-yuc-green border border-yuc-green/30 hover:bg-yuc-green hover:text-white rounded-lg transition-colors" 
											data-id="${p.id}" 
											data-name="${p.nombre_completo || ''}" 
											data-role="${p.rol}"
											data-dependencia="${p.dependencia_id || ''}"
											data-tipo-solicitud="${p.tipo_solicitud || ''}"
											data-municipio="${p.municipio || ''}">
											Modificar
										</button>
									</td>
								`;
								tbody.appendChild(tr);
							});

							// Attach edit events
							document.querySelectorAll('.btn-edit-staff').forEach(btn => {
								btn.addEventListener('click', (e) => {
									const id = e.currentTarget.getAttribute('data-id');
									const name = e.currentTarget.getAttribute('data-name');
									const r = e.currentTarget.getAttribute('data-role');
									const tipo = e.currentTarget.getAttribute('data-tipo-solicitud');
									const muni = e.currentTarget.getAttribute('data-municipio');
									
									document.getElementById('edit-id').value = id;
									document.getElementById('edit-name').value = name;
									document.getElementById('edit-role').value = r;
									if (document.getElementById('edit-tipo-solicitud')) {
										document.getElementById('edit-tipo-solicitud').value = tipo || '';
									}
									if (document.getElementById('edit-municipio')) {
										document.getElementById('edit-municipio').value = muni || '';
									}
									
									document.getElementById('modal-edit-personal').classList.remove('hidden');
								});
							});
						}
					}
				} catch (err) {
					tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-red-500">Error al cargar datos</td></tr>';
				}
			};
			const loadFiltros = async () => {
				const selectTramites = document.getElementById('edit-tipo-solicitud');
				const selectMunicipios = document.getElementById('edit-municipio');
				
				// Cargar municipios de Yucatán
				if (selectMunicipios) {
					const municipios = ["Abalá","Acanceh","Akil","Baca","Bokobá","Buctzotz","Cacalchén","Calotmul","Cansahcab","Cantamayec","Celestún","Cenotillo","Conkal","Cuncunul","Cuzamá","Chacsinkín","Chankom","Chapab","Chemax","Chicxulub Pueblo","Chichimilá","Chikindzonot","Chocholá","Chumayel","Dzán","Dzemul","Dzidzantún","Dzilam de Bravo","Dzilam González","Dzitás","Dzoncauich","Espita","Halachó","Hocabá","Hoctún","Homún","Huhí","Hunucmá","Ixil","Izamal","Kanasín","Kantunil","Kaua","Kinchil","Kopomá","Mama","Maní","Maxcanú","Mayapán","Mérida","Mocochá","Motul","Muna","Muxupip","Opichén","Oxkutzcab","Panabá","Peto","Progreso","Quintana Roo","Río Lagartos","Sacalum","Samahil","Sanahcat","San Felipe","Santa Elena","Seyé","Sinanché","Sotuta","Sucilá","Sudzal","Suma","Tahdziú","Tahmek","Teabo","Tecoh","Tekal de Venegas","Tekantó","Tekax","Tekit","Tekom","Telchac Pueblo","Telchac Puerto","Temax","Temozón","Tepakán","Tetiz","Teya","Ticul","Timucuy","Tinum","Tixcacalcupul","Tixkokob","Tixmehuac","Tixpéhual","Tizimín","Tunkás","Tzucacab","Uayma","Ucú","Umán","Valladolid","Xocchel","Yaxcabá","Yaxkukul","Yobaín"];
					selectMunicipios.innerHTML = '<option value="">Todos los municipios</option>';
					municipios.forEach(m => {
						const opt = document.createElement('option');
						opt.value = m;
						opt.textContent = m;
						selectMunicipios.appendChild(opt);
					});
				}

				// Cargar tipos de trámites fijos (Catálogo)
				if (selectTramites) {
					const tramitesFijos = [
						"Licencia de Conducir y Placas",
						"Inscripción en el RFC (SAT)",
						"Trámite de Pasaporte Mexicano",
						"CURP y Actas Certificadas",
						"Tarjeta Va y Ven (Estudiante)",
						"Constancia de Antecedentes No Penales",
						"Licencia de Funcionamiento Municipal",
						"Subsidio de Paneles Solares",
						"Copia Certificada de Acta de Nacimiento (Digital)",
						"Renovación de Licencia de Conducir (Automovilista - 2 años)"
					];
					selectTramites.innerHTML = '<option value="">Todos los trámites</option>';
					tramitesFijos.forEach(t => {
						const opt = document.createElement('option');
						opt.value = t;
						opt.textContent = t;
						selectTramites.appendChild(opt);
					});
				}
			};

			// Admin UI logic
			document.getElementById('tab-admin')?.addEventListener('click', (e) => {
				e.preventDefault();
				const mainView = document.getElementById('main-dashboard-view');
				if (mainView) mainView.classList.add('hidden');
				
				const adminView = document.getElementById('admin-view');
				if (adminView) adminView.classList.remove('hidden');
				
				// Set active styling on Admin tab
				document.getElementById('tab-admin').className = "pb-3 border-b-2 border-yuc-gold text-yuc-gold font-bold transition-all flex items-center gap-1.5";
				// Set inactive styling on Mesa de Trabajo link (which is the first child of the submenu container)
				const submenu = document.getElementById('tab-admin').parentElement;
				submenu.children[0].className = "pb-3 border-b-2 border-transparent text-slate-300 hover:text-white transition-all";
				
				loadPersonal();
				loadFiltros();
			});

			// Auto-open admin if URL hash is #admin
			if (window.location.hash === '#admin') {
				document.getElementById('tab-admin')?.click();
			}

			// If URL contains tab=admin query parameter, auto activate admin tab
			if (new URLSearchParams(window.location.search).get('tab') === 'admin') {
				setTimeout(() => {
					document.getElementById('tab-admin')?.click();
				}, 100);
			}

			document.getElementById('btn-refresh-personal')?.addEventListener('click', loadPersonal);

			// Edit modal events
			const closeEditModal = () => document.getElementById('modal-edit-personal').classList.add('hidden');
			document.getElementById('btn-close-edit-modal')?.addEventListener('click', closeEditModal);
			document.getElementById('btn-cancel-edit')?.addEventListener('click', closeEditModal);
			
			document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
				const id = document.getElementById('edit-id').value;
				const nombre_completo = document.getElementById('edit-name').value.trim();
				const rol = document.getElementById('edit-role').value;
				const tipo_solicitud = document.getElementById('edit-tipo-solicitud').value || null;
				const municipio = document.getElementById('edit-municipio').value || null;

				try {
					const res = await fetch(`${API_URL}/api/gestores/personal/${id}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ 
							nombre_completo, 
							rol, 
							director_email: gestorEmail,
							tipo_solicitud,
							municipio
						})
					});
					const json = await res.json();
					if (json.success) {
						window.showToast("Datos de funcionario actualizados", "success");
						closeEditModal();
						loadPersonal();
					} else {
						window.showToast(json.message || "Error al actualizar", "error");
					}
				} catch (err) {
					window.showToast("Error de red", "error");
				}
			});

			document.getElementById('form-register-gestor')?.addEventListener('submit', async (e) => {
				e.preventDefault();
				const email = document.getElementById('reg-email').value.trim();
				const password = document.getElementById('reg-pwd').value;
				const nombre_completo = document.getElementById('reg-name').value.trim();
				const rol = document.getElementById('reg-role').value;

				try {
					const res = await fetch(`${API_URL}/api/auth/registrar-gestor`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ 
							email, 
							password, 
							rol, 
							nombre_completo,
							director_email: gestorEmail // Validate authority
						})
					});
					const json = await res.json();
					if (json.success) {
						window.showToast("Cuenta de funcionario registrada exitosamente", "success");
						document.getElementById('form-register-gestor').reset();
						loadPersonal();
					} else {
						window.showToast(json.message || "Error al registrar la cuenta", "error");
					}
				} catch (err) {
					window.showToast("Error de conexión al servidor", "error");
				}
			});

		}
	