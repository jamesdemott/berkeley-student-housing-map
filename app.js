(function () {
  "use strict";

  var CONFIG = window.MAP_CONFIG;
  var STATUSES = [
    { key: "proposed", label: "Proposed" },
    { key: "approved", label: "Approved" },
    { key: "construction", label: "Under construction" },
    { key: "opened", label: "Opened" }
  ];
  var STATUS_LABEL = {};
  STATUSES.forEach(function (s) { STATUS_LABEL[s.key] = s.label; });
  var OWNER_LABEL = { university: "University", private: "Private" };

  var state = { owner: "all", statuses: new Set(STATUSES.map(function (s) { return s.key; })), query: "", selected: null };
  var projects = [];
  var markers = {};

  var params = new URLSearchParams(location.search);
  if (params.get("embed") === "1") document.body.classList.add("embed");

  var map = L.map("map", { zoomControl: false, scrollWheelZoom: true }).setView(CONFIG.center, CONFIG.zoom);
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer(CONFIG.tiles, { attribution: CONFIG.tileAttribution, maxZoom: 19, subdomains: "abcd" }).addTo(map);

  var el = {
    list: document.getElementById("list"),
    summary: document.getElementById("summary"),
    statusFilter: document.getElementById("status-filter"),
    ownerFilter: document.getElementById("owner-filter"),
    search: document.getElementById("search"),
    updated: document.getElementById("updated"),
    feedback: document.getElementById("feedback")
  };
  el.feedback.href = CONFIG.feedbackUrl;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) { return n.toLocaleString("en-US"); }

  // Size of a project in one comparable phrase: beds if known, otherwise units.
  function sizeText(p) {
    var parts = [];
    if (p.beds) parts.push(num(p.beds) + " beds");
    if (p.units) parts.push(num(p.units) + " units");
    if (p.stories) parts.push(p.stories + " stories");
    return parts.join(" · ");
  }

  function markerSize(p) {
    var n = p.beds || (p.units ? p.units * 2.5 : 0);
    return n >= 1000 ? 26 : n >= 400 ? 21 : 16;
  }

  function icon(p) {
    var s = markerSize(p);
    return L.divIcon({
      className: "",
      html: '<span class="pin ' + p.owner + " st-" + p.status + '" style="width:' + s + "px;height:" + s + 'px"></span>',
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
      popupAnchor: [0, -s / 2]
    });
  }

  function popupHtml(p) {
    var rows = [];
    if (p.opens) rows.push(["Timing", p.opens]);
    if (p.audience) rows.push(["For", p.audience]);
    if (p.team) rows.push(["Team", p.team]);
    var html =
      '<div class="pop">' +
      '<div class="tags"><span class="tag st-' + p.status + '">' + STATUS_LABEL[p.status] + "</span>" +
      '<span class="tag plain">' + OWNER_LABEL[p.owner] + "</span></div>" +
      "<h2>" + esc(p.name) + "</h2>" +
      '<p class="addr">' + esc(p.address) + "</p>" +
      (sizeText(p) ? '<p class="size">' + sizeText(p) + "</p>" : "") +
      (rows.length
        ? "<dl>" + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl>"
        : "") +
      (p.notes ? '<p class="notes">' + esc(p.notes) + "</p>" : "") +
      (p.sources && p.sources.length
        ? '<p class="sources">Sources: ' +
          p.sources.map(function (s) {
            return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a>";
          }).join(", ") + "</p>"
        : "") +
      "</div>";
    return html;
  }

  function matches(p) {
    if (state.owner !== "all" && p.owner !== state.owner) return false;
    if (!state.statuses.has(p.status)) return false;
    if (state.query) {
      var hay = (p.name + " " + p.address + " " + (p.team || "")).toLowerCase();
      if (hay.indexOf(state.query) === -1) return false;
    }
    return true;
  }

  function render() {
    var visible = projects.filter(matches);

    projects.forEach(function (p) {
      var m = markers[p.id];
      if (matches(p)) { if (!map.hasLayer(m)) m.addTo(map); }
      else if (map.hasLayer(m)) map.removeLayer(m);
    });

    var beds = visible.reduce(function (t, p) { return t + (p.beds || 0); }, 0);
    var unitsOnly = visible.reduce(function (t, p) { return t + (!p.beds && p.units ? p.units : 0); }, 0);
    el.summary.textContent = visible.length
      ? visible.length + (visible.length === 1 ? " project" : " projects") +
        (beds ? " · " + num(beds) + " beds" : "") +
        (unitsOnly ? (beds ? " + " : " · ") + num(unitsOnly) + " units" : "")
      : "No projects match these filters.";

    el.list.innerHTML = visible.map(function (p) {
      return (
        '<li><button class="card' + (state.selected === p.id ? " selected" : "") + '" data-id="' + p.id + '">' +
        '<span class="pin ' + p.owner + " st-" + p.status + '"></span>' +
        '<span class="card-body"><span class="card-name">' + esc(p.name) + "</span>" +
        '<span class="card-meta">' + STATUS_LABEL[p.status] + " · " + OWNER_LABEL[p.owner] + "</span>" +
        (sizeText(p) ? '<span class="card-size">' + sizeText(p) + "</span>" : "") +
        "</span></button></li>"
      );
    }).join("");

    // Status chips carry counts for the current owner + search filters.
    var counts = {};
    projects.forEach(function (p) {
      var saved = state.statuses; state.statuses = new Set([p.status]);
      if (matches(p)) counts[p.status] = (counts[p.status] || 0) + 1;
      state.statuses = saved;
    });
    el.statusFilter.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", state.statuses.has(b.dataset.status));
      b.querySelector(".count").textContent = counts[b.dataset.status] || 0;
    });
  }

  function select(id, opts) {
    var p = projects.find(function (x) { return x.id === id; });
    if (!p) return;
    state.selected = id;
    if (!matches(p)) {
      // Deep link to a filtered-out project: reset filters rather than show nothing.
      state.owner = "all"; state.query = ""; el.search.value = "";
      state.statuses = new Set(STATUSES.map(function (s) { return s.key; }));
      el.ownerFilter.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.owner === "all");
      });
    }
    render();
    var m = markers[id];
    if (!opts || opts.fly !== false) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    m.openPopup();
    history.replaceState(null, "", "#" + id);
    var card = el.list.querySelector('[data-id="' + id + '"]');
    if (card && opts && opts.scroll) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.getElementById("map").scrollIntoView({ behavior: "smooth" });
    }
  }

  // --- wiring ---
  el.statusFilter.innerHTML = STATUSES.map(function (s) {
    return '<button class="chip" data-status="' + s.key + '" aria-pressed="true">' +
      '<span class="dot st-' + s.key + '"></span>' + s.label + ' <span class="count"></span></button>';
  }).join("");

  el.statusFilter.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var k = b.dataset.status;
    if (state.statuses.has(k)) state.statuses.delete(k); else state.statuses.add(k);
    render();
  });
  el.ownerFilter.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.owner = b.dataset.owner;
    el.ownerFilter.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    render();
  });
  el.search.addEventListener("input", function () { state.query = el.search.value.trim().toLowerCase(); render(); });
  el.list.addEventListener("click", function (e) {
    var b = e.target.closest(".card"); if (b) select(b.dataset.id);
  });
  map.on("popupclose", function () {
    state.selected = null;
    history.replaceState(null, "", location.pathname + location.search);
    el.list.querySelectorAll(".card.selected").forEach(function (c) { c.classList.remove("selected"); });
  });

  fetch("data/projects.json")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      // Largest first in the list; draw small markers on top so they stay clickable.
      projects = data.projects.slice().sort(function (a, b) {
        return (b.beds || (b.units || 0) * 2.5) - (a.beds || (a.units || 0) * 2.5);
      });
      projects.forEach(function (p, i) {
        var m = L.marker([p.lat, p.lng], { icon: icon(p), title: p.name, zIndexOffset: i * 10 });
        m.bindPopup(popupHtml(p), { maxWidth: 300, autoPanPadding: [24, 24] });
        m.on("click", function () { select(p.id, { fly: false, scroll: true }); });
        markers[p.id] = m;
      });
      if (data.last_updated) {
        var d = new Date(data.last_updated + "T12:00:00");
        el.updated.textContent = "Updated " + d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ".";
      }
      render();
      if (location.hash.length > 1) select(decodeURIComponent(location.hash.slice(1)), { scroll: true });
    })
    .catch(function () {
      el.summary.textContent = "Couldn't load project data. If you opened this file directly, serve the folder instead (see README).";
    });
})();
