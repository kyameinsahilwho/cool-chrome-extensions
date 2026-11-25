# Grok Chat Date Categorizer

**Grok Chat Date Categorizer is a free Chrome extension that sorts the chat history in the Grok (xAI) sidebar under one header per day, such as "20 Mar, Friday (Today)", while keeping your pinned chats at the top.**

<p align="center">
  <img alt="Chrome Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white">
  <img alt="Vanilla JavaScript" src="https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black">
  <img alt="Runs on grok.com" src="https://img.shields.io/badge/runs%20on-grok.com-111111">
</p>

Grok's sidebar lists every chat in one long column. This extension splits it into days so you can find "the chat from last Tuesday" at a glance, and it uses Grok's own colour variables so it looks like part of Grok.

## Why Grok Chat Date Categorizer

- **One header per day.** Headers read like `20 Mar, Friday (Today)`, `19 Mar, Thursday (Yesterday)` and `18 Mar, Wednesday`. Older years add the year.
- **Your whole history, not just what is on screen.** It reads Grok's own conversations API, 100 chats per page and up to 20 pages, then refreshes every 2 minutes and whenever you return to the tab.
- **Pinned chats stay on top** in Grok's own order, without an extra "Pinned" header.
- **Native controls.** Clicking a chat, pinning and the options menu all go through Grok's own buttons, so nothing about Grok's behaviour changes.
- **Narrow permissions.** It only asks for `storage` and only runs on `grok.com` and `*.x.ai`.

## Features

**Sidebar**
- Chats grouped by individual calendar day, newest day first, newest chat first inside each day.
- Optional count badge on each day header.
- Hover a chat to see its exact timestamp ("Active: ..." or "Created: ...").
- Project chats are left out of the history list, so it only shows your regular chats.
- Collapsing Grok's **Chats** section also hides the grouped view.

**Popup**
- **Date criteria**: group by **Last Active Date** (when the last message happened) or **Creation Date** (when the chat was started).
- **Show Count Badges** toggle.
- Live stats: total chats, chats today and chats in the past 7 days.
- A **Sync Chats Now** button that refreshes the counts.

## Install

1. Download or clone [cool-chrome-extensions](https://github.com/kyameinsahilwho/cool-chrome-extensions).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `grok-chat-date-categorizer` folder.
4. Open or refresh [grok.com](https://grok.com). Your sidebar chats are now grouped by day.

## How it works and privacy

- `page-bridge.js` runs in the page and watches Grok's `/rest/app-chat/conversations` responses. It also pages through that endpoint with your existing grok.com session to load older chats.
- `content.js` merges what it receives with the chats in the sidebar, groups them by day and draws the grouped list in place of Grok's own list.
- Only chat IDs, titles, timestamps and pin state are cached, in `chrome.storage.local` on your computer. Nothing is sent anywhere except grok.com itself.

## Limits

- The extension relies on Grok's sidebar layout (the **Chats** group). If Grok redesigns its sidebar, grouping may stop until the extension is updated.
- A chat that appears in the sidebar before the API data arrives gets an approximate time for a moment, then moves to its correct day.

## Files

- `manifest.json`: Manifest V3 config, permissions, content scripts
- `page-bridge.js`: main-world script that reads Grok's conversations API and handles navigation
- `content.js`: sidebar detection, day grouping, rendering and the local cache
- `content.css`: Grok-matching styles for headers, badges and rows
- `background.js`: service worker that sets the default settings
- `popup.html`, `popup.css`, `popup.js`: settings, stats and sync
- `icons/`: icons at 16, 32, 48 and 128 px

## FAQ

### Is Grok Chat Date Categorizer free?

Yes. It is free, needs no extra account and has no paid features. You only need your normal Grok login.

### How do I organize Grok chats by date?

Install this extension with **Load unpacked**, then refresh grok.com. The sidebar's chat list is replaced by one section per day.

### Does it send my Grok chats anywhere?

No. It only talks to grok.com, using the session you are already signed in with, and it caches chat titles and timestamps locally in Chrome. It never stores or sends the messages inside your chats; it only keeps chat IDs, titles, timestamps and pin state.

### Can I group chats by the day they were created?

Yes. Open the extension popup and choose **Creation Date** under Date criteria. The default is **Last Active Date**.

### Why are some chats missing from the grouped list?

Project chats are left out on purpose. If regular chats are missing, refresh grok.com so the extension can reload your history from Grok's API.

---

**Part of [CodingMarvel](https://codingmarvel.com).** More in this collection: [Himekuri Countdown](../himekuri-countdown) · [Item Numbers](../item-numbers) · [all Chrome extensions](https://github.com/kyameinsahilwho/cool-chrome-extensions)

More from CodingMarvel: [Ehmatrix](https://ehmatrix.codingmarvel.com) · [Pollytasks](https://pollytasks.codingmarvel.com) · [HabitGrid](https://habitgrid.codingmarvel.com) · [Love for PDF](https://pdf.codingmarvel.com) · [Video Grid Maker](https://video-grid-maker.codingmarvel.com)
