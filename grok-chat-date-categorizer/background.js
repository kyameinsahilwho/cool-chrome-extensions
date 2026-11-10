// Background service worker for Grok Chat Date Categorizer

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({
      dateSortMode: "modifyTime", // "modifyTime" (Last Active) or "createTime" (Creation Date)
      showBadges: true,
      grok_conversations_cache: {}
    });
    console.log("[Grok Chat Categorizer] Extension installed.");
  }
});

// Message listener for background events if needed
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_EXTENSION_STATUS") {
    chrome.storage.local.get(["dateSortMode", "showBadges"], (res) => {
      sendResponse(res);
    });
    return true; // Keep message channel open for async response
  }
});
