(function () {
  "use strict";

  var CONFIG = window.MAP_CONFIG;
  var STATUSES = [
    { key: "proposed", label: "Proposed", color: "#8f6fd6" },
    { key: "approved", label: "Approved", color: "#2f7fd0" },
    { key: "construction", label: "Under construction", color: "#e07a10" },
    { key: "opened", label: "Opened", color: "#1f9a6c" }
  ];
  var STATUS_LABEL = {};
  STATUSES.forEach(function (s) { STATUS_LABEL[s.key] = s.label; });
  var OWNER_LABEL = { university: "University", private: "Private" };

  // Berkeley's street grid is turned about 7.6 degrees from true east-west.
  var GRID_ROTATION = 7.6;
  var BLANK_STYLE = {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": "#eef0ee" } }]
  };

  var state = {
    owner: "all",
    statuses: new Set(STATUSES.map(function (s) { return s.key; })),
    query: "",
    selected: null,
    is3d: true
  };
  var projects = [];
  var markers = {};
  var map = null;
  var popup = null;

  var params = new URLSearchParams(location.search);
  if (params.get("embed") === "1") document.body.classList.add("embed");

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

  function sizeText(p) {
    var parts = [];
    if (p.beds) parts.push(num(p.beds) + " beds");
    if (p.units) parts.push(num(p.units) + " units");
    if (p.stories) parts.push(p.stories + " stories");
    else if (p.height_ft) parts.push(p.height_ft + " ft");
    return parts.join(" · ");
  }

  function weight(p) { return p.beds || (p.units ? p.units * 2.5 : 0); }
  function markerSize(p) { var n = weight(p); return n >= 1000 ? 26 : n >= 400 ? 21 : 16; }

  // ---- 3D shapes ----

  function heightMetres(heightFt, stories) {
    if (heightFt) return heightFt * 0.3048;
    return (stories || CONFIG.defaultStories) * CONFIG.metresPerStorey;
  }

  // A square aligned to the street grid, used until a real footprint is traced.
  function placeholderRing(p) {
    var n = weight(p);
    var half = (n >= 1000 ? 46 : n >= 400 ? 34 : 24) / 2;
    var a = (GRID_ROTATION * Math.PI) / 180;
    var mLat = 111320, mLng = 111320 * Math.cos((p.lat * Math.PI) / 180);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(function (c) {
      var x = c[0] * half, y = c[1] * half;
      var rx = x * Math.cos(a) - y * Math.sin(a);
      var ry = x * Math.sin(a) + y * Math.cos(a);
      return [p.lng + rx / mLng, p.lat + ry / mLat];
    });
  }

  function closeRing(ring) {
    var a = ring[0], b = ring[ring.length - 1];
    return a[0] === b[0] && a[1] === b[1] ? ring : ring.concat([a]);
  }

  // One GeoJSON feature per block of each project (e.g. a podium and a tower).
  function shapeFeatures() {
    var features = [];
    projects.forEach(function (p) {
      var shapes = p.shapes && p.shapes.length
        ? p.shapes
        : [{ ring: placeholderRing(p) }];
      shapes.forEach(function (s) {
        // A block's own height wins; otherwise it takes the project's.
        var own = s.height_ft || s.stories;
        features.push({
          type: "Feature",
          properties: {
            id: p.id,
            status: p.status,
            height: own ? heightMetres(s.height_ft, s.stories) : heightMetres(p.height_ft, p.stories),
            base: s.base_ft ? s.base_ft * 0.3048 : 0
          },
          geometry: { type: "Polygon", coordinates: [closeRing(s.ring)] }
        });
      });
    });
    return { type: "FeatureCollection", features: features };
  }

  function addLayers() {
    // Existing buildings, from whichever vector source the basemap style uses.
    var style = map.getStyle();
    var vectorSource = Object.keys(style.sources).filter(function (k) {
      return style.sources[k].type === "vector";
    })[0];
    var firstLabel = style.layers.filter(function (l) { return l.type === "symbol"; })[0];
    var before = firstLabel ? firstLabel.id : undefined;

    if (vectorSource) {
      map.addLayer({
        id: "context-buildings",
        type: "fill-extrusion",
        source: vectorSource,
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": "#dcd9d2",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.85
        }
      }, before);
    }

    map.addSource("projects", { type: "geojson", data: shapeFeatures() });
    var colorExpr = ["match", ["get", "status"]];
    STATUSES.forEach(function (s) { colorExpr.push(s.key, s.color); });
    colorExpr.push("#888888");
    map.addLayer({
      id: "project-shapes",
      type: "fill-extrusion",
      source: "projects",
      paint: {
        "fill-extrusion-color": colorExpr,
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-opacity": 0.92
      }
    }, before);

    map.on("click", "project-shapes", function (e) {
      if (e.features.length) select(e.features[0].properties.id, { fly: false, scroll: true });
    });
    map.on("mouseenter", "project-shapes", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "project-shapes", function () { map.getCanvas().style.cursor = ""; });
  }

  function setMode(is3d, animate) {
    state.is3d = is3d;
    document.body.classList.toggle("mode-3d", is3d);
    var btn = document.getElementById("mode-toggle");
    if (btn) {
      btn.textContent = is3d ? "2D" : "3D";
      btn.setAttribute("aria-label", is3d ? "Switch to flat map" : "Switch to 3D map");
    }
    if (map.getLayer("context-buildings")) {
      map.setLayoutProperty("context-buildings", "visibility", is3d ? "visible" : "none");
    }
    if (map.getLayer("project-shapes")) {
      map.setPaintProperty("project-shapes", "fill-extrusion-height", is3d ? ["get", "height"] : 0);
      map.setPaintProperty("project-shapes", "fill-extrusion-base", is3d ? ["get", "base"] : 0);
    }
    var cam = { pitch: is3d ? CONFIG.pitch : 0, bearing: is3d ? CONFIG.bearing : 0 };
    if (animate) map.easeTo(Object.assign({ duration: 700 }, cam)); else map.jumpTo(cam);
  }

  function ModeControl() {}
  ModeControl.prototype.onAdd = function () {
    var wrap = document.createElement("div");
    wrap.className = "maplibregl-ctrl maplibregl-ctrl-group";
    var b = document.createElement("button");
    b.id = "mode-toggle";
    b.type = "button";
    b.addEventListener("click", function () { setMode(!state.is3d, true); });
    wrap.appendChild(b);
    this._el = wrap;
    return wrap;
  };
  ModeControl.prototype.onRemove = function () { this._el.remove(); };

  // ---- popup, list, filters ----

  function popupHtml(p) {
    var rows = [];
    if (p.opens) rows.push(["Timing", p.opens]);
    if (p.audience) rows.push(["For", p.audience]);
    if (p.team) rows.push(["Team", p.team]);
    var traced = p.shapes && p.shapes.length;
    return (
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
      (traced ? "" : '<p class="caveat">3D shape is a placeholder box' +
        (p.stories || p.height_ft ? "" : " at an assumed height") + ", not the building's footprint.</p>") +
      (p.sources && p.sources.length
        ? '<p class="sources">Sources: ' +
          p.sources.map(function (s) {
            return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a>";
          }).join(", ") + "</p>"
        : "") +
      "</div>"
    );
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
      markers[p.id].getElement().hidden = !matches(p);
    });
    if (map.getLayer("project-shapes")) {
      map.setFilter("project-shapes", ["in", ["get", "id"], ["literal", visible.map(function (p) { return p.id; })]]);
    }
    if (state.selected && popup && !visible.some(function (p) { return p.id === state.selected; })) popup.remove();

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

  function clearSelection() {
    state.selected = null;
    history.replaceState(null, "", location.pathname + location.search);
    el.list.querySelectorAll(".card.selected").forEach(function (c) { c.classList.remove("selected"); });
  }

  function select(id, opts) {
    var p = projects.find(function (x) { return x.id === id; });
    if (!p) return;
    if (!matches(p)) {
      // Deep link to a filtered-out project: reset filters rather than show nothing.
      state.owner = "all"; state.query = ""; el.search.value = "";
      state.statuses = new Set(STATUSES.map(function (s) { return s.key; }));
      el.ownerFilter.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.owner === "all");
      });
    }
    if (popup) { popup.off("close", clearSelection); popup.remove(); }
    state.selected = id;
    render();
    if (!opts || opts.fly !== false) {
      map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16), duration: 700 });
    }
    popup = new maplibregl.Popup({ maxWidth: "300px", offset: 12 })
      .setLngLat([p.lng, p.lat])
      .setHTML(popupHtml(p))
      .addTo(map);
    popup.on("close", clearSelection);
    history.replaceState(null, "", "#" + id);
    var card = el.list.querySelector('[data-id="' + id + '"]');
    if (card && opts && opts.scroll) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.getElementById("map").scrollIntoView({ behavior: "smooth" });
    }
  }

  // ---- wiring ----

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

  function getJson(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  // If the basemap can't be reached, still show the projects on a plain background.
  var styleReady = getJson(CONFIG.styleUrl).catch(function () { return BLANK_STYLE; });

  Promise.all([getJson("data/projects.json"), styleReady])
    .then(function (res) {
      var data = res[0];
      // Largest first in the list.
      projects = data.projects.slice().sort(function (a, b) { return weight(b) - weight(a); });

      map = new maplibregl.Map({
        container: "map",
        style: res[1],
        center: CONFIG.center,
        zoom: CONFIG.zoom,
        maxPitch: 70,
        attributionControl: { compact: false }
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new ModeControl(), "top-right");

      projects.forEach(function (p) {
        var s = markerSize(p);
        var node = document.createElement("button");
        node.className = "map-pin pin " + p.owner + " st-" + p.status;
        node.style.width = node.style.height = s + "px";
        node.title = p.name;
        node.setAttribute("aria-label", p.name);
        node.addEventListener("click", function (e) {
          e.stopPropagation();
          select(p.id, { fly: false, scroll: true });
        });
        markers[p.id] = new maplibregl.Marker({ element: node }).setLngLat([p.lng, p.lat]).addTo(map);
      });

      if (data.last_updated) {
        var d = new Date(data.last_updated + "T12:00:00");
        el.updated.textContent = "Updated " + d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ".";
      }

      map.on("load", function () {
        addLayers();
        setMode(params.get("view") !== "2d", false);
        render();
        if (location.hash.length > 1) select(decodeURIComponent(location.hash.slice(1)), { scroll: true });
      });
      render();
    })
    .catch(function () {
      el.summary.textContent = "Couldn't load project data. If you opened this file directly, serve the folder instead (see README).";
    });
})();
