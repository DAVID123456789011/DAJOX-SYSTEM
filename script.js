/* ==========================================================================
   DAJOX SYSTEM — SCRIPT PRINCIPAL COMPLETO
   ========================================================================== */
let appState = { user: null, clases: [] };

/* ── Función auxiliar: Randomizar opciones manteniendo track de la correcta ── */
function shuffleOpciones(opciones, correctaIdx) {
   if (!Array.isArray(opciones) || opciones.length === 0) {
       return { opciones: opciones, correctaIdx: correctaIdx };
   }
    
   // Crear array de índices
   var indices = [0, 1, 2, 3].slice(0, opciones.length);
    
   // Fisher-Yates shuffle
   for (var i = indices.length - 1; i > 0; i--) {
       var j = Math.floor(Math.random() * (i + 1));
       var temp = indices[i];
       indices[i] = indices[j];
       indices[j] = temp;
   }
    
   // Crear nuevas opciones y encontrar nuevo índice correcto
   var opcionesShuffled = [];
   var nuevoCorrectaIdx = 0;
    
   for (var i = 0; i < indices.length; i++) {
       opcionesShuffled.push(opciones[indices[i]]);
       if (indices[i] === correctaIdx) {
           nuevoCorrectaIdx = i;
       }
   }
    
   return { opciones: opcionesShuffled, correctaIdx: nuevoCorrectaIdx };
}

function syncData() {
    appState.clases = (typeof DajoxDB !== "undefined") ? DajoxDB.toArray()
        : (function(){ var r=JSON.parse(localStorage.getItem("dajox_clases_v3")||"[]"),s={};
           r.forEach(function(c){if(c&&c.id)s[c.id]=c;}); return Object.values(s); })();
}
function guardarDatos() {
    if (typeof DajoxDB !== "undefined") {
        appState.clases.forEach(function(cls) { DajoxDB.updateClass(cls); });
    } else {
        localStorage.setItem("dajox_clases_v3", JSON.stringify(appState.clases));
    }
    syncData();
    mqttPublish(appState.clases);
}

function saveAuthenticationEmail(email) {
    var deviceId = localStorage.getItem("dajox_device_id");
    if (!deviceId) {
        deviceId = "device-" + Math.random().toString(36).substr(2, 12);
        localStorage.setItem("dajox_device_id", deviceId);
    }
    var accounts = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
    var account = accounts.find(function(item) {
        return item.email.toLowerCase() === appState.user.email.toLowerCase();
    });
    if (account) {
        account.authEmail = email;
        account.trustedDevices = Array.from(new Set([...(account.trustedDevices || []), deviceId]));
    } else {
        accounts.push({
            email: appState.user.email,
            role: appState.user.role,
            authEmail: email,
            trustedDevices: [deviceId]
        });
    }
    localStorage.setItem("dajox_accounts_data", JSON.stringify(accounts));
    appState.user.authEmail = email;
    localStorage.setItem("usuarioActual", JSON.stringify(appState.user));

    if (typeof _mqtt !== "undefined" && _mqtt && _mqttOk && typeof getDajoxSalonId === "function") {
        _mqtt.publish("dajox-auth/" + getDajoxSalonId(), JSON.stringify(accounts), { qos: 1, retain: true });
    }
}

function publishAuthenticationAccounts() {
    if (typeof _mqtt === "undefined" || !_mqtt || !_mqttOk || typeof getDajoxSalonId !== "function") return;
    var accounts = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
    _mqtt.publish("dajox-auth/" + getDajoxSalonId(), JSON.stringify(accounts), { qos: 1, retain: true });
}

function showAuthenticationEmailPrompt() {
    if (appState.user.authEmail) return;

    var overlay = document.createElement("div");
    overlay.className = "neon-overlay auth-email-overlay";
    overlay.innerHTML =
        '<div class="neon-modal auth-email-modal" role="dialog" aria-modal="true" aria-labelledby="authEmailTitle">' +
            '<h2 id="authEmailTitle" style="color:var(--neon-cyan);font-family:Orbitron,sans-serif;font-size:1rem;letter-spacing:.08em;margin-bottom:12px;">VERIFICACIÓN DE CUENTA</h2>' +
            '<p style="color:var(--texto-principal);line-height:1.6;margin-bottom:8px;">¿Deseas agregar un correo electrónico de autenticación?</p>' +
            '<p style="color:var(--texto-mutado);font-size:.84rem;line-height:1.6;margin-bottom:18px;">Lo usaremos para confirmar que eres tú cuando abras DAJOX SYSTEM desde otro dispositivo.</p>' +
            '<label for="authEmailInput" style="display:block;color:var(--texto-mutado);font-size:.78rem;letter-spacing:.08em;margin-bottom:6px;">CORREO DE AUTENTICACIÓN</label>' +
            '<input id="authEmailInput" class="input-dajox" type="email" placeholder="tu-correo@ejemplo.com" autocomplete="email" style="width:100%;margin-bottom:8px;">' +
            '<p id="authEmailError" style="display:none;color:var(--neon-pink);font-size:.8rem;margin-bottom:10px;"></p>' +
            '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">' +
                '<button id="authEmailLater" style="background:transparent;border:1px solid var(--borde);color:var(--texto-mutado);padding:10px 18px;border-radius:4px;cursor:pointer;">Ahora no</button>' +
                '<button id="authEmailSave" class="btn-primary">Guardar correo</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    var input = overlay.querySelector("#authEmailInput");
    var error = overlay.querySelector("#authEmailError");
    overlay.querySelector("#authEmailLater").onclick = function() { overlay.remove(); };
    overlay.querySelector("#authEmailSave").onclick = function() {
        var email = input.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            error.textContent = "Ingresa un correo electrónico válido.";
            error.style.display = "block";
            input.focus();
            return;
        }
        saveAuthenticationEmail(email);
        overlay.remove();
    };
    setTimeout(function() { input.focus(); }, 100);
}

/* ── ARRANQUE ── */
window.onload = function() {
    var session = localStorage.getItem("usuarioActual");
    if (!session) { window.location.href = "login.html"; return; }
    appState.user = JSON.parse(session);
    document.getElementById("lblUser").textContent = appState.user.email;
    document.getElementById("lblRol").textContent = appState.user.role;
    document.getElementById("btnOut").onclick = function() {
        localStorage.removeItem("usuarioActual");
        window.location.href = "login.html";
    };
    if (typeof DajoxDB !== "undefined") DajoxDB.migrateFromLegacy();
    syncData();
    /* Conectar MQTT para sincronizacion en tiempo real */
    mqttConnect(
        function onData(clases) {
            appState.clases = clases;
            if (appState.user) {
                if (appState.user.role === "INSTRUCTOR") renderInstructorClases();
                else renderAprendizClases();
            }
        },
        function onStatus(status) {
            _mqttStatus = status;
            if (status === "online") publishAuthenticationAccounts();
            /* Actualizar indicador visual si ya existe */
            var dot = document.getElementById("mqttStatusDot");
            var lbl = document.getElementById("mqttStatusLbl");
            if (!dot || !lbl) return;
            var cfg = mqttStatusCfg(status);
            dot.style.background = cfg.color;
            dot.style.boxShadow  = "0 0 6px " + cfg.color;
            lbl.textContent = cfg.text;
        }
    );
    if (appState.user.role === "INSTRUCTOR") {
        document.getElementById("sectInstructor").classList.remove("hidden");
        initInstructor();
    } else {
        document.getElementById("sectMainAprendiz").classList.remove("hidden");
        initAprendiz();
    }
    showAuthenticationEmailPrompt();
};

/* ==========================================================================
   SYNC — CONFIGURACION Y ESTADO
   ========================================================================== */

function mqttStatusCfg(status) {
    if (status === "online")       return { color: "var(--neon-green)",  text: "EN TIEMPO REAL", border: "rgba(0,255,136,0.3)",  bg: "rgba(0,255,136,0.05)" };
    if (status === "connecting")   return { color: "var(--acento-amarillo)", text: "CONECTANDO...",  border: "rgba(255,215,0,0.35)", bg: "rgba(255,215,0,0.04)" };
    return                                { color: "var(--neon-pink)",   text: "SIN CONEXION",  border: "rgba(255,45,85,0.3)",  bg: "rgba(255,45,85,0.04)" };
}

function renderSyncBanner() {
    var existing = document.getElementById("dajoxSyncBanner");
    if (existing) existing.remove();

    var status = _mqttStatus || "offline";
    var cfg    = mqttStatusCfg(status);

    var banner = document.createElement("div");
    banner.id = "dajoxSyncBanner";
    banner.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;" +
        "padding:10px 16px;border-radius:10px;margin-bottom:16px;font-size:0.82rem;" +
        "border:1px solid " + cfg.border + ";background:" + cfg.bg + ";";

    banner.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span id="mqttStatusDot" style="width:9px;height:9px;border-radius:50%;display:inline-block;background:' + cfg.color + ';box-shadow:0 0 6px ' + cfg.color + ';flex-shrink:0;"></span>' +
            '<span id="mqttStatusLbl" style="color:' + cfg.color + ';font-weight:700;">' + cfg.text + '</span>' +
            '<span style="color:var(--texto-mutado);font-size:0.76rem;">— Salon: <code style="color:var(--neon-cyan);">' + (typeof getDajoxSalonId === "function" ? getDajoxSalonId() : "—") + '</code></span>' +
        '</div>';

    var sectEl = document.getElementById("sectInstructor") || document.getElementById("sectMainAprendiz");
    if (sectEl && sectEl.firstChild) sectEl.insertBefore(banner, sectEl.firstChild);
}

/* ==========================================================================
   INSTRUCTOR
   ========================================================================== */
function initInstructor() {
    document.getElementById("btnCrearClase").onclick = function() {
        var nom = document.getElementById("insNombre").value.trim();
        var fic = document.getElementById("insFicha").value.trim();
        if (!nom || !fic) return alert("Completa nombre y ficha");
        if (typeof DajoxDB !== "undefined") {
            DajoxDB.createClass(nom, fic, appState.user.email);
            syncData(); mqttPublish(appState.clases);
        } else {
            appState.clases.push({ id: "CLASE-"+Math.floor(Math.random()*9000+1000),
                nombre:nom, ficha:fic, instructor:appState.user.email,
                answersLog:[], examenesCreadosEstructurados:[], bancoPreguntas:[], preguntasIndividuales:[], montajes:[], inscritos:[] });
            guardarDatos();
        }
        document.getElementById("insNombre").value = "";
        document.getElementById("insFicha").value = "";
        renderInstructorClases();
    };
    renderInstructorClases();
}

function renderInstructorClases() {
    syncData();
    renderSyncBanner();
    var misClases = appState.clases.filter(function(c) { return c.instructor === appState.user.email; });
    var cont = document.getElementById("listaClasesInstructor");
    cont.innerHTML = "";
    if (misClases.length === 0) {
        cont.innerHTML = '<p style="color:var(--texto-mutado);margin-top:14px;font-size:0.85rem;letter-spacing:0.08em;">// NO HAY CLASES CREADAS AUN</p>';
        return;
    }
    misClases.forEach(function(clase) {
        var inscritos = (clase.inscritos || []).length;
        var card = document.createElement("div");
        card.className = "card-clase-ins";
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">' +
                '<div>' +
                    '<div class="clase-nombre">' + clase.nombre.toUpperCase() + '</div>' +
                    '<span style="font-size:0.72rem;color:var(--texto-mutado);letter-spacing:0.1em;">AMBIENTE DE FORMACION TECNICA</span>' +
                '</div>' +
                '<button class="btn-eliminar" data-id="' + clase.id + '">ELIMINAR</button>' +
            '</div>' +
            '<div class="sep-neon"></div>' +
            '<p class="meta-label">FICHA: <span style="color:var(--texto-principal);">' + clase.ficha + '</span></p>' +
            '<p class="badge-inscritos">APRENDICES INSCRITOS: ' + inscritos + '</p>' +
            '<p class="codigo-neon">CODIGO: ' + clase.id + '</p>' +
            '<div class="btns-accion">' +
                '<button class="btn-accion btn-accion-azul" data-panel="preguntas" data-id="' + clase.id + '">01 // GESTIONAR BANCO DE PREGUNTAS</button>' +
                '<button class="btn-accion btn-accion-morado" data-panel="examenes" data-id="' + clase.id + '">02 // PUBLICAR NUEVOS EXAMENES</button>' +
                '<button class="btn-accion btn-accion-indigo btn-ver-inscritos" data-id="' + clase.id + '">/// VER APRENDICES UNIDOS</button>' +
                '<button class="btn-accion btn-accion-dark" data-panel="resultados" data-id="' + clase.id + '">03 // VER PUNTUACIONES DE ALUMNOS</button>' +
                '<button class="btn-accion btn-accion-verde" data-panel="resultados" data-id="' + clase.id + '">RENDIMIENTO GLOBAL DE APRENDICES</button>' +
                '<button class="btn-accion btn-accion-indigo btn-ver-contenido-clase" data-id="' + clase.id + '">04 // VER PREGUNTAS Y EXAMENES DE ESTA CLASE</button>' +
            '</div>';

        card.querySelector(".btn-eliminar").onclick = function() { eliminarClase(this.dataset.id); };
        card.querySelectorAll(".btn-accion[data-panel]").forEach(function(btn) {
            btn.onclick = function() { abrirPanelInstructor(this.dataset.id, this.dataset.panel); };
        });
        card.querySelector(".btn-ver-inscritos").onclick = function() { verAprendicesInscritos(this.dataset.id); };
        card.querySelector(".btn-ver-contenido-clase").onclick = function() { verPreguntasExamenesClase(this.dataset.id); };

        cont.appendChild(card);
    });
}

function abrirEditorPregunta(claseId, pregunta, guardarCambios) {
    var overlay = document.createElement("div");
    overlay.className = "neon-overlay";
    overlay.style.zIndex = "2100";
    var modal = document.createElement("div");
    modal.className = "neon-modal";
    modal.style.maxWidth = "800px";
    modal.style.maxHeight = "90vh";
    modal.style.overflowY = "auto";
    modal.innerHTML =
        '<button class="btn-cerrar-modal" id="btnCerrarEditor">✕</button>' +
        '<h3 style="margin-bottom:4px;color:var(--neon-cyan);">EDITOR DE PREGUNTA</h3>' +
        '<p style="color:var(--texto-mutado);font-size:.8rem;margin-bottom:16px;">Personaliza y mejora tu pregunta para hacerla mas didactica y creativa.</p>' +
        '<div style="border-top:1px solid var(--neon-cyan);padding-top:12px;">' +
            '<label style="display:block;color:var(--texto-mutado);font-size:.8rem;margin-bottom:5px;font-weight:700;">ENUNCIADO DE LA PREGUNTA</label>' +
            '<textarea id="edEnunciado" class="input-dajox" style="width:100%;height:80px;resize:none;margin-bottom:12px;" placeholder="// Escribe el enunciado claro y conciso"></textarea>' +
            '<label style="display:block;color:var(--texto-mutado);font-size:.8rem;margin-bottom:5px;font-weight:700;">URL DE IMAGEN (OPCIONAL)</label>' +
            '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
                '<input type="text" id="edImagen" class="input-dajox" style="flex:1;" placeholder="https://ejemplo.com/imagen.jpg">' +
                '<button id="btnPrevEdImg" class="btn-primary" style="flex-shrink:0;font-size:0.8rem;background:var(--neon-cyan);color:#000;">VISTA PREVIA</button>' +
            '</div>' +
            '<div id="edImgPrev" style="margin-bottom:12px;min-height:0;"></div>' +
            '<label style="display:block;color:var(--texto-mutado);font-size:.8rem;margin-bottom:8px;font-weight:700;">OPCIONES DE RESPUESTA (Puedes agregar texto, imagen o ambos)</label>' +
            '<div id="edOpciones" style="margin-bottom:12px;"></div>' +
            '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:16px;">' +
                '<button id="btnCancelarEditor" class="btn-primary" style="background:transparent;border:1px solid var(--neon-pink);color:var(--neon-pink);">CANCELAR</button>' +
                '<button id="btnGuardarEditor" class="btn-primary" style="background:var(--neon-cyan);color:#000;">GUARDAR CAMBIOS</button>' +
            '</div>' +
        '</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function renderImagePreview(url) {
        var prev = modal.querySelector("#edImgPrev");
        prev.innerHTML = '';
        if (!url) return;
        var img = document.createElement('img');
        img.src = url;
        img.referrerPolicy = 'no-referrer';
        img.alt = 'Vista previa';
        img.style.cssText = 'max-height:120px;max-width:100%;object-fit:contain;border-radius:6px;border:1px solid rgba(0,212,255,0.2);display:block;';
        img.onerror = function() {
            prev.innerHTML = '<p style="color:var(--neon-pink);font-size:0.78rem;margin:0 0 4px;">La URL no apunta directamente a una imagen.</p>' +
                '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" style="color:var(--neon-cyan);font-size:0.78rem;">Abrir URL</a>';
        };
        prev.appendChild(img);
    }

    function normalizarOpcion(opcion) {
        if (typeof opcion === 'string') {
            return { texto: opcion, imagen: '' };
        }
        return opcion || { texto: '', imagen: '' };
    }

    document.getElementById("edEnunciado").value = pregunta.pregunta || '';
    document.getElementById("edImagen").value = pregunta.image || '';

    var opcContainer = modal.querySelector("#edOpciones");
    (pregunta.opciones || []).forEach(function(opcion, index) {
        var opNorm = normalizarOpcion(opcion);
        var divOp = document.createElement("div");
        divOp.style.cssText = "background:rgba(255,255,255,0.02);border:1px solid var(--neon-cyan);border-radius:6px;padding:10px;margin-bottom:10px;";
        divOp.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">' +
            '<input type="radio" name="edCorrecta" value="' + index + '" style="margin-top:4px;cursor:pointer;"' + (index === pregunta.correcta ? ' checked' : '') + '>' +
            '<span style="color:var(--neon-green);font-weight:700;min-width:24px;margin-top:3px;">Opción ' + String.fromCharCode(65 + index) + '</span>' +
            '<div style="flex:1;">' +
                '<input type="text" class="input-dajox edOpTexto" data-index="' + index + '" value="' + (opNorm.texto || '').replace(/"/g, '&quot;') + '" placeholder="Texto de la opción (obligatorio)" style="width:100%;margin-bottom:6px;">' +
                '<input type="text" class="input-dajox edOpImagen" data-index="' + index + '" value="' + (opNorm.imagen || '').replace(/"/g, '&quot;') + '" placeholder="URL de imagen (opcional)" style="width:100%;margin-bottom:6px;">' +
                '<div class="edOpPrev" data-index="' + index + '" style="min-height:0;"></div>' +
            '</div>' +
        '</div>';
        opcContainer.appendChild(divOp);
    });

    function renderOpcionImagenPreview(index) {
        var url = modal.querySelector('.edOpImagen[data-index="' + index + '"]').value.trim();
        var prev = modal.querySelector('.edOpPrev[data-index="' + index + '"]');
        prev.innerHTML = '';
        if (!url) return;
        var img = document.createElement('img');
        img.src = url;
        img.referrerPolicy = 'no-referrer';
        img.alt = 'Previa opción';
        img.style.cssText = 'max-height:100px;max-width:100%;object-fit:contain;border-radius:4px;border:1px solid rgba(0,255,136,0.3);display:block;';
        img.onerror = function() {
            prev.innerHTML = '<p style="color:var(--neon-pink);font-size:0.75rem;margin:0;">URL inválida</p>';
        };
        prev.appendChild(img);
    }

    modal.querySelectorAll('.edOpImagen').forEach(function(inp) {
        inp.oninput = function() { renderOpcionImagenPreview(parseInt(this.dataset.index, 10)); };
        renderOpcionImagenPreview(parseInt(inp.dataset.index, 10));
    });

    modal.querySelector("#edImagen").oninput = function() {
        renderImagePreview(this.value.trim());
    };
    modal.querySelector("#btnPrevEdImg").onclick = function() {
        renderImagePreview(modal.querySelector("#edImagen").value.trim());
    };

    modal.querySelector("#btnCerrarEditor").onclick = function() { overlay.remove(); };
    modal.querySelector("#btnCancelarEditor").onclick = function() { overlay.remove(); };
    modal.querySelector("#btnGuardarEditor").onclick = function() {
        var enunciado = modal.querySelector("#edEnunciado").value.trim();
        if (!enunciado) return alert("El enunciado no puede estar vacio.");
        var opciones = [0, 1, 2, 3].map(function(i) {
            var texto = modal.querySelector('.edOpTexto[data-index="' + i + '"]').value.trim();
            var imagen = modal.querySelector('.edOpImagen[data-index="' + i + '"]').value.trim();
            return { texto: texto, imagen: imagen };
        });
        if (opciones.some(function(o) { return !o.texto; })) return alert("El texto de todas las opciones es obligatorio.");
        var correctaRad = modal.querySelector('input[name="edCorrecta"]:checked');
        if (!correctaRad) return alert("Selecciona la opcion correcta.");
        
        // Actualizar directamente en appState para asegurar guardado
        var nuevaImagen = modal.querySelector("#edImagen").value.trim();
        pregunta.pregunta = enunciado;
        pregunta.opciones = opciones;
        pregunta.correcta = parseInt(correctaRad.value, 10);
        pregunta.image = nuevaImagen;
        
        // Guardar explícitamente en localStorage
        guardarCambios();
        overlay.remove();
    };
}

function verPreguntasExamenesClase(claseId) {
    var overlay = document.createElement("div");
    overlay.className = "neon-overlay";
    overlay.id = "contenido-clase-" + claseId;
    var modal = document.createElement("div");
    modal.className = "neon-modal";
    modal.style.maxWidth = "760px";
    modal.innerHTML =
        '<button class="btn-cerrar-modal" id="btnCerrarContenidoClase">✕</button>' +
        '<h3 style="margin-bottom:4px;">PREGUNTAS Y EXAMENES DE LA CLASE</h3>' +
        '<p style="color:var(--texto-mutado);font-size:.8rem;margin-bottom:18px;">Consulta y administra todo el contenido creado para este ambiente.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">' +
            '<button class="btn-accion btn-accion-azul" id="btnVerPreguntasClase">VER PREGUNTAS</button>' +
            '<button class="btn-accion btn-accion-morado" id="btnVerExamenesClase">VER EXAMENES</button>' +
        '</div>' +
        '<div id="contenidoClaseLista"></div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function obtenerClase() {
        syncData();
        return appState.clases.find(function(clase) { return clase.id === claseId; });
    }

    function renderPreguntas() {
        var clase = obtenerClase();
        var bancos = clase ? (clase.bancoPreguntas || []) : [];
        
        if (bancos.length === 0) {
            var listaEl = modal.querySelector("#contenidoClaseLista");
            listaEl.innerHTML = '<h4 style="color:var(--neon-cyan);margin-bottom:10px;">BANCOS DE PREGUNTAS (0)</h4><p style="color:var(--texto-mutado);">// No hay bancos creados. Crea uno en el primer botón "GESTIONAR BANCO DE PREGUNTAS".</p>';
            return;
        }

        var bancosHTML = bancos.map(function(banco, bancoIndex) {
            var totalPts = banco.preguntas.reduce(function(sum, p) { return sum + (p.puntos || 0); }, 0);
            var preguntasHTML = (banco.preguntas || []).map(function(pregunta, preguntaIndex) {
                var opcionesTexto = (pregunta.opciones || []).map(function(opcion, opcionIndex) {
                    var texto = typeof opcion === 'string' ? opcion : (opcion.texto || '');
                    var imagen = typeof opcion === 'string' ? '' : (opcion.imagen || '');
                    var marcaCorrecta = opcionIndex === pregunta.correcta ? ' ✓' : '';
                    var htmlImg = imagen ? ' <a href="' + imagen.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" style="color:var(--neon-green);font-size:.75rem;">[img]</a>' : '';
                    return String.fromCharCode(65 + opcionIndex) + ') ' + texto + htmlImg + marcaCorrecta;
                }).join(' &nbsp; ');
                return '<div style="margin-bottom:8px;padding:8px;background:rgba(255,255,255,0.02);border-left:3px solid var(--neon-cyan);border-radius:3px;">' +
                    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">' +
                        '<div style="flex:1;">' +
                            '<p style="font-size:0.85rem;font-weight:600;">' + (preguntaIndex + 1) + '. ' + pregunta.pregunta + '</p>' +
                            '<p style="color:var(--texto-mutado);font-size:.75rem;margin-top:4px;">' + opcionesTexto + '</p>' +
                            '<div style="display:flex;gap:8px;margin-top:6px;align-items:center;">' +
                                '<span style="color:var(--neon-cyan);font-size:0.78rem;font-weight:700;">' + (pregunta.puntos || 0) + ' pts</span>' +
                                '<input type="number" class="puntos-pregunta" data-banco="' + bancoIndex + '" data-pregunta="' + preguntaIndex + '" value="' + (pregunta.puntos || 0) + '" min="1" max="100" style="width:50px;padding:3px 6px;font-size:0.78rem;background:var(--bg-inputs);border:1px solid var(--borde);border-radius:3px;color:var(--texto-principal);">' +
                            '</div>' +
                        '</div>' +
                        '<div style="display:flex;gap:5px;flex-shrink:0;">' +
                            '<button class="btn-mini-azul btn-editar-pregunta-banco" data-banco="' + bancoIndex + '" data-pregunta="' + preguntaIndex + '">EDITAR</button>' +
                            '<button class="btn-mini-rojo btn-eliminar-pregunta-banco" data-banco="' + bancoIndex + '" data-pregunta="' + preguntaIndex + '">✕</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
            
            return '<div style="background:rgba(0,212,255,0.02);border:1px solid var(--neon-cyan);border-radius:6px;padding:12px;margin-bottom:12px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">' +
                    '<div>' +
                        '<p style="font-weight:700;font-size:1rem;color:var(--neon-cyan);">' + banco.titulo + '</p>' +
                        '<p style="color:var(--texto-mutado);font-size:0.8rem;margin-top:2px;">' + banco.preguntas.length + ' preguntas | Total: <span style="color:var(--neon-green);font-weight:700;">' + totalPts + ' pts</span></p>' +
                    '</div>' +
                    '<div style="display:flex;gap:5px;flex-shrink:0;">' +
                        '<button class="btn-mini-rojo btn-eliminar-banco" data-banco="' + bancoIndex + '">ELIMINAR BANCO</button>' +
                    '</div>' +
                '</div>' +
                '<div style="border-top:1px solid rgba(0,212,255,0.2);padding-top:10px;">' +
                    preguntasHTML +
                '</div>' +
            '</div>';
        }).join('');

        var listaEl = modal.querySelector("#contenidoClaseLista");
        listaEl.innerHTML = '<h4 style="color:var(--neon-cyan);margin-bottom:10px;">BANCOS DE PREGUNTAS (' + bancos.length + ')</h4>' + bancosHTML;

        // Editar pregunta
        listaEl.querySelectorAll(".btn-editar-pregunta-banco").forEach(function(btn) {
            btn.onclick = function() {
                var claseActual = obtenerClase();
                var banco = claseActual.bancoPreguntas[parseInt(btn.dataset.banco, 10)];
                var pregunta = banco.preguntas[parseInt(btn.dataset.pregunta, 10)];
                abrirEditorPregunta(claseId, pregunta, function() {
                    guardarDatos();
                    renderPreguntas();
                });
            };
        });

        // Eliminar pregunta del banco
        listaEl.querySelectorAll(".btn-eliminar-pregunta-banco").forEach(function(btn) {
            btn.onclick = function() {
                if (!confirm("¿Eliminar esta pregunta del banco?")) return;
                var claseActual = obtenerClase();
                var banco = claseActual.bancoPreguntas[parseInt(btn.dataset.banco, 10)];
                banco.preguntas.splice(parseInt(btn.dataset.pregunta, 10), 1);
                if (banco.preguntas.length === 0) {
                    claseActual.bancoPreguntas.splice(parseInt(btn.dataset.banco, 10), 1);
                }
                guardarDatos();
                renderPreguntas();
            };
        });

        // Eliminar banco completo
        listaEl.querySelectorAll(".btn-eliminar-banco").forEach(function(btn) {
            btn.onclick = function() {
                if (!confirm("¿Eliminar este banco de preguntas completo?")) return;
                var claseActual = obtenerClase();
                claseActual.bancoPreguntas.splice(parseInt(btn.dataset.banco, 10), 1);
                guardarDatos();
                renderPreguntas();
            };
        });

        // Recalculación automática cuando se editan puntos
        listaEl.querySelectorAll('.puntos-pregunta').forEach(function(inp) {
            inp.onchange = function() {
                var bancoIdx = parseInt(this.dataset.banco, 10);
                var pregIdx = parseInt(this.dataset.pregunta, 10);
                var nuevoValor = parseInt(this.value) || 0;
                
                var claseActual = obtenerClase();
                var banco = claseActual.bancoPreguntas[bancoIdx];
                
                // Marcar esta pregunta como editada
                var puntosEditados = {};
                puntosEditados[pregIdx] = nuevoValor;
                
                // Leer todos los puntos actuales del formulario
                var puntosActuales = {};
                listaEl.querySelectorAll('.puntos-pregunta[data-banco="' + bancoIdx + '"]').forEach(function(inp2) {
                    var idx = parseInt(inp2.dataset.pregunta, 10);
                    puntosActuales[idx] = parseInt(inp2.value) || 0;
                });
                
                // Calcular nueva distribución respetando todos los valores editados
                var puntosUsados = 0;
                var indicesLibres = [];
                for (var i = 0; i < banco.preguntas.length; i++) {
                    if (puntosActuales[i] > 0) {
                        puntosUsados += puntosActuales[i];
                    } else {
                        indicesLibres.push(i);
                    }
                }
                
                var puntosRestantes = 100 - puntosUsados;
                var puntoPorPregunta = indicesLibres.length > 0 ? Math.floor(puntosRestantes / indicesLibres.length) : 0;
                
                // Aplicar nueva distribución a preguntas sin puntos editados
                for (var i = 0; i < banco.preguntas.length; i++) {
                    if (puntosActuales[i] > 0) {
                        banco.preguntas[i].puntos = puntosActuales[i];
                    } else {
                        banco.preguntas[i].puntos = puntoPorPregunta;
                    }
                }
                
                // Ajustar diferencia para llegar exactamente a 100
                var suma = Object.values(puntosActuales).reduce(function(a, b) { return a + b; }, 0) + (puntoPorPregunta * indicesLibres.length);
                if (suma < 100 && indicesLibres.length > 0) {
                    banco.preguntas[indicesLibres[0]].puntos += (100 - suma);
                }
                
                guardarDatos();
                renderPreguntas();
            };
        });
    }

    function renderExamenes() {
        var clase = obtenerClase();
        var examenes = clase ? (clase.examenesCreadosEstructurados || []) : [];
        var lista = examenes.length === 0
            ? '<p style="color:var(--texto-mutado);">// No hay examenes creados.</p>'
            : examenes.map(function(examen, index) {
                return '<div class="item-lista" style="margin-bottom:8px;">' +
                    '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">' +
                        '<div><p style="font-weight:700;">' + examen.nombre + '</p><p style="color:var(--texto-mutado);font-size:.8rem;">' + (examen.preguntas || []).length + ' preguntas</p></div>' +
                        '<div style="display:flex;gap:5px;flex-shrink:0;"><button class="btn-mini-azul btn-editar-examen-clase" data-index="' + index + '">EDITAR</button><button class="btn-mini-rojo btn-eliminar-examen-clase" data-index="' + index + '">✕</button></div>' +
                    '</div>' +
                    '<div class="examen-preguntas-clase" data-exam-index="' + index + '" style="margin-top:10px;"></div>' +
                '</div>';
            }).join('');
        var listaEl = modal.querySelector("#contenidoClaseLista");
        listaEl.innerHTML = '<h4 style="color:var(--neon-cyan);margin-bottom:10px;">EXAMENES (' + examenes.length + ')</h4>' + lista;
        listaEl.querySelectorAll(".examen-preguntas-clase").forEach(function(contenedor) {
            var examen = examenes[parseInt(contenedor.dataset.examIndex, 10)];
            contenedor.innerHTML = (examen.preguntas || []).map(function(pregunta, preguntaIndex) {
                return '<div style="border-left:2px solid var(--neon-cyan);padding:7px 10px;margin-top:5px;background:rgba(0,212,255,.025);">' +
                    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">' +
                        '<span style="font-size:.82rem;">' + (preguntaIndex + 1) + '. ' + pregunta.pregunta + '</span>' +
                        '<span style="display:flex;gap:4px;flex-shrink:0;">' +
                            '<button class="btn-mini-azul btn-editar-pregunta-examen" data-exam-index="' + contenedor.dataset.examIndex + '" data-question-index="' + preguntaIndex + '">EDITAR</button>' +
                            '<button class="btn-mini-rojo btn-eliminar-pregunta-examen" data-exam-index="' + contenedor.dataset.examIndex + '" data-question-index="' + preguntaIndex + '">✕</button>' +
                        '</span>' +
                    '</div>' +
                '</div>';
            }).join('');
        });
        listaEl.querySelectorAll(".btn-editar-pregunta-examen").forEach(function(btn) {
            btn.onclick = function() {
                var claseActual = obtenerClase();
                var examen = claseActual.examenesCreadosEstructurados[parseInt(btn.dataset.examIndex, 10)];
                var pregunta = examen.preguntas[parseInt(btn.dataset.questionIndex, 10)];
                abrirEditorPregunta(claseId, pregunta, function() {
                    guardarDatos();
                    renderExamenes();
                });
            };
        });
        listaEl.querySelectorAll(".btn-eliminar-pregunta-examen").forEach(function(btn) {
            btn.onclick = function() {
                if (!confirm("¿Eliminar esta pregunta del examen?")) return;
                var claseActual = obtenerClase();
                var examen = claseActual.examenesCreadosEstructurados[parseInt(btn.dataset.examIndex, 10)];
                examen.preguntas.splice(parseInt(btn.dataset.questionIndex, 10), 1);
                guardarDatos();
                renderExamenes();
            };
        });
        listaEl.querySelectorAll(".btn-editar-examen-clase").forEach(function(btn) {
            btn.onclick = function() {
                var claseActual = obtenerClase();
                var examen = claseActual.examenesCreadosEstructurados[parseInt(btn.dataset.index, 10)];
                var nombre = prompt("Nombre del examen:", examen.nombre);
                if (nombre === null || !nombre.trim()) return;
                examen.nombre = nombre.trim();
                guardarDatos();
                renderExamenes();
            };
        });
        listaEl.querySelectorAll(".btn-eliminar-examen-clase").forEach(function(btn) {
            btn.onclick = function() {
                if (!confirm("¿Eliminar este examen y todas sus preguntas?")) return;
                var claseActual = obtenerClase();
                claseActual.examenesCreadosEstructurados.splice(parseInt(btn.dataset.index, 10), 1);
                guardarDatos();
                renderExamenes();
            };
        });
    }

    modal.querySelector("#btnCerrarContenidoClase").onclick = function() { overlay.remove(); };
    modal.querySelector("#btnVerPreguntasClase").onclick = renderPreguntas;
    modal.querySelector("#btnVerExamenesClase").onclick = renderExamenes;
    modal.querySelector("#btnVerPreguntasClase").click();
}

function eliminarClase(claseId) {
    if (!confirm("Eliminar esta clase y TODOS sus datos? No se puede deshacer.")) return;
    if (typeof DajoxDB !== "undefined") DajoxDB.deleteClass(claseId);
    else { appState.clases = appState.clases.filter(function(c){return c.id!==claseId;}); guardarDatos(); }
    syncData();
    renderInstructorClases();
}

function verAprendicesInscritos(claseId) {
    syncData();
    var clase = appState.clases.find(function(c) { return c.id === claseId; });
    if (!clase) return;
    var inscritos = clase.inscritos || [];
    var overlay = document.createElement("div");
    overlay.className = "neon-overlay";
    var items = inscritos.length === 0
        ? '<p style="color:var(--texto-mutado);">// Ningun aprendiz se ha unido aun.</p>'
        : inscritos.map(function(e, i) { return '<div class="item-inscrito">' + (i+1) + '. ' + e + '</div>'; }).join('');
    overlay.innerHTML =
        '<div class="neon-modal">' +
            '<button class="btn-cerrar-modal" id="btnCerrarAI">✕</button>' +
            '<h4 style="margin-bottom:16px;">APRENDICES EN ' + clase.nombre.toUpperCase() + '</h4>' +
            items +
        '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector("#btnCerrarAI").onclick = function() { document.body.removeChild(overlay); };
}

function abrirPanelInstructor(claseId, tabInicial) {
    syncData();
    var clase = appState.clases.find(function(c) { return c.id === claseId; });
    if (!clase) return;
    
    // Crear ID único para esta pestaña
    var pestaId = "pestaña-" + claseId + "-" + tabInicial + "-" + Date.now();
    
    // Crear overlay y modal únicos
    var overlay = document.createElement("div");
    overlay.className = "neon-overlay";
    overlay.id = pestaId;
    
    var modal = document.createElement("div");
    modal.className = "neon-modal";
    modal.style.maxWidth = "700px";
    
    var btnCerrar = document.createElement("button");
    btnCerrar.className = "btn-cerrar-modal";
    btnCerrar.textContent = "✕";
    
    var header = document.createElement("div");
    header.innerHTML = 
        '<h3 style="margin-bottom:4px;">' + clase.nombre.toUpperCase() + '</h3>' +
        '<p style="color:var(--texto-mutado);font-size:0.8rem;margin-bottom:18px;letter-spacing:0.06em;">FICHA: ' + clase.ficha + ' &nbsp;|&nbsp; CODIGO: <span class="codigo-neon">' + clase.id + '</span></p>';
    
    var contenido = document.createElement("div");
    contenido.id = "cont-" + pestaId;
    
    modal.appendChild(btnCerrar);
    modal.appendChild(header);
    modal.appendChild(contenido);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Evento cerrar
    btnCerrar.onclick = function() {
        document.body.removeChild(overlay);
    };
    
    // Renderizar contenido
    renderTabInstructorIndependiente(claseId, tabInicial, contenido.id);
}

function renderTabInstructorIndependiente(claseId, tab, contenedorId) {
    syncData();
    var clase = appState.clases.find(function(c) { return c.id === claseId; });
    var cont = document.getElementById(contenedorId);
    if (!cont) return;
    if (tab === "preguntas") renderTabPreguntas(clase, cont, claseId);
    else if (tab === "examenes") renderTabExamenes(clase, cont, claseId);
    else if (tab === "montaje") renderTabMontaje(clase, cont, claseId);
    else if (tab === "resultados") renderTabResultados(clase, cont);
}

/* ── Tab Preguntas individuales ── */
function renderTabPreguntas(clase, cont, claseId) {
    var bancos = clase.bancoPreguntas || [];
    var bancoPreguntasTemp = [];
    
    function calcularPuntos(totalPreguntas, puntosEditados) {
        puntosEditados = puntosEditados || {};
        var puntosUsados = 0;
        var indices = [];
        for (var i = 0; i < totalPreguntas; i++) {
            if (puntosEditados[i] !== undefined) {
                puntosUsados += puntosEditados[i];
            } else {
                indices.push(i);
            }
        }
        var puntosRestantes = 100 - puntosUsados;
        var puntoPorPregunta = indices.length > 0 ? Math.floor(puntosRestantes / indices.length) : 0;
        var resultado = {};
        for (var i = 0; i < totalPreguntas; i++) {
            resultado[i] = puntosEditados[i] !== undefined ? puntosEditados[i] : puntoPorPregunta;
        }
        var suma = Object.values(resultado).reduce(function(a, b) { return a + b; }, 0);
        if (suma < 100 && indices.length > 0) {
            resultado[indices[0]] += (100 - suma);
        }
        return resultado;
    }

    cont.innerHTML =
        '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;border-bottom:2px solid var(--neon-cyan);padding-bottom:12px;">' +
            '<button id="tabCrearPropio" class="btn-primary" style="background:var(--neon-cyan);color:#000;font-weight:700;">CREAR BANCO PROPIO</button>' +
            '<button id="tabBancoAuto" class="btn-primary" style="background:transparent;border:1px solid var(--neon-cyan);color:var(--neon-cyan);">CARGAR DEL BANCO AUTOMÁTICO</button>' +
        '</div>' +
        '<div id="seccionCrearPropio"></div>' +
        '<div id="seccionBancoAuto" style="display:none;"></div>';

    // Contenido - Crear Banco Propio
    var secCrearPropio = cont.querySelector("#seccionCrearPropio");
    secCrearPropio.innerHTML =
        '<div class="seccion-form">' +
            '<h4 style="margin-bottom:12px;">CREAR NUEVO BANCO DE PREGUNTAS</h4>' +
            '<input type="text" id="nbTitulo" placeholder="Ej: Ensambles de equipos" class="input-dajox" style="width:100%;margin-bottom:10px;">' +
            '<p style="font-size:0.8rem;color:var(--texto-mutado);margin-bottom:10px;">// El sistema distribuirá automáticamente 100 puntos entre todas las preguntas</p>' +
            '<div id="nbPreguntasTemp" style="background:rgba(0,212,255,0.02);border:1px solid rgba(0,212,255,0.1);border-radius:6px;padding:12px;margin-bottom:12px;min-height:60px;"></div>' +
            '<div class="sub-form" style="background:rgba(255,255,255,0.01);padding:10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.08);">' +
                '<p style="font-size:0.82rem;color:var(--neon-cyan);margin-bottom:8px;letter-spacing:0.06em;">AGREGAR PREGUNTA AL BANCO:</p>' +
                '<input type="text" id="nbPqEnunciado" placeholder="// Enunciado" class="input-dajox" style="width:100%;margin-bottom:6px;">' +
                '<input type="text" id="nbPqImagen" placeholder="// URL imagen (opcional)" class="input-dajox" style="width:100%;margin-bottom:6px;">' +
                '<div id="nbPqImgPrev" style="margin-bottom:6px;"></div>' +
                ['A','B','C','D'].map(function(l, i) {
                    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
                        '<label style="min-width:70px;font-size:0.8rem;color:var(--texto-mutado);">OPC ' + l + ':</label>' +
                        '<input type="text" id="nbOp' + i + '" placeholder="Opcion ' + l + '" class="input-dajox" style="flex:1;font-size:0.84rem;">' +
                        '<label style="font-size:0.8rem;display:flex;align-items:center;gap:3px;cursor:pointer;color:var(--neon-green);">' +
                            '<input type="radio" name="nbCorrecta" value="' + i + '"> ✓' +
                        '</label>' +
                    '</div>';
                }).join('') +
                '<button id="btnAgregarNbPq" class="btn-primary" style="font-size:0.8rem;margin-top:8px;background:var(--neon-cyan);color:#000;width:100%;">+ AGREGAR PREGUNTA AL BANCO</button>' +
            '</div>' +
            '<button id="btnCrearBanco" class="btn-primary" style="width:100%;margin-bottom:20px;background:var(--neon-green);color:#000;font-weight:700;">CREAR BANCO CON PREGUNTAS</button>' +
        '</div>';

    function renderNbPreguntasTemp() {
        var el = document.getElementById("nbPreguntasTemp");
        if (!el) return;
        el.innerHTML = bancoPreguntasTemp.length === 0 
            ? '<p style="font-size:0.8rem;color:var(--texto-mutado);text-align:center;padding:10px 0;">// Aún no hay preguntas en el banco</p>'
            : '<div>' +
                '<p style="font-size:0.8rem;color:var(--neon-cyan);margin-bottom:8px;font-weight:700;">PREGUNTAS EN EL BANCO (' + bancoPreguntasTemp.length + '):</p>' +
                '<div style="display:flex;flex-direction:column;gap:6px;">' +
                    bancoPreguntasTemp.map(function(p, i) {
                        return '<div style="background:var(--bg-inputs);padding:8px 10px;border-radius:4px;border-left:3px solid var(--neon-cyan);font-size:0.8rem;display:flex;justify-content:space-between;align-items:center;">' +
                            '<span>' + (i+1) + '. ' + p.pregunta + (p.image ? ' <span style="color:var(--neon-green);">[img]</span>' : '') + '</span>' +
                            '<button onclick="window._rmNbPq(' + i + ')" style="background:var(--neon-pink);color:#fff;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:0.75rem;flex-shrink:0;margin-left:8px;">✕</button>' +
                        '</div>';
                    }).join('') +
                '</div>' +
            '</div>';
    }
    window._rmNbPq = function(i) { bancoPreguntasTemp.splice(i, 1); renderNbPreguntasTemp(); };

    // Contenido - Banco Automático
    var banco = (typeof bancoPredeterminado30 !== 'undefined') ? bancoPredeterminado30 : [];
    var secBancoAuto = cont.querySelector("#seccionBancoAuto");
    var preguntasSeleccionadas = new Set();

    function renderListaBancoAuto() {
        var filtro = cont.querySelector("#filterBancoAutoTab").value.toLowerCase();
        var listaEl = cont.querySelector("#listaBancoAutoTab");
        listaEl.innerHTML = banco
            .filter(function(p) { return p.pregunta.toLowerCase().indexOf(filtro) !== -1; })
            .map(function(p) {
                var isSelected = preguntasSeleccionadas.has(p.id);
                return '<div style="background:rgba(0,212,255,0.02);border:1px solid rgba(0,212,255,0.1);border-radius:6px;padding:10px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start;">' +
                    '<input type="checkbox" class="chk-pregunta-auto-tab" data-id="' + p.id + '" ' + (isSelected ? 'checked' : '') + ' style="margin-top:4px;cursor:pointer;width:18px;height:18px;">' +
                    '<div style="flex:1;">' +
                        '<p style="font-weight:700;font-size:0.9rem;margin-bottom:4px;">' + p.pregunta + '</p>' +
                        '<p style="color:var(--texto-mutado);font-size:0.78rem;">' +
                            p.opciones.map(function(o, i) { return '<span style="' + (i === p.correcta ? 'color:var(--neon-green);font-weight:700;' : '') + '">' + String.fromCharCode(65+i) + ') ' + o + '</span> '; }).join('') +
                        '</p>' +
                    '</div>' +
                '</div>';
            }).join('');

        listaEl.querySelectorAll('.chk-pregunta-auto-tab').forEach(function(chk) {
            chk.onchange = function() {
                var id = parseInt(this.dataset.id, 10);
                if (this.checked) {
                    preguntasSeleccionadas.add(id);
                } else {
                    preguntasSeleccionadas.delete(id);
                }
            };
        });
    }

    secBancoAuto.innerHTML =
        '<div class="seccion-form">' +
            '<h4 style="margin-bottom:12px;">CARGAR PREGUNTAS DEL BANCO AUTOMÁTICO</h4>' +
            '<p style="font-size:0.8rem;color:var(--texto-mutado);margin-bottom:10px;">Selecciona preguntas para agregar al banco. Total disponibles: <strong>' + banco.length + '</strong></p>' +
            '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
                '<button id="btnSelectAllTab" class="btn-primary" style="background:var(--neon-green);color:#000;">SELECCIONAR TODO</button>' +
                '<button id="btnDeselectAllTab" class="btn-primary" style="background:var(--neon-pink);color:#fff;">DESELECCIONAR TODO</button>' +
                '<input type="text" id="filterBancoAutoTab" placeholder="Buscar pregunta..." class="input-dajox" style="flex:1;min-width:200px;">' +
            '</div>' +
            '<div id="listaBancoAutoTab" style="max-height:400px;overflow-y:auto;margin-bottom:12px;border:1px solid rgba(0,212,255,0.1);border-radius:6px;padding:10px;"></div>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">' +
                '<span style="color:var(--neon-cyan);font-weight:700;font-size:0.9rem;">Seleccionadas: <span id="countSelected">0</span></span>' +
            '</div>' +
            '<button id="btnAgregarDelBancoAuto" class="btn-primary" style="width:100%;background:var(--neon-cyan);color:#000;font-weight:700;">+ AGREGAR SELECCIONADAS AL BANCO TEMPORAL</button>' +
        '</div>';

    document.getElementById("btnSelectAllTab").onclick = function() {
        banco.forEach(function(p) { preguntasSeleccionadas.add(p.id); });
        renderListaBancoAuto();
        updateCountSelected();
    };
    document.getElementById("btnDeselectAllTab").onclick = function() {
        preguntasSeleccionadas.clear();
        renderListaBancoAuto();
        updateCountSelected();
    };
    cont.querySelector("#filterBancoAutoTab").oninput = function() {
        renderListaBancoAuto();
    };

    function updateCountSelected() {
        var el = cont.querySelector("#countSelected");
        if (el) el.textContent = preguntasSeleccionadas.size;
    }

    document.getElementById("btnAgregarDelBancoAuto").onclick = function() {
        if (preguntasSeleccionadas.size === 0) return alert("Selecciona al menos una pregunta");
        var preguntasSelec = banco.filter(function(p) { return preguntasSeleccionadas.has(p.id); });
        preguntasSelec.forEach(function(p) {
            bancoPreguntasTemp.push({
                pregunta: p.pregunta,
                image: p.image || '',
                opciones: p.opciones.map(function(o) { return { texto: o, imagen: '' }; }),
                correcta: p.correcta
            });
        });
        alert("✓ Se agregaron " + preguntasSelec.length + " preguntas al banco temporal");
        preguntasSeleccionadas.clear();
        renderListaBancoAuto();
        updateCountSelected();
        renderNbPreguntasTemp();
        // Cambiar a tab de crear propio
        document.getElementById("tabCrearPropio").click();
    };

    // Tabs
    document.getElementById("tabCrearPropio").onclick = function() {
        secCrearPropio.style.display = "";
        secBancoAuto.style.display = "none";
        this.style.background = "var(--neon-cyan)";
        this.style.color = "#000";
        this.style.border = "none";
        document.getElementById("tabBancoAuto").style.background = "transparent";
        document.getElementById("tabBancoAuto").style.color = "var(--neon-cyan)";
        document.getElementById("tabBancoAuto").style.border = "1px solid var(--neon-cyan)";
    };
    document.getElementById("tabBancoAuto").onclick = function() {
        secCrearPropio.style.display = "none";
        secBancoAuto.style.display = "";
        this.style.background = "var(--neon-cyan)";
        this.style.color = "#000";
        this.style.border = "none";
        document.getElementById("tabCrearPropio").style.background = "transparent";
        document.getElementById("tabCrearPropio").style.color = "var(--neon-cyan)";
        document.getElementById("tabCrearPropio").style.border = "1px solid var(--neon-cyan)";
        renderListaBancoAuto();
    };

    // Eventos - Crear Propio
    document.getElementById("nbPqImagen").oninput = function() {
        var url = this.value.trim();
        var prev = document.getElementById("nbPqImgPrev");
        if (url) {
            var img = document.createElement("img");
            img.referrerPolicy = "no-referrer";
            img.alt = "Vista previa";
            img.src = url;
            img.style.cssText = "max-height:70px;max-width:150px;object-fit:contain;border-radius:4px;border:1px solid var(--borde);";
            img.onerror = function() {
                prev.innerHTML = '<p style="color:var(--neon-pink);font-size:0.78rem;">URL no válida</p>';
            };
            prev.innerHTML = "";
            prev.appendChild(img);
        } else { 
            prev.innerHTML = ""; 
        }
    };

    document.getElementById("btnAgregarNbPq").onclick = function() {
        var enunciado = document.getElementById("nbPqEnunciado").value.trim();
        var imagen = document.getElementById("nbPqImagen").value.trim();
        var opciones = [0,1,2,3].map(function(i) { return document.getElementById("nbOp"+i).value.trim(); });
        var correctaRad = document.querySelector('input[name="nbCorrecta"]:checked');
        if (!enunciado) return alert("Escribe el enunciado");
        if (opciones.some(function(o) { return !o; })) return alert("Rellena todas las opciones");
        if (!correctaRad) return alert("Selecciona la opcion correcta");
        bancoPreguntasTemp.push({ 
            pregunta: enunciado, 
            image: imagen, 
            opciones: opciones.map(function(o) { return { texto: o, imagen: '' }; }), 
            correcta: parseInt(correctaRad.value) 
        });
        document.getElementById("nbPqEnunciado").value = "";
        document.getElementById("nbPqImagen").value = "";
        document.getElementById("nbPqImgPrev").innerHTML = "";
        ['A','B','C','D'].forEach(function(l, i) { document.getElementById("nbOp"+i).value = ""; });
        document.querySelector('input[name="nbCorrecta"]:checked').checked = false;
        renderNbPreguntasTemp();
    };

    document.getElementById("btnCrearBanco").onclick = function() {
        var titulo = document.getElementById("nbTitulo").value.trim();
        if (!titulo) return alert("Ingresa un título para el banco");
        if (bancoPreguntasTemp.length === 0) return alert("Agrega al menos una pregunta al banco");
        
        var puntajes = calcularPuntos(bancoPreguntasTemp.length, {});
        bancoPreguntasTemp.forEach(function(p, i) {
            p.puntos = puntajes[i];
        });

        var idx = appState.clases.findIndex(function(c) { return c.id === claseId; });
        if (!appState.clases[idx].bancoPreguntas) appState.clases[idx].bancoPreguntas = [];
        appState.clases[idx].bancoPreguntas.push({
            id: "BANCO-" + Date.now(),
            titulo: titulo,
            preguntas: bancoPreguntasTemp
        });
        guardarDatos();
        syncData();
        
        document.getElementById("nbTitulo").value = "";
        bancoPreguntasTemp = [];
        renderNbPreguntasTemp();
        alert("✓ Banco '" + titulo + "' creado con " + bancoPreguntasTemp.length + " preguntas\n\nLas preguntas aparecerán en el botón '04 // VER PREGUNTAS Y EXAMENES'");
    };

    renderNbPreguntasTemp();
}

/* ── Tab Examenes ── */
function renderTabExamenes(clase, cont, claseId) {
    var examenes = clase.examenesCreadosEstructurados || [];
    var exPregTemp = [];

    var listaHTML = examenes.map(function(ex) {
        return '<div class="item-lista">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
                '<div><p style="font-weight:700;">' + ex.nombre + '</p>' +
                '<p style="color:var(--texto-mutado);font-size:0.8rem;">' + (ex.preguntas||[]).length + ' preguntas</p></div>' +
                '<div style="display:flex;gap:6px;">' +
                    '<button class="btn-mini-azul" data-eid="' + ex.idExamen + '">VER</button>' +
                    '<button class="btn-mini-rojo" data-eid="' + ex.idExamen + '">✕</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    cont.innerHTML =
        '<div class="seccion-form">' +
            '<h4 style="margin-bottom:12px;">CREAR EXAMEN</h4>' +
            '<input type="text" id="exNombre" placeholder="// Nombre del examen" class="input-dajox" style="width:100%;margin-bottom:10px;">' +
            '<div id="exPregTemp" style="margin-bottom:10px;"></div>' +
            '<div class="sub-form">' +
                '<p style="font-size:0.82rem;color:var(--neon-cyan);margin-bottom:8px;letter-spacing:0.06em;">AGREGAR PREGUNTA AL EXAMEN:</p>' +
                '<input type="text" id="exPqEnunciado" placeholder="// Enunciado" class="input-dajox" style="width:100%;margin-bottom:6px;">' +
                '<input type="text" id="exPqImagen" placeholder="// URL imagen (opcional)" class="input-dajox" style="width:100%;margin-bottom:6px;">' +
                '<div id="exPqImgPrev" style="margin-bottom:6px;"></div>' +
                ['A','B','C','D'].map(function(l, i) {
                    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
                        '<label style="min-width:70px;font-size:0.8rem;color:var(--texto-mutado);">OPC ' + l + ':</label>' +
                        '<input type="text" id="exOp' + i + '" placeholder="Opcion ' + l + '" class="input-dajox" style="flex:1;font-size:0.84rem;">' +
                        '<label style="font-size:0.8rem;display:flex;align-items:center;gap:3px;cursor:pointer;color:var(--neon-green);">' +
                            '<input type="radio" name="exCorrecta" value="' + i + '"> ✓' +
                        '</label>' +
                    '</div>';
                }).join('') +
                '<button id="btnAgregarExPq" class="btn-primary" style="font-size:0.8rem;margin-top:8px;background:var(--neon-cyan);color:#000;">+ PREGUNTA</button>' +
            '</div>' +
            '<button id="btnCrearExamen" class="btn-primary" style="width:100%;margin-top:10px;">CREAR EXAMEN</button>' +
        '</div>' +
        '<h4 style="margin:18px 0 10px;">EXAMENES (' + examenes.length + ')</h4>' +
        (examenes.length === 0 ? '<p style="color:var(--texto-mutado);font-size:0.85rem;">// Sin examenes aun.</p>' : listaHTML);

    function renderExPregTemp() {
        var el = document.getElementById("exPregTemp");
        if (!el) return;
        el.innerHTML = exPregTemp.length === 0 ? '' :
            '<div class="temp-list"><p style="font-size:0.8rem;color:var(--texto-mutado);margin-bottom:4px;">Preguntas añadidas (' + exPregTemp.length + '):</p>' +
            exPregTemp.map(function(p, i) {
                return '<div style="background:var(--bg-main);padding:5px 10px;border-radius:4px;margin-bottom:3px;font-size:0.8rem;display:flex;justify-content:space-between;align-items:center;">' +
                    '<span>' + (i+1) + '. ' + p.pregunta + (p.image ? ' [img]' : '') + '</span>' +
                    '<button onclick="window._rmExPq(' + i + ')" style="background:var(--neon-pink);color:#fff;border:none;border-radius:3px;padding:1px 7px;cursor:pointer;font-size:0.76rem;">✕</button>' +
                '</div>';
            }).join('') + '</div>';
    }
    window._rmExPq = function(i) { exPregTemp.splice(i, 1); renderExPregTemp(); };

    document.getElementById("exPqImagen").oninput = function() {
        var url = this.value.trim();
        var prev = document.getElementById("exPqImgPrev");
        if (url) {
            var img = document.createElement("img");
            img.referrerPolicy = "no-referrer";
            img.alt = "Vista previa de la imagen del examen";
            img.src = url;
            img.style.cssText = "max-height:70px;max-width:150px;object-fit:contain;border-radius:4px;border:1px solid var(--borde);";
            img.onerror = function() {
                prev.innerHTML = '<p style="color:var(--neon-pink);font-size:0.78rem;">La URL no apunta directamente a una imagen. <a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" style="color:var(--neon-cyan);">Abrir URL</a></p>';
            };
            prev.innerHTML = "";
            prev.appendChild(img);
        } else { prev.innerHTML = ""; }
    };
    document.getElementById("exPqImagen").onchange = document.getElementById("exPqImagen").oninput;

    document.getElementById("btnAgregarExPq").onclick = function() {
        var enunciado = document.getElementById("exPqEnunciado").value.trim();
        var imagen = document.getElementById("exPqImagen").value.trim();
        var opciones = [0,1,2,3].map(function(i) { return document.getElementById("exOp"+i).value.trim(); });
        var correctaRad = document.querySelector('input[name="exCorrecta"]:checked');
        if (!enunciado) return alert("Escribe el enunciado");
        if (opciones.some(function(o) { return !o; })) return alert("Rellena todas las opciones");
        if (!correctaRad) return alert("Selecciona la opcion correcta");
        exPregTemp.push({ pregunta: enunciado, image: imagen, opciones: opciones, correcta: parseInt(correctaRad.value) });
        document.getElementById("exPqEnunciado").value = "";
        document.getElementById("exPqImagen").value = "";
        document.getElementById("exPqImgPrev").innerHTML = "";
        [0,1,2,3].forEach(function(i) { document.getElementById("exOp"+i).value = ""; });
        document.querySelectorAll('input[name="exCorrecta"]').forEach(function(r) { r.checked = false; });
        renderExPregTemp();
    };

    document.getElementById("btnCrearExamen").onclick = function() {
        var nombre = document.getElementById("exNombre").value.trim();
        if (!nombre) return alert("Escribe el nombre del examen");
        if (exPregTemp.length === 0) return alert("Agrega al menos una pregunta");
        var idx = appState.clases.findIndex(function(c) { return c.id === claseId; });
        if (!appState.clases[idx].examenesCreadosEstructurados) appState.clases[idx].examenesCreadosEstructurados = [];
        appState.clases[idx].examenesCreadosEstructurados.push({
            idExamen: "EX-" + Date.now(), nombre: nombre,
            tipo: "multiple_choice", preguntas: exPregTemp.slice()
        });
        guardarDatos();
        renderTabInstructor(claseId, "examenes");
    };

    cont.querySelectorAll(".btn-mini-azul[data-eid]").forEach(function(btn) {
        btn.onclick = function() { verDetalleExamen(claseId, btn.dataset.eid); };
    });
    cont.querySelectorAll(".btn-mini-rojo[data-eid]").forEach(function(btn) {
        btn.onclick = function() {
            if (!confirm("Eliminar examen?")) return;
            var idx = appState.clases.findIndex(function(c) { return c.id === claseId; });
            appState.clases[idx].examenesCreadosEstructurados = appState.clases[idx].examenesCreadosEstructurados.filter(function(e) { return e.idExamen !== btn.dataset.eid; });
            guardarDatos();
            renderTabInstructor(claseId, "examenes");
        };
    });
}

function verDetalleExamen(claseId, examId) {
    syncData();
    var clase = appState.clases.find(function(c) { return c.id === claseId; });
    var examen = (clase.examenesCreadosEstructurados || []).find(function(e) { return e.idExamen === examId; });
    if (!examen) return;
    var overlay = document.createElement("div");
    overlay.className = "neon-overlay";
    var preguntasHTML = (examen.preguntas || []).map(function(p, idx) {
        return '<div class="item-lista" style="border-left:2px solid var(--neon-cyan);">' +
            '<p style="font-weight:700;margin-bottom:8px;">' + (idx+1) + '. ' + p.pregunta + '</p>' +
            (p.image ? '<img src="' + p.image + '" style="max-height:100px;max-width:100%;object-fit:contain;border-radius:4px;margin-bottom:8px;display:block;" onerror="this.style.display=\'none\'">' : '') +
            p.opciones.map(function(op, i) {
                return '<div style="padding:5px 10px;border-radius:4px;margin-bottom:4px;font-size:0.85rem;' +
                    (i === p.correcta ? 'background:rgba(0,255,136,0.1);border-left:2px solid var(--neon-green);font-weight:700;color:var(--neon-green);' : 'background:rgba(255,255,255,0.02);') + '">' +
                    String.fromCharCode(65+i) + ') ' + op + (i === p.correcta ? ' ✓' : '') + '</div>';
            }).join('') +
        '</div>';
    }).join('');
    overlay.innerHTML =
        '<div class="neon-modal" style="max-width:680px;">' +
            '<button class="btn-cerrar-modal" id="btnCerrarDet">✕</button>' +
            '<h4 style="margin-bottom:16px;">' + examen.nombre.toUpperCase() + '</h4>' +
            preguntasHTML +
        '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector("#btnCerrarDet").onclick = function() { document.body.removeChild(overlay); };
}

/* ── Tab Montaje (instructor crea) ── */
function renderTabMontaje(clase, cont, claseId) {
    var montajes = clase.montajes || [];
    cont.innerHTML =
        '<div class="seccion-form">' +
            '<h4 style="margin-bottom:12px;">CREAR MONTAJE</h4>' +
            '<input type="text" id="mtNombre" placeholder="// Nombre del montaje" class="input-dajox" style="width:100%;margin-bottom:8px;">' +
            '<input type="text" id="mtFondo" placeholder="// URL imagen de fondo (opcional)" class="input-dajox" style="width:100%;margin-bottom:8px;">' +
            '<p style="font-size:0.82rem;color:var(--neon-cyan);margin-bottom:8px;letter-spacing:0.06em;">1. AGREGA LAS PIEZAS:</p>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
                '<select id="mtPiezaTipo" class="input-dajox" style="width:120px;">' +
                    '<option value="texto">Texto</option>' +
                    '<option value="imagen">Imagen (URL)</option>' +
                '</select>' +
                '<input type="text" id="mtPiezaContenido" placeholder="// Texto de la pieza" class="input-dajox" style="flex:1;">' +
                '<button id="btnAddPieza" class="btn-primary" style="background:var(--neon-purple);flex-shrink:0;font-size:0.8rem;">+ PIEZA</button>' +
            '</div>' +
            '<div id="mtPiezaImgPrev" style="margin-bottom:4px;"></div>' +
            '<div id="mtPiezasListIns" style="margin-bottom:12px;"></div>' +
            '<p style="font-size:0.82rem;color:var(--neon-cyan);margin-bottom:6px;letter-spacing:0.06em;">2. CLICK EN EL CANVAS PARA COLOCAR PUNTOS:</p>' +
            '<p style="font-size:0.78rem;color:var(--neon-purple);margin-bottom:8px;">Los aprendices veran los slots sin numeracion.</p>' +
            '<div id="mtCanvasWrap" style="position:relative;width:100%;height:320px;background:#020408;border:1px solid rgba(0,212,255,0.2);border-radius:8px;margin-bottom:8px;overflow:hidden;">' +
                '<img id="mtFondoImgIns" src="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;pointer-events:none;" onerror="this.style.display=\'none\'">' +
                '<canvas id="mtCanvasIns" style="position:absolute;inset:0;cursor:crosshair;"></canvas>' +
            '</div>' +
            '<div id="mtPuntosListIns" style="margin-bottom:10px;"></div>' +
            '<button id="btnCrearMontaje" class="btn-primary" style="width:100%;background:var(--neon-green);color:#000;">CREAR MONTAJE</button>' +
        '</div>' +
        '<h4 style="margin:18px 0 10px;">MONTAJES (' + montajes.length + ')</h4>' +
        (montajes.length === 0
            ? '<p style="color:var(--texto-mutado);font-size:0.85rem;">// Sin montajes aun.</p>'
            : montajes.map(function(m) {
                return '<div class="item-lista">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
                        '<div><p style="font-weight:700;">' + m.nombre + '</p>' +
                        '<p style="color:var(--texto-mutado);font-size:0.8rem;">' + (m.piezas||[]).length + ' piezas | ' + (m.puntos||[]).length + ' puntos</p></div>' +
                        '<button class="btn-mini-rojo" data-mid="' + m.id + '">✕</button>' +
                    '</div>' +
                '</div>';
            }).join(''));

    var mtPiezasTemp = [];
    var mtPuntosTemp = [];
    var canvas = document.getElementById("mtCanvasIns");
    var ctx = canvas.getContext("2d");

    /* Importante: esperar al paint para leer offsetWidth correctamente */
    function resizeCanvas() {
        var wrap = document.getElementById("mtCanvasWrap");
        if (!wrap || wrap.offsetWidth === 0) {
            setTimeout(resizeCanvas, 50);
            return;
        }
        canvas.width = wrap.offsetWidth;
        canvas.height = wrap.offsetHeight;
        drawCanvas();
    }
    function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        mtPuntosTemp.forEach(function(pt, i) {
            /* Sombra neon */
            ctx.shadowColor = "rgba(0,212,255,0.8)";
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(168,85,247,0.9)";
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "#00d4ff";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(i + 1, pt.x, pt.y);
        });
    }
    setTimeout(resizeCanvas, 0);

    /* Preview imagen de fondo */
    document.getElementById("mtFondo").oninput = function() {
        var url = this.value.trim();
        var img = document.getElementById("mtFondoImgIns");
        if (url) {
            img.referrerPolicy = "no-referrer";
            img.src = url;
            img.style.display = "block";
            img.onerror = function() { this.style.display = "none"; };
        } else {
            img.style.display = "none";
        }
    };

    function renderPiezasIns() {
        var el = document.getElementById("mtPiezasListIns");
        if (!el) return;
        if (mtPiezasTemp.length === 0) { el.innerHTML = ''; renderPuntosIns(); return; }
        var html = '<p style="font-size:0.8rem;color:var(--neon-cyan);margin-bottom:6px;font-weight:700;">PIEZAS CREADAS (' + mtPiezasTemp.length + '):</p>';
        mtPiezasTemp.forEach(function(p, i) {
            html += '<div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);padding:8px 10px;border-radius:6px;margin-bottom:5px;display:flex;align-items:center;gap:10px;">';
            html += '<span style="color:var(--neon-purple);font-weight:800;min-width:30px;">[' + (i+1) + ']</span>';
            if (p.tipo === "imagen") {
                html += '<img src="' + p.contenido + '" referrerpolicy="no-referrer" style="max-height:48px;max-width:80px;object-fit:contain;border-radius:4px;border:1px solid rgba(0,212,255,0.2);" onerror="this.outerHTML=\'<span style=\'color:var(--neon-pink);font-size:0.78rem;\'>URL invalida</span>\'">';
                html += '<span style="color:var(--texto-mutado);font-size:0.78rem;flex:1;" title="' + p.contenido + '">Imagen: ' + p.contenido.substring(0,30) + '...</span>';
            } else {
                html += '<span style="flex:1;font-weight:600;">' + p.contenido + '</span>';
            }
            html += '<button onclick="window._rmMtPieza(' + i + ')" style="background:var(--neon-pink);color:#fff;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:0.76rem;flex-shrink:0;">✕</button>';
            html += '</div>';
        });
        el.innerHTML = html;
        renderPuntosIns();
    }

    function renderPuntosIns() {
        var el = document.getElementById("mtPuntosListIns");
        if (!el) return;
        el.innerHTML = mtPuntosTemp.length === 0 ? '' :
            '<p style="font-size:0.8rem;color:var(--texto-mutado);margin-bottom:4px;">Puntos (' + mtPuntosTemp.length + '):</p>' +
            mtPuntosTemp.map(function(pt, i) {
                var opts = '<option value="">-- Pieza correcta --</option>' +
                    mtPiezasTemp.map(function(p, pi) {
                        return '<option value="' + pi + '"' + (pt.piezaIdx === pi ? ' selected' : '') + '>[P' + (pi+1) + '] ' + (p.tipo === "imagen" ? "Imagen" : p.contenido.substring(0,16)) + '</option>';
                    }).join('');
                return '<div style="background:var(--bg-main);padding:5px 10px;border-radius:4px;margin-bottom:3px;font-size:0.8rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                    '<span style="color:var(--neon-purple);font-weight:700;">PT ' + (i+1) + '</span>' +
                    '<span style="color:var(--texto-mutado);">(' + Math.round(pt.x) + ',' + Math.round(pt.y) + ')</span>' +
                    '<select data-ptidx="' + i + '" style="background:var(--bg-inputs);border:1px solid var(--borde);color:var(--texto-principal);border-radius:4px;padding:3px 6px;font-size:0.78rem;">' + opts + '</select>' +
                    '<button onclick="window._rmMtPunto(' + i + ')" style="background:var(--neon-pink);color:#fff;border:none;border-radius:3px;padding:1px 7px;cursor:pointer;font-size:0.76rem;margin-left:auto;">✕</button>' +
                '</div>';
            }).join('');
        el.querySelectorAll("select[data-ptidx]").forEach(function(sel) {
            sel.onchange = function() {
                var i = parseInt(this.dataset.ptidx);
                mtPuntosTemp[i].piezaIdx = this.value === "" ? null : parseInt(this.value);
            };
        });
    }

    window._rmMtPieza = function(i) { mtPiezasTemp.splice(i, 1); renderPiezasIns(); drawCanvas(); };
    window._rmMtPunto = function(i) { mtPuntosTemp.splice(i, 1); drawCanvas(); renderPuntosIns(); };

    /* Preview de imagen de pieza al tipear */
    document.getElementById("mtPiezaContenido").oninput = function() {
        var tipo = document.getElementById("mtPiezaTipo").value;
        var url = this.value.trim();
        var prev = document.getElementById("mtPiezaImgPrev");
        if (!prev) return;
        if (tipo === "imagen" && url) {
            prev.innerHTML = '<img src="' + url + '" referrerpolicy="no-referrer" style="max-height:60px;max-width:120px;object-fit:contain;border-radius:4px;border:1px solid rgba(0,212,255,0.2);margin-top:4px;" onerror="this.parentElement.innerHTML=\'<p style=\'color:var(--neon-pink);font-size:0.78rem;\'>URL invalida</p>\'">';
        } else {
            prev.innerHTML = '';
        }
    };
    document.getElementById("mtPiezaTipo").onchange = function() {
        document.getElementById("mtPiezaContenido").value = '';
        var prev = document.getElementById("mtPiezaImgPrev");
        if (prev) prev.innerHTML = '';
        var tipo = this.value;
        document.getElementById("mtPiezaContenido").placeholder = tipo === "imagen" ? "// URL de la imagen" : "// Texto de la pieza";
    };

    document.getElementById("btnAddPieza").onclick = function() {
        var tipo = document.getElementById("mtPiezaTipo").value;
        var contenido = document.getElementById("mtPiezaContenido").value.trim();
        if (!contenido) return alert("Ingresa el contenido de la pieza");
        mtPiezasTemp.push({ tipo: tipo, contenido: contenido, id: "PZ-" + Date.now() + "-" + mtPiezasTemp.length });
        document.getElementById("mtPiezaContenido").value = "";
        var prev = document.getElementById("mtPiezaImgPrev");
        if (prev) prev.innerHTML = '';
        renderPiezasIns();
    };

    canvas.onclick = function(e) {
        var rect = canvas.getBoundingClientRect();
        mtPuntosTemp.push({
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height),
            piezaIdx: null
        });
        drawCanvas();
        renderPuntosIns();
    };

    document.getElementById("btnCrearMontaje").onclick = function() {
        var nombre = document.getElementById("mtNombre").value.trim();
        var fondo = document.getElementById("mtFondo").value.trim();
        if (!nombre) return alert("Escribe el nombre");
        if (mtPiezasTemp.length === 0) return alert("Agrega al menos una pieza");
        if (mtPuntosTemp.length === 0) return alert("Coloca al menos un punto");
        if (mtPuntosTemp.some(function(pt) { return pt.piezaIdx === null || pt.piezaIdx === undefined; })) return alert("Asigna pieza a cada punto");
        var idx = appState.clases.findIndex(function(c) { return c.id === claseId; });
        if (!appState.clases[idx].montajes) appState.clases[idx].montajes = [];
        appState.clases[idx].montajes.push({
            id: "MT-" + Date.now(), nombre: nombre, fondo: fondo,
            canvasW: canvas.width, canvasH: canvas.height,
            piezas: mtPiezasTemp.slice(),
            puntos: mtPuntosTemp.map(function(pt, i) {
                return { id: "slot-" + i, x: pt.x, y: pt.y, piezaId: mtPiezasTemp[pt.piezaIdx].id };
            })
        });
        guardarDatos();
        renderTabInstructor(claseId, "montaje");
    };

    cont.querySelectorAll(".btn-mini-rojo[data-mid]").forEach(function(btn) {
        btn.onclick = function() {
            if (!confirm("Eliminar montaje?")) return;
            var idx = appState.clases.findIndex(function(c) { return c.id === claseId; });
            appState.clases[idx].montajes = appState.clases[idx].montajes.filter(function(m) { return m.id !== btn.dataset.mid; });
            guardarDatos();
            renderTabInstructor(claseId, "montaje");
        };
    });
}

/* ── Tab Resultados (instructor ve todo) ── */
function renderTabResultados(clase, cont) {
    var log = clase.answersLog || [];
    var alumnos = [];
    log.forEach(function(e) { if (e && e.alumno && alumnos.indexOf(e.alumno) === -1) alumnos.push(e.alumno); });
    if (alumnos.length === 0) {
        cont.innerHTML = '<p style="color:var(--texto-mutado);font-size:0.85rem;">// No hay resultados aun.</p>';
        return;
    }
    var html = '<h4 style="margin-bottom:16px;color:var(--neon-cyan);">RESULTADOS POR APRENDIZ</h4>';
    alumnos.forEach(function(alumno) {
        var logA = log.filter(function(e) { return e && e.alumno === alumno; });
        var pregInd = logA.filter(function(e) { return e.tipo === "pregunta_individual"; });
        var exTotal = logA.filter(function(e) { return e.tipo === "examen_total"; });
        var exPregInterna = logA.filter(function(e) { return e.tipo === "pregunta_examen_interna"; });
        var montLg = logA.filter(function(e) { return e.tipo === "montaje"; });
        var simLg = logA.filter(function(e) { return e.tipo === "simulador"; });
        var totalPuntos = 0, correctas = 0;
        pregInd.forEach(function(e) { if (e.esCorrecto) { correctas++; totalPuntos += (e.puntos || 0); } });

        html += '<div style="background:rgba(0,212,255,0.03);border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid rgba(0,212,255,0.1);">';
        html += '<p style="font-weight:700;color:var(--neon-cyan);margin-bottom:6px;letter-spacing:0.06em;">👤 ' + (alumno || 'Desconocido') + '</p>';
        html += '<p style="font-size:0.78rem;color:var(--texto-mutado);margin-bottom:12px;">Puntuación: <span style="color:var(--neon-purple);font-weight:700;">' + totalPuntos + ' pts</span> | Correctas: <span style="color:var(--neon-green);font-weight:700;">' + correctas + '/' + pregInd.length + '</span></p>';

        if (pregInd.length > 0) {
            html += '<p style="font-weight:600;color:var(--neon-purple);margin:12px 0 8px;font-size:0.85rem;">📋 PREGUNTAS INDIVIDUALES</p>';
            pregInd.forEach(function(e) {
                if (!e) return;
                html += '<div class="item-resultado" style="border-left-color:' + (e.esCorrecto ? 'var(--neon-green)' : 'var(--neon-pink)') + ';">';
                html += '<p style="font-size:0.85rem;font-weight:600;">' + (e.enunciado || 'Sin enunciado') + '</p>';
                if (e.image) html += '<img src="' + e.image + '" style="max-height:50px;object-fit:contain;border-radius:3px;margin:3px 0;display:block;" onerror="this.style.display=\'none\'">';
                if (e.opciones && Array.isArray(e.opciones)) {
                    var resp = e.opciones[e.seleccionada] || 'Opción desconocida';
                    html += '<p style="font-size:0.8rem;color:var(--texto-mutado);margin-top:4px;">Respondió: <span style="color:' + (e.esCorrecto ? 'var(--neon-green)' : 'var(--neon-pink)') + ';font-weight:700;">' + resp + '</span>';
                    if (!e.esCorrecto && e.correcta !== undefined && e.opciones[e.correcta]) html += ' | Correcta: <span style="color:var(--neon-green);font-weight:700;">' + e.opciones[e.correcta] + '</span>';
                    html += '</p>';
                }
                html += '<p style="font-size:0.78rem;margin-top:3px;color:' + (e.esCorrecto ? 'var(--neon-green)' : 'var(--neon-pink)') + ';font-weight:700;">' + (e.esCorrecto ? '✓ CORRECTO' : '✗ INCORRECTO') + ' | ' + (e.puntos || 0) + ' pts</p>';
                html += '</div>';
            });
        }

        if (exTotal.length > 0) {
            html += '<p style="font-weight:600;color:var(--neon-cyan);margin:12px 0 8px;font-size:0.85rem;">📝 EXAMENES</p>';
            exTotal.forEach(function(exT) {
                if (!exT) return;
                var det = exPregInterna.filter(function(e) { return e && e.idMeta === exT.idMeta; });
                var notaEx = exT.nota || 0;
                html += '<div class="item-lista">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
                html += '<p style="font-weight:700;font-size:0.88rem;">' + (exT.enunciado || 'Examen sin título') + '</p>';
                html += '<span style="background:' + (notaEx >= 60 ? 'rgba(0,255,136,0.2)' : 'rgba(255,45,85,0.2)') + ';color:' + (notaEx >= 60 ? 'var(--neon-green)' : 'var(--neon-pink)') + ';padding:4px 12px;border-radius:10px;font-size:0.8rem;font-weight:800;border:1px solid ' + (notaEx >= 60 ? 'rgba(0,255,136,0.4)' : 'rgba(255,45,85,0.4)') + ';">' + notaEx.toFixed(1) + '%</span>';
                html += '</div>';
                det.forEach(function(e, i) {
                    if (!e) return;
                    html += '<div class="item-resultado" style="border-left-color:' + (e.esCorrecto ? 'var(--neon-green)' : 'var(--neon-pink)') + ';">';
                    html += '<p style="font-size:0.82rem;font-weight:600;">' + (i+1) + '. ' + (e.enunciado || 'Pregunta sin título') + '</p>';
                    if (e.image) html += '<img src="' + e.image + '" style="max-height:50px;object-fit:contain;border-radius:3px;margin:3px 0;display:block;" onerror="this.style.display=\'none\'">';
                    if (e.opciones && Array.isArray(e.opciones) && e.seleccionada !== undefined) {
                        var respE = e.opciones[e.seleccionada] || 'Opción desconocida';
                        html += '<p style="font-size:0.78rem;color:var(--texto-mutado);margin-top:3px;">Resp: <span style="color:' + (e.esCorrecto ? 'var(--neon-green)' : 'var(--neon-pink)') + ';font-weight:700;">' + respE + '</span>';
                        if (!e.esCorrecto && e.correcta !== undefined && e.opciones[e.correcta]) html += ' | OK: <span style="color:var(--neon-green);font-weight:700;">' + e.opciones[e.correcta] + '</span>';
                        html += '</p>';
                    }
                    html += '</div>';
                });
                html += '</div>';
            });
        }

        if (montLg.length > 0) {
            html += '<p style="font-weight:600;color:var(--neon-purple);margin:12px 0 8px;font-size:0.85rem;">🔧 MONTAJES</p>';
            montLg.forEach(function(e) {
                if (!e) return;
                var notaM = e.nota || 0;
                html += '<div class="item-resultado" style="border-left-color:' + (notaM >= 60 ? 'var(--neon-green)' : 'var(--neon-pink)') + ';display:flex;justify-content:space-between;align-items:center;">';
                html += '<div><p style="font-size:0.85rem;font-weight:600;">' + (e.enunciado || 'Montaje sin título') + '</p></div>';
                html += '<span style="font-size:0.8rem;font-weight:800;color:' + (notaM >= 60 ? 'var(--neon-green)' : 'var(--neon-pink)') + ';white-space:nowrap;margin-left:10px;">' + notaM.toFixed(1) + '% (' + (e.correctas || 0) + '/' + (e.total || 0) + ')</span>';
                html += '</div>';
            });
        }

        if (simLg.length > 0) {
            html += '<p style="font-weight:600;color:var(--neon-green);margin:12px 0 8px;font-size:0.85rem;">⚙️ SIMULACIONES</p>';
            simLg.forEach(function(e) {
                if (!e) return;
                var notaS = e.nota || 0;
                html += '<div class="item-resultado" style="border-left-color:var(--neon-green);display:flex;justify-content:space-between;align-items:center;">';
                html += '<div><p style="font-size:0.85rem;font-weight:600;">' + (e.enunciado || 'Simulación sin título') + '</p></div>';
                html += '<span style="font-size:0.8rem;font-weight:800;color:var(--neon-green);white-space:nowrap;margin-left:10px;">' + notaS.toFixed(1) + '%</span>';
                html += '</div>';
            });
        }

        html += '</div>';
    });
    cont.innerHTML = html;
}

/* ==========================================================================
   APRENDIZ
   ========================================================================== */
function initAprendiz() {
    var btnUnirse = document.getElementById("btnUnirse");
    if (btnUnirse) {
        btnUnirse.onclick = function() {
            var cod = document.getElementById("apCodigo").value.trim().toUpperCase();
            syncData();
            var obj = appState.clases.find(function(c) { return c.id === cod; });
            if (!obj) return alert("Codigo incorrecto. Verifica con tu instructor.");
            if (typeof DajoxDB !== "undefined") {
                DajoxDB.enrollStudent(cod, appState.user.email);
                DajoxDB.subscribeClass(cod);
            } else {
                var key = "dajox_joined_" + appState.user.email;
                var joined = JSON.parse(localStorage.getItem(key) || "[]");
                if (joined.indexOf(cod) === -1) joined.push(cod);
                localStorage.setItem(key, JSON.stringify(joined));
                var ci = appState.clases.findIndex(function(c) { return c.id === cod; });
                if (ci !== -1) {
                    if (!appState.clases[ci].inscritos) appState.clases[ci].inscritos = [];
                    if (appState.clases[ci].inscritos.indexOf(appState.user.email) === -1) {
                        appState.clases[ci].inscritos.push(appState.user.email);
                        guardarDatos();
                    }
                }
            }
            document.getElementById("apCodigo").value = "";
            alert("Vinculado a " + obj.nombre + " exitosamente!");
            syncData();
            renderAprendizClases();
        };
    }
    renderAprendizClases();
}

function renderAprendizClases() {
    syncData();
    renderSyncBanner();
    var key = "dajox_joined_" + appState.user.email;
    var joined = JSON.parse(localStorage.getItem(key) || "[]");
    // Mostrar SOLO las clases a las que está vinculado (joined)
    var misClases = appState.clases.filter(function(c) { return c && c.id && joined.indexOf(c.id) !== -1; });
    var cont = document.getElementById("listaClasesAprendiz");
    cont.innerHTML = "";
    if (misClases.length === 0) {
        cont.innerHTML = '<p style="color:var(--texto-mutado);margin-top:14px;font-size:0.85rem;letter-spacing:0.06em;">// SIN CLASES VINCULADAS AUN. UTILIZA EL CODIGO DE ENLACE PARA VINCULARTE.</p>';
        return;
    }
    misClases.forEach(function(clase) {
        var log = (clase.answersLog || []).filter(function(e) { return e.alumno === appState.user.email; });
        var pqResp = log.filter(function(e) { return e.tipo === "pregunta_individual"; }).map(function(e) { return e.idMeta; });
        var exRes = log.filter(function(e) { return e.tipo === "examen_total"; }).map(function(e) { return e.idMeta; });
        var mtRes = log.filter(function(e) { return e.tipo === "montaje"; }).map(function(e) { return e.idMeta; });
        var pqPend = (clase.preguntasIndividuales || []).filter(function(p) { return pqResp.indexOf(p.id) === -1; }).length;
        var exPend = (clase.examenesCreadosEstructurados || []).filter(function(e) { return exRes.indexOf(e.idExamen) === -1; }).length;
        var mtPend = (clase.montajes || []).filter(function(m) { return mtRes.indexOf(m.id) === -1; }).length;

        var card = document.createElement("div");
        card.className = "card-clase-ins";
        var badges = '';
        if (pqPend > 0) badges += '<span class="badge-pend-purple">' + pqPend + ' PREGUNTAS</span>';
        if (exPend > 0) badges += '<span class="badge-pend-cyan">' + exPend + ' EXAMENES</span>';
        if (mtPend > 0) badges += '<span class="badge-pend-purple">' + mtPend + ' MONTAJES</span>';
        if (pqPend + exPend + mtPend === 0) badges += '<span class="badge-ok">AL DIA</span>';

        card.innerHTML =
            '<div class="clase-nombre">' + clase.nombre.toUpperCase() + '</div>' +
            '<p style="font-size:0.72rem;color:var(--texto-mutado);letter-spacing:0.08em;margin-bottom:10px;">FICHA: ' + clase.ficha + ' | INST: ' + clase.instructor + '</p>' +
            '<div class="sep-neon"></div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px;">' + badges + '</div>' +
            '<button class="btn-accion btn-accion-azul btn-abrir-clase" style="width:100%;">ACCEDER A LA CLASE</button>';

        card.querySelector(".btn-abrir-clase").onclick = function() { abrirPanelAprendiz(clase.id); };
        cont.appendChild(card);
    });
}

function abrirPanelAprendiz(claseId) {
    syncData();
    var clase = appState.clases.find(function(c) { return c.id === claseId; });
    if (!clase) return;
     
    // AUTO-INSCRIBIR al aprendiz en la clase si no está ya inscrito
    var key = "dajox_joined_" + appState.user.email;
    var joined = JSON.parse(localStorage.getItem(key) || "[]");
    if (joined.indexOf(claseId) === -1) {
        if (typeof DajoxDB !== "undefined") {
            DajoxDB.enrollStudent(claseId, appState.user.email);
            DajoxDB.subscribeClass(claseId);
        } else {
            joined.push(claseId);
            localStorage.setItem(key, JSON.stringify(joined));
            var ci = appState.clases.findIndex(function(c) { return c.id === claseId; });
            if (ci !== -1) {
                if (!appState.clases[ci].inscritos) appState.clases[ci].inscritos = [];
                if (appState.clases[ci].inscritos.indexOf(appState.user.email) === -1) {
                    appState.clases[ci].inscritos.push(appState.user.email);
                    guardarDatos();
                }
            }
        }
    }
     
    // Crear ID único para esta pestaña
    var pestaId = "pestaña-ap-" + claseId + "-" + Date.now();
    
    // Crear overlay y modal únicos
    var overlay = document.createElement("div");
    overlay.className = "neon-overlay";
    overlay.id = pestaId;
    
    var modal = document.createElement("div");
    modal.className = "neon-modal";
    modal.style.maxWidth = "700px";
    
    var btnCerrar = document.createElement("button");
    btnCerrar.className = "btn-cerrar-modal";
    btnCerrar.textContent = "✕";
    
    var header = document.createElement("div");
    header.innerHTML = 
        '<h3 style="margin-bottom:4px;">' + clase.nombre.toUpperCase() + '</h3>' +
        '<p style="color:var(--texto-mutado);font-size:0.78rem;margin-bottom:18px;letter-spacing:0.06em;">FICHA: ' + clase.ficha + '</p>';
    
    var tabsBar = document.createElement("div");
    tabsBar.className = "tabs-bar";
    tabsBar.innerHTML =
        '<button class="tab-ap-btn btn-primary" data-tab="preguntas" style="background:linear-gradient(135deg,#7c3aed,#a855f7);">PREGUNTAS</button>' +
        '<button class="tab-ap-btn btn-primary" data-tab="examenes" style="background:var(--neon-cyan);color:#000;">EXAMENES</button>' +
        '<button class="tab-ap-btn btn-primary" data-tab="montajes" style="background:var(--neon-purple);">MONTAJES</button>' +
        '<button class="tab-ap-btn btn-primary" data-tab="historial" style="background:var(--neon-green);color:#000;">HISTORIAL</button>';
    
    var contenido = document.createElement("div");
    contenido.id = "cont-ap-" + pestaId;
    
    modal.appendChild(btnCerrar);
    modal.appendChild(header);
    modal.appendChild(tabsBar);
    modal.appendChild(contenido);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Evento cerrar
    btnCerrar.onclick = function() {
        document.body.removeChild(overlay);
        renderAprendizClases();
    };
    
    // Eventos de tabs
    tabsBar.querySelectorAll(".tab-ap-btn").forEach(function(t) {
        t.onclick = function() { renderTabAprendizIndependiente(claseId, this.dataset.tab, contenido.id); };
    });
    
    // Renderizar contenido inicial
    renderTabAprendizIndependiente(claseId, "preguntas", contenido.id);
}

function renderTabAprendizIndependiente(claseId, tab, contenedorId) {
    syncData();
    var clase = appState.clases.find(function(c) { return c.id === claseId; });
    var cont = document.getElementById(contenedorId);
    if (!cont) return;
    if (tab === "preguntas") renderTabApPreguntas(clase, cont, claseId);
    else if (tab === "examenes") renderTabApExamenes(clase, cont, claseId);
    else if (tab === "montajes") renderTabApMontajes(clase, cont, claseId);
    else if (tab === "historial") renderTabApHistorial(clase, cont);
}

/* ── Aprendiz: Pregunta individual (desaparece al responder) ── */
function renderTabApPreguntas(clase, cont, claseId) {
    var log = (clase.answersLog || []).filter(function(e) { return e.alumno === appState.user.email && e.tipo === "pregunta_individual"; });
    var respondidas = log.map(function(e) { return e.idMeta; });
    var pendientes = (clase.preguntasIndividuales || []).filter(function(p) { return respondidas.indexOf(p.id) === -1; });
    var total = (clase.preguntasIndividuales || []).length;

    if (pendientes.length === 0) {
        cont.innerHTML = '<div style="text-align:center;padding:40px;"><p style="font-size:2rem;margin-bottom:10px;">✓</p><p style="font-weight:700;color:var(--neon-green);letter-spacing:0.06em;">TODAS LAS PREGUNTAS COMPLETADAS</p><p style="color:var(--texto-mutado);font-size:0.85rem;margin-top:6px;">Revisa tu historial para ver tus resultados.</p></div>';
        return;
    }

    var pregunta = pendientes[0];
    var opcionesHTML = pregunta.opciones.map(function(op, i) {
        var esImg = op.startsWith("http") || op.startsWith("data:image");
        return '<label id="lblOp_' + i + '" style="background:rgba(255,255,255,0.02);border:1px solid rgba(0,212,255,0.15);padding:12px 14px;border-radius:8px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:all 0.2s;">' +
            '<input type="radio" name="respAp" value="' + i + '" style="cursor:pointer;flex-shrink:0;">' +
            (esImg ? '<img src="' + op + '" style="max-height:80px;border-radius:4px;" onerror="this.style.display=\'none\'">' : '<span>' + String.fromCharCode(65+i) + '. ' + op + '</span>') +
        '</label>';
    }).join('');

    cont.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
            '<p style="color:var(--texto-mutado);font-size:0.82rem;letter-spacing:0.06em;">PREGUNTA ' + (respondidas.length+1) + ' DE ' + total + '</p>' +
            '<span style="background:rgba(168,85,247,0.15);color:var(--neon-purple);border:1px solid rgba(168,85,247,0.3);padding:3px 10px;border-radius:10px;font-size:0.8rem;font-weight:700;">' + pregunta.puntos + ' PTS</span>' +
        '</div>' +
        '<div class="card" id="cardPregunta">' +
            '<p style="font-weight:700;font-size:1.05rem;margin-bottom:14px;color:var(--texto-principal);">' + pregunta.pregunta + '</p>' +
            (pregunta.image ? '<img src="' + pregunta.image + '" style="max-height:180px;max-width:100%;object-fit:contain;display:block;border-radius:8px;border:1px solid rgba(0,212,255,0.2);margin-bottom:14px;" onerror="this.style.display=\'none\'">' : '') +
            '<div style="display:flex;flex-direction:column;gap:8px;" id="opcionesPQ">' + opcionesHTML + '</div>' +
            '<button id="btnConfirmarResp" class="btn-primary" style="width:100%;margin-top:16px;">CONFIRMAR RESPUESTA</button>' +
        '</div>' +
        (pendientes.length - 1 > 0 ? '<p style="text-align:center;color:var(--texto-mutado);font-size:0.82rem;margin-top:10px;">' + (pendientes.length-1) + ' pregunta(s) restantes</p>' : '');

    document.getElementById("btnConfirmarResp").onclick = function() {
        var checked = cont.querySelector('input[name="respAp"]:checked');
        if (!checked) return alert("Selecciona una opcion.");
        var seleccionada = parseInt(checked.value);
        var esCorrecto = seleccionada === pregunta.correcta;

        document.getElementById("btnConfirmarResp").disabled = true;
        cont.querySelectorAll('input[name="respAp"]').forEach(function(r) { r.disabled = true; });

        pregunta.opciones.forEach(function(_, i) {
            var lbl = document.getElementById("lblOp_" + i);
            if (i === pregunta.correcta) {
                lbl.style.borderColor = "var(--neon-green)";
                lbl.style.background = "rgba(0,255,136,0.1)";
                lbl.style.boxShadow = "0 0 12px rgba(0,255,136,0.2)";
            } else if (i === seleccionada && !esCorrecto) {
                lbl.style.borderColor = "var(--neon-pink)";
                lbl.style.background = "rgba(255,45,85,0.1)";
            }
        });

        var banner = document.createElement("div");
        banner.style.cssText = "text-align:center;padding:16px;margin-top:14px;border-radius:8px;background:" + (esCorrecto ? "rgba(0,255,136,0.08)" : "rgba(255,45,85,0.08)") + ";border:1px solid " + (esCorrecto ? "var(--neon-green)" : "var(--neon-pink)") + ";box-shadow:" + (esCorrecto ? "var(--glow-green)" : "var(--glow-red)") + ";";
        banner.innerHTML =
            '<p style="font-size:1.5rem;margin-bottom:4px;">' + (esCorrecto ? "✓" : "✗") + '</p>' +
            '<p style="font-weight:800;color:' + (esCorrecto ? "var(--neon-green)" : "var(--neon-pink)") + ';font-size:1rem;letter-spacing:0.06em;">' + (esCorrecto ? "CORRECTO" : "INCORRECTO") + '</p>' +
            '<p style="font-size:0.85rem;color:var(--texto-mutado);margin-top:5px;">' + (esCorrecto ? "+" + pregunta.puntos + " puntos" : "Correcta: " + String.fromCharCode(65+pregunta.correcta) + ". " + pregunta.opciones[pregunta.correcta]) + '</p>';
        document.getElementById("cardPregunta").appendChild(banner);
        var nextButton = null;
        var hasMore = pendientes.length > 1;
        if (hasMore) {
            nextButton = document.createElement("button");
            nextButton.className = "btn-primary";
            nextButton.style.cssText = "width:100%;margin-top:16px;background:var(--neon-green);color:#000;";
            nextButton.textContent = "SIGUIENTE PREGUNTA";
            nextButton.onclick = function() {
                syncData();
                var claseActual = appState.clases.find(function(c) { return c.id === claseId; });
                if (!claseActual) return;
                renderTabApPreguntas(claseActual, cont, claseId);
            };
            document.getElementById("cardPregunta").appendChild(nextButton);
        }

        var entry = {
            alumno: appState.user.email, tipo: "pregunta_individual",
            idMeta: pregunta.id, enunciado: pregunta.pregunta,
            image: pregunta.image || "", opciones: pregunta.opciones,
            seleccionada: seleccionada, correcta: pregunta.correcta,
            esCorrecto: esCorrecto, puntos: esCorrecto ? pregunta.puntos : 0,
            timestamp: Date.now()
        };
        if (typeof DajoxDB !== "undefined") {
            DajoxDB.recordAnswer(claseId, entry);
            var updCls = DajoxDB.getClass(claseId);
            if (updCls && typeof mqttPublishClass === "function") mqttPublishClass(updCls);
        } else {
            var clases = JSON.parse(localStorage.getItem("dajox_clases_v3")) || [];
            var ci = clases.findIndex(function(c) { return c.id === claseId; });
            if (ci !== -1) {
                if (!clases[ci].answersLog) clases[ci].answersLog = [];
                clases[ci].answersLog.push(entry);
                localStorage.setItem("dajox_clases_v3", JSON.stringify(clases));
            }
        }
        syncData();
        if (!hasMore) {
            var endMessage = document.createElement("div");
            endMessage.style.cssText = "margin-top:16px;padding:14px;border-radius:10px;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.1);";
            endMessage.innerHTML = '<p style="font-weight:700;color:var(--neon-cyan);">Has terminado todas las preguntas disponibles.</p><p style="color:var(--texto-mutado);font-size:0.85rem;">Revisa tu historial para ver tus respuestas.</p>';
            document.getElementById("cardPregunta").appendChild(endMessage);
        }
    };
}

/* ── Aprendiz: Examenes ── */
function renderTabApExamenes(clase, cont, claseId) {
    var log = (clase.answersLog || []).filter(function(e) { return e.alumno === appState.user.email && e.tipo === "examen_total"; });
    var exRes = log.map(function(e) { return e.idMeta; });
    var examenes = clase.examenesCreadosEstructurados || [];
    if (examenes.length === 0) {
        cont.innerHTML = '<p style="color:var(--texto-mutado);font-size:0.85rem;">// No hay examenes en esta clase.</p>';
        return;
    }
    var html = '<div style="display:flex;flex-direction:column;gap:12px;">';
    examenes.forEach(function(ex) {
        var resuelto = exRes.indexOf(ex.idExamen) !== -1;
        var resultado = resuelto ? log.find(function(e) { return e.idMeta === ex.idExamen; }) : null;
        html += '<div class="item-lista" style="border-left-color:' + (resuelto ? 'var(--neon-green)' : 'var(--neon-cyan)') + ';">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
                '<div><p style="font-weight:700;">' + ex.nombre + '</p>' +
                '<p style="color:var(--texto-mutado);font-size:0.8rem;">' + (ex.preguntas||[]).length + ' preguntas</p>' +
                (resuelto ? '<span style="font-size:0.78rem;background:' + (resultado.nota >= 60 ? 'rgba(0,255,136,0.1)' : 'rgba(255,45,85,0.1)') + ';color:' + (resultado.nota >= 60 ? 'var(--neon-green)' : 'var(--neon-pink)') + ';border:1px solid ' + (resultado.nota >= 60 ? 'rgba(0,255,136,0.3)' : 'rgba(255,45,85,0.3)') + ';padding:2px 8px;border-radius:8px;margin-top:4px;display:inline-block;">NOTA: ' + resultado.nota + '%</span>' : '') +
                '</div>' +
                (!resuelto ? '<button class="btn-accion btn-accion-azul btn-iniciar-ex" data-cid="' + claseId + '" data-eid="' + ex.idExamen + '" style="flex-shrink:0;padding:8px 14px;">INICIAR</button>' : '<span style="color:var(--neon-green);font-weight:700;font-size:0.85rem;flex-shrink:0;">COMPLETADO</span>') +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    cont.innerHTML = html;
    cont.querySelectorAll(".btn-iniciar-ex").forEach(function(btn) {
        btn.onclick = function() {
            window.location.href = 'quiz.html?claseId=' + btn.dataset.cid + '&examId=' + btn.dataset.eid + '&modo=normal';
        };
    });
}

/* ── Aprendiz: Montajes ── */
function renderTabApMontajes(clase, cont, claseId) {
    var log = (clase.answersLog || []).filter(function(e) { return e.alumno === appState.user.email && e.tipo === "montaje"; });
    var mtRes = log.map(function(e) { return e.idMeta; });
    var montajes = clase.montajes || [];
    if (montajes.length === 0) {
        cont.innerHTML = '<p style="color:var(--texto-mutado);font-size:0.85rem;">// No hay montajes en esta clase.</p>';
        return;
    }
    var html = '<div style="display:flex;flex-direction:column;gap:12px;">';
    montajes.forEach(function(m) {
        var resuelto = mtRes.indexOf(m.id) !== -1;
        var resultado = resuelto ? log.find(function(e) { return e.idMeta === m.id; }) : null;
        html += '<div class="item-lista" style="border-left-color:' + (resuelto ? 'var(--neon-green)' : 'var(--neon-purple)') + ';">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
                '<div><p style="font-weight:700;">' + m.nombre + '</p>' +
                '<p style="color:var(--texto-mutado);font-size:0.8rem;">' + (m.piezas||[]).length + ' piezas</p>' +
                (resuelto ? '<span style="font-size:0.78rem;background:' + (resultado.nota >= 60 ? 'rgba(0,255,136,0.1)' : 'rgba(255,45,85,0.1)') + ';color:' + (resultado.nota >= 60 ? 'var(--neon-green)' : 'var(--neon-pink)') + ';border:1px solid ' + (resultado.nota >= 60 ? 'rgba(0,255,136,0.3)' : 'rgba(255,45,85,0.3)') + ';padding:2px 8px;border-radius:8px;margin-top:4px;display:inline-block;">NOTA: ' + resultado.nota + '% (' + resultado.correctas + '/' + resultado.total + ')</span>' : '') +
                '</div>' +
                (!resuelto ? '<button class="btn-accion btn-accion-morado btn-iniciar-mt" data-mid="' + m.id + '" style="flex-shrink:0;padding:8px 14px;">INICIAR</button>' : '<span style="color:var(--neon-green);font-weight:700;font-size:0.85rem;flex-shrink:0;">COMPLETADO</span>') +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    cont.innerHTML = html;
    cont.querySelectorAll(".btn-iniciar-mt").forEach(function(btn) {
        btn.onclick = function() { iniciarMontajeAp(claseId, btn.dataset.mid, cont); };
    });
}

function iniciarMontajeAp(claseId, montajeId, cont) {
    syncData();
    var clase = appState.clases.find(function(c) { return c.id === claseId; });
    var montaje = (clase.montajes || []).find(function(m) { return m.id === montajeId; });
    if (!montaje) return;
    if (!cont) { cont = document.getElementById("tabApCont"); }
    var piezasShuffled = montaje.piezas.slice().sort(function() { return Math.random() - 0.5; });
    var placements = {};  /* slotId -> piezaId */
    var canvasW = montaje.canvasW || 700;
    var canvasH = montaje.canvasH || 340;
    var pctPad = ((canvasH / canvasW) * 100).toFixed(2);

    /* ── Renderizar banco de piezas ── */
    var bancoPiezasHTML = piezasShuffled.map(function(p) {
        var inner = p.tipo === "imagen"
            ? '<img src="' + p.contenido + '" referrerpolicy="no-referrer" style="max-height:55px;max-width:90px;object-fit:contain;border-radius:4px;pointer-events:none;" onerror="this.parentElement.innerHTML=\'<span style=\'font-size:0.8rem;\'>IMG</span>\'">'
            : '<span style="font-size:0.9rem;font-weight:700;pointer-events:none;">' + p.contenido + '</span>';
        return '<div id="pieza_ap_' + p.id + '" draggable="true" data-pieza-id="' + p.id + '" class="pieza-draggable" style="cursor:grab;transition:opacity 0.2s,transform 0.15s;user-select:none;">' + inner + '</div>';
    }).join('');

    /* ── Renderizar slots (sin números para el aprendiz) ── */
    var slotsHTML = montaje.puntos.map(function(pt) {
        var pctX = ((pt.x / canvasW) * 100).toFixed(2);
        var pctY = ((pt.y / canvasH) * 100).toFixed(2);
        return '<div id="slot_ap_' + pt.id + '"' +
            ' data-slot-id="' + pt.id + '"' +
            ' data-pieza-correcta="' + pt.piezaId + '"' +
            ' style="position:absolute;left:' + pctX + '%;top:' + pctY + '%;transform:translate(-50%,-50%);' +
                    'width:68px;height:68px;border:2px dashed rgba(0,212,255,0.35);border-radius:10px;' +
                    'background:rgba(0,212,255,0.04);display:flex;align-items:center;justify-content:center;' +
                    'overflow:hidden;transition:all 0.2s;">' +
            '<span class="slot-hint" style="color:rgba(0,212,255,0.3);font-size:1.6rem;pointer-events:none;">○</span>' +
        '</div>';
    }).join('');

    cont.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
            '<h4>' + montaje.nombre.toUpperCase() + '</h4>' +
            '<button class="btn-mini-rojo" id="btnVolverMt">← VOLVER</button>' +
        '</div>' +
        '<p style="color:var(--texto-mutado);font-size:0.82rem;margin-bottom:12px;">Arrastra cada pieza al espacio que le corresponde en el diagrama.</p>' +
        /* Banco */
        '<div style="background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.2);border-radius:10px;padding:14px;margin-bottom:14px;">' +
            '<p style="font-size:0.76rem;color:var(--neon-purple);margin-bottom:10px;font-weight:700;letter-spacing:0.08em;">BANCO DE PIEZAS — arrastra al diagrama</p>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;" id="bancoPiezasAp">' + bancoPiezasHTML + '</div>' +
        '</div>' +
        /* Canvas con aspect-ratio preservado */
        '<div style="position:relative;width:100%;max-width:' + canvasW + 'px;margin:0 auto;' +
             'background:#020408;border:1px solid rgba(0,212,255,0.2);border-radius:12px;overflow:hidden;" id="canvasApMontaje">' +
            '<div style="padding-top:' + pctPad + '%;"></div>' +
            (montaje.fondo ? '<img src="' + montaje.fondo + '" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;opacity:0.55;" onerror="this.style.display=\'none\'">' : '') +
            slotsHTML +
        '</div>' +
        /* Progreso */
        '<div style="margin:12px auto;max-width:' + canvasW + 'px;display:flex;justify-content:space-between;align-items:center;">' +
            '<p id="lblProgreso" style="font-size:0.82rem;color:var(--texto-mutado);">Piezas colocadas: <span id="cntColocadas">0</span>/' + montaje.puntos.length + '</p>' +
        '</div>' +
        '<button id="btnEnviarMontajeAp" class="btn-accion btn-accion-verde" style="width:100%;max-width:' + canvasW + 'px;margin:0 auto;display:block;">ENVIAR MONTAJE</button>';

    document.getElementById("btnVolverMt").onclick = function() { renderTabApMontajes(clase, cont, claseId); };

    /* ── Drag & Drop ── */
    var dragPiezaId = null;

    function actualizarProgreso() {
        var n = Object.keys(placements).length;
        var el = document.getElementById("cntColocadas");
        if (el) el.textContent = n;
    }

    function colocarPieza(slotId, piezaId) {
        var slot = document.getElementById("slot_ap_" + slotId);
        var piezaEl = document.getElementById("pieza_ap_" + piezaId);
        var mont = (appState.clases.find(function(c) { return c.id === claseId; }).montajes || []).find(function(m) { return m.id === montajeId; });
        var pieza = mont && mont.piezas.find(function(p) { return p.id === piezaId; });
        if (!pieza || !slot) return;
        /* Devolver pieza anterior al banco si había una */
        if (placements[slotId] && placements[slotId] !== piezaId) {
            var prevEl = document.getElementById("pieza_ap_" + placements[slotId]);
            if (prevEl) { prevEl.style.opacity = "1"; prevEl.style.transform = ""; }
        }
        placements[slotId] = piezaId;
        piezaEl.style.opacity = "0.25";
        piezaEl.style.transform = "scale(0.9)";
        var hint = slot.querySelector(".slot-hint");
        if (hint) hint.remove();
        if (pieza.tipo === "imagen") {
            slot.innerHTML = '<img src="' + pieza.contenido + '" referrerpolicy="no-referrer" style="max-height:62px;max-width:62px;object-fit:contain;border-radius:6px;" onerror="this.style.display=\'none\'">';
        } else {
            slot.innerHTML = '<span style="font-size:0.74rem;font-weight:700;text-align:center;color:var(--texto-principal);padding:3px;word-break:break-word;line-height:1.2;">' + pieza.contenido.substring(0, 16) + '</span>';
        }
        slot.style.borderColor = "var(--neon-cyan)";
        slot.style.borderStyle = "solid";
        slot.style.background = "rgba(0,212,255,0.1)";
        slot.style.boxShadow = "0 0 12px rgba(0,212,255,0.3)";
        actualizarProgreso();
    }

    /* Drag & Drop estándar */
    cont.querySelectorAll(".pieza-draggable").forEach(function(el) {
        el.ondragstart = function(e) {
            dragPiezaId = el.dataset.piezaId;
            e.dataTransfer.setData("text/plain", dragPiezaId);
            el.style.opacity = "0.5";
        };
        el.ondragend = function() { el.style.opacity = placements && Object.values(placements).indexOf(el.dataset.piezaId) !== -1 ? "0.25" : "1"; };
    });

    montaje.puntos.forEach(function(pt) {
        var slot = document.getElementById("slot_ap_" + pt.id);
        if (!slot) return;
        slot.ondragover = function(e) {
            e.preventDefault();
            slot.style.background = "rgba(0,212,255,0.15)";
        };
        slot.ondragleave = function() {
            if (!placements[pt.id]) slot.style.background = "rgba(0,212,255,0.04)";
        };
        slot.ondrop = function(e) {
            e.preventDefault();
            var pid = e.dataTransfer.getData("text/plain");
            if (pid) colocarPieza(pt.id, pid);
        };
        /* Click en slot con pieza ya colocada: devolver al banco */
        slot.onclick = function() {
            if (placements[pt.id]) {
                var pEl = document.getElementById("pieza_ap_" + placements[pt.id]);
                if (pEl) { pEl.style.opacity = "1"; pEl.style.transform = ""; }
                delete placements[pt.id];
                slot.innerHTML = '<span class="slot-hint" style="color:rgba(0,212,255,0.3);font-size:1.6rem;pointer-events:none;">○</span>';
                slot.style.borderColor = "rgba(0,212,255,0.35)";
                slot.style.borderStyle = "dashed";
                slot.style.background = "rgba(0,212,255,0.04)";
                slot.style.boxShadow = "";
                actualizarProgreso();
            }
        };
    });

    document.getElementById("btnEnviarMontajeAp").onclick = function() {
        var total = montaje.puntos.length;
        var correctas = montaje.puntos.filter(function(pt) { return placements[pt.id] === pt.piezaId; }).length;
        var nota = Math.round((correctas / total) * 100);

        /* Mostrar resultado visual antes de guardar */
        montaje.puntos.forEach(function(pt) {
            var slot = document.getElementById("slot_ap_" + pt.id);
            if (!slot) return;
            var correcto = placements[pt.id] === pt.piezaId;
            var noColocada = !placements[pt.id];
            slot.style.borderColor = noColocada ? "rgba(255,215,0,0.6)" : (correcto ? "var(--neon-green)" : "var(--neon-pink)");
            slot.style.background = noColocada ? "rgba(255,215,0,0.05)" : (correcto ? "rgba(0,255,136,0.12)" : "rgba(255,45,85,0.12)");
            slot.style.boxShadow = correcto ? "var(--glow-green)" : (noColocada ? "" : "var(--glow-red)");
        });

        var guardar = function() {
            var clases = JSON.parse(localStorage.getItem("dajox_clases_v3")) || [];
            var ci = clases.findIndex(function(c) { return c.id === claseId; });
            if (!clases[ci].answersLog) clases[ci].answersLog = [];
            clases[ci].answersLog.push({
                alumno: appState.user.email, tipo: "montaje",
                idMeta: montajeId, enunciado: montaje.nombre,
                nota: nota, esCorrecto: nota === 100,
                correctas: correctas, total: total, timestamp: Date.now()
            });
            localStorage.setItem("dajox_clases_v3", JSON.stringify(clases));
            syncData();
            renderTabApMontajes(clase, cont, claseId);
        };

        /* Reemplazar botón por resultado + continuar */
        var btnEl = document.getElementById("btnEnviarMontajeAp");
        btnEl.disabled = true;
        btnEl.textContent = "CALIFICADO: " + correctas + "/" + total + " (" + nota + "%)";
        btnEl.style.background = nota >= 60 ? "var(--neon-green)" : "var(--neon-pink)";
        btnEl.style.color = "#000";

        var progEl = document.getElementById("lblProgreso");
        if (progEl) progEl.innerHTML = '<strong style="color:' + (nota >= 60 ? 'var(--neon-green)' : 'var(--neon-pink)') + ';">' + (nota >= 60 ? "¡Aprobado!" : "Reprobado") + ' — ' + nota + '%</strong>';

        setTimeout(guardar, 2000);
    };
}

/* ── Aprendiz: Historial ── */
function renderTabApHistorial(clase, cont) {
    var log = (clase.answersLog || [])
        .filter(function(e) { return e.alumno === appState.user.email && e.tipo !== "pregunta_examen_interna"; })
        .sort(function(a, b) { return (b.timestamp||0) - (a.timestamp||0); });
    if (log.length === 0) {
        cont.innerHTML = '<p style="color:var(--texto-mutado);font-size:0.85rem;">// Sin actividad aun.</p>';
        return;
    }
    var puntosTotal = log.filter(function(e) { return e.tipo === "pregunta_individual"; })
        .reduce(function(s, e) { return s + (e.puntos||0); }, 0);
    var html =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
            '<h4>HISTORIAL ACADEMICO</h4>' +
            '<span style="background:rgba(0,212,255,0.1);color:var(--neon-cyan);border:1px solid rgba(0,212,255,0.3);padding:4px 14px;border-radius:10px;font-size:0.82rem;font-weight:800;box-shadow:var(--glow-cyan);">' + puntosTotal + ' PTS</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">';
    log.forEach(function(e) {
        var col = "var(--neon-purple)";
        var label = "PREGUNTA";
        if (e.tipo === "examen_total") { col = "var(--neon-cyan)"; label = "EXAMEN"; }
        if (e.tipo === "montaje") { col = "var(--neon-purple)"; label = "MONTAJE"; }
        if (e.tipo === "simulador") { col = "var(--neon-green)"; label = "SIMULACION"; }
        var tieneNota = e.nota !== undefined;
        html += '<div class="item-resultado" style="border-left-color:' + col + ';">' +
            '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">' +
                '<div style="flex:1;">' +
                    '<p style="font-size:0.78rem;color:' + col + ';font-weight:700;letter-spacing:0.06em;margin-bottom:3px;">[' + label + ']</p>' +
                    '<p style="font-weight:600;font-size:0.9rem;">' + e.enunciado + '</p>' +
                    (e.tipo === "pregunta_individual" && e.opciones ? '<p style="font-size:0.8rem;color:var(--texto-mutado);margin-top:5px;">Tu resp: <span style="color:' + (e.esCorrecto ? 'var(--neon-green)' : 'var(--neon-pink)') + ';font-weight:700;">' + e.opciones[e.seleccionada] + '</span>' + (!e.esCorrecto ? ' | OK: <span style="color:var(--neon-green);font-weight:700;">' + e.opciones[e.correcta] + '</span>' : '') + '</p>' : '') +
                    (e.timestamp ? '<p style="font-size:0.74rem;color:var(--texto-mutado);margin-top:4px;">' + new Date(e.timestamp).toLocaleString("es-CO") + '</p>' : '') +
                '</div>' +
                '<div style="text-align:right;flex-shrink:0;">' +
                    (tieneNota ? '<span style="background:' + (e.nota >= 60 ? 'rgba(0,255,136,0.15)' : 'rgba(255,45,85,0.15)') + ';color:' + (e.nota >= 60 ? 'var(--neon-green)' : 'var(--neon-pink)') + ';border:1px solid ' + (e.nota >= 60 ? 'rgba(0,255,136,0.3)' : 'rgba(255,45,85,0.3)') + ';padding:4px 10px;border-radius:10px;font-size:0.82rem;font-weight:800;">' + e.nota + '%</span>' : '') +
                    (!tieneNota && e.esCorrecto !== undefined ? '<span style="font-weight:800;color:' + (e.esCorrecto ? 'var(--neon-green)' : 'var(--neon-pink)') + ';">' + (e.esCorrecto ? '✓' : '✗') + '</span>' : '') +
                    (e.tipo === "pregunta_individual" ? '<p style="font-size:0.78rem;color:var(--neon-cyan);margin-top:4px;">' + (e.esCorrecto ? '+' : '') + (e.puntos||0) + ' pts</p>' : '') +
                '</div>' +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    cont.innerHTML = html;
}
