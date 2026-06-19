/* ==========================================================================
   DAJOX SYSTEM - AUTENTICACIÓN CON SELECTOR DE CUENTAS ESTILO GOOGLE
   ========================================================================== */

const AVATAR_COLORS = ["#4285f4", "#34a853", "#ea4335", "#fbbc05", "#7c3aed", "#0891b2"];

function avatarColor(email) {
    return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}

function avatarInitial(email) {
    return email.charAt(0).toUpperCase();
}

function getSavedAccounts() {
    try { return JSON.parse(localStorage.getItem("dajox_accounts") || "[]"); } catch { return []; }
}

function addSavedAccount(email, role) {
    const prev = getSavedAccounts().filter(a => a.email !== email);
    localStorage.setItem("dajox_accounts", JSON.stringify([{ email, role }, ...prev].slice(0, 6)));
}

// ── Estado global del login ───────────────────────────────────────────────────
let currentEmail = "";
let tempUsuario = null;

// ── Helpers de pantalla ───────────────────────────────────────────────────────
function showPhase(phase) {
    ["phasePicker", "phaseEmail", "phasePassword", "phaseGmail"].forEach(id => {
        document.getElementById(id).classList.add("hidden");
    });
    document.getElementById(phase).classList.remove("hidden");
}

function makeAvatar(email, container) {
    container.style.background = avatarColor(email);
    container.textContent = avatarInitial(email);
}

// ── Render lista de cuentas guardadas ─────────────────────────────────────────
function renderAccountList() {
    const accounts = getSavedAccounts();
    const lista = document.getElementById("listaAccounts");
    lista.innerHTML = "";

    accounts.forEach(acc => {
        const item = document.createElement("div");
        item.className = "account-item";

        const badge = acc.role === "INSTRUCTOR"
            ? `<span class="account-role role-instructor">INSTRUCTOR</span>`
            : `<span class="account-role role-aprendiz">APRENDIZ</span>`;

        item.innerHTML = `
            <div class="avatar" style="background:${avatarColor(acc.email)};">${avatarInitial(acc.email)}</div>
            <div>
                <p class="account-name">${acc.email.split("@")[0]}</p>
                <p class="account-email">${acc.email}</p>
                ${badge}
            </div>
        `;

        item.addEventListener("click", () => {
            currentEmail = acc.email;
            // Pre-seleccionar el rol guardado
            const radios = document.querySelectorAll('input[name="rolPass"]');
            radios.forEach(r => { r.checked = (r.value === acc.role); });
            goToPassword();
        });

        lista.appendChild(item);
    });
}

// ── Navegación entre fases ────────────────────────────────────────────────────
function goToPicker() {
    renderAccountList();
    showPhase("phasePicker");
}

function goToEmail() {
    document.getElementById("inputEmail").value = currentEmail || "";
    const accounts = getSavedAccounts();
    const btnVolver = document.getElementById("btnEmailVolver");
    btnVolver.style.display = accounts.length > 0 ? "inline-block" : "none";
    showPhase("phaseEmail");
    setTimeout(() => document.getElementById("inputEmail").focus(), 100);
}

function goToPassword() {
    const avatar = document.getElementById("passAvatar");
    makeAvatar(currentEmail, avatar);
    document.getElementById("chipEmailTxt").textContent = currentEmail;
    document.getElementById("inputPass").value = "";
    showPhase("phasePassword");
    setTimeout(() => document.getElementById("inputPass").focus(), 100);

    // Boton de reset si ya tiene contrasena registrada
    const credKey = "dajox_cred_" + currentEmail;
    const resetBtn = document.getElementById("btnResetPass");
    if (resetBtn) {
        if (localStorage.getItem(credKey)) {
            resetBtn.style.display = "inline-block";
        } else {
            resetBtn.style.display = "none";
        }
    }
}

function goToGmail() {
    const gmailAvatar = document.getElementById("gmailAvatar");
    makeAvatar(currentEmail, gmailAvatar);
    document.getElementById("gmailEmailLabel").textContent = currentEmail;
    document.getElementById("lblGmailDestino").textContent = currentEmail;
    showPhase("phaseGmail");
}

// ── Lógica de cada paso ───────────────────────────────────────────────────────
function handleEmailNext() {
    const email = document.getElementById("inputEmail").value.trim();
    if (!email || !email.includes("@")) {
        alert("Ingresa un correo electrónico válido.");
        return;
    }
    currentEmail = email;
    goToPassword();
}

function handlePasswordNext() {
    const pass = document.getElementById("inputPass").value.trim();
    if (!pass) {
        alert("Ingresa tu contrasena.");
        return;
    }
    const role = document.querySelector('input[name="rolPass"]:checked').value;

    // Validacion real de contrasena
    const credKey = "dajox_cred_" + currentEmail;
    const stored  = localStorage.getItem(credKey);

    if (!stored) {
        // Primer inicio de sesion: registrar credenciales
        localStorage.setItem(credKey, JSON.stringify({ password: pass, role: role }));
    } else {
        const cred = JSON.parse(stored);
        if (cred.password !== pass) {
            const inputPass = document.getElementById("inputPass");
            inputPass.value = "";
            inputPass.style.borderColor = "var(--neon-pink, #ff2d55)";
            inputPass.focus();
            // Mostrar error inline en lugar de alert
            let errEl = document.getElementById("passError");
            if (!errEl) {
                errEl = document.createElement("p");
                errEl.id = "passError";
                errEl.style.cssText = "color:#ff2d55;font-size:0.82rem;margin-top:6px;text-align:center;";
                inputPass.parentNode.insertBefore(errEl, inputPass.nextSibling);
            }
            errEl.textContent = "Contrasena incorrecta. Intentalo de nuevo.";
            return;
        }
        // Limpiar error si existia
        const errEl = document.getElementById("passError");
        if (errEl) errEl.remove();
    }

    const token = "DJX-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    tempUsuario = { email: currentEmail, role, token };
    addSavedAccount(currentEmail, role);
    goToGmail();
}

function handleConfirm() {
    if (!tempUsuario) return;
    localStorage.setItem("usuarioActual", JSON.stringify(tempUsuario));
    window.location.href = "dashboard.html";
}

// ── Inicialización ────────────────────────────────────────────────────────────
function resetPassword() {
    if (!confirm("Restablecer la contrasena de " + currentEmail + "? El proximo login creara una nueva.")) return;
    localStorage.removeItem("dajox_cred_" + currentEmail);
    const errEl = document.getElementById("passError");
    if (errEl) errEl.remove();
    document.getElementById("inputPass").style.borderColor = "";
    document.getElementById("inputPass").placeholder = "Crea una nueva contrasena";
    document.getElementById("inputPass").focus();
    const btn = document.getElementById("btnResetPass");
    if (btn) btn.style.display = "none";
}


document.addEventListener("DOMContentLoaded", () => {
    // Si ya hay sesión activa, redirigir directo
    if (localStorage.getItem("usuarioActual")) {
        window.location.href = "dashboard.html";
        return;
    }

    const accounts = getSavedAccounts();

    // Mostrar pantalla inicial según si hay cuentas guardadas
    if (accounts.length > 0) {
        goToPicker();
    } else {
        goToEmail();
    }

    // ── Picker ──
    document.getElementById("btnOtraCuenta").addEventListener("click", () => {
        currentEmail = "";
        goToEmail();
    });

    // ── Email phase ──
    document.getElementById("btnEmailSig").addEventListener("click", handleEmailNext);
    document.getElementById("inputEmail").addEventListener("keydown", e => {
        if (e.key === "Enter") handleEmailNext();
    });
    document.getElementById("btnEmailVolver").addEventListener("click", () => {
        goToPicker();
    });

    // ── Password phase ──
    document.getElementById("btnPassSig").addEventListener("click", handlePasswordNext);
    document.getElementById("inputPass").addEventListener("keydown", e => {
        if (e.key === "Enter") handlePasswordNext();
    });
    document.getElementById("btnChipEmail").addEventListener("click", () => {
        const accounts = getSavedAccounts();
        if (accounts.length > 0) goToPicker(); else goToEmail();
    });

    // ── Gmail phase ──
    document.getElementById("btnConfirmarGmail").addEventListener("click", handleConfirm);
    document.getElementById("btnVolverGmail").addEventListener("click", () => {
        goToPassword();
    });
});
