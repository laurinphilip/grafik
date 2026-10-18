(function () {
  "use strict";

  var STORAGE_KEY = "adelschronik.projects.v1";
  var SETTINGS_KEY = "adelschronik.settings.v1";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var XLINK_NS = "http://www.w3.org/1999/xlink";
  var DEFAULT_ACCENT = "#F2BC52";
  var TREE_CARD = { width: 176, baseHeight: 58, titleHeight: 22, gapX: 28, familyGapX: 86, gapY: 92 };
  var TIMELINE_CARD = { width: 226, height: 118, gapX: 62 };
  var TITLE_COLORS = [
    "#0B63CE", "#4E9E13", "#8D2A22", "#B45B24", "#6B35D5", "#007A45",
    "#D00069", "#735B83", "#0098C7", "#E07600", "#304A9A", "#8B7200",
    "#A53F73", "#167A78", "#6E7F16", "#B23A2B"
  ];
  var COLORS = {
    ivory: "#EEE8D8",
    gold: "#F2BC52",
    goldDark: "#DDA338",
    goldPale: "#F8DFA7",
    ink: "#000000",
    white: "#FFFFFF",
    muted: "#746D5E",
    red: "#A93227"
  };

  var els = {};
  var state = {
    projects: [],
    currentId: null,
    selected: null,
    viewport: { x: 0, y: 0, scale: 1 },
    viewports: {},
    history: [],
    editingId: null,
    editingImage: "",
    editingTitles: [],
    projectDialogMode: "new",
    lastBounds: { x: -400, y: -80, width: 800, height: 600 },
    pointer: null,
    spacePressed: false,
    saveTimer: null,
    renderFrame: null,
    storageRecoveryWarning: false
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    loadProjects();
    renderAll();
    if (state.storageRecoveryWarning) {
      showToast("Gespeicherte Browserdaten waren beschädigt und wurden noch nicht überschrieben. Bitte zuerst ein neues Projekt sichern.", true);
    }
    window.requestAnimationFrame(function () {
      fitToContent(false);
      if (!loadSetting("tipDismissed")) {
        els.canvasTip.classList.remove("hidden");
      } else {
        els.canvasTip.classList.add("hidden");
      }
    });
  }

  function cacheElements() {
    [
      "sidebar", "sidebarClose", "sidebarScrim", "mobileMenuButton", "projectList",
      "newProjectButton", "treeModeButton", "timelineModeButton", "selectionPanel",
      "emptySelection", "selectionCard", "selectionImageWrap", "selectionImage",
      "selectionKind", "selectionTitle", "selectionDates", "selectionNotes",
      "editSelectedButton", "deleteSelectedButton", "saveIndicator", "helpButton",
      "projectModeLabel", "projectTitleButton", "projectTitle", "undoButton",
      "dataMenuButton", "dataMenu", "exportJsonButton", "importJsonButton",
      "duplicateProjectButton", "deleteProjectButton", "exportButton", "exportMenu",
      "exportPngButton", "exportSvgButton", "addPersonButton", "addRelationButton",
      "addEventButton", "arrangeButton", "arrangeButtonLabel", "commandHint",
      "accentColorPicker",
      "zoomOutButton", "zoomResetButton", "zoomInButton", "fitButton", "zoomResetButton",
      "canvasShell", "editorCanvas", "canvasBackground", "viewportGroup", "canvasDefs",
      "canvasEmpty", "emptyTitle", "emptyText", "emptyActionButton", "canvasTip",
      "dismissTip", "personDialog", "personForm", "personDialogTitle", "personName",
      "personBirth", "personDeath", "personNotes", "personTitlesList", "addTitleButton", "titleSuggestions",
      "personImageDropzone", "personImagePreview", "personImagePlaceholder",
      "personImageInput", "removePersonImageButton", "eventDialog", "eventForm",
      "eventDialogTitle", "eventTitle", "eventCategory", "eventStart", "eventEnd",
      "eventNotes", "eventImageDropzone", "eventImagePreview", "eventImagePlaceholder",
      "eventImageInput", "removeEventImageButton", "relationDialog", "relationForm",
      "relationDialogTitle", "relationFirstLabel", "relationSecondLabel", "relationParent", "relationChild", "relationMessage", "existingRelations", "relationList", "projectDialog",
      "projectForm", "projectDialogTitle", "projectName", "projectSubtitle",
      "projectImageDropzone", "projectImagePreview", "projectImagePlaceholder", "projectImageInput", "removeProjectImageButton",
      "newProjectModeField", "helpDialog", "confirmDialog", "confirmTitle",
      "confirmText", "confirmAccept", "confirmCancel", "jsonFileInput", "toastRegion"
    ].forEach(function (id) {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.newProjectButton.addEventListener("click", function () { openProjectDialog("new"); });
    els.projectTitleButton.addEventListener("click", function () { openProjectDialog("rename"); });
    els.treeModeButton.addEventListener("click", function () { switchMode("tree"); });
    els.timelineModeButton.addEventListener("click", function () { switchMode("timeline"); });
    els.addPersonButton.addEventListener("click", function () { openPersonDialog(); });
    els.addEventButton.addEventListener("click", function () { openEventDialog(); });
    els.addRelationButton.addEventListener("click", openRelationDialog);
    els.arrangeButton.addEventListener("click", arrangeCurrentView);
    els.accentColorPicker.addEventListener("change", changeAccentColor);
    els.editSelectedButton.addEventListener("click", editSelected);
    els.deleteSelectedButton.addEventListener("click", deleteSelected);
    els.undoButton.addEventListener("click", undo);
    els.helpButton.addEventListener("click", function () { els.helpDialog.showModal(); closeSidebar(); });
    els.emptyActionButton.addEventListener("click", function () {
      if (getProject().mode === "tree") openPersonDialog();
      else openEventDialog();
    });

    els.dataMenuButton.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu(els.dataMenu, els.dataMenuButton);
      hideMenu(els.exportMenu, els.exportButton);
    });
    els.exportButton.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu(els.exportMenu, els.exportButton);
      hideMenu(els.dataMenu, els.dataMenuButton);
    });
    els.exportJsonButton.addEventListener("click", exportJson);
    els.importJsonButton.addEventListener("click", function () {
      hideMenus();
      els.jsonFileInput.value = "";
      els.jsonFileInput.click();
    });
    els.jsonFileInput.addEventListener("change", importJson);
    els.duplicateProjectButton.addEventListener("click", duplicateCurrentProject);
    els.deleteProjectButton.addEventListener("click", deleteCurrentProject);
    els.exportSvgButton.addEventListener("click", exportSvg);
    els.exportPngButton.addEventListener("click", exportPng);
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".popover-menu") && !event.target.closest("#dataMenuButton") && !event.target.closest("#exportButton")) {
        hideMenus();
      }
    });

    els.personForm.addEventListener("submit", savePerson);
    els.addTitleButton.addEventListener("click", function () { addPersonTitleRow(); });
    els.personTitlesList.addEventListener("click", function (event) {
      var removeButton = event.target.closest("[data-remove-title]");
      if (!removeButton) return;
      var row = removeButton.closest(".title-entry-row");
      if (row) row.remove();
      if (!els.personTitlesList.children.length) addPersonTitleRow();
    });
    els.eventForm.addEventListener("submit", saveEvent);
    els.relationForm.addEventListener("submit", saveRelation);
    els.projectForm.addEventListener("submit", saveProjectDialog);
    els.relationForm.querySelectorAll('input[name="relationType"]').forEach(function (input) {
      input.addEventListener("change", syncRelationDialog);
    });
    els.personImageDropzone.addEventListener("click", function () { els.personImageInput.click(); });
    els.eventImageDropzone.addEventListener("click", function () { els.eventImageInput.click(); });
    els.projectImageDropzone.addEventListener("click", function () { els.projectImageInput.click(); });
    els.personImageInput.addEventListener("change", function () { handleImageInput("person"); });
    els.eventImageInput.addEventListener("change", function () { handleImageInput("event"); });
    els.projectImageInput.addEventListener("change", function () { handleImageInput("project"); });
    els.removePersonImageButton.addEventListener("click", function () { setImageDraft("person", ""); });
    els.removeEventImageButton.addEventListener("click", function () { setImageDraft("event", ""); });
    els.removeProjectImageButton.addEventListener("click", function () { setImageDraft("project", ""); });

    document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
      button.addEventListener("click", function () {
        var dialog = document.getElementById(button.getAttribute("data-close-dialog"));
        if (dialog && dialog.open) dialog.close();
      });
    });
    [els.personDialog, els.eventDialog, els.relationDialog, els.projectDialog, els.helpDialog].forEach(function (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) dialog.close();
      });
    });

    els.zoomInButton.addEventListener("click", function () { zoomAtCenter(1.18); });
    els.zoomOutButton.addEventListener("click", function () { zoomAtCenter(1 / 1.18); });
    els.zoomResetButton.addEventListener("click", function () { setZoom(1); });
    els.fitButton.addEventListener("click", function () { fitToContent(true); });
    els.editorCanvas.addEventListener("wheel", onCanvasWheel, { passive: false });
    els.editorCanvas.addEventListener("pointerdown", onCanvasPointerDown);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    window.addEventListener("resize", debounce(function () { fitToContent(false); }, 180));
    els.editorCanvas.addEventListener("dblclick", function (event) {
      var node = event.target.closest(".entity-node");
      if (node) {
        var type = node.getAttribute("data-type");
        var id = node.getAttribute("data-id");
        if (type === "person") openPersonDialog(id);
        else openEventDialog(id);
      }
    });

    els.mobileMenuButton.addEventListener("click", openSidebar);
    els.sidebarClose.addEventListener("click", closeSidebar);
    els.sidebarScrim.addEventListener("click", closeSidebar);
    els.dismissTip.addEventListener("click", function () {
      els.canvasTip.classList.add("hidden");
      saveSetting("tipDismissed", true);
    });

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", function (event) {
      if (event.code === "Space") state.spacePressed = false;
    });
    window.addEventListener("pagehide", function () {
      if (state.saveTimer) persistNow();
    });
  }

  function sampleProject() {
    return {
      id: "project-sample",
      name: "Haus von Falkenstein",
      subtitle: "Eine fiktive Dynastie · Beispielprojekt",
      emblem: "",
      accentColor: DEFAULT_ACCENT,
      mode: "tree",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tree: {
        people: [
          { id: "p-albrecht", name: "Albrecht I.", titles: [{ id: "pt1", name: "Herr von Falkenstein", start: "1110", end: "1142" }], birth: "1084", death: "1142", notes: "Begründete den Stammsitz auf dem Falkenberg.", image: "" },
          { id: "p-elisabeth", name: "Elisabeth", titles: [], birth: "1092", death: "1158", notes: "Förderin des Klosters St. Aurelia.", image: "" },
          { id: "p-otto", name: "Otto I.", titles: [{ id: "pt2", name: "Graf von Falkenstein", start: "1142", end: "1181" }], birth: "1118", death: "1181", notes: "Erweiterte den Familienbesitz nach Süden.", image: "" },
          { id: "p-mathilde", name: "Mathilde", titles: [{ id: "pt3", name: "Äbtissin von Aurelia", start: "1161", end: "1190" }], birth: "1122", death: "1190", notes: "Gelehrte und Chronistin ihrer Zeit.", image: "" },
          { id: "p-konrad", name: "Konrad II.", titles: [{ id: "pt4", name: "Herr von Falkenberg", start: "1181", end: "1211" }], birth: "1148", death: "1211", notes: "Erhielt 1187 das Marktrecht.", image: "" },
          { id: "p-agnes", name: "Agnes", titles: [], birth: "1156", death: "1224", notes: "Stiftete das Hospital am unteren Tor.", image: "" },
          { id: "p-ludwig", name: "Ludwig", titles: [{ id: "pt5", name: "Ritter", start: "1202", end: "1237" }], birth: "1180", death: "1237", notes: "Nahm am Hofe des Kaisers diplomatische Aufgaben wahr.", image: "" },
          { id: "p-sophia", name: "Sophia", titles: [{ id: "pt6", name: "Regentin von Falkenstein", start: "1211", end: "1228" }], birth: "1184", death: "1251", notes: "Verwaltete die Grafschaft während zweier Regentschaften.", image: "" },
          { id: "p-heinrich", name: "Heinrich III.", titles: [{ id: "pt7", name: "Graf von Falkenstein", start: "1237", end: "1274" }], birth: "1210", death: "1274", notes: "Ließ die obere Burganlage erneuern.", image: "" }
        ],
        relations: [
          { id: "r1", parentId: "p-albrecht", childId: "p-otto" },
          { id: "r2", parentId: "p-elisabeth", childId: "p-otto" },
          { id: "r3", parentId: "p-albrecht", childId: "p-mathilde" },
          { id: "r4", parentId: "p-elisabeth", childId: "p-mathilde" },
          { id: "r5", parentId: "p-otto", childId: "p-konrad" },
          { id: "r6", parentId: "p-konrad", childId: "p-ludwig" },
          { id: "r7", parentId: "p-agnes", childId: "p-ludwig" },
          { id: "r8", parentId: "p-konrad", childId: "p-sophia" },
          { id: "r9", parentId: "p-agnes", childId: "p-sophia" },
          { id: "r10", parentId: "p-ludwig", childId: "p-heinrich" }
        ]
      },
      timeline: {
        events: [
          { id: "e1", title: "Erste urkundliche Erwähnung", category: "Ursprung", start: "1084", end: "", notes: "Albrecht wird erstmals als Herr des Falkenbergs genannt.", image: "" },
          { id: "e2", title: "Bau der Höhenburg", category: "Architektur", start: "1112", end: "1126", notes: "Die hölzerne Anlage wird zu einer steinernen Burg ausgebaut.", image: "" },
          { id: "e3", title: "Verleihung des Marktrechts", category: "Herrschaft", start: "1187", end: "", notes: "Der Ort am Fuß des Falkenbergs erhält ein wöchentliches Marktrecht.", image: "" },
          { id: "e4", title: "Stiftung des Hospitals", category: "Gesellschaft", start: "1201", end: "", notes: "Agnes von Silberhain gründet ein Hospital für Reisende und Bedürftige.", image: "" },
          { id: "e5", title: "Erneuerung der Burg", category: "Architektur", start: "1241", end: "1258", notes: "Heinrich III. lässt Mauerring und Palas erneuern.", image: "" },
          { id: "e6", title: "Teilung der Herrschaft", category: "Dynastie", start: "1274", end: "", notes: "Nach Heinrichs Tod entstehen eine ältere und eine jüngere Linie.", image: "" }
        ]
      }
    };
  }

  function emptyProject(name, subtitle, mode) {
    var now = new Date().toISOString();
    return {
      id: uid("project"),
      name: name || "Unbenannte Chronik",
      subtitle: subtitle || "",
      emblem: "",
      accentColor: DEFAULT_ACCENT,
      mode: mode === "timeline" ? "timeline" : "tree",
      createdAt: now,
      updatedAt: now,
      tree: { people: [], relations: [] },
      timeline: { events: [] }
    };
  }

  function loadProjects() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      var parsed = JSON.parse(raw || "null");
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length
        && parsed.projects.every(hasProjectContainers)) {
        state.projects = parsed.projects.map(normalizeProject);
        state.currentId = state.projects.some(function (p) { return p.id === parsed.currentId; })
          ? parsed.currentId
          : state.projects[0].id;
        return;
      }
      if (raw) state.storageRecoveryWarning = true;
    } catch (error) {
      console.warn("Lokale Projekte konnten nicht geladen werden.", error);
      state.storageRecoveryWarning = Boolean(raw);
    }
    var sample = sampleProject();
    state.projects = [sample];
    state.currentId = sample.id;
    if (!state.storageRecoveryWarning) persistNow();
  }

  function hasProjectContainers(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return false;
    var treeValid = source.tree && typeof source.tree === "object" && !Array.isArray(source.tree)
      && Array.isArray(source.tree.people) && Array.isArray(source.tree.relations);
    var timelineValid = source.timeline && typeof source.timeline === "object" && !Array.isArray(source.timeline)
      && Array.isArray(source.timeline.events);
    return Boolean(treeValid && timelineValid);
  }

  function normalizeProject(input) {
    var base = emptyProject();
    var project = {
      id: stringValue(input && input.id) || base.id,
      name: stringValue(input && input.name) || "Unbenannte Chronik",
      subtitle: stringValue(input && input.subtitle),
      emblem: safeImage(input && input.emblem),
      accentColor: safeColor(input && input.accentColor) || DEFAULT_ACCENT,
      mode: input && input.mode === "timeline" ? "timeline" : "tree",
      createdAt: stringValue(input && input.createdAt) || base.createdAt,
      updatedAt: stringValue(input && input.updatedAt) || base.updatedAt,
      tree: { people: [], relations: [] },
      timeline: { events: [] }
    };
    var seenPeople = Object.create(null);
    var people = input && input.tree && Array.isArray(input.tree.people) ? input.tree.people : [];
    project.tree.people = people.slice(0, 500).map(function (person) {
      var id = stringValue(person && person.id) || uid("person");
      if (seenPeople[id]) id = uid("person");
      seenPeople[id] = true;
      return {
        id: id,
        name: stringValue(person && person.name) || "Unbenannt",
        titles: normalizePersonTitles(person),
        birth: stringValue(person && person.birth),
        death: stringValue(person && person.death),
        notes: stringValue(person && person.notes),
        image: safeImage(person && person.image),
        position: validPosition(person && person.position)
      };
    });
    var relations = input && input.tree && Array.isArray(input.tree.relations) ? input.tree.relations : [];
    var seenRelationIds = Object.create(null);
    var seenRelationKeys = Object.create(null);
    relations.slice(0, 1000).forEach(function (relation) {
      if (!relation || !seenPeople[relation.parentId] || !seenPeople[relation.childId] || relation.parentId === relation.childId) return;
      var type = relation.type === "partner" ? "partner" : "parent";
      var endpoints = type === "partner"
        ? [relation.parentId, relation.childId].sort().join("|")
        : relation.parentId + "|" + relation.childId;
      var key = type + "|" + endpoints;
      if (seenRelationKeys[key]) return;
      if (type === "parent" && createsCycle(project, relation.parentId, relation.childId)) return;
      var relationId = stringValue(relation.id) || uid("relation");
      if (seenRelationIds[relationId]) relationId = uid("relation");
      seenRelationIds[relationId] = true;
      seenRelationKeys[key] = true;
      project.tree.relations.push({
        id: relationId,
        type: type,
        parentId: relation.parentId,
        childId: relation.childId
      });
    });
    project.tree.relations = project.tree.relations.filter(function (relation) {
      return relation.type !== "partner"
        || (!hasAncestryPath(project, relation.parentId, relation.childId)
          && !hasAncestryPath(project, relation.childId, relation.parentId));
    });
    var events = input && input.timeline && Array.isArray(input.timeline.events) ? input.timeline.events : [];
    var seenEvents = Object.create(null);
    project.timeline.events = events.slice(0, 500).map(function (event) {
      var eventId = stringValue(event && event.id) || uid("event");
      if (seenEvents[eventId]) eventId = uid("event");
      seenEvents[eventId] = true;
      return {
        id: eventId,
        title: stringValue(event && event.title) || "Unbenanntes Ereignis",
        category: stringValue(event && event.category),
        start: stringValue(event && event.start),
        end: stringValue(event && event.end),
        notes: stringValue(event && event.notes),
        image: safeImage(event && event.image),
        position: validPosition(event && event.position)
      };
    });
    return project;
  }

  function stringValue(value) {
    return typeof value === "string" ? value.slice(0, 2000) : "";
  }

  function safeImage(value) {
    return typeof value === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value) ? value : "";
  }

  function normalizePersonTitles(person) {
    var source = person && Array.isArray(person.titles) ? person.titles : [];
    var normalized = source.slice(0, 20).map(function (title) {
      return {
        id: stringValue(title && title.id) || uid("title"),
        name: stringValue(title && title.name).trim(),
        start: stringValue(title && title.start).trim(),
        end: stringValue(title && title.end).trim()
      };
    }).filter(function (title) { return title.name; });
    var legacyTitle = stringValue(person && person.title).trim();
    if (!normalized.length && legacyTitle) {
      normalized.push({ id: uid("title"), name: legacyTitle, start: "", end: "" });
    }
    return normalized;
  }

  function personTitles(person) {
    if (!person) return [];
    if (Array.isArray(person.titles)) return person.titles.filter(function (title) { return title && title.name; });
    var legacyTitle = stringValue(person.title).trim();
    return legacyTitle ? [{ id: uid("title"), name: legacyTitle, start: "", end: "" }] : [];
  }

  function titlePeriod(title) {
    var start = stringValue(title && title.start).trim();
    var end = stringValue(title && title.end).trim();
    if (start && end) return start === end ? start : start + "–" + end;
    if (start) return start;
    if (end) return "bis " + end;
    return "";
  }

  function titleKey(value) {
    return stringValue(value).trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
  }

  function safeColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "";
  }

  function validPosition(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y)
      ? { x: clamp(value.x, -100000, 100000), y: clamp(value.y, -100000, 100000) }
      : null;
  }

  function getProject() {
    return state.projects.find(function (project) { return project.id === state.currentId; }) || state.projects[0];
  }

  function persistNow() {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, currentId: state.currentId, projects: state.projects }));
      els.saveIndicator.classList.remove("saving");
      var label = els.saveIndicator.querySelector("span:last-child");
      if (label) label.textContent = "Im Browser gespeichert";
      return true;
    } catch (error) {
      els.saveIndicator.classList.remove("saving");
      var failedLabel = els.saveIndicator.querySelector("span:last-child");
      if (failedLabel) failedLabel.textContent = "Nicht gespeichert – Speicher voll";
      showToast("Speicher voll – bitte Projekt als JSON sichern.", true);
      console.error(error);
      return false;
    }
  }

  function schedulePersist() {
    els.saveIndicator.classList.add("saving");
    var label = els.saveIndicator.querySelector("span:last-child");
    if (label) label.textContent = "Wird gespeichert …";
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(persistNow, 280);
  }

  function saveSetting(key, value) {
    try {
      var settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      settings[key] = value;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn(error);
    }
  }

  function loadSetting(key) {
    try {
      var settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return settings[key];
    } catch (error) {
      return null;
    }
  }

  function mutate(label, callback, options) {
    var project = getProject();
    if (!project) return;
    state.history.push({ label: label, projectId: project.id, snapshot: deepClone(project) });
    if (state.history.length > 40) state.history.shift();
    callback(project);
    project.updatedAt = new Date().toISOString();
    schedulePersist();
    if (!options || options.render !== false) renderAll();
  }

  function undo() {
    var entry = state.history.pop();
    if (!entry) return;
    var index = state.projects.findIndex(function (project) { return project.id === entry.projectId; });
    if (index < 0) return;
    state.projects[index] = entry.snapshot;
    state.currentId = entry.projectId;
    state.selected = null;
    schedulePersist();
    renderAll();
    showToast("Letzte Änderung rückgängig gemacht");
  }

  function renderAll() {
    var project = getProject();
    if (!project) return;
    applyAccentColor(project);
    els.projectTitle.textContent = project.name;
    els.projectModeLabel.textContent = project.mode === "tree" ? "Stammbaum" : "Zeitleiste";
    els.treeModeButton.classList.toggle("active", project.mode === "tree");
    els.treeModeButton.setAttribute("aria-pressed", project.mode === "tree" ? "true" : "false");
    els.timelineModeButton.classList.toggle("active", project.mode === "timeline");
    els.timelineModeButton.setAttribute("aria-pressed", project.mode === "timeline" ? "true" : "false");
    document.querySelectorAll(".tree-only").forEach(function (item) { item.classList.toggle("hidden", project.mode !== "tree"); });
    document.querySelectorAll(".timeline-only").forEach(function (item) { item.classList.toggle("hidden", project.mode !== "timeline"); });
    els.arrangeButtonLabel.textContent = project.mode === "tree" ? "Automatisch anordnen" : "Chronologisch anordnen";
    els.commandHint.textContent = project.mode === "tree"
      ? "Karten verschieben · freie Fläche ziehen · Mausrad zum Zoomen"
      : "Karten verschieben · Zeitraum erkunden · Mausrad zum Zoomen";
    els.undoButton.disabled = state.history.length === 0;
    renderProjectList();
    renderSelection();
    renderCanvas();
  }

  function applyAccentColor(project) {
    var accent = safeColor(project && project.accentColor) || DEFAULT_ACCENT;
    COLORS.gold = accent;
    COLORS.goldDark = accent;
    COLORS.goldPale = mixColors(accent, COLORS.ivory, 0.55);
    els.accentColorPicker.value = accent;
  }

  function changeAccentColor(event) {
    var color = safeColor(event.target.value) || DEFAULT_ACCENT;
    mutate("Farbe geändert", function (project) {
      project.accentColor = color;
    });
    showToast("Farbe aktualisiert");
  }

  function mixColors(first, second, ratio) {
    var amount = clamp(Number(ratio) || 0, 0, 1);
    var a = parseInt(first.slice(1), 16);
    var b = parseInt(second.slice(1), 16);
    var channels = [16, 8, 0].map(function (shift) {
      return Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
    });
    return "#" + channels.map(function (channel) {
      return channel.toString(16).padStart(2, "0");
    }).join("").toUpperCase();
  }

  function contrastColor(color) {
    var value = parseInt(color.slice(1), 16);
    var red = (value >> 16) & 255;
    var green = (value >> 8) & 255;
    var blue = value & 255;
    var luminance = (red * 299 + green * 587 + blue * 114) / 1000;
    return luminance < 142 ? COLORS.white : COLORS.ink;
  }

  function renderProjectList() {
    els.projectList.replaceChildren();
    state.projects.forEach(function (project) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "project-item" + (project.id === state.currentId ? " active" : "");
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-current", project.id === state.currentId ? "true" : "false");
      var icon = document.createElement("span");
      icon.className = "project-icon";
      icon.textContent = initials(project.name);
      var info = document.createElement("span");
      info.className = "project-info";
      var strong = document.createElement("strong");
      strong.textContent = project.name;
      var small = document.createElement("span");
      var count = project.tree.people.length + project.timeline.events.length;
      small.textContent = relativeDate(project.updatedAt);
      info.append(strong, small);
      var badge = document.createElement("span");
      badge.className = "project-count";
      badge.textContent = String(count);
      button.append(icon, info, badge);
      button.addEventListener("click", function () { selectProject(project.id); });
      els.projectList.appendChild(button);
    });
  }

  function renderSelection() {
    var project = getProject();
    var item = null;
    if (state.selected && state.selected.type === "person") {
      item = project.tree.people.find(function (person) { return person.id === state.selected.id; });
    } else if (state.selected && state.selected.type === "event") {
      item = project.timeline.events.find(function (event) { return event.id === state.selected.id; });
    }
    if (!item) {
      state.selected = null;
      els.emptySelection.classList.remove("hidden");
      els.selectionCard.classList.add("hidden");
      return;
    }
    els.emptySelection.classList.add("hidden");
    els.selectionCard.classList.remove("hidden");
    var isPerson = state.selected.type === "person";
    els.selectionKind.textContent = isPerson ? "Person" : (item.category || "Ereignis");
    els.selectionTitle.textContent = item.name || item.title;
    els.selectionDates.textContent = isPerson ? lifeDates(item) : eventDates(item);
    els.selectionDates.classList.toggle("hidden", !els.selectionDates.textContent);
    var titleSummary = isPerson ? personTitles(item).map(function (title) {
      var period = titlePeriod(title);
      return "• " + title.name + (period ? " · " + period : "");
    }).join("\n") : "";
    var noteText = isPerson
      ? titleSummary + (titleSummary && item.notes ? "\n\n" : "") + item.notes
      : item.notes;
    els.selectionNotes.textContent = noteText || "Keine weiteren Notizen.";
    if (item.image) {
      els.selectionImage.src = item.image;
      els.selectionImage.alt = isPerson ? "Bild von " + item.name : "Bild zu " + item.title;
      els.selectionImageWrap.classList.remove("hidden");
    } else {
      els.selectionImage.removeAttribute("src");
      els.selectionImageWrap.classList.add("hidden");
    }
  }

  function renderCanvas() {
    var project = getProject();
    els.viewportGroup.replaceChildren();
    updateCanvasDefs();
    var isEmpty = project.mode === "tree" ? project.tree.people.length === 0 : project.timeline.events.length === 0;
    els.canvasEmpty.classList.toggle("hidden", !isEmpty);
    if (isEmpty) {
      els.emptyTitle.textContent = project.mode === "tree" ? "Beginne deinen Stammbaum" : "Beginne deine Zeitleiste";
      els.emptyText.textContent = project.mode === "tree"
        ? "Füge die erste Person hinzu. Danach kannst du Eltern und Kinder miteinander verbinden."
        : "Lege das erste historische Ereignis an. Weitere Einträge werden chronologisch eingeordnet.";
      els.emptyActionButton.textContent = project.mode === "tree" ? "Erste Person hinzufügen" : "Erstes Ereignis hinzufügen";
      state.lastBounds = { x: -400, y: -80, width: 800, height: 600 };
    } else if (project.mode === "tree") {
      renderTree(project);
    } else {
      renderTimeline(project);
    }
    applyViewport();
  }

  function updateCanvasDefs() {
    els.canvasDefs.replaceChildren();
    var style = svg("style");
    style.textContent = [
      ".entity-node{cursor:move}.entity-node:focus{outline:none}",
      ".entity-node:focus .node-focus{stroke:#000;stroke-width:3}",
      ".node-title{font-family:Impact,'Arial Narrow',sans-serif;font-weight:900;letter-spacing:.02em}",
      ".node-text{font-family:Arial,sans-serif}.export-title{font-family:Impact,'Arial Narrow',sans-serif;font-weight:900;letter-spacing:.035em}",
      ".export-serif{font-family:Georgia,serif}.export-sans{font-family:Arial,sans-serif}"
    ].join("");
    els.canvasDefs.appendChild(style);
  }

  function renderTree(project) {
    var people = project.tree.people;
    var positions = calculateTreePositions(project);
    var treeBounds = boundsFromPersonPositions(people, positions);
    var legendEntries = getTitleLegend(project);
    var legendLayout = legendEntries.length ? calculateTitleLegendLayout(treeBounds, legendEntries.length) : null;
    var bounds = legendLayout ? unionBounds(treeBounds, legendLayout) : treeBounds;
    bounds.y -= 155;
    bounds.height += 155;
    bounds.x -= 50;
    bounds.width += 100;
    if (bounds.width < 650) {
      bounds.x -= (650 - bounds.width) / 2;
      bounds.width = 650;
    }
    state.lastBounds = bounds;

    renderExportHeader(els.viewportGroup, project, bounds.x + 26, bounds.y + 26, Math.max(520, bounds.width - 52), "STAMMBAUM");

    var lineLayer = svg("g", { "aria-hidden": "true" });
    project.tree.relations.filter(function (relation) { return relation.type === "partner"; }).forEach(function (relation) {
      var parentPos = positions[relation.parentId];
      var childPos = positions[relation.childId];
      if (!parentPos || !childPos) return;
      var left = parentPos.x <= childPos.x ? parentPos : childPos;
      var right = parentPos.x <= childPos.x ? childPos : parentPos;
      var partnerX1 = left.x + TREE_CARD.width;
      var partnerY1 = left.y + TREE_CARD.baseHeight / 2;
      var partnerX2 = right.x;
      var partnerY2 = right.y + TREE_CARD.baseHeight / 2;
      var partnerMidX = partnerX1 + (partnerX2 - partnerX1) / 2;
      lineLayer.appendChild(svg("path", {
        d: "M " + partnerX1 + " " + partnerY1 + " H " + partnerMidX + " V " + partnerY2 + " H " + partnerX2,
        fill: "none",
        stroke: COLORS.gold,
        "stroke-width": "3",
        "stroke-linecap": "square",
        "stroke-linejoin": "miter",
        "vector-effect": "non-scaling-stroke"
      }));
    });
    renderFamilyConnectors(lineLayer, project, positions);
    els.viewportGroup.appendChild(lineLayer);

    var titleColors = Object.create(null);
    legendEntries.forEach(function (entry) { titleColors[entry.key] = entry.color; });
    var nodeLayer = svg("g");
    people.forEach(function (person) {
      nodeLayer.appendChild(createPersonNode(person, positions[person.id], titleColors));
    });
    els.viewportGroup.appendChild(nodeLayer);
    if (legendLayout) renderTitleLegend(els.viewportGroup, legendEntries, legendLayout);
  }

  function calculateTreePositions(project) {
    var people = project.tree.people;
    var relations = project.tree.relations;
    var personIds = Object.create(null);
    people.forEach(function (person) { personIds[person.id] = true; });
    var coParentsByChild = Object.create(null);
    relations.forEach(function (relation) {
      if (relation.type === "partner") return;
      if (!coParentsByChild[relation.childId]) coParentsByChild[relation.childId] = [];
      if (!coParentsByChild[relation.childId].includes(relation.parentId)) coParentsByChild[relation.childId].push(relation.parentId);
    });
    var coParentGroups = Object.keys(coParentsByChild).map(function (childId) {
      return coParentsByChild[childId];
    }).filter(function (parentIds) {
      if (parentIds.length < 2) return false;
      for (var first = 0; first < parentIds.length; first += 1) {
        for (var second = first + 1; second < parentIds.length; second += 1) {
          if (hasAncestryPath(project, parentIds[first], parentIds[second])
            || hasAncestryPath(project, parentIds[second], parentIds[first])) return false;
        }
      }
      return true;
    });
    var levelById = Object.create(null);
    people.forEach(function (person) { levelById[person.id] = 0; });
    for (var pass = 0; pass < Math.max(1, people.length * 2); pass += 1) {
      var changed = false;
      relations.forEach(function (relation) {
        if (relation.type === "partner") return;
        if (!personIds[relation.parentId] || !personIds[relation.childId]) return;
        var next = Math.min(people.length - 1, (levelById[relation.parentId] || 0) + 1);
        if (next > levelById[relation.childId]) {
          levelById[relation.childId] = next;
          changed = true;
        }
      });
      coParentGroups.forEach(function (parentIds) {
        var level = Math.max.apply(null, parentIds.map(function (id) { return levelById[id] || 0; }));
        parentIds.forEach(function (id) {
          if (levelById[id] !== level) {
            levelById[id] = level;
            changed = true;
          }
        });
      });
      relations.forEach(function (relation) {
        if (relation.type !== "partner") return;
        if (!personIds[relation.parentId] || !personIds[relation.childId]) return;
        var level = Math.max(levelById[relation.parentId] || 0, levelById[relation.childId] || 0);
        if (levelById[relation.parentId] !== level) {
          levelById[relation.parentId] = level;
          changed = true;
        }
        if (levelById[relation.childId] !== level) {
          levelById[relation.childId] = level;
          changed = true;
        }
      });
      if (!changed) break;
    }
    var rows = Object.create(null);
    people.forEach(function (person) {
      var level = levelById[person.id] || 0;
      if (!rows[level]) rows[level] = [];
      rows[level].push(person);
    });
    var auto = Object.create(null);
    var rowOrders = Object.create(null);
    var levels = Object.keys(rows).sort(function (a, b) { return Number(a) - Number(b); });
    var rowY = 130;
    levels.forEach(function (key, levelIndex) {
      var groups = familyGroupsForRow(rows[key], relations, rowOrders, Number(key));
      var rowOrder = [];
      groups.forEach(function (group) { rowOrder = rowOrder.concat(group.people); });
      rowOrders[key] = rowOrder;
      var maxHeight = Math.max.apply(null, rowOrder.map(personCardHeight));

      if (levelIndex === 0 || groups.every(function (group) { return group.parentIds.length === 0; })) {
        var total = groups.reduce(function (sum, group, index) {
          return sum + groupWidth(group) + (index ? TREE_CARD.familyGapX : 0);
        }, 0);
        var centeredCursor = -total / 2;
        groups.forEach(function (group) {
          placeFamilyGroup(group, centeredCursor, rowY, auto);
          centeredCursor += groupWidth(group) + TREE_CARD.familyGapX;
        });
      } else {
        var cursor = null;
        groups.forEach(function (group) {
          var width = groupWidth(group);
          var parentCenters = group.parentIds.map(function (parentId) {
            return auto[parentId] ? auto[parentId].x + TREE_CARD.width / 2 : null;
          }).filter(function (value) { return value !== null; });
          var desiredCenter = parentCenters.length
            ? parentCenters.reduce(function (sum, value) { return sum + value; }, 0) / parentCenters.length
            : (cursor === null ? 0 : cursor + TREE_CARD.familyGapX + width / 2);
          var left = desiredCenter - width / 2;
          if (cursor !== null) left = Math.max(left, cursor + TREE_CARD.familyGapX);
          placeFamilyGroup(group, left, rowY, auto);
          cursor = left + width;
        });
      }
      rowY += maxHeight + TREE_CARD.gapY;
    });
    var result = Object.create(null);
    people.forEach(function (person) {
      result[person.id] = person.position || auto[person.id] || { x: 0, y: 130 };
    });
    return result;
  }

  function familyGroupsForRow(row, relations, rowOrders, level) {
    var parentsByChild = Object.create(null);
    relations.forEach(function (relation) {
      if (relation.type === "partner") return;
      if (!parentsByChild[relation.childId]) parentsByChild[relation.childId] = [];
      if (!parentsByChild[relation.childId].includes(relation.parentId)) parentsByChild[relation.childId].push(relation.parentId);
    });
    var groupsByKey = Object.create(null);
    var groups = [];
    row.forEach(function (person, index) {
      var parentIds = (parentsByChild[person.id] || []).slice().sort();
      var key = parentIds.length ? parentIds.join("|") : "orphan:" + person.id;
      if (!groupsByKey[key]) {
        groupsByKey[key] = { key: key, parentIds: parentIds, people: [], sourceIndex: index, score: Infinity };
        groups.push(groupsByKey[key]);
      }
      groupsByKey[key].people.push(person);
    });
    var previous = rowOrders[String(Math.max(0, level - 1))] || [];
    var previousIndex = Object.create(null);
    previous.forEach(function (person, index) { previousIndex[person.id] = index; });
    groups.forEach(function (group) {
      var indexes = group.parentIds.map(function (id) { return previousIndex[id]; }).filter(Number.isFinite);
      if (indexes.length) group.score = indexes.reduce(function (sum, value) { return sum + value; }, 0) / indexes.length;
      group.people = orderPartnersTogether(group.people, relations);
    });
    groups.sort(function (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      return a.sourceIndex - b.sourceIndex;
    });
    return groups;
  }

  function groupWidth(group) {
    return group.people.length * TREE_CARD.width + Math.max(0, group.people.length - 1) * TREE_CARD.gapX;
  }

  function placeFamilyGroup(group, left, y, positions) {
    group.people.forEach(function (person, index) {
      positions[person.id] = { x: left + index * (TREE_CARD.width + TREE_CARD.gapX), y: y };
    });
  }

  function orderPartnersTogether(row, relations) {
    var rowIds = Object.create(null);
    row.forEach(function (person) { rowIds[person.id] = true; });
    var partners = Object.create(null);
    relations.forEach(function (relation) {
      if (relation.type !== "partner" || !rowIds[relation.parentId] || !rowIds[relation.childId]) return;
      if (!partners[relation.parentId]) partners[relation.parentId] = [];
      if (!partners[relation.childId]) partners[relation.childId] = [];
      partners[relation.parentId].push(relation.childId);
      partners[relation.childId].push(relation.parentId);
    });
    var byId = Object.create(null);
    row.forEach(function (person) { byId[person.id] = person; });
    var placed = Object.create(null);
    var ordered = [];
    row.forEach(function (person) {
      if (placed[person.id]) return;
      ordered.push(person);
      placed[person.id] = true;
      (partners[person.id] || []).forEach(function (partnerId) {
        if (!placed[partnerId] && byId[partnerId]) {
          ordered.push(byId[partnerId]);
          placed[partnerId] = true;
        }
      });
    });
    return ordered;
  }

  function personCardHeight(person) {
    return TREE_CARD.baseHeight + personTitles(person).length * TREE_CARD.titleHeight;
  }

  function boundsFromPersonPositions(people, positions) {
    if (!people.length) return { x: -400, y: -80, width: 800, height: 600 };
    var result = null;
    people.forEach(function (person) {
      var position = positions[person.id] || { x: 0, y: 0 };
      var cardBounds = { x: position.x, y: position.y, width: TREE_CARD.width, height: personCardHeight(person) };
      result = result ? unionBounds(result, cardBounds) : cardBounds;
    });
    return result;
  }

  function getTitleLegend(project) {
    var seen = Object.create(null);
    var entries = [];
    (project && project.tree ? project.tree.people : []).forEach(function (person) {
      personTitles(person).forEach(function (title) {
        var key = titleKey(title.name);
        if (!key || seen[key]) return;
        seen[key] = true;
        entries.push({ key: key, name: title.name.trim(), color: TITLE_COLORS[entries.length % TITLE_COLORS.length] });
      });
    });
    return entries;
  }

  function calculateTitleLegendLayout(treeBounds, count) {
    var rows = Math.min(7, count);
    var columns = Math.ceil(count / 7);
    return {
      x: treeBounds.x + treeBounds.width + 82,
      y: Math.max(130, treeBounds.y),
      width: 34 + columns * 190,
      height: 66 + rows * 38,
      columns: columns
    };
  }

  function renderTitleLegend(parent, entries, layout) {
    var group = svg("g", { "aria-label": "Legende der Titel" });
    group.appendChild(svg("rect", {
      x: layout.x, y: layout.y, width: layout.width, height: layout.height,
      fill: COLORS.white, "fill-opacity": ".9", stroke: COLORS.ink, "stroke-opacity": ".28", "stroke-width": "1"
    }));
    group.appendChild(svg("text", {
      x: layout.x + layout.width / 2, y: layout.y + 34,
      class: "export-title", fill: COLORS.ink, "font-size": "24", "text-anchor": "middle"
    }, "TITEL"));
    entries.forEach(function (entry, index) {
      var column = Math.floor(index / 7);
      var row = index % 7;
      var itemX = layout.x + 18 + column * 190;
      var itemY = layout.y + 52 + row * 38;
      group.appendChild(svg("rect", { x: itemX, y: itemY, width: "170", height: "29", fill: entry.color }));
      var lines = textLines(entry.name, 25, 2);
      var startY = itemY + (lines.length === 1 ? 19 : 11.5);
      lines.forEach(function (line, lineIndex) {
        group.appendChild(svg("text", {
          x: itemX + 85, y: startY + lineIndex * 11,
          class: "node-text", fill: contrastColor(entry.color), "font-size": "9", "font-weight": "800", "text-anchor": "middle"
        }, line));
      });
    });
    parent.appendChild(group);
  }

  function renderFamilyConnectors(layer, project, positions) {
    var peopleById = Object.create(null);
    project.tree.people.forEach(function (person) { peopleById[person.id] = person; });
    var parentsByChild = Object.create(null);
    project.tree.relations.forEach(function (relation) {
      if (relation.type === "partner") return;
      if (!parentsByChild[relation.childId]) parentsByChild[relation.childId] = [];
      if (!parentsByChild[relation.childId].includes(relation.parentId)) parentsByChild[relation.childId].push(relation.parentId);
    });
    var familiesByKey = Object.create(null);
    Object.keys(parentsByChild).forEach(function (childId) {
      var parentIds = parentsByChild[childId].slice().sort();
      var key = parentIds.join("|");
      if (!familiesByKey[key]) familiesByKey[key] = { parentIds: parentIds, childIds: [] };
      familiesByKey[key].childIds.push(childId);
    });
    Object.keys(familiesByKey).forEach(function (key) {
      var family = familiesByKey[key];
      var parentAnchors = family.parentIds.map(function (id) {
        var position = positions[id];
        var person = peopleById[id];
        return position && person ? { x: position.x + TREE_CARD.width / 2, y: position.y + personCardHeight(person) } : null;
      }).filter(Boolean);
      var childAnchors = family.childIds.map(function (id) {
        var position = positions[id];
        return position ? { x: position.x + TREE_CARD.width / 2, y: position.y } : null;
      }).filter(Boolean).sort(function (a, b) { return a.x - b.x; });
      if (!parentAnchors.length || !childAnchors.length) return;
      var maxParentY = Math.max.apply(null, parentAnchors.map(function (anchor) { return anchor.y; }));
      var minChildY = Math.min.apply(null, childAnchors.map(function (anchor) { return anchor.y; }));
      var parentJoinY = maxParentY + 16;
      var childBusY = minChildY > parentJoinY + 34
        ? parentJoinY + (minChildY - parentJoinY) * 0.55
        : parentJoinY + 34;
      var parentCenterX = parentAnchors.reduce(function (sum, anchor) { return sum + anchor.x; }, 0) / parentAnchors.length;
      var parentMinX = Math.min.apply(null, parentAnchors.map(function (anchor) { return anchor.x; }));
      var parentMaxX = Math.max.apply(null, parentAnchors.map(function (anchor) { return anchor.x; }));
      var childMinX = childAnchors[0].x;
      var childMaxX = childAnchors[childAnchors.length - 1].x;
      parentAnchors.forEach(function (anchor) {
        layer.appendChild(svg("path", {
          d: "M " + anchor.x + " " + anchor.y + " V " + parentJoinY,
          fill: "none", stroke: COLORS.gold, "stroke-width": "3", "vector-effect": "non-scaling-stroke"
        }));
      });
      layer.appendChild(svg("path", {
        d: "M " + parentMinX + " " + parentJoinY + " H " + parentMaxX + " M " + parentCenterX + " " + parentJoinY + " V " + childBusY + " M " + childMinX + " " + childBusY + " H " + childMaxX,
        fill: "none", stroke: COLORS.gold, "stroke-width": "3", "stroke-linejoin": "miter", "vector-effect": "non-scaling-stroke"
      }));
      childAnchors.forEach(function (anchor) {
        layer.appendChild(svg("path", {
          d: "M " + anchor.x + " " + childBusY + " V " + anchor.y,
          fill: "none", stroke: COLORS.gold, "stroke-width": "3", "vector-effect": "non-scaling-stroke"
        }));
      });
    });
  }

  function createPersonNode(person, position, titleColors) {
    var selected = state.selected && state.selected.type === "person" && state.selected.id === person.id;
    var cardFill = COLORS.gold;
    var cardText = contrastColor(cardFill);
    var titles = personTitles(person);
    var totalHeight = personCardHeight(person);
    var group = svg("g", {
      class: "entity-node",
      transform: "translate(" + position.x + " " + position.y + ")",
      tabindex: "0",
      role: "button",
      "aria-label": person.name + (lifeDates(person) ? ", " + lifeDates(person) : "") + (titles.length ? ", " + titles.map(function (title) { var period = titlePeriod(title); return title.name + (period ? " " + period : ""); }).join(", ") : ""),
      "data-type": "person",
      "data-id": person.id
    });
    group.appendChild(svg("rect", {
      class: "node-focus",
      x: "0", y: "0", width: TREE_CARD.width, height: TREE_CARD.baseHeight,
      fill: cardFill,
      stroke: "none"
    }));
    if (selected) {
      group.appendChild(svg("rect", {
        x: "-5", y: "-5", width: TREE_CARD.width + 10, height: totalHeight + 10,
        fill: "none", stroke: COLORS.ink, "stroke-width": "2", "data-selection-ring": "true"
      }));
    }

    var textX = TREE_CARD.width / 2;
    var textAnchor = "middle";
    if (person.image) {
      var imageWidth = 48;
      var image = svg("image", {
        x: "0", y: "0", width: String(imageWidth), height: String(TREE_CARD.baseHeight),
        preserveAspectRatio: "xMidYMid slice", href: person.image
      });
      image.setAttributeNS(XLINK_NS, "xlink:href", person.image);
      group.appendChild(image);
      group.appendChild(svg("line", { x1: imageWidth, y1: "0", x2: imageWidth, y2: String(TREE_CARD.baseHeight), stroke: COLORS.white, "stroke-width": "1.5" }));
      textX = imageWidth + 9;
      textAnchor = "start";
    }
    var available = person.image ? TREE_CARD.width - textX - 8 : TREE_CARD.width - 18;
    var nameLines = textLines(person.name, available < 100 ? 14 : 22, 2);
    var nameY = nameLines.length === 1 ? 24 : 16;
    nameLines.forEach(function (line, index) {
      group.appendChild(svg("text", {
        x: textX, y: nameY + index * 14,
        class: "node-text",
        fill: cardText,
        "font-size": available < 100 ? "10.5" : "11.5",
        "font-weight": "800",
        "text-anchor": textAnchor
      }, line));
    });
    var dates = lifeDates(person);
    if (dates) {
      group.appendChild(svg("text", {
        x: textX, y: TREE_CARD.baseHeight - 9,
        class: "node-text", fill: cardText, "font-size": "9", "font-weight": "700", "text-anchor": textAnchor
      }, dates));
    }
    titles.forEach(function (title, index) {
      var y = TREE_CARD.baseHeight + index * TREE_CARD.titleHeight;
      var color = titleColors[titleKey(title.name)] || TITLE_COLORS[0];
      group.appendChild(svg("rect", { x: "0", y: y, width: TREE_CARD.width, height: TREE_CARD.titleHeight, fill: color }));
      group.appendChild(svg("text", {
        x: TREE_CARD.width / 2, y: y + 15,
        class: "node-text", fill: contrastColor(color), "font-size": "9.5", "font-weight": "800", "text-anchor": "middle"
      }, truncate(titlePeriod(title) || title.name, 29)));
    });
    group.appendChild(svg("rect", {
      x: "0", y: "0", width: TREE_CARD.width, height: totalHeight,
      fill: "none", stroke: COLORS.ink, "stroke-opacity": ".22", "stroke-width": "1"
    }));
    group.addEventListener("click", function (event) {
      event.stopPropagation();
      selectEntity("person", person.id);
    });
    group.addEventListener("focus", function () {
      state.selected = { type: "person", id: person.id };
      renderSelection();
    });
    group.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPersonDialog(person.id);
      }
    });
    return group;
  }

  function renderTimeline(project) {
    var events = project.timeline.events.slice().sort(function (a, b) {
      return parseYear(a.start) - parseYear(b.start) || a.title.localeCompare(b.title, "de");
    });
    var positions = calculateTimelinePositions(events);
    var markerX = Object.create(null);
    events.forEach(function (event, index) { markerX[event.id] = index * (TIMELINE_CARD.width + TIMELINE_CARD.gapX); });
    var minX = -120;
    var maxX = Math.max(650, (events.length - 1) * (TIMELINE_CARD.width + TIMELINE_CARD.gapX) + 350);
    var bounds = { x: minX, y: -45, width: maxX - minX, height: 705 };
    events.forEach(function (event) {
      var pos = positions[event.id];
      bounds = unionBounds(bounds, { x: pos.x - 20, y: pos.y - 20, width: TIMELINE_CARD.width + 40, height: TIMELINE_CARD.height + 40 });
    });
    state.lastBounds = bounds;
    renderExportHeader(els.viewportGroup, project, bounds.x + 26, bounds.y + 26, Math.max(520, bounds.width - 52), "ZEITLEISTE");

    var axisY = 295;
    var axisStart = -18;
    var axisEnd = Math.max(520, (events.length - 1) * (TIMELINE_CARD.width + TIMELINE_CARD.gapX) + 40);
    els.viewportGroup.appendChild(svg("line", {
      x1: axisStart, y1: axisY, x2: axisEnd, y2: axisY,
      stroke: COLORS.gold, "stroke-width": "4", "stroke-linecap": "square"
    }));

    events.forEach(function (event, index) {
      var x = markerX[event.id];
      var position = positions[event.id];
      var cardAbove = position.y + TIMELINE_CARD.height < axisY;
      var connectorStartY = cardAbove ? position.y + TIMELINE_CARD.height : position.y;
      var connectorX = position.x + TIMELINE_CARD.width / 2;
      var connectorPath = "M " + connectorX + " " + connectorStartY + " V " + axisY + " H " + x;
      els.viewportGroup.appendChild(svg("path", {
        d: connectorPath, fill: "none", stroke: COLORS.gold,
        "stroke-width": "3", "stroke-linejoin": "miter"
      }));
      els.viewportGroup.appendChild(svg("circle", {
        cx: x, cy: axisY, r: "7", fill: COLORS.ivory, stroke: COLORS.gold, "stroke-width": "4"
      }));
      var yearLabel = event.end ? event.start + "—" + event.end : event.start;
      els.viewportGroup.appendChild(svg("text", {
        x: x, y: axisY + (index % 2 === 0 ? 31 : -18),
        class: "node-title", fill: COLORS.ink, "font-size": "13", "text-anchor": "middle"
      }, yearLabel));
    });

    events.forEach(function (event) {
      els.viewportGroup.appendChild(createEventNode(event, positions[event.id]));
    });
  }

  function calculateTimelinePositions(events) {
    var result = Object.create(null);
    events.forEach(function (event, index) {
      result[event.id] = event.position || {
        x: index * (TIMELINE_CARD.width + TIMELINE_CARD.gapX) - TIMELINE_CARD.width / 2,
        y: index % 2 === 0 ? 118 : 372
      };
    });
    return result;
  }

  function createEventNode(event, position) {
    var selected = state.selected && state.selected.type === "event" && state.selected.id === event.id;
    var cardFill = selected ? COLORS.goldPale : COLORS.gold;
    var cardText = contrastColor(cardFill);
    var group = svg("g", {
      class: "entity-node",
      transform: "translate(" + position.x + " " + position.y + ")",
      tabindex: "0",
      role: "button",
      "aria-label": event.title + ", " + eventDates(event),
      "data-type": "event",
      "data-id": event.id
    });
    group.appendChild(svg("rect", {
      class: "node-focus",
      x: selected ? "-5" : "0",
      y: selected ? "-5" : "0",
      width: selected ? TIMELINE_CARD.width + 10 : TIMELINE_CARD.width,
      height: selected ? TIMELINE_CARD.height + 10 : TIMELINE_CARD.height,
      fill: cardFill,
      stroke: selected ? COLORS.ink : "none",
      "stroke-width": selected ? "2" : "0",
      "data-selection-outline": selected ? "true" : "false"
    }));
    var textX = 15;
    if (event.image) {
      var imageWidth = 78;
      var image = svg("image", {
        x: "0", y: "0", width: String(imageWidth), height: String(TIMELINE_CARD.height),
        preserveAspectRatio: "xMidYMid slice", href: event.image
      });
      image.setAttributeNS(XLINK_NS, "xlink:href", event.image);
      group.appendChild(image);
      group.appendChild(svg("line", { x1: imageWidth, y1: "0", x2: imageWidth, y2: String(TIMELINE_CARD.height), stroke: COLORS.white, "stroke-width": "2" }));
      textX = imageWidth + 12;
    }
    var maxChars = event.image ? 16 : 27;
    if (event.category) {
      group.appendChild(svg("text", {
        x: textX, y: "20", class: "node-text", fill: cardText, "fill-opacity": ".72",
        "font-size": "8", "font-weight": "800", "letter-spacing": ".7"
      }, truncate(event.category.toUpperCase(), maxChars + 4)));
    }
    var titleLines = textLines(event.title, maxChars, 3);
    var titleY = event.category ? 41 : 28;
    titleLines.forEach(function (line, index) {
      group.appendChild(svg("text", {
        x: textX, y: titleY + index * 16, class: "node-title",
        fill: cardText, "font-size": event.image ? "12" : "13"
      }, line.toUpperCase()));
    });
    group.appendChild(svg("text", {
      x: textX, y: TIMELINE_CARD.height - 12,
      class: "node-text", fill: cardText, "font-size": "10", "font-weight": "800"
    }, eventDates(event)));
    group.addEventListener("click", function (mouseEvent) {
      mouseEvent.stopPropagation();
      selectEntity("event", event.id);
    });
    group.addEventListener("focus", function () {
      state.selected = { type: "event", id: event.id };
      renderSelection();
    });
    group.addEventListener("keydown", function (keyEvent) {
      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
        keyEvent.preventDefault();
        openEventDialog(event.id);
      }
    });
    return group;
  }

  function renderExportHeader(parent, project, x, y, width, modeLabel) {
    if (project.emblem) {
      var emblem = svg("image", {
        x: x, y: y, width: "48", height: "52", preserveAspectRatio: "xMidYMid meet", href: project.emblem,
        "aria-hidden": "true"
      });
      emblem.setAttributeNS(XLINK_NS, "xlink:href", project.emblem);
      parent.appendChild(emblem);
    } else {
      var shield = svg("g", { transform: "translate(" + x + " " + y + ")", "aria-hidden": "true" });
      shield.appendChild(svg("path", {
        d: "M 2 2 H 42 V 22 C 42 35 34 44 22 50 C 10 44 2 35 2 22 Z",
        fill: COLORS.gold, stroke: COLORS.ink, "stroke-width": "2"
      }));
      shield.appendChild(svg("path", {
        d: "M 3 7 L 38 38 C 34 43 29 47 22 50 C 10 44 3 35 3 22 Z",
        fill: COLORS.red
      }));
      parent.appendChild(shield);
    }
    var displayName = truncate(project.name.toUpperCase(), Math.max(22, Math.floor((width - 125) / 18)));
    parent.appendChild(svg("text", {
      x: x + 58, y: y + 32, class: "export-title",
      fill: COLORS.ink, "font-size": "31"
    }, displayName));
    if (project.subtitle) {
      var capsuleWidth = Math.min(width - 58, Math.max(170, project.subtitle.length * 7 + 27));
      parent.appendChild(svg("rect", {
        x: x + 58, y: y + 45, width: capsuleWidth, height: "25",
        rx: "13", fill: COLORS.white, stroke: COLORS.gold, "stroke-width": "2"
      }));
      parent.appendChild(svg("text", {
        x: x + 71, y: y + 62, class: "export-sans", fill: COLORS.ink,
        "font-size": "9", "font-weight": "700"
      }, truncate(project.subtitle, 70)));
    }
    parent.appendChild(svg("text", {
      x: x + width, y: y + 18, class: "export-sans", fill: COLORS.muted,
      "font-size": "9", "font-weight": "800", "letter-spacing": "1.4", "text-anchor": "end"
    }, modeLabel));
  }

  function boundsFromPositions(items, positions, width, height) {
    if (!items.length) return { x: -400, y: -80, width: 800, height: 600 };
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    items.forEach(function (item) {
      var position = positions[item.id] || { x: 0, y: 0 };
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + width);
      maxY = Math.max(maxY, position.y + height);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function unionBounds(a, b) {
    var minX = Math.min(a.x, b.x);
    var minY = Math.min(a.y, b.y);
    var maxX = Math.max(a.x + a.width, b.x + b.width);
    var maxY = Math.max(a.y + a.height, b.y + b.height);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function selectProject(id) {
    if (id === state.currentId) {
      closeSidebar();
      return;
    }
    rememberViewport();
    state.currentId = id;
    state.selected = null;
    state.history = [];
    restoreViewport();
    schedulePersist();
    renderAll();
    closeSidebar();
    window.requestAnimationFrame(function () { fitToContent(false); });
  }

  function switchMode(mode) {
    var project = getProject();
    if (!project || project.mode === mode) return;
    rememberViewport();
    project.mode = mode;
    project.updatedAt = new Date().toISOString();
    state.selected = null;
    restoreViewport();
    schedulePersist();
    renderAll();
    window.requestAnimationFrame(function () { fitToContent(true); });
  }

  function selectEntity(type, id) {
    state.selected = { type: type, id: id };
    renderSelection();
    renderCanvas();
  }

  function editSelected() {
    if (!state.selected) return;
    if (state.selected.type === "person") openPersonDialog(state.selected.id);
    else openEventDialog(state.selected.id);
  }

  async function deleteSelected() {
    if (!state.selected) return;
    var project = getProject();
    var selected = state.selected;
    var item = selected.type === "person"
      ? project.tree.people.find(function (person) { return person.id === selected.id; })
      : project.timeline.events.find(function (event) { return event.id === selected.id; });
    if (!item) return;
    var label = selected.type === "person" ? item.name : item.title;
    var confirmed = await askConfirm(
      "„" + label + "“ löschen?",
      selected.type === "person"
        ? "Die Person und alle Verbindungen zu ihr werden entfernt."
        : "Das Ereignis wird aus der Zeitleiste entfernt."
    );
    if (!confirmed) return;
    mutate(selected.type === "person" ? "Person gelöscht" : "Ereignis gelöscht", function (draft) {
      if (selected.type === "person") {
        draft.tree.people = draft.tree.people.filter(function (person) { return person.id !== selected.id; });
        draft.tree.relations = draft.tree.relations.filter(function (relation) {
          return relation.parentId !== selected.id && relation.childId !== selected.id;
        });
      } else {
        draft.timeline.events = draft.timeline.events.filter(function (event) { return event.id !== selected.id; });
      }
    });
    state.selected = null;
    renderAll();
    showToast("Eintrag gelöscht");
  }

  function openPersonDialog(id) {
    var project = getProject();
    var person = id ? project.tree.people.find(function (item) { return item.id === id; }) : null;
    state.editingId = person ? person.id : null;
    state.editingImage = person ? person.image : "";
    state.editingTitles = person ? deepClone(personTitles(person)) : [];
    els.personDialogTitle.textContent = person ? "Person bearbeiten" : "Person hinzufügen";
    els.personName.value = person ? person.name : "";
    els.personBirth.value = person ? person.birth : "";
    els.personDeath.value = person ? person.death : "";
    els.personNotes.value = person ? person.notes : "";
    updateTitleSuggestions(project);
    renderPersonTitleRows(state.editingTitles);
    els.personImageInput.value = "";
    setImageDraft("person", state.editingImage);
    els.personDialog.showModal();
    window.setTimeout(function () { els.personName.focus(); }, 40);
  }

  function updateTitleSuggestions(project) {
    els.titleSuggestions.replaceChildren();
    getTitleLegend(project).forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry.name;
      els.titleSuggestions.appendChild(option);
    });
  }

  function renderPersonTitleRows(titles) {
    els.personTitlesList.replaceChildren();
    (titles && titles.length ? titles : [{ id: uid("title"), name: "", start: "", end: "" }]).forEach(addPersonTitleRow);
  }

  function addPersonTitleRow(title) {
    if (!title && els.personTitlesList.children.length >= 20) {
      showToast("Pro Person sind höchstens 20 Titel möglich.", true);
      return;
    }
    var data = title || { id: uid("title"), name: "", start: "", end: "" };
    var row = document.createElement("div");
    row.className = "title-entry-row";
    row.dataset.titleId = stringValue(data.id) || uid("title");

    var fields = [
      { key: "name", label: "Titel", value: data.name, placeholder: "z. B. Markgraf von Meißen", className: " title-name-field" },
      { key: "start", label: "Von", value: data.start, placeholder: "z. B. 985" },
      { key: "end", label: "Bis", value: data.end, placeholder: "z. B. 1002" }
    ];
    fields.forEach(function (field) {
      var label = document.createElement("label");
      label.className = "field" + (field.className || "");
      var caption = document.createElement("span");
      caption.textContent = field.label;
      var input = document.createElement("input");
      input.type = "text";
      input.maxLength = field.key === "name" ? 100 : 30;
      input.placeholder = field.placeholder;
      input.value = stringValue(field.value);
      input.dataset.titleField = field.key;
      if (field.key === "name") input.setAttribute("list", "titleSuggestions");
      label.append(caption, input);
      row.appendChild(label);
    });
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-title-button";
    remove.setAttribute("data-remove-title", "true");
    remove.setAttribute("aria-label", "Titel entfernen");
    remove.textContent = "×";
    row.appendChild(remove);
    els.personTitlesList.appendChild(row);
  }

  function collectPersonTitles() {
    var titles = [];
    var invalidInput = null;
    Array.from(els.personTitlesList.querySelectorAll(".title-entry-row")).slice(0, 20).forEach(function (row) {
      var nameInput = row.querySelector('[data-title-field="name"]');
      var startInput = row.querySelector('[data-title-field="start"]');
      var endInput = row.querySelector('[data-title-field="end"]');
      var name = nameInput.value.trim();
      var start = startInput.value.trim();
      var end = endInput.value.trim();
      if (!name && (start || end) && !invalidInput) invalidInput = nameInput;
      if (name) titles.push({
        id: row.dataset.titleId || uid("title"),
        name: name,
        start: start,
        end: end
      });
    });
    if (invalidInput) {
      invalidInput.setCustomValidity("Bitte zuerst einen Titel eingeben.");
      invalidInput.reportValidity();
      invalidInput.addEventListener("input", function clearTitleValidity() {
        invalidInput.setCustomValidity("");
        invalidInput.removeEventListener("input", clearTitleValidity);
      });
      return null;
    }
    return titles;
  }

  function savePerson(event) {
    event.preventDefault();
    var name = els.personName.value.trim();
    if (!name) {
      els.personName.focus();
      return;
    }
    var titles = collectPersonTitles();
    if (!titles) return;
    var editingId = state.editingId;
    var personData = {
      name: name,
      titles: titles,
      birth: els.personBirth.value.trim(),
      death: els.personDeath.value.trim(),
      notes: els.personNotes.value.trim(),
      image: state.editingImage
    };
    var newId = editingId || uid("person");
    mutate(editingId ? "Person bearbeitet" : "Person hinzugefügt", function (project) {
      if (editingId) {
        var person = project.tree.people.find(function (item) { return item.id === editingId; });
        if (person) {
          Object.assign(person, personData);
          delete person.title;
        }
      } else {
        project.tree.people.push(Object.assign({ id: newId, position: nextTreePosition(project) }, personData));
      }
    });
    state.selected = { type: "person", id: newId };
    els.personDialog.close();
    renderAll();
    showToast(editingId ? "Person aktualisiert" : "Person hinzugefügt");
    if (!editingId && getProject().tree.people.length === 1) {
      window.requestAnimationFrame(function () { fitToContent(true); });
    }
  }

  function nextTreePosition(project) {
    if (!project.tree.people.length) return { x: -TREE_CARD.width / 2, y: 130 };
    var positions = calculateTreePositions(project);
    var maxY = Math.max.apply(null, project.tree.people.map(function (person) { return positions[person.id].y; }));
    var onLastRow = project.tree.people.filter(function (person) { return Math.abs(positions[person.id].y - maxY) < 5; });
    var maxX = Math.max.apply(null, onLastRow.map(function (person) { return positions[person.id].x; }));
    return { x: maxX + TREE_CARD.width + TREE_CARD.gapX, y: maxY };
  }

  function openEventDialog(id) {
    var project = getProject();
    var item = id ? project.timeline.events.find(function (event) { return event.id === id; }) : null;
    state.editingId = item ? item.id : null;
    state.editingImage = item ? item.image : "";
    els.eventDialogTitle.textContent = item ? "Ereignis bearbeiten" : "Ereignis hinzufügen";
    els.eventTitle.value = item ? item.title : "";
    els.eventCategory.value = item ? item.category : "";
    els.eventStart.value = item ? item.start : "";
    els.eventEnd.value = item ? item.end : "";
    els.eventNotes.value = item ? item.notes : "";
    els.eventImageInput.value = "";
    setImageDraft("event", state.editingImage);
    els.eventDialog.showModal();
    window.setTimeout(function () { els.eventTitle.focus(); }, 40);
  }

  function saveEvent(event) {
    event.preventDefault();
    var title = els.eventTitle.value.trim();
    var start = els.eventStart.value.trim();
    if (!title || !start) {
      (title ? els.eventStart : els.eventTitle).focus();
      return;
    }
    if (!Number.isFinite(parseYear(start))) {
      showToast("Bitte im Beginn ein Jahr angeben, z. B. 1112.", true);
      els.eventStart.focus();
      return;
    }
    var editingId = state.editingId;
    var eventData = {
      title: title,
      category: els.eventCategory.value.trim(),
      start: start,
      end: els.eventEnd.value.trim(),
      notes: els.eventNotes.value.trim(),
      image: state.editingImage
    };
    var newId = editingId || uid("event");
    mutate(editingId ? "Ereignis bearbeitet" : "Ereignis hinzugefügt", function (project) {
      if (editingId) {
        var item = project.timeline.events.find(function (candidate) { return candidate.id === editingId; });
        if (item) Object.assign(item, eventData);
      } else {
        project.timeline.events.push(Object.assign({ id: newId, position: null }, eventData));
      }
    });
    state.selected = { type: "event", id: newId };
    els.eventDialog.close();
    renderAll();
    showToast(editingId ? "Ereignis aktualisiert" : "Ereignis hinzugefügt");
    if (!editingId && getProject().timeline.events.length === 1) {
      window.requestAnimationFrame(function () { fitToContent(true); });
    }
  }

  function openRelationDialog() {
    var people = getProject().tree.people;
    if (people.length < 2) {
      showToast("Lege zuerst mindestens zwei Personen an.", true);
      return;
    }
    els.relationParent.replaceChildren();
    els.relationChild.replaceChildren();
    people.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "de"); }).forEach(function (person) {
      var parentOption = document.createElement("option");
      parentOption.value = person.id;
      parentOption.textContent = person.name + (lifeDates(person) ? " (" + lifeDates(person) + ")" : "");
      var childOption = parentOption.cloneNode(true);
      els.relationParent.appendChild(parentOption);
      els.relationChild.appendChild(childOption);
    });
    if (state.selected && state.selected.type === "person") {
      els.relationParent.value = state.selected.id;
      var alternate = people.find(function (person) { return person.id !== state.selected.id; });
      if (alternate) els.relationChild.value = alternate.id;
    } else if (people[1]) {
      els.relationChild.value = people[1].id;
    }
    var parentType = els.relationForm.querySelector('input[name="relationType"][value="parent"]');
    if (parentType) parentType.checked = true;
    syncRelationDialog();
    els.relationMessage.classList.add("hidden");
    els.relationMessage.textContent = "";
    renderRelationList();
    els.relationDialog.showModal();
  }

  function syncRelationDialog() {
    var selectedType = els.relationForm.querySelector('input[name="relationType"]:checked');
    var isPartner = selectedType && selectedType.value === "partner";
    els.relationDialogTitle.textContent = isPartner ? "Partnerschaft eintragen" : "Elternteil und Kind verbinden";
    els.relationFirstLabel.textContent = isPartner ? "Erste Person" : "Elternteil";
    els.relationSecondLabel.textContent = isPartner ? "Zweite Person" : "Kind";
    var arrow = els.relationForm.querySelector(".relation-arrow");
    if (arrow) arrow.textContent = isPartner ? "↔" : "→";
    els.relationMessage.classList.add("hidden");
  }

  function renderRelationList() {
    var project = getProject();
    var names = Object.create(null);
    project.tree.people.forEach(function (person) { names[person.id] = person.name; });
    els.relationList.replaceChildren();
    if (!project.tree.relations.length) {
      var empty = document.createElement("p");
      empty.className = "relation-list-empty";
      empty.textContent = "Noch keine Verbindungen angelegt.";
      els.relationList.appendChild(empty);
      return;
    }
    project.tree.relations.forEach(function (relation) {
      var row = document.createElement("div");
      row.className = "relation-list-item";
      var label = document.createElement("span");
      label.textContent = (names[relation.parentId] || "Unbekannt")
        + (relation.type === "partner" ? " ↔ " : " → ")
        + (names[relation.childId] || "Unbekannt");
      var remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", "Verbindung " + label.textContent + " löschen");
      remove.title = "Verbindung löschen";
      remove.textContent = "×";
      remove.addEventListener("click", function () {
        mutate("Verbindung gelöscht", function (draft) {
          draft.tree.relations = draft.tree.relations.filter(function (item) { return item.id !== relation.id; });
          autoArrangeTree(draft);
        });
        renderRelationList();
        showToast("Verbindung gelöscht");
      });
      row.append(label, remove);
      els.relationList.appendChild(row);
    });
  }

  function saveRelation(event) {
    event.preventDefault();
    var parentId = els.relationParent.value;
    var childId = els.relationChild.value;
    var checkedType = els.relationForm.querySelector('input[name="relationType"]:checked');
    var relationType = checkedType && checkedType.value === "partner" ? "partner" : "parent";
    var project = getProject();
    var error = "";
    if (parentId === childId) error = relationType === "partner"
      ? "Eine Person kann nicht mit sich selbst verbunden werden."
      : "Eine Person kann nicht ihr eigenes Elternteil sein.";
    if (!error && project.tree.relations.some(function (relation) {
      if ((relation.type === "partner") !== (relationType === "partner")) return false;
      if (relationType === "partner") {
        return (relation.parentId === parentId && relation.childId === childId)
          || (relation.parentId === childId && relation.childId === parentId);
      }
      return relation.parentId === parentId && relation.childId === childId;
    })) error = "Diese Verbindung besteht bereits.";
    if (!error && relationType === "parent" && createsCycle(project, parentId, childId)) {
      error = "Diese Verbindung würde einen Kreis im Stammbaum erzeugen.";
    }
    if (!error && relationType === "partner"
      && (hasAncestryPath(project, parentId, childId) || hasAncestryPath(project, childId, parentId))) {
      error = "Direkte Vorfahren und Nachkommen können nicht als Partnerschaft verbunden werden.";
    }
    if (error) {
      els.relationMessage.textContent = error;
      els.relationMessage.classList.remove("hidden");
      return;
    }
    mutate("Verbindung hinzugefügt", function (draft) {
      draft.tree.relations.push({ id: uid("relation"), type: relationType, parentId: parentId, childId: childId });
      autoArrangeTree(draft);
    });
    els.relationDialog.close();
    showToast("Verbindung hinzugefügt");
    window.requestAnimationFrame(function () { fitToContent(true); });
  }

  function createsCycle(project, parentId, childId) {
    var childrenByParent = Object.create(null);
    project.tree.relations.forEach(function (relation) {
      if (relation.type === "partner") return;
      if (!childrenByParent[relation.parentId]) childrenByParent[relation.parentId] = [];
      childrenByParent[relation.parentId].push(relation.childId);
    });
    if (!childrenByParent[parentId]) childrenByParent[parentId] = [];
    childrenByParent[parentId].push(childId);
    var stack = [childId];
    var seen = Object.create(null);
    while (stack.length) {
      var current = stack.pop();
      if (current === parentId) return true;
      if (seen[current]) continue;
      seen[current] = true;
      (childrenByParent[current] || []).forEach(function (next) { stack.push(next); });
    }
    return false;
  }

  function hasAncestryPath(project, ancestorId, descendantId) {
    var childrenByParent = Object.create(null);
    project.tree.relations.forEach(function (relation) {
      if (relation.type === "partner") return;
      if (!childrenByParent[relation.parentId]) childrenByParent[relation.parentId] = [];
      childrenByParent[relation.parentId].push(relation.childId);
    });
    var stack = [ancestorId];
    var seen = Object.create(null);
    while (stack.length) {
      var current = stack.pop();
      if (current === descendantId && current !== ancestorId) return true;
      if (seen[current]) continue;
      seen[current] = true;
      (childrenByParent[current] || []).forEach(function (next) { stack.push(next); });
    }
    return false;
  }

  function arrangeCurrentView() {
    var project = getProject();
    if (project.mode === "tree") {
      mutate("Stammbaum angeordnet", function (draft) { autoArrangeTree(draft); });
      showToast("Stammbaum automatisch angeordnet");
    } else {
      mutate("Zeitleiste angeordnet", function (draft) {
        draft.timeline.events.forEach(function (event) { event.position = null; });
      });
      showToast("Zeitleiste chronologisch angeordnet");
    }
    window.requestAnimationFrame(function () { fitToContent(true); });
  }

  function autoArrangeTree(project) {
    project.tree.people.forEach(function (person) { person.position = null; });
    var positions = calculateTreePositions(project);
    project.tree.people.forEach(function (person) { person.position = positions[person.id]; });
  }

  function openProjectDialog(mode) {
    state.projectDialogMode = mode;
    var project = getProject();
    var isNew = mode === "new";
    els.projectDialogTitle.textContent = isNew ? "Neues Projekt" : "Projektdaten bearbeiten";
    els.projectName.value = isNew ? "" : project.name;
    els.projectSubtitle.value = isNew ? "" : project.subtitle;
    els.projectImageInput.value = "";
    state.editingImage = isNew ? "" : project.emblem;
    setImageDraft("project", state.editingImage);
    els.newProjectModeField.classList.toggle("hidden", !isNew);
    if (isNew) {
      var radio = els.projectForm.querySelector('input[name="projectMode"][value="tree"]');
      if (radio) radio.checked = true;
    }
    els.projectDialog.showModal();
    window.setTimeout(function () { els.projectName.focus(); }, 40);
  }

  function saveProjectDialog(event) {
    event.preventDefault();
    var name = els.projectName.value.trim();
    if (!name) {
      els.projectName.focus();
      return;
    }
    var subtitle = els.projectSubtitle.value.trim();
    if (state.projectDialogMode === "new") {
      var checked = els.projectForm.querySelector('input[name="projectMode"]:checked');
      var project = emptyProject(name, subtitle, checked ? checked.value : "tree");
      project.emblem = state.editingImage;
      state.projects.push(project);
      state.currentId = project.id;
      state.history = [];
      state.selected = null;
      state.viewport = { x: 0, y: 0, scale: 1 };
      schedulePersist();
      renderAll();
      showToast("Neues Projekt angelegt");
      window.requestAnimationFrame(function () { fitToContent(false); });
    } else {
      mutate("Projekt umbenannt", function (project) {
        project.name = name;
        project.subtitle = subtitle;
        project.emblem = state.editingImage;
      });
      showToast("Projektdaten aktualisiert");
    }
    els.projectDialog.close();
  }

  function duplicateCurrentProject() {
    hideMenus();
    var copy = deepClone(getProject());
    copy.id = uid("project");
    copy.name += " – Kopie";
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    copy.tree.people.forEach(function (person) { person.id = "old-" + person.id; });
    var idMap = Object.create(null);
    copy.tree.people.forEach(function (person) {
      var oldId = person.id.slice(4);
      person.id = uid("person");
      idMap[oldId] = person.id;
    });
    copy.tree.relations = copy.tree.relations.map(function (relation) {
      return {
        id: uid("relation"),
        type: relation.type === "partner" ? "partner" : "parent",
        parentId: idMap[relation.parentId],
        childId: idMap[relation.childId]
      };
    }).filter(function (relation) { return relation.parentId && relation.childId; });
    copy.timeline.events.forEach(function (event) { event.id = uid("event"); });
    state.projects.push(copy);
    state.currentId = copy.id;
    state.selected = null;
    state.history = [];
    schedulePersist();
    renderAll();
    showToast("Projekt dupliziert");
    window.requestAnimationFrame(function () { fitToContent(false); });
  }

  async function deleteCurrentProject() {
    hideMenus();
    var project = getProject();
    var confirmed = await askConfirm(
      "Projekt „" + project.name + "“ löschen?",
      "Das Projekt wird aus diesem Browser entfernt. Eine zuvor exportierte JSON-Datei bleibt erhalten."
    );
    if (!confirmed) return;
    var previousProjects = state.projects;
    var previousCurrentId = state.currentId;
    state.projects = state.projects.filter(function (item) { return item.id !== project.id; });
    if (!state.projects.length) state.projects.push(emptyProject("Neue Chronik", "", "tree"));
    state.currentId = state.projects[0].id;
    state.selected = null;
    state.history = [];
    var saved = persistNow();
    if (!saved) {
      state.projects = previousProjects;
      state.currentId = previousCurrentId;
      renderAll();
      showToast("Projekt konnte nicht gelöscht werden, weil der Browserspeicher voll ist.", true);
      return;
    }
    renderAll();
    showToast("Projekt gelöscht");
    window.requestAnimationFrame(function () { fitToContent(false); });
  }

  function askConfirm(title, text) {
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.confirmDialog.returnValue = "";
    els.confirmDialog.showModal();
    return new Promise(function (resolve) {
      function onClose() {
        els.confirmDialog.removeEventListener("close", onClose);
        resolve(els.confirmDialog.returnValue === "confirm");
      }
      els.confirmDialog.addEventListener("close", onClose);
    });
  }

  function setImageDraft(kind, value) {
    state.editingImage = value || "";
    var preview = kind === "person" ? els.personImagePreview
      : kind === "project" ? els.projectImagePreview : els.eventImagePreview;
    var placeholder = kind === "person" ? els.personImagePlaceholder
      : kind === "project" ? els.projectImagePlaceholder : els.eventImagePlaceholder;
    var remove = kind === "person" ? els.removePersonImageButton
      : kind === "project" ? els.removeProjectImageButton : els.removeEventImageButton;
    if (state.editingImage) {
      preview.src = state.editingImage;
      preview.classList.remove("hidden");
      placeholder.classList.add("hidden");
      remove.classList.remove("hidden");
    } else {
      preview.removeAttribute("src");
      preview.classList.add("hidden");
      placeholder.classList.remove("hidden");
      remove.classList.add("hidden");
    }
  }

  async function handleImageInput(kind) {
    var input = kind === "person" ? els.personImageInput
      : kind === "project" ? els.projectImageInput : els.eventImageInput;
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type)) {
      showToast("Bitte ein JPG-, PNG-, WebP- oder GIF-Bild auswählen.", true);
      input.value = "";
      return;
    }
    try {
      var dataUrl = await imageFileToDataUrl(file);
      setImageDraft(kind, dataUrl);
    } catch (error) {
      console.error(error);
      showToast("Das Bild konnte nicht verarbeitet werden.", true);
    }
  }

  function imageFileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var original = String(reader.result || "");
        if (file.type === "image/gif" && file.size <= 1800000) {
          resolve(original);
          return;
        }
        var image = new Image();
        image.onerror = function () { resolve(original); };
        image.onload = function () {
          var maxSide = 1200;
          var scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
          if (scale === 1 && file.size < 900000) {
            resolve(original);
            return;
          }
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          var context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", .86));
        };
        image.src = original;
      };
      reader.readAsDataURL(file);
    });
  }

  function onCanvasPointerDown(event) {
    if (event.button !== 0) return;
    var node = event.target.closest(".entity-node");
    var project = getProject();
    if (node && !state.spacePressed) {
      var type = node.getAttribute("data-type");
      var id = node.getAttribute("data-id");
      var item = type === "person"
        ? project.tree.people.find(function (person) { return person.id === id; })
        : project.timeline.events.find(function (entry) { return entry.id === id; });
      if (!item) return;
      var beforeProject = deepClone(project);
      var world = screenToWorld(event.clientX, event.clientY);
      var timelineOrder = project.timeline.events.slice().sort(function (a, b) {
        return parseYear(a.start) - parseYear(b.start) || a.title.localeCompare(b.title, "de");
      });
      var positions = type === "person" ? calculateTreePositions(project) : calculateTimelinePositions(timelineOrder);
      var startPosition = positions[id] || { x: 0, y: 0 };
      state.pointer = {
        kind: "node",
        pointerId: event.pointerId,
        type: type,
        id: id,
        startWorld: world,
        startPosition: { x: startPosition.x, y: startPosition.y },
        beforeProject: beforeProject,
        moved: false
      };
      event.preventDefault();
      return;
    }
    state.pointer = {
      kind: "pan",
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startViewport: { x: state.viewport.x, y: state.viewport.y },
      moved: false
    };
    els.editorCanvas.classList.add("panning");
    try { els.editorCanvas.setPointerCapture(event.pointerId); } catch (error) { /* older browser */ }
    event.preventDefault();
  }

  function onWindowPointerMove(event) {
    var pointer = state.pointer;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (pointer.kind === "pan") {
      var dx = event.clientX - pointer.startClient.x;
      var dy = event.clientY - pointer.startClient.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) pointer.moved = true;
      state.viewport.x = pointer.startViewport.x + dx;
      state.viewport.y = pointer.startViewport.y + dy;
      applyViewport();
      return;
    }
    var project = getProject();
    var current = screenToWorld(event.clientX, event.clientY);
    var item = pointer.type === "person"
      ? project.tree.people.find(function (person) { return person.id === pointer.id; })
      : project.timeline.events.find(function (entry) { return entry.id === pointer.id; });
    if (!item) return;
    var dxWorld = current.x - pointer.startWorld.x;
    var dyWorld = current.y - pointer.startWorld.y;
    if (Math.abs(dxWorld) + Math.abs(dyWorld) > 2) pointer.moved = true;
    item.position = {
      x: Math.round(pointer.startPosition.x + dxWorld),
      y: Math.round(pointer.startPosition.y + dyWorld)
    };
    if (!state.renderFrame) {
      state.renderFrame = window.requestAnimationFrame(function () {
        state.renderFrame = null;
        renderCanvas();
      });
    }
  }

  function onWindowPointerUp(event) {
    var pointer = state.pointer;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    state.pointer = null;
    els.editorCanvas.classList.remove("panning");
    try { els.editorCanvas.releasePointerCapture(event.pointerId); } catch (error) { /* no capture */ }
    if (pointer.kind === "pan") {
      rememberViewport();
      if (!pointer.moved && (event.target === els.editorCanvas || event.target === els.canvasBackground)) {
        state.selected = null;
        renderSelection();
        renderCanvas();
      }
      return;
    }
    if (pointer.moved) {
      state.history.push({
        label: pointer.type === "person" ? "Person verschoben" : "Ereignis verschoben",
        projectId: pointer.beforeProject.id,
        snapshot: pointer.beforeProject
      });
      if (state.history.length > 40) state.history.shift();
      getProject().updatedAt = new Date().toISOString();
      schedulePersist();
      renderAll();
    } else {
      selectEntity(pointer.type, pointer.id);
    }
  }

  function onCanvasWheel(event) {
    event.preventDefault();
    var rect = els.editorCanvas.getBoundingClientRect();
    var pointerX = event.clientX - rect.left;
    var pointerY = event.clientY - rect.top;
    var worldX = (pointerX - state.viewport.x) / state.viewport.scale;
    var worldY = (pointerY - state.viewport.y) / state.viewport.scale;
    var factor = Math.exp(-event.deltaY * .0013);
    var nextScale = clamp(state.viewport.scale * factor, .18, 3);
    state.viewport.x = pointerX - worldX * nextScale;
    state.viewport.y = pointerY - worldY * nextScale;
    state.viewport.scale = nextScale;
    applyViewport();
    rememberViewport();
  }

  function screenToWorld(clientX, clientY) {
    var rect = els.editorCanvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.viewport.x) / state.viewport.scale,
      y: (clientY - rect.top - state.viewport.y) / state.viewport.scale
    };
  }

  function applyViewport() {
    els.viewportGroup.setAttribute(
      "transform",
      "translate(" + state.viewport.x + " " + state.viewport.y + ") scale(" + state.viewport.scale + ")"
    );
    els.zoomResetButton.textContent = Math.round(state.viewport.scale * 100) + "%";
  }

  function zoomAtCenter(factor) {
    var rect = els.editorCanvas.getBoundingClientRect();
    zoomAround(rect.width / 2, rect.height / 2, factor);
  }

  function setZoom(scale) {
    var rect = els.editorCanvas.getBoundingClientRect();
    zoomAround(rect.width / 2, rect.height / 2, scale / state.viewport.scale);
  }

  function zoomAround(pointX, pointY, factor) {
    var worldX = (pointX - state.viewport.x) / state.viewport.scale;
    var worldY = (pointY - state.viewport.y) / state.viewport.scale;
    var nextScale = clamp(state.viewport.scale * factor, .18, 3);
    state.viewport.x = pointX - worldX * nextScale;
    state.viewport.y = pointY - worldY * nextScale;
    state.viewport.scale = nextScale;
    applyViewport();
    rememberViewport();
  }

  function fitToContent(animate) {
    var rect = els.editorCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var bounds = state.lastBounds;
    var padding = rect.width < 600 ? 32 : 64;
    var availableWidth = Math.max(100, rect.width - padding * 2);
    var availableHeight = Math.max(100, rect.height - padding * 2);
    var scale = clamp(Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height)), .18, 1.25);
    var x = (rect.width - bounds.width * scale) / 2 - bounds.x * scale;
    var y = (rect.height - bounds.height * scale) / 2 - bounds.y * scale;
    if (animate && typeof els.viewportGroup.animate === "function") {
      var from = "translate(" + state.viewport.x + "px," + state.viewport.y + "px) scale(" + state.viewport.scale + ")";
      var to = "translate(" + x + "px," + y + "px) scale(" + scale + ")";
      els.viewportGroup.animate([{ transform: from }, { transform: to }], { duration: 260, easing: "ease-out" });
    }
    state.viewport = { x: x, y: y, scale: scale };
    applyViewport();
    rememberViewport();
  }

  function viewportKey() {
    var project = getProject();
    return project ? project.id + ":" + project.mode : "";
  }

  function rememberViewport() {
    var key = viewportKey();
    if (key) state.viewports[key] = { x: state.viewport.x, y: state.viewport.y, scale: state.viewport.scale };
  }

  function restoreViewport() {
    var saved = state.viewports[viewportKey()];
    state.viewport = saved ? { x: saved.x, y: saved.y, scale: saved.scale } : { x: 0, y: 0, scale: 1 };
  }

  function exportJson() {
    hideMenus();
    var project = deepClone(getProject());
    var payload = {
      format: "adelschronik",
      version: 1,
      exportedAt: new Date().toISOString(),
      project: project
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, fileName(project.name) + ".json");
    showToast("JSON-Sicherung erstellt");
  }

  async function importJson(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      var text = await file.text();
      var parsed = JSON.parse(text);
      var source = parsed && parsed.format === "adelschronik" && parsed.project ? parsed.project : parsed;
      if (!isValidImportedProject(source)) throw new Error("Ungültiges Format");
      var project = normalizeProject(source);
      project.id = uid("project");
      project.name = project.name + " – Import";
      project.createdAt = new Date().toISOString();
      project.updatedAt = project.createdAt;
      state.projects.push(project);
      state.currentId = project.id;
      state.selected = null;
      state.history = [];
      var saved = persistNow();
      renderAll();
      showToast(saved ? "Projekt erfolgreich importiert" : "Projekt geöffnet, aber der Browserspeicher ist voll.", !saved);
      window.requestAnimationFrame(function () { fitToContent(false); });
    } catch (error) {
      console.error(error);
      showToast("Diese JSON-Datei ist kein gültiges Adelschronik-Projekt.", true);
    }
  }

  function isValidImportedProject(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return false;
    var hasTree = source.tree !== undefined;
    var hasTimeline = source.timeline !== undefined;
    if (!hasTree && !hasTimeline) return false;

    var peopleIds = Object.create(null);
    if (hasTree) {
      if (!source.tree || typeof source.tree !== "object" || Array.isArray(source.tree)
        || !Array.isArray(source.tree.people) || !Array.isArray(source.tree.relations)) return false;
      for (var personIndex = 0; personIndex < source.tree.people.length; personIndex += 1) {
        var person = source.tree.people[personIndex];
        if (!person || typeof person !== "object" || Array.isArray(person)) return false;
        var personId = stringValue(person.id);
        if (personId) {
          if (peopleIds[personId]) return false;
          peopleIds[personId] = true;
        }
      }
      var relationKeys = Object.create(null);
      var graph = { tree: { relations: [] } };
      for (var relationIndex = 0; relationIndex < source.tree.relations.length; relationIndex += 1) {
        var relation = source.tree.relations[relationIndex];
        if (!relation || typeof relation !== "object" || Array.isArray(relation)) return false;
        var parentId = stringValue(relation.parentId);
        var childId = stringValue(relation.childId);
        if (!parentId || !childId || parentId === childId || !peopleIds[parentId] || !peopleIds[childId]) return false;
        var type = relation.type === "partner" ? "partner" : "parent";
        var endpoints = type === "partner" ? [parentId, childId].sort().join("|") : parentId + "|" + childId;
        var relationKey = type + "|" + endpoints;
        if (relationKeys[relationKey]) return false;
        relationKeys[relationKey] = true;
        if (type === "parent" && createsCycle(graph, parentId, childId)) return false;
        graph.tree.relations.push({ type: type, parentId: parentId, childId: childId });
      }
      if (graph.tree.relations.some(function (relation) {
        return relation.type === "partner"
          && (hasAncestryPath(graph, relation.parentId, relation.childId)
            || hasAncestryPath(graph, relation.childId, relation.parentId));
      })) return false;
    }

    if (hasTimeline) {
      if (!source.timeline || typeof source.timeline !== "object" || Array.isArray(source.timeline)
        || !Array.isArray(source.timeline.events)) return false;
      var eventIds = Object.create(null);
      for (var eventIndex = 0; eventIndex < source.timeline.events.length; eventIndex += 1) {
        var timelineEvent = source.timeline.events[eventIndex];
        if (!timelineEvent || typeof timelineEvent !== "object" || Array.isArray(timelineEvent)) return false;
        var eventId = stringValue(timelineEvent.id);
        if (eventId) {
          if (eventIds[eventId]) return false;
          eventIds[eventId] = true;
        }
        if (typeof timelineEvent.start !== "string" || !Number.isFinite(parseYear(timelineEvent.start))) return false;
      }
    }
    return true;
  }

  function createExportSvg() {
    var padding = 66;
    var bounds = state.lastBounds;
    var width = Math.max(400, Math.ceil(bounds.width + padding * 2));
    var height = Math.max(300, Math.ceil(bounds.height + padding * 2));
    var root = document.createElementNS(SVG_NS, "svg");
    root.setAttribute("xmlns", SVG_NS);
    root.setAttribute("xmlns:xlink", XLINK_NS);
    root.setAttribute("width", String(width));
    root.setAttribute("height", String(height));
    root.setAttribute("viewBox", (bounds.x - padding) + " " + (bounds.y - padding) + " " + width + " " + height);
    root.setAttribute("role", "img");
    root.setAttribute("aria-label", getProject().name);
    root.appendChild(svg("rect", {
      x: bounds.x - padding, y: bounds.y - padding, width: width, height: height, fill: COLORS.ivory
    }));
    var defs = svg("defs");
    var style = svg("style");
    style.textContent = [
      ".entity-node{cursor:default}.node-title{font-family:Impact,'Arial Narrow',Arial,sans-serif;font-weight:900;letter-spacing:.02em}",
      ".node-text,.export-sans{font-family:Arial,sans-serif}.export-title{font-family:Impact,'Arial Narrow',Arial,sans-serif;font-weight:900;letter-spacing:.035em}",
      ".export-serif{font-family:Georgia,serif}"
    ].join("");
    defs.appendChild(style);
    root.appendChild(defs);
    var content = els.viewportGroup.cloneNode(true);
    content.removeAttribute("transform");
    content.querySelectorAll("[data-selection-ring='true']").forEach(function (ring) { ring.remove(); });
    content.querySelectorAll("[data-selection-outline='true']").forEach(function (outline) {
      outline.setAttribute("x", "0");
      outline.setAttribute("y", "0");
      outline.setAttribute("width", getProject().mode === "tree" ? String(TREE_CARD.width) : String(TIMELINE_CARD.width));
      outline.setAttribute("height", getProject().mode === "tree" ? String(TREE_CARD.baseHeight) : String(TIMELINE_CARD.height));
      outline.setAttribute("fill", COLORS.gold);
      outline.setAttribute("stroke", "none");
      outline.setAttribute("stroke-width", "0");
      outline.removeAttribute("data-selection-outline");
    });
    content.querySelectorAll(".entity-node").forEach(function (node) {
      node.removeAttribute("tabindex");
      node.removeAttribute("role");
      node.removeAttribute("aria-label");
      node.removeAttribute("class");
    });
    root.appendChild(content);
    return { root: root, width: width, height: height };
  }

  function exportSvg() {
    hideMenus();
    var exported = createExportSvg();
    var source = new XMLSerializer().serializeToString(exported.root);
    var blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', source], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, fileName(getProject().name) + "-" + getProject().mode + ".svg");
    showToast("SVG exportiert");
  }

  function exportPng() {
    hideMenus();
    var exported = createExportSvg();
    var source = new XMLSerializer().serializeToString(exported.root);
    var svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(svgBlob);
    var image = new Image();
    image.onload = function () {
      try {
        var maxDimension = 10000;
        var outputScale = Math.min(2, maxDimension / Math.max(exported.width, exported.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(exported.width * outputScale));
        canvas.height = Math.max(1, Math.round(exported.height * outputScale));
        var context = canvas.getContext("2d");
        context.fillStyle = COLORS.ivory;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (!blob) {
            showToast("PNG konnte nicht erstellt werden.", true);
            return;
          }
          downloadBlob(blob, fileName(getProject().name) + "-" + getProject().mode + ".png");
          showToast("PNG exportiert");
        }, "image/png");
      } catch (error) {
        URL.revokeObjectURL(url);
        console.error(error);
        showToast("PNG konnte nicht erstellt werden.", true);
      }
    };
    image.onerror = function () {
      URL.revokeObjectURL(url);
      showToast("PNG konnte nicht erstellt werden.", true);
    };
    image.src = url;
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  function onKeyDown(event) {
    var tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
    var typing = tag === "input" || tag === "textarea" || tag === "select" || (event.target && event.target.isContentEditable);
    if (event.code === "Space" && !typing) {
      state.spacePressed = true;
      event.preventDefault();
    }
    if (typing || document.querySelector("dialog[open]")) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    } else if ((event.key === "Delete" || event.key === "Backspace") && state.selected) {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === "Escape" && state.selected) {
      state.selected = null;
      renderSelection();
      renderCanvas();
    } else if (event.key === "0") {
      event.preventDefault();
      fitToContent(true);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomAtCenter(1.18);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomAtCenter(1 / 1.18);
    }
  }

  function toggleMenu(menu, button) {
    var willOpen = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !willOpen);
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }

  function hideMenu(menu, button) {
    menu.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
  }

  function hideMenus() {
    hideMenu(els.dataMenu, els.dataMenuButton);
    hideMenu(els.exportMenu, els.exportButton);
  }

  function openSidebar() {
    els.sidebar.classList.add("open");
    els.sidebarScrim.classList.add("visible");
    els.mobileMenuButton.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    els.sidebar.classList.remove("open");
    els.sidebarScrim.classList.remove("visible");
    els.mobileMenuButton.setAttribute("aria-expanded", "false");
  }

  function showToast(message, isError) {
    var toast = document.createElement("div");
    toast.className = "toast" + (isError ? " error" : "");
    toast.textContent = message;
    els.toastRegion.appendChild(toast);
    window.setTimeout(function () {
      toast.classList.add("out");
      window.setTimeout(function () { toast.remove(); }, 250);
    }, 2800);
  }

  function svg(tag, attributes, text) {
    var element = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes || {}).forEach(function (key) {
      var value = attributes[key];
      if (value !== null && value !== undefined) element.setAttribute(key, String(value));
    });
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function lifeDates(person) {
    if (!person.birth && !person.death) return "";
    return (person.birth || "?") + "—" + (person.death || "?");
  }

  function eventDates(event) {
    if (!event.start) return event.end || "";
    return event.end ? event.start + "—" + event.end : event.start;
  }

  function parseYear(value) {
    var match = String(value || "").match(/-?\d{1,4}/);
    return match ? Number(match[0]) : NaN;
  }

  function textLines(text, maxChars, maxLines) {
    var words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    var lines = [];
    var current = "";
    words.forEach(function (word) {
      var next = current ? current + " " + word : word;
      if (next.length > maxChars && current && lines.length < maxLines - 1) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = truncate(lines[maxLines - 1], maxChars);
    }
    if (lines[maxLines - 1] && lines[maxLines - 1].length > maxChars + 5) {
      lines[maxLines - 1] = truncate(lines[maxLines - 1], maxChars + 2);
    }
    return lines;
  }

  function truncate(text, maxLength) {
    var value = String(text || "");
    return value.length > maxLength ? value.slice(0, Math.max(1, maxLength - 1)).trim() + "…" : value;
  }

  function initials(name) {
    return String(name || "A").split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("") || "A";
  }

  function relativeDate(dateValue) {
    var date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "lokal";
    var diff = Date.now() - date.getTime();
    if (diff < 60000) return "gerade eben";
    if (diff < 3600000) return "vor " + Math.max(1, Math.round(diff / 60000)) + " Min.";
    if (diff < 86400000) return "vor " + Math.max(1, Math.round(diff / 3600000)) + " Std.";
    return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function fileName(name) {
    var clean = String(name || "adelschronik")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return clean || "adelschronik";
  }

  function uid(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + "-" + window.crypto.randomUUID();
    }
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function deepClone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function debounce(callback, delay) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { callback.apply(null, args); }, delay);
    };
  }
})();
