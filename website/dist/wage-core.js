(function (root) {
  "use strict";
  const HOURS = 2080;
  const roman = ["Below I", "I", "II", "III", "IV"];
  const norm = s => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const money = (n, hourly = false) => {
    const decimals = hourly || Math.abs(n - Math.round(n)) > 0.000001;
    return new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", maximumFractionDigits: decimals ? 2 : 0, minimumFractionDigits: decimals ? 2 : 0}).format(n);
  };
  function annual(value, unit) {
    const factor = {hour: HOURS, year: 1, month: 12, week: 52, day: 260}[unit];
    const result = value * factor;
    return Number.isFinite(value) && value > 0 && Number.isFinite(factor) && Number.isFinite(result) ? result : null;
  }
  function classify(yearly, area) {
    if (!Number.isFinite(yearly) || yearly <= 0 || !Array.isArray(area?.levels) || area.levels.length !== 4 || area.levels.some((x,i) => !Number.isFinite(x) || x <= 0 || (i > 0 && x < area.levels[i-1])) || area.label) return null;
    // Compare cents, not display-rounded annual amounts or rounded hourly conversions.
    const cents = Math.round(yearly * 100);
    return area.levels.reduce((level, wage, i) => cents >= Math.round(wage * HOURS * 100) ? i + 1 : level, 0);
  }
  function normalizeUnit(text) {
    if (/hour|hourly|\bhr\b/i.test(text)) return "hour";
    if (/month/i.test(text)) return "month";
    if (/week/i.test(text)) return "week";
    if (/\bday\b|daily/i.test(text)) return "day";
    if (/year|annual|annum|\byr\b/i.test(text)) return "year";
    return null;
  }
  function excludedAutoPage(url) {
    let host;
    try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
    return /^(?:mail|webmail)\./.test(host) ||
      /^(?:outlook\.(?:live|office|office365)\.com|jobright\.ai)$/.test(host) || host.endsWith('.jobright.ai');
  }
  function pageKind({url, jobs = [], headings = '', headingCount = 0, text = '', hasDetail = false, hasApply = false, jobLinks = 0}) {
    if (excludedAutoPage(url)) return 'excluded';
    if (jobs.length > 1) return 'listing';
    let u;
    try { u = new URL(url); } catch { u = {hostname: '', pathname: '', searchParams: new URLSearchParams()}; }
    const host = u.hostname, path = u.pathname;
    const greenhouse = /(?:^|\.)greenhouse\.io$/.test(host) &&
      ((path === '/embed/job_app' && u.searchParams.has('token')) || /^\/[^/]+\/jobs\/\d+\/?$/.test(path));
    const workday = host.endsWith('.myworkdayjobs.com') && /\/job\/[^/]+\/.+/.test(path);
    const oracle = host.endsWith('.oraclecloud.com') && /\/sites\/[^/]+\/job\/\d+/.test(path);
    if (greenhouse || workday || oracle) return 'detail';
    const listing = /^(?:inbox|search(?: results)?|job search|jobs|recommended jobs|job recommendations|careers|open positions|available jobs|find (?:a |your )?job)(?:\b|$)/i.test(headings.trim());
    if (listing || jobs.length > 1 || (jobLinks > 1 && !hasDetail && !hasApply)) return 'listing';
    if (jobs.length === 1) return 'detail';
    const role = /\b(?:engineer|developer|analyst|scientist|manager|programmer)\b/i.test(headings);
    const editorial = /\b(?:guide|salary|salaries|interview|tips|news|how to|courses?|jobs)\b/i.test(headings);
    const sections = /job description|responsibilities|qualifications|essential position functions|requirements|about (?:the|this) (?:role|position)/i.test(text);
    return headingCount === 1 && role && !editorial && sections && (hasDetail || hasApply) ? 'detail' : 'unknown';
  }
  function spectrum(min, max, area) {
    if (max < min || classify(min, area) == null || classify(max, area) == null) return null;
    const levels = area.levels.map(w => Math.round(w * HOURS * 100) / 100);
    const start = levels[0], end = levels[3];
    if (end === start) return null;
    const position = value => Math.max(0, Math.min(100, (value - start) / (end - start) * 100));
    return {ticks: levels.map(position), left: position(min), right: position(max),
      below: Math.round(min * 100) < Math.round(start * 100),
      above: Math.round(max * 100) > Math.round(end * 100)};
  }
  function salaryCandidates(text) {
    text = String(text ?? "");
    const found = [];
    const value = "(?:[0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]{1,2})?|[0-9]{2,8}(?:\\.[0-9]{1,2})?)[ \\t]*[kK]?(?![0-9kK]|[.,][0-9])";
    const re = new RegExp("(?:US\\$|USD\\s*\\$?|\\$)\\s*(" + value + ")(?:\\s*(?:-|–|—|to)\\s*(?:US\\$|USD\\s*\\$?|\\$)?\\s*(" + value + "))?", "g");
    const number = s => parseFloat(s.replace(/[,$\s]/g, "")) * (/k/i.test(s) ? 1000 : 1);
    for (const m of String(text).matchAll(re)) {
      const start = text.lastIndexOf("\n", m.index) + 1;
      const end = text.indexOf("\n", m.index + m[0].length);
      const line = text.slice(start, end < 0 ? text.length : end);
      const before = text.slice(Math.max(start, m.index - 100), m.index);
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 55).split("\n")[0];
      if (!m[2] && /^\s*(?:-|–|—|to)\s*(?:US\$|USD|\$|\d)/.test(after)) continue;
      const context = before + m[0] + after;
      if (/(?:CAD|AUD|NZD|SGD|HKD|EUR|GBP|C\$|A\$)/i.test(context) || /[CA]$/.test(before.trim())) continue;
      // The nearest compensation label wins, even when base and bonus share a line.
      const labels = [...before.matchAll(/base (?:pay|salary)|salary|bonus|equity|stock|relocation|stipend|sign.on|total compensation|on.target earnings|\bOTE\b/gi)];
      if (labels.length && !/^(?:base (?:pay|salary)|salary)$/i.test(labels.at(-1)[0])) continue;
      let low = number(m[1]), high = m[2] ? number(m[2]) : low;
      if (m[2] && /k/i.test(m[2]) && !/k/i.test(m[1]) && low < 1000) low *= 1000;
      let unit = normalizeUnit(after.slice(0, 32)) || normalizeUnit(before);
      const inferred = !unit;
      if (!unit && low >= 15000 && /salary|base pay|pay range|compensation|USD|US\$/i.test(context)) unit = "year";
      if (!unit || high < low || low <= 0) continue;
      if (unit === "hour" && high > 2000) continue;
      const lower = annual(low, unit), upper = annual(high, unit);
      if (!lower || upper > 10000000) continue;
      found.push({min: lower, max: upper, unit, source: "Page text", evidence: line.trim().slice(0, 400), inferred, openEnded: /\+|and (?:up|above)|or more/i.test(after.slice(0, 20))});
    }
    return dedupeSalaries(found);
  }
  function dedupeSalaries(values) {
    const seen = new Set();
    return values.filter(v => {
      const key = [v.min, v.max, v.evidence, v.openEnded].join("|");
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 30);
  }
  function jobObjects(values) {
    const result = [];
    function walk(x, depth = 0) {
      if (!x || typeof x !== "object" || depth > 12) return;
      if (Array.isArray(x)) { x.forEach(v => walk(v, depth + 1)); return; }
      if ([].concat(x["@type"] || []).some(t => /(?:^|\/)JobPosting$/.test(t))) result.push(x);
      if (x["@graph"]) walk(x["@graph"], depth + 1);
      if (x.itemListElement) walk(x.itemListElement, depth + 1);
      if (x.item) walk(x.item, depth + 1);
      if (x.mainEntity) walk(x.mainEntity, depth + 1);
    }
    values.forEach(x => walk(x)); return result;
  }
  function structured(job) {
    job = job && typeof job === "object" ? job : {};
    const addresses = [].concat(job.jobLocation || []).filter(l => l && typeof l === "object").map(l => {
      const a = l.address || l;
      const country = a.addressCountry && typeof a.addressCountry === "object" ? a.addressCountry.name : a.addressCountry;
      return {text: [a.addressLocality, a.addressRegion].filter(v => typeof v === "string" && v.trim()).join(", "), country};
    }).filter(a => a.text && (!a.country || /^(US|USA|United States(?: of America)?)$/i.test(a.country)));
    const salaries = [];
    for (const s of [].concat(job.baseSalary || [])) {
      if (!s || s.currency !== "USD") continue;
      const v = s.value && typeof s.value === "object" ? s.value : {value: s.value, unitText: s.unitText};
      const unit = normalizeUnit(v.unitText || s.unitText || "");
      const min = annual(Number(v.minValue ?? v.value), unit);
      const max = annual(Number(v.maxValue ?? v.value ?? v.minValue), unit);
      if (min && max >= min && max <= 10000000) salaries.push({min, max, unit, source: "JobPosting structured data", evidence: String(job.title || "Job posting"), inferred: false, locationTexts: addresses.map(a => a.text)});
    }
    return {addresses: addresses.map(a => a.text), salaries, remote: /TELECOMMUTE/i.test(job.jobLocationType || "")};
  }
  function locationIndex(data) {
    return data.locations.filter(l => l.kind !== "area").map(l => {
      const stateNames = [l.state, data.states[l.state]].filter(Boolean).map(escape).join("|");
      const name = escape(l.name).replace(/\s+/g, "\\s+");
      return {...l, regex: new RegExp("(?:^|[^a-zA-Z])(" + name + ")(?:\\s*,\\s*|\\s+)(?:" + stateNames + ")(?![a-zA-Z])", "gi")};
    });
  }
  function locations(text, data, index = locationIndex(data)) {
    const hits = [];
    for (const item of index) {
      item.regex.lastIndex = 0;
      for (const m of String(text).matchAll(item.regex)) hits.push({...item, regex: undefined, position: m.index, length: m[0].length, evidence: m[0].trim()});
    }
    // Avoid resolving "York, NY" inside "New York, NY" or "Francisco" inside a longer city.
    const full = hits.filter(h => !hits.some(o => o !== h && o.position <= h.position && o.position + o.length >= h.position + h.length && o.length > h.length));
    const seen = new Set();
    return full.sort((a,b) => a.position - b.position).filter(h => {
      const key = `${h.name}|${h.state}|${h.area}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 30);
  }
  function searchLocations(query, data) {
    const q = norm(query);
    if (!q) return [];
    const terms = q.split(" ");
    return data.locations.map(l => ({...l, search: norm(`${l.label} ${data.states[l.state]} ${data.areas[l.area].name}`)}))
      .filter(l => terms.every(t => l.search.includes(t)))
      .sort((a,b) => Number(norm(b.label).startsWith(q)) - Number(norm(a.label).startsWith(q)) || a.label.localeCompare(b.label))
      .slice(0, 80);
  }
  function freshnessWarning(meta, state = {}, now = Date.now()) {
    if (!meta) return null;
    const today = new Date(now).toISOString().slice(0,10);
    if (meta.validThrough && today > meta.validThrough) return {severity:"danger", title:"Wage data is out of date", reason:`This dataset expired on ${meta.validThrough}.`};
    if (state.changed && state.release?.start > today) return {severity:"info", title:"New wage year announced", reason:`Effective ${state.release.start}. Keep the current dataset until then.`};
    if (state.changed) return {severity:"danger", title:"Wage data may be out of date", reason:"DOL lists a new or revised release."};
    if (state.kind === "error") return {severity:"danger", title:"Wage data freshness is unverified", reason:"The latest DOL check failed. Review the official download listing."};
    if (state.lastSuccess && (now - state.lastSuccess > 7 * 86400000 || state.lastSuccess > now + 300000)) return {severity:"danger", title:"Wage data may be out of date", reason:"No recent successful DOL check. Review the official download listing."};
    if (state.enabled === false && !state.lastSuccess) return {severity:"danger", title:"Wage data freshness is unverified", reason:"Automatic checks are off and no successful check is recorded."};
    return null;
  }
  const api = {HOURS, roman, norm, money, annual, classify, spectrum, normalizeUnit, excludedAutoPage, pageKind, salaryCandidates, jobObjects, structured, locationIndex, locations, searchLocations, freshnessWarning};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.WageLensCore = api;
})(globalThis);
