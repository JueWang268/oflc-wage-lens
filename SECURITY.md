# Security

## Reporting

Once hosted on GitHub, enable **Settings > Security > Private vulnerability
reporting**. Report suspected vulnerabilities privately through that feature;
do not include credentials, application details, resumes, or private page content
in public issues. Until private reporting is enabled, contact the maintainer
through an existing private channel rather than posting exploit details publicly.

## Threat model

- Job pages and JSON-LD are untrusted. Extracted text uses `textContent`, never
  executable HTML. The one `innerHTML` assignment builds static extension UI.
- No remote code, network inference, telemetry, or page-to-background external
  messaging API is included. Runtime fetches read packaged wage JSON and the
  fixed HTTPS DOL listing URL. The latter omits credentials/referrers, rejects
  redirects, limits response size/time and never replaces executable code or
  wage data. Listing HTML remains detached; embedded resources must not load.
- Shadow DOM isolates styles, not malicious host pages. The panel is advisory.
- Salary/location extraction is heuristic and can be wrong. Users must confirm
  the evidence and actual worksite; compensation alone does not assign a legal
  prevailing-wage level.
- Packaging allowlists runtime files and rejects symlinked assets, rather than
  recursively distributing every file a developer leaves in the source folder.
- The monitor detects published listing changes, not the integrity of remote
  CSVs. Maintainers must validate downloaded data and test before a new release.

## Dependency audit: October 11, 2026

The installed development tree was updated to `web-ext` 10.7.0 and `sharp`
0.35.5. A scoped override sets `fx-runner`'s `shell-quote` to 1.12.0 to address
GHSA-pqg4-j6r4-53mv. Desktop smoke tests pass with this override.

One unpatched upstream advisory remains:
[GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), affecting
`node-forge` through `web-ext -> @devicefarmer/adbkit`. npm reports three high
dependency findings from that single advisory. The registry's latest node-forge
version was 1.4.0 at audit time, still affected. Do not blindly use
`npm audit fix --force`: its proposed web-ext downgrade is not an appropriate
resolution for the current manifest/toolchain.

This dependency belongs to development-time Android device support. It is not
shipped in the extension ZIP, and this project tests desktop Firefox only. This
does not prove the development dependency is harmless in all contexts. Avoid
Android/ADB testing with untrusted devices and revisit the advisory before each
release. `npm audit --omit=dev` checks the production dependency graph separately;
it does not erase this known development risk.

CI blocks production dependency findings. The full development audit remains
visible as a non-blocking step while this upstream issue is unresolved. Review
all new findings manually; do not treat a green workflow as a clean full audit.
