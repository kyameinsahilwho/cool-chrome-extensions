# Grok Chat Date Categorizer & Separator (Chrome Extension)

An ultra-clean, high-performance Chrome Extension (Manifest V3) that organizes and separates your Grok (xAI) chats by date in the sidebar, matching Grok's native UI and design language.

## ✨ Features

- 📅 **Day-by-Day Date Grouping**: Categorizes every single day individually formatted as `(date, day)`:
  - e.g. `20 Mar, Friday (Today)`
  - e.g. `19 Mar, Thursday (Yesterday)`
  - e.g. `18 Mar, Wednesday`, `17 Mar, Tuesday`, etc.
- 📌 **Native Pinned Chats**: Pinned chats stay pinned at the top without any "Pinned" title or header clutter, preserving their original order and pin icon.
- 👁️ **Always Visible**: Clean, distraction-free sections that stay permanently visible (non-collapsible).
- 📁 **Project Isolation**: Project chats (e.g. from the Projects section) are kept isolated and excluded from standard chat history.
- ⚡ **Native Look & Feel**: Built with Grok's exact typography, colors, dark/light theme support, and sleek hover effects.
- 🎯 **Full Native Compatibility**:
  - Clicking any chat navigates using Grok's native client router without full page reloads.
  - Pinning, unpinning, and options menus work directly with Grok's native backend.
  - Tooltip on hover reveals the exact timestamp.
- ⚙️ **Popup Controls**:
  - Master toggle switch to enable/disable categorization anytime.
  - Switch sorting criteria between **Last Active Date** (`modifyTime`) and **Creation Date** (`createTime`).
  - Toggle chat count badges.
  - "Sync Chats Now" button to manually pull latest conversation metadata.
  - Real-time chat statistics (Total, Today, Past 7 Days).

---

## 🚀 How to Install in Chrome

1. Open Google Chrome.
2. In the URL address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the extension directory:
   ```text
   d:\SKS coding\Chrome extensions
   ```
6. Open or refresh **[https://grok.com](https://grok.com)**.
7. Your chats in the sidebar will now be neatly categorized by date!

---

## 🛠️ File Structure

- `manifest.json`: Manifest V3 configuration, permissions, content scripts, and assets.
- `content.js`: Isolated world script handling DOM detection, date bucketing, UI rendering, and caching.
- `content.css`: Native Grok matching styles for headers, badges, rows, and animations.
- `page-bridge.js`: Main world script that intercepts Grok's conversations API and provides synchronization.
- `background.js`: Service worker managing extension lifecycle and defaults.
- `popup.html`, `popup.css`, `popup.js`: Extension popup UI for settings, live stats, and sync.
- `icons/`: Extension icons in 16x16, 32x32, 48x48, and 128x128 formats.
