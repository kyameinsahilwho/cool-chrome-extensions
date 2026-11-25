# Item Numbers

**Item Numbers is a free Chrome extension that puts a small number badge on each repeated item of a web page, such as search results, feed posts, product tiles, comment rows and chat lists, so you can tell which entry you last looked at and which one comes next.**

<p align="center">
  <img alt="Chrome Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white">
  <img alt="Vanilla JavaScript" src="https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black">
  <img alt="Shortcut Alt+Shift+N" src="https://img.shields.io/badge/shortcut-Alt%2BShift%2BN-4f46e5">
  <img alt="No network requests" src="https://img.shields.io/badge/network%20requests-none-059669">
</p>

Pages rarely number these entries, because they are not `<ol>` lists, just the same block repeated. Item Numbers finds those blocks and counts them for you.

## Why Item Numbers

- **Works on any site.** No per-site rules: it detects lists on its own, including inside open shadow DOM.
- **One key to toggle.** Press **Alt+Shift+N** or click the toolbar button. The button shows `ON` while numbering is active.
- **Never touches the layout.** Badges sit in a transparent overlay above the page, and clicks pass straight through.
- **Keeps up with infinite scroll.** Numbers update as the page loads more entries, filters or "load more" results.
- **Fully local.** About 600 lines of plain JavaScript that make no network requests.

## Features

**Using it**
- Click the toolbar button or press **Alt+Shift+N** to turn numbers on or off in the current tab.
- Right-click the toolbar button for:
  - **Always number items on _this site_**, which turns numbering on automatically whenever you open that site.
  - **Also number lists inside list items**, which numbers inner lists as well (for example the replies inside each comment). It is off by default, so only the outer list is numbered.
- Change the shortcut at `chrome://extensions/shortcuts`.

**How badges look**
- Each separate list gets its own colour from a palette of 8 and starts again at 1.
- In single-column lists the badge sits in the left margin. In grids it sits on each tile's top-left corner.
- In an entry taller than the screen, the badge slides down with you as you scroll.

## How it decides what to number

- It looks for 3 or more sibling elements of the same kind (same tag and mostly the same classes). Classes that only describe state, like `active`, `is-open` or `card--featured`, are ignored, so a highlighted entry still counts as part of its list.
- Each entry has to look like content: something clickable, plus about 20 characters of visible text or a picture. That skips menus, nav bars, tag chips, icon rows and plain paragraphs.
- When a parent holds two interleaved kinds of rows, as on Hacker News (title row, then a points row), only one kind is numbered, normally the first.
- Lists of the same kind sitting next to each other, such as one list per date heading in a chat sidebar, are numbered as one continuous run.
- Hidden entries (filtered out, collapsed) are not counted.

## Install

1. Download or clone [cool-chrome-extensions](https://github.com/kyameinsahilwho/cool-chrome-extensions).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `item-numbers` folder.
4. Pin the extension so its button is on the toolbar.

## Privacy and permissions

- Item Numbers makes no network requests and has no analytics. Your two settings (nested lists, and the sites set to always on) are stored with `chrome.storage.sync`.
- `<all_urls>`, `scripting` and `activeTab` let it draw numbers on whatever page you turn it on for, including tabs that were open before you installed it.
- `contextMenus` adds the right-click options on the toolbar button.

## Limits

- Sites that only keep the on-screen rows in the page (virtualized lists, as on X/Twitter) can only number the rows currently loaded, so numbers start again from what is rendered.
- Content inside iframes is not numbered.
- Chrome's own pages (`chrome://`, the Web Store) do not allow extensions.

## Files

- `manifest.json`: Manifest V3 config, shortcut, permissions
- `background.js`: toolbar button, shortcut, right-click menu, per-site setting
- `content.js`: finds the repeated items and draws the numbers
- `icons/`: toolbar and store icons

## FAQ

### Is Item Numbers free?

Yes. It is free, needs no account and has no paid features.

### How do I number Google search results?

Open the results page and press **Alt+Shift+N**, or click the Item Numbers toolbar button. To have it on every time, right-click the button and choose **Always number items on** the site.

### Does Item Numbers change the page or slow it down?

It does not change the page's layout. Badges are drawn in a separate overlay with clicks passing through, and it only scans pages where you turned it on.

### Why do the numbers restart on X (Twitter)?

X keeps only the rows near the screen in the page, so Item Numbers can only count what is currently loaded. Most other sites keep every loaded entry, and numbering continues as you scroll.

### Does Item Numbers send my browsing data anywhere?

No. It makes no network requests. Everything runs inside the page and your settings stay in your Chrome profile.

---

**Part of [CodingMarvel](https://codingmarvel.com).** More in this collection: [Himekuri Countdown](../himekuri-countdown) · [Grok Chat Date Categorizer](../grok-chat-date-categorizer) · [all Chrome extensions](https://github.com/kyameinsahilwho/cool-chrome-extensions)

More from CodingMarvel: [Ehmatrix](https://ehmatrix.codingmarvel.com) · [Pollytasks](https://pollytasks.codingmarvel.com) · [HabitGrid](https://habitgrid.codingmarvel.com) · [Love for PDF](https://pdf.codingmarvel.com) · [Video Grid Maker](https://video-grid-maker.codingmarvel.com)
