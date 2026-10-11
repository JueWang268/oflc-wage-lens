# Verification record

## Red freshness warning, version 1.2.0

- 58 Node tests cover expiry date boundaries, disabled checks, stale verification,
  future-effective releases, generated monitor metadata and cache invalidation.
- 8 Python tests cover package safety and manual rebuild argument validation.
- Firefox UI tests verify the top warning survives content scrolling, remains
  visible when checks are disabled, and fits desktop/mobile and short viewports.
- Data rebuilds now accept explicit wage-year, publication-date and official ZIP
  URL arguments; the original no-argument build preserves its legacy metadata.
- MIT licensing and manual update instructions are included with the release.

## Built-in monitor, version 1.1.0

- 50 Node tests now include official-link validation, malformed listing dates,
  revised/future releases, response size/type limits, request deduplication,
  restart-persistent throttling, daily alarms, opt-out and offline/error states.
- Firefox parser tests confirm detached HTML does not execute embedded scripts
  or load image/iframe URLs. The downloaded official DOL page was parsed on
  October 11, 2026 and matched the bundled 2026-27 release metadata.
- Browser integration tests exercise update notices, storage change delivery,
  automatic-check opt-out and re-enabling, alongside the prior UI regressions.
- Actual Firefox add-on tests now stub only the DOL HTTP response in a temporary
  source copy. Production monitor parsing, scheduling, storage, background
  messaging and UI run together. This keeps CI independent of live DOL uptime.
  The injected test network shim is never included in the release ZIP.
- `npm run test:monitor-browser` runs the parser test. `TEST_DOL_HTML` can point
  to a downloaded official page for an additional live-format check.
- `TEST_LIVE_DOL=1 npm run test:extension` optionally checks the real DOL request
  from the installed add-on. This is not part of deterministic CI; it expects
  the current listing to match the bundled baseline and may fail after updates.
  This live check passed on October 11, 2026 in an isolated Firefox profile.
- No Codex automation is needed. The previous local automation is paused.

## October 11, 2026 release audit

Tests run in an isolated staging copy, with disposable Firefox profiles. No
personal browser tabs or profiles are used. Synthetic fixtures avoid submitting
applications or relying on private job/email content.

- **Unit tests:** 39 Node tests. These exercise functions independently: salary
  parsing, all 2,120 boundaries across 530 areas, geography, job-page detection,
  and mocked background messaging. New regression cases initially exposed five
  failures: null structured metadata, invalid structured salaries, inline bonus
  leakage, numeric truncation and annual-conversion overflow. All were fixed.
- **Packaging integration:** 5 Python tests. These build real ZIPs in temporary
  folders and verify deterministic bytes, asset allowlisting, version agreement,
  missing-file failures and symlink rejection.
- **Browser integration:** Firefox runs the real content/core/icon scripts
  against synthetic pages with a stubbed data-message bridge. Coverage includes
  desktop/mobile layout, spectrum/threshold rendering, SPA transitions, document
  replacement, dismissal/reopening, remote and multiple-location choices,
  malformed metadata, literal rendering of hostile HTML-like text, invalid
  manual amounts, duplicate injection, and data-load failure/retry. Page errors
  and non-navigation network requests must both remain empty.
- **End-to-end smoke:** web-ext installs the actual add-on in a temporary desktop
  Firefox profile. A localhost fixture verifies manifest loading, script
  injection, background data fetching/messaging and the expected Tier II-III
  result, spectrum and four-row table.
- **Mozilla validation:** web-ext lint, with warnings treated as errors.
- **Data reproducibility:** rebuilt from the original OFLC CSVs; output matches
  the bundled JSON byte for byte (530 areas, 4,528 location aliases).
- **Dependency audit:** production dependency audit clean; one unpatched
  development-only node-forge advisory remains, reported across three packages.
  Details and scope are in SECURITY.md. npm audit is not a security proof.

Commands: `npm test`, `npm run test:package`, `npm run test:browser`,
`npm run test:extension`, `npm run lint:extension`, `npm run package`.
`npm run check` chains the test/validation commands. GitHub Actions is
configured but has not yet run remotely. The live Greenhouse check below is a
historical result, not a new October 11 live-site validation.

## October 6, 2026 baseline

Tested October 6, 2026 on macOS with an isolated Firefox 153 test build.

- Unit tests: 28 passing, including inclusive/exclusive cents at all 2,120 level thresholds across 530 areas, spectrum geometry, toolbar behavior and page classification.
- Automatic detection: synthetic Gmail and Jobright URLs with convincing job content remain hidden; multiple structured jobs require manual opening; same-URL transitions to recommendation feeds hide the panel; generic loading grace expires and the identical original posting can reopen afterward.
- Lifecycle regression: removal of the panel, whole document-element replacement, body replacement, temporary loading states, same-task toolbar recovery, intentional dismissal, and navigation away from a recognized job.
- Public Greenhouse check: T2 Systems job 4675527006 in isolated Firefox with a stubbed extension data bridge. Reproduced document replacement detaching the original panel; after the fix, the panel remains visible through loading and toolbar hide/reopen works. No applications or account actions performed. Script: `tests/greenhouse-live.cjs` (requires network).
- Spectrum UI: single arrow, range bracket, both-end overflow, fully out-of-scale range, hourly/yearly position stability and open-ended floor. Selected locations always show the spectrum and four-row table, without a marker for missing/invalid pay; unresolved locations hide the chart. Desktop, mobile, single-pay, overflow, remote and location-only screenshots visually reviewed.
- Simplified panel: location is the first field, notes stay collapsed, first detected location/pay are selected by default, and manual dropdown selections survive DOM updates.
- Input cases: annual/hourly/monthly/weekly pay, salary ranges and k shorthand, bonus/foreign-currency exclusion, invalid and missing wages, suppressed-level handling, below-I/above-IV, O*NET crosswalk, counties, states and city aliases.
- Browser tests: desktop (1440x1000), narrow viewport (390x844), manual salary/location input, period toggling without threshold drift, source details, structured data precedence, multiple job records, remote worksite selection, multiple locations, DOM mutation, SPA URL changes, collapse, dismiss and toolbar-message reopening.
- Actual add-on: web-ext installed the extension in a temporary headless Firefox profile; a localhost fixture confirmed content injection, bundled-data messaging and `Tier II to III` for $120,000-$150,000 in Travis County, TX.
- Mozilla web-ext lint: 0 errors, 0 notices, 0 warnings.
- Source CSVs were read only. Generated JSON includes SHA-256 hashes.
- Personal Firefox profiles, open tabs, accounts and browser security preferences were not changed.

Limitations: only the downloaded all-industries Software Developer occupation is included; no national city geocoder; no cross-origin frame access; heuristic salary extraction needs human review; manually confirm that a region-specific pay range belongs to the selected location. Temporary installation does not survive Firefox restarts, and the distributed ZIP is unsigned.
