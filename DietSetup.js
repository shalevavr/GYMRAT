(function () {
    const PROFILE_DRAFT_PREFIX = "gymrat:diet:profile:";
    const DEFAULT_PROFILE = {
        isComplete: false,
        weightKg: 0,
        heightCm: 0,
        bodyFatPercent: 0,
        activityLevel: "",
        goal: "",
        calorieGoal: 0,
        calorieGoalMin: 0,
        calorieGoalMax: 0,
        proteinGoal: 0,
        proteinGoalMin: 0,
        proteinGoalMax: 0,
        carbGoal: 0,
        carbGoalMin: 0,
        carbGoalMax: 0,
        fatGoal: 0,
        fatGoalMin: 0,
        fatGoalMax: 0,
        recommendation: null,
        updatedAt: null
    };
    const ACTIVITY_RULES = {
        inactive: { label: "Inactive / inconsistent", multiplier: 1.2, carbMin: 3, carbMax: 5 },
        consistent: { label: "Consistent", multiplier: 1.4, carbMin: 5, carbMax: 7 },
        "very-active": { label: "Very active", multiplier: 1.65, carbMin: 6, carbMax: 10 },
        "ultra-endurance": { label: "Ultra endurance athlete", multiplier: 1.9, carbMin: 8, carbMax: 12 }
    };
    const GOAL_RULES = {
        "gain-muscle": { label: "Gain muscle", surplusMin: 200, surplusMax: 400 },
        "lose-fat": { label: "Lose fat", deficitMin: 200, deficitMax: 500 },
        recomp: { label: "Gain muscle + lose fat", deficitMin: 200, deficitMax: 400 },
        maintain: { label: "Maintain", offsetMin: -100, offsetMax: 100 }
    };

    let user = "";
    let currentDiet = null;
    let latestRecommendation = null;
    const el = {};

    function translateSetupText(value) {
        let text = typeof window.gymratTranslateText === "function" ? window.gymratTranslateText(value) : String(value || "");
        if ((typeof window.gymratGetLanguage === "function" ? window.gymratGetLanguage() : "en") === "he") {
            text = text.replace(/\bkcal\b/gi, "קלוריות").replace(/(\d)\s*g\b/gi, "$1 גרם");
        }
        return text;
    }

    function normalizeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : 0;
    }

    function round(value) {
        return Math.round(Number(value) || 0);
    }

    function normalizeRange(minValue, maxValue) {
        const min = normalizeNumber(minValue);
        const max = normalizeNumber(maxValue);
        if (!min && !max) return { min: 0, max: 0 };
        if (!min) return { min: max, max };
        if (!max) return { min, max: min };
        return min <= max ? { min, max } : { min: max, max: min };
    }

    function oneDecimal(value) {
        return Math.round((Number(value) || 0) * 10) / 10;
    }

    function getProfileDraftKey() {
        return `${PROFILE_DRAFT_PREFIX}${user || "guest"}`;
    }

    function normalizeProfile(value) {
        const source = value && typeof value === "object" ? value : {};
        const activityLevel = ACTIVITY_RULES[source.activityLevel] ? source.activityLevel : "";
        const goal = GOAL_RULES[source.goal] ? source.goal : "";
        return {
            ...DEFAULT_PROFILE,
            ...source,
            weightKg: normalizeNumber(source.weightKg),
            heightCm: normalizeNumber(source.heightCm),
            bodyFatPercent: normalizeNumber(source.bodyFatPercent),
            activityLevel,
            goal,
            calorieGoal: normalizeNumber(source.calorieGoalMax || source.calorieGoal),
            calorieGoalMin: normalizeNumber(source.calorieGoalMin || source.calorieGoal),
            calorieGoalMax: normalizeNumber(source.calorieGoalMax || source.calorieGoal),
            proteinGoal: normalizeNumber(source.proteinGoalMax || source.proteinGoal),
            proteinGoalMin: normalizeNumber(source.proteinGoalMin || source.proteinGoal),
            proteinGoalMax: normalizeNumber(source.proteinGoalMax || source.proteinGoal),
            carbGoal: normalizeNumber(source.carbGoalMax || source.carbGoal),
            carbGoalMin: normalizeNumber(source.carbGoalMin || source.carbGoal),
            carbGoalMax: normalizeNumber(source.carbGoalMax || source.carbGoal),
            fatGoal: normalizeNumber(source.fatGoalMax || source.fatGoal),
            fatGoalMin: normalizeNumber(source.fatGoalMin || source.fatGoal),
            fatGoalMax: normalizeNumber(source.fatGoalMax || source.fatGoal),
            isComplete: !!source.isComplete
        };
    }

    function setStatus(text) {
        if (el.status) el.status.textContent = translateSetupText(text || "");
    }

    function formatRange(min, max, unit) {
        return min === max ? `${min}${unit}` : `${min} - ${max}${unit}`;
    }

    function calculateRecommendation() {
        const weight = normalizeNumber(el.weight.value);
        const height = normalizeNumber(el.height.value);
        const bodyFat = normalizeNumber(el.bodyFat.value);
        const activity = ACTIVITY_RULES[el.activity.value];
        const goal = GOAL_RULES[el.goal.value];
        if (!weight || !height || !bodyFat || !activity || !goal) {
            setStatus("Fill weight, height, body fat, activity, and goal first");
            return null;
        }

        const bodyFatDecimal = Math.min(bodyFat, 95) / 100;
        const leanMass = weight * (1 - bodyFatDecimal);
        const bmr = (leanMass * 21.6) + 370;
        const tdee = bmr * activity.multiplier;
        const heightMeters = height / 100;
        const bmi = weight / (heightMeters * heightMeters);
        const proteinMinRatio = bodyFat >= 31 ? 1.2 : 1.6;
        const proteinMaxRatio = bodyFat >= 31 ? 1.6 : 2.2;
        const proteinMin = round(weight * proteinMinRatio);
        const proteinMax = round(weight * proteinMaxRatio);
        const carbsMin = round(weight * activity.carbMin);
        const carbsMax = round(weight * activity.carbMax);
        const fatMin = round(weight * 1);
        const fatMax = round(weight * 3);
        let calorieMin;
        let calorieMax;
        if (goal.surplusMin || goal.surplusMax) {
            calorieMin = round(tdee + goal.surplusMin);
            calorieMax = round(tdee + goal.surplusMax);
        } else if (goal.deficitMin || goal.deficitMax) {
            calorieMin = round(tdee - goal.deficitMax);
            calorieMax = round(tdee - goal.deficitMin);
        } else {
            calorieMin = round(tdee + goal.offsetMin);
            calorieMax = round(tdee + goal.offsetMax);
        }

        return {
            activityLevel: el.activity.value,
            activityLabel: activity.label,
            goal: el.goal.value,
            goalLabel: goal.label,
            leanMassKg: oneDecimal(leanMass),
            bmr: round(bmr),
            tdee: round(tdee),
            bmi: oneDecimal(bmi),
            calorieMin,
            calorieMax,
            proteinMin,
            proteinMax,
            carbsMin,
            carbsMax,
            fatMin,
            fatMax,
            proteinRatioMin: proteinMinRatio,
            proteinRatioMax: proteinMaxRatio,
            carbRatioMin: activity.carbMin,
            carbRatioMax: activity.carbMax,
            fatRatioMin: 1,
            fatRatioMax: 3,
            updatedAt: new Date().toISOString()
        };
    }

    function displayRecommendation(recommendation) {
        if (!recommendation) return;
        latestRecommendation = recommendation;
        el.tdeeDisplay.textContent = `${recommendation.tdee.toLocaleString()} kcal`;
        el.leanMassDisplay.textContent = recommendation.leanMassKg;
        el.ffmiDisplay.textContent = recommendation.bmi ?? recommendation.ffmi ?? "-";
        const calorieText = formatRange(recommendation.calorieMin, recommendation.calorieMax, " kcal");
        const proteinText = formatRange(recommendation.proteinMin, recommendation.proteinMax, "g");
        const carbText = formatRange(recommendation.carbsMin, recommendation.carbsMax, "g");
        const fatText = formatRange(recommendation.fatMin, recommendation.fatMax, "g");
        el.calorieRange.textContent = translateSetupText(`Recommended ${calorieText}`);
        el.proteinRange.textContent = translateSetupText(`Recommended ${proteinText}`);
        el.carbRange.textContent = translateSetupText(`Recommended ${carbText}`);
        el.fatRange.textContent = translateSetupText(`Recommended ${fatText}`);
        setRangePlaceholders(recommendation);
        setStatus("Recommendations calculated. Apply them or enter your own ranges before saving.");
    }

    function setRangePlaceholders(recommendation) {
        el.caloriesMin.placeholder = `${recommendation.calorieMin}`;
        el.caloriesMax.placeholder = `${recommendation.calorieMax}`;
        el.proteinMin.placeholder = `${recommendation.proteinMin}`;
        el.proteinMax.placeholder = `${recommendation.proteinMax}`;
        el.carbsMin.placeholder = `${recommendation.carbsMin}`;
        el.carbsMax.placeholder = `${recommendation.carbsMax}`;
        el.fatMin.placeholder = `${recommendation.fatMin}`;
        el.fatMax.placeholder = `${recommendation.fatMax}`;
    }

    function applyRecommendation() {
        const recommendation = latestRecommendation || calculateRecommendation();
        if (!recommendation) return;
        displayRecommendation(recommendation);
        el.caloriesMin.value = recommendation.calorieMin;
        el.caloriesMax.value = recommendation.calorieMax;
        el.proteinMin.value = recommendation.proteinMin;
        el.proteinMax.value = recommendation.proteinMax;
        el.carbsMin.value = recommendation.carbsMin;
        el.carbsMax.value = recommendation.carbsMax;
        el.fatMin.value = recommendation.fatMin;
        el.fatMax.value = recommendation.fatMax;
        setStatus("Recommended ranges applied. You can save or edit them manually.");
    }
    function profileFromInputs() {
        return normalizeProfile({
            isComplete: true,
            weightKg: el.weight.value,
            heightCm: el.height.value,
            bodyFatPercent: el.bodyFat.value,
            activityLevel: el.activity.value,
            goal: el.goal.value,
            calorieGoal: normalizeRange(el.caloriesMin.value, el.caloriesMax.value).max,
            calorieGoalMin: normalizeRange(el.caloriesMin.value, el.caloriesMax.value).min,
            calorieGoalMax: normalizeRange(el.caloriesMin.value, el.caloriesMax.value).max,
            proteinGoal: normalizeRange(el.proteinMin.value, el.proteinMax.value).max,
            proteinGoalMin: normalizeRange(el.proteinMin.value, el.proteinMax.value).min,
            proteinGoalMax: normalizeRange(el.proteinMin.value, el.proteinMax.value).max,
            carbGoal: normalizeRange(el.carbsMin.value, el.carbsMax.value).max,
            carbGoalMin: normalizeRange(el.carbsMin.value, el.carbsMax.value).min,
            carbGoalMax: normalizeRange(el.carbsMin.value, el.carbsMax.value).max,
            fatGoal: normalizeRange(el.fatMin.value, el.fatMax.value).max,
            fatGoalMin: normalizeRange(el.fatMin.value, el.fatMax.value).min,
            fatGoalMax: normalizeRange(el.fatMin.value, el.fatMax.value).max,
            recommendation: latestRecommendation || calculateRecommendation(),
            updatedAt: new Date().toISOString()
        });
    }

    function fillInputs(profile) {
        const normalized = normalizeProfile(profile);
        el.weight.value = normalized.weightKg || "";
        el.height.value = normalized.heightCm || "";
        el.bodyFat.value = normalized.bodyFatPercent || "";
        el.activity.value = normalized.activityLevel || "";
        el.goal.value = normalized.goal || "";
        el.caloriesMin.value = normalized.calorieGoalMin || "";
        el.caloriesMax.value = normalized.calorieGoalMax || "";
        el.proteinMin.value = normalized.proteinGoalMin || "";
        el.proteinMax.value = normalized.proteinGoalMax || "";
        el.carbsMin.value = normalized.carbGoalMin || "";
        el.carbsMax.value = normalized.carbGoalMax || "";
        el.fatMin.value = normalized.fatGoalMin || "";
        el.fatMax.value = normalized.fatGoalMax || "";
        if (normalized.recommendation) displayRecommendation(normalized.recommendation);
    }

    function saveLocalProfile(profile) {
        try {
            localStorage.setItem(getProfileDraftKey(), JSON.stringify(profile));
        } catch (error) {
            // Account save still runs when available.
        }
    }

    function saveLocalDietDraft(diet) {
        try {
            localStorage.setItem(`gymrat:diet:draft:${user || "guest"}`, JSON.stringify(diet));
        } catch (error) {
            // Account save still runs when available.
        }
    }

    async function saveProfile(profile) {
        saveLocalProfile(profile);
        const diet = {
            ...(currentDiet || {}),
            calorieTarget: profile.calorieGoalMax,
            calorieTargetMin: profile.calorieGoalMin,
            calorieTargetMax: profile.calorieGoalMax,
            macroTargets: {
                protein: profile.proteinGoalMax,
                proteinMin: profile.proteinGoalMin,
                proteinMax: profile.proteinGoalMax,
                carbs: profile.carbGoalMax,
                carbsMin: profile.carbGoalMin,
                carbsMax: profile.carbGoalMax,
                fat: profile.fatGoalMax,
                fatMin: profile.fatGoalMin,
                fatMax: profile.fatGoalMax
            },
            profile
        };
        saveLocalDietDraft(diet);
        if (typeof saveUserSelections === "function") {
            const result = await saveUserSelections(user, { diet });
            setStatus(result === "cloud" ? "Saved to account" : "Saved on this device");
        } else {
            setStatus("Saved on this device");
        }
    }

    async function loadSetup() {
        user = localStorage.getItem("currentUser") || "";
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        let profile = null;
        const localDraft = localStorage.getItem(getProfileDraftKey());
        if (localDraft) {
            try { profile = normalizeProfile(JSON.parse(localDraft)); } catch (error) { profile = null; }
        }

        if (typeof getUserSelections === "function") {
            try {
                const selections = await getUserSelections(user);
                currentDiet = selections?.diet || null;
                profile = normalizeProfile(selections?.diet?.profile || profile);
            } catch (error) {
                setStatus("Using saved device data");
            }
        }

        if (profile?.isComplete && !new URLSearchParams(window.location.search).has("edit")) {
            window.location.href = "Diet.html";
            return;
        }
        fillInputs(profile || DEFAULT_PROFILE);
    }

    function confirmDietSetupReset() {
        return new Promise(resolve => {
            if (!el.resetConfirmModal || !el.resetConfirmYes || !el.resetConfirmNo) {
                resolve(confirm(translateSetupText("Are you sure you want to reset your diet setup?")));
                return;
            }
            const close = value => {
                el.resetConfirmModal.hidden = true;
                el.resetConfirmYes.removeEventListener("click", onYes);
                el.resetConfirmNo.removeEventListener("click", onNo);
                el.resetConfirmModal.removeEventListener("click", onBackdrop);
                document.removeEventListener("keydown", onKeydown);
                resolve(value);
            };
            const onYes = () => close(true);
            const onNo = () => close(false);
            const onBackdrop = event => { if (event.target === el.resetConfirmModal) close(false); };
            const onKeydown = event => {
                if (event.key === "Escape") close(false);
                if (event.key === "Enter") close(true);
            };
            el.resetConfirmModal.hidden = false;
            el.resetConfirmYes.addEventListener("click", onYes);
            el.resetConfirmNo.addEventListener("click", onNo);
            el.resetConfirmModal.addEventListener("click", onBackdrop);
            document.addEventListener("keydown", onKeydown);
            el.resetConfirmNo.focus({ preventScroll: true });
        });
    }
    function bindElements() {
        el.form = document.getElementById("dietSetupForm");
        el.weight = document.getElementById("setupWeight");
        el.height = document.getElementById("setupHeight");
        el.bodyFat = document.getElementById("setupBodyFat");
        el.activity = document.getElementById("setupActivity");
        el.goal = document.getElementById("setupGoal");
        el.caloriesMin = document.getElementById("setupCaloriesMin");
        el.caloriesMax = document.getElementById("setupCaloriesMax");
        el.proteinMin = document.getElementById("setupProteinMin");
        el.proteinMax = document.getElementById("setupProteinMax");
        el.carbsMin = document.getElementById("setupCarbsMin");
        el.carbsMax = document.getElementById("setupCarbsMax");
        el.fatMin = document.getElementById("setupFatMin");
        el.fatMax = document.getElementById("setupFatMax");
        el.status = document.getElementById("dietSetupStatus");
        el.tdeeDisplay = document.getElementById("setupTdeeDisplay");
        el.leanMassDisplay = document.getElementById("setupLeanMassDisplay");
        el.ffmiDisplay = document.getElementById("setupFfmiDisplay");
        el.calorieRange = document.getElementById("calorieRangeText");
        el.proteinRange = document.getElementById("proteinRangeText");
        el.carbRange = document.getElementById("carbRangeText");
        el.fatRange = document.getElementById("fatRangeText");
        el.bodyfatPanel = document.getElementById("bodyfatReferencePanel");
        el.openBodyfatGuide = document.getElementById("openBodyfatGuideButton");
        el.closeBodyfatGuide = document.getElementById("closeBodyfatGuideButton");
        el.resetConfirmModal = document.getElementById("dietResetConfirmModal");
        el.resetConfirmYes = document.getElementById("confirmDietResetYes");
        el.resetConfirmNo = document.getElementById("confirmDietResetNo");

        if (el.openBodyfatGuide && el.bodyfatPanel) {
            el.openBodyfatGuide.addEventListener("click", () => {
                el.bodyfatPanel.hidden = false;
                document.body.classList.add("diet-bodyfat-guide-open");
                el.closeBodyfatGuide?.focus({ preventScroll: true });
            });
        }
        if (el.closeBodyfatGuide && el.bodyfatPanel) {
            el.closeBodyfatGuide.addEventListener("click", () => {
                el.bodyfatPanel.hidden = true;
                document.body.classList.remove("diet-bodyfat-guide-open");
            });
        }
        if (el.bodyfatPanel) {
            el.bodyfatPanel.addEventListener("click", event => {
                if (event.target === el.bodyfatPanel) {
                    el.bodyfatPanel.hidden = true;
                    document.body.classList.remove("diet-bodyfat-guide-open");
                }
            });
        }
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && el.bodyfatPanel && !el.bodyfatPanel.hidden) {
                el.bodyfatPanel.hidden = true;
                document.body.classList.remove("diet-bodyfat-guide-open");
            }
        });
        document.querySelectorAll(".diet-bodyfat-reference img").forEach(image => {
            image.addEventListener("error", () => {
                const fallback = image.closest("article")?.querySelector(".bodyfat-image-fallback");
                if (fallback) fallback.hidden = false;
                image.hidden = true;
            });
        });
        document.getElementById("recommendDietButton").addEventListener("click", () => {
            displayRecommendation(calculateRecommendation());
        });
        document.getElementById("applyRecommendationButton").addEventListener("click", applyRecommendation);
        document.getElementById("resetDietSetupButton").addEventListener("click", async () => {
            const ok = await confirmDietSetupReset();
            if (!ok) return;
            latestRecommendation = null;
            fillInputs(DEFAULT_PROFILE);
            el.tdeeDisplay.textContent = "-";
            el.leanMassDisplay.textContent = "-";
            el.ffmiDisplay.textContent = "-";
            el.calorieRange.textContent = translateSetupText("Calculate to see recommendation");
            el.proteinRange.textContent = translateSetupText("Calculate to see range");
            el.carbRange.textContent = translateSetupText("Calculate to see range");
            el.fatRange.textContent = translateSetupText("Calculate to see range");
            el.caloriesMin.placeholder = "Min";
            el.caloriesMax.placeholder = "Max";
            el.proteinMin.placeholder = "Min";
            el.proteinMax.placeholder = "Max";
            el.carbsMin.placeholder = "Min";
            el.carbsMax.placeholder = "Max";
            el.fatMin.placeholder = "Min";
            el.fatMax.placeholder = "Max";
            setStatus("Setup reset");
        });
        [el.weight, el.height, el.bodyFat, el.activity, el.goal].forEach(input => {
            input.addEventListener("change", () => {
                latestRecommendation = null;
                setStatus("Recalculate recommendations after changing details");
            });
        });
        el.form.addEventListener("submit", event => {
            event.preventDefault();
            if (!el.form.checkValidity()) {
                el.form.reportValidity();
                setStatus("Fill every setup field before continuing");
                return;
            }
            const recommendation = calculateRecommendation();
            if (!recommendation) return;
            latestRecommendation = latestRecommendation || recommendation;
            const calorieRange = normalizeRange(el.caloriesMin.value, el.caloriesMax.value);
            const proteinRange = normalizeRange(el.proteinMin.value, el.proteinMax.value);
            const carbRange = normalizeRange(el.carbsMin.value, el.carbsMax.value);
            const fatRange = normalizeRange(el.fatMin.value, el.fatMax.value);
            if (!calorieRange.min || !calorieRange.max || !proteinRange.min || !proteinRange.max || !carbRange.min || !carbRange.max || !fatRange.min || !fatRange.max) {
                setStatus("Choose min and max ranges for calories, protein, carbs, and fat before continuing");
                return;
            }
            const profile = profileFromInputs();
            void saveProfile(profile).then(() => {
                window.location.href = "Diet.html";
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindElements();
        void loadSetup();
    });
})();






