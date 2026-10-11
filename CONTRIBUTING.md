# Contributing

Use Node.js 24 LTS and Python 3.10 or newer. The bundled data and icons allow
loading the extension without a build. For development:

```sh
npm ci
npx playwright install firefox
npm run build:assets
npm run check
npm run package
```

Linux may require `npx playwright install --with-deps firefox`. The actual add-on
smoke test defaults to the macOS Firefox application or `firefox` on other
platforms. Set `TEST_FIREFOX` to the absolute executable path when needed. Tests
use temporary profiles, never your everyday Firefox profile.

Add a regression test before fixing a parsing or lifecycle bug. Use synthetic
job data. Do not commit real application forms, email contents, resumes, cookies,
tokens, screenshots containing personal data, or the surrounding resume folder.
CI must run on this extension folder as the repository root.

Keep salary classification in core.js separate from DOM rendering and browser
messaging. Unknown locations/currencies/periods must not become invented values.
Do not add telemetry or network services without an explicit privacy review.

Generated icons.js embeds panel.css. Run `npm run build:assets` whenever CSS or
icon selection changes. Rebuild data using `scripts/build_data.py` only from the
specified OFLC source files; update validity dates and tests when changing years.

Review SECURITY.md before changing dependencies. Keep tests and manifest/package
versions consistent. Screenshots, node_modules and unsigned archives are ignored.
