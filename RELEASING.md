# Release checklist

## Before making the repository public

- [x] Project code has an MIT LICENSE; preserve third-party notices separately.
- [ ] Publish only this extension directory, not its parent resume directory.
- [ ] Review source and git history for secrets, personal documents and private
      screenshots. There is no existing Git repository in the delivered folder.
- [ ] Set up GitHub private vulnerability reporting and branch protections.
- [ ] Run CI on GitHub. The workflow has been written but has not run remotely.

## Before a user-facing release

- [ ] Review the known development advisory in SECURITY.md and any new findings.
- [ ] Run `npm ci`, `npm run build:assets`, `npm run check`, and both production
      and full `npm audit` checks. Inspect desktop/mobile screenshots.
- [ ] Confirm the wage year and source hashes; the current dataset expires
      June 30, 2027. Rebuild from official CSVs if the data is updated.
- [ ] Use the explicit release arguments in UPDATING_DATA.md when rebuilding.
      Verify the generated sourceRelease metadata and maintain monitor fixtures.
      The legacy monitor fallback is only for the original 2026-27 JSON.
- [ ] Match package.json and manifest.json versions. Run `npm run package`.
- [ ] Smoke-test representative live ATS pages manually, including a page with
      multiple locations and a remote role. Live pages are not stable CI fixtures.
- [ ] Review site-access permission prompts and the privacy policy.
- [ ] Submit the ZIP to Mozilla for listed or unlisted signing. Keep generated
      source and build instructions available for review. Distribute the signed
      XPI for persistent Firefox installation, not the unsigned development ZIP.

This is a desktop Firefox release candidate, not a certified immigration tool.
It has not been published to GitHub or submitted to Mozilla by this audit.
