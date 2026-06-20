/* ==========================================================================
   DAJOX SYSTEM - COMPONENTE DEL ENTORNO DE SIMULACIÓN GRÁFICA (PRACTICA LABORATORY)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const claseId = params.get("claseId");
    const usuario = JSON.parse(localStorage.getItem("usuarioActual"));

    if(!usuario) {
        window.location.href = "login.html";
        return;
    }

    document.getElementById("btnAbandonar").onclick = () => {
        window.location.href = "dashboard.html";
    };

    const banco = document.getElementById("bancoPiezas");
    if (banco) {
        banco.innerHTML = "";
        BANCO_PIEZAS_HARDWARE.forEach(p => {
            const div = document.createElement("div");
            div.className = "pieza-draggable";
            div.textContent = p.nombre;
            div.draggable = true;
            div.id = p.id;

            div.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", e.target.id);
            });
            banco.appendChild(div);
        });
    }

    const slots = document.querySelectorAll(".zona-soltar");
    slots.forEach(slot => {
        slot.addEventListener("dragover", (e) => e.preventDefault());
        slot.addEventListener("drop", (e) => {
            e.preventDefault();
            const idPieza = e.dataTransfer.getData("text/plain");
            const targetId = slot.getAttribute("data-target");

            if (idPieza === targetId) {
                slot.style.background = "var(--acento-verde)";
                slot.textContent = "✓ " + slot.textContent.replace("SLOT DE ", "").replace("BANCOS DE ", "") + " Acoplado";
                slot.classList.add("correcta");

                const elem = document.getElementById(idPieza);
                if(elem) elem.style.visibility = "hidden";

                const correctos = document.querySelectorAll(".zona-soltar.correcta").length;
                if(correctos === BANCO_PIEZAS_HARDWARE.length) {
                    alert("¡Placa Madre armada sin cortocircuitos! Nota: 100%");
                    
                    const clases = JSON.parse(localStorage.getItem("dajox_clases_v3")) || [];
                    let idx = clases.findIndex(c => c.id === claseId);
                    if(idx !== -1) {
                        if(!clases[idx].answersLog) clases[idx].answersLog = [];
                        
                        clases[idx].answersLog.push({
                            alumno: usuario.email,
                            tipo: 'simulador',
                            idMeta: 'simulador-guiado-completo',
                            enunciado: 'Práctica Libre Guiada: Ensamble Físico de Componentes en la Tarjeta Madre',
                            nota: 100,
                            esCorrecto: true,
                            timestamp: Date.now()
                        });
                        localStorage.setItem("dajox_clases_v3", JSON.stringify(clases));
                        /* Firebase sync */
                        try {
                            if (window.firebase && firebase.apps && firebase.apps.length) {
                                var fbObj = {};
                                clases.forEach(function(c) { if (c.id) fbObj[c.id.replace(/[.#$\/\[\]]/g, "_")] = c; });
                                firebase.database().ref("dajox_v3").set(fbObj);
                            }
                        } catch(e) {}
                    }
                    window.location.href = "dashboard.html";
                }
            } else {
                alert("❌ ¡Error crítico de ensamble! El componente no calza en este factor de forma.");
            }
        });
    });
});
