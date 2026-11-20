// Site-level settings. Edit these when the repo and the Housers site are wired up.
window.MAP_CONFIG = {
  // Where "Suggest a correction" points (a GitHub issues URL or a mailto: link).
  feedbackUrl: "mailto:housers@berkeley.edu?subject=Housing%20map%20correction",

  // Starting view: centered just south-west of campus, where most projects are.
  center: [37.8688, -122.2625],
  zoom: 15,

  // Basemap. CARTO's light "Positron" style needs a free Basemaps API key
  // (request one at https://carto.com/basemaps/apikey). The key is used by the
  // browser, so it is public by design: it is fine to commit it here.
  // While cartoKey is empty the map falls back to standard OpenStreetMap tiles.
  cartoKey: "cb1_5csg_1_7fe4f10c3d7557b93b737653",
  cartoTiles: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  cartoAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  fallbackTiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  fallbackAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
};
