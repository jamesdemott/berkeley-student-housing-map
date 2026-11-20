// Site-level settings. Edit these when the repo and the Housers site are wired up.
window.MAP_CONFIG = {
  // Where "Suggest a correction" points (a GitHub issues URL or a mailto: link).
  feedbackUrl: "mailto:housers@berkeley.edu?subject=Housing%20map%20correction",

  // Starting view, as [longitude, latitude]: just south-west of campus.
  center: [-122.2625, 37.8685],
  zoom: 15.3,

  // Camera tilt and rotation used in 3D mode.
  pitch: 55,
  bearing: -17,

  // Basemap: OpenFreeMap's light "Positron" style. It is free, needs no API
  // key, and includes the OpenStreetMap building outlines that 3D mode extrudes.
  styleUrl: "https://tiles.openfreemap.org/styles/positron",

  // How tall one storey is drawn when a project has no height_ft, in metres.
  metresPerStorey: 3.2,

  // Storeys assumed for a project with neither stories nor height_ft.
  defaultStories: 6
};
