// popup.js - Interactive settings & stats for Grok Date Categorizer

document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_SETTINGS_KEY = "grok_date_settings";
  const STORAGE_CACHE_KEY = "grok_conversations_cache";

  // Elements
  const modeModify = document.getElementById("modeModify");
  const modeCreate = document.getElementById("modeCreate");
  const showBadgesToggle = document.getElementById("showBadgesToggle");
  const syncBtn = document.getElementById("syncBtn");
  const syncBtnText = document.getElementById("syncBtnText");

  const totalChatsCount = document.getElementById("totalChatsCount");
  const todayChatsCount = document.getElementById("todayChatsCount");
  const weekChatsCount = document.getElementById("weekChatsCount");

  // Load initial settings and statistics
  chrome.storage.local.get([STORAGE_SETTINGS_KEY, STORAGE_CACHE_KEY], (res) => {
    const settings = res[STORAGE_SETTINGS_KEY] || {
      dateSortMode: "modifyTime",
      showBadges: true
    };

    if (settings.dateSortMode === "createTime") {
      modeCreate.checked = true;
    } else {
      modeModify.checked = true;
    }

    showBadgesToggle.checked = settings.showBadges !== false;

    // Calculate stats
    const cache = res[STORAGE_CACHE_KEY] || {};
    calculateStats(cache, settings.dateSortMode);
  });

  function calculateStats(cache, sortMode) {
    const chats = Object.values(cache);
    const total = chats.length;
    totalChatsCount.textContent = total;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7Days = startOfToday - 6 * 86400000;

    let todayCount = 0;
    let weekCount = 0;

    const field = sortMode === "createTime" ? "createTime" : "modifyTime";

    for (const c of chats) {
      const ts = c[field] || c.modifyTime || c.createTime;
      if (!ts) continue;
      const t = Date.parse(ts);
      if (!Number.isFinite(t)) continue;

      if (t >= startOfToday) {
        todayCount++;
      }
      if (t >= startOf7Days) {
        weekCount++;
      }
    }

    todayChatsCount.textContent = todayCount;
    weekChatsCount.textContent = weekCount;
  }

  function saveSettingUpdate(patch) {
    chrome.storage.local.get([STORAGE_SETTINGS_KEY], (res) => {
      const current = res[STORAGE_SETTINGS_KEY] || {};
      const updated = { ...current, ...patch };
      chrome.storage.local.set({ [STORAGE_SETTINGS_KEY]: updated });
    });
  }

  // Event Listeners
  modeModify.addEventListener("change", () => {
    if (modeModify.checked) {
      saveSettingUpdate({ dateSortMode: "modifyTime" });
      refreshStats();
    }
  });

  modeCreate.addEventListener("change", () => {
    if (modeCreate.checked) {
      saveSettingUpdate({ dateSortMode: "createTime" });
      refreshStats();
    }
  });

  showBadgesToggle.addEventListener("change", () => {
    saveSettingUpdate({ showBadges: showBadgesToggle.checked });
  });

  syncBtn.addEventListener("click", () => {
    syncBtn.disabled = true;
    syncBtnText.textContent = "Syncing with Grok...";

    // Send trigger to active tab if on Grok
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && tabs[0]?.url?.includes("grok.com")) {
        chrome.scripting?.executeScript?.({
          target: { tabId: tabs[0].id },
          func: () => {
            window.postMessage({
              source: "GROK_DATE_CATEGORIZER_CONTENT",
              type: "TRIGGER_FETCH_ALL",
              payload: { maxPages: 25 }
            }, "*");
          }
        }).catch(() => {});
      }
    });

    setTimeout(() => {
      syncBtn.disabled = false;
      syncBtnText.textContent = "Synced!";
      refreshStats();
      setTimeout(() => {
        syncBtnText.textContent = "Sync Chats Now";
      }, 2000);
    }, 1200);
  });

  function refreshStats() {
    chrome.storage.local.get([STORAGE_SETTINGS_KEY, STORAGE_CACHE_KEY], (res) => {
      const settings = res[STORAGE_SETTINGS_KEY] || {};
      const cache = res[STORAGE_CACHE_KEY] || {};
      calculateStats(cache, settings.dateSortMode || "modifyTime");
    });
  }
});
