async function apiPost(endpoint, data) {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {})
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
        const message = json?.error || response.statusText || "Request failed";
        throw new Error(message);
    }
    return json;
}
const GYMRAT_THEME_KEY = "gymrat:theme";

function isDarkModeEnabled() {
    return localStorage.getItem(GYMRAT_THEME_KEY) === "dark";
}

function updateThemeColor(isDark) {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", isDark ? "#020617" : "#0f172a");
}

function applySavedTheme() {
    const isDark = isDarkModeEnabled();
    const pageName = window.location.pathname.split("/").pop();
    const backgroundOnlyPages = new Set([
        "Anatomy.html",
        "AnatomyAbs.html",
        "AnatomyBack.html",
        "AnatomyBiceps.html",
        "AnatomyCalves.html",
        "AnatomyChest.html",
        "AnatomyForearms.html",
        "AnatomyGlutes.html",
        "AnatomyHamstrings.html",
        "AnatomyQuadriceps.html",
        "AnatomyShoulders.html",
        "AnatomyTriceps.html",
        "Abs.html",
        "AbsE.html",
        "Back.html",
        "BackE.html",
        "Biceps.html",
        "BicepsE.html",
        "Calves.html",
        "CalvesE.html",
        "Chest.html",
        "ChestE.html",
        "Forearms.html",
        "ForearmsE.html",
        "Glutes.html",
        "GlutesE.html",
        "Hamstrings.html",
        "HamstringsE.html",
        "Quadriceps.html",
        "QuadricepsE.html",
        "Shoulders.html",
        "ShouldersE.html",
        "Triceps.html",
        "TricepsE.html"
    ]);
    const shouldUseBackgroundOnly = backgroundOnlyPages.has(pageName);
    const shouldApplyDark = isDark && !shouldUseBackgroundOnly;
    const shouldApplyDarkBackground = isDark && shouldUseBackgroundOnly;
    if (document.body) {
        document.body.classList.toggle("dark-mode", shouldApplyDark);
        document.body.classList.toggle("theme-dark-background", shouldApplyDarkBackground);
    }
    updateThemeColor(isDark);
}

function syncDarkModeToggle() {
    const toggle = document.getElementById("darkModeToggle");
    if (toggle) toggle.checked = isDarkModeEnabled();
}

function toggleDarkMode(shouldEnable) {
    localStorage.setItem(GYMRAT_THEME_KEY, shouldEnable ? "dark" : "light");
    applySavedTheme();
    syncDarkModeToggle();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applySavedTheme);
} else {
    applySavedTheme();
}

function mergeDeep(target, source) {
    const output = { ...target };
    for (const key in source) {
        if (key === "gym_plans") {
            output[key] = source[key];
        } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            output[key] = mergeDeep(target[key], source[key]);
        } else {
            output[key] = source[key];
        }
    }
    return output;
}

function getDefaultSelections() {
    return {
        favorites: [],
        favorites_meta: {
            updatedAt: null,
            lastSyncedAt: null,
            pendingSync: false,
            deviceId: null,
            baseCloudUpdatedAt: null
        },
        pages: {},
        pages_meta: {},
        program: "",
        exercise_plan: {},
        weekly_table: {},
        gym_table: {},
        planner: null,
        gym_plans: {},
        diet: {
            calorieTarget: 2100,
            macroTargets: {
                protein: 150,
                carbs: 220,
                fat: 70
            },
            profile: {
                isComplete: false
            },
            recordsByDate: {},
        dailyStatsByDate: {},
        statsMeta: {}
        }
    };
}

function getStoredAuthSession() {
    try {
        const raw = localStorage.getItem("authSession");
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function setStoredAuthSession(session) {
    if (!session?.username || !session?.token) return;
    localStorage.setItem("authSession", JSON.stringify({
        username: session.username,
        accountKey: session.accountKey || session.username,
        googleEmail: session.googleEmail || "",
        needsLegacyMigration: Boolean(session.needsLegacyMigration),
        token: session.token,
        deviceId: session.deviceId || ""
    }));
    localStorage.setItem("currentUser", session.username);
}

function clearStoredAuthSession() {
    localStorage.removeItem("authSession");
    localStorage.removeItem("currentUser");
}

function getAuthorizedPayload(extra = {}) {
    const session = getStoredAuthSession();
    return {
        ...extra,
        accountKey: session?.accountKey || "",
        authToken: session?.token || ""
    };
}

function handleAuthError(error) {
    if (!error?.message) return;
    const normalized = error.message.toLowerCase();
    if (normalized.includes("unauthorized") || normalized.includes("session")) {
        clearStoredAuthSession();
    }
}

const USER_DOC_CACHE_PREFIX = "gymrat:userdoc:";
const PENDING_SELECTIONS_PREFIX = "gymrat:pending:selections:";
const OFFLINE_AUTH_PREFIX = "gymrat:offline-auth:";
const APP_LAST_LOGIN_KEY = "gymrat:app:last-login";
const OFFLINE_AUTH_VERSION = 2;
const OFFLINE_SW_PATH = "./service-worker.js";
const nativeAlert = window.alert.bind(window);

function ensureGymratDialogStyles() {
    const styleId = "gymrat-dialog-styles";
    let style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.textContent = `
        .gymrat-dialog-modal {
            position: fixed;
            inset: 0;
            z-index: 20000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
            box-sizing: border-box;
            background: rgba(2, 6, 23, 0.72);
            backdrop-filter: blur(8px);
        }
        .gymrat-dialog-box {
            position: relative;
            width: min(430px, 100%);
            padding: 24px;
            box-sizing: border-box;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.96);
            color: #f8fafc;
            box-shadow: 0 28px 70px rgba(0, 0, 0, 0.48);
            font-family: sans-serif;
            text-align: left;
            direction: ltr;
            unicode-bidi: isolate;
        }
        .gymrat-dialog-kicker {
            margin: 0 0 8px;
            font-size: 0.72rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: rgba(248, 250, 252, 0.72);
            font-weight: 800;
        }
        .gymrat-dialog-box h2 {
            margin: 8px 0 16px;
            font-size: 1.45rem;
            line-height: 1.2;
        }
        .gymrat-dialog-message {
            margin: 0;
            color: rgba(248, 250, 252, 0.88);
            line-height: 1.55;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            direction: ltr;
            unicode-bidi: plaintext;
        }
        .gymrat-dialog-checkbox-row[hidden] {
            display: none !important;
        }
        .gymrat-dialog-checkbox-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 16px;
            padding: 10px 12px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.06);
            color: rgba(248, 250, 252, 0.9);
            font-weight: 800;
            line-height: 1.35;
        }
        .gymrat-dialog-checkbox-row input {
            width: 18px;
            height: 18px;
            flex: 0 0 auto;
            accent-color: #22c55e;
        }
        .gymrat-dialog-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 18px;
        }
        .gymrat-dialog-ok,
        .gymrat-dialog-cancel {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 12px 16px;
            box-sizing: border-box;
            border-radius: 10px;
            color: #ffffff;
            font-size: 0.98rem;
            font-weight: 800;
            text-align: center;
        }
        .gymrat-dialog-ok {
            border: 0;
            background: linear-gradient(135deg, #ef4444, #dc2626);
        }
        .gymrat-dialog-cancel {
            border: 0;
            background: linear-gradient(135deg, #22c55e, #16a34a);
        }
        @media (max-width: 640px) {
            .gymrat-dialog-box {
                padding: 22px 18px;
            }
            .gymrat-dialog-actions {
                grid-template-columns: 1fr;
            }
        }
    `;
}

function showGymratDialog(message, options = {}) {
    const translateDialogText = value => typeof window.gymratTranslateText === "function" ? window.gymratTranslateText(value) : String(value || "");
    if (!document.body) {
        nativeAlert(translateDialogText(message));
        return Promise.resolve(true);
    }

    ensureGymratDialogStyles();

    return new Promise(resolve => {
        const modal = document.createElement("div");
        modal.className = "gymrat-dialog-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("dir", "ltr");

        const title = translateDialogText(options.title || "Notice");
        modal.innerHTML = `
            <div class="gymrat-dialog-box">
                <p class="gymrat-dialog-kicker">${options.kicker || "GYMRAT"}</p>
                <h2>${title}</h2>
                <p class="gymrat-dialog-message"></p>
                <label class="gymrat-dialog-checkbox-row" hidden>
                    <input class="gymrat-dialog-checkbox" type="checkbox">
                    <span></span>
                </label>
                <div class="gymrat-dialog-actions">
                    <button class="gymrat-dialog-ok" type="button">${translateDialogText("OK")}</button>
                    <button class="gymrat-dialog-cancel" type="button">${translateDialogText("Cancel")}</button>
                </div>
            </div>
        `;

        modal.querySelector(".gymrat-dialog-message").textContent = translateDialogText(message);
        const okButton = modal.querySelector(".gymrat-dialog-ok");
        const cancelButton = modal.querySelector(".gymrat-dialog-cancel");
        const checkboxRow = modal.querySelector(".gymrat-dialog-checkbox-row");
        const checkbox = modal.querySelector(".gymrat-dialog-checkbox");
        if (options.checkboxLabel && checkboxRow && checkbox) {
            checkboxRow.hidden = false;
            checkboxRow.querySelector("span").textContent = translateDialogText(options.checkboxLabel);
        } else if (checkboxRow) {
            checkboxRow.remove();
        }
        if (options.showCancel) {
            okButton.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
            okButton.style.border = "0";
            cancelButton.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
            cancelButton.style.border = "0";
        }
        if (!options.showCancel) {
            cancelButton.remove();
            modal.querySelector(".gymrat-dialog-actions").style.gridTemplateColumns = "1fr";
        }
        document.body.appendChild(modal);

        const close = value => {
            const checked = Boolean(checkbox?.checked);
            modal.remove();
            resolve(options.returnCheckboxState ? { confirmed: value, checked } : value);
        };

        okButton.addEventListener("click", () => close(true));
        cancelButton.addEventListener("click", () => close(false));
        modal.addEventListener("click", event => {
            if (event.target === modal) close(false);
        });
        modal.addEventListener("keydown", event => {
            if (event.key === "Escape") close(false);
            if (event.key === "Enter") close(true);
        });
        okButton.focus();
    });
}

window.gymratAlert = message => showGymratDialog(message, { title: "Notice", showCancel: false });
window.gymratConfirm = message => showGymratDialog(message, { title: "Please Confirm", showCancel: true });
window.alert = message => {
    void window.gymratAlert(message);
};

function readStoredJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function writeStoredJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function isGymratInstalledApp() {
    const userAgent = navigator.userAgent || "";
    const isAndroidWebView = /; wv\)/i.test(userAgent) || /\bwv\b/i.test(userAgent);
    const isStandaloneApp = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    const isInstalledIosApp = window.navigator.standalone === true;
    return isAndroidWebView || isStandaloneApp || isInstalledIosApp;
}

function rememberAppLogin(username, password) {
    if (!username || !password) return;
    writeStoredJson(APP_LAST_LOGIN_KEY, {
        username,
        password,
        updatedAt: new Date().toISOString()
    });
}

function getRememberedAppLogin() {
    return readStoredJson(APP_LAST_LOGIN_KEY);
}

function prefillAppLoginFields() {
    const rememberedLogin = getRememberedAppLogin();
    if (!rememberedLogin?.username) return;

    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    if (!usernameInput || !passwordInput) return;

    usernameInput.value = rememberedLogin.username;
    if (rememberedLogin.password) passwordInput.value = rememberedLogin.password;
}

function initializePasswordToggles() {
    document.querySelectorAll(".auth-password-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.getAttribute("aria-controls"));
            if (!input) return;

            const shouldShow = input.type === "password";
            input.type = shouldShow ? "text" : "password";
            button.classList.toggle("is-visible", shouldShow);
            button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
            button.title = shouldShow ? "Hide password" : "Show password";
        });
    });
}

function setTermsValidationState(isInvalid) {
    const termsRow = document.getElementById("registerTerms")?.closest(".auth-check-row");
    if (!termsRow) return;
    termsRow.classList.toggle("auth-check-error", Boolean(isInvalid));
}

function getOfflineAuthKey(username) {
    return `${OFFLINE_AUTH_PREFIX}${`${username || ""}`.trim().toLowerCase()}`;
}

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBuffer(hex) {
    const bytes = new Uint8Array(Math.floor(`${hex || ""}`.length / 2));
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes.buffer;
}

async function deriveOfflinePasswordHash(password, saltHex) {
    const cryptoApi = window.crypto?.subtle;
    if (!cryptoApi || !password || !saltHex) return "";

    const keyMaterial = await cryptoApi.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const derivedBits = await cryptoApi.deriveBits(
        {
            name: "PBKDF2",
            salt: hexToBuffer(saltHex),
            iterations: 210000,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );
    return bufferToHex(derivedBits);
}

async function rememberOfflineLogin(username, password) {
    if (!username || !password) return;
    const randomBytes = new Uint8Array(16);
    window.crypto.getRandomValues(randomBytes);
    const salt = bufferToHex(randomBytes.buffer);
    const passwordHash = await deriveOfflinePasswordHash(password, salt);
    if (!passwordHash) return;

    writeStoredJson(getOfflineAuthKey(username), {
        username: `${username}`.trim().toLowerCase(),
        version: OFFLINE_AUTH_VERSION,
        algorithm: "PBKDF2-SHA256",
        iterations: 210000,
        salt,
        passwordHash,
        updatedAt: new Date().toISOString()
    });
}

async function canLoginOffline(username, password) {
    if (!username || !password) return false;
    const offlineAuth = readStoredJson(getOfflineAuthKey(username));
    if (!offlineAuth) return false;

    if (offlineAuth.version === OFFLINE_AUTH_VERSION && offlineAuth.salt && offlineAuth.passwordHash) {
        const passwordHash = await deriveOfflinePasswordHash(password, offlineAuth.salt);
        return Boolean(passwordHash && passwordHash === offlineAuth.passwordHash);
    }

    if (offlineAuth?.username === username && offlineAuth?.password === password) {
        await rememberOfflineLogin(username, password);
        return true;
    }

    return false;
}

function isOfflineAuthSession(session = getStoredAuthSession()) {
    return Boolean(session?.token && `${session.token}`.startsWith("offline-"));
}

async function ensureCloudAuthSession(username) {
    if (!username || !navigator.onLine) return false;

    const session = getStoredAuthSession();
    if (session?.token && !isOfflineAuthSession(session) && (session.username === username || session.accountKey === username || session.accountKey)) {
        return true;
    }

    return false;
}

function getUserDocCacheKey(username) {
    return `${USER_DOC_CACHE_PREFIX}${username}`;
}

function getPendingSelectionsKey(username) {
    return `${PENDING_SELECTIONS_PREFIX}${username}`;
}

function readCachedUserDoc(username) {
    if (!username) return null;
    return readStoredJson(getUserDocCacheKey(username));
}

function writeCachedUserDoc(username, userDoc) {
    if (!username || !userDoc) return;
    writeStoredJson(getUserDocCacheKey(username), userDoc);
}

function getPendingSelectionsUpdate(username) {
    if (!username) return null;
    return readStoredJson(getPendingSelectionsKey(username));
}

function clearPendingSelectionsUpdate(username) {
    if (!username) return;
    localStorage.removeItem(getPendingSelectionsKey(username));
}

function clearPendingSelectionsFields(username, fields) {
    if (!username || !Array.isArray(fields) || fields.length === 0) return;

    const pending = getPendingSelectionsUpdate(username);
    if (!pending || typeof pending !== "object") return;

    fields.forEach(field => {
        delete pending[field];
    });

    if (Object.keys(pending).length === 0) {
        clearPendingSelectionsUpdate(username);
        return;
    }

    writeStoredJson(getPendingSelectionsKey(username), pending);
}

function queuePendingSelectionsUpdate(username, selectionsUpdate) {
    if (!username || !selectionsUpdate) return null;
    const current = getPendingSelectionsUpdate(username) || {};
    const merged = mergeDeep(current, selectionsUpdate);
    writeStoredJson(getPendingSelectionsKey(username), merged);
    return merged;
}

function mergeSelectionsIntoLocalCache(username, selectionsUpdate) {
    if (!username) {
        return { username: "", selections: getDefaultSelections() };
    }

    const cached = readCachedUserDoc(username) || { username, selections: getDefaultSelections() };
    const mergedSelections = mergeDeep(cached.selections || getDefaultSelections(), selectionsUpdate || {});
    const nextDoc = {
        ...cached,
        username,
        selections: mergedSelections
    };

    writeCachedUserDoc(username, nextDoc);
    return nextDoc;
}

function checkAuth() {
    let user = localStorage.getItem("currentUser");
    const session = getStoredAuthSession();
    if (!user && session?.username && session?.token) {
        localStorage.setItem("currentUser", session.username);
        user = session.username;
    }
    if (!user) {
        window.location.href = "index.html";
        return false;
    }
    return true;
}

function clearDeviceLoginData(username, { clearSession = true, forgetDevice = false } = {}) {
    const normalizedUsername = `${username || localStorage.getItem("currentUser") || ""}`.trim();
    if (clearSession) clearStoredAuthSession();

    if (!forgetDevice) return;

    const rememberedLogin = readStoredJson(APP_LAST_LOGIN_KEY);
    if (!rememberedLogin?.username || !normalizedUsername || rememberedLogin.username === normalizedUsername) {
        localStorage.removeItem(APP_LAST_LOGIN_KEY);
    }

    if (normalizedUsername) {
        localStorage.removeItem(getOfflineAuthKey(normalizedUsername));
        localStorage.removeItem(getUserDocCacheKey(normalizedUsername));
        localStorage.removeItem(getPendingSelectionsKey(normalizedUsername));
        localStorage.removeItem(`gymrat:favorites:draft:${normalizedUsername}`);
        localStorage.removeItem(`gymrat:weights:draft:${normalizedUsername}`);
    }
}

function openAccountActionsDialog() {
    const modal = document.getElementById("accountActionsModal");
    if (!modal) return;
    const currentUser = localStorage.getItem("currentUser") || "";
    const userLabel = document.getElementById("settingsCurrentUser");
    if (userLabel) userLabel.textContent = currentUser ? `User: ${currentUser}` : "User: Not signed in";
    syncDarkModeToggle();
    attachAccountActionsBackdropClose();
    modal.hidden = false;
}

function closeAccountActionsDialog() {
    const modal = document.getElementById("accountActionsModal");
    if (!modal) return;
    modal.hidden = true;
}
function attachAccountActionsBackdropClose() {
    const modal = document.getElementById("accountActionsModal");
    if (!modal || modal.dataset.backdropCloseAttached === "true") return;
    modal.dataset.backdropCloseAttached = "true";
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeAccountActionsDialog();
        }
    });
}

async function logoutCurrentDevice() {
    if (!(await window.gymratConfirm("Are you sure you want to log out?"))) return;
    clearDeviceLoginData(localStorage.getItem("currentUser"), { clearSession: true, forgetDevice: false });
    window.location.href = "index.html";
}

async function forgetCurrentDeviceLogin() {
    if (!(await window.gymratConfirm("Forget the saved login on this device? You can still log in again later."))) return;
    clearDeviceLoginData(localStorage.getItem("currentUser"), { clearSession: true, forgetDevice: true });
    window.location.href = "index.html";
}

async function changeCurrentUsername() {
    const currentUsername = localStorage.getItem("currentUser") || "";
    const input = document.getElementById("settingsNewUsername");
    const status = document.getElementById("settingsUsernameStatus");
    const newUsername = `${input?.value || ""}`.trim();

    if (status) status.textContent = "Checking...";

    if (!currentUsername) {
        if (status) status.textContent = "No account is logged in.";
        return;
    }

    if (!navigator.onLine) {
        if (status) status.textContent = "You must be online to change username.";
        return;
    }

    if (!newUsername) {
        if (status) status.textContent = "Enter a new username.";
        return;
    }

    if (!(await window.gymratConfirm(`Change username to ${newUsername}?`))) {
        if (status) status.textContent = "";
        return;
    }

    try {
        const result = await apiPost("/api/users-change-username", getAuthorizedPayload({
            username: currentUsername,
            newUsername
        }));
        if (!result?.ok || !result?.username || !result?.accountKey || !result?.token) {
            throw new Error("Username was not changed.");
        }
        setStoredAuthSession({
            username: result.username,
            accountKey: result.accountKey,
            googleEmail: result.googleEmail,
            token: result.token
        });
        await syncAccountStateFromCloud(result.username);
        const userLabel = document.getElementById("settingsCurrentUser");
        if (userLabel) userLabel.textContent = `User: ${result.username}`;
        const sidebarUser = document.getElementById("mainSidebarUser");
        if (sidebarUser) {
            sidebarUser.textContent = result.username;
            sidebarUser.title = result.username;
        }
        if (input) input.value = "";
        if (status) status.textContent = translateAuthText("Username changed.");
    } catch (error) {
        if (status) status.textContent = translateAuthText("Username change failed: " + error.message);
    }
}
async function deleteCurrentAccount() {
    const username = localStorage.getItem("currentUser");
    if (!username) {
        clearDeviceLoginData("", { clearSession: true, forgetDevice: true });
        window.location.href = "index.html";
        return;
    }

    if (!navigator.onLine) {
        alert("You must be online to delete your account.");
        return;
    }

    if (!(await window.gymratConfirm("Delete this account and its cloud data? This cannot be undone."))) return;
    if (!(await window.gymratConfirm("Are you completely sure you want to delete this account?"))) return;

    try {
        await apiPost("/api/users-delete", getAuthorizedPayload({ username }));
        clearDeviceLoginData(username, { clearSession: true, forgetDevice: true });
        window.location.href = "index.html";
    } catch (error) {
        alert("Delete account failed: " + error.message);
    }
}

async function changeCurrentPassword() {
    const status = document.getElementById("settingsPasswordStatus");
    const message = "Password changes are handled by your Google account.";
    if (status) status.textContent = translateAuthText(message);
    else if (typeof gymratAlert === "function") gymratAlert(message);
    else alert(message);
}

window.openAccountActionsDialog = openAccountActionsDialog;
window.closeAccountActionsDialog = closeAccountActionsDialog;
window.logoutCurrentDevice = logoutCurrentDevice;
window.forgetCurrentDeviceLogin = forgetCurrentDeviceLogin;
window.deleteCurrentAccount = deleteCurrentAccount;
window.changeCurrentUsername = changeCurrentUsername;
window.changeCurrentPassword = changeCurrentPassword;
window.toggleDarkMode = toggleDarkMode;

function registerOfflineShell() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
        navigator.serviceWorker.register(OFFLINE_SW_PATH).catch(() => {
        });
    }, { once: true });
}

async function fetchUserDoc(username) {
    if (!username) return null;
    try {
        if (navigator.onLine && !(await ensureCloudAuthSession(username))) {
            throw new Error("Session unavailable");
        }
        const result = await apiPost('/api/users-fetch', getAuthorizedPayload({ username }));
        const user = result?.user || null;
        if (user) {
            writeCachedUserDoc(username, user);
        }
        return user;
    } catch (error) {
        handleAuthError(error);
        const cached = readCachedUserDoc(username);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

async function saveUserDoc(username, payload) {
    if (!username) return null;
    try {
        if (navigator.onLine && !(await ensureCloudAuthSession(username))) {
            throw new Error("Session unavailable");
        }
        const result = await apiPost('/api/users-save', getAuthorizedPayload({ username, payload }));
        if (result?.user) {
            writeCachedUserDoc(username, result.user);
        } else if (payload?.selections) {
            writeCachedUserDoc(username, { username, selections: payload.selections });
        }
        return result;
    } catch (error) {
        handleAuthError(error);
        throw error;
    }
}

async function getUserSelections(username) {
    if (!username) return getDefaultSelections();
    let selections = null;
    try {
        const userDoc = await fetchUserDoc(username);
        selections = userDoc?.selections || getDefaultSelections();
    } catch (error) {
        const cached = readCachedUserDoc(username);
        selections = cached?.selections || getDefaultSelections();
    }

    const pendingSelections = getPendingSelectionsUpdate(username);
    return pendingSelections
        ? mergeDeep(selections || getDefaultSelections(), pendingSelections)
        : selections || getDefaultSelections();
}

async function saveUserSelections(username, selectionsUpdate) {
    if (!username) return "none";

    mergeSelectionsIntoLocalCache(username, selectionsUpdate);
    queuePendingSelectionsUpdate(username, selectionsUpdate);
    scheduleGlobalDraftSync();

    if (!navigator.onLine) {
        return "local";
    }

    try {
        const userDoc = await fetchUserDoc(username);
        const currentSelections = userDoc?.selections || getDefaultSelections();
        const pendingSelections = getPendingSelectionsUpdate(username) || selectionsUpdate;
        const merged = mergeDeep(currentSelections, pendingSelections);
        const result = await saveUserDoc(username, { selections: merged });
        writeCachedUserDoc(username, result?.user || { username, selections: merged });
        clearPendingSelectionsUpdate(username);
        return "cloud";
    } catch (error) {
        handleAuthError(error);
        return "local";
    }
}

async function saveUserPageData(username, pageKey, pageData) {
    return saveUserSelections(username, { pages: { [pageKey]: pageData } });
}


const LOGIN_DIET_STATS_RETENTION_MONTHS = 14;
const LOGIN_DIET_STATS_WARNING_MONTHS = 12;
const LOGIN_DIET_STATS_KEEP_RECENT_MONTHS = 2;

function loginDietPad(value) {
    return `${value}`.padStart(2, "0");
}

function loginDietInputDateValue(date) {
    return `${date.getFullYear()}-${loginDietPad(date.getMonth() + 1)}-${loginDietPad(date.getDate())}`;
}

function loginDietParseDateKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) return null;
    const [year, month, day] = String(key).split("-").map(Number);
    return new Date(year, month - 1, day);
}

function loginDietAddDays(date, days) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    copy.setDate(copy.getDate() + days);
    return copy;
}

function loginDietAddMonths(date, months) {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function loginDietCompareKeys(left, right) {
    return String(left || "").localeCompare(String(right || ""));
}

function loginDietNormalizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function loginDietTotalsFor(list) {
    return list.reduce((total, item) => ({
        calories: total.calories + loginDietNormalizeNumber(item.calories),
        protein: total.protein + loginDietNormalizeNumber(item.protein),
        carbs: total.carbs + loginDietNormalizeNumber(item.carbs),
        fat: total.fat + loginDietNormalizeNumber(item.fat)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function loginDietGoalHit(value, min, max) {
    const current = loginDietNormalizeNumber(value);
    const low = loginDietNormalizeNumber(min);
    const high = loginDietNormalizeNumber(max || min);
    return current >= low && current <= high;
}

function loginDietFirstStatsDateKey(diet) {
    const keys = [
        ...Object.keys(diet.recordsByDate || {}),
        ...Object.keys(diet.dailyStatsByDate || {})
    ].filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
    return keys[0] || "";
}

function loginDietCompactStatsRow(diet, key) {
    const record = diet.recordsByDate?.[key];
    const recordItems = Array.isArray(record?.items) ? record.items : [];
    if (!recordItems.length) return { d: key, l: 0, cal: null, pro: null, car: null, fat: null, bal: null, kg: null };
    const totals = record?.totals || loginDietTotalsFor(recordItems);
    const tdee = Math.round(loginDietNormalizeNumber(diet.profile?.tdee) || ((loginDietNormalizeNumber(diet.calorieTargetMin || diet.calorieTarget) + loginDietNormalizeNumber(diet.calorieTargetMax || diet.calorieTarget)) / 2) || 2100);
    const balance = Math.round(loginDietNormalizeNumber(totals.calories) - tdee);
    const macroTargets = diet.macroTargets || {};
    return {
        d: key,
        l: 1,
        cal: loginDietGoalHit(totals.calories, diet.calorieTargetMin || diet.calorieTarget, diet.calorieTargetMax || diet.calorieTarget) ? 1 : 0,
        pro: loginDietGoalHit(totals.protein, macroTargets.proteinMin || macroTargets.protein, macroTargets.proteinMax || macroTargets.protein) ? 1 : 0,
        car: loginDietGoalHit(totals.carbs, macroTargets.carbsMin || macroTargets.carbs, macroTargets.carbsMax || macroTargets.carbs) ? 1 : 0,
        fat: loginDietGoalHit(totals.fat, macroTargets.fatMin || macroTargets.fat, macroTargets.fatMax || macroTargets.fat) ? 1 : 0,
        bal: balance,
        kg: Math.round((balance / 7700) * 100000) / 100000,
        tdee,
        at: new Date().toISOString()
    };
}

function archiveAndPruneDietStatsOnLogin(diet) {
    if (!diet || typeof diet !== "object") return { changed: false, hasWarningRows: false };
    diet.recordsByDate = diet.recordsByDate && typeof diet.recordsByDate === "object" ? diet.recordsByDate : {};
    diet.dailyStatsByDate = diet.dailyStatsByDate && typeof diet.dailyStatsByDate === "object" ? diet.dailyStatsByDate : {};
    diet.statsMeta = diet.statsMeta && typeof diet.statsMeta === "object" ? diet.statsMeta : {};
    let changed = false;
    const firstKey = loginDietFirstStatsDateKey(diet);
    const endKey = loginDietInputDateValue(loginDietAddDays(new Date(), -1));
    if (firstKey && loginDietCompareKeys(firstKey, endKey) <= 0) {
        let cursor = loginDietParseDateKey(firstKey);
        const end = loginDietParseDateKey(endKey);
        let guard = 0;
        while (cursor && end && cursor <= end && guard < 500) {
            const key = loginDietInputDateValue(cursor);
            const row = loginDietCompactStatsRow(diet, key);
            if (JSON.stringify(diet.dailyStatsByDate[key] || null) !== JSON.stringify(row)) {
                diet.dailyStatsByDate[key] = row;
                changed = true;
            }
            cursor = loginDietAddDays(cursor, 1);
            guard += 1;
        }
    }
    const retentionTriggerCutoff = loginDietInputDateValue(loginDietAddMonths(new Date(), -LOGIN_DIET_STATS_RETENTION_MONTHS));
    const keepRecentCutoff = loginDietInputDateValue(loginDietAddMonths(new Date(), -LOGIN_DIET_STATS_KEEP_RECENT_MONTHS));
    const hasRowsAtRetentionLimit = [
        ...Object.keys(diet.dailyStatsByDate || {}),
        ...Object.keys(diet.recordsByDate || {})
    ].some(key => /^\d{4}-\d{2}-\d{2}$/.test(key) && loginDietCompareKeys(key, retentionTriggerCutoff) <= 0);
    if (hasRowsAtRetentionLimit) {
        Object.keys(diet.dailyStatsByDate).forEach(key => {
            if (loginDietCompareKeys(key, keepRecentCutoff) <= 0) {
                delete diet.dailyStatsByDate[key];
                changed = true;
            }
        });
        Object.keys(diet.recordsByDate || {}).forEach(key => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(key) && loginDietCompareKeys(key, keepRecentCutoff) <= 0) {
                delete diet.recordsByDate[key];
                changed = true;
            }
        });
    }
    const warningCutoff = loginDietInputDateValue(loginDietAddMonths(new Date(), -LOGIN_DIET_STATS_WARNING_MONTHS));
    const hasWarningRows = !hasRowsAtRetentionLimit && Object.keys(diet.dailyStatsByDate || {}).some(key => loginDietCompareKeys(key, warningCutoff) <= 0 && loginDietCompareKeys(key, retentionTriggerCutoff) > 0);
    return { changed, hasWarningRows };
}

async function checkDietStatsRetentionAfterLogin(username) {
    if (!username) return;
    try {
        const selections = await getUserSelections(username);
        const diet = selections?.diet;
        if (!diet || typeof diet !== "object") return;
        const result = archiveAndPruneDietStatsOnLogin(diet);
        const currentYear = new Date().getFullYear();
        diet.statsMeta = diet.statsMeta && typeof diet.statsMeta === "object" ? diet.statsMeta : {};
        const shouldWarn = result.hasWarningRows && diet.statsMeta.retentionWarningMutedYearReset20260711 !== currentYear;
        if (result.changed) await saveUserSelections(username, { diet });
        if (shouldWarn) {
            const message = "Some diet stats are over 12 months old. Download reports you want now. Once your diet history reaches 14 months, the old year is deleted automatically and the most recent 2 months stay saved.";
            let dialogResult = { confirmed: true, checked: false };
            if (typeof showGymratDialog === "function") {
                dialogResult = await showGymratDialog(message, {
                    title: "Diet stats warning",
                    showCancel: false,
                    checkboxLabel: "Do not show this again for this year",
                    returnCheckboxState: true
                });
            } else if (typeof gymratAlert === "function") {
                await gymratAlert(message);
            } else {
                alert(message);
            }
            if (dialogResult?.checked) {
                diet.statsMeta.retentionWarningMutedYearReset20260711 = currentYear;
                await saveUserSelections(username, { diet });
            }
        }
    } catch (error) {
        console.warn("Diet retention login check failed", error);
    }
}

registerOfflineShell();
window.checkAuth = checkAuth;
const FAVORITES_DRAFT_PREFIX = "gymrat:favorites:draft:";
const FAVORITES_DEVICE_KEY = "gymrat:deviceId";
const FAVORITES_LOCAL_SAVE_DELAY = 500;
const FAVORITES_CLOUD_SAVE_DELAY = 2200;
const favoritesSyncState = {
    favorites: [],
    updatedAt: null,
    lastSyncedAt: null,
    pendingSync: false,
    baseCloudUpdatedAt: null,
    localSaveTimer: null,
    cloudSaveTimer: null,
    syncInFlight: false,
    listenersAttached: false,
    initialized: false,
    initPromise: null,
    statusBanner: null,
    subscribers: new Set()
};

function getFavoritesSyncUser() {
    return localStorage.getItem("currentUser");
}

function getFavoritesDeviceId() {
    let deviceId = localStorage.getItem(FAVORITES_DEVICE_KEY);
    if (!deviceId) {
        deviceId = typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(FAVORITES_DEVICE_KEY, deviceId);
    }
    return deviceId;
}

function cloneFavorites(value) {
    return JSON.parse(JSON.stringify(Array.isArray(value) ? value : []));
}

function normalizeFavoriteItem(item) {
    return {
        id: item?.id || "",
        title: item?.title || "",
        img: item?.img || ""
    };
}

function normalizeFavorites(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    const seen = new Set();
    const normalized = [];

    value.map(normalizeFavoriteItem)
        .filter(item => item.id || item.title || item.img)
        .forEach(item => {
            const key = item.id || `${item.title}::${item.img}`;
            if (seen.has(key)) return;
            seen.add(key);
            normalized.push(item);
        });

    return normalized;
}

function hasMeaningfulFavorites(value) {
    return normalizeFavorites(value).length > 0;
}

function getFavoritesDraftKey(user) {
    return `${FAVORITES_DRAFT_PREFIX}${user}`;
}

function readLocalFavoritesDraft(user) {
    if (!user) return null;

    try {
        const raw = localStorage.getItem(getFavoritesDraftKey(user));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return {
            ...parsed,
            favorites: normalizeFavorites(parsed?.favorites)
        };
    } catch (error) {
        return null;
    }
}

function writeLocalFavoritesDraft(user) {
    if (!user) return;

    const draft = {
        version: 1,
        deviceId: getFavoritesDeviceId(),
        favorites: cloneFavorites(favoritesSyncState.favorites),
        updatedAt: favoritesSyncState.updatedAt,
        lastSyncedAt: favoritesSyncState.lastSyncedAt,
        pendingSync: favoritesSyncState.pendingSync,
        baseCloudUpdatedAt: favoritesSyncState.baseCloudUpdatedAt
    };

    localStorage.setItem(getFavoritesDraftKey(user), JSON.stringify(draft));
}

function writeFavoritesDraftFromCloud(user, selections) {
    if (!user) return;

    const meta = {
        ...getEmptyFavoritesMeta(),
        ...(selections?.favorites_meta || {})
    };

    const draft = {
        version: 1,
        deviceId: getFavoritesDeviceId(),
        favorites: normalizeFavorites(selections?.favorites),
        updatedAt: meta.updatedAt || new Date().toISOString(),
        lastSyncedAt: meta.lastSyncedAt || meta.updatedAt || null,
        pendingSync: false,
        baseCloudUpdatedAt: meta.updatedAt || null
    };

    localStorage.setItem(getFavoritesDraftKey(user), JSON.stringify(draft));

    favoritesSyncState.favorites = cloneFavorites(draft.favorites);
    favoritesSyncState.updatedAt = draft.updatedAt;
    favoritesSyncState.lastSyncedAt = draft.lastSyncedAt;
    favoritesSyncState.pendingSync = false;
    favoritesSyncState.baseCloudUpdatedAt = draft.baseCloudUpdatedAt;
    favoritesSyncState.initialized = true;
    notifyFavoritesSubscribers();
    refreshFavoritesStatus();
}

function getEmptyFavoritesMeta() {
    return {
        updatedAt: null,
        lastSyncedAt: null,
        pendingSync: false,
        deviceId: null,
        baseCloudUpdatedAt: null
    };
}

async function loadCloudFavoritesPayload(user) {
    if (!user) {
        return { favorites: [], meta: getEmptyFavoritesMeta() };
    }

    const selections = await getUserSelections(user);
    return {
        favorites: normalizeFavorites(selections?.favorites),
        meta: {
            ...getEmptyFavoritesMeta(),
            ...(selections?.favorites_meta || {})
        }
    };
}

function pickPreferredFavoritesSource(localDraft, cloudPayload) {
    const localHasContent = localDraft && hasMeaningfulFavorites(localDraft.favorites);
    const cloudHasContent = cloudPayload && hasMeaningfulFavorites(cloudPayload.favorites);
    const localUpdatedAt = localDraft?.updatedAt || null;
    const cloudUpdatedAt = cloudPayload?.meta?.updatedAt || null;

    if (localDraft?.pendingSync) return "local";
    if (localDraft && localUpdatedAt && (!cloudUpdatedAt || localUpdatedAt > cloudUpdatedAt)) {
        return "local";
    }

    if (localHasContent && !cloudHasContent) return "local";
    if (cloudHasContent && !localHasContent) return "cloud";
    if (localHasContent && cloudHasContent) {
        if (cloudUpdatedAt && (!localUpdatedAt || cloudUpdatedAt > localUpdatedAt)) {
            return "cloud";
        }
        if (localUpdatedAt && cloudUpdatedAt && localUpdatedAt === cloudUpdatedAt) {
            return localDraft.pendingSync ? "local" : "cloud";
        }
        return localDraft.pendingSync ? "local" : "cloud";
    }

    return "default";
}

function markFavoritesSyncPage() {
    if (document.body.classList.contains("page-favorites")) {
        return true;
    }

    if (document.querySelector(".exercise-card .check-icon")) {
        document.body.classList.add("page-exercise-favorites");
        return true;
    }

    return false;
}

function ensureFavoritesStatusBanner() {
    if (favoritesSyncState.statusBanner || !markFavoritesSyncPage()) return;

    const styleId = "favorites-status-inline-styles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            body.page-exercise-favorites .tracking-status-banner,
            body.page-favorites .tracking-status-banner {
                display: none;
                margin: 14px 0 18px;
                padding: 12px 16px;
                border-radius: 14px;
                border: 1px solid rgba(250, 204, 21, 0.28);
                background: rgba(250, 204, 21, 0.14);
                color: #f8fafc;
                text-align: left;
                line-height: 1.45;
                box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
            }
            body.page-exercise-favorites .tracking-status-banner.is-visible,
            body.page-favorites .tracking-status-banner.is-visible {
                display: block;
            }
            body.page-exercise-favorites .tracking-status-banner.is-visible + .container {
                margin-top: 0;
            }
            body.page-exercise-favorites .tracking-status-banner[data-state="saved"],
            body.page-favorites .tracking-status-banner[data-state="saved"] {
                display: block;
                background: rgba(34, 197, 94, 0.12);
                border-color: rgba(34, 197, 94, 0.28);
            }
            body.page-exercise-favorites .tracking-status-banner[data-state="syncing"],
            body.page-favorites .tracking-status-banner[data-state="syncing"] {
                display: block;
                background: rgba(96, 165, 250, 0.14);
                border-color: rgba(96, 165, 250, 0.3);
            }
            body.page-exercise-favorites .tracking-status-banner[data-state="local"],
            body.page-favorites .tracking-status-banner[data-state="local"] {
                display: block;
                background: rgba(250, 204, 21, 0.14);
                border-color: rgba(250, 204, 21, 0.28);
            }
            body.page-exercise-favorites .tracking-status-banner[data-state="offline"],
            body.page-favorites .tracking-status-banner[data-state="offline"] {
                display: block;
                background: rgba(245, 158, 11, 0.16);
                border-color: rgba(245, 158, 11, 0.34);
            }
            @media (max-width: 640px) {
                body.page-exercise-favorites .tracking-status-banner,
                body.page-favorites .tracking-status-banner {
                    padding: 11px 13px;
                    font-size: 0.95rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const anchor = document.body.classList.contains("page-favorites")
        ? document.querySelector(".hero-copy")
        : document.querySelector(".container");
    if (!anchor) return;

    const banner = document.createElement("div");
    banner.className = "tracking-status-banner";
    banner.setAttribute("aria-live", "polite");

    if (document.body.classList.contains("page-favorites")) {
        anchor.insertAdjacentElement("afterend", banner);
    } else {
        anchor.insertAdjacentElement("beforebegin", banner);
    }

    favoritesSyncState.statusBanner = banner;
}

function updateFavoritesStatus(state, text) {
    ensureFavoritesStatusBanner();
    if (!favoritesSyncState.statusBanner) return;

    if (!text) {
        favoritesSyncState.statusBanner.textContent = "";
        favoritesSyncState.statusBanner.classList.remove("is-visible");
        favoritesSyncState.statusBanner.removeAttribute("data-state");
        return;
    }

    favoritesSyncState.statusBanner.textContent = text;
    favoritesSyncState.statusBanner.dataset.state = state;
    favoritesSyncState.statusBanner.classList.add("is-visible");
}

function refreshFavoritesStatus() {
    if (!markFavoritesSyncPage()) return;

    if (!navigator.onLine) {
        updateFavoritesStatus("local", "Saved locally. Changes will sync to your account when internet returns.");
        return;
    }

    if (favoritesSyncState.syncInFlight) {
        updateFavoritesStatus("syncing", "Syncing to your account...");
        return;
    }

    if (favoritesSyncState.pendingSync) {
        updateFavoritesStatus("local", "Saved locally. Changes will sync to your account soon.");
        return;
    }

    if (favoritesSyncState.lastSyncedAt) {
        updateFavoritesStatus("saved", "Synced to your account.");
        return;
    }

    updateFavoritesStatus(null, "");
}

function notifyFavoritesSubscribers() {
    const snapshot = cloneFavorites(favoritesSyncState.favorites);
    favoritesSyncState.subscribers.forEach(listener => {
        try {
            listener(snapshot);
        } catch (error) {
        }
    });
}

function subscribeFavoritesSync(listener) {
    if (typeof listener !== "function") {
        return () => {};
    }

    favoritesSyncState.subscribers.add(listener);
    listener(cloneFavorites(favoritesSyncState.favorites));

    return () => {
        favoritesSyncState.subscribers.delete(listener);
    };
}

function clearFavoritesCloudTimer() {
    clearTimeout(favoritesSyncState.cloudSaveTimer);
    favoritesSyncState.cloudSaveTimer = null;
}

function scheduleLocalFavoritesSave() {
    const user = getFavoritesSyncUser();
    if (!user) return;

    clearTimeout(favoritesSyncState.localSaveTimer);
    favoritesSyncState.localSaveTimer = setTimeout(() => {
        writeLocalFavoritesDraft(user);
        refreshFavoritesStatus();
    }, FAVORITES_LOCAL_SAVE_DELAY);
}

function scheduleCloudFavoritesSync() {
    clearFavoritesCloudTimer();

    if (!favoritesSyncState.pendingSync) {
        refreshFavoritesStatus();
        return;
    }

    if (!navigator.onLine) {
        refreshFavoritesStatus();
        return;
    }

    favoritesSyncState.cloudSaveTimer = setTimeout(() => {
        void flushFavoritesCloudSync();
    }, FAVORITES_CLOUD_SAVE_DELAY);
    refreshFavoritesStatus();
}

function persistFavoritesChange() {
    favoritesSyncState.updatedAt = new Date().toISOString();
    favoritesSyncState.pendingSync = true;
    writeLocalFavoritesDraft(getFavoritesSyncUser());
    scheduleLocalFavoritesSave();
    scheduleCloudFavoritesSync();
}

function attachFavoritesSyncListeners() {
    if (favoritesSyncState.listenersAttached) return;
    favoritesSyncState.listenersAttached = true;

    window.addEventListener("online", () => {
        refreshFavoritesStatus();
        if (favoritesSyncState.pendingSync) {
            void flushFavoritesCloudSync();
        }
    });

    window.addEventListener("offline", () => {
        refreshFavoritesStatus();
    });

    window.addEventListener("focus", () => {
        if (favoritesSyncState.pendingSync && navigator.onLine) {
            void flushFavoritesCloudSync();
        } else {
            refreshFavoritesStatus();
        }
    });

    const persistBeforeLeave = () => {
        writeLocalFavoritesDraft(getFavoritesSyncUser());
    };

    window.addEventListener("beforeunload", persistBeforeLeave);
    window.addEventListener("pagehide", persistBeforeLeave);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            persistBeforeLeave();
        }
    });
}

async function flushFavoritesCloudSync(force = false) {
    const user = getFavoritesSyncUser();
    if (!user) return false;
    if ((!favoritesSyncState.pendingSync && !force) || favoritesSyncState.syncInFlight) {
        refreshFavoritesStatus();
        return false;
    }
    if (!navigator.onLine) {
        refreshFavoritesStatus();
        return false;
    }

    clearFavoritesCloudTimer();
    favoritesSyncState.syncInFlight = true;
    refreshFavoritesStatus();

    try {
        const meta = {
            updatedAt: favoritesSyncState.updatedAt || new Date().toISOString(),
            lastSyncedAt: new Date().toISOString(),
            pendingSync: false,
            deviceId: getFavoritesDeviceId(),
            baseCloudUpdatedAt: favoritesSyncState.updatedAt || favoritesSyncState.baseCloudUpdatedAt || null
        };

        const userDoc = await fetchUserDoc(user);
        const currentSelections = userDoc?.selections || getDefaultSelections();
        const mergedSelections = mergeDeep(currentSelections, {
            favorites: cloneFavorites(favoritesSyncState.favorites),
            favorites_meta: meta
        });

        await saveUserDoc(user, { selections: mergedSelections });

        favoritesSyncState.lastSyncedAt = meta.lastSyncedAt;
        favoritesSyncState.baseCloudUpdatedAt = meta.updatedAt;
        favoritesSyncState.pendingSync = false;
        clearPendingSelectionsFields(user, ["favorites", "favorites_meta"]);
        writeLocalFavoritesDraft(user);
        refreshFavoritesStatus();
        return true;
    } catch (error) {
        handleAuthError(error);
        favoritesSyncState.pendingSync = true;
        writeLocalFavoritesDraft(user);
        refreshFavoritesStatus();
        return false;
    } finally {
        favoritesSyncState.syncInFlight = false;
        refreshFavoritesStatus();
    }
}

async function initializeFavoritesSync(forceReload = false) {
    if (favoritesSyncState.initialized && !forceReload) {
        ensureFavoritesStatusBanner();
        refreshFavoritesStatus();
        return cloneFavorites(favoritesSyncState.favorites);
    }

    if (favoritesSyncState.initPromise && !forceReload) {
        return favoritesSyncState.initPromise;
    }

    favoritesSyncState.initPromise = (async () => {
        markFavoritesSyncPage();
        ensureFavoritesStatusBanner();
        attachFavoritesSyncListeners();

        const user = getFavoritesSyncUser();
        const localDraft = readLocalFavoritesDraft(user);
        let cloudPayload = { favorites: [], meta: getEmptyFavoritesMeta() };

        if (user && navigator.onLine) {
            try {
                cloudPayload = await loadCloudFavoritesPayload(user);
            } catch (error) {
            }
        }

        const source = pickPreferredFavoritesSource(localDraft, cloudPayload);

        if (source === "local" && localDraft) {
            favoritesSyncState.favorites = normalizeFavorites(localDraft.favorites);
            favoritesSyncState.updatedAt = localDraft.updatedAt || new Date().toISOString();
            favoritesSyncState.lastSyncedAt = localDraft.lastSyncedAt || null;
            favoritesSyncState.pendingSync = !!localDraft.pendingSync;
            favoritesSyncState.baseCloudUpdatedAt = localDraft.baseCloudUpdatedAt || cloudPayload.meta.updatedAt || null;
        } else if (source === "cloud") {
            favoritesSyncState.favorites = normalizeFavorites(cloudPayload.favorites);
            favoritesSyncState.updatedAt = cloudPayload.meta.updatedAt || new Date().toISOString();
            favoritesSyncState.lastSyncedAt = cloudPayload.meta.lastSyncedAt || cloudPayload.meta.updatedAt || null;
            favoritesSyncState.pendingSync = false;
            favoritesSyncState.baseCloudUpdatedAt = cloudPayload.meta.updatedAt || null;
        } else {
            favoritesSyncState.favorites = [];
            favoritesSyncState.updatedAt = new Date().toISOString();
            favoritesSyncState.lastSyncedAt = null;
            favoritesSyncState.pendingSync = false;
            favoritesSyncState.baseCloudUpdatedAt = cloudPayload.meta.updatedAt || null;
        }

        writeLocalFavoritesDraft(user);
        favoritesSyncState.initialized = true;
        notifyFavoritesSubscribers();
        refreshFavoritesStatus();

        if (favoritesSyncState.pendingSync && navigator.onLine) {
            scheduleCloudFavoritesSync();
        }

        return cloneFavorites(favoritesSyncState.favorites);
    })();

    try {
        return await favoritesSyncState.initPromise;
    } finally {
        favoritesSyncState.initPromise = null;
    }
}

async function getSyncedFavorites(forceReload = false) {
    await initializeFavoritesSync(forceReload);
    return cloneFavorites(favoritesSyncState.favorites);
}

function isFavoriteSelected(favoriteId) {
    return favoritesSyncState.favorites.some(item => item.id === favoriteId);
}
function syncFavoritesSelectionCache(user) {
    if (!user) return;

    const normalizedFavorites = normalizeFavorites(favoritesSyncState.favorites);
    favoritesSyncState.favorites = normalizedFavorites;
    mergeSelectionsIntoLocalCache(user, { favorites: normalizedFavorites });
    queuePendingSelectionsUpdate(user, { favorites: normalizedFavorites });
}

async function toggleFavoriteSelection(item) {
    const user = getFavoritesSyncUser();
    if (!user) {
        throw new Error("No user logged in");
    }

    await initializeFavoritesSync();

    const favorite = normalizeFavoriteItem(item);
    const index = favoritesSyncState.favorites.findIndex(entry => entry.id === favorite.id);

    if (index !== -1) {
        favoritesSyncState.favorites.splice(index, 1);
    } else {
        favoritesSyncState.favorites.push(favorite);
    }

    syncFavoritesSelectionCache(user);
    persistFavoritesChange();
    notifyFavoritesSubscribers();

    if (navigator.onLine) {
        await flushFavoritesCloudSync(true);
    }

    return {
        isFavorite: index === -1,
        favorites: cloneFavorites(favoritesSyncState.favorites)
    };
}

async function setFavoriteSelection(item, selected) {
    const user = getFavoritesSyncUser();
    if (!user) {
        throw new Error("No user logged in");
    }

    await initializeFavoritesSync();

    const favorite = normalizeFavoriteItem(item);
    const index = favoritesSyncState.favorites.findIndex(entry => entry.id === favorite.id);
    const shouldSelect = !!selected;
    const alreadySelected = index !== -1;

    if (shouldSelect && !alreadySelected) {
        favoritesSyncState.favorites.push(favorite);
    } else if (!shouldSelect && alreadySelected) {
        favoritesSyncState.favorites.splice(index, 1);
    } else {
        return {
            isFavorite: shouldSelect,
            favorites: cloneFavorites(favoritesSyncState.favorites)
        };
    }

    syncFavoritesSelectionCache(user);
    persistFavoritesChange();
    notifyFavoritesSubscribers();

    if (navigator.onLine) {
        await flushFavoritesCloudSync(true);
    }

    return {
        isFavorite: shouldSelect,
        favorites: cloneFavorites(favoritesSyncState.favorites)
    };
}

async function removeFavoriteSelection(favoriteId) {
    const user = getFavoritesSyncUser();
    if (!user) {
        throw new Error("No user logged in");
    }

    await initializeFavoritesSync();

    const id = typeof favoriteId === "object" ? normalizeFavoriteItem(favoriteId).id : favoriteId;
    favoritesSyncState.favorites = favoritesSyncState.favorites.filter(item => item.id !== id);
    syncFavoritesSelectionCache(user);
    persistFavoritesChange();
    notifyFavoritesSubscribers();

    if (navigator.onLine) {
        await flushFavoritesCloudSync(true);
    }

    return cloneFavorites(favoritesSyncState.favorites);
}

window.initializeFavoritesSync = initializeFavoritesSync;
window.getSyncedFavorites = getSyncedFavorites;
window.subscribeFavoritesSync = subscribeFavoritesSync;
window.toggleFavoriteSelection = toggleFavoriteSelection;
window.setFavoriteSelection = setFavoriteSelection;
window.removeFavoriteSelection = removeFavoriteSelection;
window.flushFavoritesCloudSync = flushFavoritesCloudSync;
window.isFavoriteSelected = isFavoriteSelected;

const GLOBAL_TRACKING_DRAFT_PREFIX = "gymrat:weights:draft:";
const globalDraftSyncState = {
    running: false,
    promise: null,
    bootstrapAttached: false
};

function syncTrackingDefaultData() {
    return [{ exercise: "", sets: [{ weight: "", reps: "" }] }];
}

function syncCloneTrackingData(value) {
    return JSON.parse(JSON.stringify(Array.isArray(value) ? value : syncTrackingDefaultData()));
}

function syncNormalizeTrackingData(value) {
    if (!Array.isArray(value) || value.length === 0) {
        return syncTrackingDefaultData();
    }

    return value.map(item => ({
        exercise: item?.exercise || "",
        sets: Array.isArray(item?.sets) && item.sets.length
            ? item.sets.map(set => ({
                weight: set?.weight ?? "",
                reps: set?.reps ?? ""
            }))
            : [{ weight: "", reps: "" }]
    }));
}

function getEmptyGlobalTrackingMeta() {
    return {
        updatedAt: null,
        lastSyncedAt: null,
        pendingSync: false,
        deviceId: null,
        baseCloudUpdatedAt: null
    };
}

function listLocalTrackingDrafts(user) {
    if (!user) return [];

    const prefix = `${GLOBAL_TRACKING_DRAFT_PREFIX}${user}:`;
    const drafts = [];

    for (let index = 0; index < localStorage.length; index += 1) {
        const storageKey = localStorage.key(index);
        if (!storageKey || !storageKey.startsWith(prefix)) continue;

        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.data)) continue;

            drafts.push({
                ...parsed,
                pageKey: parsed.pageKey || storageKey.slice(prefix.length),
                storageKey,
                data: syncNormalizeTrackingData(parsed.data)
            });
        } catch (error) {
        }
    }

    return drafts;
}

function writeTrackingDraftSnapshot(user, draft) {
    if (!user || !draft?.pageKey) return;

    const storageKey = `${GLOBAL_TRACKING_DRAFT_PREFIX}${user}:${draft.pageKey}`;
    const snapshot = {
        version: draft.version || 1,
        pageKey: draft.pageKey,
        deviceId: draft.deviceId || getFavoritesDeviceId(),
        data: syncCloneTrackingData(draft.data),
        updatedAt: draft.updatedAt || null,
        lastSyncedAt: draft.lastSyncedAt || null,
        pendingSync: !!draft.pendingSync,
        baseCloudUpdatedAt: draft.baseCloudUpdatedAt || null
    };

    localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function shouldPromoteLocalDraft(localDraft, cloudUpdatedAt) {
    if (!localDraft?.pendingSync) return false;

    const localUpdatedAt = localDraft.updatedAt || null;
    if (!cloudUpdatedAt) return true;
    if (!localUpdatedAt) return true;
    return localUpdatedAt > cloudUpdatedAt;
}

async function syncPendingLocalDataToCloud() {
    const user = getFavoritesSyncUser();
    if (!user || !navigator.onLine) return false;
    if (globalDraftSyncState.running) {
        return globalDraftSyncState.promise || false;
    }

    globalDraftSyncState.running = true;
    globalDraftSyncState.promise = (async () => {
        try {
            const userDoc = await fetchUserDoc(user);
            const currentSelections = userDoc?.selections || getDefaultSelections();
            const nextSelections = mergeDeep(getDefaultSelections(), currentSelections);
            let changed = false;
            const syncTimestamp = new Date().toISOString();
            const pendingSelections = getPendingSelectionsUpdate(user);

            if (pendingSelections) {
                Object.assign(nextSelections, mergeDeep(nextSelections, pendingSelections));
                changed = true;
            }

            const localFavoritesDraft = readLocalFavoritesDraft(user);
            const cloudFavoritesMeta = {
                ...getEmptyFavoritesMeta(),
                ...(currentSelections.favorites_meta || {})
            };

            if (shouldPromoteLocalDraft(localFavoritesDraft, cloudFavoritesMeta.updatedAt)) {
                const favoritesMeta = {
                    updatedAt: localFavoritesDraft.updatedAt || syncTimestamp,
                    lastSyncedAt: syncTimestamp,
                    pendingSync: false,
                    deviceId: localFavoritesDraft.deviceId || getFavoritesDeviceId(),
                    baseCloudUpdatedAt: localFavoritesDraft.updatedAt || cloudFavoritesMeta.updatedAt || null
                };

                nextSelections.favorites = normalizeFavorites(localFavoritesDraft.favorites);
                nextSelections.favorites_meta = favoritesMeta;
                changed = true;
            }

            const localTrackingDrafts = listLocalTrackingDrafts(user);
            localTrackingDrafts.forEach(draft => {
                const cloudTrackingMeta = {
                    ...getEmptyGlobalTrackingMeta(),
                    ...(currentSelections.pages_meta?.[draft.pageKey] || {})
                };

                if (!shouldPromoteLocalDraft(draft, cloudTrackingMeta.updatedAt)) {
                    return;
                }

                const trackingMeta = {
                    updatedAt: draft.updatedAt || syncTimestamp,
                    lastSyncedAt: syncTimestamp,
                    pendingSync: false,
                    deviceId: draft.deviceId || getFavoritesDeviceId(),
                    baseCloudUpdatedAt: draft.updatedAt || cloudTrackingMeta.updatedAt || null
                };

                nextSelections.pages = {
                    ...(nextSelections.pages || {}),
                    [draft.pageKey]: syncCloneTrackingData(draft.data)
                };
                nextSelections.pages_meta = {
                    ...(nextSelections.pages_meta || {}),
                    [draft.pageKey]: trackingMeta
                };
                changed = true;
            });

            if (!changed) {
                return false;
            }

            const result = await saveUserDoc(user, { selections: nextSelections });
            writeCachedUserDoc(user, result?.user || { username: user, selections: nextSelections });
            clearPendingSelectionsUpdate(user);

            if (localFavoritesDraft && shouldPromoteLocalDraft(localFavoritesDraft, cloudFavoritesMeta.updatedAt)) {
                const syncedFavoritesDraft = {
                    ...localFavoritesDraft,
                    favorites: normalizeFavorites(localFavoritesDraft.favorites),
                    lastSyncedAt: syncTimestamp,
                    pendingSync: false,
                    baseCloudUpdatedAt: localFavoritesDraft.updatedAt || cloudFavoritesMeta.updatedAt || null
                };
                localStorage.setItem(getFavoritesDraftKey(user), JSON.stringify(syncedFavoritesDraft));

                if (favoritesSyncState.initialized) {
                    favoritesSyncState.favorites = normalizeFavorites(syncedFavoritesDraft.favorites);
                    favoritesSyncState.updatedAt = syncedFavoritesDraft.updatedAt || favoritesSyncState.updatedAt;
                    favoritesSyncState.lastSyncedAt = syncedFavoritesDraft.lastSyncedAt;
                    favoritesSyncState.pendingSync = false;
                    favoritesSyncState.baseCloudUpdatedAt = syncedFavoritesDraft.baseCloudUpdatedAt;
                    notifyFavoritesSubscribers();
                    refreshFavoritesStatus();
                }
            }

            localTrackingDrafts.forEach(draft => {
                const cloudTrackingMeta = {
                    ...getEmptyGlobalTrackingMeta(),
                    ...(currentSelections.pages_meta?.[draft.pageKey] || {})
                };

                if (!shouldPromoteLocalDraft(draft, cloudTrackingMeta.updatedAt)) {
                    return;
                }

                writeTrackingDraftSnapshot(user, {
                    ...draft,
                    data: syncNormalizeTrackingData(draft.data),
                    lastSyncedAt: syncTimestamp,
                    pendingSync: false,
                    baseCloudUpdatedAt: draft.updatedAt || cloudTrackingMeta.updatedAt || null
                });
            });

            window.dispatchEvent(new CustomEvent("gymrat:cloud-sync-complete"));
            return true;
        } catch (error) {
            handleAuthError(error);
            return false;
        } finally {
            globalDraftSyncState.running = false;
            globalDraftSyncState.promise = null;
        }
    })();

    return globalDraftSyncState.promise;
}

function scheduleGlobalDraftSync() {
    if (!getFavoritesSyncUser() || !navigator.onLine) return;
    setTimeout(() => {
        void syncPendingLocalDataToCloud();
    }, 0);
}

function runGlobalDraftSyncNow() {
    if (!getFavoritesSyncUser() || !navigator.onLine) return;
    void syncPendingLocalDataToCloud();
}

function bootstrapGlobalDraftSync() {
    if (globalDraftSyncState.bootstrapAttached) return;
    globalDraftSyncState.bootstrapAttached = true;

    window.addEventListener("online", () => {
        runGlobalDraftSyncNow();
    });

    window.addEventListener("focus", () => {
        runGlobalDraftSyncNow();
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            runGlobalDraftSyncNow();
        }
    });

    runGlobalDraftSyncNow();
}

window.syncPendingLocalDataToCloud = syncPendingLocalDataToCloud;
async function loadUserPageData(username, pageKey) {
    if (!username) return null;
    const selections = await getUserSelections(username);
    return selections.pages?.[pageKey] || null;
}

async function syncAccountStateFromCloud(username) {
    if (!username || !navigator.onLine) return false;

    const userDoc = await fetchUserDoc(username);
    const cloudSelections = mergeDeep(getDefaultSelections(), userDoc?.selections || {});
    const pendingSelections = getPendingSelectionsUpdate(username);
    const selections = pendingSelections
        ? mergeDeep(cloudSelections, pendingSelections)
        : cloudSelections;

    writeCachedUserDoc(username, { ...(userDoc || { username }), username, selections });

    const localFavoritesDraft = readLocalFavoritesDraft(username);
    if (!localFavoritesDraft?.pendingSync) {
        writeFavoritesDraftFromCloud(username, selections);
    }

    return true;
}

window.syncAccountStateFromCloud = syncAccountStateFromCloud;


const googleRegisterState = {
    clientId: "",
    credential: "",
    email: "",
    name: "",
    picture: ""
};

function decodeJwtPayload(token) {
    try {
        const part = `${token || ""}`.split(".")[1];
        if (!part) return null;
        const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        return JSON.parse(decodeURIComponent(Array.from(atob(padded)).map(char => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
    } catch (error) {
        return null;
    }
}

function translateAuthText(text) {
    return typeof window.gymratTranslateText === "function" ? window.gymratTranslateText(text) : (text || "");
}

function setTranslatedTextById(id, text) {
    const element = document.getElementById(id);
    if (element) element.innerText = translateAuthText(text);
}

function setGoogleRegisterMessage(text) {
    const help = document.getElementById("googleRegisterHelp");
    if (help) help.textContent = translateAuthText(text || "");
}

let googleAuthIntent = "login";

function setGoogleAuthIntent(intent) {
    googleAuthIntent = intent === "register" ? "register" : "login";
}

function handleGoogleCredential(credential) {
    if (googleAuthIntent === "register") {
        setGoogleRegisterSelection(credential);
        return;
    }
    void handleGoogleLoginCredential(credential);
}

async function getGoogleClientIdForAuth(setMessage) {
    if (googleRegisterState.clientId) return googleRegisterState.clientId;
    const config = await fetch("/api/google-config").then(response => response.json());
    googleRegisterState.clientId = config?.clientId || "";
    if (!googleRegisterState.clientId) {
        setMessage("Google sign in is not configured yet. Add GOOGLE_CLIENT_ID in Vercel first.");
        return "";
    }
    return googleRegisterState.clientId;
}

async function loadGoogleUserFromAccessToken(accessToken) {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error("Google account details could not be loaded.");
    return response.json();
}

async function setGoogleRegisterAccessSelection(accessToken) {
    if (!accessToken) {
        setGoogleRegisterMessage("Google registration failed. Try again.");
        return;
    }
    try {
        const payload = await loadGoogleUserFromAccessToken(accessToken);
        googleRegisterState.credential = "";
        googleRegisterState.accessToken = accessToken;
        googleRegisterState.email = payload.email || "";
        googleRegisterState.name = payload.name || "";
        googleRegisterState.picture = payload.picture || "";

        const selected = document.getElementById("googleRegisterSelected");
        const email = document.getElementById("googleRegisterEmail");
        const picture = document.getElementById("googleRegisterPicture");
        if (selected) selected.hidden = false;
        if (email) email.textContent = googleRegisterState.email;
        if (picture) {
            picture.src = googleRegisterState.picture || "Pictures/Logos/Icon.webp";
            picture.hidden = false;
        }
        setGoogleRegisterMessage("Google account selected. Choose a username, accept the terms, and create your account.");
    } catch (error) {
        setGoogleRegisterMessage(error.message || "Google registration failed. Try again.");
    }
}

async function requestGoogleAccount(intent) {
    const isRegister = intent === "register";
    const setMessage = isRegister ? setGoogleRegisterMessage : setGoogleLoginMessage;
    setGoogleAuthIntent(intent);
    if (!navigator.onLine) {
        setMessage("Google sign in needs internet connection.");
        return;
    }
    if (!window.google?.accounts?.oauth2) {
        setMessage("Google sign in is still loading. Try again in a moment.");
        return;
    }
    try {
        const clientId = await getGoogleClientIdForAuth(setMessage);
        if (!clientId) return;
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "openid email profile",
            prompt: "select_account",
            callback: response => {
                if (response?.error) {
                    setMessage("Google sign in was cancelled or failed.");
                    return;
                }
                if (isRegister) {
                    void setGoogleRegisterAccessSelection(response?.access_token || "");
                    return;
                }
                void handleGoogleLoginAccessToken(response?.access_token || "");
            }
        });
        tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch (error) {
        setMessage("Google sign in setup failed: " + error.message);
    }
}

function setGoogleRegisterSelection(credential) {
    const payload = decodeJwtPayload(credential);
    if (!payload?.email) {
        setGoogleRegisterMessage("Google registration failed. Try again.");
        return;
    }
    googleRegisterState.credential = credential;
    googleRegisterState.email = payload.email || "";
    googleRegisterState.name = payload.name || "";
    googleRegisterState.picture = payload.picture || "";
    googleRegisterState.accessToken = "";

    const selected = document.getElementById("googleRegisterSelected");
    const email = document.getElementById("googleRegisterEmail");
    const picture = document.getElementById("googleRegisterPicture");
    if (selected) selected.hidden = false;
    if (email) email.textContent = googleRegisterState.email;
    if (picture) {
        picture.src = googleRegisterState.picture || "Pictures/Logos/Icon.webp";
        picture.hidden = false;
    }
    setGoogleRegisterMessage("Google account selected. Choose a username, accept the terms, and create your account.");
}

function clearGoogleRegisterSelection() {
    googleRegisterState.credential = "";
    googleRegisterState.email = "";
    googleRegisterState.name = "";
    googleRegisterState.picture = "";
    googleRegisterState.accessToken = "";
    const selected = document.getElementById("googleRegisterSelected");
    if (selected) selected.hidden = true;
    setGoogleRegisterMessage("Choose your Google account first, then choose your username.");
    initializeGoogleRegisterButton(true);
}

async function initializeGoogleRegisterButton(forcePrompt = false) {
    const target = document.getElementById("googleRegisterButton");
    if (!target) return;
    if (!target.dataset.googleClickBound) {
        target.dataset.googleClickBound = "true";
        target.addEventListener("click", () => requestGoogleAccount("register"));
    }
    if (forcePrompt) void requestGoogleAccount("register");
}
function setGoogleLoginMessage(text) {
    const help = document.getElementById("googleLoginHelp");
    if (help) help.textContent = translateAuthText(text || "");
}



const GOOGLE_PENDING_LOGIN_KEY = "gymrat:pending-google-login";

function savePendingGoogleAccounts(data = {}) {
    sessionStorage.setItem(GOOGLE_PENDING_LOGIN_KEY, JSON.stringify({
        googleAccessToken: data.googleAccessToken || "",
        googleCredential: data.googleCredential || "",
        googleEmail: data.googleEmail || "",
        accounts: Array.isArray(data.accounts) ? data.accounts : []
    }));
}

function readPendingGoogleAccounts() {
    try {
        const raw = sessionStorage.getItem(GOOGLE_PENDING_LOGIN_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function clearPendingGoogleAccounts() {
    sessionStorage.removeItem(GOOGLE_PENDING_LOGIN_KEY);
}

async function completeSelectedGoogleAccount(accountKey) {
    const pending = readPendingGoogleAccounts();
    const currentSession = getStoredAuthSession();
    const status = document.getElementById("accountSelectStatus");
    if (status) status.textContent = "Opening account...";
    try {
        let result;
        if (pending?.googleAccessToken || pending?.googleCredential) {
            result = await apiPost('/api/users-login', {
                googleAccessToken: pending.googleAccessToken,
                googleCredential: pending.googleCredential,
                selectedAccountKey: accountKey,
                deviceId: getFavoritesDeviceId()
            });
            clearPendingGoogleAccounts();
        } else if (currentSession?.accountKey && currentSession?.token) {
            result = await apiPost('/api/users-switch-account', {
                accountKey: currentSession.accountKey,
                authToken: currentSession.token,
                selectedAccountKey: accountKey,
                deviceId: getFavoritesDeviceId()
            });
        } else {
            throw new Error("Sign in with Google first.");
        }
        if (!result?.ok || !result?.token) throw new Error("Account could not be opened.");
        setStoredAuthSession({ username: result.username, accountKey: result.accountKey, googleEmail: result.googleEmail, needsLegacyMigration: result.needsLegacyMigration, token: result.token, deviceId: result.deviceId });
        await syncAccountStateFromCloud(result.username);
        await checkDietStatsRetentionAfterLogin(result.username);
        await promptLegacyGoogleMigration();
        window.location.href = "MainPage.html";
    } catch (error) {
        if (status) status.textContent = translateAuthText(error.message || "Could not open account.");
    }
}

function applyAccountSelectLanguage() {
    if (typeof window.gymratApplyLanguage === "function") {
        window.gymratApplyLanguage();
    }
}

function renderAccountSelect(accounts, googleEmail = "") {
    const list = document.getElementById("accountSelectList");
    const subtitle = document.getElementById("accountSelectSubtitle");
    if (!list) return;
    if (subtitle && googleEmail) subtitle.textContent = `Choose one profile connected to ${googleEmail}.`;
    list.innerHTML = "";
    if (!accounts.length) {
        const message = document.createElement("p");
        message.className = "auth-message";
        message.textContent = "No GYMRAT profiles are connected to this Google account yet. Register first.";
        list.appendChild(message);
        applyAccountSelectLanguage();
        return;
    }
    accounts.forEach(account => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "account-select-item";

        const image = document.createElement("img");
        image.src = account.picture || "Pictures/Logos/Icon.webp";
        image.alt = "";
        image.setAttribute("aria-hidden", "true");

        const textWrap = document.createElement("span");
        textWrap.setAttribute("data-no-i18n", "");

        const displayName = document.createElement("strong");
        displayName.textContent = account.displayName || account.username || "";

        const username = document.createElement("small");
        username.textContent = account.username || "";

        textWrap.append(displayName, username);
        button.append(image, textWrap);
        button.addEventListener("click", () => completeSelectedGoogleAccount(account.accountKey));
        list.appendChild(button);
    });
    applyAccountSelectLanguage();
}

async function initializeAccountSelectPage() {
    if (!document.body.classList.contains("page-account-select")) return;
    const pending = readPendingGoogleAccounts();
    if (pending?.accounts) {
        renderAccountSelect(pending.accounts, pending.googleEmail);
        return;
    }
    const session = getStoredAuthSession();
    const status = document.getElementById("accountSelectStatus");
    if (!session?.accountKey || !session?.token) {
        if (status) status.textContent = "Sign in with Google first.";
        return;
    }
    try {
        const result = await apiPost('/api/users-accounts', { accountKey: session.accountKey, authToken: session.token });
        renderAccountSelect(result.accounts || [], result.googleEmail || session.googleEmail || "");
    } catch (error) {
        if (status) status.textContent = translateAuthText(error.message || "Could not load accounts.");
    }
}

function openAccountChooser() {
    window.location.href = "AccountSelect.html";
}
async function promptLegacyGoogleMigration() {
    return false;
}

async function openLoggedInAccount(result, failureMessage = "Google sign in failed. Try again.") {
    if (!result?.ok || !result?.token || !result?.username) {
        throw new Error(failureMessage);
    }
    setStoredAuthSession({
        username: result.username,
        accountKey: result.accountKey,
        googleEmail: result.googleEmail,
        needsLegacyMigration: result.needsLegacyMigration,
        token: result.token,
        deviceId: result.deviceId
    });
    await syncAccountStateFromCloud(result.username);
    await checkDietStatsRetentionAfterLogin(result.username);
    await promptLegacyGoogleMigration();
    window.location.href = "MainPage.html";
}

async function handleGoogleLoginCredential(credential) {
    if (!credential) {
        setGoogleLoginMessage("Choose a Google account to sign in.");
        return;
    }
    try {
        setGoogleLoginMessage("Signing in with Google...");
        const result = await apiPost('/api/users-login', { googleCredential: credential, deviceId: getFavoritesDeviceId() });
        if (result?.requiresAccountSelection) {
            savePendingGoogleAccounts({ googleCredential: credential, googleEmail: result.googleEmail, accounts: result.accounts });
            window.location.href = "AccountSelect.html";
            return;
        }
        await openLoggedInAccount(result);
    } catch (error) {
        setGoogleLoginMessage(error.message || "Google sign in failed.");
    }
}

async function handleGoogleLoginAccessToken(accessToken) {
    if (!accessToken) {
        setGoogleLoginMessage("Choose a Google account to sign in.");
        return;
    }
    try {
        setGoogleLoginMessage("Signing in with Google...");
        const result = await apiPost('/api/users-login', { googleAccessToken: accessToken, deviceId: getFavoritesDeviceId() });
        if (result?.requiresAccountSelection) {
            savePendingGoogleAccounts({ googleAccessToken: accessToken, googleEmail: result.googleEmail, accounts: result.accounts });
            window.location.href = "AccountSelect.html";
            return;
        }
        await openLoggedInAccount(result);
    } catch (error) {
        setGoogleLoginMessage(error.message || "Google sign in failed.");
    }
}

async function initializeGoogleLoginButton(forcePrompt = false) {
    const target = document.getElementById("googleLoginButton");
    if (!target) return;
    if (!target.dataset.googleClickBound) {
        target.dataset.googleClickBound = "true";
        target.addEventListener("click", () => requestGoogleAccount("login"));
    }
    if (forcePrompt) void requestGoogleAccount("login");
}

async function register() {
    const username = document.getElementById("registerUsername").value;
    const termsAccepted = document.getElementById("registerTerms")?.checked ?? true;

    setTranslatedTextById("registerMsg", "Registering...");
    setTermsValidationState(false);

    if (!username) {
        setTranslatedTextById("registerMsg", "Choose a username");
        return;
    }


    if (!googleRegisterState.credential && !googleRegisterState.accessToken) {
        setTranslatedTextById("registerMsg", "Choose your Google account first.");
        initializeGoogleRegisterButton(true);
        return;
    }
    if (!termsAccepted) {
        setTermsValidationState(true);
        setTranslatedTextById("registerMsg", "Please agree before creating an account.");
        return;
    }

    try {
        const userId = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const registerResult = await apiPost('/api/users-register', {
            username,
            id: userId,
            googleCredential: googleRegisterState.credential,
            googleAccessToken: googleRegisterState.accessToken,
            profile: {
                displayName: googleRegisterState.name
            },
            deviceId: getFavoritesDeviceId()
        });
        setTranslatedTextById("registerMsg", "Registered successfully. Opening your account...");
        await openLoggedInAccount(registerResult, "Registered, but the new session could not be opened. Please sign in with Google.");
    } catch (error) {
        setTranslatedTextById("registerMsg", "Registration failed: " + error.message);
        alert(translateAuthText("Registration failed: " + error.message));
    }
}

async function login() {
    setGoogleLoginMessage('Use Google to sign in.');
}

function handleLoginPageEnter(event) {
    if (event.key !== "Enter" || !document.body.classList.contains("page-login")) return;

    const registerUsername = document.getElementById("registerUsername")?.value.trim();
    if (!registerUsername) return;

    event.preventDefault();
    register();
}

document.addEventListener("keydown", handleLoginPageEnter);

function shouldAutoOpenMainPage() {
    if (!document.body.classList.contains("page-login")) return false;
    if (document.body.classList.contains("page-account-select")) return false;
    const session = getStoredAuthSession();
    const currentUser = localStorage.getItem("currentUser");
    if (!session?.username || !session?.token) return false;
    if (!currentUser) {
        localStorage.setItem("currentUser", session.username);
        return true;
    }
    return session.username === currentUser;
}

async function initializeLoginPageUi() {
    if (shouldAutoOpenMainPage()) {
        await checkDietStatsRetentionAfterLogin(localStorage.getItem("currentUser") || getStoredAuthSession()?.username || "");
        window.location.replace("MainPage.html");
        return;
    }
    prefillAppLoginFields();
    initializePasswordToggles();
    initializeGoogleLoginButton();
    initializeGoogleRegisterButton();
    initializeAccountSelectPage();
    document.getElementById('clearGoogleRegisterButton')?.addEventListener('click', clearGoogleRegisterSelection);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoginPageUi);
} else {
    initializeLoginPageUi();
}

async function updateUserSelections(username, selections) {
    return saveUserSelections(username, selections);
}

function goToWorkoutPlanner() {
    window.location.href = "GymWorkoutPlanner.html";
}



if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapGlobalDraftSync);
} else {
    bootstrapGlobalDraftSync();
}












