# OFLC Wage Atlas

**[Live website](https://juewang268.github.io/oflc-wage-lens/)**

Open-source companion website to OFLC Wage Lens. Enter a base salary and compare
it against four software developer wage thresholds across all 50 states and DC.
No accounts, API keys, tiles, analytics, or external runtime requests are needed
by the application. Hosting may separately require sign-in.

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
runs Firefox interaction tests before publishing only `website/dist/` to
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
reuse `WageLensCore.classify` from the browser extension and compare cents.
Hourly equivalents use 2,080 hours/year. This is a salary benchmark, not an
official prevailing wage determination or visa eligibility assessment.

## Sources and coverage

- Wage snapshot: **October 2026**, OFLC 2026-27, valid July 1, 2026-June 30, 2027.
- [DOL source](https://flag.dol.gov/wage-data/wage-data-downloads).
- Occupation: Software Developers, SOC 15-1252 / O*NET 15-1252.00, all industries.
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
6. Inspect the printed unmatched list. Do not add fuzzy matches just to fill gaps.
7. Run tests, review screenshots, then publish the rebuilt `dist/`.

The matching state boundary ZIP must be next to the county ZIP, named by
replacing `_county_` with `_state_`. Suppressed, missing or nonmonotonic wage
levels remain gray, even when geographic matching succeeds.

## Tests

```sh
node --test tests/map.test.cjs
npm install
# Start the local server in another terminal, then:
npm run test:browser
```

Browser tests use headless Firefox; install it once with `npx playwright install firefox`.
`PLAYWRIGHT_MODULE` can point at an existing Playwright installation.
`BASE_URL` overrides the preview address. Tests cover precise boundaries, bad
inputs, joins, units, map interaction, state filters, CSV exports, bookmark
restoration, expired data, load failure, and mobile layout. Screenshots go to
ignored `test-results/`. No test submits user data anywhere.

## Repository layout

- `dist/`: self-contained deployable static site, including pinned vendor files.
- `scripts/build-map.py`: reproducible explicit county/state join.
- `source-data/`: unmodified public wage JSON and Census ZIPs only.
- `tests/`: calculation and browser regression coverage.

Application code: MIT. D3 7.9.0 and Lucide 1.8.0: ISC; license texts are in
`dist/vendor/`. PyShp 2.3.1 is MIT licensed and used only to build data.
No resume, email, credentials, or other private application documents belong
in this folder or any deployment archive. Salary and county are saved in the
page URL for bookmarking, which can be visible in browser history, copied URLs
and host access logs.
