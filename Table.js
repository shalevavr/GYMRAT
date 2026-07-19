
// ==========================================
// LOCAL STORAGE & INITIALIZATION
// ==========================================
let pageKey = "default";

function translateTableText(value) {
    return typeof window.gymratTranslateText === "function" ? window.gymratTranslateText(value) : String(value || "");
}

document.addEventListener("DOMContentLoaded", () => {
    pageKey = document.body.dataset.page || "default";

    setTimeout(loadTableData, 50);
    setTimeout(loadPlanner, 50);

    if (pageKey === "my-plans") {
        displaySavedPlansInPage();
        checkUrlAndOpenPlan();
    }
});

window.addEventListener("gymrat:cloud-sync-complete", () => {
    if (document.querySelector(".table-cell-editor, .table-cell-editor-multiline")) return;

    if (pageKey === "weekly") {
        void loadTableData();
        return;
    }

    if (pageKey === "planner") {
        void loadPlanner();
        return;
    }

    if (pageKey === "my-plans") {
        void displaySavedPlansInPage();
    }
});

function getCurrentUser() {
    return localStorage.getItem("currentUser");
}

async function getUserSelectionsData() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    return await getUserSelections(currentUser);
}

async function updateCurrentUserSelections(update) {
    const currentUser = getCurrentUser();
    if (!currentUser) return "none";
    return await saveUserSelections(currentUser, update);
}

function getTable() {
    return document.getElementById("WorkoutPlanMainPage");
}

function getPlannerTable() {
    return document.getElementById("GymWorkoutPlanner");
}
const TABLE_CONTROL_CONTAINER_STYLE = "display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; overflow-x: visible; width: 100%; direction: ltr; padding: 6px 0;";
const TABLE_HEADER_CELL_STYLE = "background-color: #00a2e8 !important; color: #ffffff !important; padding: 18px 15px; border: 1px solid rgba(255, 255, 255, 1); font-weight: 700; text-align: center; white-space: nowrap; overflow-wrap: normal; word-break: keep-all; line-height: 1.35; font-size: clamp(0.82rem, 1.1vw, 1rem);";
const TABLE_SIDE_HEADER_CELL_STYLE = "background-color: #00a2e8 !important; color: #ffffff !important; padding: 15px; border: 1px solid rgba(255, 255, 255, 1); font-weight: bold; text-align: center; width: 140px; white-space: nowrap; overflow-wrap: normal; word-break: keep-all; line-height: 1.35; font-size: clamp(0.82rem, 1.1vw, 1rem);";
const TABLE_BODY_CELL_STYLE = "padding: 15px; background: #898989 !important; border: 1px solid rgba(255, 255, 255, 1); color: #cbd5e1; text-align: center; white-space: nowrap; overflow-wrap: normal; word-break: keep-all; line-height: 1.45; vertical-align: middle; font-size: clamp(0.82rem, 1.1vw, 1rem);";
let plannerStatusBanner = null;

function ensurePlannerStatusBanner() {
    if (plannerStatusBanner) return plannerStatusBanner;

    const isPlannerStatusPage = document.body.classList.contains("page-weekly-routine")
        || document.body.classList.contains("page-gym-planner")
        || document.body.classList.contains("page-my-plans");
    if (!isPlannerStatusPage) return null;

    const styleId = "planner-status-inline-styles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            body.page-weekly-routine .tracking-status-banner,
            body.page-gym-planner .tracking-status-banner,
            body.page-my-plans .tracking-status-banner {
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
            body.page-weekly-routine .tracking-status-banner.is-visible,
            body.page-gym-planner .tracking-status-banner.is-visible,
            body.page-my-plans .tracking-status-banner.is-visible {
                display: block;
            }
            body.page-weekly-routine .tracking-status-banner[data-state="saved"],
            body.page-gym-planner .tracking-status-banner[data-state="saved"],
            body.page-my-plans .tracking-status-banner[data-state="saved"] {
                display: block;
                background: rgba(34, 197, 94, 0.12);
                border-color: rgba(34, 197, 94, 0.28);
            }
            body.page-weekly-routine .tracking-status-banner[data-state="syncing"],
            body.page-gym-planner .tracking-status-banner[data-state="syncing"],
            body.page-my-plans .tracking-status-banner[data-state="syncing"] {
                display: block;
                background: rgba(96, 165, 250, 0.14);
                border-color: rgba(96, 165, 250, 0.3);
            }
            body.page-weekly-routine .tracking-status-banner[data-state="local"],
            body.page-gym-planner .tracking-status-banner[data-state="local"],
            body.page-my-plans .tracking-status-banner[data-state="local"] {
                display: block;
                background: rgba(250, 204, 21, 0.14);
                border-color: rgba(250, 204, 21, 0.28);
            }
            body.page-weekly-routine .tracking-status-banner[data-state="offline"],
            body.page-gym-planner .tracking-status-banner[data-state="offline"],
            body.page-my-plans .tracking-status-banner[data-state="offline"] {
                display: block;
                background: rgba(245, 158, 11, 0.16);
                border-color: rgba(245, 158, 11, 0.34);
            }
            @media (max-width: 640px) {
                body.page-weekly-routine .tracking-status-banner,
                body.page-gym-planner .tracking-status-banner,
                body.page-my-plans .tracking-status-banner {
                    padding: 11px 13px;
                    font-size: 0.95rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const anchor = document.querySelector(".planner-btn-container")
        || document.querySelector(".hero-copy")
        || document.getElementById("savedPlansContainer")
        || document.querySelector(".hero-panel")
        || document.body;

    const banner = document.createElement("div");
    banner.className = "tracking-status-banner";
    banner.setAttribute("aria-live", "polite");

    if (anchor === document.body) {
        document.body.insertAdjacentElement("afterbegin", banner);
    } else if (anchor.classList?.contains("hero-copy")) {
        anchor.insertAdjacentElement("afterend", banner);
    } else {
        anchor.insertAdjacentElement("beforebegin", banner);
    }

    plannerStatusBanner = banner;
    return banner;
}

function updatePlannerStatus(state, text) {
    const banner = ensurePlannerStatusBanner();
    if (!banner) return;

    if (!text) {
        banner.textContent = "";
        banner.classList.remove("is-visible");
        banner.removeAttribute("data-state");
        return;
    }

    banner.textContent = text;
    banner.dataset.state = state;
    banner.classList.add("is-visible");
}

function showPlannerSaveStart() {
    if (!navigator.onLine) {
        updatePlannerStatus("local", "Saved locally. Changes will sync to your account when internet returns.");
        return;
    }

    updatePlannerStatus("local", "Saved locally. Changes will sync to your account soon.");
}

function showPlannerSaveComplete(saveStatus) {
    if (saveStatus === "local" || !navigator.onLine) {
        const message = navigator.onLine
            ? "Saved locally. Changes will sync to your account soon."
            : "Saved locally. Changes will sync to your account when internet returns.";
        updatePlannerStatus("local", message);
        return;
    }

    updatePlannerStatus("saved", "Synced to your account.");
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setTableCellStyle(cell, rowIndex, cellIndex) {
    if (rowIndex === 0) {
        cell.style.cssText = TABLE_HEADER_CELL_STYLE;
        return;
    }

    if (cellIndex === 0) {
        cell.style.cssText = TABLE_SIDE_HEADER_CELL_STYLE;
        return;
    }

    cell.style.cssText = TABLE_BODY_CELL_STYLE;
}

function createTableEditor(value, multiline = false) {
    const field = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) {
        field.type = "text";
    } else {
        field.rows = 2;
    }

    field.value = value;
    field.className = multiline ? "table-cell-editor table-cell-editor-multiline" : "table-cell-editor";
    field.style.cssText = multiline
        ? "width: 100%; min-height: 54px; resize: vertical; background: rgba(255,255,255,0.1); border: 1px solid #3b82f6; color: white; text-align: center; border-radius: 10px; padding: 8px 10px; line-height: 1.35; white-space: nowrap; overflow-x: auto; overflow-y: hidden; word-break: keep-all;"
        : "width: 100%; background: rgba(255,255,255,0.1); border: 1px solid #3b82f6; color: white; text-align: center; border-radius: 10px; padding: 8px 10px; line-height: 1.35; white-space: nowrap; overflow-x: auto; text-overflow: clip;";

    return field;
}

function createTableActionButton(text, isDelete, onClick) {
    const btn = document.createElement("button");
    const [symbol = "", ...rest] = text.trim().split(/\s+/);
    const label = translateTableText(rest.join(" "));

    btn.className = `table-control-btn ${isDelete ? "table-control-btn-delete" : "table-control-btn-add"}`;
    btn.setAttribute("dir", "ltr");
    btn.setAttribute("aria-label", translateTableText(text));
    btn.innerHTML = `<span class="table-control-btn-symbol">${symbol}</span><span class="table-control-btn-text">${label}</span>`;
    btn.style.cssText = `min-width: 0; width: clamp(54px, 22vw, 84px); height: clamp(28px, 7vw, 34px); padding: 5px clamp(4px, 1.8vw, 9px); border-radius: 8px; cursor: pointer; border: none; font-weight: 700; font-size: clamp(0.62rem, 2.7vw, 0.84rem); line-height: 1; color: white; background: ${isDelete ? "#ef4444" : "#22c55e"}; display: inline-flex; align-items: center; justify-content: center; gap: clamp(2px, 1vw, 5px); white-space: nowrap; flex: 1 1 0; direction: ltr;`;
    btn.onclick = onClick;
    return btn;
}

function setNotebookButtonVisible(isVisible) {
    document.querySelectorAll(".notebook-edit-btn").forEach(button => {
        button.hidden = pageKey === "planner" ? false : !isVisible;
    });
    updateNotebookButtonIcon();
}

function updateNotebookButtonIcon() {
    const isNoteMode = Boolean(findCurrentPlanSurface()?.querySelector(".planner-note-editor")
        || findPlannerSurface()?.querySelector(".planner-note-editor"));
    document.querySelectorAll(".notebook-edit-btn").forEach(button => {
        button.classList.toggle("notebook-edit-btn-table-mode", isNoteMode);
        button.setAttribute("aria-label", isNoteMode ? "Switch to table" : "Switch to note");
        button.setAttribute("title", isNoteMode ? "Switch to table" : "Switch to note");
    });
}

function isNotePlanData(value) {
    return value && typeof value === "object" && !Array.isArray(value) && value.type === "note";
}

function createNotebookEditor(title = "Enter workout name here", body = "") {
    const shell = document.createElement("div");
    shell.className = "planner-note-editor";
    shell.innerHTML = `
        <input class="planner-note-title" type="text" value="${escapeHtml(title)}">
        <textarea class="planner-note-body" spellcheck="true"></textarea>
    `;
    shell.querySelector(".planner-note-body").value = body;
    return shell;
}

function findPlannerSurface() {
    const table = getPlannerTable();
    return table?.closest(".table-responsive-wrapper")
        || document.querySelector("body.page-gym-planner .table-responsive-wrapper")
        || null;
}

function findCurrentPlanSurface() {
    const table = document.getElementById("CurrentPlanTable");
    return table?.closest("div[dir='ltr']")
        || document.querySelector("#planViewer div[dir='ltr']")
        || null;
}

function setSurfaceToNotebook(surface, title, body) {
    if (!surface) return;
    surface.innerHTML = "";
    surface.appendChild(createNotebookEditor(title, body));
}

function setSurfaceToPlannerTable(surface, tableId = "GymWorkoutPlanner") {
    if (!surface) return;
    surface.innerHTML = `<table id="${tableId}" style="width: max-content; min-width: 100%; border-collapse: collapse; background: rgba(30, 41, 59, 0.3); color: #ffffff; table-layout: auto; margin-top: 0;"></table>`;
}

function setNotebookEditorReadOnly(surface, isReadOnly) {
    const noteEditor = surface?.querySelector(".planner-note-editor");
    if (!noteEditor) return;
    noteEditor.classList.toggle("planner-note-editor-readonly", isReadOnly);
    noteEditor.querySelectorAll(".planner-note-title, .planner-note-body").forEach(field => {
        field.readOnly = isReadOnly;
    });
}

function getDefaultPlannerRows() {
    return [
        ["Enter workout name here", "Exercise", "Sets", "Reps", "Weight", "Rest", "Notes"],
        ["Back", "", "", "", "", "", ""],
        ["Biceps", "", "", "", "", "", ""],
        ["Abs", "", "", "", "", "", ""]
    ];
}

function renderRowsIntoTable(table, rows) {
    if (!table) return;
    table.innerHTML = "";
    rows.forEach((rowData, rowIndex) => {
        const tr = document.createElement("tr");
        rowData.forEach((cellData, cellIndex) => {
            const isHeader = rowIndex === 0 || cellIndex === 0;
            const cell = document.createElement(isHeader ? "th" : "td");
            cell.textContent = cellData;
            if (rowIndex === 0 && cellIndex === 0) cell.id = "tableNameCell";
            setTableCellStyle(cell, rowIndex, cellIndex);
            tr.appendChild(cell);
        });
        table.appendChild(tr);
    });
}

function makeTableEditable(table) {
    if (!table) return;
    table.querySelectorAll("td, th").forEach(cell => {
        if (cell.querySelector("input, textarea")) return;
        const input = createTableEditor(cell.textContent.trim(), cell.tagName === "TD");
        cell.textContent = "";
        cell.appendChild(input);
    });
}

function getNotebookDataFromSurface(surface) {
    const noteEditor = surface?.querySelector(".planner-note-editor");
    if (!noteEditor) return null;

    const title = noteEditor.querySelector(".planner-note-title")?.value?.trim() || "";
    const body = noteEditor.querySelector(".planner-note-body")?.value || "";
    return { type: "note", title, body };
}

function getSavedNoteName(noteData, fallbackName = "") {
    return (noteData?.title || fallbackName || "").trim();
}

window.focusNotebookCell = function () {
    const noteEditor = document.querySelector(".planner-note-editor");
    if (noteEditor) {
        noteEditor.querySelector(".planner-note-body")?.focus();
        return;
    }

    const table = document.getElementById("CurrentPlanTable")
        || (pageKey === "planner" ? getPlannerTable() : getTable());
    if (!table) return;

    const headerCells = Array.from(table.rows[0]?.cells || []);
    const notesIndex = headerCells.findIndex(cell => cell.textContent.trim().toLowerCase() === "notes");
    const notesEditor = notesIndex >= 0
        ? Array.from(table.rows).slice(1).map(row => row.cells[notesIndex]?.querySelector("input, textarea")).find(Boolean)
        : null;
    const fallbackEditor = table.querySelector("textarea, input");
    const editor = notesEditor || fallbackEditor;

    if (editor) {
        editor.focus();
        if (typeof editor.select === "function") editor.select();
    }
};

window.toggleNotebookMode = async function () {
    const currentSurface = findCurrentPlanSurface();
    const plannerSurface = findPlannerSurface();
    const surface = currentSurface || plannerSurface;
    if (!surface) return;

    const noteEditor = surface.querySelector(".planner-note-editor");
    if (noteEditor) {
        const confirmed = await window.gymratConfirm("Are you sure you want to bring this note back to a table? Data that was written in here before will not be saved.");
        if (!confirmed) return;

        setSurfaceToPlannerTable(surface, currentSurface ? "CurrentPlanTable" : "GymWorkoutPlanner");
        renderRowsIntoTable(currentSurface ? document.getElementById("CurrentPlanTable") : getPlannerTable(), getDefaultPlannerRows());
        if (currentSurface) {
            createCurrentPlanControls();
            makeTableEditable(document.getElementById("CurrentPlanTable"));
        } else {
            plannerEditMode = false;
            createPlannerControls();
        }
        updateNotebookButtonIcon();
        return;
    }

    const confirmed = await window.gymratConfirm("Are you sure you want to make this table a note? Data that was written in here before will not be saved.");
    if (!confirmed) return;

    const table = currentSurface ? document.getElementById("CurrentPlanTable") : getPlannerTable();
    const title = table?.rows?.[0]?.cells?.[0]?.querySelector("input, textarea")?.value?.trim()
        || table?.rows?.[0]?.cells?.[0]?.textContent?.trim()
        || "Enter workout name here";
    setSurfaceToNotebook(surface, title, "");
    setNotebookEditorReadOnly(surface, !currentSurface);
    const currentPlanControls = document.getElementById("currentPlanControls");
    if (currentPlanControls) currentPlanControls.style.display = "none";
    const plannerControls = document.getElementById("plannerControls");
    if (!currentSurface) plannerEditMode = false;
    if (plannerControls) {
        plannerControls.innerHTML = "";
        plannerControls.style.display = "none";
    }
    updateNotebookButtonIcon();
};
// ==========================================
// WEEKLY TABLE LOGIC (Main Page)
// ==========================================

async function loadTableData() {
    const table = getTable();
    const currentUser = getCurrentUser();
    const selections = await getUserSelectionsData();
    const plans = selections?.gym_plans || {};
    const planNames = Object.keys(plans);

    if (!table || !currentUser || !selections?.pages?.[pageKey]) return;

    const data = selections.pages[pageKey];
    table.innerHTML = "";

    data.forEach((rowData, rowIndex) => {
        const tr = document.createElement("tr");
        rowData.forEach((cellData, cellIndex) => {
            const isHeader = rowIndex === 0 || cellIndex === 0;
            const cell = document.createElement(isHeader ? "th" : "td");

            if (!isHeader && cellData.trim() !== "") {
                cell.innerHTML = createSmartLinks(cellData, planNames);
            } else {
                cell.textContent = cellData;
            }

            setTableCellStyle(cell, rowIndex, cellIndex);
            tr.appendChild(cell);
        });
        table.appendChild(tr);
    });
}

function createSmartLinks(text, planNames) {
    if (!text) return "";

    const sortedNames = [...planNames]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);

    if (!sortedNames.length) {
        return escapeHtml(text).replace(/\n/g, "<br>");
    }

    const escapedNames = sortedNames.map(name => name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"));
    const matcher = new RegExp(`(${escapedNames.join("|")})`, "g");

    return escapeHtml(text)
        .replace(matcher, matchedName => {
            const safeName = escapeHtml(matchedName);
            return `<a href="MyPlans.html?plan=${encodeURIComponent(matchedName)}" class="planner-inline-link" title="View ${safeName}">${safeName}</a>`;
        })
        .replace(/\n/g, "<br>");
}

async function editTable() {
    if (!(await window.gymratConfirm("Are you sure you want to edit the table?"))) return;
    const table = getTable();
    if (!table) return;

    const cells = table.querySelectorAll("td, th");
    cells.forEach(cell => {
        if (cell.querySelector("input, textarea")) return;
        const text = cell.textContent.trim();
        const input = createTableEditor(text, cell.tagName === "TD");
        cell.textContent = "";
        cell.appendChild(input);
    });
    createWeeklyControls();
    setNotebookButtonVisible(true);
}

async function saveTable() {
    const table = getTable();
    if (!table) return;

    const currentUser = getCurrentUser();
    if (!currentUser) return alert("Please log in first");
    showPlannerSaveStart();

    const data = [];
    table.querySelectorAll("tr").forEach(row => {
        const rowData = [];
        row.querySelectorAll("td, th").forEach(cell => {
            const input = cell.querySelector("input, textarea");
            rowData.push(input ? input.value.trim() : cell.textContent.trim());
        });
        data.push(rowData);
    });

    const saveStatus = await saveUserPageData(currentUser, pageKey, data);

    const container = document.getElementById("weeklyControlsContainer");
    if (container) container.innerHTML = "";
    setNotebookButtonVisible(false);
    await loadTableData();
    showPlannerSaveComplete(saveStatus);
}

// ==========================================
// CONTROLS GENERATOR (Rows/Cols)
// ==========================================

function createWeeklyControls() {
    const container = document.getElementById("weeklyControlsContainer");
    if (!container) return;

    container.innerHTML = "";
    container.className = "table-control-bar";

    container.appendChild(createTableActionButton("X row", true, deleteWeeklyRow));
    container.appendChild(createTableActionButton("X col", true, deleteWeeklyColumn));
    container.appendChild(createTableActionButton("+ row", false, addWeeklyRow));
    container.appendChild(createTableActionButton("+ col", false, addWeeklyColumn));
}

function addWeeklyRow() {
    const table = getTable();
    if (!table) return;
    const colCount = table.rows[0].cells.length;
    const newRow = table.insertRow(-1);
    for (let i = 0; i < colCount; i++) {
        const cell = i === 0 ? document.createElement("th") : newRow.insertCell(-1);
        if (i === 0) newRow.appendChild(cell);
        const input = createTableEditor("", i !== 0);
        cell.appendChild(input);
        setTableCellStyle(cell, table.rows.length - 1, i);
    }
}

function addWeeklyColumn() {
    const table = getTable();
    if (!table) return;
    Array.from(table.rows).forEach((row, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        const input = createTableEditor("", index !== 0);
        cell.appendChild(input);
        row.appendChild(cell);
        setTableCellStyle(cell, index, row.cells.length - 1);
    });
}

function deleteWeeklyRow() {
    const table = getTable();
    if (table && table.rows.length > 1) table.deleteRow(-1);
}

function deleteWeeklyColumn() {
    const table = getTable();
    if (!table || table.rows[0].cells.length <= 1) return;
    Array.from(table.rows).forEach(row => row.deleteCell(-1));
}

// ==========================================
// GYM PLANNER LOGIC
// ==========================================
let plannerEditMode = false;

window.editPlanner = async function () {
    if (!(await window.gymratConfirm("Are you sure you want to edit?"))) return;
    plannerEditMode = true;
    createPlannerControls();
    setNotebookButtonVisible(true);
    const noteEditor = findPlannerSurface()?.querySelector(".planner-note-editor");
    if (noteEditor) {
        setNotebookEditorReadOnly(findPlannerSurface(), false);
        noteEditor.querySelector(".planner-note-body")?.focus();
        return;
    }
    const table = getPlannerTable();
    if (!table) return;
    makeTableEditable(table);
};

function createPlannerControls() {
    let container = document.getElementById("plannerControls");
    if (!container) {
        container = document.createElement("div");
        container.id = "plannerControls";
        const target = document.getElementById("plannerControlsContainer") || document.body;
        target.appendChild(container);
    }
    container.innerHTML = "";
    container.className = "table-control-bar";
    if (!plannerEditMode || findPlannerSurface()?.querySelector(".planner-note-editor")) {
        container.style.display = "none";
        return;
    }
    container.style.display = "flex";

    container.appendChild(createTableActionButton("X row", true, deleteLastRow));
    container.appendChild(createTableActionButton("X col", true, deleteLastColumn));
    container.appendChild(createTableActionButton("+ row", false, addPlannerRow));
    container.appendChild(createTableActionButton("+ col", false, addPlannerColumn));
}

function addPlannerRow() {
    const table = getPlannerTable();
    if (!table) return;
    const colCount = table.rows[0] ? table.rows[0].cells.length : 1;
    const newRow = table.insertRow(-1);
    for (let i = 0; i < colCount; i++) {
        const cell = i === 0 ? document.createElement("th") : newRow.insertCell(i);
        if (i === 0) newRow.appendChild(cell);
        const input = createTableEditor("", i !== 0);
        cell.appendChild(input);
        setTableCellStyle(cell, table.rows.length - 1, i);
    }
}

function addPlannerColumn() {
    const table = getPlannerTable();
    if (!table) return;
    Array.from(table.rows).forEach((row, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        const input = createTableEditor("", index !== 0);
        cell.appendChild(input);
        row.appendChild(cell);
        setTableCellStyle(cell, index, row.cells.length - 1);
    });
}

function deleteLastColumn() {
    const table = getPlannerTable();
    if (!table || table.rows[0].cells.length <= 1) return;
    Array.from(table.rows).forEach(row => row.deleteCell(-1));
}

async function loadSavedPlans() {
    const selections = await getUserSelectionsData();
    const plans = selections?.gym_plans || {};
    if (!plans || Object.keys(plans).length === 0) {
        alert("No saved plans yet.");
        return;
    }
    window.location.href = "MyPlans.html";
}

// ==========================================
// MY PLANS MANAGEMENT
// ==========================================

async function displaySavedPlansInPage() {
    const container = document.getElementById("savedPlansContainer");
    if (!container) return;

    const selections = await getUserSelectionsData();
    const plans = selections?.gym_plans || {};
    if (!plans || Object.keys(plans).length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#cbd5e1; opacity: 0.6;'>No saved plans found.</p>";
        return;
    }

    container.innerHTML = "";

    Object.keys(plans).forEach(planName => {
        const rowWrapper = document.createElement("div");
        rowWrapper.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 12px; margin: 15px auto; width: 100%; max-width: 600px; box-sizing: border-box;";

        const menuContainer = document.createElement("div");
        menuContainer.style.cssText = "background: rgba(30, 58, 138, 0.5); padding: 12px; border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 4px; transition: 0.3s;";
        menuContainer.innerHTML = `
            <div style="width: 18px; height: 2px; background: #fbbf24;"></div>
            <div style="width: 18px; height: 2px; background: #fbbf24;"></div>
            <div style="width: 18px; height: 2px; background: #fbbf24;"></div>
        `;
        menuContainer.onclick = () => renderPlanTable(planName, plans[planName], plans);

        const nameContainer = document.createElement("div");
        nameContainer.style.cssText = "background: rgba(30, 58, 138, 0.5); padding: 12px 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); flex: 1 1 auto; min-width: 0; max-width: 100%; text-align: start; cursor: pointer; color: white; font-weight: 600; transition: 0.3s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; unicode-bidi: plaintext;";
        nameContainer.innerText = planName;
        nameContainer.title = planName;
        nameContainer.dir = /[\u0590-\u05FF\u0600-\u06FF]/.test(planName) ? "rtl" : "ltr";
        nameContainer.onclick = () => renderPlanTable(planName, plans[planName], plans);

        const deleteContainer = document.createElement("div");
        deleteContainer.style.cssText = "background: rgba(239, 68, 68, 0.15); padding: 10px; border-radius: 10px; border: 1px solid rgba(239, 68, 68, 0.3); cursor: pointer; transition: 0.3s; display: flex; align-items: center; flex: 0 0 auto;";
        deleteContainer.innerHTML = "&#128465;&#65039;";
        deleteContainer.onclick = () => deleteSpecificPlan(planName);

        rowWrapper.appendChild(menuContainer);
        rowWrapper.appendChild(nameContainer);
        rowWrapper.appendChild(deleteContainer);
        container.appendChild(rowWrapper);
    });
}

function renderPlanTable(name, data, plans = {}) {
    let viewer = document.getElementById("planViewer");
    if (!viewer) {
        viewer = document.createElement("div");
        viewer.id = "planViewer";
        viewer.style.cssText = "margin-top: 40px; width: min(100%, 1180px); display: flex; flex-direction: column; align-items: center; transition: opacity 0.4s ease;";
        document.body.appendChild(viewer);
    }

    viewer.innerHTML = `
        <h2 style="color: #fbbf24; text-align: center; margin-bottom: 20px; font-size: 1.8rem;">Plan: ${name}</h2>
        <div class="saved-plan-action-panel">
            <div class="saved-plan-primary-actions">
             <button onclick="editCurrentViewedPlan('${name}')" style="background: #eab308; color: black; padding: 12px 30px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">${translateTableText("Edit Plan")}</button>
             <button onclick="saveCurrentViewedPlan('${name}')" style="background: #22c55e; color: white; padding: 12px 30px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">${translateTableText("Save & Close")}</button>
             <button type="button" class="notebook-edit-btn" aria-label="Notebook" title="Notebook" onclick="toggleNotebookMode()" hidden>
                <span class="notebook-icon" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                </span>
             </button>
        </div>
            <div class="saved-plan-structure-actions">
                <div id="currentPlanControls" style="display: none; width: 100%;"></div>
            </div>
        </div>
        <div dir="ltr" class="saved-plan-table-wrap" style="width: 100%; overflow-x: auto; overflow-y: hidden; padding-inline: clamp(12px, 3vw, 24px); box-sizing: border-box;">
            <table id="CurrentPlanTable" style="direction: ltr; width: max-content; min-width: 100%; border-collapse: collapse; margin-bottom: 80px; background: rgba(15, 23, 42, 0.8); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,1); table-layout: auto;"></table>
        </div>
    `;

    if (isNotePlanData(data)) {
        const surface = findCurrentPlanSurface();
        setSurfaceToNotebook(surface, data.title || name, data.body || "");
        setNotebookEditorReadOnly(surface, true);
        viewer.scrollIntoView({ behavior: "smooth" });
        return;
    }

    const table = document.getElementById("CurrentPlanTable");
    const planNames = Object.keys(plans).filter(planName => planName !== name);
    data.forEach((rowData, rowIndex) => {
        const tr = document.createElement("tr");
        rowData.forEach((cellData, cellIndex) => {
            const isHeader = rowIndex === 0 || cellIndex === 0;
            const cell = document.createElement(isHeader ? "th" : "td");
            if (`${cellData || ""}`.trim() !== "") {
                cell.innerHTML = createSmartLinks(cellData, planNames);
            } else {
                cell.textContent = cellData;
            }

            if (rowIndex === 0) {
                cell.style.cssText = "background: #00a2e8; color: white; padding: 18px; border: 1px solid rgba(255,255,255,1);";
            } else if (cellIndex === 0) {
                cell.style.cssText = "background: #00a2e8; color: white; padding: 15px; border: 1px solid rgba(255,255,255,1); font-weight: bold; text-align: center;";
            } else {
                cell.style.cssText = "padding: 15px; background: #898989; border: 1px solid rgba(255,255,255,1); color: #e5e7eb; text-align: center;";
            }
            tr.appendChild(cell);
        });
        table.appendChild(tr);
    });

    viewer.scrollIntoView({ behavior: "smooth" });
}

function createCurrentPlanControls() {
    const container = document.getElementById("currentPlanControls");
    if (!container) return;

    container.innerHTML = "";
    container.className = "table-control-bar table-control-bar-compact";
    if (findCurrentPlanSurface()?.querySelector(".planner-note-editor")) {
        container.style.display = "none";
        return;
    }
    container.style.display = "flex";

    container.appendChild(createTableActionButton("X row", true, deleteRowFromCurrentPlan));
    container.appendChild(createTableActionButton("X col", true, deleteColumnFromCurrentPlan));
    container.appendChild(createTableActionButton("+ row", false, addRowToCurrentPlan));
    container.appendChild(createTableActionButton("+ col", false, addColumnToCurrentPlan));
}

function addRowToCurrentPlan() {
    const table = document.getElementById("CurrentPlanTable");
    if (!table || !table.rows.length) return;

    const colCount = table.rows[0].cells.length;
    const newRow = table.insertRow(-1);
    for (let i = 0; i < colCount; i++) {
        const cell = i === 0 ? document.createElement("th") : newRow.insertCell(-1);
        if (i === 0) newRow.appendChild(cell);
        const input = document.createElement("input");
        input.type = "text";
        input.style.cssText = "width: 95%; background: rgba(255,255,255,0.1); border: 1px solid #3b82f6; color: white; text-align: center;";
        cell.appendChild(input);
        if (i === 0) {
            cell.style.cssText = "background: #00a2e8; color: white; padding: 15px; border: 1px solid rgba(255,255,255,1); font-weight: bold; text-align: center;";
        } else {
            cell.style.cssText = "padding: 15px; background: #898989; border: 1px solid rgba(255,255,255,1); color: #e5e7eb; text-align: center;";
        }
    }
}

function addColumnToCurrentPlan() {
    const table = document.getElementById("CurrentPlanTable");
    if (!table || !table.rows.length) return;

    Array.from(table.rows).forEach((row, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        const input = document.createElement("input");
        input.type = "text";
        input.style.cssText = "width: 95%; background: rgba(255,255,255,0.1); border: 1px solid #3b82f6; color: white; text-align: center;";
        cell.appendChild(input);
        row.appendChild(cell);

        if (index === 0) {
            cell.style.cssText = "background: #00a2e8; color: white; padding: 18px; border: 1px solid rgba(255,255,255,1);";
        } else {
            cell.style.cssText = "padding: 15px; background: #898989; border: 1px solid rgba(255,255,255,1); color: #e5e7eb; text-align: center;";
        }
    });
}

function deleteRowFromCurrentPlan() {
    const table = document.getElementById("CurrentPlanTable");
    if (table && table.rows.length > 1) table.deleteRow(-1);
}

function deleteColumnFromCurrentPlan() {
    const table = document.getElementById("CurrentPlanTable");
    if (!table || !table.rows.length || table.rows[0].cells.length <= 1) return;
    Array.from(table.rows).forEach(row => row.deleteCell(-1));
}

window.saveCurrentViewedPlan = async function (oldName) {
    const noteData = getNotebookDataFromSurface(findCurrentPlanSurface());
    if (noteData) {
        const newName = getSavedNoteName(noteData, oldName);
        if (!newName || newName === "Enter workout name here") {
            alert("Please enter a valid name for the note before saving.");
            return;
        }

        const selections = await getUserSelectionsData();
        const plans = selections?.gym_plans || {};
        if (newName !== oldName && plans[newName]) {
            alert(`Error: You already have a table named "${newName}". Please choose a different name.`);
            return;
        }

        showPlannerSaveStart();
        if (newName !== oldName) delete plans[oldName];
        plans[newName] = noteData;
        plans[newName].title = newName;
        const saveStatus = await updateCurrentUserSelections({ gym_plans: plans });

        const currentPlanControls = document.getElementById("currentPlanControls");
        if (currentPlanControls) currentPlanControls.style.display = "none";
        setNotebookButtonVisible(false);
        showPlannerSaveComplete(saveStatus);

        const viewer = document.getElementById("planViewer");
        if (viewer) {
            viewer.style.opacity = "0";
            setTimeout(() => {
                viewer.innerHTML = "";
                viewer.style.opacity = "1";
                if (typeof displaySavedPlansInPage === "function") {
                    displaySavedPlansInPage();
                }
            }, 400);
        }
        return;
    }

    const table = document.getElementById("CurrentPlanTable");
    if (!table) return;

    const data = [];
    let newName = oldName;

    table.querySelectorAll("tr").forEach((row, rowIndex) => {
        const rowData = [];
        row.querySelectorAll("td, th").forEach((cell, cellIndex) => {
            const input = cell.querySelector("input, textarea");
            const value = input ? input.value.trim() : cell.textContent.trim();

            if (rowIndex === 0 && cellIndex === 0 && value !== "") {
                newName = value;
            }
            rowData.push(value);
        });
        data.push(rowData);
    });

    const selections = await getUserSelectionsData();
    const plans = selections?.gym_plans || {};

    if (newName !== oldName && plans[newName]) {
        alert(`Error: You already have a table named "${newName}". Please choose a different name.`);
        return;
    }
    showPlannerSaveStart();

    if (newName !== oldName) {
        delete plans[oldName];
    }

    plans[newName] = data;
    const saveStatus = await updateCurrentUserSelections({ gym_plans: plans });

    const currentPlanControls = document.getElementById("currentPlanControls");
    if (currentPlanControls) currentPlanControls.style.display = "none";
    setNotebookButtonVisible(false);

    showPlannerSaveComplete(saveStatus);

    const viewer = document.getElementById("planViewer");
    if (viewer) {
        viewer.style.opacity = "0";
        setTimeout(() => {
            viewer.innerHTML = "";
            viewer.style.opacity = "1";
            if (typeof displaySavedPlansInPage === "function") {
                displaySavedPlansInPage();
            }
        }, 400);
    }
};

async function deleteSpecificPlan(name) {
    if (!(await window.gymratConfirm(`Are you sure you want to delete "${name}"?`))) return;
    showPlannerSaveStart();
    const selections = await getUserSelectionsData();
    const plans = selections?.gym_plans || {};
    delete plans[name];
    const saveStatus = await updateCurrentUserSelections({ gym_plans: plans });

    displaySavedPlansInPage();
    const viewer = document.getElementById("planViewer");
    if (viewer) viewer.innerHTML = "";
    showPlannerSaveComplete(saveStatus);
}

window.editCurrentViewedPlan = async function () {
    if (!(await window.gymratConfirm("Are you sure you want to edit this plan?"))) return;

    const noteEditor = findCurrentPlanSurface()?.querySelector(".planner-note-editor");
    if (noteEditor) {
        const currentPlanControls = document.getElementById("currentPlanControls");
        if (currentPlanControls) currentPlanControls.style.display = "none";
        noteEditor.classList.remove("planner-note-editor-readonly");
        noteEditor.querySelectorAll(".planner-note-title, .planner-note-body").forEach(field => {
            field.readOnly = false;
        });
        setNotebookButtonVisible(true);
        noteEditor.querySelector(".planner-note-body")?.focus();
        return;
    }

    const table = document.getElementById("CurrentPlanTable");
    if (!table) return;

    createCurrentPlanControls();
    setNotebookButtonVisible(true);
    makeTableEditable(table);
};

// ==========================================
// FINALIZING THE PLANNER SAVE
// ==========================================

window.savePlanner = async function () {
    const noteData = getNotebookDataFromSurface(findPlannerSurface());
    if (noteData) {
        const noteName = getSavedNoteName(noteData);
        if (!noteName || noteName === "Enter workout name here") {
            alert("Please enter a valid name for the note before saving.");
            return;
        }

        const selections = await getUserSelectionsData();
        const plans = selections?.gym_plans || {};
        if (plans[noteName]) {
            alert(`Error: A plan named "${noteName}" already exists.`);
            return;
        }

        showPlannerSaveStart();
        plans[noteName] = noteData;
        plans[noteName].title = noteName;
        const plannerSaveStatus = await updateCurrentUserSelections({ planner: null });
        const plansSaveStatus = await updateCurrentUserSelections({ gym_plans: plans });

        resetPlannerTable();
        showPlannerSaveComplete(plannerSaveStatus === "local" || plansSaveStatus === "local" ? "local" : plansSaveStatus);
        await window.gymratAlert("Saved successfully.");
        return;
    }

    const table = getPlannerTable();
    if (!table) return;

    const nameCell = document.getElementById("tableNameCell");
    if (!nameCell) return alert("Error: Name cell not found");

    const nameInput = nameCell.querySelector("input");
    const tableName = nameInput ? nameInput.value.trim() : nameCell.innerText.trim();

    if (!tableName || tableName === "" || tableName === "Name: Example gym leg day" || tableName === "Enter workout name here") {
        alert("Please enter a valid name for the table before saving.");
        return;
    }

    const selections = await getUserSelectionsData();
    const plans = selections?.gym_plans || {};

    if (plans[tableName]) {
        alert(`Error: A plan named "${tableName}" already exists.`);
        return;
    }
    showPlannerSaveStart();

    const tableData = [];
    table.querySelectorAll("tr").forEach(row => {
        const rowData = [];
        row.querySelectorAll("td, th").forEach(cell => {
            const input = cell.querySelector("input, textarea");
            rowData.push(input ? input.value.trim() : cell.textContent.trim());
        });
        tableData.push(rowData);
    });

    const plannerSaveStatus = await updateCurrentUserSelections({ planner: null });

    plans[tableName] = tableData;
    const plansSaveStatus = await updateCurrentUserSelections({ gym_plans: plans });

    resetPlannerTable();
    showPlannerSaveComplete(plannerSaveStatus === "local" || plansSaveStatus === "local" ? "local" : plansSaveStatus);
    await window.gymratAlert("Saved successfully.");
};

function resetPlannerTable() {
    const surface = findPlannerSurface();
    if (!surface) return;

    if (!getPlannerTable()) setSurfaceToPlannerTable(surface, "GymWorkoutPlanner");
    renderRowsIntoTable(getPlannerTable(), getDefaultPlannerRows());

    plannerEditMode = false;
    setNotebookButtonVisible(pageKey === "planner");
    const container = document.getElementById("plannerControls");
    if (container) {
        container.innerHTML = "";
        container.style.display = "none";
    }
}

async function loadPlanner() {
    const currentUser = getCurrentUser();
    const selections = await getUserSelectionsData();

    if (!currentUser || !selections?.planner) {
        setNotebookButtonVisible(pageKey === "planner");
        return;
    }

    const data = selections.planner;
    const surface = findPlannerSurface();
    if (isNotePlanData(data)) {
        await updateCurrentUserSelections({ planner: null });
        resetPlannerTable();
        return;
    }

    if (!getPlannerTable()) setSurfaceToPlannerTable(surface, "GymWorkoutPlanner");
    renderRowsIntoTable(getPlannerTable(), data);
    setNotebookButtonVisible(pageKey === "planner");
}

function deleteLastRow() {
    const table = getPlannerTable();
    if (table && table.rows.length > 1) table.deleteRow(-1);
}

async function checkUrlAndOpenPlan() {
    const urlParams = new URLSearchParams(window.location.search);
    const planNameFromUrl = urlParams.get("plan");

    if (planNameFromUrl) {
        const selections = await getUserSelectionsData();
        const plans = selections?.gym_plans || {};
        const decodedName = decodeURIComponent(planNameFromUrl);

        if (plans[decodedName]) {
            setTimeout(() => {
                renderPlanTable(decodedName, plans[decodedName], plans);
                const viewer = document.getElementById("planViewer");
                if (viewer) viewer.scrollIntoView({ behavior: "smooth" });
            }, 200);
        }
    }
}



























