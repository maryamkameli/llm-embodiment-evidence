(function () {
  "use strict";

  var data = window.EVIDENCE;
  var CITE_KEY = "evidence-citations-v1";

  var GROUPS = {
    direct: "Direct comparison",
    mechanism: "Mechanism study",
    robot: "Robot strand",
    candidate: "To screen"
  };
  var STATUS = {
    read: "Read",
    screen: "To screen",
    verify: "Verify",
    summary: "Summary only"
  };

  var SETS = {
    studies: {
      title: "Primary studies",
      noun: "studies",
      records: data.studies,
      groupKey: "group",
      groupLabel: "All groups",
      groupName: function (r) { return GROUPS[r.group] || r.group; },
      columns: [
        { key: "id", label: "#", sort: "id" },
        { key: "paper", label: "Study", sort: "title" },
        { key: "year", label: "Year", sort: "year" },
        { key: "venue", label: "Venue", sort: "venue" },
        { key: "group", label: "Group", sort: "group" },
        { key: "contrast", label: "Contrast" },
        { key: "alsoChanged", label: "Also changed" },
        { key: "sample", label: "N, design" },
        { key: "llm", label: "LLM" },
        { key: "cited", label: "Cited by", sort: "cited" }
      ]
    },
    motivation: {
      title: "Motivation and future self",
      noun: "records",
      records: data.motivation,
      groupKey: "theme",
      groupLabel: "All themes",
      groupName: function (r) { return r.theme; },
      columns: [
        { key: "id", label: "#", sort: "id" },
        { key: "paper", label: "Paper", sort: "title" },
        { key: "year", label: "Year", sort: "year" },
        { key: "venue", label: "Publication", sort: "venue" },
        { key: "theme", label: "Theme", sort: "theme" },
        { key: "finding", label: "Finding" },
        { key: "implication", label: "For the app" },
        { key: "cited", label: "Cited by", sort: "cited" }
      ]
    }
  };

  var state = {
    set: "studies",
    q: "",
    yearMin: null,
    yearMax: null,
    group: "",
    status: "",
    sortKey: "year",
    sortDir: -1,
    expandAll: false,
    open: {}
  };

  var citations = loadCitations();

  var el = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function loadCitations() {
    try {
      var raw = window.localStorage.getItem(CITE_KEY);
      return raw ? JSON.parse(raw) : { at: null, counts: {} };
    } catch (e) {
      return { at: null, counts: {} };
    }
  }

  function saveCitations() {
    try { window.localStorage.setItem(CITE_KEY, JSON.stringify(citations)); } catch (e) { /* storage unavailable */ }
  }

  function formatDate(iso) {
    var months = ["January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"];
    var p = iso.split("-");
    return Number(p[2]) + " " + months[Number(p[1]) - 1] + " " + p[0];
  }

  function current() { return SETS[state.set]; }

  function years(records) {
    var ys = records.map(function (r) { return r.year; }).filter(function (y) { return typeof y === "number"; });
    return { min: Math.min.apply(null, ys), max: Math.max.apply(null, ys) };
  }

  // ---------- stats ----------
  function renderStats() {
    var s = data.studies;
    var count = function (fn) { return s.filter(fn).length; };
    var tiles = [
      [s.length, "Primary-study records"],
      [count(function (r) { return r.group === "direct"; }), "Direct LLM comparisons"],
      [count(function (r) { return r.voiceMatched; }), "Voice held constant"],
      [count(function (r) { return r.status === "screen"; }), "Still to screen"],
      [data.motivation.length, "Motivation records"]
    ];
    el("stats").innerHTML = tiles.map(function (t) {
      return '<div class="stat"><div class="stat-value">' + t[0] + '</div><div class="stat-label">' + esc(t[1]) + "</div></div>";
    }).join("");
  }

  // ---------- filters ----------
  function setupFilters() {
    var set = current();
    var groups = [];
    set.records.forEach(function (r) {
      var g = r[set.groupKey];
      if (groups.indexOf(g) === -1) groups.push(g);
    });
    el("group").innerHTML = '<option value="">' + set.groupLabel + "</option>" + groups.map(function (g) {
      var label = set === SETS.studies ? GROUPS[g] : g;
      return '<option value="' + esc(g) + '">' + esc(label) + "</option>";
    }).join("");
    el("group").value = state.group;

    var statuses = [];
    set.records.forEach(function (r) { if (statuses.indexOf(r.status) === -1) statuses.push(r.status); });
    el("status").innerHTML = '<option value="">Any reading status</option>' + statuses.map(function (st) {
      return '<option value="' + esc(st) + '">' + esc(STATUS[st] || st) + "</option>";
    }).join("");
    el("status").value = state.status;

    var y = years(set.records);
    [el("year-min"), el("year-max")].forEach(function (input) {
      input.min = y.min; input.max = y.max; input.step = 1;
    });
    if (state.yearMin === null) state.yearMin = y.min;
    if (state.yearMax === null) state.yearMax = y.max;
    el("year-min").value = state.yearMin;
    el("year-max").value = state.yearMax;
    updateRangeLabel();
  }

  function updateRangeLabel() {
    var y = years(current().records);
    var lo = state.yearMin, hi = state.yearMax;
    var full = lo <= y.min && hi >= y.max;
    el("year-label").textContent = full ? "All years" : (lo === hi ? String(lo) : lo + "–" + hi);
    var span = y.max - y.min || 1;
    var fill = el("range-fill");
    fill.style.left = ((lo - y.min) / span * 100) + "%";
    fill.style.width = ((hi - lo) / span * 100) + "%";
  }

  function visibleRecords() {
    var set = current();
    var y = years(set.records);
    var full = state.yearMin <= y.min && state.yearMax >= y.max;
    var q = state.q.trim().toLowerCase();

    var rows = set.records.filter(function (r) {
      if (state.group && r[set.groupKey] !== state.group) return false;
      if (state.status && r.status !== state.status) return false;
      if (!full) {
        if (typeof r.year !== "number") return false;
        if (r.year < state.yearMin || r.year > state.yearMax) return false;
      }
      if (q) {
        var hay = [r.title, r.authors, r.venue, r.finding, r.contrast, r.alsoChanged, r.llm, r.theme, r.implication]
          .join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var key = state.sortKey, dir = state.sortDir;
    rows.sort(function (a, b) {
      var va, vb;
      if (key === "cited") {
        va = citeCount(a); vb = citeCount(b);
        va = va == null ? -1 : va; vb = vb == null ? -1 : vb;
      } else if (key === "group") {
        va = set.groupName(a); vb = set.groupName(b);
      } else {
        va = a[key]; vb = b[key];
      }
      if (va == null || va === "") return 1;
      if (vb == null || vb === "") return -1;
      if (typeof va === "string") return va.localeCompare(vb) * dir;
      if (va === vb) return a.id - b.id;
      return (va - vb) * dir;
    });
    return rows;
  }

  // ---------- table ----------
  function renderHead() {
    var cols = current().columns;
    el("thead").innerHTML = "<tr>" + cols.map(function (c) {
      if (!c.sort) return "<th>" + esc(c.label) + "</th>";
      var active = state.sortKey === c.sort;
      var aria = active ? (state.sortDir === 1 ? "ascending" : "descending") : "none";
      var arrow = active ? '<span class="arrow">' + (state.sortDir === 1 ? "↑" : "↓") + "</span>" : "";
      return '<th aria-sort="' + aria + '"><button data-sort="' + c.sort + '">' + esc(c.label) + arrow + "</button></th>";
    }).join("") + "</tr>";
  }

  function citeCount(r) {
    if (!r.doi) return null;
    var c = citations.counts[r.doi.toLowerCase()];
    return typeof c === "number" ? c : null;
  }

  function paperCell(r) {
    var badges = [];
    if (r.venueType === "preprint") badges.push("Preprint");
    if (r.venueType === "conference") badges.push("Proceedings");
    var authors = r.authors ? '<div class="paper-authors">' + esc(r.authors) + "</div>" : "";
    var isOpen = state.expandAll || state.open[state.set + r.id];
    return '<a class="paper-title" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + "</a>" +
      authors +
      (badges.length ? '<div class="badges">' + badges.map(function (b) { return '<span class="badge">' + b + "</span>"; }).join("") + "</div>" : "") +
      '<button class="detail-toggle" data-toggle="' + r.id + '" aria-expanded="' + (isOpen ? "true" : "false") + '">' +
      (isOpen ? "Hide details" : "Details") + "</button>";
  }

  function cell(c, r) {
    switch (c.key) {
      case "id": return '<td class="num">' + r.id + "</td>";
      case "paper": return "<td>" + paperCell(r) + "</td>";
      case "year": return '<td class="year">' + (r.year || "—") + "</td>";
      case "venue": return '<td class="cell-text">' + esc(r.venue) + "</td>";
      case "group": {
        var tag = '<span class="tag ' + esc(r.group) + '">' + esc(GROUPS[r.group]) + "</span>";
        if (r.voiceMatched) tag += ' <span class="tag matched" title="Adds a body or face with the voice held constant">Voice held</span>';
        var status = STATUS[r.status] === GROUPS[r.group] ? "" : '<span class="status ' + esc(r.status) + '">' + esc(STATUS[r.status]) + "</span>";
        return "<td>" + tag + status + "</td>";
      }
      case "theme":
        return '<td><span class="tag theme">' + esc(r.theme) + '</span><span class="status ' + esc(r.status) + '">' +
          esc(STATUS[r.status]) + "</span></td>";
      case "cited": {
        var n = citeCount(r);
        if (!r.doi) return '<td class="cited cell-muted">—<small>no DOI</small></td>';
        return '<td class="cited">' + (n == null ? '<span class="cell-muted">—</span>' : n) +
          '<small><a href="https://doi.org/' + esc(r.doi) + '" target="_blank" rel="noopener">DOI</a></small></td>';
      }
      default: {
        var v = r[c.key];
        return '<td class="cell-text' + (v ? "" : " cell-muted") + '">' + (v ? esc(v) : "—") + "</td>";
      }
    }
  }

  function detailRow(r, span) {
    var left = "<h4>Finding</h4><p>" + esc(r.finding) + "</p>";
    if (r.implication) left += "<h4>For the app</h4><p>" + esc(r.implication) + "</p>";
    var right = "";
    if (r.authors) right += "<h4>Authors</h4><p>" + esc(r.authors) + "</p>";
    right += "<h4>Source</h4><p>" + esc(r.venue) + (r.year ? ", " + r.year : "") + "</p>";
    right += "<h4>Link</h4><p>" + (r.doi
      ? '<a href="https://doi.org/' + esc(r.doi) + '" target="_blank" rel="noopener">doi.org/' + esc(r.doi) + "</a>"
      : '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">Open the record</a>') + "</p>";
    return '<tr class="detail-row"><td></td><td colspan="' + (span - 1) + '"><div class="detail"><div>' + left + "</div><div>" + right + "</div></div></td></tr>";
  }

  function render() {
    var set = current();
    var rows = visibleRecords();
    var span = set.columns.length;
    el("db-title").textContent = set.title;
    renderHead();

    if (!rows.length) {
      el("tbody").innerHTML = '<tr><td colspan="' + span + '" class="empty">No records match these filters. Reset the filters to see all ' + set.noun + ".</td></tr>";
    } else {
      el("tbody").innerHTML = rows.map(function (r) {
        var main = '<tr class="main-row">' + set.columns.map(function (c) { return cell(c, r); }).join("") + "</tr>";
        var isOpen = state.expandAll || state.open[state.set + r.id];
        return main + (isOpen ? detailRow(r, span) : "");
      }).join("");
    }

    var total = set.records.length;
    var sortCol = set.columns.filter(function (c) { return c.sort === state.sortKey; })[0];
    el("count").textContent = rows.length + " of " + total + " " + set.noun +
      " · sorted by " + (sortCol ? sortCol.label.toLowerCase() : state.sortKey) + (state.sortDir === 1 ? " ascending" : " descending");

    el("expand-all").textContent = state.expandAll ? "Collapse all details" : "Expand all details";
    el("expand-all").setAttribute("aria-pressed", state.expandAll ? "true" : "false");
  }

  // ---------- citations ----------
  function updateCiteStatus() {
    el("cite-status").textContent = citations.at ? "OpenAlex, " + formatDate(citations.at) : "OpenAlex, on request";
  }

  function refreshCitations() {
    var button = el("refresh");
    var all = data.studies.concat(data.motivation).filter(function (r) { return r.doi; });
    var dois = [];
    all.forEach(function (r) {
      var d = r.doi.toLowerCase();
      if (dois.indexOf(d) === -1) dois.push(d);
    });

    button.disabled = true;
    var done = 0, failed = 0, i = 0;
    button.textContent = "Fetching 0 of " + dois.length + "…";

    function next() {
      if (i >= dois.length) return Promise.resolve();
      var doi = dois[i++];
      return fetch("https://api.openalex.org/works/https://doi.org/" + doi)
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (work) { citations.counts[doi] = work.cited_by_count; })
        .catch(function () { failed++; })
        .then(function () {
          done++;
          button.textContent = "Fetching " + done + " of " + dois.length + "…";
          return next();
        });
    }

    Promise.all([next(), next(), next()]).then(function () {
      citations.at = new Date().toISOString().slice(0, 10);
      saveCitations();
      updateCiteStatus();
      button.disabled = false;
      button.textContent = failed ? "↻ Refresh citations (" + failed + " not found)" : "↻ Refresh citations";
      render();
    });
  }

  // ---------- export ----------
  function exportCsv() {
    var set = current();
    var rows = visibleRecords();
    var fields = state.set === "studies"
      ? ["id", "title", "authors", "year", "venue", "group", "status", "contrast", "alsoChanged", "voiceMatched", "sample", "llm", "finding", "doi", "url"]
      : ["id", "title", "authors", "year", "venue", "theme", "status", "finding", "implication", "doi", "url"];
    var quote = function (v) {
      var s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var lines = [fields.concat(["cited_by"]).join(",")].concat(rows.map(function (r) {
      return fields.map(function (f) { return quote(r[f]); }).concat([quote(citeCount(r))]).join(",");
    }));
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (state.set === "studies" ? "primary-studies" : "motivation-records") + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // ---------- events ----------
  function resetFilters() {
    state.q = ""; state.group = ""; state.status = "";
    state.yearMin = null; state.yearMax = null;
    state.sortKey = "year"; state.sortDir = -1;
    state.expandAll = false; state.open = {};
    el("q").value = "";
    setupFilters();
    render();
  }

  function bind() {
    el("q").addEventListener("input", function (e) { state.q = e.target.value; render(); });
    el("group").addEventListener("change", function (e) { state.group = e.target.value; render(); });
    el("status").addEventListener("change", function (e) { state.status = e.target.value; render(); });

    el("year-min").addEventListener("input", function (e) {
      state.yearMin = Math.min(Number(e.target.value), state.yearMax);
      e.target.value = state.yearMin; updateRangeLabel(); render();
    });
    el("year-max").addEventListener("input", function (e) {
      state.yearMax = Math.max(Number(e.target.value), state.yearMin);
      e.target.value = state.yearMax; updateRangeLabel(); render();
    });

    el("thead").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-sort]");
      if (!b) return;
      var key = b.getAttribute("data-sort");
      if (state.sortKey === key) state.sortDir = -state.sortDir;
      else { state.sortKey = key; state.sortDir = (key === "year" || key === "cited") ? -1 : 1; }
      render();
    });

    el("tbody").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-toggle]");
      if (!b) return;
      var k = state.set + b.getAttribute("data-toggle");
      state.open[k] = !(state.expandAll || state.open[k]);
      if (state.expandAll && !state.open[k]) {
        state.expandAll = false;
        current().records.forEach(function (r) { state.open[state.set + r.id] = true; });
        state.open[k] = false;
      }
      render();
    });

    el("expand-all").addEventListener("click", function () {
      state.expandAll = !state.expandAll;
      if (!state.expandAll) state.open = {};
      render();
    });

    Array.prototype.forEach.call(document.querySelectorAll(".view-tab[data-set]"), function (tab) {
      tab.addEventListener("click", function () {
        var next = tab.getAttribute("data-set");
        if (next === state.set) return;
        state.set = next;
        Array.prototype.forEach.call(document.querySelectorAll(".view-tab[data-set]"), function (t) {
          var on = t === tab;
          t.classList.toggle("active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        resetFilters();
      });
    });

    el("refresh").addEventListener("click", refreshCitations);
    el("export").addEventListener("click", exportCsv);
    el("reset").addEventListener("click", function () { resetFilters(); });
  }

  // ---------- start ----------
  el("updated").textContent = formatDate(data.updated);
  el("footer-updated").textContent = formatDate(data.updated);
  updateCiteStatus();
  renderStats();
  setupFilters();
  bind();
  render();
})();
