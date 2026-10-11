# Update wage data from source

OFLC Wage Lens is open-source software under the MIT license. Users can rebuild
their own extension without Codex or a maintainer account. The browser cannot
write into an installed extension's source folder: these are local developer
steps. An installed signed add-on should normally be updated through a new
signed release, not by modifying its installation directory.

## Download and extract

1. Open https://flag.dol.gov/wage-data/wage-data-downloads and identify the
   currently effective wage year and its published revision date.
2. Download that official ZIP into this project's `raw-data/` folder. Extract
   it into a year-specific subfolder, such as `raw-data/OFLC_Wages_2026-27/`.
3. Locate `ALC_Export.csv`, `Geography.csv` and `xwalk_plus.csv`. Supply the folder
   that directly contains those files. Use all-industries ALC, not EDC/ACWIA.
4. Retain a backup of `extension/data/software-developers.json`. Do not activate
   a future-effective release before its start date.

## Build and reload

From the project root, use Python 3.10+ to run the following. This is an example
for the existing 2026-27 release. For a new year or correction, replace the source
folder, starting year, revision date and exact ZIP URL with the values shown by
DOL. Do not simply change the dates on old data to clear a warning.

```sh
python3 scripts/build_data.py raw-data/OFLC_Wages_2026-27 \
  --wage-year 2026 \
  --published-on 2026-07-01 \
  --download-url https://flag.dol.gov/sites/default/files/wages/OFLC_Wages_2026-27.zip
```

The builder checks occupation, geography joins and wage thresholds, records
source hashes, and generates `extension/data/software-developers.json`. The
extension reads the effective dates, displayed wage year and monitor baseline
from that generated metadata. If building fails, keep the prior dataset; do not
disable validation. Review changes in area counts and wages against official
source rows. A successful build alone does not prove every source value correct.

For a locally loaded extension, open `about:debugging#/runtime/this-firefox`,
click **Reload** for OFLC Wage Lens, then refresh job tabs. Check the displayed
wage year and the four wage thresholds for a known county against DOL. Reloading
forces a new listing check when the bundled release metadata changes. The red
warning clears only when expiry/update/freshness conditions are resolved.

## Before distributing a release

Run `npm ci`, `npm run build:assets` and `npm run check`. The existing tests
contain specific 2026-27 example wages and counts; for a new wage year, maintain
those expectations using independently verified official source rows. Never
delete failing tests simply to make a changed dataset pass. Update README source
dates and the manifest/package version, then run `npm run package`.

See RELEASING.md for GitHub publication and Mozilla signing. The extension never
downloads ZIPs or installs wage tables automatically. The red warning prompts
verification and a manual update, not a claim that old calculations are current.
