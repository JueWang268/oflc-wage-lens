# Privacy

OFLC Wage Lens parses job-posting text and structured metadata locally to find
work locations and USD base-pay figures. Entered salary and location overrides
remain in the current tab's memory and reset on navigation or reload.

The extension does not send page content, salaries, locations, browsing history,
or application identifiers to a server. It has no telemetry, analytics,
accounts, remote AI, advertising or credential access.

The built-in update monitor requests the public DOL wage-download listing on
extension load when due, then daily while Firefox runs. Requests omit cookies,
credentials and referrers. DOL receives ordinary connection metadata, including
the IP address and browser request headers. No job-page URL or content is sent.
The monitor fetches listing HTML, not wage ZIPs, and never executes remote code.
Clicking the source link separately opens DOL in a tab under its privacy policy.

Only check timestamps, public release metadata, error status and the enabled
setting are stored locally. This state survives Firefox restarts; salary and
location overrides do not. Users can disable checks under **Detection & source**.
The wage calculations continue to use the packaged JSON whether checks are on,
off or temporarily failing. No Codex automation or account is involved.

## Permissions

- HTTP/HTTPS site access: detect postings across employer and ATS websites.
- `activeTab` and `scripting`: recover/show the panel when the toolbar is clicked,
  including tabs opened before the extension was loaded.
- `alarms`: schedule daily checks while Firefox is running.
- `storage`: remember the monitor setting, status and last attempt across restarts.

Automatic scans are skipped on recognized mail/webmail hosts and Jobright.
Manually clicking the toolbar can still parse the page currently open there.
This is a heuristic exclusion, not a comprehensive list of sensitive websites.
Use Firefox's site-access controls to restrict the extension as needed.

No form submission, application automation, cookie reading, or authentication is
performed. It does not read typed application answers or password fields. It
examines submission-button labels to help recognize a job page. Its own salary
and location input controls are read only to calculate the comparison.

The panel is a page overlay, not a browser security boundary. A hostile page may
remove or imitate it. Do not enter secrets in its fields or treat its output as
an official wage or immigration determination.
