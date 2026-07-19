(function () {
    const DIET_DRAFT_PREFIX = "gymrat:diet:draft:";
    const DEFAULT_TARGET = 2100;
    const OPEN_FOOD_FACTS_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/";
    const FOOD_SEARCH_URL = "data/usda/foods-search-v1.json?v=usda-generic-full-2026-04-30-v1";
    const FOOD_SEARCH_VERSION_KEY = "gymrat:food-search-version";
    const TABLESPOON_ML = 15;
    const CUP_ML = 240;
    const FAT_KCAL_PER_KG = 7700;
    const STATS_RETENTION_MONTHS = 14;
    const STATS_KEEP_RECENT_MONTHS = 2;
    const EGG_SIZES = {
        small: { label: "Small egg", grams: 42.5 },
        medium: { label: "Medium egg", grams: 49.6 },
        large: { label: "Large egg", grams: 56.8 },
        "extra-large": { label: "Extra large egg", grams: 63.8 },
        jumbo: { label: "Jumbo egg", grams: 70.9 }
    };
    const FOOD_VOLUME_GRAMS = [
        { terms: ["rice"], exclude: ["raw", "uncooked", "dry"], cup: 158 },
        { terms: ["rice"], cup: 185 },
        { terms: ["pasta", "cooked"], cup: 140 },
        { terms: ["noodle", "cooked"], cup: 140 },
        { terms: ["oatmeal", "cooked"], cup: 234 },
        { terms: ["milk"], cup: 244 },
        { terms: ["yogurt"], cup: 245 },
        { terms: ["oil"], tablespoon: 14 },
        { terms: ["butter"], tablespoon: 14.2 },
        { terms: ["peanut butter"], tablespoon: 16 },
        { terms: ["almond butter"], tablespoon: 16 },
        { terms: ["nutella"], tablespoon: 18.5 },
        { terms: ["honey"], tablespoon: 21 },
        { terms: ["jam"], tablespoon: 20 },
        { terms: ["jelly"], tablespoon: 20 },
        { terms: ["flour"], cup: 125 },
        { terms: ["sugar"], cup: 200 },
        { terms: ["beans"], cup: 177 },
        { terms: ["lentils"], cup: 198 },
        { terms: ["cheese", "shredded"], cup: 113 },
        { terms: ["water"], cup: 240 },
        { terms: ["juice"], cup: 248 },
        { terms: ["soup"], cup: 245 }
    ];
    let foodSearchData = [];
    let foodSearchVersion = "";
    let foodSearchLoadPromise = null;

    let state = { calorieTarget: DEFAULT_TARGET, calorieTargetMin: DEFAULT_TARGET, calorieTargetMax: DEFAULT_TARGET, macroTargets: { protein: 150, proteinMin: 150, proteinMax: 150, carbs: 220, carbsMin: 220, carbsMax: 220, fat: 70, fatMin: 70, fatMax: 70 }, profile: { isComplete: false }, recordsByDate: {}, aiEstimatesByDate: {}, dailyStatsByDate: {}, statsMeta: {} };
    let selectedDate = new Date();
    let items = [];
    let selectedSearchFood = null;
    let selectedSearchServing = null;
    let barcodeCameraStream = null;
    let ocrRawText = "";
    let user = "";
    let dietLogHidden = false;

    const el = {};

    function translateDietText(value) {
        let text = typeof window.gymratTranslateText === "function" ? window.gymratTranslateText(value) : String(value || "");
        if (getCurrentLanguage() === "he") {
            text = text.replace(/\bkcal\b/gi, "קלוריות");
        }
        return text;
    }

    function pad(value) {
        return `${value}`.padStart(2, "0");
    }

    function dateKey(date) {
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    }

    function inputDateValue(date) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function formatVisibleDietDate(date) {
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    function updateVisibleDietDate(choice = "") {
        if (!el.currentDateLabel) return;
        const prefix = choice === "yesterday" ? "Yesterday" : "Today";
        el.currentDateLabel.textContent = translateDietText(prefix + " - " + formatVisibleDietDate(selectedDate));
    }

    function parseInputDate(value) {
        if (!value) return new Date();
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    function compareDateKeys(left, right) {
        return String(left || "").localeCompare(String(right || ""));
    }

    function addDays(date, days) {
        const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        copy.setDate(copy.getDate() + days);
        return copy;
    }

    function addMonths(date, months) {
        return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
    }

    function dateKeyFromDate(date) {
        return inputDateValue(date);
    }

    function yesterdayDate() {
        return addDays(new Date(), -1);
    }

    function yesterdayKey() {
        return dateKeyFromDate(yesterdayDate());
    }

    function isEditableDateKey(key) {
        return compareDateKeys(key, yesterdayKey()) >= 0;
    }

    function normalizeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : 0;
    }

    function round(value) {
        return Math.round((Number(value) || 0) * 10) / 10;
    }

    function formatRange(minValue, maxValue, unit = "") {
        const min = round(minValue);
        const max = round(maxValue);
        if (!min && !max) return `0${unit}`;
        if (min === max || !max) return `${min || max}${unit}`;
        if (!min) return `${max}${unit}`;
        return `${min} - ${max}${unit}`;
    }

    function formatCaloriesRemaining(totalCalories, targetMax) {
        const remaining = round(targetMax - totalCalories);
        return `${remaining}`;
    }


    function getDraftKey() {
        return `${DIET_DRAFT_PREFIX}${user || "guest"}`;
    }

    function getProfileDraftKey() {
        return `gymrat:diet:profile:${user || "guest"}`;
    }

    function getLogVisibilityKey() {
        return `gymrat:diet:log-hidden:${user || "guest"}`;
    }

    function readLocalProfileDraft() {
        try {
            const draft = localStorage.getItem(getProfileDraftKey());
            return draft ? JSON.parse(draft) : null;
        } catch (error) {
            return null;
        }
    }

    function normalizeDiet(value) {
        const source = value && typeof value === "object" ? value : {};
        return {
            calorieTarget: normalizeNumber(source.calorieTargetMax || source.calorieTarget) || DEFAULT_TARGET,
            calorieTargetMin: normalizeNumber(source.calorieTargetMin || source.calorieTarget) || DEFAULT_TARGET,
            calorieTargetMax: normalizeNumber(source.calorieTargetMax || source.calorieTarget) || DEFAULT_TARGET,
            macroTargets: {
                protein: normalizeNumber(source.macroTargets?.proteinMax || source.macroTargets?.protein) || 150,
                proteinMin: normalizeNumber(source.macroTargets?.proteinMin || source.macroTargets?.protein) || 150,
                proteinMax: normalizeNumber(source.macroTargets?.proteinMax || source.macroTargets?.protein) || 150,
                carbs: normalizeNumber(source.macroTargets?.carbsMax || source.macroTargets?.carbs) || 220,
                carbsMin: normalizeNumber(source.macroTargets?.carbsMin || source.macroTargets?.carbs) || 220,
                carbsMax: normalizeNumber(source.macroTargets?.carbsMax || source.macroTargets?.carbs) || 220,
                fat: normalizeNumber(source.macroTargets?.fatMax || source.macroTargets?.fat) || 70,
                fatMin: normalizeNumber(source.macroTargets?.fatMin || source.macroTargets?.fat) || 70,
                fatMax: normalizeNumber(source.macroTargets?.fatMax || source.macroTargets?.fat) || 70
            },
            profile: source.profile && typeof source.profile === "object" ? source.profile : { isComplete: false },
            recordsByDate: source.recordsByDate && typeof source.recordsByDate === "object" ? source.recordsByDate : {},
            aiEstimatesByDate: source.aiEstimatesByDate && typeof source.aiEstimatesByDate === "object" ? source.aiEstimatesByDate : {},
            dailyStatsByDate: source.dailyStatsByDate && typeof source.dailyStatsByDate === "object" ? source.dailyStatsByDate : {},
            statsMeta: source.statsMeta && typeof source.statsMeta === "object" ? source.statsMeta : {},
            scannedFoods: Array.isArray(source.scannedFoods) ? source.scannedFoods.map(food => ({
                id: food.id || "scanned-" + Date.now(),
                name: String(food.name || "").trim(),
                calories: normalizeNumber(food.calories),
                protein: round(food.protein),
                carbs: round(food.carbs),
                fat: round(food.fat),
                defaultEggSize: food.defaultEggSize || "",
                source: food.source || "ocr"
            })).filter(food => food.name) : []
        };
    }

    function totalsFor(list) {
        return list.reduce((total, item) => ({
            calories: total.calories + normalizeNumber(item.calories),
            protein: total.protein + normalizeNumber(item.protein),
            carbs: total.carbs + normalizeNumber(item.carbs),
            fat: total.fat + normalizeNumber(item.fat)
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }

    function legacyCurrentDateKey() {
        return dateKey(selectedDate);
    }

    function currentDateKey() {
        return dateKeyFromDate(selectedDate);
    }

    function setStatus(text) {
        if (!el.status) return;
        el.status.textContent = translateDietText(text || "");
    }

    function saveLocalDraft() {
        try {
            localStorage.setItem(getDraftKey(), JSON.stringify(state));
        } catch (error) {
            // Local storage can fail in private browsing; cloud save still runs when available.
        }
    }

    async function syncDietState() {
        saveLocalDraft();
        if (!user || typeof saveUserSelections !== "function") {
            setStatus("Saved on this device");
            return;
        }
        const result = await saveUserSelections(user, { diet: state });
        setStatus(result === "cloud" ? "Saved to account" : "Saved on this device");
    }

    function goalHit(value, min, max) {
        const current = normalizeNumber(value);
        const low = normalizeNumber(min);
        const high = normalizeNumber(max || min);
        return current >= low && current <= high;
    }

    function getDietTdee() {
        return Math.round(normalizeNumber(state.profile?.tdee) || ((normalizeNumber(state.calorieTargetMin || state.calorieTarget) + normalizeNumber(state.calorieTargetMax || state.calorieTarget)) / 2) || DEFAULT_TARGET);
    }

    function emptyStatsRow(dateKey) {
        return { d: dateKey, l: 0, cal: null, pro: null, car: null, fat: null, bal: null, kg: null };
    }

    function compactStatsRow(dateKey) {
        const record = state.recordsByDate?.[dateKey];
        const recordItems = Array.isArray(record?.items) ? record.items : [];
        if (!recordItems.length) return emptyStatsRow(dateKey);
        const totals = record?.totals || totalsFor(recordItems);
        const tdee = getDietTdee();
        const balance = Math.round(normalizeNumber(totals.calories) - tdee);
        return {
            d: dateKey,
            l: 1,
            cal: goalHit(totals.calories, state.calorieTargetMin || state.calorieTarget, state.calorieTargetMax || state.calorieTarget) ? 1 : 0,
            pro: goalHit(totals.protein, state.macroTargets.proteinMin || state.macroTargets.protein, state.macroTargets.proteinMax || state.macroTargets.protein) ? 1 : 0,
            car: goalHit(totals.carbs, state.macroTargets.carbsMin || state.macroTargets.carbs, state.macroTargets.carbsMax || state.macroTargets.carbs) ? 1 : 0,
            fat: goalHit(totals.fat, state.macroTargets.fatMin || state.macroTargets.fat, state.macroTargets.fatMax || state.macroTargets.fat) ? 1 : 0,
            bal: balance,
            kg: Math.round((balance / FAT_KCAL_PER_KG) * 100000) / 100000,
            tdee,
            at: new Date().toISOString()
        };
    }

    function firstStatsDateKey() {
        const keys = [...Object.keys(state.recordsByDate || {}), ...Object.keys(state.dailyStatsByDate || {})].filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
        return keys[0] || "";
    }

    function pruneOldStats() {
        state.dailyStatsByDate = state.dailyStatsByDate && typeof state.dailyStatsByDate === "object" ? state.dailyStatsByDate : {};
        const retentionTriggerCutoff = dateKeyFromDate(addMonths(new Date(), -STATS_RETENTION_MONTHS));
        const keepRecentCutoff = dateKeyFromDate(addMonths(new Date(), -STATS_KEEP_RECENT_MONTHS));
        let changed = false;
        const hasRowsAtRetentionLimit = [
            ...Object.keys(state.dailyStatsByDate || {}),
            ...Object.keys(state.recordsByDate || {})
        ].some(key => /^\d{4}-\d{2}-\d{2}$/.test(key) && compareDateKeys(key, retentionTriggerCutoff) <= 0);
        if (!hasRowsAtRetentionLimit) return false;
        Object.keys(state.dailyStatsByDate).forEach(key => {
            if (compareDateKeys(key, keepRecentCutoff) <= 0) {
                delete state.dailyStatsByDate[key];
                changed = true;
            }
        });
        Object.keys(state.recordsByDate || {}).forEach(key => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(key) && compareDateKeys(key, keepRecentCutoff) <= 0) {
                delete state.recordsByDate[key];
                changed = true;
            }
        });
        return changed;
    }

    function refreshStatsTimezoneMeta() {
        state.statsMeta = state.statsMeta && typeof state.statsMeta === "object" ? state.statsMeta : {};
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        const offsetMinutes = -new Date().getTimezoneOffset();
        const changed = state.statsMeta.timeZone !== timeZone || state.statsMeta.timezoneOffsetMinutes !== offsetMinutes;
        state.statsMeta.timeZone = timeZone;
        state.statsMeta.timezoneOffsetMinutes = offsetMinutes;
        state.statsMeta.lastSeenAt = new Date().toISOString();
        return changed;
    }

    function archiveCompletedDietDays() {
        state.dailyStatsByDate = state.dailyStatsByDate && typeof state.dailyStatsByDate === "object" ? state.dailyStatsByDate : {};
        let changed = refreshStatsTimezoneMeta();
        const firstKey = firstStatsDateKey();
        const endKey = yesterdayKey();
        if (firstKey && compareDateKeys(firstKey, endKey) <= 0) {
            let cursor = parseInputDate(firstKey);
            const end = parseInputDate(endKey);
            let guard = 0;
            while (cursor <= end && guard < 500) {
                const key = dateKeyFromDate(cursor);
                const row = compactStatsRow(key);
                if (JSON.stringify(state.dailyStatsByDate[key] || null) !== JSON.stringify(row)) {
                    state.dailyStatsByDate[key] = row;
                    changed = true;
                }
                cursor = addDays(cursor, 1);
                guard += 1;
            }
        }
        if (pruneOldStats()) changed = true;
        return changed;
    }

    function updateArchivedSelectedDate() {
        const key = currentDateKey();
        if (compareDateKeys(key, yesterdayKey()) > 0) return false;
        state.dailyStatsByDate = state.dailyStatsByDate && typeof state.dailyStatsByDate === "object" ? state.dailyStatsByDate : {};
        const row = compactStatsRow(key);
        if (JSON.stringify(state.dailyStatsByDate[key] || null) === JSON.stringify(row)) return false;
        state.dailyStatsByDate[key] = row;
        return true;
    }


    function getRecordForSelectedDate() {
        const key = currentDateKey();
        return state.recordsByDate[key] || state.recordsByDate[legacyCurrentDateKey()] || null;
    }

    function loadSelectedDateRecord() {
        const record = getRecordForSelectedDate();
        items = record?.items ? record.items.map(item => ({ ...item })) : [];
        if (el.foodText) el.foodText.value = record?.originalFoodText || "";
        render();
    }

    function identifyFood(line) {
        const lower = line.toLowerCase();
        return foodSearchData.find(food => lower.includes(food.name.toLowerCase()));
    }

    function quantityMultiplier(line, food) {
        const lower = line.toLowerCase();
        const grams = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/);
        if (grams) {
            const gramsValue = Number(grams[1]);
            if (food.grams) return Math.max(0.05, gramsValue / food.grams);
            return 1;
        }
        const explicit = lower.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|x|\*)/);
        if (explicit) return Math.max(0.1, Number(explicit[1]));
        if (lower.includes("half")) return 0.5;
        if (lower.includes("two")) return 2;
        return 1;
    }

    function estimateLine(line) {
        const directCalories = line.match(/(\d{2,4})\s*(?:kcal|cal|calories)/i);
        const food = identifyFood(line);
        if (food) {
            const multiplier = quantityMultiplier(line, food);
            return {
                name: line.trim() || food.name,
                calories: Math.round(food.calories * multiplier),
                protein: round(food.protein * multiplier),
                carbs: round(food.carbs * multiplier),
                fat: round(food.fat * multiplier)
            };
        }
        if (directCalories) {
            return {
                name: line.trim() || "Food item",
                calories: Number(directCalories[1]),
                protein: 0,
                carbs: 0,
                fat: 0
            };
        }
        return {
            name: line.trim() || "Food item",
            calories: 120,
            protein: 0,
            carbs: 0,
            fat: 0
        };
    }

    async function estimateFromText() {
        const foodText = el.foodText.value.trim();
        if (!foodText) {
            if (typeof gymratAlert === "function") gymratAlert("Write what you ate first.");
            else alert("Write what you ate first.");
            return;
        }

        if (!navigator.onLine) {
            if (typeof gymratAlert === "function") gymratAlert("AI estimate needs internet connection.");
            else alert("AI estimate needs internet connection.");
            return;
        }

        if (typeof apiPost !== "function" || typeof getAuthorizedPayload !== "function") {
            if (typeof gymratAlert === "function") gymratAlert("Account session is not ready. Please refresh and try again.");
            else alert("Account session is not ready. Please refresh and try again.");
            return;
        }

        const username = localStorage.getItem("currentUser") || user;
        if (!username) {
            window.location.href = "index.html";
            return;
        }

        const dateKey = currentDateKey();
        const originalButtonText = el.estimateButton?.textContent || "Estimate from text";
        if (el.estimateButton) {
            el.estimateButton.disabled = true;
            el.estimateButton.textContent = translateDietText("Estimating...");
        }
        setStatus("Estimating with AI...");

        try {
            const result = await apiPost("/api/diet-ai-estimate", getAuthorizedPayload({
                username,
                dateKey,
                foodText
            }));
            if (!result?.ok || !Array.isArray(result.items)) throw new Error("AI estimate failed.");

            items = result.items.map(item => ({
                name: `${item.name || "AI estimate"}`.trim(),
                calories: Math.round(normalizeNumber(item.calories)),
                protein: round(item.protein),
                carbs: round(item.carbs),
                fat: round(item.fat)
            }));

            const totals = result.totals || totalsFor(items);
            const savedAt = result.savedAt || new Date().toISOString();
            const record = {
                date: dateKey,
                originalFoodText: foodText,
                items: items.map(item => ({ ...item })),
                totals,
                updatedAt: savedAt,
                aiEstimated: true,
                aiEstimateSource: "gemini"
            };
            state.recordsByDate[dateKey] = record;
            state.aiEstimatesByDate = state.aiEstimatesByDate || {};
            state.aiEstimatesByDate[dateKey] = {
                ...(state.aiEstimatesByDate[dateKey] || {}),
                latest: {
                    date: dateKey,
                    requestedAt: savedAt,
                    source: "gemini",
                    originalFoodText: foodText,
                    items: record.items,
                    totals
                },
                updatedAt: savedAt
            };
            saveLocalDraft();
            render();
            setStatus("AI estimate saved to account");
        } catch (error) {
            setStatus(error.message || "AI estimate failed.");
            if (typeof gymratAlert === "function") gymratAlert(error.message || "AI estimate failed.");
            else alert(error.message || "AI estimate failed.");
        } finally {
            if (el.estimateButton) {
                el.estimateButton.disabled = false;
                el.estimateButton.textContent = originalButtonText;
            }
        }
    }

    function addManualItem() {
        items.push({
            name: "",
            grams: "",
            calories: "",
            protein: "",
            carbs: "",
            fat: ""
        });
        render();
        setStatus("Manual row added");
    }
    function normalizeSearchText(value) {
        return `${value || ""}`.toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g, " ").trim();
    }

    function getCurrentLanguage() {
        if (typeof window.gymratGetLanguage === "function") return window.gymratGetLanguage();
        return localStorage.getItem("gymrat:language") === "he" ? "he" : "en";
    }

    function translateHebrewFoodQuery(query) {
        if (typeof window.gymratTranslateFoodQueryToEnglish === "function") return window.gymratTranslateFoodQueryToEnglish(query);
        const aliases = {
            "אורז": "rice",
            "אורז לבן": "white rice",
            "אורז מלא": "brown rice",
            "עוף": "chicken",
            "חזה עוף": "chicken breast",
            "ביצה": "egg",
            "ביצים": "eggs",
            "בננה": "banana",
            "תפוח": "apple",
            "לחם": "bread",
            "חלב": "milk",
            "יוגורט": "yogurt",
            "גבינה": "cheese",
            "טונה": "tuna",
            "פסטה": "pasta",
            "תפוח אדמה": "potato",
            "בטטה": "sweet potato",
            "שיבולת שועל": "oats"
        };
        const clean = `${query || ""}`.replace(/\s+/g, " ").trim();
        return aliases[clean] || clean;
    }

    function baseDisplayFoodName(name) {
        return `${name || "Food item"}`
            .replace(/\bNFS\b/g, "Regular")
            .replace(/,\s*Regular\b/g, ", Regular")
            .trim();
    }

    function fallbackHebrewFoodName(name) {
        const clean = baseDisplayFoodName(name);
        const rules = [
            [/^rice,\s*white\b/i, "אורז לבן"],
            [/^rice,\s*brown\b/i, "אורז מלא"],
            [/^rice\b/i, "אורז"],
            [/^egg,?\s*whole\b|^eggs,?\s*whole\b/i, "ביצה שלמה"],
            [/^egg\b|^eggs\b/i, "ביצה"],
            [/^chicken breast\b|^chicken,\s*breast\b/i, "חזה עוף"],
            [/^chicken\b/i, "עוף"],
            [/^banana\b/i, "בננה"],
            [/^apple\b/i, "תפוח"],
            [/^bread\b/i, "לחם"],
            [/^milk\b/i, "חלב"],
            [/^yogurt\b|^yoghurt\b/i, "יוגורט"],
            [/^cheese\b/i, "גבינה"],
            [/^tuna\b/i, "טונה"],
            [/^pasta\b/i, "פסטה"],
            [/^potato\b/i, "תפוח אדמה"],
            [/^sweet potato\b/i, "בטטה"],
            [/^oats\b|^oatmeal\b/i, "שיבולת שועל"]
        ];
        for (const [pattern, hebrew] of rules) {
            if (pattern.test(clean)) return hebrew;
        }
        return clean;
    }

    function displayFoodName(name) {
        const clean = baseDisplayFoodName(name);
        if (getCurrentLanguage() !== "he") return clean;
        if (typeof window.gymratTranslateFoodName === "function") return window.gymratTranslateFoodName(clean);
        return fallbackHebrewFoodName(clean);
    }
    function editDistanceWithin(left, right, limit) {
        if (Math.abs(left.length - right.length) > limit) return limit + 1;
        let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
        for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
            const current = [leftIndex];
            let rowBest = current[0];
            for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
                const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
                const value = Math.min(
                    previous[rightIndex] + 1,
                    current[rightIndex - 1] + 1,
                    previous[rightIndex - 1] + cost
                );
                current[rightIndex] = value;
                rowBest = Math.min(rowBest, value);
            }
            if (rowBest > limit) return limit + 1;
            previous = current;
        }
        return previous[right.length];
    }

    function descriptorScore(name) {
        const lower = name.toLowerCase();
        const commaIndex = lower.indexOf(",");
        const descriptor = commaIndex >= 0 ? lower.slice(commaIndex + 1).trim() : "";
        let score = descriptor.length ? Math.min(35, descriptor.length) : 0;
        if (/\braw\b|uncooked|dry\b/.test(descriptor)) score += 28;
        if (/\bcooked\b|cooked\s|boiled|steamed/.test(descriptor)) score -= 14;
        if (/\bfresh\b/.test(descriptor)) score -= 4;
        if (/\bfried|dressing|salad|sandwich|pickles|sauce|made with\b/.test(lower)) score += 18;
        return Math.max(0, score);
    }

    function foodSearchScore(food, clean, words) {
        const name = food.name.toLowerCase();
        const searchableName = normalizeSearchText(`${food.name} ${displayFoodName(food.name)}`);
        const primaryName = name.split(",")[0].trim();
        const normalizedName = normalizeSearchText(name);
        const normalizedPrimary = normalizeSearchText(primaryName);
        const tokens = searchableName.split(/\s+/).filter(Boolean);
        const cleanTokens = clean.split(/\s+/).filter(Boolean);
        const typoLimit = clean.length >= 6 ? 2 : clean.length >= 4 ? 1 : 0;
        const simpleEggSearch = clean === "egg" || clean === "eggs";
        const explicitEggSearch = words.some(word => word === "egg" || word === "eggs");
        const eggAdjustment = simpleEggSearch && (food?.defaultEggSize || name.includes("egg, whole") || name.includes("eggs, whole")) ? -45 : simpleEggSearch && name.includes("dried") ? 60 : 0;
        const eggSizeSearchName = food?.defaultEggSize ? normalizeSearchText(`${food.defaultEggSize} egg ${food.name} egg ${food.defaultEggSize}`) : "";
        if (food?.defaultEggSize && !explicitEggSearch) return null;
        if (explicitEggSearch && eggSizeSearchName && words.every(word => eggSizeSearchName.includes(word))) return -80 + Math.min(20, eggSizeSearchName.length);

        if (name === clean) return eggAdjustment;
        if (normalizedPrimary === clean) return 10 + descriptorScore(name) + eggAdjustment;
        if (normalizedPrimary === `${clean}s` || `${normalizedPrimary}s` === clean) return 12 + descriptorScore(name) + eggAdjustment;
        if (name.startsWith(`${clean},`)) return 15 + descriptorScore(name) + eggAdjustment;
        if (name.startsWith(clean)) return 40 + Math.min(50, name.length - clean.length) + descriptorScore(name) + eggAdjustment;
        if (tokens.some(token => token === clean)) return 90 + descriptorScore(name) + eggAdjustment;
        if (tokens.some(token => token.startsWith(clean))) return 120 + descriptorScore(name) + eggAdjustment;

        const allWordsMatch = words.every(word => searchableName.includes(word));
        if (allWordsMatch) return 170 + Math.min(80, searchableName.length) + descriptorScore(name) + eggAdjustment;

        if (cleanTokens.length === 1 && typoLimit > 0) {
            let bestDistance = typoLimit + 1;
            for (const token of tokens) {
                if (Math.abs(token.length - clean.length) > typoLimit) continue;
                bestDistance = Math.min(bestDistance, editDistanceWithin(clean, token, typoLimit));
            }
            if (bestDistance <= typoLimit) {
                const primaryBias = editDistanceWithin(clean, normalizedPrimary, typoLimit) <= typoLimit ? 0 : 35;
                return 220 + (bestDistance * 30) + primaryBias + descriptorScore(name);
            }
        }

        return null;
    }

    function getFoodSearchMatches(query) {
        const translatedQuery = translateHebrewFoodQuery(query);
        const clean = normalizeSearchText(translatedQuery);
        const originalClean = normalizeSearchText(query);
        if (!clean && !originalClean) return [];
        const words = clean.split(/\s+/).filter(Boolean);
        const originalWords = originalClean.split(/\s+/).filter(Boolean);
        const personalFoods = Array.isArray(state.scannedFoods) ? state.scannedFoods : [];
        const searchFoods = [...personalFoods, ...foodSearchData];
        const rankedMatches = searchFoods
            .map((food) => {
                const englishScore = clean ? foodSearchScore(food, clean, words) : null;
                const hebrewScore = originalClean && originalClean !== clean ? foodSearchScore(food, originalClean, originalWords) : null;
                const scores = [englishScore, hebrewScore].filter(score => score !== null);
                return scores.length ? { food, score: Math.min(...scores) } : null;
            })
            .filter(Boolean)
            .sort((left, right) => left.score - right.score || left.food.name.length - right.food.name.length || left.food.name.localeCompare(right.food.name));

        const seenNames = new Set();
        const results = [];
        for (const match of rankedMatches) {
            const key = normalizeSearchText(displayFoodName(match.food.name));
            if (seenNames.has(key)) continue;
            seenNames.add(key);
            results.push(match.food);
            if (results.length >= 12) break;
        }
        return results;
    }

    function macrosForFoodGrams(food, grams, servingLabel = `${round(grams)}g`, nameOverride = "") {
        const multiplier = Math.max(0.01, normalizeNumber(grams) / 100);
        return {
            name: nameOverride || displayFoodName(food.name),
            serving: servingLabel,
            grams: round(grams),
            calories: Math.round(normalizeNumber(food.calories) * multiplier),
            protein: round(food.protein * multiplier),
            carbs: round(food.carbs * multiplier),
            fat: round(food.fat * multiplier)
        };
    }

    function isEggFood(food) {
        const name = `${food?.name || ""}`.toLowerCase();
        const primary = name.split(",")[0].trim();
        if (name.includes("eggplant") || name.includes("eggnog") || name.includes("egg roll") || name.includes("noodle")) return false;
        return primary === "egg" || primary === "eggs" || food?.defaultEggSize || name.includes("egg, whole") || name.includes("eggs, whole") || name.includes("hard-boiled egg") || name.includes("fried egg") || name.includes("poached egg") || name.includes("scrambled egg");
    }

    function volumeEntryForFood(food) {
        const name = `${food?.name || ""}`.toLowerCase();
        return FOOD_VOLUME_GRAMS.find(entry => {
            if (entry.exclude?.some(term => name.includes(term))) return false;
            return entry.terms.every(term => name.includes(term));
        }) || null;
    }

    function gramsForVolume(food, mode, amount) {
        const entry = volumeEntryForFood(food);
        const tablespoon = entry?.tablespoon || (entry?.cup ? entry.cup / (CUP_ML / TABLESPOON_ML) : 15);
        const cup = entry?.cup || tablespoon * (CUP_ML / TABLESPOON_ML);
        return round((mode === "cup" ? cup : tablespoon) * Math.max(0.1, normalizeNumber(amount) || 1));
    }

    function servingLabelForAmount(amount, singular, plural) {
        const value = round(amount || 1);
        return `${value} ${value === 1 ? singular : plural}`;
    }

    function setServingModeOptions(food) {
        if (!el.selectedFoodMode) return;
        const egg = isEggFood(food);
        el.selectedFoodMode.innerHTML = egg
            ? '<option value="egg-size">Egg size</option><option value="grams">Grams</option>'
            : '<option value="grams">Grams</option><option value="tablespoon">Tablespoons</option><option value="cup">Cups</option>';
        el.selectedFoodMode.value = egg ? "egg-size" : "grams";
        if (el.selectedFoodAmount) el.selectedFoodAmount.value = egg ? "1" : `${normalizeNumber(el.foodGrams?.value) || 100}`;
        if (el.selectedEggSize) el.selectedEggSize.value = egg ? (food.defaultEggSize || "medium") : "medium";
        if (el.selectedEggSizeWrap) el.selectedEggSizeWrap.hidden = !egg;
    }

    function resetServingAmountForMode() {
        if (!el.selectedFoodMode || !el.selectedFoodAmount) return;
        if (el.selectedFoodMode.value === "grams") el.selectedFoodAmount.value = `${normalizeNumber(el.foodGrams?.value) || 100}`;
        else el.selectedFoodAmount.value = "1";
        updateSelectedFoodPreview();
    }

    function setOcrStatus(text) {
        if (el.ocrStatus) el.ocrStatus.textContent = translateDietText(text || "");
    }

    function cleanBarcode(value) {
        return String(value || "").replace(/\D/g, "");
    }

    function firstFiniteNumber(...values) {
        for (const value of values) {
            const number = Number(value);
            if (Number.isFinite(number) && number >= 0) return number;
        }
        return 0;
    }

    function extractOpenFoodFactsMacros(product) {
        const nutriments = product?.nutriments || {};
        return {
            calories: Math.round(firstFiniteNumber(
                nutriments["energy-kcal_100g"],
                nutriments["energy-kcal"],
                Number(nutriments["energy_100g"]) / 4.184
            )),
            protein: round(firstFiniteNumber(nutriments.proteins_100g, nutriments.proteins)),
            carbs: round(firstFiniteNumber(nutriments.carbohydrates_100g, nutriments.carbohydrates)),
            fat: round(firstFiniteNumber(nutriments.fat_100g, nutriments.fat))
        };
    }

    function countBarcodeMacros(macros) {
        return ["calories", "protein", "carbs", "fat"].reduce((count, key) => {
            return count + (Number(macros?.[key]) > 0 ? 1 : 0);
        }, 0);
    }

    function clearBarcodeResult() {
        if (el.ocrResultPanel) el.ocrResultPanel.hidden = true;
        [el.ocrFoodName, el.ocrCalories, el.ocrProtein, el.ocrCarbs, el.ocrFat].forEach(input => {
            if (input) input.value = "";
        });
        if (el.ocrServingMode) el.ocrServingMode.value = "grams";
        if (el.ocrAmount) el.ocrAmount.value = "100";
        updateOcrCalculation();
    }

    function fillOcrFieldsFromProduct(product, barcode = "") {
        const macros = extractOpenFoodFactsMacros(product);
        const productName = product?.product_name_en || product?.product_name || product?.generic_name_en || product?.generic_name || "";
        if (el.ocrFoodName) el.ocrFoodName.value = productName || (barcode ? "Barcode " + barcode : "Barcode product");
        if (el.ocrCalories) el.ocrCalories.value = macros.calories || "";
        if (el.ocrProtein) el.ocrProtein.value = macros.protein || "";
        if (el.ocrCarbs) el.ocrCarbs.value = macros.carbs || "";
        if (el.ocrFat) el.ocrFat.value = macros.fat || "";
        if (el.ocrAmount) el.ocrAmount.value = "100";
        if (el.ocrServingMode) el.ocrServingMode.value = "grams";
        if (el.ocrResultPanel) el.ocrResultPanel.hidden = false;
        if (el.ocrRawText) {
            el.ocrRawText.textContent = [
                "Barcode lookup:",
                productName || "Unnamed product",
                barcode ? "Barcode: " + barcode : "",
                "",
                "Per 100g:",
                "Calories: " + (macros.calories || 0),
                "Protein: " + (macros.protein || 0) + "g",
                "Carbs: " + (macros.carbs || 0) + "g",
                "Fat: " + (macros.fat || 0) + "g",
                "",
                "Source: Open Food Facts"
            ].filter(Boolean).join("\n");
        }
        updateOcrCalculation();
        return macros;
    }

    async function lookupBarcodeProduct(barcodeValue = "") {
        const barcode = cleanBarcode(barcodeValue || el.barcodeInput?.value);
        if (!barcode) {
            if (typeof gymratAlert === "function") await gymratAlert("Enter or scan a barcode first.");
            else alert("Enter or scan a barcode first.");
            return;
        }
        if (el.barcodeInput) el.barcodeInput.value = barcode;
        setOcrStatus("Looking up barcode...");
        try {
            const url = OPEN_FOOD_FACTS_PRODUCT_URL + encodeURIComponent(barcode) + ".json?fields=code,product_name,product_name_en,generic_name,generic_name_en,brands,quantity,serving_size,nutriments";
            const response = await fetch(url, { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error("Barcode lookup failed.");
            const payload = await response.json();
            if (!payload?.product) throw new Error("Product not found in Open Food Facts.");
            const macros = fillOcrFieldsFromProduct(payload.product, barcode);
            const foundCount = countBarcodeMacros(macros);
            setOcrStatus(foundCount >= 3 ? "Product found. Check the values, then log it." : "Product found, but some nutrition values are missing. Check the values before logging.");
        } catch (error) {
            setOcrStatus(error.message || "Barcode lookup failed.");
        }
    }

    function stopBarcodeCamera() {
        if (barcodeCameraStream) {
            barcodeCameraStream.getTracks().forEach(track => track.stop());
            barcodeCameraStream = null;
        }
        if (el.barcodeCameraPanel) el.barcodeCameraPanel.hidden = true;
        if (el.barcodeCameraVideo) el.barcodeCameraVideo.srcObject = null;
    }

    function canDetectBarcodes() {
        return typeof window !== "undefined" && ("BarcodeDetector" in window || Boolean(window.ZXingBrowser?.BrowserMultiFormatReader));
    }

    function barcodeDetectorStatusSuffix() {
        return canDetectBarcodes() ? "Tap Read barcode when the barcode is clear." : "Barcode reader is still loading. You can type the number and tap Search barcode.";
    }

    function getBarcodeDetector() {
        return new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
    }

    function getZxingReader() {
        if (!window.ZXingBrowser?.BrowserMultiFormatReader) return null;
        if (!window.gymratZxingReader) window.gymratZxingReader = new window.ZXingBrowser.BrowserMultiFormatReader();
        return window.gymratZxingReader;
    }

    async function detectBarcodeFromCanvas(canvas) {
        if ("BarcodeDetector" in window) {
            const barcodes = await getBarcodeDetector().detect(canvas);
            const nativeValue = cleanBarcode(barcodes?.[0]?.rawValue || "");
            if (nativeValue) return nativeValue;
        }
        const zxingReader = getZxingReader();
        if (!zxingReader) return "";
        try {
            const result = zxingReader.decodeFromCanvas(canvas);
            return cleanBarcode(result?.text || result?.getText?.() || "");
        } catch (error) {
            return "";
        }
    }

    async function detectBarcodeFromVideo(video, durationMs = 5000) {
        const zxingReader = getZxingReader();
        if (!zxingReader || !video) return "";
        let controls = null;
        return new Promise(resolve => {
            let settled = false;
            const finish = value => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                try { controls?.stop?.(); } catch (error) {}
                resolve(cleanBarcode(value));
            };
            const timeoutId = setTimeout(() => finish(""), durationMs);
            zxingReader.decodeFromVideoElement(video, (result, error, streamControls) => {
                if (streamControls && !controls) controls = streamControls;
                const value = cleanBarcode(result?.text || result?.getText?.() || "");
                if (value) finish(value);
            }).then(streamControls => {
                if (settled) {
                    try { streamControls?.stop?.(); } catch (error) {}
                    return;
                }
                controls = streamControls;
            }).catch(() => finish(""));
        });
    }

    async function openBarcodeScanner() {
        if (!window.isSecureContext && location.hostname !== "localhost") {
            setOcrStatus("Camera needs HTTPS. Open the deployed website, then try again.");
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            setOcrStatus("Camera is not supported in this browser. Type the barcode number instead.");
            return;
        }
        try {
            stopBarcodeCamera();
            const constraints = [
                { video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
                { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
                { video: true, audio: false }
            ];
            let lastError = null;
            for (const constraint of constraints) {
                try {
                    barcodeCameraStream = await navigator.mediaDevices.getUserMedia(constraint);
                    break;
                } catch (error) {
                    lastError = error;
                }
            }
            if (!barcodeCameraStream) throw lastError || new Error("Could not open barcode scanner.");
            if (el.barcodeCameraVideo) {
                el.barcodeCameraVideo.setAttribute("playsinline", "");
                el.barcodeCameraVideo.setAttribute("webkit-playsinline", "");
                el.barcodeCameraVideo.muted = true;
                el.barcodeCameraVideo.srcObject = barcodeCameraStream;
                await el.barcodeCameraVideo.play().catch(() => {});
            }
            if (el.barcodeCameraPanel) el.barcodeCameraPanel.hidden = false;
            setOcrStatus("Camera open. Place the barcode inside the view. " + barcodeDetectorStatusSuffix());
        } catch (error) {
            setOcrStatus(error?.message || "Could not open barcode scanner. Type the barcode number instead.");
        }
    }

    function waitForBarcodeFrame(delayMs) {
        return new Promise(resolve => setTimeout(resolve, delayMs));
    }

    function drawBarcodeFrameVariant(video, canvas, variantIndex) {
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        const frameWidth = Math.min(1600, sourceWidth);
        const frameHeight = Math.round(sourceHeight * (frameWidth / sourceWidth));
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
        context.imageSmoothingEnabled = false;
        context.filter = variantIndex % 2 === 0 ? "contrast(1.35) grayscale(1)" : "contrast(1.8) grayscale(1)";
        context.drawImage(video, 0, 0, frameWidth, frameHeight);

        if (variantIndex >= 2) {
            const cropHeight = Math.round(frameHeight * 0.58);
            const cropTop = Math.round((frameHeight - cropHeight) / 2);
            const crop = context.getImageData(0, cropTop, frameWidth, cropHeight);
            canvas.height = cropHeight;
            context.putImageData(crop, 0, 0);
        }
    }

    async function scanBarcodeFrame() {
        const video = el.barcodeCameraVideo;
        const canvas = el.barcodeCameraCanvas;
        if (!video || !canvas || !video.videoWidth) {
            setOcrStatus("Barcode camera is not ready yet.");
            return;
        }
        if (!canDetectBarcodes()) {
            setOcrStatus("Barcode reader is still loading. Wait a moment, or type the number and tap Search barcode.");
            return;
        }
        setOcrStatus("Reading barcode... keep it flat, bright, and inside the camera view.");
        try {
            const liveValue = await detectBarcodeFromVideo(video, 5200);
            if (liveValue) {
                if (el.barcodeInput) el.barcodeInput.value = liveValue;
                stopBarcodeCamera();
                await lookupBarcodeProduct(liveValue);
                return;
            }
            for (let attempt = 0; attempt < 12; attempt += 1) {
                drawBarcodeFrameVariant(video, canvas, attempt);
                const value = await detectBarcodeFromCanvas(canvas);
                if (value) {
                    if (el.barcodeInput) el.barcodeInput.value = value;
                    stopBarcodeCamera();
                    await lookupBarcodeProduct(value);
                    return;
                }
                await waitForBarcodeFrame(180);
            }
            setOcrStatus("No barcode found. Hold the barcode closer, make it fill most of the view, avoid glare, then tap Read barcode again.");
        } catch (error) {
            setOcrStatus(error.message || "Barcode scan failed.");
        }
    }

    function getOcrFood() {
        return {
            id: "ocr-" + Date.now(),
            name: (el.ocrFoodName?.value || "Barcode product").trim(),
            calories: normalizeNumber(el.ocrCalories?.value),
            protein: round(el.ocrProtein?.value),
            carbs: round(el.ocrCarbs?.value),
            fat: round(el.ocrFat?.value),
            source: "ocr"
        };
    }

    function getOcrServing(food) {
        const mode = el.ocrServingMode?.value || "grams";
        const amount = normalizeNumber(el.ocrAmount?.value) || 100;
        if (mode === "tablespoon" || mode === "cup") {
            const grams = gramsForVolume(food, mode, amount);
            const label = mode === "cup" ? servingLabelForAmount(amount, "cup", "cups") : servingLabelForAmount(amount, "tbsp", "tbsp");
            return { mode, grams, label: `${label} (${grams}g)`, amountLabel: mode === "cup" ? "Cups" : "Tablespoons" };
        }
        return { mode, grams: amount, label: `${round(amount)}g`, amountLabel: "Grams" };
    }

    function updateOcrCalculation() {
        const food = getOcrFood();
        const serving = getOcrServing(food);
        const macros = macrosForFoodGrams(food, serving.grams, serving.label);
        if (el.ocrAmountLabel) el.ocrAmountLabel.textContent = serving.amountLabel;
        if (el.ocrCalcCalories) el.ocrCalcCalories.textContent = Math.round(macros.calories);
        if (el.ocrCalcProtein) el.ocrCalcProtein.textContent = `${round(macros.protein)}g`;
        if (el.ocrCalcCarbs) el.ocrCalcCarbs.textContent = `${round(macros.carbs)}g`;
        if (el.ocrCalcFat) el.ocrCalcFat.textContent = `${round(macros.fat)}g`;
    }

    function savePersonalScannedFood(food) {
        if (!String(food?.name || "").trim()) return false;
        state.scannedFoods = Array.isArray(state.scannedFoods) ? state.scannedFoods : [];
        const key = normalizeSearchText(food.name);
        const existingIndex = state.scannedFoods.findIndex(item => normalizeSearchText(item.name) === key);
        const saved = { ...food, id: existingIndex >= 0 ? state.scannedFoods[existingIndex].id : "scanned-" + Date.now() };
        if (existingIndex >= 0) state.scannedFoods[existingIndex] = saved;
        else state.scannedFoods.unshift(saved);
        state.scannedFoods = state.scannedFoods.slice(0, 80);
        return true;
    }

    async function saveFoodToMyFoods(food, context = "food") {
        if (!String(food?.name || "").trim()) {
            const message = "Enter a food name before saving it to My foods.";
            if (typeof gymratAlert === "function") await gymratAlert(message);
            else alert(message);
            return false;
        }
        const foodName = displayFoodName(food.name);
        const question = "Are you sure you want to save " + foodName + " to My foods?";
        const ok = typeof gymratConfirm === "function" ? await gymratConfirm(question) : confirm(question);
        if (!ok) return false;
        const saved = savePersonalScannedFood({ ...food, name: foodName });
        if (saved) {
            await syncDietState();
            renderMyFoods();
            const message = foodName + " saved to My foods.";
            if (context === "barcode") setOcrStatus(message);
            else setStatus(message);
            if (typeof gymratAlert === "function") await gymratAlert(message);
            else alert(message);
        }
        return saved;
    }

    async function saveOcrFoodToMyFoods() {
        await saveFoodToMyFoods(getOcrFood(), "barcode");
    }

    async function saveSelectedFoodToMyFoods() {
        if (!selectedSearchFood) return;
        const serving = getSelectedServing();
        const egg = isEggFood(selectedSearchFood);
        await saveFoodToMyFoods({
            ...selectedSearchFood,
            name: egg ? (serving.itemName || displayFoodName(selectedSearchFood.name)) : displayFoodName(selectedSearchFood.name),
            defaultEggSize: egg ? (el.selectedEggSize?.value || selectedSearchFood.defaultEggSize || "medium") : selectedSearchFood.defaultEggSize,
            source: "search"
        }, "search");
    }

    async function logOcrFood() {
        const food = getOcrFood();
        if (!String(food.name || "").trim()) {
            if (typeof gymratAlert === "function") await gymratAlert("Enter a food name before logging this product.");
            else alert("Enter a food name before logging this product.");
            return;
        }
        const serving = getOcrServing(food);
        items.push(macrosForFoodGrams(food, serving.grams, serving.label));
        await saveDay();
        clearBarcodeResult();
        const message = "Product added to your daily log.";
        setOcrStatus(message);
        if (typeof gymratAlert === "function") await gymratAlert(message);
        else alert(message);
    }

    function resetOcrAmountForMode() {
        if (!el.ocrAmount) return;
        el.ocrAmount.value = el.ocrServingMode?.value === "grams" ? "100" : "1";
        updateOcrCalculation();
    }

    function getSelectedServing() {
        const mode = el.selectedFoodMode?.value || "grams";
        const amount = normalizeNumber(el.selectedFoodAmount?.value) || 1;
        if (mode === "egg-size") {
            const eggSize = EGG_SIZES[el.selectedEggSize?.value] || EGG_SIZES.medium;
            const grams = round(eggSize.grams * amount);
            return {
                mode,
                grams,
                label: `${servingLabelForAmount(amount, eggSize.label.toLowerCase(), `${eggSize.label.toLowerCase()}s`)} (${grams}g)`,
                amountLabel: "Egg count",
                itemName: eggSize.label
            };
        }
        if (mode === "tablespoon" || mode === "cup") {
            const grams = gramsForVolume(selectedSearchFood, mode, amount);
            const label = mode === "cup" ? servingLabelForAmount(amount, "cup", "cups") : servingLabelForAmount(amount, "tbsp", "tbsp");
            return { mode, grams, label: `${label} (${grams}g)`, amountLabel: mode === "cup" ? "Cups" : "Tablespoons" };
        }
        const grams = normalizeNumber(el.selectedFoodAmount?.value) || 100;
        return { mode, grams, label: `${round(grams)}g`, amountLabel: "Grams" };
    }

    function setFoodSearchOpen(isOpen) {
        const open = Boolean(isOpen);
        const wrapper = el.foodSearch?.closest(".diet-food-search");
        if (el.foodSearchPanel) el.foodSearchPanel.hidden = !open;
        if (el.foodSearch) el.foodSearch.setAttribute("aria-expanded", open ? "true" : "false");
        wrapper?.classList.toggle("is-open", open);
    }

    function updateSelectedFoodPreview() {
        if (!selectedSearchFood || !el.selectedFoodPanel) return;
        const serving = getSelectedServing();
        const macros = macrosForFoodGrams(selectedSearchFood, serving.grams, serving.label);
        const egg = isEggFood(selectedSearchFood);
        el.selectedFoodName.textContent = displayFoodName(selectedSearchFood.name);
        el.selectedFoodServing.textContent = egg ? serving.label : `${serving.label} from per-100g macros`;
        el.selectedFoodCalories.textContent = Math.round(macros.calories);
        el.selectedFoodProtein.textContent = `${round(macros.protein)}g`;
        el.selectedFoodCarbs.textContent = `${round(macros.carbs)}g`;
        el.selectedFoodFat.textContent = `${round(macros.fat)}g`;
        if (el.selectedFoodAmountLabel) el.selectedFoodAmountLabel.textContent = serving.amountLabel;
        if (el.selectedEggSizeWrap) el.selectedEggSizeWrap.hidden = serving.mode !== "egg-size";
    }

    function closeSelectedFoodPanel() {
        selectedSearchFood = null;
        selectedSearchServing = null;
        if (el.selectedFoodPanel) el.selectedFoodPanel.hidden = true;
    }

    function selectFoodSearchItem(food) {
        selectedSearchFood = food;
        selectedSearchServing = null;
        setServingModeOptions(food);
        if (el.selectedFoodPanel) el.selectedFoodPanel.hidden = false;
        updateSelectedFoodPreview();
        setFoodSearchOpen(false);
    }

    async function logSelectedFood() {
        if (!selectedSearchFood) return;
        const serving = getSelectedServing();
        const foodName = serving.itemName || displayFoodName(selectedSearchFood.name);
        items.push(macrosForFoodGrams(selectedSearchFood, serving.grams, serving.label, serving.itemName));
        closeSelectedFoodPanel();
        await saveDay();
        const message = "Food added to your daily log.";
        setStatus(`Added ${foodName} (${serving.label})`);
        if (typeof gymratAlert === "function") await gymratAlert(message);
        else alert(message);
    }

    function renderFoodSearchResults() {
        if (!el.foodSearchResults || !el.foodSearch) return;
        if (foodSearchLoadPromise && foodSearchData.length === 0) {
            el.foodSearchResults.innerHTML = `<p class="diet-search-empty">${translateDietText("Downloading food values...")}</p>`;
            return;
        }
        const query = el.foodSearch.value.trim();
        el.foodSearchResults.innerHTML = "";
        closeSelectedFoodPanel();
        if (!query) {
            el.foodSearchResults.innerHTML = `<p class="diet-search-empty">${translateDietText("Start typing a food name, then choose one result to set the amount.")}</p>`;
            return;
        }
        const matches = getFoodSearchMatches(query);
        if (matches.length === 0) {
            const empty = document.createElement("p");
            empty.className = "diet-search-empty";
            empty.textContent = translateDietText("No matching foods yet");
            el.foodSearchResults.appendChild(empty);
            return;
        }

        matches.forEach(food => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "diet-search-result";
            button.textContent = displayFoodName(food.name);
            button.addEventListener("click", () => selectFoodSearchItem(food));
            el.foodSearchResults.appendChild(button);
        });
    }
    async function loadFoodSearchData() {
        if (foodSearchLoadPromise) return foodSearchLoadPromise;
        foodSearchLoadPromise = fetch(FOOD_SEARCH_URL, { cache: "force-cache" })
            .then(async (response) => {
                if (!response.ok) throw new Error("Food values download failed.");
                const payload = await response.json();
                foodSearchVersion = payload.version || "";
                foodSearchData = Array.isArray(payload.foods) ? payload.foods.map(food => ({
                    id: food.id,
                    name: food.n,
                    calories: normalizeNumber(food.cal),
                    protein: round(food.p),
                    carbs: round(food.c),
                    fat: round(food.f)
                })) : [];
                [
                    { id: "regular-egg-jumbo", name: "Jumbo egg", calories: 143, protein: 12.56, carbs: 0.72, fat: 9.51, defaultEggSize: "jumbo" },
                    { id: "regular-egg-extra-large", name: "Extra large egg", calories: 143, protein: 12.56, carbs: 0.72, fat: 9.51, defaultEggSize: "extra-large" },
                    { id: "regular-egg-large", name: "Large egg", calories: 143, protein: 12.56, carbs: 0.72, fat: 9.51, defaultEggSize: "large" },
                    { id: "regular-egg-medium", name: "Medium egg", calories: 143, protein: 12.56, carbs: 0.72, fat: 9.51, defaultEggSize: "medium" },
                    { id: "regular-egg-small", name: "Small egg", calories: 143, protein: 12.56, carbs: 0.72, fat: 9.51, defaultEggSize: "small" },
                    { id: "regular-egg-whole-raw", name: "Egg, whole, raw", calories: 143, protein: 12.56, carbs: 0.72, fat: 9.51, defaultEggSize: "large" }
                ].reverse().forEach(eggFood => {
                    if (!foodSearchData.some(food => normalizeSearchText(food.name) === normalizeSearchText(eggFood.name))) {
                        foodSearchData.unshift(eggFood);
                    }
                });
                foodSearchData.unshift({ id: "nutella-regular", name: "Nutella, regular", calories: 541, protein: 5.4, carbs: 59.5, fat: 29.7 });
                foodSearchData = foodSearchData.filter(food => !normalizeSearchText(food.name).includes("nutella") || food.id === "nutella-regular");
                const uniqueFoods = [];
                const uniqueFoodKeys = new Set();
                foodSearchData.forEach(food => {
                    const key = [normalizeSearchText(displayFoodName(food.name)), Math.round(normalizeNumber(food.calories) * 10) / 10, round(food.protein), round(food.carbs), round(food.fat)].join("|");
                    if (uniqueFoodKeys.has(key)) return;
                    uniqueFoodKeys.add(key);
                    uniqueFoods.push(food);
                });
                foodSearchData = uniqueFoods;
                try {
                    if (foodSearchVersion) localStorage.setItem(FOOD_SEARCH_VERSION_KEY, foodSearchVersion);
                } catch (error) {
                    // Cache metadata is optional.
                }
                renderFoodSearchResults();
            })
            .catch((error) => {
                if (el.foodSearchResults) {
                    el.foodSearchResults.innerHTML = `<p class="diet-search-empty">${translateDietText("Food values could not load. Check your connection.")}</p>`;
                }
                throw error;
            });
        return foodSearchLoadPromise;
    }

    async function saveDay() {
        const key = currentDateKey();
        if (!isEditableDateKey(key)) {
            const message = "You can only edit today and yesterday.";
            if (typeof gymratAlert === "function") await gymratAlert(message);
            else alert(message);
            return;
        }
        const cleanedItems = items
            .map(item => ({
                name: `${item.name || "Food item"}`.trim(),
                serving: `${item.serving || ""}`.trim(),
                calories: Math.round(normalizeNumber(item.calories)),
                protein: round(item.protein),
                carbs: round(item.carbs),
                fat: round(item.fat),
                grams: round(item.grams)
            }))
            .filter(item => item.name !== "Food item" || item.serving || item.calories || item.protein || item.carbs || item.fat || item.grams);
        const totals = totalsFor(cleanedItems);
        items = cleanedItems;
        state.recordsByDate[key] = {
            date: key,
            originalFoodText: el.foodText?.value?.trim() || "",
            items: cleanedItems,
            totals,
            updatedAt: new Date().toISOString()
        };
        const legacyKey = legacyCurrentDateKey();
        if (legacyKey !== key) state.recordsByDate[legacyKey] = null;
        updateArchivedSelectedDate();
        setStatus("Saving...");
        await syncDietState();
        render();
    }

    async function deleteDay() {
        const key = currentDateKey();
        if (!isEditableDateKey(key)) {
            const message = "You can only edit today and yesterday.";
            if (typeof gymratAlert === "function") await gymratAlert(message);
            else alert(message);
            return;
        }
        const legacyKey = legacyCurrentDateKey();
        if (!state.recordsByDate[key] && !state.recordsByDate[legacyKey] && items.length === 0) return;
        const message = `Are you sure you want to delete the entire food log for ${key}?`;
        const ok = typeof gymratConfirm === "function" ? await gymratConfirm(message) : confirm(message);
        if (!ok) return;
        state.recordsByDate[key] = null;
        if (legacyKey !== key) state.recordsByDate[legacyKey] = null;
        items = [];
        if (el.foodText) el.foodText.value = "";
        updateArchivedSelectedDate();
        setStatus("Saving...");
        await syncDietState();
        render();
    }

    function clearForm() {
        items = [];
        if (el.foodText) el.foodText.value = "";
        render();
    }

    function setDateChoice(choice) {
        const now = new Date();
        if (choice === "today") selectedDate = now;
        if (choice === "yesterday") selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        if (choice === "custom") selectedDate = parseInputDate(el.customDate?.value || inputDateValue(new Date()));
        if (el.customDate) el.customDate.value = inputDateValue(selectedDate);
        updateVisibleDietDate(choice);
        document.querySelectorAll(".diet-date-button").forEach(button => {
            button.classList.toggle("is-active", button.dataset.dateChoice === choice);
        });
        loadSelectedDateRecord();
    }

    function updateLoggedFoodInput(event) {
        const input = event.target;
        const row = input.closest(".diet-live-log-row");
        if (!row) return;
        const index = Number(row.dataset.index);
        const field = input.dataset.field;
        if (!items[index] || !field) return;
        items[index][field] = field === "name" ? input.value : (input.value === "" ? "" : normalizeNumber(input.value));
        renderSummaryOnly();
    }

    async function saveLoggedFoodInput(event) {
        updateLoggedFoodInput(event);
        await saveDay();
    }

    async function removeLoggedFoodItem(index) {
        if (!items[index]) return;
        items.splice(index, 1);
        await saveDay();
    }

    function loggedFoodValue(item, field) {
        if (!item || item[field] === "" || item[field] === null || item[field] === undefined) return "";
        return field === "calories" ? Math.round(normalizeNumber(item[field])) : round(item[field]);
    }

    function renderItems() {
        if (!el.items || !el.itemCount) return;
        el.items.innerHTML = "";
        el.itemCount.textContent = translateDietText(`${items.length} ${items.length === 1 ? "item" : "items"}`);
        if (!items.length) {
            el.items.innerHTML = `<p class="diet-live-log-empty">${translateDietText("No foods logged yet.")}</p>`;
            return;
        }

        const header = document.createElement("div");
        header.className = "diet-live-log-row diet-live-log-row-header";
        header.innerHTML = ["Item name", "Calories", "Protein", "Carbs", "Fats", "Grams", "Remove"].map(label => `<span>${translateDietText(label)}</span>`).join("");
        el.items.appendChild(header);

        items.forEach((item, index) => {
            const row = document.createElement("div");
            row.className = "diet-live-log-row";
            row.dataset.index = String(index);
            row.innerHTML = `
                <input data-field="name" type="text" aria-label="Item name">
                <input data-field="calories" type="number" min="0" step="1" aria-label="Calories">
                <input data-field="protein" type="number" min="0" step="0.1" aria-label="Protein">
                <input data-field="carbs" type="number" min="0" step="0.1" aria-label="Carbs">
                <input data-field="fat" type="number" min="0" step="0.1" aria-label="Fats">
                <input data-field="grams" type="number" min="0" step="1" aria-label="Grams">
                <button type="button" class="diet-live-log-remove" aria-label="${translateDietText("Remove item")}">${translateDietText("Remove")}</button>
            `;
            row.querySelector('[data-field="name"]').value = item.name || "";
            row.querySelector('[data-field="calories"]').value = loggedFoodValue(item, "calories");
            row.querySelector('[data-field="protein"]').value = loggedFoodValue(item, "protein");
            row.querySelector('[data-field="carbs"]').value = loggedFoodValue(item, "carbs");
            row.querySelector('[data-field="fat"]').value = loggedFoodValue(item, "fat");
            row.querySelector('[data-field="grams"]').value = loggedFoodValue(item, "grams");
            row.querySelectorAll("input").forEach(input => {
                input.addEventListener("input", updateLoggedFoodInput);
                input.addEventListener("change", event => void saveLoggedFoodInput(event));
            });
            row.querySelector(".diet-live-log-remove").addEventListener("click", () => void removeLoggedFoodItem(index));
            el.items.appendChild(row);
        });
    }

function clampPercent(value) {
        return Math.max(0, Math.min(100, Math.floor(value)));
    }

    function setGoalCardProgress(card, currentValue, minGoal, maxGoal) {
        if (!card) return;
        const min = normalizeNumber(minGoal);
        const max = normalizeNumber(maxGoal || minGoal || min);
        const current = Math.max(0, Number(currentValue) || 0);
        const under = min > 0 && current < min;
        const over = max > 0 && current > max;
        const inGoal = !under && !over && min > 0;
        const percent = over || inGoal ? 100 : (min > 0 ? clampPercent((current / min) * 100) : 0);

        card.style.setProperty("--diet-progress", `${percent}%`);
        card.classList.toggle("is-under-goal", under);
        card.classList.toggle("is-over-goal", over);
        card.classList.toggle("is-in-goal", inGoal);
    }

    function renderSummaryOnly() {
        if (!el.remaining || !el.protein || !el.carbs || !el.fat) return;
        const totals = totalsFor(items);
        const targetMin = normalizeNumber(state.calorieTargetMin || state.calorieTarget) || DEFAULT_TARGET;
        const targetMax = normalizeNumber(state.calorieTargetMax || state.calorieTarget) || DEFAULT_TARGET;
        const proteinMin = normalizeNumber(state.macroTargets.proteinMin || state.macroTargets.protein);
        const proteinMax = normalizeNumber(state.macroTargets.proteinMax || state.macroTargets.protein);
        const carbsMin = normalizeNumber(state.macroTargets.carbsMin || state.macroTargets.carbs);
        const carbsMax = normalizeNumber(state.macroTargets.carbsMax || state.macroTargets.carbs);
        const fatMin = normalizeNumber(state.macroTargets.fatMin || state.macroTargets.fat);
        const fatMax = normalizeNumber(state.macroTargets.fatMax || state.macroTargets.fat);

        el.remaining.textContent = String(round(totals.calories));
        if (el.caloriesGoal) el.caloriesGoal.textContent = translateDietText("goal " + formatRange(targetMin, targetMax, " kcal"));
        el.protein.textContent = `${round(totals.protein)}g`;
        el.carbs.textContent = `${round(totals.carbs)}g`;
        el.fat.textContent = `${round(totals.fat)}g`;
        if (el.proteinGoal) el.proteinGoal.textContent = translateDietText(`goal ${formatRange(proteinMin, proteinMax, "g")}`);
        if (el.carbsGoal) el.carbsGoal.textContent = translateDietText(`goal ${formatRange(carbsMin, carbsMax, "g")}`);
        if (el.fatGoal) el.fatGoal.textContent = translateDietText(`goal ${formatRange(fatMin, fatMax, "g")}`);

        setGoalCardProgress(el.caloriesCard, totals.calories, targetMin, targetMax);
        setGoalCardProgress(el.proteinCard, totals.protein, proteinMin, proteinMax);
        setGoalCardProgress(el.carbsCard, totals.carbs, carbsMin, carbsMax);
        setGoalCardProgress(el.fatCard, totals.fat, fatMin, fatMax);
    }


    function eggSizeKeyFromName(name) {
        const text = normalizeSearchText(name);
        if (text.includes("jumbo")) return "jumbo";
        if (text.includes("extra large") || text.includes("extra-large")) return "extra-large";
        if (text.includes("large")) return "large";
        if (text.includes("small")) return "small";
        if (text.includes("medium")) return "medium";
        return "";
    }

    function getMyFoodServing(food, card) {
        const mode = card.querySelector("[data-my-food-mode]")?.value || (isEggFood(food) ? "egg-size" : "grams");
        const amount = normalizeNumber(card.querySelector("[data-my-food-amount]")?.value) || (mode === "grams" ? 100 : 1);
        if (mode === "egg-size") {
            const eggSize = EGG_SIZES[food.defaultEggSize] || EGG_SIZES[eggSizeKeyFromName(food.name)] || EGG_SIZES.medium;
            const grams = round(eggSize.grams * amount);
            return {
                mode,
                grams,
                label: servingLabelForAmount(amount, eggSize.label.toLowerCase(), eggSize.label.toLowerCase() + "s") + " (" + grams + "g)"
            };
        }
        if (mode === "tablespoon" || mode === "cup") {
            const grams = gramsForVolume(food, mode, amount);
            const label = mode === "cup" ? servingLabelForAmount(amount, "cup", "cups") : servingLabelForAmount(amount, "tbsp", "tbsp");
            return { mode, grams, label: label + " (" + grams + "g)" };
        }
        return { mode, grams: amount, label: round(amount) + "g" };
    }

    function updateMyFoodCard(card) {
        const index = Number(card?.dataset?.myFoodIndex);
        const food = state.scannedFoods?.[index];
        if (!food) return;
        const serving = getMyFoodServing(food, card);
        const macros = macrosForFoodGrams(food, serving.grams, serving.label);
        card.querySelector("[data-my-food-calories]").textContent = Math.round(macros.calories);
        card.querySelector("[data-my-food-protein]").textContent = round(macros.protein) + "g";
        card.querySelector("[data-my-food-carbs]").textContent = round(macros.carbs) + "g";
        card.querySelector("[data-my-food-fat]").textContent = round(macros.fat) + "g";
    }

    function renderMyFoods() {
        if (!el.myFoodsList) return;
        const foods = Array.isArray(state.scannedFoods) ? state.scannedFoods : [];
        el.myFoodsList.innerHTML = "";
        if (el.myFoodsEmpty) el.myFoodsEmpty.hidden = foods.length > 0;
        foods.forEach((food, index) => {
            const card = document.createElement("article");
            card.className = "diet-my-food-card";
            card.dataset.myFoodIndex = String(index);
            const egg = isEggFood(food);
            card.innerHTML = `
                <div class="diet-my-food-heading">
                    <div>
                        <strong>${displayFoodName(food.name)}</strong>
                        <span>${translateDietText(egg ? "By egg size" : "Per 100g macros")}</span>
                    </div>
                </div>
                <div class="diet-ocr-calculated" aria-label="${translateDietText("Calculated nutrition")}">
                    <span><strong data-my-food-calories>0</strong><small>${translateDietText("kcal")}</small></span>
                    <span><strong data-my-food-protein>0g</strong><small>${translateDietText("protein")}</small></span>
                    <span><strong data-my-food-carbs>0g</strong><small>${translateDietText("carbs")}</small></span>
                    <span><strong data-my-food-fat>0g</strong><small>${translateDietText("fat")}</small></span>
                </div>
                <div class="diet-my-food-controls">
                    <label>${translateDietText("Serving")}
                        <select data-my-food-mode>
                            ${egg ? `<option value="egg-size">${translateDietText("Egg size")}</option>` : ""}
                            <option value="grams">${translateDietText("Grams")}</option>
                            ${egg ? "" : `<option value="tablespoon">${translateDietText("Tablespoons")}</option><option value="cup">${translateDietText("Cups")}</option>`}
                        </select>
                    </label>
                    <label>${translateDietText("Amount")}
                        <input data-my-food-amount type="number" min="0.1" step="0.1" value="${egg ? '1' : '100'}">
                    </label>
                    <button type="button" data-my-food-log>${translateDietText("Log food")}</button>
                    <button type="button" data-my-food-delete>${translateDietText("Delete saved food")}</button>
                </div>
            `;
            el.myFoodsList.appendChild(card);
            updateMyFoodCard(card);
        });
    }

    async function logMyFood(card) {
        const index = Number(card?.dataset?.myFoodIndex);
        const food = state.scannedFoods?.[index];
        if (!food) return;
        const serving = getMyFoodServing(food, card);
        items.push(macrosForFoodGrams(food, serving.grams, serving.label));
        await saveDay();
        const message = "Food added to your daily log.";
        if (typeof gymratAlert === "function") await gymratAlert(message);
        else alert(message);
    }

    async function deleteMyFood(card) {
        const index = Number(card?.dataset?.myFoodIndex);
        const food = state.scannedFoods?.[index];
        if (!food) return;
        const foodName = displayFoodName(food.name);
        const message = "Are you sure you want to delete " + foodName + " from My foods?";
        const ok = typeof gymratConfirm === "function" ? await gymratConfirm(message) : confirm(message);
        if (!ok) return;
        state.scannedFoods.splice(index, 1);
        await syncDietState();
        renderMyFoods();
        const done = foodName + " deleted from My foods.";
        if (typeof gymratAlert === "function") await gymratAlert(done);
        else alert(done);
    }


    function statIcon(value) {
        if (value === null || value === undefined) return '<span class="diet-stat-empty">---</span>';
        return value ? '<span class="diet-stat-check" aria-label="Reached goal">âœ“</span>' : '<span class="diet-stat-x" aria-label="Missed goal">X</span>';
    }

    function formatSignedNumber(value) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return "---";
        const rounded = Math.round(Number(value));
        return (rounded > 0 ? "+" : "") + rounded;
    }

    function formatSignedKg(value) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return "---";
        const rounded = Math.round(Number(value) * 100000) / 100000;
        return (rounded > 0 ? "+" : "") + rounded.toFixed(5) + "kg";
    }

    function statsRowForDisplay(dateKey) {
        return state.dailyStatsByDate?.[dateKey] || compactStatsRow(dateKey);
    }

    function formatStatsDateLabel(dateKey) {
        if (getCurrentLanguage() !== "he") return dateKey;
        const date = parseInputDate(dateKey);
        return date.toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" });
    }

    function formatStatsMonthLabel(monthValue) {
        if (getCurrentLanguage() !== "he" || !/^\d{4}-\d{2}$/.test(String(monthValue || ""))) return monthValue;
        const date = new Date(Number(monthValue.slice(0, 4)), Number(monthValue.slice(5, 7)) - 1, 1);
        return date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
    }

    function statsHeaderHtml() {
        return ["Date", "Calories", "Protein", "Carbs", "Fat", "Kcal +/-", "Fat kg"].map(label => `<th>${translateDietText(label)}</th>`).join("");
    }

    function escapedStatsHeaderHtml() {
        return ["Date", "Calories", "Protein", "Carbs", "Fat", "Kcal +/-", "Fat kg"].map(label => "<th>" + escapeReportHtml(translateDietText(label)) + "</th>").join("");
    }

    function dateKeysBetween(startKey, endKey) {
        const keys = [];
        let cursor = parseInputDate(startKey);
        const end = parseInputDate(endKey);
        let guard = 0;
        while (cursor <= end && guard < 430) {
            keys.push(dateKeyFromDate(cursor));
            cursor = addDays(cursor, 1);
            guard += 1;
        }
        return keys;
    }

    function completedLastSevenKeys() {
        const end = yesterdayDate();
        const start = addDays(end, -6);
        return dateKeysBetween(dateKeyFromDate(start), dateKeyFromDate(end));
    }

    function periodTotal(rows) {
        return rows.reduce((total, row) => {
            if (row?.bal !== null && row?.bal !== undefined) total.balance += Number(row.bal) || 0;
            return total;
        }, { balance: 0 });
    }

    function renderStatsTable(container, keys) {
        if (!container) return;
        const rows = keys.map(key => statsRowForDisplay(key));
        const total = periodTotal(rows);
        container.innerHTML = `
            <div class="diet-stats-table-wrap">
                <table class="diet-stats-table">
                    <thead>
                        <tr>${statsHeaderHtml()}</tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                <td>${formatStatsDateLabel(row.d)}</td>
                                <td>${statIcon(row.cal)}</td>
                                <td>${statIcon(row.pro)}</td>
                                <td>${statIcon(row.car)}</td>
                                <td>${statIcon(row.fat)}</td>
                                <td>${formatSignedNumber(row.bal)}</td>
                                <td>${formatSignedKg(row.kg)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
            <div class="diet-stats-total">
                <span>${translateDietText("Total calories:")} <strong>${formatSignedNumber(total.balance)}</strong></span>
                <span>${translateDietText("Total fat:")} <strong>${formatSignedKg(total.balance / FAT_KCAL_PER_KG)}</strong></span>
            </div>
        `;
    }

    function renderDietStats() {
        if (!el.statsLastSeven) return;
        renderStatsTable(el.statsLastSeven, completedLastSevenKeys());
    }

    function reportKeysForSelection() {
        const type = el.statsReportType?.value || "month";
        if (type === "year") {
            const year = Number(el.statsReportYear?.value) || new Date().getFullYear();
            return { title: translateDietText("Diet stats") + " " + year, keys: dateKeysBetween(year + "-01-01", year + "-12-31") };
        }
        if (type === "months") {
            const start = el.statsReportStartMonth?.value || inputDateValue(new Date()).slice(0, 7);
            const end = el.statsReportEndMonth?.value || start;
            const startKey = start + "-01";
            const endDate = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)), 0);
            return { title: translateDietText("Diet stats") + " " + formatStatsMonthLabel(start) + " - " + formatStatsMonthLabel(end), keys: dateKeysBetween(startKey, dateKeyFromDate(endDate)) };
        }
        const month = el.statsReportMonth?.value || inputDateValue(new Date()).slice(0, 7);
        const startKey = month + "-01";
        const endDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
        return { title: translateDietText("Diet stats") + " " + formatStatsMonthLabel(month), keys: dateKeysBetween(startKey, dateKeyFromDate(endDate)) };
    }

    function reportClass(value) {
        return value === 1 ? "ok" : value === 0 ? "bad" : "empty";
    }

    function reportValue(value) {
        if (value === null || value === undefined) return "---";
        return value ? "âœ“" : "X";
    }

    function escapeReportHtml(value) {
        return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    }

    function standaloneReportHtml(title, keys) {
        const rows = keys.map(key => statsRowForDisplay(key));
        const total = periodTotal(rows);
        const reportTitle = (user ? user + " " : "") + title;
        const safeTitle = escapeReportHtml(reportTitle);
        const rowHtml = rows.map(row => '<tr><td>' + escapeReportHtml(formatStatsDateLabel(row.d)) + '</td><td class="' + reportClass(row.cal) + '">' + reportValue(row.cal) + '</td><td class="' + reportClass(row.pro) + '">' + reportValue(row.pro) + '</td><td class="' + reportClass(row.car) + '">' + reportValue(row.car) + '</td><td class="' + reportClass(row.fat) + '">' + reportValue(row.fat) + '</td><td>' + formatSignedNumber(row.bal) + '</td><td>' + formatSignedKg(row.kg) + '</td></tr>').join("");
        return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + safeTitle + '</title><style>body{font-family:Arial,sans-serif;margin:24px;background:#f8fafc;color:#111827}h1{margin:0 0 6px}.muted{color:#64748b}.report-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}.total{display:flex;gap:12px;flex-wrap:wrap;font-weight:900}.total span{padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;background:white}table{width:100%;border-collapse:collapse;margin-top:18px;background:white}th,td{border:1px solid #d1d5db;padding:10px;text-align:center}th{background:#e5e7eb}.ok{color:#16a34a;font-weight:900}.bad{color:#dc2626;font-weight:900}.empty{color:#64748b}@media(max-width:640px){body{margin:14px}.report-top{display:block}.total{margin-top:12px}}</style></head><body><div class="report-top"><div><h1>' + safeTitle + '</h1><p class="muted">' + escapeReportHtml(translateDietText("Standalone GYMRAT diet stats report")) + '</p></div><div class="total"><span>' + escapeReportHtml(translateDietText("Total calories:")) + ' ' + formatSignedNumber(total.balance) + '</span><span>' + escapeReportHtml(translateDietText("Total fat:")) + ' ' + formatSignedKg(total.balance / FAT_KCAL_PER_KG) + '</span></div></div><table><thead><tr>' + escapedStatsHeaderHtml() + '</tr></thead><tbody>' + rowHtml + '</tbody></table></body></html>';
    }

    function openNativePicker(input) {
        if (!input) return;
        if (typeof input.showPicker === "function") {
            try {
                input.showPicker();
                return;
            } catch (error) {}
        }
        input.focus();
    }

    function ensureStatsMonthLabel(input) {
        if (!input || input.dataset.monthLabelBound === "true") return;
        input.dataset.monthLabelBound = "true";
        const label = document.createElement("span");
        label.className = "diet-stats-month-label";
        label.setAttribute("aria-live", "polite");
        input.insertAdjacentElement("afterend", label);
    }

    function updateStatsMonthLabels() {
        const isHebrew = getCurrentLanguage() === "he";
        document.querySelectorAll('.diet-stats-download-controls input[type="month"]').forEach(input => {
            ensureStatsMonthLabel(input);
            const label = input.nextElementSibling?.classList?.contains("diet-stats-month-label") ? input.nextElementSibling : null;
            if (!label) return;
            label.hidden = !isHebrew || !input.value;
            label.textContent = isHebrew && input.value ? formatStatsMonthLabel(input.value) : "";
        });
    }

    function initializeStatsReportControls() {
        const currentMonth = inputDateValue(new Date()).slice(0, 7);
        const currentYear = new Date().getFullYear();
        if (el.statsReportMonth && !el.statsReportMonth.value) el.statsReportMonth.value = currentMonth;
        if (el.statsReportStartMonth && !el.statsReportStartMonth.value) el.statsReportStartMonth.value = currentMonth;
        if (el.statsReportEndMonth && !el.statsReportEndMonth.value) el.statsReportEndMonth.value = currentMonth;
        if (el.statsReportYear && !el.statsReportYear.value) el.statsReportYear.value = String(currentYear);
        document.querySelectorAll("[data-stats-report-fields]").forEach(group => {
            group.hidden = group.dataset.statsReportFields !== (el.statsReportType?.value || "month");
        });
        document.querySelectorAll('.diet-stats-download-controls input[type="month"]').forEach(input => {
            if (input.dataset.pickerBound === "true") return;
            input.dataset.pickerBound = "true";
            input.addEventListener("click", () => openNativePicker(input));
            input.addEventListener("focus", () => openNativePicker(input));
            input.addEventListener("input", updateStatsMonthLabels);
            input.addEventListener("change", updateStatsMonthLabels);
        });
        updateStatsMonthLabels();
    }
    async function downloadStatsReport() {
        const report = reportKeysForSelection();
        const ok = typeof gymratConfirm === "function" ? await gymratConfirm("Download " + report.title + " as a standalone HTML report?") : confirm("Download " + report.title + " as a standalone HTML report?");
        if (!ok) return;
        const blob = new Blob([standaloneReportHtml(report.title, report.keys)], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".html";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function render() {
        renderItems();
        renderSummaryOnly();
        renderMyFoods();
        renderDietStats();
    }

    async function loadDiet() {
        user = localStorage.getItem("currentUser") || "";
        if (!user) {
            window.location.href = "index.html";
            return;
        }
        try {
            const savedLogVisibility = localStorage.getItem(getLogVisibilityKey());
            dietLogHidden = savedLogVisibility === null ? true : savedLogVisibility === "1";
        } catch (error) {
            dietLogHidden = true;
        }
        const draft = localStorage.getItem(getDraftKey());
        if (draft) {
            try { state = normalizeDiet(JSON.parse(draft)); } catch (error) { state = normalizeDiet(null); }
        }
        const localProfile = readLocalProfileDraft();
        if (localProfile?.isComplete && !state.profile?.isComplete) {
            state.profile = localProfile;
            state.calorieTarget = normalizeNumber(localProfile.calorieGoalMax || localProfile.calorieGoal) || state.calorieTarget;
            state.calorieTargetMin = normalizeNumber(localProfile.calorieGoalMin || localProfile.calorieGoal) || state.calorieTargetMin;
            state.calorieTargetMax = normalizeNumber(localProfile.calorieGoalMax || localProfile.calorieGoal) || state.calorieTargetMax;
            state.macroTargets = {
                protein: normalizeNumber(localProfile.proteinGoalMax || localProfile.proteinGoal) || state.macroTargets.protein,
                proteinMin: normalizeNumber(localProfile.proteinGoalMin || localProfile.proteinGoal) || state.macroTargets.proteinMin,
                proteinMax: normalizeNumber(localProfile.proteinGoalMax || localProfile.proteinGoal) || state.macroTargets.proteinMax,
                carbs: normalizeNumber(localProfile.carbGoalMax || localProfile.carbGoal) || state.macroTargets.carbs,
                carbsMin: normalizeNumber(localProfile.carbGoalMin || localProfile.carbGoal) || state.macroTargets.carbsMin,
                carbsMax: normalizeNumber(localProfile.carbGoalMax || localProfile.carbGoal) || state.macroTargets.carbsMax,
                fat: normalizeNumber(localProfile.fatGoalMax || localProfile.fatGoal) || state.macroTargets.fat,
                fatMin: normalizeNumber(localProfile.fatGoalMin || localProfile.fatGoal) || state.macroTargets.fatMin,
                fatMax: normalizeNumber(localProfile.fatGoalMax || localProfile.fatGoal) || state.macroTargets.fatMax
            };
        }
        if (typeof getUserSelections === "function") {
            try {
                const selections = await getUserSelections(user);
                state = normalizeDiet(selections?.diet || state);
                saveLocalDraft();
            } catch (error) {
                setStatus("Using saved device data");
            }
        }
        if (!state.profile?.isComplete) { window.location.href = "DietSetup.html"; return; }
        const archiveChanged = archiveCompletedDietDays();
        if (archiveChanged) await syncDietState();
        selectedDate = new Date();
        if (el.customDate) el.customDate.value = inputDateValue(selectedDate);
        updateVisibleDietDate("today");
        loadSelectedDateRecord();
    }

    function bindElements() {
        el.foodText = document.getElementById("foodTextInput");
        el.foodSearch = document.getElementById("dietFoodSearchInput");
        el.foodGrams = document.getElementById("dietFoodGramsInput");
        el.foodSearchPanel = document.getElementById("dietFoodSearchPanel");
        el.foodSearchClose = document.getElementById("closeDietFoodSearch");
        el.foodSearchResults = document.getElementById("dietFoodSearchResults");
        el.selectedFoodPanel = document.getElementById("dietSelectedFoodPanel");
        el.selectedFoodName = document.getElementById("dietSelectedFoodName");
        el.selectedFoodServing = document.getElementById("dietSelectedFoodServing");
        el.selectedFoodCalories = document.getElementById("dietSelectedFoodCalories");
        el.selectedFoodProtein = document.getElementById("dietSelectedFoodProtein");
        el.selectedFoodCarbs = document.getElementById("dietSelectedFoodCarbs");
        el.selectedFoodFat = document.getElementById("dietSelectedFoodFat");
        el.selectedFoodMode = document.getElementById("dietSelectedFoodMode");
        el.selectedFoodAmount = document.getElementById("dietSelectedFoodAmount");
        el.selectedFoodAmountLabel = document.getElementById("dietSelectedFoodAmountLabel");
        el.selectedEggSizeWrap = document.getElementById("dietSelectedEggSizeWrap");
        el.selectedEggSize = document.getElementById("dietSelectedEggSize");
        el.selectedFoodClose = document.getElementById("closeDietSelectedFood");
        el.selectedFoodLog = document.getElementById("logSelectedFoodButton");
        el.discardSelectedFoodButton = document.getElementById("discardSelectedFoodButton");
        el.ocrStatus = document.getElementById("dietOcrStatus");
        el.barcodeInput = document.getElementById("dietBarcodeInput");
        el.lookupBarcodeButton = document.getElementById("dietLookupBarcodeButton");
        el.openBarcodeScannerButton = document.getElementById("dietOpenBarcodeScannerButton");
        el.barcodeCameraPanel = document.getElementById("dietBarcodeCameraPanel");
        el.barcodeCameraVideo = document.getElementById("dietBarcodeCameraVideo");
        el.barcodeCameraCanvas = document.getElementById("dietBarcodeCameraCanvas");
        el.scanBarcodeFrameButton = document.getElementById("dietScanBarcodeFrameButton");
        el.closeBarcodeScannerButton = document.getElementById("dietCloseBarcodeScannerButton");
        el.ocrResultPanel = document.getElementById("dietOcrResultPanel");
        el.ocrFoodName = document.getElementById("dietOcrFoodName");
        el.ocrCalories = document.getElementById("dietOcrCalories");
        el.ocrProtein = document.getElementById("dietOcrProtein");
        el.ocrCarbs = document.getElementById("dietOcrCarbs");
        el.ocrFat = document.getElementById("dietOcrFat");
        el.ocrServingMode = document.getElementById("dietOcrServingMode");
        el.ocrAmount = document.getElementById("dietOcrAmount");
        el.ocrAmountLabel = document.getElementById("dietOcrAmountLabel");
        el.ocrSavePersonal = document.getElementById("dietOcrSavePersonal");
        el.saveSelectedFoodButton = document.getElementById("dietSaveSelectedFoodButton");
        el.saveOcrFoodButton = document.getElementById("dietSaveOcrFoodButton");
        el.myFoodsList = document.getElementById("dietMyFoodsList");
        el.myFoodsEmpty = document.getElementById("dietMyFoodsEmpty");
        el.statsLastSeven = document.getElementById("dietStatsLastSeven");
        el.statsReportType = document.getElementById("dietStatsReportType");
        el.statsReportMonth = document.getElementById("dietStatsReportMonth");
        el.statsReportStartMonth = document.getElementById("dietStatsReportStartMonth");
        el.statsReportEndMonth = document.getElementById("dietStatsReportEndMonth");
        el.statsReportYear = document.getElementById("dietStatsReportYear");
        el.statsDownloadButton = document.getElementById("dietStatsDownloadButton");
        el.ocrCalcCalories = document.getElementById("dietOcrCalcCalories");
        el.ocrCalcProtein = document.getElementById("dietOcrCalcProtein");
        el.ocrCalcCarbs = document.getElementById("dietOcrCalcCarbs");
        el.ocrCalcFat = document.getElementById("dietOcrCalcFat");
        el.ocrRawText = document.getElementById("dietOcrRawText");
        el.logOcrFoodButton = document.getElementById("dietLogOcrFoodButton");
        el.discardOcrResultButton = document.getElementById("dietDiscardOcrResultButton");
        el.customDate = document.getElementById("dietCustomDate");
        el.currentDateLabel = document.getElementById("dietCurrentDateLabel");
        el.items = document.getElementById("dietItems");
        el.itemCount = document.getElementById("dietItemCount");
        el.toggleItemsButton = document.getElementById("toggleDietItemsButton");
        el.status = document.getElementById("dietSaveStatus");        el.remaining = document.getElementById("dietRemaining");
        el.caloriesGoal = document.getElementById("dietCaloriesGoal");
        el.protein = document.getElementById("dietProtein");
        el.carbs = document.getElementById("dietCarbs");
        el.fat = document.getElementById("dietFat");
        el.caloriesCard = el.remaining?.closest(".diet-stat");
        el.proteinCard = el.protein?.closest(".diet-stat");
        el.carbsCard = el.carbs?.closest(".diet-stat");
        el.fatCard = el.fat?.closest(".diet-stat");
        el.proteinGoal = document.getElementById("dietProteinGoal");
        el.carbsGoal = document.getElementById("dietCarbsGoal");
        el.fatGoal = document.getElementById("dietFatGoal");

        el.estimateButton = document.getElementById("estimateFoodButton");
        el.estimateButton?.addEventListener("click", () => void estimateFromText());
        el.foodSearch?.addEventListener("focus", () => {
            setFoodSearchOpen(true);
            void loadFoodSearchData();
            renderFoodSearchResults();
        });
        el.foodSearch?.addEventListener("input", () => {
            setFoodSearchOpen(true);
            void loadFoodSearchData();
            renderFoodSearchResults();
        });
        el.foodGrams?.addEventListener("input", renderFoodSearchResults);
        el.selectedFoodMode?.addEventListener("change", resetServingAmountForMode);
        el.selectedFoodAmount?.addEventListener("input", updateSelectedFoodPreview);
        el.selectedEggSize?.addEventListener("change", updateSelectedFoodPreview);
        el.selectedFoodClose?.addEventListener("click", closeSelectedFoodPanel);
        el.selectedFoodLog?.addEventListener("click", () => void logSelectedFood());
        el.saveSelectedFoodButton?.addEventListener("click", () => void saveSelectedFoodToMyFoods());
        el.discardSelectedFoodButton?.addEventListener("click", closeSelectedFoodPanel);
        el.lookupBarcodeButton?.addEventListener("click", () => void lookupBarcodeProduct());
        el.barcodeInput?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                void lookupBarcodeProduct();
            }
        });
        el.openBarcodeScannerButton?.addEventListener("click", () => void openBarcodeScanner());
        el.scanBarcodeFrameButton?.addEventListener("click", () => void scanBarcodeFrame());
        el.closeBarcodeScannerButton?.addEventListener("click", () => {
            stopBarcodeCamera();
            setOcrStatus("");
        });
        [el.ocrFoodName, el.ocrCalories, el.ocrProtein, el.ocrCarbs, el.ocrFat, el.ocrAmount].forEach(input => {
            input?.addEventListener("input", updateOcrCalculation);
        });
        el.ocrServingMode?.addEventListener("change", resetOcrAmountForMode);
        el.logOcrFoodButton?.addEventListener("click", () => void logOcrFood());
        el.saveOcrFoodButton?.addEventListener("click", () => void saveOcrFoodToMyFoods());
        el.discardOcrResultButton?.addEventListener("click", () => {
            clearBarcodeResult();
            setOcrStatus("");
        });
        el.foodSearchClose?.addEventListener("click", () => setFoodSearchOpen(false));
        document.addEventListener("click", (event) => {
            if (!event.target.closest(".diet-food-search")) setFoodSearchOpen(false);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") setFoodSearchOpen(false);
        });
        window.addEventListener("gymrat-language-change", () => {
            renderFoodSearchResults();
            updateSelectedFoodPreview();
            render();
            updateStatsMonthLabels();
        });
        document.getElementById("addManualItemButton")?.addEventListener("click", addManualItem);
        document.getElementById("removeDietDayButton")?.addEventListener("click", () => void deleteDay());
        document.getElementById("clearDietButton")?.addEventListener("click", clearForm);
        document.getElementById("saveDietDayButton")?.addEventListener("click", () => void saveDay());
        el.myFoodsList?.addEventListener("input", event => {
            const card = event.target.closest(".diet-my-food-card");
            if (card) updateMyFoodCard(card);
        });
        el.myFoodsList?.addEventListener("change", event => {
            const card = event.target.closest(".diet-my-food-card");
            if (card) {
                const amount = card.querySelector("[data-my-food-amount]");
                const mode = card.querySelector("[data-my-food-mode]")?.value || "grams";
                if (event.target.matches("[data-my-food-mode]") && amount) amount.value = mode === "grams" ? "100" : "1";
                updateMyFoodCard(card);
            }
        });
        el.myFoodsList?.addEventListener("click", event => {
            const logButton = event.target.closest("[data-my-food-log]");
            if (logButton) void logMyFood(logButton.closest(".diet-my-food-card"));
            const deleteButton = event.target.closest("[data-my-food-delete]");
            if (deleteButton) void deleteMyFood(deleteButton.closest(".diet-my-food-card"));
        });
        el.statsDownloadButton?.addEventListener("click", () => void downloadStatsReport());
        initializeStatsReportControls();
        el.statsReportType?.addEventListener("change", () => {
            document.querySelectorAll("[data-stats-report-fields]").forEach(group => {
                group.hidden = group.dataset.statsReportFields !== el.statsReportType.value;
            });
        });
        document.querySelectorAll(".diet-date-button").forEach(button => {
            button.addEventListener("click", () => setDateChoice(button.dataset.dateChoice));
        });
        el.customDate?.addEventListener("change", () => setDateChoice("custom"));
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindElements();
        void loadFoodSearchData();
        void loadDiet();
    });
})();





























