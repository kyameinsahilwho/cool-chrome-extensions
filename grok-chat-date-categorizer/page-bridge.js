// page-bridge.js - Runs in the MAIN world context of grok.com
// Intercepts Grok conversations API responses and provides main-world fetch capabilities.

(() => {
  "use strict";

  if (window.__GROK_DATE_CATEGORIZER_PAGE_BRIDGE__) {
    return;
  }
  window.__GROK_DATE_CATEGORIZER_PAGE_BRIDGE__ = true;

  const API_ENDPOINT = "/rest/app-chat/conversations";
  const bufferedConversations = [];

  // Helper to safely post messages to the isolated content script
  function notifyContentScript(type, payload) {
    try {
      window.postMessage({
        source: "GROK_DATE_CATEGORIZER_BRIDGE",
        type,
        payload
      }, "*");
    } catch (err) {
      console.warn("[Grok Date Categorizer Bridge] PostMessage error:", err);
    }
  }

  // 1. Intercept window.fetch to automatically capture conversation API calls
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const urlStr = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
      if (urlStr.includes(API_ENDPOINT)) {
        const clone = response.clone();
        clone.json().then((data) => {
          if (!data) return;
          const list = data?.conversations || data?.result?.conversations || data?.data?.conversations || data?.items || [];
          if (Array.isArray(list) && list.length > 0) {
            bufferedConversations.push(...list);
          }
          notifyContentScript("CONVERSATIONS_API_DATA", data);
        }).catch(() => {});
      }
    } catch (e) {
      // Non-blocking catch
    }
    return response;
  };

  // 2. Main-world fetcher function that can page through all conversations
  async function fetchAllConversations(maxPages = 20) {
    let pageToken = "";
    let pagesLoaded = 0;
    const allConversations = [];

    try {
      while (pagesLoaded < maxPages) {
        const url = new URL(API_ENDPOINT, window.location.origin);
        url.searchParams.set("pageSize", "100");
        if (pageToken) {
          url.searchParams.set("pageToken", pageToken);
        }

        const res = await originalFetch(url.href, {
          cache: "no-store",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          },
          method: "GET"
        });

        if (!res.ok) {
          break;
        }

        const data = await res.json();
        const list = data?.conversations || data?.result?.conversations || data?.data?.conversations || data?.items || [];
        if (Array.isArray(list) && list.length > 0) {
          allConversations.push(...list);
        }

        pageToken = data?.nextPageToken || data?.result?.nextPageToken || data?.data?.nextPageToken || data?.next_page_token || "";
        pagesLoaded++;

        if (!pageToken || list.length === 0) {
          break;
        }
      }

      notifyContentScript("FETCH_ALL_RESULT", {
        conversations: allConversations,
        success: true
      });
    } catch (err) {
      notifyContentScript("FETCH_ALL_RESULT", {
        conversations: allConversations,
        success: false,
        error: String(err?.message || err)
      });
    }
  }

  // 3. Listen for commands from the isolated content script
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "GROK_DATE_CATEGORIZER_CONTENT") {
      return;
    }

    const { type, payload } = event.data;

    if (type === "CONTENT_READY" || type === "PING_BRIDGE") {
      if (bufferedConversations.length > 0) {
        notifyContentScript("CONVERSATIONS_API_DATA", { conversations: bufferedConversations });
      }
      fetchAllConversations(payload?.maxPages || 20);
    } else if (type === "TRIGGER_FETCH_ALL") {
      fetchAllConversations(payload?.maxPages || 20);
    } else if (type === "NAVIGATE_TO") {
      const targetPath = payload?.path;
      if (targetPath) {
        try {
          if (window.__next && window.__next.router) {
            window.__next.router.push(targetPath);
            return;
          }
        } catch (e) {}

        window.history.pushState({}, "", targetPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  });

  // Signal ready
  notifyContentScript("BRIDGE_READY", { timestamp: Date.now() });
})();
