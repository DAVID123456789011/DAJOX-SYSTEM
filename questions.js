/* ==========================================================================
   DAJOX SYNC — TIEMPO REAL SIN CONFIGURACION
   Usa MQTT (broker publico gratuito). Cero cuentas, cero pagos, cero pasos.
   El ID del salon se detecta automaticamente desde el URL del sitio.
   ========================================================================== */

/* ── ID del salon (auto-detectado del hostname) ── */
function getDajoxSalonId() {
    var host = window.location.hostname || "localhost";
    if (host === "localhost" || host === "127.0.0.1") {
        /* En local, usar un ID guardado o generarlo */
        var sid = localStorage.getItem("dajox_sid");
        if (!sid) {
            sid = "local-" + Math.random().toString(36).substr(2, 6);
            localStorage.setItem("dajox_sid", sid);
        }
        return sid;
    }
    /* Para GitHub Pages: "david123456789011.github.io" → "david123456789011" */
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
    /* Publicar cada clase por su propio topic */
    if (typeof DajoxDB !== "undefined") {
        clases.forEach(function(cls) { if (cls && cls.id) mqttPublishClass(cls); });
    } else {
        _mqtt.publish(DAJOX_TOPIC, JSON.stringify(clases), { qos: 1, retain: true });
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
