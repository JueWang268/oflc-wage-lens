# OFLC Wage Lens

Explore how a base salary compares with U.S. Department of Labor OFLC wage benchmarks, county by county or directly on a job posting. Open source, with local salary calculations & no account required.

**[Open the interactive wage map](https://juewang268.github.io/oflc-wage-lens/)** | [Firefox setup](#install-in-firefox) | [Data updates](UPDATING_DATA.md)

| | Wage Atlas website | Wage Lens Firefox extension |
| --- | --- | --- |
| Use | Compare a salary across the country | Check a job posting's detected pay & location |
| Occupations | 848 SOC occupations & 997 O*NET entries | Software Developers, SOC 15-1252 / O*NET 15-1252.00 |
| Geography | 3,144 counties & county equivalents, 50 states + DC | OFLC wage areas, counties & supported city names |
| Pay | Annual or hourly base salary | Detected salary ranges & manual overrides |

**Data: OFLC 2026-27, snapshot October 2026.** These are salary comparisons against four published wage thresholds, not official wage-level or visa eligibility determinations. Base salary excludes bonuses & equity. There is no Level V.

## County map website

1. Search for an occupation by title or code & choose an autocomplete result. Software Developers (15-1252) is the default.
2. Enter a base salary & select annual or hourly pay.
3. Click a county in either map view, search for a county, or filter by state. The side panel shows the county, its wage area, all four thresholds & the additional pay needed to reach the next level.
4. Switch to **Streets & places** for city/town names & roads, or export the current state-filtered county comparisons as CSV. Copy the page URL to preserve salary, occupation & selected county.

| Color | Salary band |
| --- | --- |
| Deep red | Below Level I |
| Red | Level I to below II |
| Yellow | Level II to below III |
| Light green | Level III to below IV |
| Green | Level IV or above |
| Gray | Unavailable or invalid comparison |

The compact legend shows county counts beside each level. County selections
update the same detail panel in both views, including Connecticut planning
regions. **Streets & places** needs internet access & WebGL for OpenFreeMap
tiles; the default county overview uses only bundled assets. See
[`website/README.md`](website/README.md) for attribution, privacy details,
rebuilding & test coverage.

Run `node website/scripts/serve.cjs`, then open http://127.0.0.1:4178.
The website uses the October 2026 OFLC snapshot and 2025 Census boundaries;
county polygons inherit their OFLC wage-area rates. It reuses the extension's
cent-based classification rules, handles annual-wage occupations without double
conversion, does not change the extension, and does not automatically
download new wages. See the website README for rebuilding and testing.

## Install in Firefox

The floating panel appears at the top right of detected individual job pages.
The toolbar button toggles it manually on other supported pages.

1. In Firefox 142 or later, open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `extension/manifest.json` in this folder.
3. Refresh an open job page. If needed, grant the extension access to that site using Firefox's extensions menu.

Temporary add-ons are removed when Firefox restarts. Reload the same manifest after a restart. For persistent installation in standard Firefox, submit `dist/oflc-wage-lens-1.2.0.zip` for Mozilla signing (an unlisted, self-distributed add-on is an option). The ZIP is not signed; it is not a one-click permanent installer. This project does not change browser security settings.

## Behavior

- Reads `JobPosting` JSON-LD first; otherwise examines visible job text.
- Automatic display is limited to individual postings: a single structured job, a recognized ATS detail URL, or a role title with job-description sections and an application control. Mail sites and Jobright are excluded from automatic scanning/display. Search/listing headings and multiple structured job records do not auto-open the panel. The toolbar can still open it manually.
- Detects dollar / USD salary figures, annual or hourly ranges, `k` shorthand, and explicit monthly/weekly/daily periods. Annual pay without a stated period is accepted only with salary context and marked as inferred.
- Explicitly foreign currency, sign-on bonuses, equity and total-compensation figures are excluded where identifiable. Check detected base-pay evidence before relying on a result.
- Location and pay default to the first detected candidate. Other detected values remain selectable; confirm the selected pay belongs to the selected worksite. No automatic midpoint is used. User selections persist through page-content updates until a rescan or navigation.
- Remote or nationwide listings require an actual worksite. There is no default home address, geolocation request or company-headquarters fallback for identified remote-only roles.
- Searches all wage areas and counties in the source geography table. Principal-city names and a curated set of common technology worksite cities resolve to **wage areas**, not an invented county. An unsupported city can be resolved by selecting its actual county manually. This is not a nationwide street-address geocoder.
- Manual salary and location overrides stay on the current page. A rescan restores detected values. A URL change clears overrides. Nothing is saved to a remote service or browser storage.
- Survives page hydration and replacement of the document/body by reattaching the same panel. The toolbar can recover a detached panel; closing it intentionally is still respected. Recognized ATS detail routes stay visible through loading. Generic pages get a brief two-second grace window for temporary loading content, then are re-evaluated; a listing view hides the automatic panel even without a URL change.
- Shows Levels I-IV, both hourly and annual, including below-Level-I and unavailable-data states. A salary range is classified at both endpoints, not its midpoint.
- Starts with the work-location dropdown. Once a location is selected, the linear Level I-IV spectrum and full four-row hourly/annual table are always visible. A single salary uses an arrow; a range uses a bracket. With no valid pay, only wage thresholds appear, without a pay marker. Out-of-scale salaries get outward arrows and explicit below/above labels. Open-ended pay shows only its known floor. Explanatory notes are tucked into Detection & source.
- Keeps exact wage thresholds when toggling annual/hourly display. 40 hours/week times 52 weeks/year equals **2,080 hours/year**. Explicit monthly, weekly and daily figures use 12, 52 and 260 respectively; daily conversion assumes 8 hours/day.
- If a page has no pay, no reliable location, or multiple job records, the panel exposes those ambiguities instead of inventing values.

## Meaning of "Tier"

The displayed tier is the **highest published OFLC wage-level threshold met by the entered salary**, not a legal determination of the position's wage level. Actual prevailing-wage requirements depend on occupation, worksite, duties, education, experience and other factors; salary alone does not establish the job's level, H-1B eligibility, selection priority or sponsorship availability. Above Level IV stays Level IV, not Level V. Open-ended pay is classified at its stated floor only.

Example from this dataset for **Travis County, TX**, area 12420 (Austin-Round Rock-San Marcos):

| Level | Hourly | Annual (2,080 hours) |
| --- | ---: | ---: |
| I | $46.10 | $95,888.00 |
| II | $57.52 | $119,641.60 |
| III | $68.94 | $143,395.20 |
| IV | $80.36 | $167,148.80 |

$120,000/year meets Level II; $120,000-$150,000 spans Levels II-III.

## Data and privacy

**Data snapshot: October 2026.** The source files were downloaded through the
official [U.S. Department of Labor OFLC Wage Data Downloads page](https://flag.dol.gov/wage-data/wage-data-downloads).
The download listing was checked on **October 11, 2026** and lists the
**2026-2027 wage files**, updated **July 1, 2026**. October is this project's
snapshot date, not the underlying survey date or the start of the wage year.

The bundled dataset contains **530 wage areas** from the user's `OFLC_Wages_2026-27` download. It uses **ALC_Export.csv (all industries)**, not EDC's ACWIA higher-education wages. Source data is effective **July 1, 2026 through June 30, 2027**, based on May 2025 OEWS estimates, according to the supplied technical release notes. The extension warns after the data expires; it does not silently substitute another wage year.

`scripts/build_data.py` validates the O*NET/SOC crosswalk, monotonic positive wages and geographic joins, and stores SHA-256 hashes of its three source CSVs in the generated JSON. Geographic source codes from OFLC are retained and broader-source rows flagged. Missing/suppressed levels are never treated as zero.

All job parsing and calculations are local. The extension performs no analytics, advertising, network geocoding, account access, form submission or remote AI calls. In addition to reading its packaged wage dataset, its background monitor requests the public DOL download listing. No job-page content, pay figures, locations, cookies or credentials are included. DOL receives ordinary connection metadata such as IP address and browser request headers. HTTP/HTTPS host access is requested for automatic detection on arbitrary career sites; Firefox-protected pages cannot be inspected. Toolbar activation uses `activeTab` and `scripting` for already-open tabs.

Page content is untrusted: extracted values are rendered with `textContent`; no page-provided HTML, JavaScript or instructions are executed. Shadow DOM isolates panel styles. It does not access cross-origin embedded job frames; open those postings directly.

## Keeping wage data current

The extension includes its own autonomous monitor (`extension/monitor.js`).
No Codex app, account, automation or external scheduler is required. It checks
the official DOL download listing when the extension loads if no attempt was
made in the last 24 hours. A Firefox alarm checks again daily while Firefox is
running. The timestamp survives restarts, so loading many job tabs does not
trigger repeated requests. It cannot run while Firefox is closed.

The monitor compares wage-year periods, published revision dates and official
ZIP links with the release bundled in this version. A `NEW` toolbar badge and
panel notice identify new, revised or future-effective releases. A persistent
**red warning banner at the top of the panel** appears when the data has expired,
DOL lists an applicable update, a check fails, or the last successful check is
more than seven days old. Known problems remain visible with monitoring disabled.
Future-effective releases use a blue informational notice while current data is
still valid, not a false expiration warning. Failed checks
show `!` (or retain `NEW` for a previously found update); they never claim the
data is current. In **Detection & source**, users can see the last successful
check, disable automatic checking, or request a check with the refresh icon.
Manual checks have a one-minute cooldown.

Requests use HTTPS, omit cookies/credentials and referrers, reject redirects,
time out after 15 seconds and cap the response at 1 MiB. The fetched HTML is
parsed in a detached document, never executed or inserted into the panel.
Only check timestamps, release metadata, error status and the enabled setting
are persisted in local extension storage, not job content or entered salaries.

**Monitoring is not automatic data replacement.** It does not download ZIPs,
compare remote CSV hashes, or detect a silent ZIP-content change if the listing
date and URL remain identical. An update notice means a maintainer should
download and validate the official files, rebuild/test the dataset and release
a new extension version. Future-effective releases are explicitly identified;
they never replace current wage thresholds early. Installed extensions keep
their bundled snapshot until upgraded. See [RELEASING.md](RELEASING.md).

### Manual data updates

Download the official ZIP into this project's `raw-data/` folder, extract it,
then follow [UPDATING_DATA.md](UPDATING_DATA.md) to rebuild the JSON and reload
Firefox. **Copying a ZIP into the folder is not enough.** The builder accepts the
official wage year, revision date and download URL; the UI and monitor use the
generated metadata. Signed installations normally require a new signed release.

## Open-source license

Project code is licensed under [MIT](LICENSE). Anyone can inspect, modify,
rebuild and redistribute it under those terms, without Codex. Lucide/Feather icon
licenses and DOL source attribution are retained separately in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Release status

The source is public on GitHub & Wage Atlas is live on GitHub Pages. The
desktop Firefox extension remains an unsigned release candidate: it has not
been signed by Mozilla, and no GitHub Release is published. Temporary loading
is supported; a permanent Firefox installation requires signing. See
[RELEASING.md](RELEASING.md) for remaining release steps. [PRIVACY.md](PRIVACY.md)
describes permissions and local-only processing. [SECURITY.md](SECURITY.md)
documents the remaining upstream development-tool advisory. Do not describe the
entire dependency tree as vulnerability-free.

## Develop and test

No build server is required to use the extension. Generated data and icons are already included.

```sh
npm ci
python3 scripts/build_data.py ../OFLC_Wages_2026-27
npm run build:assets
npx playwright install firefox
npm run check
npm run package
```

`tests/core.test.cjs` tests source integrity, every wage threshold, ranges, currency filtering, units, structured data and geographic ambiguity. `tests/browser.cjs` exercises the content script in an isolated Firefox test browser with a stubbed extension message bridge, including desktop/mobile screenshots. `tests/extension-smoke.cjs` uses web-ext to install the actual extension in a disposable headless Firefox profile and checks live content injection, background messaging, packaged data and the displayed tier against a local synthetic job page. It defaults to `/Applications/Firefox.app/Contents/MacOS/firefox`; use `TEST_FIREFOX` to override the binary. Neither test uses or alters your personal Firefox profile. Extension manifest validation is a separate step.

See [TESTING.md](TESTING.md) for the current verification record and the
difference between unit, integration and actual add-on tests. Screenshots are
in the ignored `test-results/` folder. Tests do not prove universal ATS
compatibility. The optional `tests/greenhouse-live.cjs` check uses a public page;
override it with `TEST_JOB_URL` when the sample posting expires. It is not part
of deterministic CI and does not submit applications.

Use Node.js 24 LTS and Python 3.10+. The raw OFLC download is needed only to
regenerate the dataset, not to run the extension or standard test suite.
CI uses a disposable Playwright Firefox binary for its actual add-on test;
locally, `TEST_FIREFOX` can select your installed executable without using your
personal profile. See [CONTRIBUTING.md](CONTRIBUTING.md).

Source layout:

- `extension/`: loadable Firefox extension, with bundled data, icon assets and licenses.
- `website/`: Wage Atlas static site, occupation datasets, map builders & browser tests.
- `scripts/`: reproducible CSV transformation, Lucide asset generation and ZIP packaging.
- `tests/`: unit tests, synthetic job fixture and Firefox UI tests.
- `dist/`: unsigned distributable ZIP.

References: [DOL data downloads](https://flag.dol.gov/wage-data/wage-data-downloads), [DOL wage search](https://flag.dol.gov/wage-data/wage-search), [Firefox temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).
