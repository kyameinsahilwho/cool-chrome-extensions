// content.js - Grok Chat Date Categorizer & Separator
// Injected into ISOLATED world of grok.com

(() => {
  "use strict";

  const STORAGE_CACHE_KEY = "grok_conversations_cache";
  const STORAGE_SETTINGS_KEY = "grok_date_settings";
  const CHAT_PATH_REGEX = /^\/c\/([0-9a-f-]+)/i;

  // Settings (always active, no disable option)
  let settings = {
    dateSortMode: "modifyTime", // "modifyTime" (Last Active) or "createTime" (Creation Date)
    showBadges: true
  };

  // State
  const conversationsMap = new Map();
  let categorizedContainer = null;
  let nativeChatsUl = null;
  let sidebarObserver = null;
  let renderTimer = null;
  let isRendering = false;

  // Comprehensive detector for project/workspace/folder chats
  function isProjectConversation(raw) {
    if (!raw) return false;
    if (raw.temporary === true) return true;

    // Direct project properties
    if (raw.projectId || raw.project_id || raw.projectUuid || raw.project_uuid) return true;
    if (raw.folderId || raw.folder_id || raw.folderUuid || raw.folder_uuid) return true;
    if (raw.workspaceId || raw.workspace_id) return true;

    if (raw.project) {
      if (typeof raw.project === "string" && raw.project.trim() !== "") return true;
      if (typeof raw.project === "object" && raw.project !== null && (raw.project.id || raw.project.projectId || raw.project.name)) return true;
    }

    if (raw.folder) {
      if (typeof raw.folder === "string" && raw.folder.trim() !== "") return true;
      if (typeof raw.folder === "object" && raw.folder !== null && (raw.folder.id || raw.folder.folderId)) return true;
    }

    // Metadata wrapper
    if (raw.metadata && typeof raw.metadata === "object") {
      const m = raw.metadata;
      if (m.projectId || m.project_id || m.project || m.folderId || m.folder_id || m.workspaceId) return true;
    }

    // Type strings
    if (typeof raw.type === "string" && raw.type.toUpperCase().includes("PROJECT")) return true;
    if (typeof raw.conversationType === "string" && raw.conversationType.toUpperCase().includes("PROJECT")) return true;

    return false;
  }

  // SVG Icons
  const ICONS = {
    pinnedChat: `<svg class="grok-chat-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 21L12 23L11 21V16H4.5V13.7129L4.65234 13.4697L6.95801 9.78027L6.41797 5.99512C6.11675 3.8866 7.75289 2 9.88281 2H14.1172C16.2471 2 17.8832 3.8866 17.582 5.99512L17.041 9.78027L19.5 13.7129V16H13V21Z" fill="currentColor"></path></svg>`,
    pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path fill-rule="evenodd" clip-rule="evenodd" d="M13 21L12 23L11 21V16H4.5V13.7129L4.65234 13.4697L6.95801 9.78027L6.41797 5.99512C6.11675 3.8866 7.75289 2 9.88281 2H14.1172C16.2471 2 17.8832 3.8866 17.582 5.99512L17.041 9.78027L19.5 13.7129V16H13V21ZM9.88281 4C8.97007 4 8.26852 4.80836 8.39746 5.71191L9.04199 10.2207L8.84766 10.5303L6.67871 14H17.3213L15.1523 10.5303L14.958 10.2207L15.6025 5.71191C15.7315 4.80836 15.0299 4 14.1172 4H9.88281Z" fill="currentColor"></path></svg>`,
    unpin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.0044 21L12.0044 23L11.0044 21V16H4.50439V13.7129L4.65674 13.4697L6.9624 9.78027L6.5708 7.04102L2.39014 3.78906L3.61865 2.21094L21.6187 16.2109L20.3901 17.7891L18.0903 16H13.0044V21ZM9.04639 10.2207L8.85205 10.5303L6.68311 14H15.5181L8.84424 8.80859L9.04639 10.2207Z" fill="currentColor"></path><path d="M14.1216 2C16.2515 2 17.8876 3.8866 17.5864 5.99512L17.0015 10.0918L15.1821 8.67676L15.6069 5.71191C15.7359 4.80836 15.0343 4 14.1216 4H9.88721C9.68345 4 9.49076 4.04162 9.31494 4.11426L7.64307 2.81348C8.24711 2.30763 9.02694 2 9.88721 2H14.1216Z" fill="currentColor"></path></svg>`,
    more: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`
  };

  // 1. Initial Storage Load
  function loadStoredData() {
    chrome.storage.local.get([STORAGE_CACHE_KEY, STORAGE_SETTINGS_KEY], (res) => {
      if (res[STORAGE_SETTINGS_KEY]) {
        settings = { ...settings, ...res[STORAGE_SETTINGS_KEY] };
      }
      if (res[STORAGE_CACHE_KEY]) {
        const cached = res[STORAGE_CACHE_KEY];
        for (const [id, item] of Object.entries(cached)) {
          if (!isProjectConversation(item)) {
            conversationsMap.set(id, item);
          }
        }
      }
      scheduleRender();
    });
  }

  function saveCache() {
    const obj = {};
    for (const [id, item] of conversationsMap.entries()) {
      if (!isProjectConversation(item)) {
        obj[id] = item;
      }
    }
    chrome.storage.local.set({ [STORAGE_CACHE_KEY]: obj });
  }

  // 2. Communication with page-bridge.js
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "GROK_DATE_CATEGORIZER_BRIDGE") {
      return;
    }

    const { type, payload } = event.data;

    if (type === "CONVERSATIONS_API_DATA" || type === "FETCH_ALL_RESULT") {
      const list = payload?.conversations || payload?.result?.conversations || payload?.data?.conversations || payload?.items;
      if (Array.isArray(list)) {
        mergeConversationsList(list);
      }
    } else if (type === "BRIDGE_READY") {
      triggerBridgeFetch(20);
    }
  });

  function triggerBridgeFetch(maxPages = 20) {
    window.postMessage({
      source: "GROK_DATE_CATEGORIZER_CONTENT",
      type: "TRIGGER_FETCH_ALL",
      payload: { maxPages }
    }, "*");
  }

  function mergeConversationsList(rawList) {
    let updated = false;
    for (const raw of rawList) {
      const id = String(raw.conversationId || raw.conversation_id || raw.id || "").trim();
      if (!id) continue;

      // Filter out and remove any chat belonging to a project
      if (isProjectConversation(raw)) {
        if (conversationsMap.has(id)) {
          conversationsMap.delete(id);
          updated = true;
        }
        continue;
      }

      const existing = conversationsMap.get(id) || {};
      const title = String(raw.title || raw.conversationName || raw.name || existing.title || "").trim();
      const createTime = String(raw.createTime || raw.createdAt || raw.create_time || existing.createTime || "").trim();
      const modifyTime = String(raw.modifyTime || raw.updateTime || raw.updatedAt || raw.modify_time || existing.modifyTime || "").trim();

      let starred = existing.starred;
      if (typeof starred !== "boolean" && typeof raw.starred === "boolean") {
        starred = raw.starred;
      }

      conversationsMap.set(id, {
        conversationId: id,
        title: title || existing.title || "Untitled Chat",
        createTime: createTime || existing.createTime || "",
        modifyTime: modifyTime || existing.modifyTime || "",
        starred: Boolean(starred),
        pinnedOrder: existing.pinnedOrder ?? null,
        href: `/c/${encodeURIComponent(id)}`
      });
      updated = true;
    }

    if (updated) {
      saveCache();
      scheduleRender();
    }
  }

  // 3. Extract metadata from Native DOM items
  function scrapeNativeDom() {
    if (!nativeChatsUl) return;

    const items = nativeChatsUl.querySelectorAll('li[data-sidebar="menu-item"], li');
    let added = false;
    const now = Date.now();
    let pinnedCount = 0;

    items.forEach((item, index) => {
      const anchor = item.querySelector('a[href*="/c/"]');
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      const match = CHAT_PATH_REGEX.exec(href);
      if (!match) return;

      const id = match[1];

      // If this item is under Projects section, never include it in history
      if (item.closest('[data-sidebar="group"]')?.querySelector('button')?.textContent?.includes("Projects")) {
        if (conversationsMap.has(id)) {
          conversationsMap.delete(id);
          added = true;
        }
        return;
      }

      const titleSpan = anchor.querySelector("span:not([aria-hidden='true'])");
      const title = titleSpan?.textContent?.trim() || anchor.textContent?.trim() || "Untitled Chat";

      const hasUnpinBtn = Boolean(anchor.querySelector('button[aria-label="Unpin chat"], button[aria-label*="unpin" i]'));
      const hasPinIcon = Boolean(anchor.querySelector('div[data-sidebar="icon"] svg path[d*="13 21L12 23L11 21V16H4.5"]'));
      const isPinned = hasUnpinBtn || hasPinIcon;
      const pinnedOrder = isPinned ? pinnedCount++ : null;

      const existing = conversationsMap.get(id);
      if (!existing) {
        // Approximate placeholder timestamp until API fills in exact timestamp
        const approxTime = new Date(now - index * 60000).toISOString();
        conversationsMap.set(id, {
          conversationId: id,
          title,
          createTime: approxTime,
          modifyTime: approxTime,
          starred: isPinned,
          pinnedOrder,
          href
        });
        added = true;
      } else {
        if (existing.starred !== isPinned || existing.pinnedOrder !== pinnedOrder || (title && existing.title !== title)) {
          existing.starred = isPinned;
          existing.pinnedOrder = pinnedOrder;
          if (title) existing.title = title;
          added = true;
        }
      }
    });

    if (added) {
      saveCache();
    }
  }

  // 4. Date Bucketing Algorithm
  function parseTimestamp(ts) {
    if (!ts) return null;
    const time = Date.parse(ts);
    return Number.isFinite(time) ? new Date(time) : null;
  }

  function formatDayBucket(date, now = new Date()) {
    if (!date) return "Unknown Date";

    const day = date.getDate();
    const month = date.toLocaleDateString(undefined, { month: "short" });
    const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    const isToday = (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );

    const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const isYesterday = (
      date.getFullYear() === yesterdayDate.getFullYear() &&
      date.getMonth() === yesterdayDate.getMonth() &&
      date.getDate() === yesterdayDate.getDate()
    );

    const dateStr = year === currentYear ? `${day} ${month}` : `${day} ${month} ${year}`;
    let label = `${dateStr}, ${weekday}`;
    if (isToday) {
      label = `${dateStr}, ${weekday} (Today)`;
    } else if (isYesterday) {
      label = `${dateStr}, ${weekday} (Yesterday)`;
    }
    return label;
  }

  function formatDisplayDate(date) {
    if (!date) return "";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function groupConversations() {
    const dayBuckets = new Map();
    const sortField = settings.dateSortMode === "createTime" ? "createTime" : "modifyTime";
    const now = new Date();

    const allChats = Array.from(conversationsMap.values());
    const pinnedChats = [];
    const unpinnedChats = [];

    for (const chat of allChats) {
      if (isProjectConversation(chat)) {
        continue;
      }

      if (chat.starred) {
        pinnedChats.push(chat);
      } else {
        unpinnedChats.push(chat);
      }
    }

    // Maintain pinned chats in their native pinned order
    pinnedChats.sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0));

    // Group unpinned chats by individual day: (date, day)
    for (const chat of unpinnedChats) {
      const primaryTs = chat[sortField] || chat.modifyTime || chat.createTime;
      const dateObj = parseTimestamp(primaryTs) || new Date();

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const date = String(dateObj.getDate()).padStart(2, "0");
      const dayKey = `${year}-${month}-${date}`;

      if (!dayBuckets.has(dayKey)) {
        const midnight = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
        dayBuckets.set(dayKey, {
          dayKey,
          label: formatDayBucket(dateObj, now),
          midnight,
          items: []
        });
      }

      dayBuckets.get(dayKey).items.push(chat);
    }

    // Sort day buckets by midnight timestamp descending (newest day first)
    const sortedBuckets = Array.from(dayBuckets.values()).sort((a, b) => b.midnight - a.midnight);

    // Sort chats inside each day bucket by timestamp descending (newest chat first)
    for (const bucket of sortedBuckets) {
      bucket.items.sort((a, b) => {
        const timeA = parseTimestamp(a[sortField] || a.modifyTime || a.createTime)?.getTime() || 0;
        const timeB = parseTimestamp(b[sortField] || b.modifyTime || b.createTime)?.getTime() || 0;
        return timeB - timeA;
      });
    }

    return { pinnedChats, buckets: sortedBuckets };
  }

  // 5. Sidebar DOM Finding
  function findChatsSection() {
    // 1. Search for data-sidebar="group" containing "Chats" button
    const groups = document.querySelectorAll('[data-sidebar="group"]');
    for (const group of groups) {
      const headerBtn = group.querySelector("button");
      const text = headerBtn?.textContent?.trim() || "";
      if (text.includes("Chats")) {
        const ul = group.querySelector('ul[data-sidebar="menu"]') || group.querySelector("ul");
        return { group, headerBtn, ul };
      }
    }

    // 2. Fallback: Search all buttons for "Chats"
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.textContent?.trim().includes("Chats")) {
        const group = btn.closest('[data-sidebar="group"]') || btn.closest('div.group\\/sidebar-group') || btn.parentElement?.parentElement;
        const ul = group?.querySelector('ul[data-sidebar="menu"]') || group?.querySelector("ul");
        if (group) {
          return { group, headerBtn: btn, ul };
        }
      }
    }

    return null;
  }

  // 6. Rendering the Categorized UI
  function scheduleRender() {
    if (renderTimer) {
      cancelAnimationFrame(renderTimer);
    }
    renderTimer = requestAnimationFrame(() => {
      renderCategorizedView();
    });
  }

  function renderCategorizedView() {
    if (isRendering) return;
    isRendering = true;

    try {
      const section = findChatsSection();
      if (!section) {
        isRendering = false;
        return;
      }

      const { group, headerBtn, ul } = section;
      nativeChatsUl = ul;

      // Scrape any chats present in native DOM
      scrapeNativeDom();

      // If native Chats section is collapsed by user, hide custom container
      if (headerBtn && headerBtn.getAttribute("aria-expanded") === "false") {
        if (categorizedContainer) {
          categorizedContainer.style.display = "none";
        }
        isRendering = false;
        return;
      } else if (categorizedContainer) {
        categorizedContainer.style.display = "flex";
      }

      // Create or re-use container
      if (!categorizedContainer || !categorizedContainer.isConnected) {
        categorizedContainer = document.createElement("div");
        categorizedContainer.className = "grok-date-categorized-container";
        if (nativeChatsUl) {
          nativeChatsUl.parentNode.insertBefore(categorizedContainer, nativeChatsUl);
        } else {
          group.appendChild(categorizedContainer);
        }
      }

      // Hide native UL only when we have chats to display
      if (conversationsMap.size > 0 && nativeChatsUl) {
        nativeChatsUl.classList.add("grok-native-hidden");
      }

      // Build Categorized DOM
      buildContainerContent();
    } catch (err) {
      console.error("[Grok Date Categorizer] Render error:", err);
    } finally {
      isRendering = false;
    }
  }

  function buildContainerContent() {
    if (!categorizedContainer) return;

    const currentPath = window.location.pathname;
    const match = CHAT_PATH_REGEX.exec(currentPath);
    const activeChatId = match ? match[1] : null;

    const { pinnedChats, buckets } = groupConversations();

    categorizedContainer.innerHTML = "";

    let totalVisibleChats = 0;

    // 1. Render Pinned Chats at the top (WITHOUT "Pinned" title header!)
    if (pinnedChats.length > 0) {
      totalVisibleChats += pinnedChats.length;
      const pinnedWrapper = document.createElement("div");
      pinnedWrapper.className = "grok-pinned-container";

      for (const chat of pinnedChats) {
        const row = createChatRow(chat, activeChatId);
        pinnedWrapper.appendChild(row);
      }

      categorizedContainer.appendChild(pinnedWrapper);
    }

    // 2. Render Date Category Sections: (DATE, DAY) - Always visible
    for (const bucket of buckets) {
      if (bucket.items.length === 0) continue;
      totalVisibleChats += bucket.items.length;

      const groupDiv = document.createElement("div");
      groupDiv.className = "grok-date-group";
      groupDiv.dataset.day = bucket.dayKey;

      // Clean Date Category Header: (date, day) in ALL CAPS
      const header = document.createElement("div");
      header.className = "grok-date-header";

      const headerTitle = document.createElement("span");
      headerTitle.className = "grok-date-title";
      headerTitle.textContent = bucket.label;
      header.appendChild(headerTitle);

      // Separator line between date/day and number of chats
      const separatorLine = document.createElement("span");
      separatorLine.className = "grok-date-separator";
      header.appendChild(separatorLine);

      if (settings.showBadges) {
        const badge = document.createElement("span");
        badge.className = "grok-date-badge";
        badge.textContent = bucket.items.length;
        header.appendChild(badge);
      }

      groupDiv.appendChild(header);

      // Chat items list (always visible)
      const listDiv = document.createElement("div");
      listDiv.className = "grok-date-items-list";

      for (const chat of bucket.items) {
        const row = createChatRow(chat, activeChatId);
        listDiv.appendChild(row);
      }

      groupDiv.appendChild(listDiv);
      categorizedContainer.appendChild(groupDiv);
    }

    // If chats exist and were rendered, ensure native UL is hidden
    if (totalVisibleChats > 0 && nativeChatsUl) {
      nativeChatsUl.classList.add("grok-native-hidden");
    }
  }

  function createChatRow(chat, activeChatId) {
    const row = document.createElement("a");
    row.className = `grok-chat-row ${chat.conversationId === activeChatId ? "is-active" : ""}`;
    row.href = chat.href || `/c/${chat.conversationId}`;
    row.dataset.id = chat.conversationId;

    const sortField = settings.dateSortMode === "createTime" ? "createTime" : "modifyTime";
    const ts = parseTimestamp(chat[sortField] || chat.modifyTime || chat.createTime);
    if (ts) {
      const label = settings.dateSortMode === "createTime" ? "Created" : "Active";
      row.setAttribute("data-timestamp-tooltip", `${label}: ${formatDisplayDate(ts)}`);
    }

    const left = document.createElement("div");
    left.className = "grok-chat-row-left";

    // Pinned chat icon
    if (chat.starred) {
      const iconSpan = document.createElement("span");
      iconSpan.className = "grok-chat-icon";
      iconSpan.innerHTML = ICONS.pinnedChat;
      left.appendChild(iconSpan);
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = "grok-chat-title";
    titleSpan.textContent = chat.title || "Untitled Chat";
    left.appendChild(titleSpan);

    row.appendChild(left);

    // Hover Action Buttons: Pin & Options
    const actions = document.createElement("div");
    actions.className = "grok-chat-actions";

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "grok-action-btn";
    pinBtn.title = chat.starred ? "Unpin chat" : "Pin chat";
    pinBtn.innerHTML = chat.starred ? ICONS.unpin : ICONS.pin;
    pinBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleNativePinToggle(chat.conversationId);
    });
    actions.appendChild(pinBtn);

    const optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.className = "grok-action-btn";
    optBtn.title = "Options";
    optBtn.innerHTML = ICONS.more;
    optBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleNativeOptionsClick(chat.conversationId, optBtn);
    });
    actions.appendChild(optBtn);

    row.appendChild(actions);

    row.addEventListener("click", (e) => {
      if (e.target.closest(".grok-action-btn")) {
        return;
      }
      e.preventDefault();
      handleChatNavigation(chat.conversationId, row.href);
    });

    return row;
  }

  // 7. Interacting with Grok's Native UI elements
  function handleChatNavigation(conversationId, href) {
    if (nativeChatsUl) {
      const nativeAnchor = nativeChatsUl.querySelector(`a[href*="${conversationId}"]`);
      if (nativeAnchor) {
        nativeAnchor.click();
        updateActiveHighlight(conversationId);
        return;
      }
    }

    window.postMessage({
      source: "GROK_DATE_CATEGORIZER_CONTENT",
      type: "NAVIGATE_TO",
      payload: { path: href }
    }, "*");

    updateActiveHighlight(conversationId);
  }

  function handleNativePinToggle(conversationId) {
    if (nativeChatsUl) {
      const nativeAnchor = nativeChatsUl.querySelector(`a[href*="${conversationId}"]`);
      if (nativeAnchor) {
        const pinBtn = nativeAnchor.querySelector('button[aria-label*="pin" i], button[aria-label*="Pin" i]');
        if (pinBtn) {
          pinBtn.click();
          const chat = conversationsMap.get(conversationId);
          if (chat) {
            chat.starred = !chat.starred;
            saveCache();
            scheduleRender();
          }
          return;
        }
      }
    }
  }

  function handleNativeOptionsClick(conversationId, triggerBtn) {
    if (nativeChatsUl) {
      const nativeAnchor = nativeChatsUl.querySelector(`a[href*="${conversationId}"]`);
      if (nativeAnchor) {
        const optionsBtn = nativeAnchor.querySelector('button[aria-label="Options"], button[data-slot="button"]:last-child');
        if (optionsBtn) {
          optionsBtn.click();
          return;
        }
      }
    }
  }

  function updateActiveHighlight(activeId) {
    if (!categorizedContainer) return;
    const rows = categorizedContainer.querySelectorAll(".grok-chat-row");
    rows.forEach((r) => {
      r.classList.toggle("is-active", r.dataset.id === activeId);
    });
  }

  // 8. Observers & Lifecycle
  function setupObservers() {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
    }

    sidebarObserver = new MutationObserver((mutations) => {
      let shouldRecheck = false;
      for (const m of mutations) {
        if (m.target === categorizedContainer || categorizedContainer?.contains(m.target)) {
          continue;
        }
        if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
          shouldRecheck = true;
          break;
        }
      }

      if (shouldRecheck) {
        scheduleRender();
      }
    });

    if (document.body) {
      sidebarObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    window.addEventListener("popstate", () => {
      const match = CHAT_PATH_REGEX.exec(window.location.pathname);
      if (match) {
        updateActiveHighlight(match[1]);
      }
    });

    window.addEventListener("focus", () => {
      triggerBridgeFetch(5);
    });

    setInterval(() => {
      triggerBridgeFetch(5);
    }, 120000);
  }

  // 9. Listen for Settings Changes from Popup
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes[STORAGE_SETTINGS_KEY]) {
      settings = { ...settings, ...changes[STORAGE_SETTINGS_KEY].newValue };
      scheduleRender();
    }
  });

  // 10. Startup
  loadStoredData();
  setupObservers();

  // Handshake with page bridge
  window.postMessage({
    source: "GROK_DATE_CATEGORIZER_CONTENT",
    type: "CONTENT_READY",
    payload: { maxPages: 20 }
  }, "*");

  // Robust hydration polling for first 5 seconds
  [100, 300, 600, 1200, 2500, 5000].forEach((delay) => {
    setTimeout(() => {
      scheduleRender();
    }, delay);
  });
})();
