/* ==========================================================================
   DAJOX DB — BASE DE DATOS POR CLASE
   Cada clase tiene su propia entrada en localStorage + su propio topic MQTT.
   Lenguaje: JavaScript (nativo en navegadores, sin dependencias).
   ========================================================================== */

var DajoxDB = (function () {

    /* ── Claves de almacenamiento ── */
    var REGISTRY_KEY = "dajox_registry_v1";

    function clsKey(id)    { return "dajox_cls_" + id; }
    function classTopic(id){
        var salon = (typeof getDajoxSalonId === "function") ? getDajoxSalonId() : "local";
        return "dajox-v3/" + salon + "/" + id;
    }
    function regTopic() {
        var salon = (typeof getDajoxSalonId === "function") ? getDajoxSalonId() : "local";
        return "dajox-v3/" + salon + "/_registry";
    }

    /* ── Registro (lista de IDs de clases) ── */
    function getRegistry() {
        try { return JSON.parse(localStorage.getItem(REGISTRY_KEY) || "[]"); }
        catch(e) { return []; }
    }
    function saveRegistry(reg) {
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
        mqttPub(regTopic(), reg);
    }

    /* ── MQTT helpers (no fallan si MQTT no esta conectado) ── */
    function mqttPub(topic, data) {
        if (typeof _mqtt === "undefined" || !_mqtt || !_mqttOk) return;
        try {
            _mqtt.publish(topic, JSON.stringify(data), { qos: 1, retain: true });
        } catch(e) {}
    }
    function mqttClear(topic) {
        if (typeof _mqtt === "undefined" || !_mqtt || !_mqttOk) return;
        try {
            _mqtt.publish(topic, "", { qos: 1, retain: true });
        } catch(e) {}
    }

    /* ── Clave única para una entrada de answersLog ── */
    function logKey(e) {
        return [e.tipo, e.alumno, e.idMeta || "", e.timestamp || ""].join("|");
    }

    /* ── Obtener / Guardar clase ── */
    function getClass(id) {
        try {
            var d = localStorage.getItem(clsKey(id));
            return d ? JSON.parse(d) : null;
        } catch(e) { return null; }
    }
    function saveClass(cls) {
        localStorage.setItem(clsKey(cls.id), JSON.stringify(cls));
        mqttPub(classTopic(cls.id), cls);
    }

    /* ── Fusionar answersLog (local + remoto sin duplicados) ── */
    function mergeAnswersLog(logA, logB) {
        var map = {};
        (logA || []).forEach(function(e) { map[logKey(e)] = e; });
        (logB || []).forEach(function(e) { map[logKey(e)] = e; });
        return Object.values(map);
    }

    /* ── Fusionar clase remota con clase local ── */
    function mergeClass(local, remote) {
        if (!local) return remote;
        if (!remote) return local;
        var merged = Object.assign({}, remote);
        /* Siempre conservar todos los answersLog de ambas fuentes */
        merged.answersLog = mergeAnswersLog(local.answersLog, remote.answersLog);
        /* Conservar inscritos de ambos */
        var inscMap = {};
        (local.inscritos  || []).forEach(function(e) { inscMap[e] = 1; });
        (remote.inscritos || []).forEach(function(e) { inscMap[e] = 1; });
        merged.inscritos = Object.keys(inscMap);
        return merged;
    }

    /* ── API PÚBLICA ── */
    var API = {

        /* Crear clase nueva */
        createClass: function(nombre, ficha, instructor) {
            var id = "CLASE-" + Math.floor(Math.random() * 9000 + 1000);
            var cls = {
                id: id, nombre: nombre, ficha: ficha,
                instructor: instructor,
                creadaEn: Date.now(),
                inscritos: [],
                preguntasIndividuales: [],
                examenesCreadosEstructurados: [],
                montajes: [],
                answersLog: []
            };
            var reg = getRegistry();
            if (reg.indexOf(id) === -1) reg.push(id);
            saveRegistry(reg);
            saveClass(cls);
            return cls;
        },

        /* Eliminar clase (local + MQTT) */
        deleteClass: function(id) {
            localStorage.removeItem(clsKey(id));
            var reg = getRegistry().filter(function(i) { return i !== id; });
            saveRegistry(reg);
            mqttClear(classTopic(id));
        },

        /* Obtener clase por ID */
        getClass: getClass,

        /* Actualizar clase completa */
        updateClass: function(cls) {
            saveClass(cls);
        },

        /* Obtener todas las clases de un instructor */
        getInstructorClasses: function(email) {
            return getRegistry()
                .map(getClass)
                .filter(function(c) { return c && c.instructor === email; });
        },

        /* Obtener clases de un aprendiz */
        getStudentClasses: function(email) {
            var key = "dajox_joined_" + email;
            var joined = JSON.parse(localStorage.getItem(key) || "[]");
            return joined.map(getClass).filter(Boolean);
        },

        /* Inscribir aprendiz en clase */
        enrollStudent: function(classId, email) {
            var cls = getClass(classId);
            if (!cls) return false;
            if ((cls.inscritos || []).indexOf(email) === -1) {
                if (!cls.inscritos) cls.inscritos = [];
                cls.inscritos.push(email);
                saveClass(cls);
            }
            var key = "dajox_joined_" + email;
            var joined = JSON.parse(localStorage.getItem(key) || "[]");
            if (joined.indexOf(classId) === -1) {
                joined.push(classId);
                localStorage.setItem(key, JSON.stringify(joined));
            }
            return true;
        },

        /* Registrar respuesta (sin duplicados para preguntas individuales) */
        recordAnswer: function(classId, entry) {
            var cls = getClass(classId);
            if (!cls) return;
            if (!cls.answersLog) cls.answersLog = [];
            /* Evitar respuesta duplicada a la misma pregunta */
            if (entry.tipo === "pregunta_individual") {
                var dup = cls.answersLog.some(function(e) {
                    return e.tipo === "pregunta_individual" &&
                           e.alumno === entry.alumno &&
                           e.idMeta === entry.idMeta;
                });
                if (dup) return;
            }
            cls.answersLog.push(entry);
            saveClass(cls);
        },

        /* Puntuación individual de un aprendiz en una clase */
        getStudentScore: function(classId, email) {
            var cls = getClass(classId);
            if (!cls) return { puntos: 0, correctas: 0, totalPregs: 0, examenes: [] };
            var log = (cls.answersLog || []).filter(function(e) { return e.alumno === email; });
            var puntos = 0, correctas = 0, totalPregs = 0, examenes = [];

            log.forEach(function(e) {
                if (e.tipo === "pregunta_individual") {
                    totalPregs++;
                    if (e.esCorrecto) { correctas++; puntos += (e.puntos || 0); }
                } else if (e.tipo === "examen_total") {
                    examenes.push({ nombre: e.enunciado, nota: e.nota });
                    puntos += Math.round((e.nota || 0) / 10);
                } else if (e.tipo === "montaje") {
                    puntos += Math.round((e.nota || 0) / 10);
                } else if (e.tipo === "simulador") {
                    puntos += 10;
                }
            });
            return { puntos: puntos, correctas: correctas, totalPregs: totalPregs, examenes: examenes };
        },

        /* Ranking global de todos los aprendices de una clase */
        getClassRanking: function(classId) {
            var cls = getClass(classId);
            if (!cls) return [];
            var map = {};
            (cls.answersLog || []).forEach(function(e) {
                if (!e.alumno) return;
                if (!map[e.alumno]) map[e.alumno] = { email: e.alumno, puntos: 0, actividades: 0 };
                if (e.tipo === "pregunta_individual" && e.esCorrecto) {
                    map[e.alumno].puntos += (e.puntos || 0);
                    map[e.alumno].actividades++;
                } else if ((e.tipo === "examen_total" || e.tipo === "montaje") && e.nota !== undefined) {
                    map[e.alumno].puntos += Math.round((e.nota || 0) / 10);
                    map[e.alumno].actividades++;
                } else if (e.tipo === "simulador") {
                    map[e.alumno].puntos += 10;
                    map[e.alumno].actividades++;
                }
            });
            return Object.values(map).sort(function(a, b) { return b.puntos - a.puntos; });
        },

        /* Importar clase recibida por MQTT (fusiona con local) */
        importFromMQTT: function(remoteData) {
            if (!remoteData || !remoteData.id) return null;
            var reg = getRegistry();
            if (reg.indexOf(remoteData.id) === -1) { reg.push(remoteData.id); saveRegistry(reg); }
            var local  = getClass(remoteData.id);
            var merged = mergeClass(local, remoteData);
            localStorage.setItem(clsKey(remoteData.id), JSON.stringify(merged));
            return merged;
        },

        /* Migrar datos del sistema antiguo (dajox_clases_v3) */
        migrateFromLegacy: function() {
            var legacy = JSON.parse(localStorage.getItem("dajox_clases_v3") || "[]");
            if (!legacy.length) return 0;
            var reg = getRegistry();
            var migrated = 0;
            legacy.forEach(function(cls) {
                if (!cls || !cls.id) return;
                var existing = getClass(cls.id);
                var merged = mergeClass(existing, cls);
                if (reg.indexOf(cls.id) === -1) reg.push(cls.id);
                localStorage.setItem(clsKey(cls.id), JSON.stringify(merged));
                migrated++;
            });
            saveRegistry(reg);
            return migrated;
        },

        /* Exportar TODAS las clases al formato legacy (compatibilidad con script.js) */
        toArray: function() {
            return getRegistry().map(getClass).filter(Boolean);
        },

        /* Reemplazar todo con un array de clases (desde MQTT global) */
        replaceAll: function(arr) {
            if (!Array.isArray(arr)) return;
            var reg = getRegistry();
            arr.forEach(function(cls) {
                if (!cls || !cls.id) return;
                var local  = getClass(cls.id);
                var merged = mergeClass(local, cls);
                if (reg.indexOf(cls.id) === -1) reg.push(cls.id);
                localStorage.setItem(clsKey(cls.id), JSON.stringify(merged));
            });
            saveRegistry(reg);
        },

        /* Suscribir al topic MQTT de una clase específica */
        subscribeClass: function(classId) {
            if (typeof _mqtt === "undefined" || !_mqtt || !_mqttOk) return;
            try { _mqtt.subscribe(classTopic(classId), { qos: 1 }); } catch(e) {}
        },

        classTopic: classTopic,
        regTopic:   regTopic
    };

    return API;
})();
