(function () {
    "use strict";
    var storage = {
        getItem: function (key) { try {
            return window.localStorage.getItem(key);
        }
        catch (e) {
            return null;
        } },
        setItem: function (key, value) { try {
            window.localStorage.setItem(key, value);
        }
        catch (e) { } },
        removeItem: function (key) { try {
            window.localStorage.removeItem(key);
        }
        catch (e) { } }
    };
    var DATA = window.MONSTER_DATA
        .split("\n")
        .map(function (l) { return l.trim(); })
        .filter(Boolean)
        .map(function (line, i) {
        var p = line.split("|");
        var step = parseInt(p[0], 10);
        return {
            id: i + 1,
            step: step,
            type: (step <= 3 || step === 19) ? "boss" : "archimonstre",
            name: p[1],
            base: p[2] || "",
            level: p[3] || "-",
            zones: p[4] ? p[4].split(";").map(function (z) { return z.trim(); }).filter(Boolean) : [],
            dungeon: p[5] || ""
        };
    });
    var STORAGE_KEY = "eternelle_moisson_progress_v2";
    var TYPE_LABELS = { boss: "Boss", archimonstre: "Archimonstre" };
    var LANGS = ["fr", "en", "es", "de", "pt"];
    var LOCALES = { fr: "fr", en: "en", es: "es", de: "de", pt: "pt" };
    var savedLang = storage.getItem("eternelle_moisson_lang") || "fr";
    var currentLang = LANGS.indexOf(savedLang) !== -1 ? savedLang : "fr";

    // ---- Traductions : un fichier JSON par langue (translations/<lang>.json) ----
    // Structure : { ui:{...}, names:{FR:trad}, bases:{FR:trad}, zones:{FR:trad}, dungeons:{FR:trad} }
    // Les clés sont le texte français exact de monsters.js. Texte absent => le français est affiché.
    var I18N = {};
    var I18N_PROMISES = {};
    var I18N_CATEGORIES = ["names", "bases", "zones", "dungeons"];

    function translationKey(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/[^a-z0-9]/g, "");
    }

    function prepareLang(data) {
        // Table normalisée (sans accents/casse/ponctuation) en secours si une clé diffère légèrement
        data.norm = {};
        I18N_CATEGORIES.forEach(function (cat) {
            data.norm[cat] = {};
            var map = data[cat] || {};
            Object.keys(map).forEach(function (k) { data.norm[cat][translationKey(k)] = map[k]; });
        });
        return data;
    }

    // Secours pour file:// : translations/<lang>.js (même contenu que le JSON) chargé via <script>
    function loadLangScript(lang) {
        return new Promise(function (resolve, reject) {
            window.__I18N = window.__I18N || {};
            if (window.__I18N[lang])
                return resolve(window.__I18N[lang]);
            var el = document.createElement("script");
            el.src = "./translations/" + lang + ".js";
            el.onload = function () { window.__I18N[lang] ? resolve(window.__I18N[lang]) : reject(new Error("translations/" + lang + ".js vide")); };
            el.onerror = function () { reject(new Error("Impossible de charger translations/" + lang + ".js")); };
            document.head.appendChild(el);
        });
    }

    function loadLang(lang) {
        if (I18N_PROMISES[lang])
            return I18N_PROMISES[lang];
        I18N_PROMISES[lang] = Promise.resolve()
            .then(function () { return fetch("./translations/" + lang + ".json"); })
            .then(function (response) {
                if (!response.ok)
                    throw new Error("HTTP " + response.status + " pour translations/" + lang + ".json");
                return response.json();
            })
            .catch(function () { return loadLangScript(lang); })
            .then(function (data) {
                I18N[lang] = prepareLang(data);
                return I18N[lang];
            })
            .catch(function (error) {
                delete I18N_PROMISES[lang];
                throw error;
            });
        return I18N_PROMISES[lang];
    }

    function showLoadError(error) {
        console.warn("Impossible de charger les traductions. Vérifie que le dossier translations/ (.json et .js) est à côté de index.html.", error);
        if (document.getElementById("i18nError"))
            return;
        var box = document.createElement("div");
        box.id = "i18nError";
        box.style.cssText = "background:#5a1d1d;color:#fff;padding:10px 14px;border-radius:8px;margin:12px 0;font:600 14px Nunito,sans-serif;";
        box.textContent = "Translations could not be loaded: " + (error && error.message ? error.message : error) + ". Make sure the translations/ folder (fr/en/es/de/pt .json and .js) is next to index.html.";
        var wrap = document.querySelector(".wrap");
        if (wrap)
            wrap.insertBefore(box, wrap.firstChild);
    }

    function lookupLoc(category, name) {
        var d = I18N[currentLang];
        if (!d || !name)
            return null;
        var map = d[category];
        if (map && Object.prototype.hasOwnProperty.call(map, name) && map[name])
            return map[name];
        var hit = d.norm && d.norm[category] && d.norm[category][translationKey(name)];
        return hit || null;
    }

    function localizedName(name) { return lookupLoc("names", name) || name; }
    function localizedBase(name) { return lookupLoc("bases", name) || lookupLoc("names", name) || name; }
    function localizedDungeon(name) { return lookupLoc("dungeons", name) || lookupLoc("zones", name) || name; }
    function localizedZone(name) { return lookupLoc("zones", name) || lookupLoc("dungeons", name) || name; }

    function tr(key) {
        var cur = I18N[currentLang], fr = I18N.fr;
        return (cur && cur.ui && cur.ui[key]) || (fr && fr.ui && fr.ui[key]) || key;
    }

    function stepLabel(step) {
        if (step === 19)
            return tr("finalStep");
        return tr("stepWord") + " " + step;
    }

    function populateZoneFilter() {
        var select = document.getElementById("zoneFilter");
        var previous = state.zone;
        var zones = Object.keys(availableZones).sort(function (a, b) {
            return localizedZone(a).localeCompare(localizedZone(b), LOCALES[currentLang] || "fr");
        });
        select.innerHTML = "";
        var all = document.createElement("option");
        all.value = "all";
        all.textContent = tr("allZones");
        select.appendChild(all);
        zones.forEach(function (zone) {
            var option = document.createElement("option");
            option.value = zone;
            option.textContent = localizedZone(zone);
            select.appendChild(option);
        });
        select.value = previous;
        if (select.value !== previous) { state.zone = "all"; select.value = "all"; }
    }

    function applyLanguage() {
        document.documentElement.lang = currentLang;
        document.title = tr("title") + " — " + tr("ochre");
        document.querySelectorAll(".language-switch [data-lang]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-lang") === currentLang); });
        var sw = document.querySelector(".language-switch");
        if (sw)
            sw.setAttribute("aria-label", tr("langAria"));
        var title = document.getElementById("siteTitle");
        if (title)
            title.innerHTML = tr("titleHtml");
        var textMap = { subtitle: "subtitle", bossLabel: "bosses", archiLabel: "archi", totalLabel: "total", charHint: "switchChar", stepsHint: "switchStep", hideDoneText: "hide", exportBtn: "export", importBtn: "import", emptyState: "empty", footerText: "footer", footerQuest: "footerQuest", kofiText: "kofi", kofiLink: "support" };
        Object.keys(textMap).forEach(function (id) { var el = document.getElementById(id); if (el)
            el.textContent = tr(textMap[id]); });
        disarmReset();
        [["charactersTitle", "characters"], ["stepsTitle", "steps"], ["bestiaryTitle", "bestiary"]].forEach(function (pair) { var el = document.getElementById(pair[0]); if (el)
            el.innerHTML = '<span class="rune">◆</span> ' + tr(pair[1]); });
        var si = document.getElementById("searchInput");
        if (si)
            si.placeholder = tr("search");
        var type = document.getElementById("typeFilter");
        if (type) {
            type.options[0].text = tr("allTypes");
            type.options[1].text = tr("boss");
            type.options[2].text = tr("archimonstre");
        }
        var sf = document.getElementById("stepFilter");
        if (sf && sf.options.length) {
            sf.options[0].text = tr("allSteps");
            for (var oi = 1; oi < sf.options.length; oi++)
                sf.options[oi].text = stepLabel(parseInt(sf.options[oi].value, 10));
        }
        populateZoneFilter();
        document.querySelectorAll("thead th").forEach(function (th, i) { var vals = ["✓", "monster", "type", "step", "level", "base", "zones"]; if (i > 0)
            th.textContent = tr(vals[i]); });
        renderAll();
    }

    function setLanguage(lang) {
        // Le français sert toujours de langue de secours pour les textes d'interface
        return Promise.all([loadLang("fr"), loadLang(lang)]).then(function () {
            currentLang = lang;
            storage.setItem("eternelle_moisson_lang", lang);
            var err = document.getElementById("i18nError");
            if (err)
                err.parentNode.removeChild(err);
            applyLanguage();
        }).catch(showLoadError);
    }

    document.querySelectorAll(".language-switch [data-lang]").forEach(function (b) { b.addEventListener("click", function () { setLanguage(b.getAttribute("data-lang")); }); });
    var CHAR_KEY = "eternelle_moisson_chars_v3";

    function newId() {
        return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function loadStore() {
        try {
            var raw = storage.getItem(CHAR_KEY);
            if (raw) {
                var st = JSON.parse(raw);
                if (st && Array.isArray(st.chars) && st.chars.length) {
                    if (!st.chars.some(function (c) { return c.id === st.active; }))
                        st.active = st.chars[0].id;
                    return st;
                }
            }
        }
        catch (e) {
            console.warn("Impossible de lire les personnages :", e);
        }
        // Premier lancement : on récupère l'ancienne progression (si elle existe) dans le personnage par défaut
        var old = {};
        try {
            var rawOld = storage.getItem(STORAGE_KEY);
            if (rawOld)
                old = JSON.parse(rawOld) || {};
        }
        catch (e) { }
        var id = newId();
        return { active: id, chars: [{ id: id, name: "", progress: old }] };
    }

    function saveProgress() {
        try {
            storage.setItem(CHAR_KEY, JSON.stringify(store));
        }
        catch (e) {
            console.warn("Impossible de sauvegarder la progression :", e);
        }
    }
    var store = loadStore();

    function activeChar() {
        for (var i = 0; i < store.chars.length; i++) {
            if (store.chars[i].id === store.active)
                return store.chars[i];
        }
        return store.chars[0];
    }

    function getEntry(id) {
        var key = String(id);
        var pr = activeChar().progress;
        if (!pr[key])
            pr[key] = { captured: false };
        return pr[key];
    }

    function applyImport(imported) {
        if (Array.isArray(imported.chars) && imported.chars.length) {
            var chars = imported.chars.map(function (c) {
                return {
                    id: (c && typeof c.id === "string" && c.id) ? c.id : newId(),
                    name: (c && typeof c.name === "string") ? c.name.slice(0, 30) : "",
                    progress: (c && c.progress && typeof c.progress === "object") ? c.progress : {}
                };
            });
            store = { active: chars[0].id, chars: chars };
            if (typeof imported.active === "string" && chars.some(function (c) { return c.id === imported.active; })) {
                store.active = imported.active;
            }
        }
        else {
            // ancien format : une simple progression, appliquée au personnage actif
            activeChar().progress = imported;
        }
    }
    var state = { search: "", type: "all", step: "all", zone: "all", hideDone: false };
    var steps = [];
    (function buildSteps() {
        var map = {};
        DATA.forEach(function (m) {
            if (!map[m.step])
                map[m.step] = { step: m.step, types: {}, items: [] };
            map[m.step].items.push(m);
            map[m.step].types[m.type] = true;
        });
        Object.keys(map)
            .map(Number)
            .sort(function (a, b) { return a - b; })
            .forEach(function (s) { steps.push(map[s]); });
    })();

    var ringFill = document.getElementById("ringFill");
    var overallPct = document.getElementById("overallPct");
    var overallCnt = document.getElementById("overallCnt");
    var bossBar = document.getElementById("bossBar");
    var archiBar = document.getElementById("archiBar");
    var totalBar = document.getElementById("totalBar");
    var bossCount = document.getElementById("bossCount");
    var archiCount = document.getElementById("archiCount");
    var totalCount = document.getElementById("totalCount");
    var RING_CIRC = 2 * Math.PI * 42;

    function computeStats() {
        var totals = { boss: 0, archimonstre: 0 };
        var done = { boss: 0, archimonstre: 0 };
        DATA.forEach(function (m) {
            totals[m.type]++;
            if (getEntry(m.id).captured)
                done[m.type]++;
        });
        return { totals: totals, done: done };
    }

    function renderStats() {
        var s = computeStats();
        var totalAll = s.totals.boss + s.totals.archimonstre;
        var doneAll = s.done.boss + s.done.archimonstre;
        var pct = totalAll ? Math.round((doneAll / totalAll) * 100) : 0;
        overallPct.textContent = pct + "%";
        overallCnt.textContent = doneAll + " / " + totalAll;
        var dash = (pct / 100) * RING_CIRC;
        ringFill.setAttribute("stroke-dasharray", dash.toFixed(1) + " " + RING_CIRC.toFixed(1));
        bossCount.textContent = s.done.boss + " / " + s.totals.boss;
        archiCount.textContent = s.done.archimonstre + " / " + s.totals.archimonstre;
        totalCount.textContent = doneAll + " / " + totalAll;
        bossBar.style.width = (s.totals.boss ? (s.done.boss / s.totals.boss) * 100 : 0) + "%";
        archiBar.style.width = (s.totals.archimonstre ? (s.done.archimonstre / s.totals.archimonstre) * 100 : 0) + "%";
        totalBar.style.width = pct + "%";
    }
    var stepsGrid = document.getElementById("stepsGrid");
    var stepFilterSelect = document.getElementById("stepFilter");

    function stepDominantType(stepObj) {
        if (stepObj.types.boss)
            return "boss";
        return "archimonstre";
    }

    function renderStepsGrid() {
        stepsGrid.innerHTML = "";
        steps.forEach(function (s) {
            var doneCount = s.items.filter(function (m) { return getEntry(m.id).captured; }).length;
            var pct = Math.round((doneCount / s.items.length) * 100);
            var card = document.createElement("button");
            card.type = "button";
            card.className = "step-card" + (state.step === String(s.step) ? " active" : "") + (pct === 100 ? " done" : "");
            card.setAttribute("data-step", s.step);
            var badgeType = stepDominantType(s);
            card.innerHTML =
                '<div class="st-top">' +
                    '<span class="st-badge ' + badgeType + '">' + (badgeType === "boss" ? tr("boss") : tr("archimonstre")) + '</span>' +
                    '<span>' + doneCount + '/' + s.items.length + '</span>' +
                    '</div>' +
                    '<div class="st-label">' + stepLabel(s.step) + '</div>' +
                    '<div class="mini-track"><div class="mini-fill" style="width:' + pct + '%"></div></div>';
            card.addEventListener("click", function () {
                state.step = (state.step === String(s.step)) ? "all" : String(s.step);
                stepFilterSelect.value = state.step;
                renderAll();
            });
            stepsGrid.appendChild(card);
        });
    }

    function populateStepFilter() {
        steps.forEach(function (s) {
            var opt = document.createElement("option");
            opt.value = String(s.step);
            opt.textContent = stepLabel(s.step);
            stepFilterSelect.appendChild(opt);
        });
    }
    var zoneFilterSelect = document.getElementById("zoneFilter");
    var availableZones = {};

    DATA.forEach(function (m) { m.zones.forEach(function (zone) { availableZones[zone] = true; }); });
    var tableBody = document.getElementById("tableBody");
    var emptyState = document.getElementById("emptyState");
    var resultsCount = document.getElementById("resultsCount");

    function matchesFilters(m) {
        if (state.type !== "all" && m.type !== state.type)
            return false;
        if (state.step !== "all" && String(m.step) !== state.step)
            return false;
        if (state.zone !== "all" && m.zones.indexOf(state.zone) === -1)
            return false;
        var entry = getEntry(m.id);
        if (state.hideDone && entry.captured)
            return false;
        if (state.search) {
            var q = translationKey(state.search);
            var hay = (m.name + " " + localizedName(m.name) + " " + (m.base || "") + " " + localizedBase(m.base || "") + " " + m.zones.join(" ") + " " + m.zones.map(localizedZone).join(" ") + " " + " " + (m.dungeon || "") + " " + localizedDungeon(m.dungeon || ""));
            hay = translationKey(hay);
            if (hay.indexOf(q) === -1)
                return false;
        }
        return true;
    }

    function renderTable() {
        var filtered = DATA.filter(matchesFilters);
        resultsCount.textContent = filtered.length + " / " + DATA.length + " " + tr("monsters");
        if (filtered.length === 0) {
            tableBody.innerHTML = "";
            emptyState.style.display = "block";
            return;
        }
        emptyState.style.display = "none";
        var frag = document.createDocumentFragment();
        filtered.forEach(function (m) { frag.appendChild(buildRow(m)); });
        tableBody.innerHTML = "";
        tableBody.appendChild(frag);
    }

    function buildRow(m) {
        var entry = getEntry(m.id);
        var row = document.createElement("tr");
        row.className = (entry.captured ? "captured " : "") + (m.step % 2 === 0 ? "step-even" : "step-odd");
        row.setAttribute("data-id", m.id);
        var tdChk = document.createElement("td");
        tdChk.className = "chk-cell";
        var chk = document.createElement("span");
        chk.className = "chk" + (entry.captured ? " checked" : "");
        chk.setAttribute("role", "checkbox");
        chk.setAttribute("aria-checked", entry.captured ? "true" : "false");
        chk.tabIndex = 0;
        chk.addEventListener("click", function () { toggleCaptured(m.id); });
        chk.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCaptured(m.id);
            }
        });
        tdChk.appendChild(chk);
        row.appendChild(tdChk);
        var tdName = document.createElement("td");
        var nameSpan = document.createElement("span");
        nameSpan.className = "mon-name";
        nameSpan.textContent = localizedName(m.name);
        tdName.appendChild(nameSpan);
        row.appendChild(tdName);
        var tdType = document.createElement("td");
        var badge = document.createElement("span");
        badge.className = "type-badge " + m.type;
        badge.textContent = m.type === "boss" ? tr("boss") : tr("archimonstre");
        tdType.appendChild(badge);
        row.appendChild(tdType);
        var tdStep = document.createElement("td");
        tdStep.className = "step-cell";
        tdStep.textContent = m.step === 19 ? "19 (" + tr("final") + ")" : String(m.step);
        row.appendChild(tdStep);
        var tdLvl = document.createElement("td");
        tdLvl.className = "step-cell lvl-cell";
        tdLvl.textContent = m.level;
        row.appendChild(tdLvl);
        var tdBase = document.createElement("td");
        tdBase.className = "base-cell" + (m.base ? "" : " none");
        tdBase.textContent = m.base ? localizedBase(m.base) : "-";
        row.appendChild(tdBase);
        var tdZones = document.createElement("td");
        tdZones.className = "zone-cell" + (m.zones.length || (m.type === "boss" && m.dungeon) ? "" : " none");
        var zoneTags = document.createElement("div");
        zoneTags.className = "zone-tags";
        m.zones.forEach(function (zone) {
            var tag = document.createElement("span");
            tag.className = "zone-tag";
            tag.textContent = localizedZone(zone);
            zoneTags.appendChild(tag);
        });
        if (m.type === "boss" && m.dungeon) {
            var dungeonTag = document.createElement("span");
            dungeonTag.className = "zone-tag dungeon-tag";
            dungeonTag.textContent = localizedDungeon(m.dungeon);
            zoneTags.appendChild(dungeonTag);
        }
        if (zoneTags.childNodes.length) {
            tdZones.appendChild(zoneTags);
        }
        else {
            tdZones.textContent = "-";
        }
        row.appendChild(tdZones);
        return row;
    }

    function toggleCaptured(id) {
        var entry = getEntry(id);
        entry.captured = !entry.captured;
        saveProgress();
        renderAll();
        if (entry.captured) {
            // Balayage horizontal de la ligne qu'on vient de valider
            var row = tableBody.querySelector('tr[data-id="' + id + '"]');
            if (row) {
                row.classList.add("sweep-in");
                row.addEventListener("animationend", function onEnd(e) {
                    if (e.target !== row)
                        return;
                    row.classList.remove("sweep-in");
                    row.removeEventListener("animationend", onEnd);
                });
            }
        }
    }
    var searchInput = document.getElementById("searchInput");
    var typeFilter = document.getElementById("typeFilter");
    var hideDoneCheckbox = document.getElementById("hideDoneCheckbox");
    var hideDoneToggle = document.getElementById("hideDoneToggle");

    searchInput.addEventListener("input", debounce(function () {
        state.search = searchInput.value.trim();
        renderTable();
    }, 120));
    typeFilter.addEventListener("change", function () {
        state.type = typeFilter.value;
        renderTable();
    });
    stepFilterSelect.addEventListener("change", function () {
        state.step = stepFilterSelect.value;
        renderStepsGrid();
        renderTable();
    });
    zoneFilterSelect.addEventListener("change", function () {
        state.zone = zoneFilterSelect.value;
        renderTable();
    });
    hideDoneCheckbox.addEventListener("change", function () {
        state.hideDone = hideDoneCheckbox.checked;
        hideDoneToggle.classList.toggle("active", state.hideDone);
        renderTable();
    });

    function debounce(fn, wait) {
        var t;
        return function () {
            var args = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(null, args); }, wait);
        };
    }
    document.getElementById("exportBtn").addEventListener("click", function () {
        var blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "eternelle-moisson-progression.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    var importFile = document.getElementById("importFile");
    document.getElementById("importBtn").addEventListener("click", function () {
        importFile.click();
    });
    importFile.addEventListener("change", function () {
        var file = importFile.files[0];
        if (!file)
            return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var imported = JSON.parse(reader.result);
                if (typeof imported !== "object" || imported === null)
                    throw new Error("format invalide");
                applyImport(imported);
                saveProgress();
                renderAll();
            }
            catch (e) {
                alert(tr("importInvalid"));
            }
        };
        reader.readAsText(file);
        importFile.value = "";
    });
    var resetBtn = document.getElementById("resetBtn");
    var resetTimer = null;

    function disarmReset() {
        clearTimeout(resetTimer);
        resetTimer = null;
        resetBtn.textContent = tr("reset");
    }
    resetBtn.addEventListener("click", function () {
        if (!resetTimer) {
            resetBtn.textContent = tr("confirm");
            resetTimer = setTimeout(disarmReset, 3000);
            return;
        }
        disarmReset();
        activeChar().progress = {};
        saveProgress();
        renderAll();
    });
    var charTabs = document.getElementById("charTabs");

    function countDone(ch) {
        var n = 0;
        DATA.forEach(function (m) {
            var e = ch.progress[String(m.id)];
            if (e && e.captured)
                n++;
        });
        return n;
    }
    var editingId = null;
    var pendingDeleteId = null;

    function renameChar(ch) {
        editingId = ch.id;
        store.active = ch.id;
        pendingDeleteId = null;
        renderAll();
    }

    function addChar() {
        var ch = { id: newId(), name: "", progress: {} };
        store.chars.push(ch);
        store.active = ch.id;
        saveProgress();
        renderAll();
        renameChar(ch);
    }

    function deleteChar(ch) {
        if (store.chars.length <= 1)
            return;
        pendingDeleteId = null;
        store.chars = store.chars.filter(function (c) { return c.id !== ch.id; });
        if (store.active === ch.id)
            store.active = store.chars[0].id;
        saveProgress();
        renderAll();
    }

    function renderChars() {
        charTabs.innerHTML = "";
        store.chars.forEach(function (ch) {
            var done = countDone(ch);
            var pct = Math.round((done / DATA.length) * 100);
            var isActive = ch.id === store.active;
            var tab = document.createElement("div");
            tab.className = "char-tab" + (isActive ? " active" : "") + (pct === 100 ? " done" : "");
            tab.setAttribute("role", "button");
            tab.setAttribute("aria-pressed", isActive ? "true" : "false");
            tab.tabIndex = 0;
            var top = document.createElement("div");
            top.className = "ct-top";
            var editing = editingId === ch.id;
            if (editing) {
                var inp = document.createElement("input");
                inp.type = "text";
                inp.className = "ct-input";
                inp.maxLength = 30;
                inp.value = ch.name || "";
                inp.placeholder = tr("name");
                inp.setAttribute("aria-label", tr("name"));
                var finished = false;
                inp.addEventListener("click", function (e) { e.stopPropagation(); });
                inp.addEventListener("dblclick", function (e) { e.stopPropagation(); });
                inp.addEventListener("keydown", function (e) {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                        e.preventDefault();
                        if (finished)
                            return;
                        finished = true;
                        ch.name = inp.value.trim().slice(0, 30);
                        editingId = null;
                        saveProgress();
                        renderAll();
                    }
                    else if (e.key === "Escape") {
                        e.preventDefault();
                        if (finished)
                            return;
                        finished = true;
                        editingId = null;
                        renderChars();
                    }
                });
                inp.addEventListener("blur", function () {
                    if (finished)
                        return;
                    finished = true;
                    ch.name = inp.value.trim().slice(0, 30);
                    editingId = null;
                    saveProgress();
                    renderAll();
                });
                top.appendChild(inp);
                setTimeout(function () { inp.focus(); inp.select(); }, 0);
            }
            else {
                var nm = document.createElement("span");
                nm.className = "ct-name" + (ch.name ? "" : " unnamed");
                nm.textContent = ch.name || tr("unnamed");
                nm.title = tr("renameDbl");
                nm.addEventListener("dblclick", function (e) { e.stopPropagation(); renameChar(ch); });
                top.appendChild(nm);
            }
            if (isActive && !editing) {
                var acts = document.createElement("span");
                acts.className = "ct-actions";
                var ren = document.createElement("button");
                ren.type = "button";
                ren.className = "ct-btn";
                ren.textContent = "✎";
                ren.title = tr("rename");
                ren.setAttribute("aria-label", tr("rename"));
                ren.addEventListener("click", function (e) { e.stopPropagation(); renameChar(ch); });
                acts.appendChild(ren);
                if (store.chars.length > 1) {
                    var del = document.createElement("button");
                    var armed = pendingDeleteId === ch.id;
                    del.type = "button";
                    del.className = "ct-btn danger" + (armed ? " confirm" : "");
                    del.textContent = armed ? tr("sure") : "×";
                    del.title = armed ? tr("deleteConfirm") : tr("delete");
                    del.setAttribute("aria-label", tr("delete"));
                    del.addEventListener("click", function (e) {
                        e.stopPropagation();
                        if (pendingDeleteId === ch.id) {
                            deleteChar(ch);
                            return;
                        }
                        pendingDeleteId = ch.id;
                        renderChars();
                        setTimeout(function () {
                            if (pendingDeleteId === ch.id) {
                                pendingDeleteId = null;
                                renderChars();
                            }
                        }, 3000);
                    });
                    acts.appendChild(del);
                }
                top.appendChild(acts);
            }
            tab.appendChild(top);
            var track = document.createElement("div");
            track.className = "mini-track";
            var fill = document.createElement("div");
            fill.className = "mini-fill";
            fill.style.width = pct + "%";
            track.appendChild(fill);
            tab.appendChild(track);
            var cnt = document.createElement("div");
            cnt.className = "ct-count";
            cnt.textContent = done + " / " + DATA.length;
            tab.appendChild(cnt);
            function select() {
                if (store.active === ch.id)
                    return;
                store.active = ch.id;
                pendingDeleteId = null;
                saveProgress();
                renderAll();
            }
            tab.addEventListener("click", select);
            tab.addEventListener("keydown", function (e) {
                if (e.target !== tab)
                    return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select();
                }
            });
            charTabs.appendChild(tab);
        });
        var add = document.createElement("button");
        add.type = "button";
        add.className = "char-add";
        add.textContent = "+";
        add.title = tr("add");
        add.setAttribute("aria-label", tr("add"));
        add.addEventListener("click", addChar);
        charTabs.appendChild(add);
    }

    function renderAll() {
        renderChars();
        renderStats();
        renderStepsGrid();
        renderTable();
    }
    // Démarrage : charge fr + langue sauvegardée, puis construit les filtres et affiche tout
    Promise.all([loadLang("fr"), loadLang(currentLang)]).then(function () {
        populateStepFilter();
        applyLanguage();
    }).catch(function (error) {
        showLoadError(error);
    });
})();
