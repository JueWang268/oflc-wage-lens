# OFLC Wage Atlas

**[Live website](https://juewang268.github.io/oflc-wage-lens/)**

Open-source companion website to OFLC Wage Lens. Enter a base salary and compare
it against four wage thresholds across all 50 states and DC. Select from all
**848 SOC occupations & 997 O*NET entries** in the downloaded all-industries
dataset. Software Developers (15-1252) is the default. Search by title or code;
O*NET entries use their explicitly mapped SOC's wages, not inferred rates.
The default county view uses bundled assets only. Select **Streets & places**
for city/town labels and roads above the wage shading. This optional view loads
OpenFreeMap tiles over the internet and requires WebGL. No accounts, API keys
or analytics are used. County comparisons remain available if tiles fail.

## Explore the map

1. Type an occupation title or code & select an autocomplete suggestion, or use the occupation dropdown.
2. Enter annual or hourly base pay. The map recolors immediately; each level's county count appears beside its name.
3. Select a state to focus the map, search for a county, or click a county in either **Counties** or **Streets & places** view.
4. Read the selected county's wage area, four thresholds & pay needed to reach the next level in the side panel. At or above Level IV, the panel shows the amount above that threshold instead.
5. Export the filtered comparisons with **County CSV**, or bookmark the URL to preserve salary, occupation & selected county.

The compact controls & inline legend adapt to desktop and mobile. State and
county controls retain accessible names without visible labels. County names
and wage areas appear in the detail panel; five-digit FIPS identifiers remain
in the data, selection URLs & CSV exports rather than the visible header.

## Run

Requires Node.js 22+:

```sh
node scripts/serve.cjs
```

Open http://127.0.0.1:4178. To change the port: `PORT=4180 node scripts/serve.cjs`.
Alternatively serve `dist/` with any static web host. Opening the HTML directly
with `file://` will not work because browsers restrict local JSON fetches.

## GitHub Pages

The parent repository's `.github/workflows/pages.yml` validates the map and
runs Firefox interaction tests & Chromium street-map checks before publishing only `website/dist/` to
GitHub Pages. Push website changes to `main` to update the live map. Pull
requests run the checks without deployment. No credentials, raw data archives,
private-preview configuration or unrelated project files enter the Pages artifact.
All browser assets use relative URLs so deployment under `/oflc-wage-lens/` works.

## Bands

| Color | Salary comparison |
| --- | --- |
| Deep red | Below Level I |
| Red | Level I to below II |
| Yellow | Level II to below III |
| Light green | Level III to below IV |
| Green | Level IV and above |
| Gray | Missing, flagged, ambiguous or invalid comparison |

There is **no Level V**. Equal thresholds belong to the higher band. Comparisons
preserve the extension's cent-based boundary rules. Hourly source rates are
annualized using 2,080 hours/year; records labeled `Annual Wage` are already
annual and are never multiplied again. Hourly display for these records is an
equivalent, not a published hourly estimate. This is a salary benchmark, not an
official prevailing wage determination or visa eligibility assessment.

## Sources and coverage

- Wage snapshot: **October 2026**, OFLC 2026-27, valid July 1, 2026-June 30, 2027.
- [DOL source](https://flag.dol.gov/wage-data/wage-data-downloads).
- Occupations: all 848 SOC codes and 997 O*NET crosswalk entries, all industries.
  Default: Software Developers, SOC 15-1252.
- Sources: `ALC_Export.csv`, `oes_soc_occs.csv` and `xwalk_plus.csv`.
  `EDC_Export.csv` (higher education) is intentionally not mixed into this map.
- `dist/data/occupations.json` is the title/crosswalk catalog and source hash
  manifest. Each `dist/data/occupations/<SOC>.json` contains 530 wage-area rows
  and loads only when needed. Selecting a specialization reuses its SOC file.
- `High Wage` and `No Leveled Wage` rows have no four-level breakdown. They stay
  gray with a source-specific explanation; no levels are invented from averages.
- Boundaries: 2025 Census cartographic counties and states, 1:5,000,000 scale.
  [Counties](https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_county_5m.zip),
  [states](https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_5m.zip).
- **3,144 county/county-equivalent polygons**, all exactly matched to OFLC by
  full normalized name and state. Includes Connecticut planning regions.
- County polygons inherit their **OFLC wage area's rates**. These are not
  separately estimated county wages. Territories are outside this map's scope.
- Wage source hashes and boundary metadata ship in `dist/data/counties.json`.
- Census geometries are simplified and unsuitable for precise parcel boundaries.

## Update data

The website does **not** download/apply new data automatically. It warns before
or after the bundled wage period. The extension's separate release monitor is
unchanged. To update:

1. Rebuild the extension's wage JSON using its `UPDATING_DATA.md` instructions.
2. Copy the new `extension/data/software-developers.json` into `source-data/`.
3. If updating boundaries, obtain matching-year Census county and state ZIPs.
4. Install the build-only dependency: `python3 -m pip install pyshp==2.3.1`.
5. Run `python3 scripts/build-map.py`. For other paths, use `--wages`,
   `--boundaries`, `--output`, `--boundary-year` and `--snapshot`.
6. Build all occupation files from the same release's unmodified CSVs:
   `python3 scripts/build-occupations.py /path/to/OFLC_Wages_2026-27`.
   This uses the Python standard library, preserves source units and labels,
   and records CSV hashes. Inspect the catalog counts before publishing.
7. Inspect the printed unmatched list. Do not add fuzzy matches just to fill gaps.
8. Run tests, review screenshots, then publish the rebuilt `dist/`.

The matching state boundary ZIP must be next to the county ZIP, named by
replacing `_county_` with `_state_`. Suppressed, missing or nonmonotonic wage
levels remain gray, even when geographic matching succeeds.

## Tests

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm install
# Start the local server in another terminal, then:
npm run test:browser
```

Browser tests use Firefox & Chromium; install with `npx playwright install firefox chromium`.
`PLAYWRIGHT_MODULE` can point at an existing Playwright installation.
`BASE_URL` overrides the preview address. Tests cover precise boundaries, bad
inputs, joins, units, map interaction, state filters, CSV exports, bookmark
restoration, expired data, load failure, and mobile layout. Occupation tests also
check all 449,440 source rows, annual/hourly rate handling, exact boundaries,
O*NET mapping, preserved worksite/salary selections, response races and retries.
Screenshots go to
ignored `test-results/`. No test submits user data anywhere.

Layout checks cover accessible control names, inline county counts & the annual
and hourly next-level wording. Street-map tests exercise 130 actual canvas
county selections: all 82 county equivalents in CT, CA & AZ, plus one in every
other state & DC. They verify the selected county, URL, search field & wage
thresholds, and preserve leading-zero FIPS identifiers for all 3,144 polygons.

## Repository layout

- `dist/`: self-contained deployable static site, including pinned vendor files.
- `scripts/build-map.py`: reproducible explicit county/state join.
- `scripts/build-occupations.py`: reproducible catalog and per-SOC wage builder.
- `source-data/`: unmodified public wage JSON and Census ZIPs only.
- `tests/`: calculation and browser regression coverage.

Application code: MIT. D3 7.9.0 and Lucide 1.8.0: ISC. MapLibre GL JS 6.15.0:
BSD-3-Clause. Pinned rendering files and license texts are in `dist/vendor/`.
PyShp 2.3.1 is MIT licensed and used only to build data.
The optional street view uses [OpenFreeMap](https://openfreemap.org/),
[OpenMapTiles](https://openmaptiles.org/) and
[OpenStreetMap](https://www.openstreetmap.org/copyright) data (ODbL).
Attribution remains visible on the map. Labels appear at the basemap's suitable
zoom levels; not every settlement is labeled at once. County boundaries remain
simplified Census geometry, not street/parcel-accurate worksite boundaries.
Street tile requests reveal IP address and the viewed geographic area to the
provider, but do not include salary or occupation. Cross-origin referrers are
restricted to the site origin. The provider has no uptime guarantee.
No resume, email, credentials, or other private application documents belong
in this folder or any deployment archive. Salary and county are saved in the
page URL for bookmarking, along with the selected occupation code; these can
be visible in browser history, copied URLs and host access logs.

Street-view checks use Chromium (`npx playwright install chromium`), then
`node tests/streets-browser.cjs` against the running preview. CI uses a local
basemap fixture, not the public tile service. `LIVE_TILES=1` opts into a live
smoke test for roads, labels, attribution and canvas rendering.
