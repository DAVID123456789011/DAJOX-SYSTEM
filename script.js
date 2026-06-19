/* ==========================================================================
   DAJOX SYSTEM - CÓDIGO NÚCLEO PRINCIPAL CON SIMULADOR Y RENDIMIENTO GLOBAL
   ========================================================================== */
let appState = { user: null, clases: [] };

window.onload = function() {
    const session = localStorage.getItem("usuarioActual");
    if(!session) { window.location.href = "login.html"; return; }
    appState.user = JSON.parse(session);
    document.getElementById("lblUser").textContent = appState.user.email;
    document.getElementById("lblRol").textContent = appState.user.role;

    document.getElementById("btnOut").onclick = () => {
        localStorage.removeItem("usuarioActual");
        window.location.href = "login.html";
    };

    syncData();

    if(appState.user.role === "INSTRUCTOR") {
        document.getElementById("sectInstructor").classList.remove("hidden");
        initInstructor();
    } else {
        document.getElementById("sectMainAprendiz").classList.remove("hidden");
        initAprendiz();
    }
};

function syncData() {
    appState.clases = JSON.parse(localStorage.getItem("dajox_clases_v3")) || [];
}

function guardarDatos() {
    localStorage.setItem("dajox_clases_v3", JSON.stringify(appState.clases));
    syncData();
}

// --- LÓGICA DEL INSTRUCTOR ---
function initInstructor() {
    document.getElementById("btnCrearClase").onclick = () => {
        const nombre = document.getElementById("insNombre").value.trim();
        const ficha = document.getElementById("insFicha").value.trim();
        if(!nombre || !ficha) { return; }

        const nuevaClase = {
            id: "CLASE-" + Date.now(),
            nombre: nombre, ficha: ficha,
            codigo: "NX-" + Math.floor(1000 + Math.random() * 9000),
            instructor: appState.user.email,
            estudiantes: [], preguntasCargadas: [], examenesCreadosEstructurados: [], answersLog: []
        };
        appState.clases.push(nuevaClase);
        guardarDatos();
        document.getElementById("insNombre").value = "";
        document.getElementById("insFicha").value = "";
        renderInstructorClases();
    };
    renderInstructorClases();
}

function renderInstructorClases() {
    syncData();
    const contenedor = document.getElementById("listaClasesInstructor");
    const filtradas = appState.clases.filter(c => c.instructor === appState.user.email);
    contenedor.innerHTML = "";
    
    filtradas.forEach(c => {
        const totalEstudiantes = c.estudiantes ? c.estudiantes.length : 0;
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                <h4 style="font-size:1.1rem; margin:0;">${c.nombre.toUpperCase()}</h4>
                <button class="btn-primary" style="background:var(--acento-rojo); padding:4px 10px; font-size:0.8rem;" onclick="eliminarClaseAmbiente('${c.id}')">🗑 Eliminar Ficha</button>
            </div>
            <p style="color:var(--texto-mutated || #a1a1aa); font-size:0.85rem; margin-bottom:4px;">Ficha Técnica: ${c.ficha}</p>
            <p style="color:var(--acento-morado); font-size:0.85rem; margin-bottom:4px; font-weight:600;">Aprendices Inscritos: ${totalEstudiantes}</p>
            <p style="color:var(--acento-verde); font-weight:700; font-size:0.95rem; margin-bottom:16px;">CÓDIGO DE ENLACE: ${c.codigo}</p>
            <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                <button class="btn-primary" style="background:var(--acento-azul); width:100%;" onclick="abrirMenuPreguntas('${c.id}')">1. Gestionar Banco Preguntas</button>
                <button class="btn-primary" style="background:var(--acento-morado); width:100%;" onclick="abrirMenuExamenes('${c.id}')">2. Publicar Nuevos Exámenes</button>
                <button class="btn-primary" style="background:#1e1b4b; color:#6366f1; border:1px solid #4338ca; width:100%;" onclick="verListaAlumnosDetallada('${c.id}')">👥 Ver Aprendices Unidos</button>
                <button class="btn-primary" style="background:#27272a; color:#fff; width:100%;" onclick="verPuntuacionesAlumnos('${c.id}')">3. Ver Puntuaciones de Alumnos</button>
                <button class="btn-primary" style="background:var(--acento-verde); color:#fff; width:100%;" onclick="verRendimientoGlobalAlumnos('${c.id}')">📊 Ver el Rendimiento Global de cada Aprendiz</button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

function eliminarClaseAmbiente(claseId) {
    if(confirm("¿Está completamente seguro de eliminar esta ficha de formación? Se borrarán de forma irreversible todos los registros de alumnos, notas y configuraciones del simulador.")) {
        syncData();
        appState.clases = appState.clases.filter(c => c.id !== claseId);
        guardarDatos();
        renderInstructorClases();
    }
}

function verListaAlumnosDetallada(claseId) {
    syncData();
    const clase = appState.clases.find(c => c.id === claseId);
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";

    let htmlAlumnos = "";
    if(!clase.estudiantes || clase.estudiantes.length === 0) {
        htmlAlumnos = "<p style='color:var(--texto-mutado); font-style:italic; text-align:center; padding:10px;'>No hay aprendices registrados en esta ficha todavía.</p>";
    } else {
        clase.estudiantes.forEach((estudianteEmail) => {
            const isOnline = (estudianteEmail === appState.user.email) || (Math.random() > 0.4); 
            const colorTexto = isOnline ? "#00f0ff" : "#a1a1aa";
            const estadoBadge = isOnline 
                ? `<span style="background:#00f0ff; width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:8px; box-shadow: 0 0 10px #00f0ff;"></span>Conectado` 
                : `<span style="background:#a1a1aa; width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:8px;"></span>Desconectado`;

            htmlAlumnos += `
                <div class="item-pregunta-banco" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid ${isOnline ? '#00f0ff' : '#27272a'}; padding:12px;">
                    <div style="flex:1;">
                        <p style="font-size:1rem; font-weight:600; color:${colorTexto};">
                            ${estudianteEmail}
                        </p>
                    </div>
                    <div style="font-size:0.8rem; color:${colorTexto}; font-weight:500; display:flex; align-items:center;">
                        ${estadoBadge}
                    </div>
                </div>
            `;
        });
    }

    modal.innerHTML = `
        <div class="pestana-contenido" style="max-width:520px;">
            <div class="pestana-header">
                <h3>Control de Asistencia y Aprendices Unidos</h3>
                <button class="btn-cerrar-flotante" onclick="cerrarPestanaFlotante()">×</button>
            </div>
            <p style="font-size:0.85rem; color:var(--texto-mutado); margin-bottom:15px;">Listado en tiempo real de los alumnos enlazados a la ficha.</p>
            <div class="pestana-scroll" style="display:flex; flex-direction:column; gap:8px;">
                ${htmlAlumnos}
            </div>
        </div>
    `;
}

function verPuntuacionesAlumnos(claseId) {
    syncData();
    const clase = appState.clases.find(c => c.id === claseId);
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";

    let vistasUnicas = {};
    if (clase.answersLog && clase.answersLog.length > 0) {
        clase.answersLog.forEach(log => {
            if (log.tipo === 'examen_total' || log.tipo === 'simulador') {
                const llave = `${log.alumno}-${log.idMeta}`;
                vistasUnicas[llave] = {
                    alumno: log.alumno,
                    enunciado: log.enunciado,
                    nota: log.nota,
                    idMeta: log.idMeta,
                    tipo: log.tipo
                };
            }
        });
    }

    let htmlLog = "";
    const evaluaciones = Object.values(vistasUnicas);

    if (evaluaciones.length === 0) {
        htmlLog = "<p style='color:var(--texto-mutated || #a1a1aa); font-style:italic; padding:10px; text-align:center;'>Ningún aprendiz ha enviado exámenes o simulaciones todavía.</p>";
    } else {
        evaluaciones.forEach(item => {
            htmlLog += `
                <div class="item-pregunta-banco" style="border-left:4px solid var(--acento-morado); margin-bottom:10px; cursor:pointer; padding:12px;" 
                     onclick="verDetalleRespuestasAprendiz('${claseId}', '${item.alumno}', '${item.idMeta}')">
                    <p style="font-size:0.85rem; color:var(--acento-azul);"><strong>Aprendiz: ${item.alumno}</strong></p>
                    <p style="margin-top:4px; font-weight:600;">📋 ${item.enunciado}</p>
                    <p style="font-size:0.9rem; margin-top:4px;">Puntuación Final: <strong style="color:var(--acento-verde);">${item.nota}%</strong></p>
                    <span style="font-size:0.75rem; color:var(--texto-mutated || #a1a1aa); text-decoration:underline;">Click para auditar aciertos, errores e imágenes de soporte</span>
                </div>
            `;
        });
    }

    modal.innerHTML = `
        <div class="pestana-contenido">
            <div class="pestana-header">
                <h3>Evaluaciones y Simulaciones Entregadas</h3>
                <button class="btn-cerrar-flotante" onclick="cerrarPestanaFlotante()">×</button>
            </div>
            <p style="font-size:0.85rem; color:var(--texto-mutated || #a1a1aa); margin-bottom:12px;">Seleccione un examen para auditar de forma compacta sus respuestas.</p>
            <div class="pestana-scroll">${htmlLog}</div>
        </div>
    `;
}

function verDetalleRespuestasAprendiz(claseId, alumnoEmail, metaId) {
    syncData();
    const clase = appState.clases.find(c => c.id === claseId);
    const modal = document.getElementById("contenedorPestanaFlotante");

    const detalles = (clase.answersLog || []).filter(log => log.alumno === alumnoEmail && log.idMeta === metaId && log.tipo === 'pregunta_examen_interna');
    const metaExamen = (clase.answersLog || []).find(log => log.alumno === alumnoEmail && log.idMeta === metaId && (log.tipo === 'examen_total' || log.tipo === 'simulador'));

    let htmlDetalles = `<h4 style="margin-bottom:4px; color:white;">Resumen Técnico de: ${alumnoEmail}</h4>`;
    htmlDetalles += `<p style="margin-bottom:15px; color:var(--acento-verde); font-weight:bold;">Calificación Consolidada: ${metaExamen ? metaExamen.nota : 0}%</p>`;

    if (detalles.length === 0 && metaExamen && metaExamen.tipo === 'simulador') {
        htmlDetalles += `<p style="color:var(--texto-mutated || #a1a1aa); font-style:italic;">Las métricas del simulador interactivo de ensamble se guardaron con éxito de forma directa.</p>`;
    } else {
        detalles.forEach((p, idx) => {
            const opcionCorrectaTexto = p.opciones && p.opciones[p.correcta] ? p.opciones[p.correcta] : "No definida";
            const opcionSeleccionadaTexto = p.opciones && p.opciones[p.seleccionada] ? p.opciones[p.seleccionada] : "No contestada";

            const esImgCorr = opcionCorrectaTexto.startsWith("http") || opcionCorrectaTexto.startsWith("data:image");
            const esImgSel = opcionSeleccionadaTexto.startsWith("http") || opcionSeleccionadaTexto.startsWith("data:image");

            htmlDetalles += `
                <div style="background:var(--bg-inputs); border:1px solid var(--borde); padding:12px; margin-bottom:10px; border-radius:6px;">
                    <p style="font-weight:600; font-size:0.9rem; color:white;">${idx + 1}. ¿${p.enunciado}</p>
                    
                    ${p.image ? `<img src="${p.image}" style="max-height:120px; display:block; margin:8px 0; border-radius:4px; border:1px solid #333;">` : ''}
                    
                    <p style="color:var(--acento-verde); font-size:0.85rem; margin-top:6px; font-weight:500;">
                        ✓ Respuesta Correcta: ${esImgCorr ? `<img src="${opcionCorrectaTexto}" style="max-height:50px; vertical-align:middle; margin-left:4px;">` : opcionCorrectaTexto}
                    </p>
                    ${!p.esCorrecto ? `
                        <p style="color:var(--acento-rojo); font-size:0.85rem; font-weight:500; margin-top:4px;">
                            ❌ Respuesta Elegida por Aprendiz: ${esImgSel ? `<img src="${opcionSeleccionadaTexto}" style="max-height:50px; vertical-align:middle; margin-left:4px;">` : opcionSeleccionadaTexto}
                        </p>
                    ` : ''}
                </div>
            `;
        });
    }

    modal.innerHTML = `
        <div class="pestana-contenido">
            <div class="pestana-header">
                <h3>Auditoría Detallada de Respuestas</h3>
                <button class="btn-primary" style="padding:4px 12px; font-size:0.8rem; background:#27272a;" onclick="verPuntuacionesAlumnos('${claseId}')">⬅ Volver</button>
            </div>
            <div class="pestana-scroll">${htmlDetalles}</div>
        </div>
    `;
}

function verRendimientoGlobalAlumnos(claseId) {
    syncData();
    const clase = appState.clases.find(c => c.id === claseId);
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";

    let htmlRendimiento = "";

    if (!clase.estudiantes || clase.estudiantes.length === 0) {
        htmlRendimiento = "<p style='color:var(--texto-mutated || #a1a1aa); text-align:center; padding:15px;'>No hay aprendices inscritos en esta ficha.</p>";
    } else {
        clase.estudiantes.forEach(alumno => {
            const respuestasAlumno = (clase.answersLog || []).filter(r => r.alumno === alumno && r.tipo !== 'pregunta_examen_interna');
            
            let totalNotas = 0;
            let itemsRespondidos = 0;
            
            respuestasAlumno.forEach(r => {
                totalNotas += r.nota;
                itemsRespondidos++;
            });

            const promedioGlobal = itemsRespondidos > 0 ? Math.round(totalNotas / itemsRespondidos) : 0;
            let barraColor = "var(--acento-rojo)";
            if(promedioGlobal >= 60) barraColor = "var(--acento-azul)";
            if(promedioGlobal >= 85) barraColor = "var(--acento-verde)";

            htmlRendimiento += `
                <div class="item-pregunta-banco" style="display:flex; flex-direction:column; gap:6px; padding:12px; border-left:4px solid ${barraColor};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:600; font-size:0.95rem; color:white;">${alumno}</span>
                        <span style="font-weight:700; color:${barraColor}">${promedioGlobal}%</span>
                    </div>
                    <div style="width:100%; background:#27272a; height:8px; border-radius:4px; overflow:hidden;">
                        <div style="width:${promedioGlobal}%; background:${barraColor}; height:100%;"></div>
                    </div>
                    <p style="font-size:0.75rem; color:var(--texto-mutated || #a1a1aa);">Entregas evaluadas por el sistema: ${itemsRespondidos}</p>
                </div>
            `;
        });
    }

    modal.innerHTML = `
        <div class="pestana-contenido" style="max-width:550px;">
            <div class="pestana-header">
                <h3>Rendimiento Global Consolidado</h3>
                <button class="btn-cerrar-flotante" onclick="cerrarPestanaFlotante()">×</button>
            </div>
            <p style="font-size:0.85rem; color:var(--texto-mutated || #a1a1aa); margin-bottom:15px;">Promedio general en tiempo real calculado sobre todas las entregas guardadas en la ficha.</p>
            <div class="pestana-scroll" style="display:flex; flex-direction:column; gap:10px;">
                ${htmlRendimiento}
            </div>
        </div>
    `;
}

function abrirMenuPreguntas(claseId) {
    syncData();
    const clase = appState.clases.find(c => c.id === claseId);
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";
    
    let htmlPreguntas = "";
    
    if(!clase.preguntasCargadas || clase.preguntasCargadas.length === 0) {
        htmlPreguntas = "<p style='color:var(--texto-mutated || #a1a1aa); text-align:center; padding:20px; font-style:italic;'>No hay preguntas cargadas en esta ficha todavía. Use las opciones superiores.</p>";
    } else {
        clase.preguntasCargadas.forEach((p, index) => {
            htmlPreguntas += `
                <div class="item-pregunta-banco" style="margin-bottom:15px; background:var(--bg-inputs); padding:15px; border-radius:8px; border:1px solid var(--borde);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                        <p style="margin:0; font-weight:600;"><strong>${index + 1}. ¿${p.pregunta}</strong></p>
                        <button class="btn-primary" style="background:var(--acento-rojo); padding:2px 8px; font-size:0.75rem;" onclick="eliminarPreguntaIndividualFicha('${claseId}', '${p.id}')">🗑 Borrar</button>
                    </div>
                    ${p.image ? `<img src="${p.image}" style="max-height:100px; display:block; margin:6px 0; border-radius:4px;">` : ''}
                    ${p.opciones.map((op, opIdx) => `
                        <div class="opcion-verificacion ${opIdx === p.correcta ? 'opcion-correcta' : 'opcion-neutra'}" style="margin-top:4px; font-size:0.85rem; padding:6px 10px;">
                            ${String.fromCharCode(65 + opIdx)}. ${op}
                        </div>
                    `).join('')}
                </div>
            `;
        });
    }

    let htmlCargaSueltas = `<h4 style="margin:15px 0 10px 0; color:white; font-size:0.95rem;">Inyección Rápida desde Banco Predeterminado:</h4><div style="display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto; border:1px solid var(--borde); padding:8px; border-radius:6px; background:#18181b;">`;
    bancoPredeterminado30.forEach((p) => {
        const yaCargada = clase.preguntasCargadas.some(pc => String(pc.id) === String(p.id) || pc.pregunta === p.pregunta);
        htmlCargaSueltas += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#27272a; padding:6px 10px; border-radius:4px; font-size:0.8rem;">
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70%; color:#e4e4e7;">¿${p.pregunta}</span>
                <button class="btn-primary" style="padding:2px 6px; font-size:0.75rem; background:${yaCargada ? '#3f3f46' : 'var(--acento-azul)'};" ${yaCargada ? 'disabled' : ''} onclick="cargarPreguntaIndividual('${claseId}', ${p.id})">
                    ${yaCargada ? 'Inyectada' : '+ Cargar'}
                </button>
            </div>
        `;
    });
    htmlCargaSueltas += `</div>`;

    modal.innerHTML = `
        <div class="pestana-contenido" style="max-width:650px;">
            <div class="pestana-header">
                <h3>Gestión y Carga Asistida de Preguntas</h3>
                <button class="btn-cerrar-flotante" onclick="cerrarPestanaFlotante()">×</button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <button class="btn-primary" style="background:var(--acento-verde); font-size:0.85rem;" onclick="cargarTodoElBanco('${claseId}')">Cargar las 30 Predeterminadas</button>
                <button class="btn-primary" style="font-size:0.85rem;" onclick="abrirCreadorPreguntaPropia('${claseId}')">+ Diseñar Pregunta Instructor</button>
            </div>
            ${htmlCargaSueltas}
            <h4 style="margin:20px 0 10px 0; color:white; font-size:0.95rem; border-bottom:1px solid var(--borde); padding-bottom:4px;">Preguntas Vigentes en la Ficha (${clase.preguntasCargadas.length})</h4>
            <div class="pestana-scroll" style="max-height:350px;">
                ${htmlPreguntas}
            </div>
        </div>
    `;
}

function eliminarPreguntaIndividualFicha(claseId, pregId) {
    syncData();
    let clase = appState.clases.find(c => c.id === claseId);
    if (clase) {
        clase.preguntasCargadas = clase.preguntasCargadas.filter(p => String(p.id) !== String(pregId));
        guardarDatos();
        abrirMenuPreguntas(claseId);
    }
}

function cargarPreguntaIndividual(claseId, pregId) {
    syncData();
    let clase = appState.clases.find(c => c.id === claseId);
    if(clase.preguntasCargadas.some(p => String(p.id) === String(pregId))) return;
    const original = bancoPredeterminado30.find(p => String(p.id) === String(pregId));
    clase.preguntasCargadas.push({...original});
    guardarDatos();
    abrirMenuPreguntas(claseId);
}

function cargarTodoElBanco(claseId) {
    syncData();
    let clase = appState.clases.find(c => c.id === claseId);
    clase.preguntasCargadas = [...bancoPredeterminado30];
    guardarDatos();
    alert("Banco completo inyectado en este ambiente virtual.");
    abrirMenuPreguntas(claseId);
}

function abrirCreadorPreguntaPropia(claseId) {
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.innerHTML = `
        <div class="pestana-contenido" style="max-width:580px;">
            <div class="pestana-header">
                <h3>Generar Pregunta Personalizada</h3>
                <button class="btn-cerrar-flotante" onclick="abrirMenuPreguntas('${claseId}')">×</button>
            </div>
            <div class="pestana-scroll">
                <label style="font-weight:600; font-size:0.85rem; color:var(--texto-mutated || #a1a1aa)">Enunciado:</label>
                <input type="text" id="cpEnunciado" class="input-dajox" style="margin:6px 0 14px 0;" placeholder="Escriba la pregunta aquí...">
                
                <label style="font-weight:600; font-size:0.85rem; color:var(--texto-mutated || #a1a1aa)">Respuestas Múltiples (Marque el círculo de la correcta):</label>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;" id="contenedorOpcionesCustom">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="radio" name="cpCorrecta" value="0" checked>
                        <input type="text" class="input-dajox clsOpDinamica" placeholder="Opción A">
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="radio" name="cpCorrecta" value="1">
                        <input type="text" class="input-dajox clsOpDinamica" placeholder="Opción B">
                    </div>
                </div>
                <button class="btn-primary" style="background:#27272a; margin-top:10px; padding:6px 12px; font-size:0.8rem;" onclick="anadirNuevaOpcionAlFormulario('contenedorOpcionesCustom', 'cpCorrecta')">+ Añadir Opción</button>
                
                <div style="margin-top:20px; padding-top:12px; border-top:1px solid var(--borde);">
                    <label style="font-weight:600; font-size:0.85rem; color:var(--texto-mutated || #a1a1aa)">Imagen de Apoyo Temático (URL u Hoja Local):</label>
                    <div style="display:flex; gap:10px; margin-top:6px;">
                        <input type="text" id="cpImgUrl" class="input-dajox" placeholder="Pegar enlace HTTP / HTTPS...">
                        <input type="file" id="cpFile" accept="image/*" onchange="procesarImagenHibrida(this, 'cpImgUrl', 'cpPrevia')" style="display:none;">
                        <button class="btn-primary" onclick="document.getElementById('cpFile').click()">Subir Archivo</button>
                    </div>
                    <img id="cpPrevia" class="img-preview hidden" style="margin-top:10px; max-height:140px;">
                </div>
                
                <button class="btn-primary" style="width:100%; margin-top:25px; background:var(--acento-verde);" onclick="guardarPreguntaCreadaInstructor('${claseId}')">Publicar Pregunta en la Ficha</button>
            </div>
        </div>
    `;

    document.getElementById("cpImgUrl").addEventListener("input", (e) => {
        const img = document.getElementById("cpPrevia");
        if(e.target.value.trim()) {
            img.src = e.target.value.trim();
            img.classList.remove("hidden");
        }
    });
}

function anadirNuevaOpcionAlFormulario(contenedorId, radioName) {
    const contenedor = document.getElementById(contenedorId);
    const total = contenedor.querySelectorAll('input[type="radio"]').length;
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "10px";
    div.innerHTML = `
        <input type="radio" name="${radioName}" value="${total}">
        <input type="text" class="input-dajox clsOpDinamica" placeholder="Opción ${String.fromCharCode(65+total)}">
    `;
    contenedor.appendChild(div);
}

function procesarImagenHibrida(fileInput, urlInputId, previewImgId) {
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(urlInputId).value = e.target.result;
            const preview = document.getElementById(previewImgId);
            if(preview) {
                preview.src = e.target.result;
                preview.classList.remove("hidden");
                preview.style.display = "block";
            }
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
}

function guardarPreguntaCreadaInstructor(claseId) {
    const enun = document.getElementById("cpEnunciado").value.trim();
    const ops = Array.from(document.querySelectorAll(".clsOpDinamica")).map(i => i.value.trim()).filter(Boolean);
    const corr = parseInt(document.querySelector('input[name="cpCorrecta"]:checked').value);
    const imgSource = document.getElementById("cpImgUrl").value.trim();

    if(!enun || ops.length < 2) { return; }

    syncData();
    let clase = appState.clases.find(c => c.id === claseId);
    clase.preguntasCargadas.push({
        id: "PREG-" + Date.now(),
        pregunta: enun,
        opciones: ops,
        correcta: corr,
        image: imgSource
    });
    guardarDatos();
    alert("Pregunta de diseño propio publicada con éxito.");
    abrirMenuPreguntas(claseId);
}

function abrirMenuExamenes(claseId) {
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";
    modal.innerHTML = `
        <div class="pestana-contenido" style="max-width:480px;">
            <div class="pestana-header">
                <h3>Módulo de Publicación de Evaluaciones</h3>
                <button class="btn-cerrar-flotante" onclick="cerrarPestanaFlotante()">×</button>
            </div>
            <p style="font-size:0.85rem; color:var(--texto-mutated || #a1a1aa); margin-bottom:20px;">Establezca la modalidad del instrumento evaluativo para la ficha activa.</p>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <button class="opcion-pestana" onclick="disenarExamenEstructuradoDinamico('${claseId}', 'multiple')">📝 Crear Examen Teórico (Opción Múltiple)</button>
                <button class="opcion-pestana" onclick="disenarExamenEstructuradoDinamico('${claseId}', 'imagen')">🖼 Crear Examen con Imágenes en Opciones</button>
                <button class="opcion-pestana" style="background:#1e1b4b; border-color:#4338ca;" onclick="disenarSimuladorEnsambleCoordenadas('${claseId}')">🧩 Configurar Simulador por Puntos de Ensamble</button>
            </div>
        </div>
    `;
}

let examenBorradorPreguntas = [];
function disenarExamenEstructuradoDinamico(claseId, tipo) {
    examenBorradorPreguntas = [];
    desplegarCreadorPreguntaExamenEstructurado(claseId, tipo);
}

function desplegarCreadorPreguntaExamenEstructurado(claseId, tipo) {
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";

    let constructorOpciones = "";
    if (tipo === 'multiple') {
        constructorOpciones = `
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;" id="boxExOpciones">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="radio" name="exCorrecta" value="0" checked>
                    <input type="text" class="input-dajox clsExOp" placeholder="Opción A">
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="radio" name="exCorrecta" value="1">
                    <input type="text" class="input-dajox clsExOp" placeholder="Opción B">
                </div>
            </div>
        `;
    } else {
        constructorOpciones = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:8px;" id="boxExOpciones">
                <div style="background:var(--bg-inputs); padding:10px; border-radius:6px; border:1px solid var(--borde);">
                    <label style="font-size:0.8rem; font-weight:600;"><input type="radio" name="exCorrecta" value="0" checked> Opción A (Imagen):</label>
                    <input type="text" id="url_op_0" class="input-dajox clsExOp" style="margin-top:5px;" placeholder="Texto u URL de imagen" oninput="escucharEntradaUrlImagenOpcion(this, 0)">
                    <input type="file" onchange="convertirArchivoImagenOpcionExamen(this, 0)" style="margin-top:4px; font-size:0.8rem;" accept="image/*">
                    <img id="previo_op_0" style="max-height:80px; margin-top:8px; border-radius:4px; display:none;">
                </div>
                <div style="background:var(--bg-inputs); padding:10px; border-radius:6px; border:1px solid var(--borde);">
                    <label style="font-size:0.8rem; font-weight:600;"><input type="radio" name="exCorrecta" value="1"> Opción B (Imagen):</label>
                    <input type="text" id="url_op_1" class="input-dajox clsExOp" style="margin-top:5px;" placeholder="Texto u URL de imagen" oninput="escucharEntradaUrlImagenOpcion(this, 1)">
                    <input type="file" onchange="convertirArchivoImagenOpcionExamen(this, 1)" style="margin-top:4px; font-size:0.8rem;" accept="image/*">
                    <img id="previo_op_1" style="max-height:80px; margin-top:8px; border-radius:4px; display:none;">
                </div>
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="pestana-contenido" style="max-width:680px;">
            <div class="pestana-header">
                <h3>Pregunta N° ${examenBorradorPreguntas.length + 1} (${tipo.toUpperCase()})</h3>
                <button class="btn-cerrar-flotante" onclick="abrirMenuExamenes('${claseId}')">×</button>
            </div>
            <div class="pestana-scroll">
                <p style="font-size:0.85rem; color:var(--acento-morado); margin-bottom:12px; font-weight:600;">Preguntas acumuladas en el borrador: ${examenBorradorPreguntas.length}</p>
                
                <label style="font-weight:600; font-size:0.85rem;">Enunciado del Reactivo:</label>
                <input type="text" id="exEnunciado" class="input-dajox" style="margin:5px 0 15px 0;" placeholder="Escriba el enunciado...">

                <label style="font-weight:600; font-size:0.85rem;">Configuración de Opciones y Clave de Respuesta:</label>
                ${constructorOpciones}
                
                <button class="btn-primary" style="background:#27272a; margin-top:10px; padding:6px 12px; font-size:0.8rem;" onclick="anadirOpcionDinamicaExamen('${tipo}')">+ Añadir Opción de Respuesta</button>

                <div style="margin-top:15px; padding-top:12px; border-top:1px solid var(--borde);">
                    <label style="font-weight:600; font-size:0.85rem;">Imagen de Soporte General (Opcional):</label>
                    <div style="display:flex; gap:10px; margin-top:5px;">
                        <input type="text" id="exImgUrl" class="input-dajox" placeholder="Pegar enlace URL...">
                        <input type="file" id="exFile" accept="image/*" onchange="procesarImagenHibrida(this, 'exImgUrl', 'exPrevia')" style="display:none;">
                        <button class="btn-primary" onclick="document.getElementById('exFile').click()">Examinar</button>
                    </div>
                    <img id="exPrevia" class="img-preview hidden">
                </div>

                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn-primary" style="flex:1;" onclick="salvarPreguntaAlBorrador('${claseId}', '${tipo}')">Guardar e Ir a Siguiente Pregunta</button>
                    <button class="btn-primary" style="background:var(--acento-verde);" onclick="publicarExamenDefinitivo('${claseId}', '${tipo}')">Finalizar y Publicar Examen Completo</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('exImgUrl').addEventListener('input', (e) => {
        const img = document.getElementById("exPrevia");
        if(e.target.value.trim()) {
            img.src = e.target.value.trim();
            img.classList.remove("hidden");
        }
    });
}

function escucharEntradaUrlImagenOpcion(input, index) {
    const img = document.getElementById(`previo_op_${index}`);
    if (input.value.trim().startsWith("http") || input.value.trim().startsWith("data:image")) {
        img.src = input.value.trim();
        img.style.display = "block";
    } else {
        img.style.display = "none";
    }
}

function convertirArchivoImagenOpcionExamen(fileInput, index) {
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const inputs = document.querySelectorAll(".clsExOp");
            if(inputs[index]) inputs[index].value = e.target.result;
            const img = document.getElementById(`previo_op_${index}`);
            if(img) {
                img.src = e.target.result;
                img.style.display = "block";
            }
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
}

function anadirOpcionDinamicaExamen(tipo) {
    const box = document.getElementById("boxExOpciones");
    const total = box.querySelectorAll('input[type="radio"]').length;

    if (tipo === 'multiple') {
        const div = document.createElement("div");
        div.style = "display:flex; align-items:center; gap:10px;";
        div.innerHTML = `
            <input type="radio" name="exCorrecta" value="${total}">
            <input type="text" class="input-dajox clsExOp" placeholder="Opción ${String.fromCharCode(65 + total)}">
        `;
        box.appendChild(div);
    } else {
        const div = document.createElement("div");
        div.style = "background:var(--bg-inputs); padding:10px; border-radius:6px; border:1px solid var(--borde);";
        div.innerHTML = `
            <label style="font-size:0.8rem; font-weight:600;"><input type="radio" name="exCorrecta" value="${total}"> Opción ${String.fromCharCode(65 + total)} (Imagen):</label>
            <input type="text" id="url_op_${total}" class="input-dajox clsExOp" style="margin-top:5px;" placeholder="Texto u URL" oninput="escucharEntradaUrlImagenOpcion(this, ${total})">
            <input type="file" onchange="convertirArchivoImagenOpcionExamen(this, ${total})" style="margin-top:4px; font-size:0.8rem;" accept="image/*">
            <img id="previo_op_${total}" style="max-height:80px; margin-top:8px; border-radius:4px; display:none;">
        `;
        box.appendChild(div);
    }
}

function salvarPreguntaAlBorrador(claseId, tipo) {
    const enunciado = document.getElementById("exEnunciado").value.trim();
    const opciones = Array.from(document.querySelectorAll(".clsExOp")).map(i => i.value.trim()).filter(Boolean);
    const radioSelected = document.querySelector('input[name="exCorrecta"]:checked');

    if (!enunciado || opciones.length < 2 || !radioSelected) {
        alert("Complete el enunciado y al menos dos opciones válidas.");
        return;
    }

    const correctaIndex = parseInt(radioSelected.value);
    const imgG = document.getElementById("exImgUrl").value.trim();

    examenBorradorPreguntas.push({
        id: "STRUCT-" + Date.now() + Math.floor(Math.random()*100),
        pregunta: enunciado,
        opciones: opciones,
        correcta: correctaIndex,
        image: imgG
    });

    alert("Pregunta añadida al borrador con éxito.");
    desplegarCreadorPreguntaExamenEstructurado(claseId, tipo);
}

function populateDefaultExamenPreguntasIfEmpty(claseId, tipo) {
    if (examenBorradorPreguntas.length === 0) {
        examenBorradorPreguntas = bancoPredeterminado30.slice(0, 5).map((p, idx) => ({
            id: "STRUCT-AUTO-" + Date.now() + idx,
            pregunta: p.pregunta,
            opciones: [...p.opciones],
            correcta: p.correcta,
            image: p.image || ""
        }));
    }
}

function publicarExamenDefinitivo(claseId, tipo) {
    const enunciado = document.getElementById("exEnunciado").value.trim();
    const opciones = Array.from(document.querySelectorAll(".clsExOp")).map(i => i.value.trim()).filter(Boolean);
    const radioSelected = document.querySelector('input[name="exCorrecta"]:checked');

    if (enunciado && opciones.length >= 2 && radioSelected) {
        const correctaIndex = parseInt(radioSelected.value);
        const imgG = document.getElementById("exImgUrl").value.trim();
        examenBorradorPreguntas.push({
            id: "STRUCT-" + Date.now() + Math.floor(Math.random()*100),
            pregunta: enunciado,
            opciones: opciones,
            correcta: correctaIndex,
            image: imgG
        });
    }

    populateDefaultExamenPreguntasIfEmpty(claseId, tipo);

    syncData();
    let clase = appState.clases.find(c => c.id === claseId);
    if(!clase.examenesCreadosEstructurados) clase.examenesCreadosEstructurados = [];
    
    clase.examenesCreadosEstructurados.push({
        idExamen: "EXAMEN-" + Date.now(),
        tipo: tipo,
        preguntas: [...examenBorradorPreguntas]
    });

    guardarDatos();
    examenBorradorPreguntas = [];
    alert("Examen Estructurado creado con éxito para los aprendices matriculados.");
    cerrarPestanaFlotante();
}

let simuladorPuntosBorrador = [];
function disenarSimuladorEnsambleCoordenadas(claseId) {
    simuladorPuntosBorrador = [];
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";
    modal.innerHTML = `
        <div class="pestana-contenido" style="max-width:950px; width:95%;">
            <div class="pestana-header">
                <h3>Diseño del Simulador de Ensamble por Puntos</h3>
                <button class="btn-cerrar-flotante" onclick="abrirMenuExamenes('${claseId}')">×</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 280px; gap: 20px; overflow: hidden; flex: 1;">
                <div class="pestana-scroll">
                    <label style="font-weight:600; font-size:0.85rem;">Objetivo de la Simulación:</label>
                    <input type="text" id="simObjetivo" placeholder="Ej: Ubicar de forma precisa los componentes de la Board..." class="input-dajox" style="margin:5px 0 15px 0;">
                    
                    <label style="font-weight:600; font-size:0.85rem;">Imagen Base del Simulador:</label>
                    <div style="display:flex; gap:10px; margin:5px 0 15px 0;">
                        <input type="text" id="simImgUrl" class="input-dajox" placeholder="URL de la imagen...">
                        <input type="file" id="simFile" accept="image/*" onchange="procesarImagenHibrida(this, 'simImgUrl', 'imgMapeoBase')" style="display:none;">
                        <button class="btn-primary" onclick="document.getElementById('simFile').click()">Examinar</button>
                    </div>

                    <div id="wrapperMapaMapeo" style="position:relative; display:inline-block; border:2px dashed #444; border-radius:8px; overflow:hidden; background:#121214; cursor:crosshair;">
                        <img id="imgMapeoBase" style="max-width:100%; display:block; min-height:200px; background:#1c1c21;" onclick="registrarCoordenadaPuntoSimulador(event)">
                    </div>
                    <p style="font-size:0.8rem; color:var(--texto-mutated || #a1a1aa); margin-top:6px;">💡 Haga clic sobre la imagen cargada para trazar una coordenada exacta de soltado.</p>
                </div>

                <div style="border-left: 1px solid var(--borde); padding-left: 15px; display: flex; flex-direction: column; overflow: hidden;">
                    <h4 style="font-size:0.9rem; margin-bottom:10px; color:white;">Puntos de Anclaje Registrados</h4>
                    <div id="listaPuntosMapeados" style="display:flex; flex-direction:column; gap:8px; flex:1; overflow-y:auto; padding-right:4px;"></div>
                    <button class="btn-primary" style="width:100%; margin-top:15px; background:var(--acento-verde);" onclick="publicarSimuladorMapeado('${claseId}')">Publicar Simulador por Puntos</button>
                </div>
            </div>
        </div>
    `;
}

function registrarCoordenadaPuntoSimulador(e) {
    const rect = e.target.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const respuesta = prompt("Escriba el nombre técnico exacto del componente o pegue la DataURL/URL de la imagen que calza en este punto:");
    if(!respuesta) return;

    simuladorPuntosBorrador.push({
        x: xPct,
        y: yPct,
        respuestaCorrecta: respuesta.trim()
    });

    const wrapper = document.getElementById("wrapperMapaMapeo");
    const div = document.createElement("div");
    div.className = "punto-referencia";
    div.style = `position:absolute; top:${yPct}%; left:${xPct}%; width:16px; height:16px; background:var(--acento-morado); border:2px solid white; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none; box-shadow:0 0 8px var(--acento-morado);`;
    wrapper.appendChild(div);

    renderizarListaPuntosMapeados();
}

function renderizarListaPuntosMapeados() {
    const contenedor = document.getElementById("listaPuntosMapeados");
    contenedor.innerHTML = "";

    simuladorPuntosBorrador.forEach((p, idx) => {
        const item = document.createElement("div");
        item.style = "background: #1c1c21; border: 1px solid var(--borde); padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; gap: 10px;";
        
        const esImagen = p.respuestaCorrecta.startsWith("http") || p.respuestaCorrecta.startsWith("data:image");
        const contenidoRespuesta = esImagen 
            ? `<img src="${p.respuestaCorrecta}" style="max-height: 45px; max-width: 110px; object-fit: contain; border-radius: 4px; border: 1px solid var(--borde);">` 
            : `<span style="color: white; font-weight: 500;">${p.respuestaCorrecta}</span>`;

        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; overflow: hidden;">
                <span style="background: var(--acento-morado); color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; flex-shrink: 0;">${idx + 1}</span>
                <div style="flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${contenidoRespuesta}
                </div>
            </div>
            <button class="btn-primary" style="background: var(--acento-rojo); padding: 2px 6px; font-size: 0.75rem; flex-shrink: 0;" onclick="removerPuntoSimuladorBorrador(${idx})">×</button>
        `;
        contenedor.appendChild(item);
    });
}

function removerPuntoSimuladorBorrador(index) {
    simuladorPuntosBorrador.splice(index, 1);
    const wrapper = document.getElementById("wrapperMapaMapeo");
    const puntosGraficos = wrapper.querySelectorAll(".punto-referencia");
    puntosGraficos.forEach(p => p.remove());

    simuladorPuntosBorrador.forEach((p) => {
        const div = document.createElement("div");
        div.className = "punto-referencia";
        div.style = `position:absolute; top:${p.y}%; left:${p.x}%; width:16px; height:16px; background:var(--acento-morado); border:2px solid white; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none;`;
        wrapper.appendChild(div);
    });
    renderizarListaPuntosMapeados();
}

function publicarSimuladorMapeado(claseId) {
    const obj = document.getElementById("simObjetivo").value.trim();
    const mapaImg = document.getElementById("simImgUrl").value.trim();

    if(!obj || !mapaImg || simuladorPuntosBorrador.length === 0) {
        alert("Escriba el objetivo, cargue la imagen de fondo y trace al menos una coordenada.");
        return;
    }

    syncData();
    let clase = appState.clases.find(c => c.id === claseId);
    if(!clase.examenesCreadosEstructurados) clase.examenesCreadosEstructurados = [];

    clase.examenesCreadosEstructurados.push({
        idExamen: "EXAMEN-" + Date.now(),
        tipo: "simulador_mapeado",
        objetivo: obj,
        imagenFondo: mapaImg,
        puntos: [...simuladorPuntosBorrador]
    });

    guardarDatos();
    alert("¡Simulador interactivo por puntos publicado con éxito!");
    cerrarPestanaFlotante();
}

// --- LÓGICA DEL APRENDIZ ---
function initAprendiz() {
    document.getElementById("btnUnirse").onclick = () => {
        const codigo = document.getElementById("apCodigo").value.trim();
        if(!codigo) return;

        syncData();
        let clase = appState.clases.find(c => c.codigo === codigo);
        if(!clase) {
            alert("Código inválido. No coincide con ningún ambiente autorizado.");
            return;
        }

        if(!clase.estudiantes) clase.estudiantes = [];
        if(!clase.estudiantes.includes(appState.user.email)) {
            clase.estudiantes.push(appState.user.email);
            guardarDatos();
            alert(`Vinculación exitosa a la ficha: ${clase.nombre}`);
        } else {
            alert("Ya te encuentras vinculado a este ambiente virtual de formación.");
        }
        document.getElementById("apCodigo").value = "";
        renderAprendizClases();
    };
    renderAprendizClases();
}

function renderAprendizClases() {
    syncData();
    const contenedor = document.getElementById("listaClasesAprendiz");
    contenedor.innerHTML = "";

    const vinculadas = appState.clases.filter(c => c.estudiantes && c.estudiantes.includes(appState.user.email));

    vinculadas.forEach(c => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
            <h4 style="font-size:1.1rem; margin-bottom:4px;">${c.nombre.toUpperCase()}</h4>
            <p style="color:var(--texto-mutated || #a1a1aa); font-size:0.85rem; margin-bottom:16px;">Instructor: ${c.instructor}</p>
            <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                <button class="btn-primary" style="width:100%; text-align:center;" onclick="abrirMenuEvaluacionesAprendiz('${c.id}')">📋 Rendir Evaluaciones</button>
                <button class="btn-primary" style="background:#27272a; width:100%; text-align:center;" onclick="abrirHistorialClinicoNotas('${c.id}')">📊 Ver Mi Historial Clínico</button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

function abrirMenuEvaluacionesAprendiz(claseId) {
    syncData();
    const clase = appState.clases.find(c => c.id === claseId);
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";

    const respondidas = (clase.answersLog || []).filter(r => r.alumno === appState.user.email && r.tipo === 'pregunta_suelta').map(r => r.idMeta);
    const pendientes = clase.preguntasCargadas.filter(p => !respondidas.includes(p.id));

    let htmlBotes = "";
    if (pendientes.length > 0) {
        htmlBotes += `<button class="opcion-pestana" onclick="presentarPreguntasSueltasAprendiz('${claseId}')">🔥 Resolver Banco de Preguntas Sueltas (${pendientes.length} Disponibles)</button>`;
    }

    if (clase.examenesCreadosEstructurados && clase.examenesCreadosEstructurados.length > 0) {
        clase.examenesCreadosEstructurados.forEach((ex, index) => {
            const yaHecho = (clase.answersLog || []).some(r => r.alumno === appState.user.email && r.idMeta === ex.idExamen);
            if (!yaHecho) {
                if (ex.tipo === 'simulador_mapeado') {
                    htmlBotes += `<button class="opcion-pestana" style="background:#1e1b4b; border-color:#4338ca; margin-top:8px;" onclick="window.location.href='simuladorMapeado.html?claseId=${claseId}&examId=${ex.idExamen}'">🧩 Ejecutar Simulador Técnico Estructurado N° ${index + 1}</button>`;
                } else {
                    htmlBotes += `<button class="opcion-pestana" style="background:var(--acento-morado); border-color:#6d28d9; margin-top:8px;" onclick="presentarExamenFlotanteAprendiz('${claseId}', '${ex.idExamen}')">📝 Presentar Evaluación Modular N° ${index + 1} (${ex.tipo.toUpperCase()})</button>`;
                }
            }
        });
    } else {
        const yaPracticadoGuiado = (clase.answersLog || []).some(r => r.alumno === appState.user.email && r.idMeta === 'simulador-guiado-completo');
        if(!yaPracticadoGuiado) {
            htmlBotes += `<button class="opcion-pestana" style="background:#1e1b4b; border-color:#4338ca; margin-top:8px;" onclick="window.location.href='simulacion.html?claseId=${claseId}'">🔧 Ejecutar Laboratorio Práctico de Ensamble</button>`;
        }
    }

    if(htmlBotes === "") {
        htmlBotes = "<p style='color:var(--texto-mutated || #a1a1aa); text-align:center; padding:15px;'>No posees exámenes o simulaciones agendadas en este ambiente.</p>";
    }

    modal.innerHTML = `
        <div class="pestana-contenido">
            <div class="pestana-header">
                <h3>Evaluaciones de Rendimiento Modular</h3>
                <button class="btn-cerrar-flotante" onclick="cerrarPestanaFlotante()">×</button>
            </div>
            <div class="pestana-scroll" style="margin-top:15px;">${htmlBotes}</div>
        </div>
    `;
}

function presentarPreguntasSueltasAprendiz(claseId) {
    syncData();
    const clase = appState.clases.find(c => c.id === claseId);
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";

    const respondidas = (clase.answersLog || []).filter(r => r.alumno === appState.user.email && r.tipo === 'pregunta_suelta').map(r => r.idMeta);
    const pendientes = clase.preguntasCargadas.filter(p => !respondidas.includes(p.id));

    let htmlContenido = "";
    if(pendientes.length === 0) {
        htmlContenido = "<p style='color:var(--acento-verde); font-weight:bold;'>🎉 ¡Has completado todas las preguntas sueltas asignadas!</p>";
    } else {
        pendientes.forEach(p => {
            htmlContenido += `
                <div class="item-pregunta-banco">
                    <p style="font-weight:600; margin-bottom:10px;">¿${p.pregunta}</p>
                    ${p.image ? `<img src="${p.image}" style="max-height:160px; border-radius:6px; display:block; margin-bottom:12px;">` : ''}
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${p.opciones.map((op, oIdx) => `
                            <button class="btn-primary" style="background:var(--bg-inputs); border:1px solid var(--borde); text-align:left; justify-content:flex-start;" 
                                    onclick="guardarRespuestaSueltaAprendiz('${claseId}', '${p.id}', ${oIdx})">
                                ${String.fromCharCode(65 + oIdx)}. ${op}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        });
    }

    modal.innerHTML = `
        <div class="pestana-contenido">
            <div class="pestana-header">
                <h3>Preguntas Técnicas Disponibles</h3>
                <button class="btn-cerrar-flotante" onclick="cerrarPestanaFlotante()">×</button>
            </div>
            <div class="pestana-scroll">${htmlContenido}</div>
        </div>
    `;
}

function guardarRespuestaSueltaAprendiz(claseId, preguntaId, opcionSeleccionada) {
    syncData();
    let clases = JSON.parse(localStorage.getItem("dajox_clases_v3")) || [];
    let cIdx = clases.findIndex(c => c.id === claseId);

    if (cIdx !== -1) {
        const pOriginal = clases[cIdx].preguntasCargadas.find(p => String(p.id) === String(preguntaId));
        const acierto = (pOriginal.correcta === opcionSeleccionada);

        if(!clases[cIdx].answersLog) clases[cIdx].answersLog = [];

        clases[cIdx].answersLog.push({
            alumno: appState.user.email,
            tipo: 'pregunta_suelta',
            idMeta: preguntaId,
            enunciado: pOriginal.pregunta,
            nota: acierto ? 100 : 0,
            esCorrecto: acierto,
            timestamp: Date.now()
        });

        localStorage.setItem("dajox_clases_v3", JSON.stringify(clases));
        alert(acierto ? "¡Respuesta Correcta guardada!" : "Respuesta Guardada. Sigue practicando.");
        presentarPreguntasSueltasAprendiz(claseId);
    }
}

function presentarExamenFlotanteAprendiz(claseId, examId) {
    window.location.href = `quiz.html?claseId=${claseId}&examId=${examId}&modo=multiple`;
}

function abrirHistorialClinicoNotas(claseId) {
    syncData();
    const clase = appState.clases.find(c => c.id === claseId);
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.remove("hidden");
    modal.className = "pestana-flotante";

    const misRespuestas = (clase.answersLog || []).filter(r => r.alumno === appState.user.email && r.tipo !== 'pregunta_examen_interna');

    let totalNotas = 0;
    let totalItems = 0;
    misRespuestas.forEach(r => {
        totalNotas += r.nota;
        totalItems++;
    });

    const rendimientoGlobalCalculated = totalItems > 0 ? Math.round(totalNotas / totalItems) : 0;
    let htmlLog = "";

    if(misRespuestas.length === 0) {
        htmlLog = "<p style='color:var(--texto-mutated || #a1a1aa); font-style:italic;'>No se han registrado respuestas ni notas históricas en tu perfil.</p>";
    } else {
        misRespuestas.forEach(r => {
            htmlLog += `
                <div class="item-pregunta-banco" style="border-left: 5px solid ${r.nota >= 60 ? 'var(--acento-verde)' : 'var(--acento-rojo)'}">
                    <p><span style="background:var(--acento-azul); padding:3px 7px; font-size:0.75rem; font-weight:700; border-radius:4px; margin-right:6px;">EVALUACIÓN</span> <strong>${r.enunciado}</strong></p>
                    <p style="margin-top:6px; font-size:0.95rem;">Nota Registrada: <strong style="color:var(--acento-verde);">${r.nota}%</strong></p>
                </div>
            `;
        });
    }

    modal.innerHTML = `
        <div class="pestana-contenido">
            <div class="pestana-header">
                <h3>Historial Clínico de Puntuaciones</h3>
                <button class="btn-cerrar-flotante" onclick="cerrarPestanaFlotante()">×</button>
            </div>
            <div class="badge-global-porcentaje" style="background:#1c1917; padding:12px; border-radius:6px; margin-bottom:15px; text-align:center; border:1px solid var(--borde);">
                <p style="font-size:0.85rem; color:var(--texto-mutated || #a1a1aa)">Rendimiento Integrado General</p>
                <h2 style="font-size:1.8rem; font-weight:800; color:var(--acento-morado); margin-top:4px;">${rendimientoGlobalCalculated}%</h2>
            </div>
            <div class="pestana-scroll">${htmlLog}</div>
        </div>
    `;
}

function cerrarPestanaFlotante() {
    const modal = document.getElementById("contenedorPestanaFlotante");
    modal.classList.add("hidden");
    if(appState.user.role === "INSTRUCTOR") {
        renderInstructorClases();
    } else {
        renderAprendizClases();
    }
}
