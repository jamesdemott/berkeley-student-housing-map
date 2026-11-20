# Berkeley Student Housing Map

A lightweight web map of proposed, approved, under-construction, and newly
opened student housing on and near the UC Berkeley campus. It tracks both
university projects and private development.

The map opens in 3D: each project is drawn as a block at its real height among
the existing buildings of the neighbourhood. A button on the map switches to a
flat view with pins.

It is a static site: plain HTML, CSS, and JavaScript, with MapLibre GL JS
vendored in `vendor/`. There is no build step and no API key.

## Run it locally

The page loads its data with `fetch`, so open it through a local server rather
than by double-clicking `index.html`:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Update the data

Every project is one entry in `data/projects.json`:

| Field | Meaning |
| --- | --- |
| `id` | Short unique slug, used in share links (`#bancroft-fulton`) |
| `name`, `address` | Shown in the list and popup |
| `lat`, `lng` | Marker position |
| `owner` | `university` or `private` |
| `status` | `proposed`, `approved`, `construction`, or `opened` |
| `beds`, `units`, `stories` | Whole numbers, or `null` when unknown |
| `height_ft` | Building height in feet if published, else `null` (the map then uses `stories`) |
| `shapes` | Traced footprint for 3D, or `null` for a placeholder box (see below) |
| `opens` | Free text, e.g. `Fall 2028` or `Opened August 2026` |
| `team`, `audience`, `notes` | Free text, or `null` |
| `sources` | List of `{ "label", "url" }`; at least one |

Bump `last_updated` at the top of the file when you change anything, then check
your edit:

```bash
node scripts/validate.mjs
```

### Correct a location or trace a footprint

Until a project has `shapes`, the 3D view draws a plain square box at its
location and says so in the popup. The site has a built-in edit mode for fixing
both the location and the shape. Open the map with `?edit=1` on the address:

    https://YOUR-PAGES-URL/?edit=1

Edit mode shows an aerial photo under the map and changes nothing online; all
edits stay in your browser until you download them.

- **Move a pin:** drag it to the right spot.
- **Trace a footprint:** pick the project in the list, press *Trace footprint*,
  click each corner of the building in order, then *Finish block* and enter its
  storeys (or leave blank to use the project's height). Trace again to add
  another block, such as a tower on top of a podium.
- **Start over:** *Remove footprint* returns the project to a placeholder box.
- **Check it:** the 3D button shows the result at height.
- **Save:** *Download projects.json*, then replace `data/projects.json` in the
  repository with the downloaded file (on GitHub: open the `data` folder, then
  Add file → Upload files) and commit.

For sites that are still a parking lot or an older building in the aerial
photo, trace the outline from the project's site plan (city staff report,
design review packet, or Regents item) using the lot lines as a guide.

The saved format, if you prefer to edit by hand: each block is a ring of
`[longitude, latitude]` points with an optional `stories` or `height_ft`, and
`base_ft` to lift a block off the ground.

```json
"shapes": [
  { "ring": [ ...podium outline... ], "stories": 8 },
  { "ring": [ ...tower outline... ], "height_ft": 276 }
]
```

### About the starting dataset

The initial entries were compiled in November 2026 from news coverage and
project pages (linked per project). Two things to know:

- **Coordinates are estimated** from street addresses, not surveyed or
  geocoded. They are right to within roughly half a block; nudge them as needed.
- **No footprints are traced yet**, so every project is a placeholder box.
- **Neighbouring building heights come from OpenStreetMap** and are missing for
  many smaller buildings, which are drawn at a low default height.
- **Status moves fast.** Entries whose latest step could not be confirmed say
  so in their notes.

## Publish

GitHub Pages works as-is: in the repository settings, set Pages to deploy from
the `main` branch root.

## Embed in another site

Add `?embed=1` to hide the title block, then drop it in an iframe:

```html
<iframe src="https://YOUR-PAGES-URL/?embed=1" title="Berkeley student housing map"
        style="width:100%;height:640px;border:0" loading="lazy"></iframe>
```

Link straight to a project with its id: `https://YOUR-PAGES-URL/#heumann-house`.
The two can be combined with the flat view: `?embed=1&view=2d`.

## Settings

`config.js` holds the starting view, the 3D camera angle, the basemap style, and
where the "Suggest a correction" link points.

Add `?view=2d` to the address to open on the flat map.

The basemap is OpenFreeMap's Positron style, which is free and needs no key. If
it cannot be reached, the projects still appear on a plain background.

## Credits

Map library: [MapLibre GL JS](https://maplibre.org) (BSD-3-Clause). Basemap:
[OpenFreeMap](https://openfreemap.org), with data © OpenMapTiles and
© OpenStreetMap contributors.
