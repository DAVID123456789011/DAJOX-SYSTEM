/* ==========================================================================
   DAJOX SYNC — BASE DE DATOS COMPARTIDA EN TIEMPO REAL
   ==========================================================================
   INSTRUCCIONES (5 minutos, gratis):
   1. Ve a https://console.firebase.google.com
   2. "Crear proyecto" → nombre cualquiera → Continuar → Crear
   3. Panel izquierdo → Build → Realtime Database → "Crear base de datos"
   4. Elige region → "Iniciar en modo de prueba" → Habilitar
   5. Copia la URL que aparece (formato: https://XXXX-rtdb.firebaseio.com)
   6. Pega esa URL SOLO aqui abajo entre las comillas y guarda el archivo
   ========================================================================== */
/* La URL se guarda en localStorage para no tener que editar codigo.
   El instructor la configura UNA VEZ desde el panel de configuracion del app. */
var DAJOX_DB_URL = localStorage.getItem("dajox_firebase_url") || "";

/* ── Motor de sincronizacion (no modificar) ── */
var _dbUrl = function() {
    /* Siempre leer de localStorage para capturar cambios en caliente */
    var u = localStorage.getItem("dajox_firebase_url") || "";
    if (!u && typeof DAJOX_DB_URL !== "undefined") u = DAJOX_DB_URL;
    return u ? u.trim().replace(/\/$/, "") : "";
};

var _fbActive = false;

function fbWrite(clases) {
    var base = _dbUrl();
    if (!base || !clases) return;
    var obj = {};
    clases.forEach(function(c) {
        if (c && c.id) obj[c.id.replace(/[.#$[\]]/g, "_")] = c;
    });
    fetch(base + "/dajox_v3.json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj)
    }).catch(function(e) { console.warn("DAJOX sync write error:", e.message); });
}

function fbRead() {
    var base = _dbUrl();
    if (!base) return Promise.resolve(null);
    return fetch(base + "/dajox_v3.json")
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });
}

function fbMergeIntoLocal(data, callback) {
    if (!data || typeof data !== "object") return;
    var clases = Object.values(data).filter(Boolean);
    var seen = {};
    clases.forEach(function(c) { if (c && c.id) seen[c.id] = c; });
    var arr = Object.values(seen);
    if (!arr.length) return;
    localStorage.setItem("dajox_clases_v3", JSON.stringify(arr));
    if (callback) callback(arr);
}

/* EventSource para actualizaciones en tiempo real (Firebase SSE) */
var _evtSrc = null;
function fbListen(onUpdate) {
    var base = _dbUrl();
    if (!base) return;
    if (_evtSrc) { _evtSrc.close(); _evtSrc = null; }
    try {
        _evtSrc = new EventSource(base + "/dajox_v3.json");
        _evtSrc.addEventListener("put", function(e) {
            try {
                var payload = JSON.parse(e.data);
                var data = payload.data;
                if (!data) return;
                fbMergeIntoLocal(data, onUpdate);
            } catch(ex) {}
        });
        _evtSrc.onerror = function() {
            /* Si SSE falla, caer en polling cada 5 segundos */
            if (_evtSrc) { _evtSrc.close(); _evtSrc = null; }
            _fbPollFallback(onUpdate);
        };
        _fbActive = true;
    } catch(e) {
        _fbPollFallback(onUpdate);
    }
}

var _pollTimer = null;
function _fbPollFallback(onUpdate) {
    if (_pollTimer) return;
    _pollTimer = setInterval(function() {
        fbRead().then(function(data) {
            if (data) fbMergeIntoLocal(data, onUpdate);
        });
    }, 5000);
    _fbActive = true;
}

/* ==========================================================================
   CÓDIGO PRINCIPAL DAJOX - BANCO DE 30 PREGUNTAS PREDETERMINADAS BASE
   ========================================================================== */
const bancoPredeterminado30 = [
    { id: 101, pregunta: "¿Cuál es el componente principal encargado de ejecutar las instrucciones de cómputo?", opciones: ["Memoria RAM", "Procesador (CPU)", "Disco Duro", "Fuente de Poder"], correcta: 1, image: "" },
    { id: 102, pregunta: "Si una computadora enciende pero emite pitidos repetidos y no da video, ¿qué componente probablemente falla?", opciones: ["Teclado", "Gabinete", "Memoria RAM", "Unidad Óptica"], correcta: 2, image: "" },
    { id: 103, pregunta: "¿Qué tipo de mantenimiento se realiza antes de que ocurra una falla mediante limpiezas y mediciones?", opciones: ["Mantenimiento Correctivo", "Mantenimiento Predictivo", "Mantenimiento Preventivo", "Mantenimiento Reactivo"], correcta: 2, image: "" },
    { id: 104, pregunta: "¿Cuál de los siguientes es un sistema de archivos nativo de Windows 10/11?", opciones: ["EXT4", "NTFS", "FAT16", "APFS"], correcta: 1, image: "" },
    { id: 105, pregunta: "Al aplicar pasta térmica en el procesador, el objetivo principal es:", opciones: ["Pegar el disipador permanentemente", "Mejorar la transferencia de calor hacia el disipador", "Aumentar el voltaje del núcleo", "Evitar el polvo en los pines"], correcta: 1, image: "" }
];

// Generador para autocompletar dinámicamente hasta 30 preguntas de soporte técnico
for (let i = 6; i <= 30; i++) {
    bancoPredeterminado30.push({
        id: 100 + i,
        pregunta: `Pregunta Técnica de Control de Calidad N°${i} - Diagnóstico Infraestructura TIC Básica SENA.`,
        opciones: ["Opción de descarte A", "Opción de descarte B", "Respuesta Técnica Correcta Estándar", "Opción de descarte D"],
        correcta: 2,
        image: ""
    });
}
