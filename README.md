# Berkeley Student Housing Map

A lightweight web map of proposed, approved, under-construction, and newly
opened student housing on and near the UC Berkeley campus. It tracks both
university projects and private development.

It is a static site: plain HTML, CSS, and JavaScript, with Leaflet vendored in
`vendor/`. There is no build step.

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
| `opens` | Free text, e.g. `Fall 2028` or `Opened August 2026` |
| `team`, `audience`, `notes` | Free text, or `null` |
| `sources` | List of `{ "label", "url" }`; at least one |

Bump `last_updated` at the top of the file when you change anything, then check
your edit:

```bash
node scripts/validate.mjs
```

### About the starting dataset

The initial entries were compiled in November 2026 from news coverage and
project pages (linked per project). Two things to know:

- **Coordinates are estimated** from street addresses, not surveyed or
  geocoded. They are right to within roughly half a block; nudge them as needed.
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

## Settings

`config.js` holds the starting map view, the basemap, and where the "Suggest a
correction" link points.

### Basemap key

The light CARTO basemap needs a free Basemaps API key. Request one at
https://carto.com/basemaps/apikey and paste it into `cartoKey` in `config.js`.
The browser sends this key with every tile request, so it is public by design
and safe to commit; it is not a secret. Until a key is set, the map uses
standard OpenStreetMap tiles.

## Credits

Map library: [Leaflet](https://leafletjs.com) (BSD-2-Clause). Basemap: CARTO
Positron or OpenStreetMap tiles, with data © OpenStreetMap contributors.
