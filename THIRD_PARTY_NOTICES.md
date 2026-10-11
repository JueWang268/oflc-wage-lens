# Third-party notices

## Runtime assets

- Lucide 1.8.0 supplies the icon geometry. The exact Lucide/Feather ISC and MIT
  notices are retained in `extension/LUCIDE-LICENSE.txt` and in the packaged ZIP.
  Source: https://github.com/lucide-icons/lucide/tree/1.8.0
- OFLC wage/geography data is derived from the U.S. Department of Labor's
  2026-27 all-industries download, not the ACWIA higher-education dataset.
  Source: https://flag.dol.gov/wage-data/wage-data-downloads
  The generated JSON retains the three original CSV SHA-256 hashes, wage-year
  validity dates, occupation and geography source codes. It is not live data.

The project's MIT code license does not replace third-party
notices or imply DOL affiliation, approval, or a legal wage determination.

## Development tools

Playwright, web-ext, Lucide and sharp are npm development dependencies.
Their dependency trees and integrity hashes are recorded in package-lock.json;
their package licenses remain applicable. Node modules are not distributed in
the extension ZIP. sharp rasterizes icons; Playwright and web-ext run tests and
validation. No JavaScript framework runtime is bundled beyond the generated
Lucide icon geometry.
