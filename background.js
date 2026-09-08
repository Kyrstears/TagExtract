chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "copy-tags" && command !== "copy-all") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: command, via: "hotkey" });
  } catch (e) {
    // Surface the failure via badge instead of failing silently
    try {
      await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#c62828" });
      setTimeout(() => {
        chrome.action.setBadgeText({ tabId: tab.id, text: "" }).catch(() => {});
      }, 2000);
    } catch (_) {}
    console.warn("[TagExtract] hotkey sendMessage failed:", e && e.message);
  }
});
