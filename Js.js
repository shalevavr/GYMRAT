const TRACKING_PAGE_KEY = window.location.pathname;
const TRACKING_DRAFT_PREFIX = "gymrat:weights:draft:";
const TRACKING_DEVICE_KEY = "gymrat:deviceId";
const TRACKING_LOCAL_SAVE_DELAY = 500;
const TRACKING_CLOUD_SAVE_DELAY = 2200;
const TRACKING_DEFAULT_DATA = () => [{ exercise: "", sets: [{ weight: "", reps: "" }] }];

function translateTrackingText(text) {
    return typeof window.gymratTranslateText === "function" ? window.gymratTranslateText(text) : text;
}

let data = [];
let collapsedExercises = [];
let selectedTrackingIndexes = new Set();
const trackingState = {
    updatedAt: null,
    lastSyncedAt: null,
    pendingSync: false,
    baseCloudUpdatedAt: null,
    localSaveTimer: null,
    cloudSaveTimer: null,
    syncInFlight: false,
    listenersAttached: false,
    statusBanner: null,
    forceOfflineText: false
};

function getTrackingUser() {
    return localStorage.getItem("currentUser");
}

function getDeviceId() {
    let deviceId = localStorage.getItem(TRACKING_DEVICE_KEY);
    if (!deviceId) {
        deviceId = typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(TRACKING_DEVICE_KEY, deviceId);
    }
    return deviceId;
}

function getTrackingDraftKey(user) {
    return `${TRACKING_DRAFT_PREFIX}${user}:${TRACKING_PAGE_KEY}`;
}

function cloneTrackingData(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeTrackingData(value) {
    if (!Array.isArray(value) || value.length === 0) {
        return TRACKING_DEFAULT_DATA();
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

function serializeTrackingData(value) {
    return JSON.stringify(normalizeTrackingData(value));
}

function hasMeaningfulTrackingData(value) {
    return normalizeTrackingData(value).some(item => {
        if ((item.exercise || "").trim() !== "") return true;
        return item.sets.some(set => `${set.weight ?? ""}`.trim() !== "" || `${set.reps ?? ""}`.trim() !== "");
    });
}

function readLocalTrackingDraft(user) {
    if (!user) return null;

    try {
        const raw = localStorage.getItem(getTrackingDraftKey(user));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.data)) return null;
        return {
            ...parsed,
            data: normalizeTrackingData(parsed.data)
        };
    } catch (error) {
        return null;
    }
}

function writeLocalTrackingDraft(user) {
    if (!user) return;

    const draft = {
        version: 1,
        pageKey: TRACKING_PAGE_KEY,
        deviceId: getDeviceId(),
        data: cloneTrackingData(data),
        updatedAt: trackingState.updatedAt,
        lastSyncedAt: trackingState.lastSyncedAt,
        pendingSync: trackingState.pendingSync,
        baseCloudUpdatedAt: trackingState.baseCloudUpdatedAt
    };

    localStorage.setItem(getTrackingDraftKey(user), JSON.stringify(draft));
}

function getEmptyTrackingMeta() {
    return {
        updatedAt: null,
        lastSyncedAt: null,
        pendingSync: false,
        deviceId: null,
        baseCloudUpdatedAt: null
    };
}

async function loadCloudTrackingPayload(user) {
    if (!user) {
        return { data: null, meta: getEmptyTrackingMeta() };
    }

    const selections = await getUserSelections(user);
    return {
        data: normalizeTrackingData(selections?.pages?.[TRACKING_PAGE_KEY] || null),
        meta: {
            ...getEmptyTrackingMeta(),
            ...(selections?.pages_meta?.[TRACKING_PAGE_KEY] || {})
        }
    };
}

function pickPreferredTrackingSource(localDraft, cloudPayload) {
    const localHasContent = localDraft && hasMeaningfulTrackingData(localDraft.data);
    const cloudHasContent = cloudPayload?.data && hasMeaningfulTrackingData(cloudPayload.data);
    const localUpdatedAt = localDraft?.updatedAt || null;
    const cloudUpdatedAt = cloudPayload?.meta?.updatedAt || null;

    if (localHasContent && !cloudHasContent) return "local";
    if (cloudHasContent && !localHasContent) return "cloud";
    if (localHasContent && cloudHasContent) {
        if (localDraft.pendingSync && localUpdatedAt && (!cloudUpdatedAt || localUpdatedAt > cloudUpdatedAt)) {
            return "local";
        }
        if (cloudUpdatedAt && (!localUpdatedAt || cloudUpdatedAt > localUpdatedAt)) {
            return "cloud";
        }
        if (localUpdatedAt && cloudUpdatedAt && localUpdatedAt === cloudUpdatedAt) {
            return localDraft.pendingSync ? "local" : "cloud";
        }
        return localDraft.pendingSync ? "local" : "cloud";
    }

    if (localDraft?.pendingSync) return "local";
    return "default";
}

function ensureTrackingStatusBanner() {
    if (trackingState.statusBanner || !document.body.classList.contains("page-tracking-entry")) return;

    const wrapper = document.querySelector(".wrapper");
    if (!wrapper) return;

    const styleId = "tracking-status-inline-styles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            body.page-tracking-entry .tracking-status-banner {
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
            body.page-tracking-entry .tracking-status-banner.is-visible {
                display: block;
            }
            body.page-tracking-entry .tracking-status-banner[data-state="saved"] {
                display: block;
                background: rgba(34, 197, 94, 0.12);
                border-color: rgba(34, 197, 94, 0.28);
            }
            body.page-tracking-entry .tracking-status-banner[data-state="syncing"] {
                display: block;
                background: rgba(96, 165, 250, 0.14);
                border-color: rgba(96, 165, 250, 0.3);
            }
            body.page-tracking-entry .tracking-status-banner[data-state="local"] {
                display: block;
                background: rgba(250, 204, 21, 0.14);
                border-color: rgba(250, 204, 21, 0.28);
            }
            body.page-tracking-entry .tracking-status-banner[data-state="offline"] {
                display: block;
                background: rgba(245, 158, 11, 0.16);
                border-color: rgba(245, 158, 11, 0.34);
            }
            body.page-tracking-entry .wrapper {
                width: 100%;
                max-width: none;
                padding: 16px;
                overflow-x: auto;
            }
            body.page-tracking-entry .container {
                width: 100%;
                min-width: 0;
                grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
                align-items: start;
                justify-content: stretch;
                gap: 12px;
            }
            body.page-tracking-entry .box {
                padding: 12px;
                border-radius: 16px;
                background: rgba(15, 23, 42, 0.94);
                border: 1px solid rgba(148, 163, 184, 0.18);
                box-shadow: 0 14px 30px rgba(2, 6, 23, 0.24);
            }
            body.page-tracking-entry .selectBox {
                position: absolute;
                opacity: 0;
                pointer-events: none;
                width: 1px;
                height: 1px;
                margin: 0;
            }
            body.page-tracking-entry .exercise-card-actions {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 10px;
            }
            body.page-tracking-entry .exercise-select-toggle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: auto;
                min-width: 108px;
                min-height: 42px;
                max-width: none;
                margin: 0;
                padding: 9px 14px;
                border-radius: 999px;
                border: 1px solid rgba(148, 163, 184, 0.35);
                background: rgba(15, 23, 42, 0.72);
                color: #e2e8f0;
                font-size: 0.9rem;
                font-weight: 800;
                line-height: 1;
                box-shadow: none;
            }
            body.page-tracking-entry .exercise-select-toggle[aria-pressed="true"] {
                background: rgba(34, 197, 94, 0.22);
                border-color: rgba(74, 222, 128, 0.58);
                color: #dcfce7;
            }
            body.page-tracking-entry .exercise-select-dot {
                width: 12px;
                height: 12px;
                border-radius: 999px;
                border: 2px solid currentColor;
                box-sizing: border-box;
            }
            body.page-tracking-entry .exercise-select-toggle[aria-pressed="true"] .exercise-select-dot {
                background: currentColor;
            }
            body.page-tracking-entry .box.is-selected {
                border-color: rgba(74, 222, 128, 0.72);
                box-shadow: 0 18px 38px rgba(2, 6, 23, 0.28), 0 0 0 2px rgba(34, 197, 94, 0.2);
            }
            body.page-tracking-entry .exercise-toggle {
                width: 100%;
                min-width: 0;
                max-width: 100%;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin: 0;
                padding: 10px 12px;
                border: 1px solid rgba(96, 165, 250, 0.22);
                border-radius: 12px;
                background: rgba(30, 41, 59, 0.92);
                color: #f8fafc;
                font-size: 0.96rem;
                font-weight: 700;
                text-align: left;
            }
            body.page-tracking-entry .exercise-toggle-label {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            body.page-tracking-entry .exercise-toggle-caret {
                flex: 0 0 auto;
                color: rgba(191, 219, 254, 0.9);
                font-size: 0.86rem;
            }
            body.page-tracking-entry .exercise-details {
                display: grid;
                gap: 10px;
                margin-top: 10px;
            }
            body.page-tracking-entry .exercise-details.is-collapsed {
                display: none;
            }
            body.page-tracking-entry .exercise {
                width: 100%;
                min-width: 0;
                max-width: 100%;
                box-sizing: border-box;
                margin: 0;
                min-height: 40px;
                padding: 10px 12px;
                border-radius: 12px;
                font-size: 0.96rem;
                font-weight: 700;
            }
            body.page-tracking-entry .sets {
                display: grid;
                gap: 6px;
            }
            body.page-tracking-entry .set {
                display: grid;
                grid-template-columns: minmax(64px, auto) minmax(9ch, 1fr) minmax(9ch, 1fr) 32px;
                gap: 8px;
                align-items: center;
                margin-top: 0;
                padding-top: 0;
                border-top: none;
                min-width: 0;
            }
            body.page-tracking-entry .set strong {
                margin: 0;
                min-width: 0;
                white-space: nowrap;
                text-align: left;
                font-size: 0.92rem;
                font-weight: 700;
                letter-spacing: 0.02em;
                color: rgba(226, 232, 240, 0.82);
            }
            body.page-tracking-entry .set input {
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
                margin: 0;
                min-height: 38px;
                padding: 8px 10px;
                border-radius: 10px;
                font-size: 0.92rem;
                text-align: center;
                letter-spacing: 0.01em;
            }
            body.page-tracking-entry .set button,
            body.page-tracking-entry .set-add-btn,
            body.page-tracking-entry .buttons button {
                width: auto;
                max-width: none;
                margin: 0;
            }
            body.page-tracking-entry .set button {
                width: 34px;
                min-width: 34px;
                max-width: 34px;
                min-height: 38px;
                padding: 0;
                border-radius: 10px;
                background: rgba(239, 68, 68, 0.22);
                color: #fee2e2;
                font-size: 0.95rem;
                justify-self: end;
            }
            body.page-tracking-entry .set button:hover {
                background: rgba(239, 68, 68, 0.34);
            }
            body.page-tracking-entry .set-add-btn {
                margin-top: 10px;
                padding: 8px 12px;
                min-height: 38px;
                border-radius: 10px;
                background: rgba(37, 99, 235, 0.18);
                border: 1px solid rgba(96, 165, 250, 0.26);
                color: #dbeafe;
                font-size: 0.9rem;
            }
            body.page-tracking-entry .set-add-btn:hover {
                background: rgba(37, 99, 235, 0.3);
            }
            body.page-tracking-entry .buttons {
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 14px;
            }
            body.page-tracking-entry .buttons button {
                padding: 10px 14px;
                min-height: 40px;
                border-radius: 12px;
                font-size: 0.95rem;
            }
            body.page-tracking-entry .buttons button[data-role="save-tracking"] {
                display: none !important;
            }
            @media (max-width: 640px) {
                body.page-tracking-entry .wrapper {
                    width: 100%;
                    padding: 12px;
                }
                body.page-tracking-entry .tracking-status-banner {
                    padding: 11px 13px;
                    font-size: 0.95rem;
                }
                body.page-tracking-entry .container {
                    width: 100%;
                    min-width: 0;
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
                body.page-tracking-entry .box {
                    padding: 10px;
                    border-radius: 14px;
                }
                body.page-tracking-entry .exercise-toggle {
                    padding: 9px 10px;
                    font-size: 0.93rem;
                }
                body.page-tracking-entry .exercise {
                    width: 100%;
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                    min-height: 38px;
                    margin: 0;
                    padding: 9px 10px;
                    font-size: 0.93rem;
                }
                body.page-tracking-entry .exercise-details {
                    gap: 8px;
                    margin-top: 8px;
                }
                body.page-tracking-entry .set {
                    grid-template-columns: minmax(64px, auto) minmax(9ch, 1fr) minmax(9ch, 1fr) 32px;
                    gap: 6px;
                }
                body.page-tracking-entry .set strong {
                    font-size: 0.88rem;
                }
                body.page-tracking-entry .set input {
                    width: 100%;
                    min-width: 0;
                    box-sizing: border-box;
                    min-height: 36px;
                    padding: 7px 8px;
                    font-size: 0.88rem;
                    text-align: center;
                    letter-spacing: 0.01em;
                }
                body.page-tracking-entry .set button {
                    font-size: 0.88rem;
                    justify-self: end;
                }
                body.page-tracking-entry .set-add-btn {
                    width: 100%;
                    justify-content: center;
                    min-height: 36px;
                    padding: 8px 10px;
                }
                body.page-tracking-entry .buttons button {
                    flex: 1 1 140px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const banner = document.createElement("div");
    banner.className = "tracking-status-banner";
    banner.setAttribute("aria-live", "polite");
    wrapper.insertAdjacentElement("afterbegin", banner);
    trackingState.statusBanner = banner;
}

function updateTrackingStatus(state, text) {
    ensureTrackingStatusBanner();
    if (!trackingState.statusBanner) return;

    if (!text) {
        trackingState.statusBanner.textContent = "";
        trackingState.statusBanner.classList.remove("is-visible");
        trackingState.statusBanner.removeAttribute("data-state");
        return;
    }

    trackingState.statusBanner.textContent = text;
    trackingState.statusBanner.dataset.state = state;
    trackingState.statusBanner.classList.add("is-visible");
}

function refreshTrackingStatus() {
    if (!document.body.classList.contains("page-tracking-entry")) return;

    if (!navigator.onLine) {
        updateTrackingStatus("local", "Saved locally. Changes will sync to your account when internet returns.");
        return;
    }

    if (trackingState.syncInFlight) {
        updateTrackingStatus("local", "Saved locally. Changes will sync to your account soon.");
        return;
    }

    if (trackingState.pendingSync) {
        updateTrackingStatus("local", "Saved locally. Changes will sync to your account soon.");
        return;
    }

    if (trackingState.lastSyncedAt) {
        updateTrackingStatus("saved", "Synced to your account.");
        return;
    }

    updateTrackingStatus(null, "");
}

function scheduleLocalTrackingSave() {
    const user = getTrackingUser();
    if (!user) return;

    clearTimeout(trackingState.localSaveTimer);
    trackingState.localSaveTimer = setTimeout(() => {
        writeLocalTrackingDraft(user);
        refreshTrackingStatus();
    }, TRACKING_LOCAL_SAVE_DELAY);
}

function clearCloudSaveTimer() {
    clearTimeout(trackingState.cloudSaveTimer);
    trackingState.cloudSaveTimer = null;
}

function scheduleCloudTrackingSync() {
    clearCloudSaveTimer();

    if (!trackingState.pendingSync) {
        refreshTrackingStatus();
        return;
    }

    if (!navigator.onLine) {
        refreshTrackingStatus();
        return;
    }

    trackingState.cloudSaveTimer = setTimeout(() => {
        void flushTrackingCloudSync();
    }, TRACKING_CLOUD_SAVE_DELAY);
    refreshTrackingStatus();
}

function persistTrackingChange() {
    trackingState.updatedAt = new Date().toISOString();
    trackingState.pendingSync = true;
    scheduleLocalTrackingSave();
    scheduleCloudTrackingSync();
}

function syncDataFromUI() {
    const boxes = document.querySelectorAll(".box");

    boxes.forEach((box, index) => {
        const exercise = box.querySelector(".exercise")?.value || "";
        const sets = Array.from(box.querySelectorAll(".set")).map(setDiv => ({
            weight: setDiv.querySelector(".weight")?.value || "",
            reps: setDiv.querySelector(".reps")?.value || ""
        }));

        data[index] = { exercise, sets };
    });

    data = normalizeTrackingData(data);
}

function createBox(index, item) {
    const div = document.createElement("div");
    div.className = "box";

    const isCollapsed = collapsedExercises[index] !== false;
    const exerciseLabel = (item.exercise || "").trim() || translateTrackingText("Exercise name");
    const setsHTML = (item.sets || []).map((set, i) => `
        <div class="set">
            <strong>${translateTrackingText("Set")} ${i + 1}</strong>
            <input type="text" inputmode="numeric" class="weight" value="${set.weight || ""}" placeholder="${translateTrackingText("weight")}">
            <input type="text" inputmode="numeric" class="reps" value="${set.reps || ""}" placeholder="${translateTrackingText("reps")}">
            <button type="button" onclick="deleteSet(${index}, ${i})" aria-label="${translateTrackingText("Delete set")} ${i + 1}">&#10060;</button>
        </div>
    `).join("");

    const isSelected = selectedTrackingIndexes.has(index);
    div.classList.toggle("is-selected", isSelected);

    div.innerHTML = `
        <input type="checkbox" class="selectBox" ${isSelected ? "checked" : ""} tabindex="-1" aria-hidden="true">
        <div class="exercise-card-actions">
            <button type="button" class="exercise-select-toggle" onclick="toggleExerciseSelection(${index}, event)" aria-pressed="${isSelected}">
                <span class="exercise-select-dot" aria-hidden="true"></span>
                <span class="exercise-select-text">${translateTrackingText(isSelected ? "Selected" : "Select")}</span>
            </button>
        </div>
        <button type="button" class="exercise-toggle" onclick="toggleExerciseCard(${index})" aria-expanded="${!isCollapsed}">
            <span class="exercise-toggle-label">${exerciseLabel}</span>
            <span class="exercise-toggle-caret">${translateTrackingText(isCollapsed ? "Open" : "Close")}</span>
        </button>
        <div class="exercise-details${isCollapsed ? " is-collapsed" : ""}">
            <input type="text" class="exercise" value="${item.exercise || ""}" placeholder="${translateTrackingText("Exercise name")}">
            <div class="sets">${setsHTML}</div>
            <button type="button" class="set-add-btn" onclick="addSet(${index})">&#10133; ${translateTrackingText("Add Set")}</button>
        </div>
    `;

    return div;
}

function render() {
    const container = document.getElementById("container");
    if (!container) return;

    collapsedExercises = normalizeTrackingData(data).map((_, index) => collapsedExercises[index] !== false);

    container.innerHTML = "";
    normalizeTrackingData(data).forEach((item, index) => {
        container.appendChild(createBox(index, item));
    });
}

function toggleExerciseCard(index) {
    collapsedExercises[index] = !collapsedExercises[index];
    render();
}
function toggleExerciseSelection(index, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const shouldSelect = !selectedTrackingIndexes.has(index);
    if (shouldSelect) {
        selectedTrackingIndexes.add(index);
    } else {
        selectedTrackingIndexes.delete(index);
    }

    const box = document.querySelectorAll(".box")[index];
    if (!box) return;

    box.classList.toggle("is-selected", shouldSelect);
    const checkbox = box.querySelector(".selectBox");
    if (checkbox) checkbox.checked = shouldSelect;
    const button = box.querySelector(".exercise-select-toggle");
    if (button) {
        button.setAttribute("aria-pressed", shouldSelect ? "true" : "false");
        const text = button.querySelector(".exercise-select-text");
        if (text) text.textContent = translateTrackingText(shouldSelect ? "Selected" : "Select");
    }
}

function markTrackingPage() {
    if (document.getElementById("container") && document.querySelector(".wrapper")) {
        document.body.classList.add("page-tracking-entry");
    }
}

function removeManualSaveButton() {
    const saveButton = document.querySelector('.buttons button[onclick="saveAll()"]');
    if (saveButton) {
        saveButton.dataset.role = "save-tracking";
        saveButton.remove();
    }
}

function attachTrackingInputListeners() {
    if (trackingState.listenersAttached) return;
    trackingState.listenersAttached = true;

    document.addEventListener("input", event => {
        if (!document.body.classList.contains("page-tracking-entry")) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches(".exercise, .weight, .reps")) return;
        if (target.matches(".exercise")) {
            const box = target.closest(".box");
            const label = box?.querySelector(".exercise-toggle-label");
            if (label) {
                label.textContent = target.value.trim() || translateTrackingText("Exercise name");
            }
        }
        syncDataFromUI();
        persistTrackingChange();
    });

    window.addEventListener("online", () => {
        refreshTrackingStatus();
        if (trackingState.pendingSync) {
            void flushTrackingCloudSync();
        }
    });

    window.addEventListener("offline", () => {
        refreshTrackingStatus();
    });

    window.addEventListener("focus", () => {
        if (trackingState.pendingSync && navigator.onLine) {
            void flushTrackingCloudSync();
        } else {
            refreshTrackingStatus();
        }
    });

    const persistBeforeLeave = () => {
        if (!document.body.classList.contains("page-tracking-entry")) return;
        syncDataFromUI();
        writeLocalTrackingDraft(getTrackingUser());
    };

    window.addEventListener("beforeunload", persistBeforeLeave);
    window.addEventListener("pagehide", persistBeforeLeave);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            persistBeforeLeave();
        }
    });
}

function initializeTrackingChrome() {
    markTrackingPage();
    if (!document.body.classList.contains("page-tracking-entry")) return;
    removeManualSaveButton();
    ensureTrackingStatusBanner();
    attachTrackingInputListeners();
    refreshTrackingStatus();
}

async function flushTrackingCloudSync(force = false) {
    const user = getTrackingUser();
    if (!user) return false;
    if ((!trackingState.pendingSync && !force) || trackingState.syncInFlight) {
        refreshTrackingStatus();
        return false;
    }
    if (!navigator.onLine) {
        refreshTrackingStatus();
        return false;
    }

    clearCloudSaveTimer();
    trackingState.syncInFlight = true;
    refreshTrackingStatus();

    try {
        syncDataFromUI();
        const meta = {
            updatedAt: trackingState.updatedAt || new Date().toISOString(),
            lastSyncedAt: new Date().toISOString(),
            pendingSync: false,
            deviceId: getDeviceId(),
            baseCloudUpdatedAt: trackingState.updatedAt || trackingState.baseCloudUpdatedAt || null
        };

        await saveUserSelections(user, {
            pages: { [TRACKING_PAGE_KEY]: cloneTrackingData(data) },
            pages_meta: { [TRACKING_PAGE_KEY]: meta }
        });

        trackingState.lastSyncedAt = meta.lastSyncedAt;
        trackingState.baseCloudUpdatedAt = meta.updatedAt;
        trackingState.pendingSync = false;
        writeLocalTrackingDraft(user);
        refreshTrackingStatus();
        return true;
    } catch (error) {
        trackingState.pendingSync = true;
        writeLocalTrackingDraft(user);
        refreshTrackingStatus();
        return false;
    } finally {
        trackingState.syncInFlight = false;
        refreshTrackingStatus();
    }
}

async function saveAll() {
    if (!document.body.classList.contains("page-tracking-entry")) return;
    syncDataFromUI();
    persistTrackingChange();
    writeLocalTrackingDraft(getTrackingUser());
    await flushTrackingCloudSync(true);
}

async function loadAll() {
    initializeTrackingChrome();

    const user = getTrackingUser();
    const localDraft = readLocalTrackingDraft(user);
    let cloudPayload = { data: null, meta: getEmptyTrackingMeta() };

    if (user && navigator.onLine) {
        try {
            cloudPayload = await loadCloudTrackingPayload(user);
        } catch (error) {
        }
    }

    const source = pickPreferredTrackingSource(localDraft, cloudPayload);

    if (source === "local" && localDraft) {
        data = normalizeTrackingData(localDraft.data);
        trackingState.updatedAt = localDraft.updatedAt || new Date().toISOString();
        trackingState.lastSyncedAt = localDraft.lastSyncedAt || null;
        trackingState.pendingSync = !!localDraft.pendingSync;
        trackingState.baseCloudUpdatedAt = localDraft.baseCloudUpdatedAt || cloudPayload.meta.updatedAt || null;
    } else if (source === "cloud" && cloudPayload.data) {
        data = normalizeTrackingData(cloudPayload.data);
        trackingState.updatedAt = cloudPayload.meta.updatedAt || new Date().toISOString();
        trackingState.lastSyncedAt = cloudPayload.meta.lastSyncedAt || cloudPayload.meta.updatedAt || null;
        trackingState.pendingSync = false;
        trackingState.baseCloudUpdatedAt = cloudPayload.meta.updatedAt || null;
    } else {
        data = TRACKING_DEFAULT_DATA();
        trackingState.updatedAt = new Date().toISOString();
        trackingState.lastSyncedAt = null;
        trackingState.pendingSync = false;
        trackingState.baseCloudUpdatedAt = cloudPayload.meta.updatedAt || null;
    }

    render();
    writeLocalTrackingDraft(user);
    refreshTrackingStatus();

    if (trackingState.pendingSync && navigator.onLine) {
        scheduleCloudTrackingSync();
    }
}

function addBox() {
    syncDataFromUI();
    data.push({ exercise: "", sets: [{ weight: "", reps: "" }] });
    collapsedExercises.push(true);
    render();
    persistTrackingChange();
}

function addSet(index) {
    syncDataFromUI();
    data[index].sets.push({ weight: "", reps: "" });
    render();
    persistTrackingChange();
}

function deleteSet(boxIndex, setIndex) {
    syncDataFromUI();
    data[boxIndex].sets.splice(setIndex, 1);

    if (data[boxIndex].sets.length === 0) {
        data[boxIndex].sets.push({ weight: "", reps: "" });
    }

    render();
    persistTrackingChange();
}

function goToWorkoutPlanner() {
    window.location.href = "GymWorkoutPlanner.html";
}

async function deleteSelected() {
    syncDataFromUI();

    const confirmDelete = await window.gymratConfirm("Are you sure you want to delete the selected items?");
    if (!confirmDelete) return;

    const checkboxes = document.querySelectorAll(".box .selectBox");
    data = data.filter((item, index) => !selectedTrackingIndexes.has(index) && !checkboxes[index]?.checked);
    collapsedExercises = collapsedExercises.filter((_, index) => !selectedTrackingIndexes.has(index) && !checkboxes[index]?.checked);
    selectedTrackingIndexes.clear();

    if (data.length === 0) {
        data = TRACKING_DEFAULT_DATA();
    }

    render();
    persistTrackingChange();
}


function getExerciseId(card) {
    const title = card.querySelector(".exercise-title")?.innerText || "";
    return title + "_" + window.location.pathname;
}

const exerciseCards = document.querySelectorAll(".exercise-card");

async function initializeFavoriteIcons() {
    await initializeFavoritesSync();

    const applyFavoriteState = favorites => {
        exerciseCards.forEach(card => {
            const icon = card.querySelector(".check-icon");
            if (!icon) return;

            const id = getExerciseId(card);
            const isChecked = favorites.some(favorite => favorite.id === id);
            icon.classList.toggle("checked", isChecked);
        });
    };

    applyFavoriteState(await getSyncedFavorites());
    subscribeFavoritesSync(applyFavoriteState);

    const refreshFavoriteIcons = async () => {
        try {
            applyFavoriteState(await getSyncedFavorites(true));
        } catch (error) {
        }
    };

    window.addEventListener("pageshow", event => {
        if (event.persisted) {
            void refreshFavoriteIcons();
        }
    });

    window.addEventListener("focus", () => {
        void refreshFavoriteIcons();
    });

    exerciseCards.forEach(card => {
        const icon = card.querySelector(".check-icon");
        if (!icon || icon.dataset.favoriteBound === "true") return;

        icon.dataset.favoriteBound = "true";

        icon.addEventListener("click", async () => {
            const currentUser = getTrackingUser();
            if (!currentUser) return alert("No user logged in");

            const id = getExerciseId(card);
            const title = card.querySelector(".exercise-title")?.innerText || "";
            const img = card.querySelector(".IMG")?.src || "";

            try {
                const result = await toggleFavoriteSelection({ id, title, img });
                icon.classList.toggle("checked", !!result?.isFavorite);
            } catch (error) {
                alert(error.message || "Unable to update favorites.");
            }
        });
    });
}

void initializeFavoriteIcons();

function editTable() {
    const table = document.getElementById("weeklyTable");
    if (!table) return;

    const cells = table.querySelectorAll("td");
    cells.forEach(cell => {
        const currentValue = cell.textContent.trim();
        const input = document.createElement("input");
        input.type = "text";
        input.value = currentValue;
        cell.textContent = "";
        cell.appendChild(input);
    });
}

async function saveTable() {
    const table = document.getElementById("weeklyTable");
    if (!table) return;

    const cells = table.querySelectorAll("td");
    const tableData = [];

    cells.forEach(cell => {
        const input = cell.querySelector("input");
        if (input) {
            const value = input.value;
            cell.textContent = value;
            tableData.push(value);
        }
    });

    const user = getTrackingUser();
    if (!user) return alert("No user logged in");

    await saveUserPageData(user, TRACKING_PAGE_KEY, tableData);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeTrackingChrome);
} else {
    initializeTrackingChrome();
}
window.addEventListener("gymrat-language-change", () => {
    if (document.getElementById("container")) render();
});

