/* ==========================================================================
   DAJOX SYNC — TIEMPO REAL SIN CONFIGURACION
   Usa MQTT (broker publico gratuito). Cero cuentas, cero pagos, cero pasos.
   El ID del salon se detecta automaticamente desde el URL del sitio.
   ========================================================================== */

/* ── ID del salon (auto-detectado del hostname) ── */
function getDajoxSalonId() {
    var query = new URLSearchParams(window.location.search);
    var customSalon = query.get("salon");
    if (customSalon) return customSalon.trim();
    var host = window.location.hostname || "";
    if (host === "localhost" || host === "127.0.0.1" || host === "") {
        return "dajox-local";
    }
    return host.split(".")[0];
}

var DAJOX_TOPIC  = "dajox-v3/" + getDajoxSalonId();
var MQTT_BROKER  = "wss://broker.emqx.io:8084/mqtt";

var _mqtt        = null;
var _mqttOk      = false;
var _mqttStatus  = "offline";   /* "offline" | "connecting" | "online" | "error" */
var _onMqttData  = null;
var _onMqttStatus = null;

/* ── Conectar al broker MQTT ── */
function mqttConnect(onData, onStatus) {
    if (typeof window.mqtt === "undefined") {
        /* La libreria aun no cargo, reintentar en 500ms */
        setTimeout(function() { mqttConnect(onData, onStatus); }, 500);
        return;
    }
    _onMqttData   = onData;
    _onMqttStatus = onStatus;

    if (_mqtt) { _mqtt.end(true); _mqtt = null; }

    _mqttStatus = "connecting";
    if (onStatus) onStatus("connecting");

    var clientId = "djx-" + Math.random().toString(36).substr(2, 9);

    _mqtt = window.mqtt.connect(MQTT_BROKER, {
        clientId:       clientId,
        clean:          true,
        connectTimeout: 10000,
        reconnectPeriod: 4000,
        keepalive:      30,
    });

    _mqtt.on("connect", function () {
        _mqttOk     = true;
        _mqttStatus = "online";
        if (_onMqttStatus) _onMqttStatus("online");

        _mqtt.subscribe(DAJOX_TOPIC, { qos: 1 }, function (err) {
            if (err) console.warn("DAJOX MQTT sub error:", err);
        });
        /* Suscribirse a topics individuales de clases conocidas */
        var salon = getDajoxSalonId();
        var reg = JSON.parse(localStorage.getItem("dajox_registry_v1") || "[]");
        reg.forEach(function(id) {
            _mqtt.subscribe("dajox-v3/" + salon + "/" + id, { qos: 1 });
        });
        /* Suscribirse al registry */
        _mqtt.subscribe("dajox-v3/" + salon + "/_registry", { qos: 1 });
    });

    _mqtt.on("message", function (topic, payload) {
        try {
            var raw = payload.toString();
            if (!raw) return;
            var data = JSON.parse(raw);

            /* Mensaje de clase individual (topic = dajox-v3/salon/CLASE-XXXX) */
            if (data && data.id && !Array.isArray(data)) {
                if (typeof DajoxDB !== "undefined") {
                    var merged = DajoxDB.importFromMQTT(data);
                    if (merged && _onMqttData) {
                        _onMqttData(DajoxDB.toArray());
                    }
                } else {
                    /* Fallback sin DajoxDB: fusionar clase individual en storage legacy */
                    var existing = JSON.parse(localStorage.getItem("dajox_clases_v3") || "[]");
                    var seen = {};
                    existing.forEach(function(c) { if (c && c.id) seen[c.id] = c; });
                    seen[data.id] = data;
                    var mergedList = Object.values(seen);
                    localStorage.setItem("dajox_clases_v3", JSON.stringify(mergedList));
                    if (_onMqttData) _onMqttData(mergedList);
                }
                return;
            }

            /* Mensaje legacy: array de todas las clases */
            if (Array.isArray(data) && data.length > 0) {
                if (typeof DajoxDB !== "undefined") {
                    DajoxDB.replaceAll(data);
                    if (_onMqttData) _onMqttData(DajoxDB.toArray());
                } else {
                    /* Fallback sin DajoxDB */
                    var seen = {};
                    data.forEach(function(c) { if (c && c.id) seen[c.id] = c; });
                    var clases = Object.values(seen);
                    localStorage.setItem("dajox_clases_v3", JSON.stringify(clases));
                    if (_onMqttData) _onMqttData(clases);
                }
            }
        } catch (e) { console.warn("DAJOX MQTT parse error:", e); }
    });

    _mqtt.on("error", function (err) {
        _mqttOk     = false;
        _mqttStatus = "error";
        if (_onMqttStatus) _onMqttStatus("error");
    });

    _mqtt.on("offline", function () {
        _mqttOk     = false;
        _mqttStatus = "offline";
        if (_onMqttStatus) _onMqttStatus("offline");
    });

    _mqtt.on("reconnect", function () {
        _mqttStatus = "connecting";
        if (_onMqttStatus) _onMqttStatus("connecting");
    });
}

/* ── Publicar una clase individual por su propio topic ── */
function mqttPublishClass(cls) {
    if (!_mqtt || !_mqttOk || !cls || !cls.id) return;
    var salon = getDajoxSalonId();
    var topic = "dajox-v3/" + salon + "/" + cls.id;
    _mqtt.publish(topic, JSON.stringify(cls), { qos: 1, retain: true });
    /* Suscribirse a ese topic si no estaba ya */
    _mqtt.subscribe(topic, { qos: 1 });
}

/* ── Publicar array completo (compatibilidad legacy) ── */
function mqttPublish(clases) {
    if (!_mqtt || !_mqttOk) return;
    var array = Array.isArray(clases) ? clases : [];
    try { _mqtt.publish(DAJOX_TOPIC, JSON.stringify(array), { qos: 1, retain: true }); } catch (e) {}
    /* Publicar cada clase por su propio topic cuando existe DajoxDB para compatibilidad */
    if (typeof DajoxDB !== "undefined") {
        clases.forEach(function(cls) { if (cls && cls.id) mqttPublishClass(cls); });
    }
}

/* ── Alias para compatibilidad con el resto del codigo ── */
function fbWrite(clases)          { mqttPublish(clases); }
function fbRead()                 { return Promise.resolve(null); }
function fbListen(cb)             { /* MQTT ya escucha en mqttConnect */ }
function fbMergeIntoLocal()       { /* no aplica */ }

/* Expose al scope global para quiz.html y simuladorGrafico.js */
window.dajoxMqttPublish = mqttPublish;

const bancoPredeterminado30 = [
    { id: 101, pregunta: "¿Cuál es el componente principal encargado de ejecutar las instrucciones de cómputo?", opciones: ["Procesador (CPU)", "Memoria RAM", "Disco Duro", "Fuente de Poder"], correcta: 0, image: "" },
    { id: 102, pregunta: "Si una computadora enciende pero emite pitidos repetidos y no da video, ¿qué componente probablemente falla?", opciones: ["Disco Duro dañado", "Fuente sin suficiente potencia", "Memoria RAM defectuosa", "Teclado desconectado"], correcta: 2, image: "" },
    { id: 103, pregunta: "¿Qué tipo de mantenimiento se realiza antes de que ocurra una falla mediante limpiezas y mediciones?", opciones: ["Mantenimiento Reactivo", "Mantenimiento Correctivo", "Mantenimiento Preventivo", "Mantenimiento Predictivo"], correcta: 2, image: "" },
    { id: 104, pregunta: "¿Cuál de los siguientes es un sistema de archivos nativo de Windows 10/11?", opciones: ["APFS", "EXT4", "NTFS", "FAT16"], correcta: 2, image: "" },
    { id: 105, pregunta: "Al aplicar pasta térmica en el procesador, el objetivo principal es:", opciones: ["Aumentar el voltaje del núcleo", "Evitar el polvo en los pines", "Mejorar la transferencia de calor hacia el disipador", "Pegar el disipador permanentemente"], correcta: 2, image: "" }
];

// Generador para autocompletar dinámicamente hasta 30 preguntas de soporte técnico
for (let i = 6; i <= 30; i++) {
    // Randomizar cuál es la respuesta correcta (0, 1, 2, o 3)
    const correctaIdx = Math.floor(Math.random() * 4);
    
    // Crear opciones con sentido
    const opciones = [
        "La fuente de poder está defectuosa",
        "El disco duro necesita desfragmentación",
        `Diagnóstico de Infraestructura TIC N°${i} - Respuesta Técnica Correcta`,
        "El puerto USB está averiado"
    ];
    
    // Shuffle de opciones manteniendo track de la correcta
    const indicesOrig = [0, 1, 2, 3];
    for (let j = 3; j > 0; j--) {
        const randIdx = Math.floor(Math.random() * (j + 1));
        const temp = indicesOrig[j];
        indicesOrig[j] = indicesOrig[randIdx];
        indicesOrig[randIdx] = temp;
    }
    
    const opcionesShuffled = [];
    let nuevoCorrectaIdx = 0;
    for (let j = 0; j < 4; j++) {
        opcionesShuffled.push(opciones[indicesOrig[j]]);
        if (indicesOrig[j] === 2) nuevoCorrectaIdx = j; // 2 es el índice correcto
    }
    
    bancoPredeterminado30.push({
        id: 100 + i,
        pregunta: `Pregunta Técnica de Control de Calidad N°${i} - Diagnóstico Infraestructura TIC Básica SENA.`,
        opciones: opcionesShuffled,
        correcta: nuevoCorrectaIdx,
        image: ""
    });
}
