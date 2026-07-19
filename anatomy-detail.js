document.addEventListener("DOMContentLoaded", () => {
    const user = localStorage.getItem("currentUser");
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const detail = window.GYMRAT_ANATOMY_DETAIL;
    if (!detail || !Array.isArray(detail.groups) || detail.groups.length === 0) return;

    const tabs = document.getElementById("anatomyTabs");
    const grid = document.getElementById("muscleGrid");
    const visualPanel = document.querySelector(".anatomy-visual-panel");
    const selectedGroupName = document.getElementById("selectedGroupName");
    const selectedGroupText = document.getElementById("selectedGroupText");
    const originalPanelImage = visualPanel ? visualPanel.querySelector("img") : null;
    const regularImage = detail.regularImage || (originalPanelImage ? originalPanelImage.getAttribute("src") : "") || detail.image || "Pictures/Logos/Img_no_star.webp";
    const image = detail.image || regularImage;
    let fullscreenViewer;

    function translateAnatomyText(value) {
        return typeof window.gymratTranslateText === "function" ? window.gymratTranslateText(value) : `${value || ""}`;
    }

    function closeFullscreenImage() {
        if (!fullscreenViewer) return;
        fullscreenViewer.classList.remove("is-open");
        document.body.classList.remove("anatomy-lightbox-open");
    }

    function openFullscreenImage(src, alt) {
        if (!fullscreenViewer) {
            fullscreenViewer = document.createElement("div");
            fullscreenViewer.className = "anatomy-image-lightbox";
            fullscreenViewer.setAttribute("role", "dialog");
            fullscreenViewer.setAttribute("aria-modal", "true");
            fullscreenViewer.innerHTML = `
                <button class="anatomy-lightbox-back" type="button">${translateAnatomyText("Back to anatomy")}</button>
                <img src="" alt="">
            `;
            document.body.appendChild(fullscreenViewer);
            fullscreenViewer.querySelector(".anatomy-lightbox-back").addEventListener("click", closeFullscreenImage);
            fullscreenViewer.addEventListener("click", event => {
                if (event.target === fullscreenViewer) closeFullscreenImage();
            });
        }

        const fullImage = fullscreenViewer.querySelector("img");
        fullImage.src = src;
        fullImage.alt = alt;
        fullscreenViewer.classList.add("is-open");
        document.body.classList.add("anatomy-lightbox-open");
        fullscreenViewer.querySelector(".anatomy-lightbox-back").focus();
    }

    function getGroupImage(group) {
        if (group && group.image) return group.image;
        const firstMuscleWithImage = (group.muscles || []).find(muscle => typeof muscle !== "string" && muscle.image);
        if (firstMuscleWithImage) return firstMuscleWithImage.image;
        return image;
    }

    function renderGroupVisual(group) {
        if (!visualPanel) return;
        const groupName = translateAnatomyText(group.name || "Muscles");
        const groupImage = getGroupImage(group);
        visualPanel.innerHTML = `
            <div class="anatomy-visual-images">
                <button class="anatomy-visual-figure" type="button" data-image="${groupImage}" data-name="${groupName} ${translateAnatomyText("anatomy image")}">
                    <img src="${groupImage}" alt="${groupName} ${translateAnatomyText("anatomy image")}">
                </button>
            </div>
            <div class="anatomy-visual-caption"><strong id="selectedGroupName">${groupName}</strong><span id="selectedGroupText">${translateAnatomyText("Choose a muscle and press Read more when you are ready to fill in the function.")}</span></div>
        `;
    }

    function renderTabs() {
        tabs.innerHTML = "";
        detail.groups.forEach((group, index) => {
            const button = document.createElement("button");
            button.className = `anatomy-tab${index === 0 ? " is-active" : ""}`;
            button.type = "button";
            button.innerHTML = `<span>${translateAnatomyText(group.name || `Group ${index + 1}`)}</span>`;
            button.dataset.index = `${index}`;
            tabs.appendChild(button);
        });
    }

    function renderGroup(index) {
        const group = detail.groups[index] || detail.groups[0];
        if (selectedGroupName) selectedGroupName.textContent = translateAnatomyText(group.name || "Muscles");
        if (selectedGroupText) selectedGroupText.textContent = translateAnatomyText("Choose a muscle and press Read more when you are ready to fill in the function.");
        renderGroupVisual(group);
        grid.innerHTML = "";

        (group.muscles || []).forEach(muscle => {
            const muscleName = translateAnatomyText(typeof muscle === "string" ? muscle : muscle.name);
            const muscleImage = typeof muscle === "string" ? getGroupImage(group) : (muscle.image || getGroupImage(group));
            const muscleColor = typeof muscle === "string" ? "" : (muscle.color || "");
            const muscleFunction = translateAnatomyText(typeof muscle === "string" ? "In here will be the function of the muscle." : (muscle.function || "In here will be the function of the muscle."));
            const colorDot = muscleColor ? `<span class="anatomy-muscle-color" style="--muscle-color: ${muscleColor};"></span>` : "";
            const card = document.createElement("article");
            card.className = "anatomy-muscle-card";
            card.innerHTML = `
                <div class="anatomy-muscle-summary">
                    <button class="anatomy-image-open" type="button" data-image="${muscleImage}" data-name="${muscleName}">
                        <img src="${muscleImage}" alt="${muscleName}">
                    </button>
                    <button class="anatomy-muscle-name" type="button" data-image="${muscleImage}" data-name="${muscleName}">
                        ${colorDot}<strong>${muscleName}</strong>
                    </button>
                    <button class="anatomy-read-more" type="button" aria-expanded="false">${translateAnatomyText("Read more")}</button>
                </div>
                <div class="anatomy-muscle-details">
                    <p>${muscleFunction}</p>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    tabs.addEventListener("click", event => {
        const tab = event.target.closest(".anatomy-tab");
        if (!tab) return;
        Array.from(tabs.children).forEach(item => item.classList.remove("is-active"));
        tab.classList.add("is-active");
        renderGroup(Number(tab.dataset.index));
    });

    if (visualPanel) {
        visualPanel.addEventListener("click", event => {
            const imageTarget = event.target.closest(".anatomy-visual-figure");
            if (!imageTarget) return;
            event.preventDefault();
            openFullscreenImage(imageTarget.dataset.image, imageTarget.dataset.name);
        });
    }

    grid.addEventListener("click", event => {
        const imageTarget = event.target.closest(".anatomy-image-open, .anatomy-muscle-name");
        if (imageTarget) {
            event.preventDefault();
            openFullscreenImage(imageTarget.dataset.image, imageTarget.dataset.name);
            return;
        }

        const button = event.target.closest(".anatomy-read-more");
        if (!button) return;
        const details = button.closest(".anatomy-muscle-summary").nextElementSibling;
        const isOpen = details.classList.toggle("is-open");
        button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeFullscreenImage();
    });

    renderTabs();
    renderGroup(0);

    window.addEventListener("gymrat-language-change", () => {
        const activeIndex = Number(tabs.querySelector(".anatomy-tab.is-active")?.dataset.index || 0);
        renderTabs();
        renderGroup(activeIndex);
        const activeTab = tabs.querySelector(`[data-index="${activeIndex}"]`);
        if (activeTab) activeTab.classList.add("is-active");
    });
});


