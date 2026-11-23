# Item Numbers

A Chrome extension that puts a small number on each repeated item of a page (search results,
feed posts, product tiles, comment rows, chat lists in a sidebar), so you can tell which entry
you last looked at and which one comes next. Pages rarely number these, because they aren't
`<ol>` lists, just the same block repeated.

## Install

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and select this `item-numbers` folder.
3. Pin the extension so its button is on the toolbar.

## Use

- **Click the toolbar button** or press **Alt+Shift+N** to turn numbers on or off in the
  current tab. The button shows `ON` while numbering is active.
- **Right-click the toolbar button** for:
  - **Always number items on _this site_** turns numbering on automatically whenever you
    open that site.
  - **Also number lists inside list items** numbers inner lists as well (for example the
    replies inside each comment). Off by default, so only the outer list is numbered.

The shortcut can be changed at `chrome://extensions/shortcuts`.

## How it decides what to number

- It looks for 3 or more sibling elements of the same kind (same tag and mostly the same
  classes). Classes that only describe state, like `active`, `is-open` or `card--featured`,
  are ignored, so a highlighted entry still counts as part of its list.
- Each entry has to look like content: something clickable, plus about 20 characters of
  visible text or a picture. That skips menus, nav bars, tag chips, icon rows and plain
  paragraphs.
- When a parent holds two interleaved kinds of rows, as on Hacker News (title row, then a
  points row), only one kind is numbered, normally the first.
- Lists of the same kind sitting next to each other, such as one list per date heading in a
  chat sidebar, are numbered as one continuous run.
- Each separate list gets its own colour and starts again at 1.
- Hidden entries (filtered out, collapsed) aren't counted. The numbers update as the page loads more entries
  (infinite scroll, filters, "load more").

Badges sit in a transparent layer above the page. They don't change the page's layout, and
clicks go straight through them. In single-column lists the badge sits in the left margin; in
grids it sits on each tile's top-left corner. In an entry taller than the screen, the badge
slides down with you as you scroll.

## Limits

- Sites that only keep the on-screen rows in the page (virtualized lists, as on X/Twitter)
  can only number the rows currently loaded, so numbers start again from what's rendered.
- Content inside iframes isn't numbered.
- Chrome's own pages (`chrome://`, the Web Store) don't allow extensions.

## Files

- `manifest.json`: Manifest V3 config, shortcut, permissions.
- `background.js`: toolbar button, shortcut, right-click menu, per-site setting.
- `content.js`: finds the repeated items and draws the numbers.
- `icons/`: toolbar and store icons.
