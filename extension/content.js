(() => {
  "use strict";
  if (globalThis.__wageLensLoaded) return;
  globalThis.__wageLensLoaded = true;
  const C = globalThis.WageLensCore;
  const A = globalThis.WageLensAssets;
  let host, root, data, index, scanTimer, hiddenByUser = false;
  let lastURL = location.href, signature = "", selectedLocation = null, salaries = [], detected = [];
  let min = null, max = null, unit = "year", manualSalary = false, manualLocation = false, openEnded = false;
  let jobChoice = 0, forceOpen = false, salaryChosen = false, recognizedJob = false;
  let lastDetailAt = 0, loadingTimer;
  let updateState = {}, lastWarningMinute = 0;
  const $ = id => root.getElementById(id);
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, val] of Object.entries({viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", "stroke-width":"2", "stroke-linecap":"round", "stroke-linejoin":"round", "aria-hidden":"true"})) svg.setAttribute(key, val);
    for (const [tag, attrs] of A.icons[name]) {
      const e = document.createElementNS(svg.namespaceURI, tag);
      Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v)); svg.append(e);
    }
    return svg;
  }
  function option(value, label) { const e = document.createElement("option"); e.value = String(value); e.textContent = label; return e; }
  function create() {
    if (host?.isConnected) return;
    // Hydration can replace the document element. Reattach the existing UI and state.
    if (host) { document.documentElement.append(host); return; }
    host = document.createElement("oflc-wage-lens");
    root = host.attachShadow({mode: "open"});
    const style = document.createElement("style"); style.textContent = A.css; root.append(style);
    const panel = document.createElement("section"); panel.className = "panel"; panel.setAttribute("aria-label", "OFLC wage benchmark");
    // Only this constant markup is parsed as HTML. Page-derived data uses textContent.
    panel.innerHTML = `
      <header><span class="brand" id="brand"></span><strong>OFLC Wage Lens</strong>
        <button class="icon" id="refresh" title="Rescan posting" aria-label="Rescan posting"></button>
        <button class="icon" id="minimize" title="Minimize panel" aria-label="Minimize panel" aria-expanded="true"></button>
        <button class="icon" id="close" title="Hide panel" aria-label="Hide panel"></button></header>
      <div class="body" id="body">
        <label for="locations">Work location</label><select id="locations"></select>
        <div id="jobs-wrap" hidden><label for="jobs">Job posting</label><select id="jobs"></select></div>
        <label for="location-search">City, county or wage area</label>
        <input id="location-search" type="search" placeholder="e.g. Travis County, TX" autocomplete="off" maxlength="120">
        <div id="search-results" class="search-results" hidden></div>
        <div id="salary-wrap"><label for="salaries">Detected base pay</label><select id="salaries"></select></div>
        <div class="row"><span class="field-label">Salary · USD</span><div class="segments" role="group" aria-label="Salary period"><button id="year" aria-pressed="true">Yearly</button><button id="hour" aria-pressed="false">Hourly</button></div></div>
        <div class="amounts"><div><label for="minimum">Minimum / amount</label><input id="minimum" inputmode="decimal" placeholder="120000" autocomplete="off"></div><div><label for="maximum">Maximum (optional)</label><input id="maximum" inputmode="decimal" placeholder="Same as minimum" autocomplete="off"></div></div>
        <div class="subtle" id="conversion">40 hours/week × 52 weeks = 2,080 hours/year</div>
        <div class="result" aria-live="polite" aria-atomic="true" hidden><div class="result-title" id="tier" hidden></div>
          <div id="spectrum" class="spectrum" role="img" hidden>
            <div id="spectrum-pay" class="spectrum-pay" aria-hidden="true"></div>
            <div class="spectrum-plot" aria-hidden="true">
              <div id="pay-band" class="pay-band" hidden></div>
              <span id="pay-start" class="pay-pointer"></span><span id="pay-end" class="pay-pointer" hidden></span>
              <div class="spectrum-track"></div><div id="spectrum-ticks"></div>
            </div>
            <div class="spectrum-bounds" aria-hidden="true"><span id="bound-min"></span><span id="bound-max"></span></div>
            <div id="spectrum-overflow" class="spectrum-overflow" hidden></div>
          </div>
          <table id="thresholds" hidden><thead><tr><th>Level</th><th>Hourly</th><th>Annual</th></tr></thead><tbody id="levels"></tbody></table>
        </div>
        <details><summary>Detection & source</summary><div class="meta"><span>Software Developers · 15-1252.00</span><span>2026-27</span></div><div class="notice" id="status" role="status" hidden></div><div class="notice" id="warning" hidden></div><p class="summary" id="summary"></p><div class="area" id="area"></div><div id="evidence" class="evidence"></div><p id="geo"></p><p id="metadata"></p><a href="https://flag.dol.gov/wage-data/wage-data-downloads" target="_blank" rel="noopener noreferrer">U.S. Department of Labor wage data</a></details>
        <div class="caution">Salary comparison only, not an official prevailing-wage determination, visa eligibility or sponsorship assessment. Job requirements also matter. Bonus & equity are excluded.</div>
      </div>`;
    root.append(panel); document.documentElement.append(host);
    const updateNotice = document.createElement("div");
    updateNotice.id = "update-notice"; updateNotice.className = "update-banner"; updateNotice.hidden = true;
    updateNotice.setAttribute("role", "status");
    panel.querySelector("header").after(updateNotice);
    const controls = document.createElement("div"); controls.className = "update-controls";
    const updateLabel = document.createElement("label"); updateLabel.htmlFor = "update-enabled";
    const enabled = document.createElement("input"); enabled.type = "checkbox"; enabled.id = "update-enabled"; enabled.checked = true;
    updateLabel.append(enabled, "Check DOL automatically");
    const check = document.createElement("button"); check.className = "icon"; check.id = "update-check";
    check.title = "Check DOL for updates"; check.setAttribute("aria-label", check.title); check.append(icon("RefreshCw"));
    const updateStatus = document.createElement("p"); updateStatus.id = "update-status"; updateStatus.setAttribute("role", "status");
    controls.append(updateLabel, check);
    root.querySelector("details").append(controls, updateStatus);
    enabled.onchange = () => refreshUpdates("wage-lens-update-enabled", {enabled:enabled.checked});
    check.onclick = () => refreshUpdates("wage-lens-update-check");
    refreshUpdates();
    root.addEventListener("keydown", event => { if (event.key === "Escape") { host.hidden = true; hiddenByUser = true; } });
    $("brand").append(icon("ChartNoAxesColumnIncreasing"));
    $("refresh").append(icon("RefreshCw")); $("minimize").append(icon("Minus")); $("close").append(icon("X"));
    $("close").onclick = () => { host.hidden = true; hiddenByUser = true; };
    $("minimize").onclick = () => {
      $("body").hidden = !$("body").hidden; panel.classList.toggle("minimized", $("body").hidden);
      $("minimize").replaceChildren(icon($("body").hidden ? "ChevronDown" : "Minus"));
      $("minimize").setAttribute("aria-expanded", String(!$("body").hidden));
      $("minimize").setAttribute("aria-label", $("body").hidden ? "Expand panel" : "Minimize panel");
    };
    $("refresh").onclick = () => { salaryChosen = manualSalary = manualLocation = false; signature = ""; scan(true); };
    $("jobs").onchange = () => { jobChoice = Number($("jobs").value); salaryChosen = manualSalary = manualLocation = false; signature = ""; scan(true); };
    $("locations").onchange = () => { selectedLocation = $("locations").value === "" ? null : detected[Number($("locations").value)] || null; manualLocation = true; render(); };
    $("salaries").onchange = () => { chooseSalary($("salaries").value === "" ? -1 : Number($("salaries").value)); salaryChosen = true; render(); };
    $("location-search").oninput = () => {
      if (!data) return;
      const results = C.searchLocations($("location-search").value, data);
      const list = $("search-results"); list.replaceChildren(); list.hidden = !$("location-search").value.trim();
      if (!results.length) { const text = document.createElement("div"); text.textContent = "No match. Try a county & state."; list.append(text); }
      for (const loc of results) {
        const b = document.createElement("button"); b.type = "button"; b.textContent = loc.label;
        const small = document.createElement("small"); small.textContent = data.areas[loc.area].name; b.append(small);
        b.onclick = () => { selectedLocation = loc; manualLocation = true; list.hidden = true; $("location-search").value = ""; populateLocations(); render(); };
        list.append(b);
      }
    };
    for (const period of ["year", "hour"]) $(period).onclick = () => { unit = period; fillInputs(); render(); };
    for (const id of ["minimum", "maximum"]) $(id).oninput = () => { manualSalary = true; openEnded = false; readInputs(); render(); };
  }
  function showUpdate(state) {
    if (!root || !state?.kind) return;
    updateState = state;
    $("update-enabled").checked = state.enabled !== false;
    const stamp = state.lastSuccess ? ` Last verified ${new Date(state.lastSuccess).toLocaleDateString()}.` : "";
    const message = state.enabled === false ? "Automatic DOL checks are off." : state.kind === "error" ? "DOL update check failed. Bundled data is unchanged." : state.kind === "future" ? `DOL has published a future wage release effective ${state.release.start}.` : state.changed ? "DOL has a new or revised wage release. Bundled data is unchanged." : state.kind === "current" ? "No newer release found in the DOL listing." : "DOL update check pending.";
    $("update-status").textContent = message + stamp;
    $("update-check").disabled = state.enabled === false;
    renderUpdateWarning();
  }
  function renderUpdateWarning() {
    if (!root) return;
    const warning = C.freshnessWarning(data?.meta, updateState);
    const notice = $("update-notice"); notice.hidden = !warning;
    if (!warning) { notice.replaceChildren(); return; }
    notice.dataset.severity = warning.severity;
    const title = document.createElement("strong"); title.textContent = warning.title;
    const reason = document.createElement("p"); reason.textContent = warning.reason;
    const instruction = document.createElement("p");
    const link = document.createElement("a"); link.href = "https://flag.dol.gov/wage-data/wage-data-downloads";
    link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Download official wage files";
    instruction.append(link, " into this project's raw-data/ folder. Follow UPDATING_DATA.md to rebuild & reload; copying the ZIP alone does not update wages.");
    notice.replaceChildren(title, reason, instruction);
  }
  async function refreshUpdates(type = "wage-lens-update-status", extra = {}) {
    try { showUpdate(await browser.runtime.sendMessage({type, ...extra})); }
    catch { showUpdate({...updateState, kind:"error"}); }
  }
  function readInputs() {
    const parse = value => /^\s*\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*$/.test(value) ? Number(value.replace(/[$,\s]/g, "")) : null;
    min = C.annual(parse($("minimum").value), unit);
    max = $("maximum").value.trim() ? C.annual(parse($("maximum").value), unit) : min;
  }
  function fillInputs() {
    const format = n => n == null ? "" : String(Math.round(n / (unit === "hour" ? C.HOURS : 1) * 100) / 100);
    $("minimum").value = format(min); $("maximum").value = max === min ? "" : format(max);
    for (const period of ["year", "hour"]) $(period).setAttribute("aria-pressed", String(unit === period));
  }
  function chooseSalary(i) {
    const s = salaries[i]; min = s?.min ?? null; max = s?.max ?? null; openEnded = !!s?.openEnded; manualSalary = false;
    unit = s?.unit === "hour" ? "hour" : "year"; fillInputs();
  }
  function populateLocations() {
    const sel = $("locations"); sel.replaceChildren(option("", "Choose work location"));
    let list = [...detected];
    if (selectedLocation && !list.some(l => l.label === selectedLocation.label && l.area === selectedLocation.area)) list.push(selectedLocation);
    detected = list;
    list.forEach((l, i) => sel.append(option(i, `${l.label}${list.filter(x => x.label === l.label).length > 1 ? " · " + data.areas[l.area].name : ""}`)));
    const i = list.findIndex(l => selectedLocation && l.label === selectedLocation.label && l.area === selectedLocation.area);
    sel.value = i < 0 ? "" : String(i);
  }
  function render() {
    if (!data) return;
    renderUpdateWarning();
    root.querySelector(".meta span:last-child").textContent = data.meta.wageYear;
    const area = selectedLocation && data.areas[selectedLocation.area];
    const valid = min > 0 && max >= min && max <= 10000000;
    const low = valid ? C.classify(min, area) : null, high = valid ? C.classify(max, area) : null;
    const pay = n => C.money(n / (unit === "hour" ? C.HOURS : 1), unit === "hour") + (unit === "hour" ? "/hr" : "/yr");
    root.querySelector(".result").hidden = !area;
    $("tier").hidden = low == null;
    $("tier").textContent = low == null ? "" : low === high ? low === 0 ? "Below Level I" : `Tier ${C.roman[low]}${openEnded ? "+" : ""}` : `${low === 0 ? "Below I" : "Tier " + C.roman[low]} to ${C.roman[high]}`;
    $("summary").textContent = low == null ? "" : `${min === max ? pay(min) + (openEnded ? "+" : "") : pay(min) + " to " + pay(max)} ${min === max ? "meets" : "spans"} ${low === high ? low === 0 ? "no OFLC level threshold" : "the Level " + C.roman[low] + " threshold" : (low === 0 ? "below Level I" : "Level " + C.roman[low]) + " through Level " + C.roman[high]} in ${selectedLocation.label}.`;
    $("area").textContent = area ? `${area.name} · ${selectedLocation.kind === "county" ? "County matched" : "Wage-area match; county not inferred"}` : "";
    const hasPay = low != null;
    const chart = area ? C.spectrum(hasPay ? min : area.levels[0] * C.HOURS, hasPay ? max : area.levels[3] * C.HOURS, area) : null;
    $("spectrum").hidden = !chart;
    if (chart) {
      const range = hasPay && max > min;
      const label = hasPay ? `${manualSalary ? "Entered pay" : range ? "Posted range" : openEnded ? "Posted floor" : "Posted pay"}: ${pay(min)}${range ? " to " + pay(max) : openEnded ? "+" : ""}` : "";
      $("spectrum-pay").textContent = label;
      $("spectrum-pay").hidden = !hasPay;
      $("bound-min").textContent = pay(area.levels[0] * C.HOURS);
      $("bound-max").textContent = pay(area.levels[3] * C.HOURS);
      $("spectrum-ticks").replaceChildren();
      chart.ticks.forEach((position, i) => {
        const tick = document.createElement("span"); tick.className = "spectrum-tick";
        tick.style.left = position + "%"; tick.textContent = `Level ${C.roman[i + 1]}`;
        const label = document.createElement("span"); label.className = "spectrum-level";
        label.style.left = position + "%"; label.textContent = tick.textContent;
        // Exact values remain in the table if adjacent ticks are too close to label.
        label.hidden = i > 0 && i < 3 && (position - chart.ticks[i - 1] < 18 || chart.ticks[i + 1] - position < 18);
        tick.textContent = ""; $("spectrum-ticks").append(tick, label);
      });
      $("pay-band").hidden = !range || chart.left === chart.right;
      $("pay-band").style.left = chart.left + "%";
      $("pay-band").style.width = (chart.right - chart.left) + "%";
      $("pay-start").style.left = chart.left + "%";
      $("pay-start").hidden = !hasPay;
      $("pay-end").style.left = chart.right + "%";
      $("pay-start").replaceChildren(icon(chart.below ? "ArrowLeft" : chart.left === 100 && chart.above ? "ArrowRight" : "ArrowDown"));
      $("pay-end").replaceChildren(icon(chart.above ? "ArrowRight" : chart.right === 0 && chart.below ? "ArrowLeft" : "ArrowDown"));
      $("pay-end").hidden = !range || chart.left === chart.right;
      const overflow = [chart.below ? "Pay extends below Level I" : "", chart.above ? "Pay extends above Level IV" : "", hasPay && openEnded ? "Floor only; upper pay unspecified" : ""].filter(Boolean).join(". ");
      $("spectrum-overflow").hidden = !overflow; $("spectrum-overflow").textContent = overflow;
      $("spectrum").setAttribute("aria-label", `${label}. Level I: ${pay(area.levels[0] * C.HOURS)}. Level IV: ${pay(area.levels[3] * C.HOURS)}. ${overflow}`);
    }
    $("thresholds").hidden = !area;
    $("levels").replaceChildren();
    if (area) area.levels.forEach((w, i) => {
      const tr = document.createElement("tr");
      if (low != null && low >= i + 1) tr.className = "reached";
      else if (high != null && high >= i + 1) tr.className = "partial";
      [C.roman[i+1], w ? C.money(w, true) : "Unavailable", w ? C.money(w*C.HOURS, true).replace(/\.00$/, "") : "Unavailable"].forEach(v => {const td=document.createElement("td");td.textContent=v;tr.append(td);});
      $("levels").append(tr);
    });
    const notices = [];
    const s = $("salaries").value === "" ? null : salaries[Number($("salaries").value)];
    if (!manualSalary && s?.inferred) notices.push("Annual pay inferred from salary context. Confirm the period.");
    if (openEnded) notices.push("Open-ended pay: only the stated floor is classified.");
    if (detected.length > 1 || salaries.length > 1) notices.push("Multiple locations or pay figures: confirm this salary applies to the selected worksite.");
    if (area && low == null && valid) notices.push("Missing or suppressed wage levels. No tier assigned.");
    if (new Date().toISOString().slice(0,10) > data.meta.validThrough) notices.push("This wage year has expired. Update the dataset.");
    $("warning").hidden = !notices.length; $("warning").textContent = notices.join(" ");
    $("evidence").textContent = `${manualSalary ? "Manual salary" : s ? s.source + ": " + s.evidence : "No base salary detected"}\n${manualLocation ? "Manual location: " : "Detected location: "}${selectedLocation?.evidence || selectedLocation?.label || "Unresolved"}`;
    $("metadata").textContent = `All industries · ${data.meta.validFrom} to ${data.meta.validThrough} · 40 hours/week, 52 weeks/year. Figures exclude bonus & equity.`;
    $("geo").textContent = area ? `OFLC area ${area.id}; geographic wage source code ${area.geoLevel}${area.geoLevel !== "1" ? " (broader-area fallback in source data)" : ""}.` : "Remote or nationwide roles need an actual worksite.";
  }
  function pageData() {
    const blocks = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { if (script.textContent.length < 1000000) blocks.push(JSON.parse(script.textContent)); } catch { /* Malformed site metadata is nonfatal. */ }
    }
    const jobs = C.jobObjects(blocks);
    const container = document.querySelector('main, [role="main"], article, [data-automation-id="jobPostingPage"]') || document.body;
    const text = (container?.innerText || "").slice(0, 250000);
    const titles = [...document.querySelectorAll("h1")].filter(e => e.getClientRects().length);
    const headings = titles.map(e => e.textContent).join(" ");
    const controls = [...(container?.querySelectorAll('a, button, input[type="submit"]') || [])];
    const hasApply = controls.some(e => /^apply(?:\s|$)/i.test((e.textContent || e.value || e.getAttribute('aria-label') || '').trim()));
    const jobLinks = new Set(controls.filter(e => e.tagName === 'A' && /\/(?:jobs?|positions)\/[^/?#]+/i.test(e.getAttribute('href') || '')).map(e => e.href)).size;
    const hasDetail = !!document.querySelector('[data-automation-id="jobPostingPage"], main.job-post, [itemtype="https://schema.org/JobPosting"]');
    return {jobs, text, headings, headingCount: titles.length, hasApply, hasDetail, jobLinks};
  }
  async function scan(force = false) {
    try {
      // Do not parse inbox messages or recommendation feeds on automatic scans.
      if (C.excludedAutoPage(location.href) && !forceOpen) {
        recognizedJob = false; if (host) host.hidden = true; return;
      }
      if (!data) { data = await browser.runtime.sendMessage({type: "wage-lens-data"}); index = C.locationIndex(data); }
      const page = pageData();
      const {jobs, text, headings} = page;
      const kind = C.pageKind({url: location.href, ...page});
      if (kind === 'detail') {
        recognizedJob = true; lastDetailAt = Date.now(); clearTimeout(loadingTimer); loadingTimer = null;
      } else if (!forceOpen) {
        if (kind === 'unknown' && recognizedJob && Date.now() - lastDetailAt < 2000) {
          loadingTimer ??= setTimeout(() => { loadingTimer = null; scan(true); }, 2000);
          return;
        }
        recognizedJob = false; if (host) host.hidden = true; return;
      }
      const sig = JSON.stringify([location.href, text, jobs, headings, kind]);
      if (!force && sig === signature) {
        if (host) { if (!hiddenByUser) create(); host.hidden = hiddenByUser; }
        return;
      }
      signature = sig;
      const textSalaries = C.salaryCandidates(text);
      create(); host.hidden = hiddenByUser;
      jobChoice = Math.min(jobChoice, Math.max(0, jobs.length - 1));
      const j = jobs[jobChoice] ? C.structured(jobs[jobChoice]) : null;
      $("jobs-wrap").hidden = jobs.length < 2;
      $("jobs").replaceChildren(...jobs.map((v,i) => option(i, v.title || `Job ${i+1}`))); $("jobs").value = String(jobChoice);
      // Structured addresses outrank free-text footer/headquarters matches.
      const locationText = j?.addresses.length ? j.addresses.join("\n") : text;
      const remoteUnresolved = (j?.remote && !j.addresses.length) || (!j && /^(?:location\s*:?\s*)?remote\b/im.test(text));
      const newLocations = remoteUnresolved ? [] : C.locations(locationText, data, index);
      if (!manualLocation) {
        detected = newLocations;
        selectedLocation = newLocations[0] || null;
      }
      if (!manualSalary && !salaryChosen) {
        // Never merge unrelated salaries from multiple JobPosting objects.
        salaries = j?.salaries.length ? j.salaries : jobs.length > 1 ? [] : textSalaries;
        $("salaries").replaceChildren(option("", "Choose a salary / enter manually"), ...salaries.map((s,i) => option(i, `${C.money(s.min)}${s.max !== s.min ? " - " + C.money(s.max) : ""}/yr · ${s.source}`)));
        $("salaries").value = salaries.length ? "0" : "";
        chooseSalary(salaries.length ? 0 : -1);
      }
      populateLocations();
      const notices = [];
      if (!detected.length) notices.push(j?.remote || /\bremote\b/i.test(text) ? "Remote role: select the actual worksite, not company headquarters." : "Location not resolved. Select a city, county or wage area.");
      if (!salaries.length) notices.push("No usable USD base-pay figure found. Enter it manually.");
      if (jobs.length > 1) notices.push("Multiple job records: select the intended posting.");
      if (headings && !/software|developer|engineer|programmer/i.test(headings)) notices.push("Fixed occupation: Software Developers. Confirm SOC 15-1252 fits this job.");
      $("status").hidden = !notices.length; $("status").textContent = notices.join(" ");
      render();
    } catch (error) {
      console.warn("OFLC Wage Lens:", error.message);
      signature = "";
      if (root) root.querySelector(".result").hidden = true;
      if (forceOpen) { create(); host.hidden = false; $("status").closest("details").open = true; $("status").hidden = false; $("status").textContent = "Wage data could not load. Reload the extension & this page."; }
    }
  }
  browser.runtime.onMessage.addListener(message => {
    if (!["wage-lens-toggle", "wage-lens-show"].includes(message?.type)) return undefined;
    if (message.type === "wage-lens-toggle" && host?.isConnected && !host.hidden) { host.hidden = true; hiddenByUser = true; }
    else { forceOpen = true; hiddenByUser = false; return scan(true).then(() => true); }
    return Promise.resolve(true);
  });
  browser.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local" && changes.wageLensUpdateStatus?.newValue) showUpdate(changes.wageLensUpdateStatus.newValue);
  });
  const observer = new MutationObserver(records => {
    if (host && !host.isConnected && !host.hidden && !hiddenByUser) create();
    if (records.every(r => r.target === host || host?.contains(r.target))) return;
    clearTimeout(scanTimer); scanTimer = setTimeout(() => scan(), 700);
  });
  // Observe above html/body so replacing either cannot strand the observer or panel.
  observer.observe(document, {childList: true, subtree: true, characterData: true});
  // History navigation can occur without a DOM mutation on client-rendered ATS pages.
  setInterval(() => {
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== lastWarningMinute) { lastWarningMinute = minute; renderUpdateWarning(); }
    if (location.href === lastURL) return;
    lastURL = location.href; signature = ""; recognizedJob = salaryChosen = manualSalary = manualLocation = hiddenByUser = forceOpen = false;
    clearTimeout(loadingTimer); loadingTimer = null; lastDetailAt = 0;
    selectedLocation = null; min = max = null; jobChoice = 0;
    if (host) host.hidden = true;
    scan(true);
  }, 1000);
  scan();
})();
