chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "loading") {
    const url = changeInfo.url || tab.url;
    if (!url || url.startsWith("chrome") || url.startsWith("about")) return;

    chrome.storage.local.get(["focusMode", "blockedDomains"], (data) => {
      if (!data.focusMode || !data.blockedDomains?.length) return;

      let hostname;
      try {
        hostname = new URL(url).hostname;
      } catch {
        return;
      }

      const isBlocked = data.blockedDomains.some(
        (domain) => hostname === domain || hostname.endsWith("." + domain)
      );

      if (isBlocked) {
        const blockedUrl = chrome.runtime.getURL(
          "blocked.html?domain=" + encodeURIComponent(hostname)
        );
        // Avoid redirect loop
        if (!url.startsWith(chrome.runtime.getURL(""))) {
          chrome.tabs.update(tabId, { url: blockedUrl });
        }
      }
    });
  }
});

// Update badge when focus mode changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.focusMode) {
    updateBadge(changes.focusMode.newValue);
  }
});

function updateBadge(isOn) {
  if (isOn) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Restore badge state on service worker startup
chrome.storage.local.get(["focusMode"], (data) => {
  updateBadge(data.focusMode || false);
});
