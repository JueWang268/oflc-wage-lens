/* Data stays in the extension; no page contents are sent to a network service. */
let dataset;
const updates = WageLensMonitor.create(browser, {getBaseline:async()=>WageLensMonitor.baselineFromMeta((await getDataset()).meta)});
updates.start().catch(error => console.warn("OFLC monitor:", error.message));
browser.runtime.onMessage.addListener(message => {
  if (message?.type === "wage-lens-update-status") return updates.getStatus();
  if (message?.type === "wage-lens-update-check") return updates.check(true);
  if (message?.type === "wage-lens-update-enabled" && typeof message.enabled === "boolean") return updates.setEnabled(message.enabled);
  if (message?.type !== "wage-lens-data") return undefined;
  return getDataset();
});
function getDataset() {
  dataset ??= fetch(browser.runtime.getURL("data/software-developers.json"))
    .then(response => {
      if (!response.ok) throw new Error("Packaged wage data unavailable");
      return response.json();
    }).catch(error => { dataset = undefined; throw error; });
  return dataset;
}
browser.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    await browser.tabs.sendMessage(tab.id, {type: "wage-lens-toggle"});
  } catch {
    try {
      await browser.scripting.executeScript({
        target: {tabId: tab.id}, files: ["core.js", "icons.js", "content.js"]
      });
      // Initial injection may already show the panel; do not immediately toggle it off.
      await browser.tabs.sendMessage(tab.id, {type: "wage-lens-show"});
    } catch {
      await browser.action.setTitle({tabId: tab.id, title: "Firefox protects this page. Open a regular job-posting tab."});
    }
  }
});
