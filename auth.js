/* ==========================================================================
   CÓDIGO PRINCIPAL DAJOX - MANEJADOR DE AUTENTICACIÓN CON VERIFICACIÓN GMAIL
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    if(window.location.pathname.includes("login.html")) {
        localStorage.removeItem("usuarioActual");
    }

    const btnIngresar = document.getElementById("btnIngresar");
    const btnConfirmarGmail = document.getElementById("btnConfirmarGmail");
    const btnCancelarGmail = document.getElementById("btnCancelarGmail");
    
    let sesionTemporal = null;

    if(btnIngresar) {
        btnIngresar.addEventListener("click", () => {
            const email = document.getElementById("txtEmail").value.trim();
            const pass = document.getElementById("txtPass").value.trim();
            const rol = document.querySelector('input[name="rbRol"]:checked').value;

            if(!email || !pass) {
                alert("Completa todos los campos obligatorios.");
                return;
            }

            if(!email.includes("@")) {
                alert("Ingresa un correo electrónico válido.");
                return;
            }

            // Guardamos temporalmente los datos, pero NO entramos todavía
            sesionTemporal = { 
                email: email, 
                role: rol, 
                token: "DJX-" + Math.random().toString(36).substr(2, 9).toUpperCase() 
            };

            // Cambiar de vista dentro del login: Ocultar form, mostrar simulación Gmail
            document.getElementById("lblGmailDestino").textContent = email;
            document.getElementById("formLogin").classList.add("hidden");
            document.getElementById("pantallaGmail").classList.remove("hidden");
        });
    }

    if(btnConfirmarGmail) {
        btnConfirmarGmail.addEventListener("click", () => {
            if(sesionTemporal) {
                // Al dar Aceptar desde la cuenta de Gmail, ahora sí se guarda oficialmente la sesión
                localStorage.setItem("usuarioActual", JSON.stringify(sesionTemporal));
                alert("¡Verificación Exitosa! Credenciales confirmadas desde Gmail.");
                window.location.href = "dashboard.html";
            }
        });
    }

    if(btnCancelarGmail) {
        btnCancelarGmail.addEventListener("click", () => {
            sesionTemporal = null;
            document.getElementById("pantallaGmail").classList.add("hidden");
            document.getElementById("formLogin").classList.remove("hidden");
        });
    }
});