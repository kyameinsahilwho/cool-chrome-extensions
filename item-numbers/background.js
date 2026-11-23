// Item Numbers — service worker.
// Clicking the toolbar button (or Alt+Shift+N) toggles numbering in the current tab.
// Right-clicking the button gives "Always on for this site" and "number nested lists".

const DEFAULTS = { nested: false, sites: {} };

async function getSettings() {
  const { itemNumbers } = await chrome.storage.sync.get('itemNumbers');
  return { ...DEFAULTS, ...itemNumbers, sites: { ...(itemNumbers?.sites || {}) } };
}

function saveSettings(settings) {
  return chrome.storage.sync.set({ itemNumbers: settings });
}

function hostOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : '';
  } catch {
    return '';
  }
}

function setBadge(tabId, enabled) {
  chrome.action.setBadgeText({ tabId, text: enabled ? 'ON' : '' }).catch(() => {});
  if (enabled) chrome.action.setBadgeBackgroundColor({ tabId, color: '#4f46e5' }).catch(() => {});
}

// Send a message to the tab's content script, injecting it first if the tab was
// opened before the extension was installed or reloaded.
async function send(tab, msg) {
  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      return await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      return null; // chrome:// pages, the Web Store, etc.
    }
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  const res = await send(tab, { type: 'toggle' });
  if (res) setBadge(tab.id, res.enabled);
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'state' && sender.tab?.id != null) setBadge(sender.tab.id, msg.enabled);
});

// ---- Right-click menu on the toolbar button ----

async function createMenus() {
  await chrome.contextMenus.removeAll();
  const s = await getSettings();
  chrome.contextMenus.create({
    id: 'site',
    title: 'Always number items on this site',
    type: 'checkbox',
    contexts: ['action'],
  });
  chrome.contextMenus.create({
    id: 'nested',
    title: 'Also number lists inside list items',
    type: 'checkbox',
    checked: s.nested,
    contexts: ['action'],
  });
  refreshSiteMenu();
}

async function refreshSiteMenu() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const host = hostOf(tab?.url);
    const s = await getSettings();
    await chrome.contextMenus.update('site', {
      title: host ? `Always number items on ${host}` : 'Always number items on this site',
      checked: !!(host && s.sites[host]),
      enabled: !!host,
    });
  } catch {
    // Menu not created yet, or no window focused.
  }
}

chrome.runtime.onInstalled.addListener(createMenus);
chrome.runtime.onStartup.addListener(refreshSiteMenu);
chrome.tabs.onActivated.addListener(refreshSiteMenu);
chrome.windows.onFocusChanged.addListener(refreshSiteMenu);
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'loading') setBadge(tabId, false); // the content script reports again once loaded
  if (info.url && tab.active) refreshSiteMenu();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.itemNumbers) refreshSiteMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const s = await getSettings();
  if (info.menuItemId === 'nested') {
    s.nested = info.checked;
    await saveSettings(s);
  } else if (info.menuItemId === 'site') {
    const host = hostOf(tab?.url);
    if (!host) return;
    if (info.checked) s.sites[host] = true;
    else delete s.sites[host];
    await saveSettings(s);
    if (info.checked) {
      const res = await send(tab, { type: 'set', enabled: true });
      if (res) setBadge(tab.id, res.enabled);
    }
  }
});
