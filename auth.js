/* ==========================================================================
   DAJOX SYSTEM - AUTENTICACIÓN LOCAL
    ========================================================================== */

function getAuthSalonId() {
    const host = window.location.hostname || "localhost";
    if (host === "localhost" || host === "127.0.0.1") {
        let salonId = localStorage.getItem("dajox_sid");
        if (!salonId) {
            salonId = "local-" + Math.random().toString(36).substr(2, 6);
            localStorage.setItem("dajox_sid", salonId);
        }
        return salonId;
    }
    return host.split(".")[0];
}

const AUTH_TOPIC = "dajox-auth/" + getAuthSalonId();
let authMqtt = null;
let authMqttReady = false;

const AVATAR_COLORS = ["#4285f4", "#34a853", "#ea4335", "#fbbc05", "#7c3aed", "#0891b2"];

function avatarColor(email) {
    return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}

function avatarInitial(email) {
    return email.charAt(0).toUpperCase();
}

function getSavedAccounts() {
    try {
        const local = JSON.parse(localStorage.getItem("dajox_accounts") || "[]");
        const remote = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
        const accounts = [...remote, ...local];
        const unique = new Map(accounts.map(account => [String(account.email).toLowerCase(), account]));
        return [...unique.values()];
    } catch { return []; }
}

function getAccountByUsername(username) {
    const normalized = username.toLowerCase();
    return JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]")
        .find(account => String(account.email).toLowerCase() === normalized) || null;
}

function getStoredCredential(username) {
    const normalized = username.toLowerCase();
    const keys = ["dajox_cred_" + normalized, "dajox_cred_" + username];
    for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) return { key, value };
    }
    const account = getAccountByUsername(username);
    return account && account.password
        ? { key: "dajox_cred_" + normalized, value: JSON.stringify({
            password: account.password,
            role: account.role,
            securityQuestion: account.securityQuestion || "",
            securityAnswer: account.securityAnswer || ""
        }) }
        : null;
}

function getDeviceId() {
    let deviceId = localStorage.getItem("dajox_device_id");
    if (!deviceId) {
        deviceId = "device-" + Math.random().toString(36).substr(2, 12);
        localStorage.setItem("dajox_device_id", deviceId);
    }
    return deviceId;
}

function isTrustedDevice(account) {
    return Boolean(account && Array.isArray(account.trustedDevices) &&
        account.trustedDevices.indexOf(getDeviceId()) !== -1);
}

function showDeviceVerification(account, credential) {
    const data = account || {};
    const stored = credential || {};
    const question = data.securityQuestion || stored.securityQuestion;
    const answer = data.securityAnswer || stored.securityAnswer;
    if (!data.authEmail || !question || !answer) return false;

    sessionStorage.setItem("dajox_pending_device_auth", JSON.stringify({
        username: currentEmail,
        role: data.role || stored.role,
        password: stored.password,
        authEmail: data.authEmail,
        securityQuestion: question,
        securityAnswer: answer
    }));
    document.getElementById("deviceQuestionLabel").textContent = question;
    document.getElementById("deviceAuthEmailHint").textContent = "Escribe el correo que registraste en tu cuenta.";
    document.getElementById("deviceAnswer").value = "";
    document.getElementById("deviceEmail").value = "";
    document.getElementById("deviceVerifyError").textContent = "";
    showPhase("phaseDeviceVerification");
    document.getElementById("deviceAnswer").focus();
    return true;
}

function confirmDeviceVerification() {
    const pending = JSON.parse(sessionStorage.getItem("dajox_pending_device_auth") || "null");
    if (!pending) return;
    const email = document.getElementById("deviceEmail").value.trim().toLowerCase();
    const answer = document.getElementById("deviceAnswer").value.trim().toLowerCase();
    const error = document.getElementById("deviceVerifyError");
    if (email !== pending.authEmail.toLowerCase() || answer !== pending.securityAnswer.toLowerCase()) {
        error.textContent = "El correo o la respuesta no coinciden con esta cuenta.";
        return;
    }

    const accounts = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
    const account = accounts.find(item => item.email.toLowerCase() === pending.username.toLowerCase());
    if (account) {
        account.trustedDevices = Array.from(new Set([...(account.trustedDevices || []), getDeviceId()]));
        localStorage.setItem("dajox_accounts_data", JSON.stringify(accounts));
        publishAccounts();
    }
    sessionStorage.removeItem("dajox_pending_device_auth");
    tempUsuario = {
        email: pending.username,
        role: pending.role,
        token: "DJX-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        authEmail: pending.authEmail
    };
    handleConfirm();
}

function addSavedAccount(email, role) {
    const normalized = email.toLowerCase();
    const prev = getSavedAccounts().filter(a => a.email.toLowerCase() !== normalized);
    localStorage.setItem("dajox_accounts", JSON.stringify([{ email, role }, ...prev].slice(0, 6)));
    publishAccounts();
}

function publishAccounts() {
    if (!authMqtt || !authMqttReady) return;
    const accounts = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
    authMqtt.publish(AUTH_TOPIC, JSON.stringify(accounts), { qos: 1, retain: true });
}

function saveAccountData(email, password, role) {
    const accounts = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
    const index = accounts.findIndex(account => account.email.toLowerCase() === email.toLowerCase());
    const account = {
        email,
        password,
        role,
        authEmail: index === -1 ? "" : (accounts[index].authEmail || ""),
        securityQuestion: index === -1 ? "" : (accounts[index].securityQuestion || ""),
        securityAnswer: index === -1 ? "" : (accounts[index].securityAnswer || ""),
        trustedDevices: index === -1 ? [] : (accounts[index].trustedDevices || [])
    };
    if (index === -1) accounts.push(account);
    else accounts[index] = account;
    localStorage.setItem("dajox_accounts_data", JSON.stringify(accounts));
    publishAccounts();
}

function connectAuthSync() {
    if (typeof window.mqtt === "undefined") return;
    authMqtt = window.mqtt.connect("wss://broker.emqx.io:8084/mqtt", {
        clientId: "djx-auth-" + Math.random().toString(36).substr(2, 9),
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 4000,
        keepalive: 30
    });
    authMqtt.on("connect", () => {
        authMqttReady = true;
        authMqtt.subscribe(AUTH_TOPIC, { qos: 1 });
        publishAccounts();
    });
    authMqtt.on("message", (topic, payload) => {
        if (topic !== AUTH_TOPIC) return;
        try {
            const remote = JSON.parse(payload.toString());
            if (!Array.isArray(remote)) return;
            const current = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
            const merged = new Map([...current, ...remote].map(account => [account.email, account]));
            localStorage.setItem("dajox_accounts_data", JSON.stringify([...merged.values()]));
            if (remote.length > 0 && !document.getElementById("phaseWelcome").classList.contains("hidden")) {
                goToPicker();
            } else {
                renderAccountList();
            }
        } catch { /* Ignorar mensajes de autenticacion invalidos. */ }
    });
}

// ── Estado global del login ───────────────────────────────────────────────────
let currentEmail = "";
let tempUsuario = null;
let authIntent = "login";

// ── Helpers de pantalla ───────────────────────────────────────────────────────
function showPhase(phase) {
    ["phaseWelcome", "phaseAccountChoice", "phasePicker", "phaseEmail", "phasePassword", "phaseSecurityReset", "phaseDeviceVerification", "phaseGmail"].forEach(id => {
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
            <button class="account-delete" type="button" aria-label="Eliminar cuenta" title="Eliminar cuenta">Eliminar</button>
        `;

        item.addEventListener("click", () => {
            currentEmail = acc.email;
            authIntent = "login";
            // Pre-seleccionar el rol guardado
            const radios = document.querySelectorAll('input[name="rolPass"]');
            radios.forEach(r => { r.checked = (r.value === acc.role); });
            goToPassword();
        });

        item.querySelector(".account-delete").addEventListener("click", event => {
            event.stopPropagation();
            showDeleteAccountPrompt(acc);
        });

        lista.appendChild(item);
    });
}

function showDeleteAccountPrompt(account) {
    const overlay = document.createElement("div");
    overlay.className = "account-delete-overlay";
    overlay.innerHTML = `
        <div class="account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="deleteAccountTitle">
            <h2 id="deleteAccountTitle">¿Eliminar esta cuenta?</h2>
            <p>Se eliminará <strong>${account.email}</strong>, su contraseña guardada y todas las clases asociadas a esta cuenta en este dispositivo.</p>
            <p class="account-delete-warning">Esta acción no se puede deshacer.</p>
            <div class="account-delete-actions">
                <button type="button" class="account-delete-cancel">Cancelar</button>
                <button type="button" class="account-delete-confirm">Sí, eliminar cuenta</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector(".account-delete-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".account-delete-confirm").addEventListener("click", () => {
        deleteAccount(account.email);
        overlay.remove();
    });
}

function deleteAccount(username) {
    const normalized = username.toLowerCase();
    localStorage.removeItem("dajox_cred_" + normalized);
    localStorage.setItem("dajox_accounts", JSON.stringify(
        getSavedAccounts().filter(account => account.email.toLowerCase() !== normalized)
    ));

    const accounts = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]")
        .filter(account => account.email.toLowerCase() !== normalized);
    localStorage.setItem("dajox_accounts_data", JSON.stringify(accounts));
    localStorage.removeItem("dajox_joined_" + username);

    if (typeof DajoxDB !== "undefined") {
        DajoxDB.toArray().forEach(cls => {
            if (cls.instructor === username) {
                DajoxDB.deleteClass(cls.id);
            } else if ((cls.inscritos || []).indexOf(username) !== -1) {
                cls.inscritos = cls.inscritos.filter(student => student !== username);
                DajoxDB.updateClass(cls);
            }
        });
    }

    publishAccounts();
    renderAccountList();
    if (getSavedAccounts().length > 0) goToPicker();
    else showPhase("phaseWelcome");
}

function goToWelcome() {
    showPhase("phaseWelcome");
}

function goToAccountChoice() {
    showPhase("phaseAccountChoice");
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
    const remoteAccount = getAccountByUsername(currentEmail);
    const savedCredential = getStoredCredential(currentEmail);
    let assignedRole = remoteAccount ? remoteAccount.role : "";
    if (!assignedRole && savedCredential) {
        try { assignedRole = JSON.parse(savedCredential.value).role || ""; } catch { assignedRole = ""; }
    }
    const roleAssigned = document.getElementById("roleAssigned");
    const roleSelector = document.getElementById("roleSelector");
    const roleAssignedValue = document.getElementById("roleAssignedValue");
    const securitySetup = document.getElementById("securitySetup");
    const isExistingAccount = authIntent === "login" && Boolean(assignedRole);
    roleAssigned.classList.toggle("hidden", !isExistingAccount);
    roleSelector.classList.toggle("hidden", isExistingAccount);
    if (isExistingAccount) {
        roleAssignedValue.textContent = assignedRole === "INSTRUCTOR" ? "Instructor SENA" : "Aprendiz SENA";
    }
    securitySetup.classList.toggle("hidden", authIntent !== "create");
    showPhase("phasePassword");
    setTimeout(() => document.getElementById("inputPass").focus(), 100);

    // Boton de reset si ya tiene contrasena registrada
    const resetBtn = document.getElementById("btnResetPass");
    if (resetBtn) {
        if (savedCredential) {
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
    if (!email || email.length < 3) {
        alert("Ingresa un nombre de usuario válido.");
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
    const selectedRole = document.querySelector('input[name="rolPass"]:checked');
    let role = selectedRole ? selectedRole.value : "";
    if (!role && authIntent === "create") {
        alert("Selecciona si eres Instructor SENA o Aprendiz SENA.");
        return;
    }
    const securityQuestion = document.getElementById("securityQuestion").value;
    const securityAnswer = document.getElementById("securityAnswer").value.trim();
    if (authIntent === "create" && (!securityQuestion || !securityAnswer)) {
        alert("Selecciona una pregunta y escribe su respuesta.");
        return;
    }

    // Validacion real de contrasena
    const credKey = "dajox_cred_" + currentEmail.toLowerCase();
    const remoteAccount = getAccountByUsername(currentEmail);
    const savedCredential = getStoredCredential(currentEmail);
    const stored = savedCredential ? savedCredential.value : null;

    if (!stored && authIntent === "login") {
        const inputPass = document.getElementById("inputPass");
        inputPass.value = "";
        let errEl = document.getElementById("passError");
        if (!errEl) {
            errEl = document.createElement("p");
            errEl.id = "passError";
            errEl.style.cssText = "color:#ff2d55;font-size:0.82rem;margin-top:6px;text-align:center;";
            inputPass.parentNode.insertBefore(errEl, inputPass.nextSibling);
        }
        errEl.textContent = "No encontramos esa cuenta. Usa Crear una nueva para registrarte.";
        return;
    }

    if (stored && authIntent === "create") {
        const inputPass = document.getElementById("inputPass");
        inputPass.value = "";
        let errEl = document.getElementById("passError");
        if (!errEl) {
            errEl = document.createElement("p");
            errEl.id = "passError";
            errEl.style.cssText = "color:#ff2d55;font-size:0.82rem;margin-top:6px;text-align:center;";
            inputPass.parentNode.insertBefore(errEl, inputPass.nextSibling);
        }
        errEl.textContent = "Ese nombre de usuario ya existe. Elige otro.";
        return;
    }

    if (!stored) {
        // Primer inicio de sesion: registrar credenciales
        const credential = {
            password: pass,
            role: role,
            securityQuestion: securityQuestion,
            securityAnswer: securityAnswer.toLowerCase()
        };
        localStorage.setItem(credKey, JSON.stringify(credential));
        saveAccountData(currentEmail, pass, role);
        const accounts = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
        const account = accounts.find(item => item.email.toLowerCase() === currentEmail.toLowerCase());
        if (account) {
            account.securityQuestion = securityQuestion;
            account.securityAnswer = securityAnswer.toLowerCase();
            localStorage.setItem("dajox_accounts_data", JSON.stringify(accounts));
            publishAccounts();
        }
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
        role = cred.role || (remoteAccount && remoteAccount.role) || role;
        const roleInput = document.querySelector('input[name="rolPass"][value="' + role + '"]');
        if (roleInput) roleInput.checked = true;
        saveAccountData(currentEmail, cred.password, role);
        // Limpiar error si existia
        const errEl = document.getElementById("passError");
        if (errEl) errEl.remove();
    }

    const accountForVerification = remoteAccount || {};
    const credentialForVerification = JSON.parse(stored || "{}");
    if (authIntent === "login" && accountForVerification.authEmail &&
        !isTrustedDevice(accountForVerification) &&
        showDeviceVerification(accountForVerification, credentialForVerification)) {
        return;
    }

    const token = "DJX-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    tempUsuario = {
        email: currentEmail,
        role,
        token,
        authEmail: remoteAccount ? (remoteAccount.authEmail || "") : ""
    };
    addSavedAccount(currentEmail, role);
    handleConfirm();
}

function handleConfirm() {
    if (!tempUsuario) return;
    localStorage.setItem("usuarioActual", JSON.stringify(tempUsuario));
    window.location.href = "dashboard.html";
}

// ── Inicialización ────────────────────────────────────────────────────────────
function resetPassword() {
    const account = getAccountByUsername(currentEmail);
    const credential = getStoredCredential(currentEmail);
    let data = account;
    if (!data && credential) {
        try { data = JSON.parse(credential.value); } catch { data = null; }
    }
    if (!data || !data.securityQuestion || !data.securityAnswer) {
        alert("Esta cuenta no tiene una pregunta de seguridad configurada.");
        return;
    }
    document.getElementById("resetQuestionLabel").textContent = data.securityQuestion;
    document.getElementById("resetAnswer").value = "";
    document.getElementById("resetNewPassword").value = "";
    document.getElementById("resetError").textContent = "";
    showPhase("phaseSecurityReset");
    document.getElementById("resetAnswer").focus();
}

function confirmPasswordReset() {
    const account = getAccountByUsername(currentEmail);
    const credential = getStoredCredential(currentEmail);
    let data = account;
    if (!data && credential) {
        try { data = JSON.parse(credential.value); } catch { data = null; }
    }
    const answer = document.getElementById("resetAnswer").value.trim().toLowerCase();
    const newPassword = document.getElementById("resetNewPassword").value.trim();
    const error = document.getElementById("resetError");
    if (!data || answer !== String(data.securityAnswer).toLowerCase()) {
        error.textContent = "La respuesta no coincide.";
        return;
    }
    if (newPassword.length < 4) {
        error.textContent = "La nueva contraseña debe tener al menos 4 caracteres.";
        return;
    }
    const normalized = currentEmail.toLowerCase();
    localStorage.setItem("dajox_cred_" + normalized, JSON.stringify({
        password: newPassword,
        role: data.role,
        securityQuestion: data.securityQuestion,
        securityAnswer: data.securityAnswer
    }));
    const accounts = JSON.parse(localStorage.getItem("dajox_accounts_data") || "[]");
    const storedAccount = accounts.find(item => item.email.toLowerCase() === normalized);
    if (storedAccount) storedAccount.password = newPassword;
    localStorage.setItem("dajox_accounts_data", JSON.stringify(accounts));
    publishAccounts();
    alert("Contraseña restablecida correctamente.");
    goToPassword();
}


document.addEventListener("DOMContentLoaded", () => {
    connectAuthSync();
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
        goToWelcome();
    }

    // ── Picker ──
    document.getElementById("btnOtraCuenta").addEventListener("click", () => {
        authIntent = "login";
        currentEmail = "";
        goToEmail();
    });
    document.getElementById("btnPickerHome").addEventListener("click", goToWelcome);

    document.getElementById("btnWelcomeLogin").addEventListener("click", () => {
        authIntent = "login";
        currentEmail = "";
        goToAccountChoice();
    });
    document.getElementById("btnWelcomeCreate").addEventListener("click", () => {
        authIntent = "create";
        currentEmail = "";
        goToEmail();
    });
    document.getElementById("btnCrearCuentaInline").addEventListener("click", event => {
        event.preventDefault();
        goToAccountChoice();
    });

    document.getElementById("btnChoiceYes").addEventListener("click", () => {
        authIntent = "login";
        currentEmail = "";
        if (getSavedAccounts().length > 0) goToPicker();
        else goToEmail();
    });
    document.getElementById("btnChoiceNo").addEventListener("click", () => {
        authIntent = "create";
        currentEmail = "";
        goToEmail();
    });
    document.getElementById("btnChoiceHome").addEventListener("click", goToWelcome);

    // ── Email phase ──
    document.getElementById("btnEmailSig").addEventListener("click", handleEmailNext);
    document.getElementById("inputEmail").addEventListener("keydown", e => {
        if (e.key === "Enter") handleEmailNext();
    });
    document.getElementById("btnEmailVolver").addEventListener("click", () => {
        goToAccountChoice();
    });

    // ── Password phase ──
    document.getElementById("btnPassSig").addEventListener("click", handlePasswordNext);
    document.getElementById("inputPass").addEventListener("keydown", e => {
        if (e.key === "Enter") handlePasswordNext();
    });
    document.getElementById("btnResetConfirm").addEventListener("click", confirmPasswordReset);
    document.getElementById("btnResetBack").addEventListener("click", goToPassword);
    document.getElementById("btnDeviceVerify").addEventListener("click", confirmDeviceVerification);
    document.getElementById("btnDeviceBack").addEventListener("click", goToPassword);
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
