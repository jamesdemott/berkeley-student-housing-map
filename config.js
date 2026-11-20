// Site-level settings. Edit these when the repo and the Housers site are wired up.
window.MAP_CONFIG = {
  // Where "Suggest a correction" points (a GitHub issues URL or a mailto: link).
  feedbackUrl: "mailto:housers@berkeley.edu?subject=Housing%20map%20correction",

  // Starting view: centered just south-west of campus, where most projects are.
  center: [37.8688, -122.2625],
  zoom: 15,

  // Basemap tiles (CARTO Positron: free, no API key, attribution required).
  tiles: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  tileAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
};
