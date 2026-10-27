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
    var currentLang = storage.getItem("eternelle_moisson_lang") || "fr";
    var TRANSLATIONS = window.TRANSLATIONS || {};
    var translationFilesLoaded = false;
    var UI = {};
    var NAME_MAP = {};
    var BASE_MAP = {};
    var DUNGEON_MAP = {};

    function initializeTranslations() {
        var lang = currentLang || "fr";
        UI = { fr: TRANSLATIONS.fr.ui, en: TRANSLATIONS.en.ui, es: TRANSLATIONS.es.ui };
        NAME_MAP = { fr: TRANSLATIONS.fr.names, en: TRANSLATIONS.en.names, es: TRANSLATIONS.es.names };
        BASE_MAP = { fr: TRANSLATIONS.fr.baseMonsters, en: TRANSLATIONS.en.baseMonsters, es: TRANSLATIONS.es.baseMonsters };
        DUNGEON_MAP = { fr: TRANSLATIONS.fr.dungeons, en: TRANSLATIONS.en.dungeons, es: TRANSLATIONS.es.dungeons };
    }
    initializeTranslations();

    function localizedName(name) {
        return (NAME_MAP[currentLang] && NAME_MAP[currentLang][name]) || name;
    }

    function localizedBase(name) {
        return (BASE_MAP[currentLang] && BASE_MAP[currentLang][name]) || name;
    }

    function localizedDungeon(name) {
        return (DUNGEON_MAP[currentLang] && DUNGEON_MAP[currentLang][name]) || name;
    }

    function localizedZone(name) {
        return ((TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang].zones) || {})[name] || name;
    }

    function tr(key) {
        return (UI[currentLang] || UI.fr)[key] || key;
    }

    function applyLanguage() {
        document.documentElement.lang = currentLang;
        document.title = tr("title") + " — Dofus Ocre";
    
    document.querySelectorAll("[data-lang]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-lang") === currentLang); });
        var title = document.getElementById("siteTitle");
        if (title)
            title.innerHTML = '<img src="./otomai-by-rengiku.png" alt="" class="site-icon">' + (currentLang === "fr" ? "L'Éternelle <em>Moisson</em>" : currentLang === "en" ? "<em>Eternal Harvest</em>" : "<em>La eterna cosecha</em>");
        var textMap = { subtitle: "subtitle", bossLabel: "bosses", archiLabel: "archi", totalLabel: "total", charHint: "switchChar", stepsHint: "switchStep", hideDoneText: "hide", exportBtn: "export", importBtn: "import", resetBtn: "reset", emptyState: "empty", footerText: "footer", kofiText: "kofi", kofiLink: "support" };
        Object.keys(textMap).forEach(function (id) { var el = document.getElementById(id); if (el)
            el.textContent = tr(textMap[id]); });
        [["charactersTitle", "characters"], ["stepsTitle", "steps"], ["bestiaryTitle", "bestiary"]].forEach(function (pair) { var el = document.getElementById(pair[0]); if (el)
            el.innerHTML = '<span class="rune">◆</span> ' + tr(pair[1]); });
        var si = document.getElementById("searchInput");
        if (si)
            si.placeholder = tr("search");
        var allOptions = document.querySelectorAll("#stepFilter option");
        for (var oi = 1; oi < allOptions.length; oi++)
            allOptions[oi].textContent = currentLang === "fr" ? "Étape " + allOptions[oi].value : currentLang === "en" ? "Step " + allOptions[oi].value : "Etapa " + allOptions[oi].value;
        var type = document.getElementById("typeFilter");
        if (type) {
            type.options[0].text = tr("allTypes");
            type.options[1].text = tr("boss");
            type.options[2].text = tr("archimonstre");
        }
        var sf = document.getElementById("stepFilter");
        if (sf && sf.options.length)
            sf.options[0].text = tr("allSteps");
        var zf = document.getElementById("zoneFilter");
        if (zf && zf.options.length) {
            zf.options[0].text = tr("allZones");
            for (var zi = 1; zi < zf.options.length; zi++)
                zf.options[zi].text = localizedZone(zf.options[zi].value);
        }
        document.querySelectorAll("thead th").forEach(function (th, i) { var vals = ["✓", "monster", "type", "step", "level", "base", "zones"]; if (i > 0)
            th.textContent = tr(vals[i]); });
        renderAll();
    }

    document.querySelectorAll("[data-lang]").forEach(function (b) { b.addEventListener("click", function () { currentLang = b.getAttribute("data-lang"); storage.setItem("eternelle_moisson_lang", currentLang); applyLanguage(); }); });
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

    function stepLabel(step) {
        if (step === 19)
            return "Ultime épreuve";
        return "Étape " + step;
    }
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
    Object.keys(availableZones).sort(function (a, b) { return a.localeCompare(b, "fr"); }).forEach(function (zone) {
        var option = document.createElement("option");
        option.value = zone;
        option.textContent = localizedZone(zone);
        zoneFilterSelect.appendChild(option);
    });
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
            var q = state.search.toLowerCase();
            var hay = (m.name + " " + (m.base || "") + " " + m.zones.join(" ")).toLowerCase();
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
                alert("Le fichier importé n'est pas valide.");
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
        resetBtn.textContent = "Réinitialiser";
    }
    resetBtn.addEventListener("click", function () {
        if (!resetTimer) {
            resetBtn.textContent = "Confirmer ?";
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
                inp.setAttribute("aria-label", "Nom du personnage");
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
                    del.textContent = armed ? "Sûr ?" : "×";
                    del.title = armed ? tr("deleteConfirm") : tr("delete");
                    del.setAttribute("aria-label", "Supprimer le personnage");
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
        add.setAttribute("aria-label", "Ajouter un personnage");
        add.addEventListener("click", addChar);
        charTabs.appendChild(add);
    }

    function renderAll() {
        renderChars();
        renderStats();
        renderStepsGrid();
        renderTable();
    }
    populateStepFilter();
    renderAll();
    applyLanguage();
})();
