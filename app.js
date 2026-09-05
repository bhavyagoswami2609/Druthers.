/* ═══════════════════════════════════════════════════════════
   Weighted Decision Matrix — app.js
   Multi-decision, auto-save, vanilla JS
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── Constants ──────────────────────────────────────────── */
  var STORAGE_KEY = "weighted_decision_matrix";
  var THEME_KEY   = "decision_matrix_theme";
  var MATH_KEY    = "decision_matrix_show_math";
  var SIDEBAR_KEY = "decision_matrix_sidebar_collapsed";

  /* ── Helpers ────────────────────────────────────────────── */
  function uid() { return Math.random().toString(36).substring(2, 9); }
  function scoreKey(o, c) { return o + ":" + c; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function escHtml(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  var $ = function (sel) { return document.querySelector(sel); };

  /* ── Fresh objects ──────────────────────────────────────── */
  function freshDecision() {
    return {
      id: uid(),
      title: "",
      options: [],
      criteria: [],
      scores: {},
      createdAt: Date.now()
    };
  }

  function freshStore() {
    var d = freshDecision();
    return { activeId: d.id, decisions: [d] };
  }

  /* ── State ──────────────────────────────────────────────── */
  var store = freshStore();
  var showMath = false;

  function getActive() {
    var d = store.decisions.find(function (x) { return x.id === store.activeId; });
    if (!d && store.decisions.length) { d = store.decisions[0]; store.activeId = d.id; }
    if (!d) { d = freshDecision(); store.decisions.push(d); store.activeId = d.id; }
    return d;
  }

  /* ── Persistence ────────────────────────────────────────── */
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (_) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);

      /* Migrate old single-decision format */
      if (parsed && (parsed.options || parsed.criteria) && !parsed.decisions) {
        var d = freshDecision();
        d.title = parsed.title || "";
        d.options = parsed.options || [];
        d.criteria = parsed.criteria || [];
        d.scores = parsed.scores || {};
        store = { activeId: d.id, decisions: [d] };
        save();
        return;
      }

      if (parsed && parsed.decisions) {
        store = parsed;
        /* Ensure at least one decision exists */
        if (!store.decisions.length) {
          var nd = freshDecision();
          store.decisions.push(nd);
          store.activeId = nd.id;
        }
      }
    } catch (_) {
      store = freshStore();
    }
    showMath = localStorage.getItem(MATH_KEY) === "true";
  }

  /* ══════════════════════════════════════════════════════════
     Theme
     ══════════════════════════════════════════════════════════ */
  function getInitialTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  }

  /* ══════════════════════════════════════════════════════════
     Sidebar
     ══════════════════════════════════════════════════════════ */
  function isMobile() {
    return window.innerWidth <= 768;
  }

  function updateToggleTooltip() {
    var btn = $(".menu-toggle");
    if (!btn) return;
    var collapsed = $("#sidebar").classList.contains("collapsed");
    btn.setAttribute("title", collapsed ? "Expand menu" : "Collapse menu");
    btn.setAttribute("aria-label", collapsed ? "Expand menu" : "Collapse menu");
  }

  function openSidebar() {
    if (isMobile()) {
      document.body.classList.add("sidebar-open");
      $("#sidebar").classList.add("open");
      $("#sidebar-overlay").classList.add("open");
    } else {
      $("#sidebar").classList.remove("collapsed");
      localStorage.setItem(SIDEBAR_KEY, "false");
      updateToggleTooltip();
    }
  }

  function closeSidebar() {
    if (isMobile()) {
      document.body.classList.remove("sidebar-open");
      $("#sidebar").classList.remove("open");
      $("#sidebar-overlay").classList.remove("open");
    } else {
      $("#sidebar").classList.add("collapsed");
      localStorage.setItem(SIDEBAR_KEY, "true");
      updateToggleTooltip();
    }
  }

  function toggleSidebar() {
    if (isMobile()) {
      if ($("#sidebar").classList.contains("open")) closeSidebar();
      else openSidebar();
    } else {
      if ($("#sidebar").classList.contains("collapsed")) openSidebar();
      else closeSidebar();
    }
  }

  /* ══════════════════════════════════════════════════════════
     Instructions Modal
     ══════════════════════════════════════════════════════════ */
  function openInstructions() { $("#instructions-overlay").classList.add("open"); }
  function closeInstructions() { $("#instructions-overlay").classList.remove("open"); }

  /* ══════════════════════════════════════════════════════════
     Rendering
     ══════════════════════════════════════════════════════════ */
  function render() {
    renderSidebar();
    var d = getActive();
    renderTitle(d);
    renderOptions(d);
    renderCriteria(d);
    renderGrid(d);
    renderResults(d);
  }

  function renderSidebar() {
    var ul = $("#sidebar-list");
    if (!ul) return;
    ul.innerHTML = store.decisions.map(function (d) {
      var active = d.id === store.activeId ? " active" : "";
      var title = (d.title || "").trim() || "Untitled";
      return '<li class="sidebar-item' + active + '" data-decision-id="' + d.id + '">' +
        '<span class="sidebar-item-title">' + escHtml(title) + '</span>' +
        '<button class="sidebar-item-delete" data-action="delete-decision" title="Delete" aria-label="Delete">&times;</button>' +
        '</li>';
    }).join("");
  }

  function renderTitle(d) {
    var el = $("#decision-title");
    if (el && el !== document.activeElement) el.value = d.title;
  }

  function renderOptions(d) {
    var ul = $("#options-list");
    if (!ul) return;
    ul.innerHTML = d.options.map(function (opt) {
      return '<li class="item-row" data-id="' + opt.id + '">' +
        '<input type="text" value="' + escHtml(opt.name) + '"' +
        ' placeholder="Option name" aria-label="Option name" data-field="option-name">' +
        '<button class="btn-remove" data-action="remove-option" title="Remove" aria-label="Remove">&times;</button>' +
        '</li>';
    }).join("");
  }

  function renderCriteria(d) {
    var ul = $("#criteria-list");
    if (!ul) return;
    ul.innerHTML = d.criteria.map(function (c) {
      return '<li class="item-row" data-id="' + c.id + '">' +
        '<input type="text" value="' + escHtml(c.name) + '"' +
        ' placeholder="Criterion name" aria-label="Criterion name" data-field="criterion-name">' +
        '<span class="weight-control">' +
          '<input type="range" min="1" max="5" value="' + c.weight + '"' +
          ' data-field="criterion-weight" aria-label="Weight for ' + escHtml(c.name) + '">' +
          '<span class="weight-badge">' + c.weight + '</span>' +
        '</span>' +
        '<button class="btn-remove" data-action="remove-criterion" title="Remove" aria-label="Remove">&times;</button>' +
        '</li>';
    }).join("");
  }

  function renderGrid(d) {
    var wrap = $("#grid-container");
    if (!wrap) return;

    if (!d.options.length || !d.criteria.length) {
      wrap.innerHTML = '<div class="empty-state">Add at least one option and one criterion to start scoring.</div>';
      return;
    }

    var h = '<div class="grid-wrapper"><table class="scoring-grid"><thead><tr><th>Option</th>';
    d.criteria.forEach(function (c) {
      h += '<th>' + escHtml(c.name) + '<span class="weight-label">weight ' + c.weight + '</span></th>';
    });
    h += '</tr></thead><tbody>';

    d.options.forEach(function (opt) {
      h += '<tr><td>' + escHtml(opt.name) + '</td>';
      d.criteria.forEach(function (c) {
        var key = scoreKey(opt.id, c.id);
        var val = d.scores[key];
        val = val != null ? val : "";
        h += '<td><input type="number" class="score-input" min="1" max="10"' +
          ' value="' + val + '" placeholder=" "' +
          ' data-option="' + opt.id + '" data-criterion="' + c.id + '"' +
          ' aria-label="Score for ' + escHtml(opt.name) + ' on ' + escHtml(c.name) + '"></td>';
      });
      h += '</tr>';
    });

    h += '</tbody></table></div>';
    wrap.innerHTML = h;
  }

  function renderResults(d) {
    var wrap = $("#results-container");
    if (!wrap) return;

    var cb = $("#show-math");
    if (cb) cb.checked = showMath;
    wrap.className = showMath ? "results-show-math" : "";

    if (!d.options.length || !d.criteria.length) { wrap.innerHTML = ""; return; }

    var maxPossible = d.criteria.reduce(function (s, c) { return s + 10 * c.weight; }, 0);
    if (maxPossible === 0) { wrap.innerHTML = ""; return; }

    var scored = d.options.map(function (opt) {
      var rawTotal = 0;
      var parts = [];
      d.criteria.forEach(function (c) {
        var key = scoreKey(opt.id, c.id);
        var v = d.scores[key];
        if (v != null && v !== "") {
          var contrib = v * c.weight;
          rawTotal += contrib;
          parts.push(escHtml(c.name) + ": " + v + " x " + c.weight + " = " + contrib);
        }
      });
      return {
        name: opt.name,
        rawTotal: rawTotal,
        pct: (rawTotal / maxPossible) * 100,
        breakdown: parts.join("&ensp;&middot;&ensp;")
      };
    });

    scored.sort(function (a, b) { return b.pct - a.pct; });

    var html = '<ul class="results-list">';
    scored.forEach(function (item, i) {
      var isFirst = i === 0;
      html += '<li class="result-item">' +
        '<div class="result-header"><span>' +
          '<span class="result-rank' + (isFirst ? " gold" : "") + '">#' + (i + 1) + '</span>' +
          '<span class="result-name">' + escHtml(item.name) + '</span>' +
        '</span>' +
        '<span class="result-score">' + item.pct.toFixed(1) + '%</span></div>' +
        '<div class="result-bar-track"><div class="result-bar-fill" style="width:' + item.pct.toFixed(2) + '%"></div></div>' +
        '<div class="result-breakdown">' + item.rawTotal + ' / ' + maxPossible +
          (item.breakdown ? "&ensp;&middot;&ensp;" + item.breakdown : "") + '</div></li>';
    });
    html += '</ul>';
    wrap.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════
     Actions
     ══════════════════════════════════════════════════════════ */
  function addOption() {
    var d = getActive();
    d.options.push({ id: uid(), name: "Option " + (d.options.length + 1) });
    save(); render();
    var items = $("#options-list").querySelectorAll('.item-row input[type="text"]');
    if (items.length) items[items.length - 1].focus();
  }

  function removeOption(id) {
    var d = getActive();
    d.options = d.options.filter(function (o) { return o.id !== id; });
    Object.keys(d.scores).forEach(function (k) { if (k.startsWith(id + ":")) delete d.scores[k]; });
    save(); render();
  }

  function addCriterion() {
    var d = getActive();
    d.criteria.push({ id: uid(), name: "Criterion " + (d.criteria.length + 1), weight: 3 });
    save(); render();
    var items = $("#criteria-list").querySelectorAll('.item-row input[type="text"]');
    if (items.length) items[items.length - 1].focus();
  }

  function removeCriterion(id) {
    var d = getActive();
    d.criteria = d.criteria.filter(function (c) { return c.id !== id; });
    Object.keys(d.scores).forEach(function (k) { if (k.endsWith(":" + id)) delete d.scores[k]; });
    save(); render();
  }

  function createNewDecision() {
    var d = freshDecision();
    store.decisions.unshift(d);
    store.activeId = d.id;
    save(); render();
    if (isMobile()) closeSidebar();
  }

  function switchDecision(id) {
    if (store.activeId === id) { if (isMobile()) closeSidebar(); return; }
    store.activeId = id;
    save(); render();
    if (isMobile()) closeSidebar();
  }

  function deleteDecision(id) {
    if (store.decisions.length === 1) {
      showConfirm("This is your only decision. Deleting it will create a fresh one.", function () {
        store.decisions = [];
        var d = freshDecision();
        store.decisions.push(d);
        store.activeId = d.id;
        save(); render();
      });
      return;
    }

    showConfirm("Delete this decision? This cannot be undone.", function () {
      store.decisions = store.decisions.filter(function (x) { return x.id !== id; });
      if (store.activeId === id) {
        store.activeId = store.decisions[0].id;
      }
      save(); render();
    });
  }

  function exportDecision() {
    var d = getActive();
    /* Export single decision (without store wrapper, for portability) */
    var exportData = {
      title: d.title,
      options: d.options,
      criteria: d.criteria,
      scores: d.scores
    };
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var slug = (d.title || "decision").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    a.download = slug + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importDecision(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== "object") throw new Error("Invalid format");
        var d = freshDecision();
        d.title = parsed.title || "";
        d.options = parsed.options || [];
        d.criteria = parsed.criteria || [];
        d.scores = parsed.scores || {};
        store.decisions.unshift(d);
        store.activeId = d.id;
        save(); render();
      } catch (err) {
        alert("Could not import that file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  /* ── Confirm Dialog ─────────────────────────────────────── */
  function showConfirm(message, onConfirm) {
    var overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML =
      '<div class="confirm-box"><p>' + escHtml(message) + '</p>' +
      '<div class="btn-row">' +
        '<button class="btn btn-danger-outline" data-confirm="yes">Yes, delete</button>' +
        '<button class="btn btn-outline" data-confirm="no">Cancel</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-confirm]");
      if (!btn) return;
      document.body.removeChild(overlay);
      if (btn.dataset.confirm === "yes") onConfirm();
    });
  }

  /* ══════════════════════════════════════════════════════════
     Events
     ══════════════════════════════════════════════════════════ */
  function initEvents() {

    /* Decision title */
    document.addEventListener("input", function (e) {
      if (e.target.id === "decision-title") {
        getActive().title = e.target.value;
        save();
        renderSidebar();
      }
    });

    /* Option names */
    document.addEventListener("input", function (e) {
      if (e.target.dataset.field === "option-name") {
        var id = e.target.closest("[data-id]").dataset.id;
        var d = getActive();
        var opt = d.options.find(function (o) { return o.id === id; });
        if (opt) { opt.name = e.target.value; save(); renderGrid(d); renderResults(d); }
      }
    });

    /* Criterion names */
    document.addEventListener("input", function (e) {
      if (e.target.dataset.field === "criterion-name") {
        var id = e.target.closest("[data-id]").dataset.id;
        var d = getActive();
        var c = d.criteria.find(function (cr) { return cr.id === id; });
        if (c) { c.name = e.target.value; save(); renderGrid(d); renderResults(d); }
      }
    });

    /* Criterion weights */
    document.addEventListener("input", function (e) {
      if (e.target.dataset.field === "criterion-weight") {
        var id = e.target.closest("[data-id]").dataset.id;
        var d = getActive();
        var c = d.criteria.find(function (cr) { return cr.id === id; });
        if (c) {
          c.weight = parseInt(e.target.value, 10);
          var badge = e.target.closest(".weight-control").querySelector(".weight-badge");
          if (badge) badge.textContent = c.weight;
          save(); renderGrid(d); renderResults(d);
        }
      }
    });

    /* Score inputs */
    document.addEventListener("input", function (e) {
      if (e.target.classList.contains("score-input")) {
        var d = getActive();
        var oid = e.target.dataset.option;
        var cid = e.target.dataset.criterion;
        var val = e.target.value.trim();
        if (val === "") { delete d.scores[scoreKey(oid, cid)]; }
        else { d.scores[scoreKey(oid, cid)] = clamp(parseInt(val, 10) || 0, 1, 10); }
        save(); renderResults(d);
      }
    });

    /* Score clamp on blur */
    document.addEventListener("change", function (e) {
      if (e.target.classList.contains("score-input")) {
        var d = getActive();
        var oid = e.target.dataset.option;
        var cid = e.target.dataset.criterion;
        var val = e.target.value.trim();
        if (val !== "") {
          val = clamp(parseInt(val, 10) || 1, 1, 10);
          e.target.value = val;
          d.scores[scoreKey(oid, cid)] = val;
          save(); renderResults(d);
        }
      }
    });

    /* Math toggle */
    document.addEventListener("change", function (e) {
      if (e.target.id === "show-math") {
        showMath = e.target.checked;
        localStorage.setItem(MATH_KEY, showMath ? "true" : "false");
        renderResults(getActive());
      }
    });

    /* Click delegation */
    document.addEventListener("click", function (e) {
      /* Sidebar item click (not the delete button) */
      var sidebarItem = e.target.closest(".sidebar-item");
      if (sidebarItem && !e.target.closest("[data-action='delete-decision']")) {
        switchDecision(sidebarItem.dataset.decisionId);
        return;
      }

      var target = e.target.closest("[data-action]");
      if (!target) return;

      switch (target.dataset.action) {
        case "add-option":         addOption(); break;
        case "add-criterion":      addCriterion(); break;
        case "remove-option":      removeOption(target.closest("[data-id]").dataset.id); break;
        case "remove-criterion":   removeCriterion(target.closest("[data-id]").dataset.id); break;
        case "new-decision":       createNewDecision(); break;
        case "delete-decision":
          var item = target.closest("[data-decision-id]");
          if (item) deleteDecision(item.dataset.decisionId);
          break;
        case "export":             exportDecision(); break;
        case "import":             $("#import-input").click(); break;
        case "toggle-theme":       toggleTheme(); break;
        case "toggle-sidebar":     toggleSidebar(); break;
        case "show-instructions":  openInstructions(); break;
        case "close-instructions": closeInstructions(); break;
      }
    });

    /* Instructions: close on overlay click */
    var instrOverlay = $("#instructions-overlay");
    if (instrOverlay) {
      instrOverlay.addEventListener("click", function (e) {
        if (e.target === instrOverlay) closeInstructions();
      });
    }

    /* Instructions: close on Escape */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeInstructions();
      }
    });

    /* Brand title click toggle (for touch/mobile) */
    var brandContainer = $("#brand-container");
    if (brandContainer) {
      brandContainer.addEventListener("click", function (e) {
        brandContainer.classList.toggle("active");
      });
      document.addEventListener("click", function (e) {
        if (!brandContainer.contains(e.target)) {
          brandContainer.classList.remove("active");
        }
      });
    }

    /* Sidebar overlay click */
    var sOverlay = $("#sidebar-overlay");
    if (sOverlay) {
      sOverlay.addEventListener("click", closeSidebar);
    }

    /* File import */
    var inp = $("#import-input");
    if (inp) {
      inp.addEventListener("change", function (e) {
        if (e.target.files.length) { importDecision(e.target.files[0]); e.target.value = ""; }
      });
    }
  }

  /* ══════════════════════════════════════════════════════════
     Boot
     ══════════════════════════════════════════════════════════ */
  function init() {
    applyTheme(getInitialTheme());
    load();
    if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) === "true") {
      $("#sidebar").classList.add("collapsed");
    }
    updateToggleTooltip();
    render();
    initEvents();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
