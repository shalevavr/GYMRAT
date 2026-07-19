(function () {
    function getMenuModal() {
        return document.getElementById("siteMenuModal");
    }

    function getMenuButton() {
        return document.querySelector("[data-site-menu-button]");
    }

    function syncMobileFooterActive() {
        const page = (window.location.pathname.split("/").pop() || "MainPage.html").toLowerCase();
        const activeByPage = new Map([
            ["mainpage.html", "Home"],
            ["diet.html", "Diet"],
            ["dietsetup.html", "Diet"],
            ["workoutplanmainpage.html", "Workout plan"],
            ["weightstrackingmenu.html", "Progressive overload"],
            ["anatomy.html", "Anatomy"]
        ]);
        const activeLabel = activeByPage.get(page);
        if (!activeLabel) return;
        document.querySelectorAll(".main-mobile-footer-item").forEach(item => {
            const label = item.getAttribute("aria-label") || item.getAttribute("title") || "";
            item.classList.toggle("is-active", label.toLowerCase() === activeLabel.toLowerCase());
        });
    }
    function syncMenuUser() {
        const user = localStorage.getItem("currentUser") || "User";
        document.querySelectorAll("[data-site-menu-user], [data-site-sidebar-user]").forEach(element => {
            element.textContent = user;
            element.title = user;
        });
    }

    function syncMenuState(isOpen) {
        document.body.classList.toggle("site-menu-open", isOpen);
        const button = getMenuButton();
        if (button) {
            button.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }
    }

    function openShalevMenu() {
        const modal = getMenuModal();
        if (!modal) {
            return;
        }
        syncMenuUser();
        modal.hidden = false;
        syncMenuState(true);
        const closeButton = modal.querySelector(".site-menu-close");
        if (closeButton) {
            closeButton.focus({ preventScroll: true });
        }
    }

    function closeShalevMenu() {
        const modal = getMenuModal();
        if (!modal) {
            return;
        }
        modal.hidden = true;
        syncMenuState(false);
        const button = getMenuButton();
        if (button) {
            button.focus({ preventScroll: true });
        }
    }


    async function openDietApp(event) {
        if (event) {
            event.preventDefault();
        }
        const user = localStorage.getItem("currentUser") || "";
        const localProfileKey = `gymrat:diet:profile:${user || "guest"}`;
        const openSetup = () => { window.location.href = "DietSetup.html"; };
        const openTracker = () => { window.location.href = "Diet.html"; };
        try {
            const localProfile = JSON.parse(localStorage.getItem(localProfileKey) || "null");
            if (localProfile?.isComplete) {
                openTracker();
                return;
            }
        } catch (error) {
            // Keep checking cloud data below.
        }
        if (user && typeof getUserSelections === "function") {
            try {
                const selections = await getUserSelections(user);
                if (selections?.diet?.profile?.isComplete) {
                    try { localStorage.setItem(localProfileKey, JSON.stringify(selections.diet.profile)); } catch (error) {}
                    openTracker();
                    return;
                }
            } catch (error) {
                // Fall through to setup when cloud state cannot be checked.
            }
        }
        openSetup();
    }
    function toggleShalevMenu() {
        const modal = getMenuModal();
        if (!modal) {
            return;
        }
        if (modal.hidden) {
            openShalevMenu();
        } else {
            closeShalevMenu();
        }
    }

    window.openShalevMenu = openShalevMenu;
    window.closeShalevMenu = closeShalevMenu;
    window.toggleShalevMenu = toggleShalevMenu;
    window.openDietApp = openDietApp;

    syncMenuUser();
    syncMobileFooterActive();

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeShalevMenu();
        }
    });

    document.addEventListener("click", event => {
        const button = event.target.closest("[data-site-menu-button]");
        if (button) {
            event.preventDefault();
            openShalevMenu();
            return;
        }

        const modal = getMenuModal();
        if (!modal || modal.hidden) {
            return;
        }
        if (event.target === modal) {
            closeShalevMenu();
        }
    });
})();



