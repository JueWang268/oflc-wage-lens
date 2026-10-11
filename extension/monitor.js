(function (root) {
  "use strict";
  const SOURCE = "https://flag.dol.gov/wage-data/wage-data-downloads";
  const KEY = "wageLensUpdateStatus";
  const ALARM = "wage-lens-update-check";
  const DAY = 24 * 60 * 60 * 1000;
  const BASELINE = {
    start: "2026-07-01", end: "2027-06-30", updated: "2026-07-01",
    url: "https://flag.dol.gov/sites/default/files/wages/OFLC_Wages_2026-27.zip"
  };
  function parseRecords(rows) {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const result = [];
    for (const row of rows) {
      const years = String(row.period).match(/^7\s*\/\s*(20\d{2})\s*[-\u2013\u2014]\s*6\s*\/\s*(20\d{2})$/);
      const date = String(row.updated).trim().match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})$/);
      if (!years || Number(years[2]) !== Number(years[1]) + 1 || !date) continue;
      const month = months.findIndex(m => m.toLowerCase() === date[1].toLowerCase());
      if (month < 0) continue;
      const updated = `${date[3]}-${String(month + 1).padStart(2,"0")}-${date[2].padStart(2,"0")}`;
      const timestamp = Date.parse(updated);
      if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0,10) !== updated) continue;
      let url;
      try { url = new URL(row.url, SOURCE); } catch { continue; }
      if (url.protocol !== "https:" || url.hostname !== "flag.dol.gov" || url.port || url.username || url.password || !url.pathname.endsWith(".zip")) continue;
      url.hash = "";
      result.push({start: `${years[1]}-07-01`, end: `${years[2]}-06-30`, updated, url: url.href});
    }
    if (!result.length) throw new Error("The DOL download listing format was not recognized.");
    return result.sort((a,b) => b.start.localeCompare(a.start) || b.updated.localeCompare(a.updated));
  }
  function parseHTML(html) {
    // Detached document: never append remote HTML to the extension or a job page.
    const doc = new DOMParser().parseFromString(html, "text/html");
    return parseRecords([...doc.querySelectorAll("table tr")].map(row => {
      const cells = row.querySelectorAll("td");
      return {period: cells[0]?.textContent.trim(), updated: cells[1]?.textContent.trim(), url: cells[2]?.querySelector("a[href]")?.getAttribute("href")};
    }));
  }
  function assess(records, today, baseline = BASELINE) {
    const latest = records[0];
    if (!latest || latest.start < baseline.start || (latest.start === baseline.start && latest.updated < baseline.updated)) {
      throw new Error("DOL listing predates the bundled release; current status is unverified.");
    }
    const changed = latest.start > baseline.start || latest.updated > baseline.updated || latest.url !== baseline.url;
    return {kind: changed ? latest.start > today ? "future" : "update" : "current", changed, release: latest};
  }
  async function readPage(response) {
    if (!response.ok) throw new Error(`DOL request failed (${response.status}).`);
    if (!/text\/html/i.test(response.headers.get("content-type") || "")) throw new Error("DOL did not return an HTML download listing.");
    const max = 1024 * 1024;
    if (Number(response.headers.get("content-length")) > max) throw new Error("DOL listing exceeds the size limit.");
    if (!response.body) throw new Error("DOL returned an empty response.");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let size = 0, text = "";
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) { await reader.cancel(); throw new Error("DOL listing exceeds the size limit."); }
        text += decoder.decode(value, {stream:true});
      }
      return text + decoder.decode();
    } finally { reader.releaseLock(); }
  }
  function baselineFromMeta(meta) {
    const release = meta?.sourceRelease;
    if (release && release.start === meta.validFrom && release.end === meta.validThrough) {
      const row = {period:`7/${release.start.slice(0,4)} - 6/${release.end.slice(0,4)}`,updated:new Date(release.updated).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"}),url:release.url};
      const parsed = parseRecords([row])[0];
      if (parsed.updated !== release.updated) throw new Error("Invalid bundled release date.");
      return parsed;
    }
    if (!release && meta?.validFrom === BASELINE.start && meta?.validThrough === BASELINE.end) return BASELINE;
    throw new Error("Bundled dataset is missing matching official release metadata.");
  }
  function create(browser, {fetcher = fetch, parse = parseHTML, now = Date.now, getBaseline = async () => BASELINE} = {}) {
    let pending;
    const getStatus = async () => ({enabled:true, kind:"pending", ...((await browser.storage.local.get(KEY))[KEY] || {})});
    async function display(state) {
      await browser.action.setBadgeText({text:state.enabled === false ? "" : state.changed ? "NEW" : state.kind === "error" ? "!" : ""});
      await browser.action.setBadgeBackgroundColor({color:state.kind === "error" ? "#8a5b13" : "#176b4b"});
    }
    function check(force = false) {
      if (pending) return pending;
      pending = (async () => {
        let state = await getStatus();
        let baseline;
        try { baseline = await getBaseline(); }
        catch {
          state = {...state, kind:"error", error:"Bundled release metadata could not be verified."};
          await browser.storage.local.set({[KEY]:state}); await display(state); return state;
        }
        const baselineKey = JSON.stringify(baseline);
        if (state.baselineKey !== baselineKey) state = {enabled:state.enabled, kind:"pending", baselineKey};
        const time = now();
        const age = time - state.lastAttempt;
        if (!state.enabled || (Number.isFinite(age) && age >= 0 && age < (force ? 60000 : DAY))) {
          await display(state); return state;
        }
        state = {...state, lastAttempt:time};
        // Persist before fetching so background restarts cannot hammer the endpoint.
        await browser.storage.local.set({[KEY]:state});
        try {
          const response = await fetcher(SOURCE, {credentials:"omit", referrerPolicy:"no-referrer", cache:"no-store", redirect:"error", signal:AbortSignal.timeout(15000)});
          const records = parse(await readPage(response));
          state = {...state, ...assess(records, new Date(time).toISOString().slice(0,10), baseline), lastSuccess:time, error:null};
        } catch (error) {
          state = {...state, kind:"error", error:String(error.message || "Update check failed.").slice(0,240)};
        }
        await browser.storage.local.set({[KEY]:state});
        await display(state);
        return state;
      })().finally(() => { pending = undefined; });
      return pending;
    }
    async function setEnabled(enabled) {
      // Serialize setting changes with a fetch so an in-flight write cannot re-enable it.
      if (pending) await pending;
      const state = {...await getStatus(), enabled:!!enabled};
      await browser.storage.local.set({[KEY]:state});
      if (!enabled) await browser.alarms.clear(ALARM);
      else await browser.alarms.create(ALARM, {delayInMinutes:1440, periodInMinutes:1440});
      await display(state);
      return enabled ? check() : state;
    }
    async function start() {
      // Firefox alarms do not survive a browser restart.
      browser.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === ALARM) check().catch(error => console.warn("OFLC monitor:", error.message));
      });
      const state = await getStatus();
      if (state.enabled && !await browser.alarms.get(ALARM)) {
        await browser.alarms.create(ALARM, {delayInMinutes:1440, periodInMinutes:1440});
      }
      return check();
    }
    return {getStatus, check, setEnabled, start};
  }
  const api = {SOURCE, KEY, ALARM, DAY, BASELINE, parseRecords, parseHTML, assess, readPage, baselineFromMeta, create};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.WageLensMonitor = api;
})(globalThis);
