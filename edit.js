// Edit mode, loaded only with ?edit=1. Nothing here changes the published map:
// you move pins and trace footprints in your browser, then download the updated
// projects.json and replace the one in the repository.
window.initHousingEdit = function (api) {
  "use strict";

  var map = api.map;
  var points = [];      // footprint corners placed so far, as [lng, lat]
  var target = null;    // project being traced (map clicks clear the normal selection)
  var dirty = false;

  function round(n) { return Math.round(n * 1e6) / 1e6; }

  // ---- panel ----
  var panel = document.createElement("div");
  panel.id = "edit-panel";
  panel.innerHTML =
    "<strong>Edit mode</strong>" +
    '<p id="edit-target"></p>' +
    '<p id="edit-hint"></p>' +
    '<div class="edit-row">' +
    '<button id="edit-trace">Trace footprint</button>' +
    '<button id="edit-undo" hidden>Undo point</button>' +
    '<button id="edit-finish" hidden>Finish block</button>' +
    '<button id="edit-cancel" hidden>Cancel</button>' +
    "</div>" +
    '<div class="edit-row">' +
    '<button id="edit-clear">Remove footprint</button>' +
    '<label><input type="checkbox" id="edit-aerial" checked> Aerial photo</label>' +
    "</div>" +
    '<button id="edit-download" class="primary">Download projects.json</button>';
  document.getElementById("map").appendChild(panel);
  var $ = function (id) { return document.getElementById(id); };

  function update() {
    var p = target || api.selected();
    $("edit-target").textContent = p ? "Selected: " + p.name : "No project selected.";
    $("edit-hint").textContent = api.tracing
      ? "Click each corner of the building in order (" + points.length + " placed), then Finish block."
      : p
        ? "Drag any pin to move it. To draw this project's outline, press Trace footprint."
        : "Drag any pin to move it. Pick a project from the list to trace its outline.";
    $("edit-trace").hidden = api.tracing;
    $("edit-trace").disabled = !p;
    $("edit-clear").disabled = !p || !p.shapes;
    $("edit-undo").hidden = $("edit-finish").hidden = $("edit-cancel").hidden = !api.tracing;
    $("edit-finish").disabled = points.length < 3;
    $("edit-download").textContent = dirty ? "Download projects.json (unsaved changes)" : "Download projects.json";
  }

  // ---- aerial photo under the shapes, to trace against ----
  map.addSource("aerial", {
    type: "raster",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    maxzoom: 19,
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics"
  });
  map.addLayer({ id: "aerial", type: "raster", source: "aerial" }, "project-shapes");
  map.setPaintProperty("project-shapes", "fill-extrusion-opacity", 0.5);
  $("edit-aerial").addEventListener("change", function (e) {
    map.setLayoutProperty("aerial", "visibility", e.target.checked ? "visible" : "none");
  });

  // ---- outline being traced ----
  map.addSource("trace", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "trace-line", type: "line", source: "trace", paint: { "line-color": "#ffe14d", "line-width": 3 } });
  map.addLayer({
    id: "trace-points", type: "circle", source: "trace", filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 5, "circle-color": "#ffe14d", "circle-stroke-color": "#222", "circle-stroke-width": 1.5 }
  });
  function drawTrace() {
    var features = points.map(function (pt) {
      return { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: pt } };
    });
    if (points.length > 1) {
      features.push({
        type: "Feature", properties: {},
        geometry: { type: "LineString", coordinates: points.length > 2 ? points.concat([points[0]]) : points }
      });
    }
    map.getSource("trace").setData({ type: "FeatureCollection", features: features });
  }

  function stopTracing() {
    api.tracing = false;
    target = null;
    points = [];
    drawTrace();
    map.getCanvas().style.cursor = "";
    update();
  }

  // Put the pin (and popup anchor) at the middle of everything traced so far.
  function recentre(p) {
    var all = [];
    p.shapes.forEach(function (s) { all = all.concat(s.ring); });
    p.lng = round(all.reduce(function (t, c) { return t + c[0]; }, 0) / all.length);
    p.lat = round(all.reduce(function (t, c) { return t + c[1]; }, 0) / all.length);
    api.markers[p.id].setLngLat([p.lng, p.lat]);
  }

  $("edit-trace").addEventListener("click", function () {
    target = api.selected();
    if (!target) return;
    api.tracing = true;
    api.setMode(false, true); // tracing is done on the flat map
    map.getCanvas().style.cursor = "crosshair";
    update();
  });
  $("edit-undo").addEventListener("click", function () { points.pop(); drawTrace(); update(); });
  $("edit-cancel").addEventListener("click", stopTracing);
  $("edit-finish").addEventListener("click", function () {
    var p = target;
    if (!p || points.length < 3) return;
    var answer = window.prompt(
      "How many storeys is this block?\nLeave blank to use the project's overall height" +
      (p.stories ? " (" + p.stories + " storeys)." : "."), "");
    if (answer === null) return;
    var block = { ring: points.slice() };
    var n = parseInt(answer, 10);
    if (n > 0) block.stories = n;
    p.shapes = (p.shapes || []).concat([block]);
    recentre(p);
    dirty = true;
    api.refresh();
    stopTracing();
  });
  $("edit-clear").addEventListener("click", function () {
    var p = api.selected();
    if (!p) return;
    p.shapes = null;
    dirty = true;
    api.refresh();
    update();
  });

  map.on("click", function (e) {
    if (!api.tracing) { setTimeout(update, 0); return; }
    points.push([round(e.lngLat.lng), round(e.lngLat.lat)]);
    drawTrace();
    update();
  });
  document.getElementById("list").addEventListener("click", function () { setTimeout(update, 0); });

  // ---- draggable pins ----
  api.projects.forEach(function (p) {
    var m = api.markers[p.id];
    m.setDraggable(true);
    m.on("dragend", function () {
      var at = m.getLngLat();
      p.lng = round(at.lng);
      p.lat = round(at.lat);
      dirty = true;
      api.refresh();
      update();
    });
  });

  // ---- export ----
  api.exportJson = function () {
    api.data.last_updated = new Date().toISOString().slice(0, 10);
    return JSON.stringify(api.data, null, 2)
      // keep each coordinate pair on one line
      .replace(/\[\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+\]/g, "[$1, $2]") + "\n";
  };
  $("edit-download").addEventListener("click", function () {
    var url = URL.createObjectURL(new Blob([api.exportJson()], { type: "application/json" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = "projects.json";
    a.click();
    URL.revokeObjectURL(url);
    dirty = false;
    update();
  });
  window.addEventListener("beforeunload", function (e) { if (dirty) e.preventDefault(); });

  // Pins are needed for dragging, so start on the flat map.
  api.setMode(false, false);
  window.housingEdit = api; // handy in the browser console
  update();
};
