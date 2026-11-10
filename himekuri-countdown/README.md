# Himekuri Countdown

A Chrome new-tab page that counts down to a date you choose, shown on big flip-calendar cards
(あと N 日 — "N days left") over an animated ink-wash landscape with drifting sakura petals.
The landscape is one place that drifts continuously through the day with your clock — the sky,
hills, sun and moon blend slowly from one look to the next, with no sudden switch.

## Install

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and select this `himekuri-countdown` folder.
3. Open a new tab. Chrome may ask whether to keep the changed new tab page — choose **Keep it**.
4. Enter what you're counting down to, the date, and press **Start countdown**.

To edit later, use the sliders button in the bottom-right corner.

### Also showing it as your homepage / on startup

Extensions can't point the Home button at their own page without a fixed ID, so use Chrome's settings:

- **On startup**: Settings → On startup → *Open the New Tab page*.
- **Home button**: Settings → Appearance → Show home button → *New Tab page*.

## Options

- **Days** — just the day count. The day before shows 1; on the day itself it reads "is here".
- **Days and hours** — adds an hours row (時間).
- **To the second** — hours, minutes and seconds (時間 分 秒), flipping live.
- **Background** — follows the time of day, loops through a whole day in 5 minutes, or pins one look.
  The four looks, and when each is at its fullest (between them the scene is a blend of the two):
  - Morning (7:00–8:30): red rising sun, a line of cranes, pink mist
  - Afternoon (12:30–15:00): Mount Fuji, woodblock-blue sky, banded kasumi clouds
  - Evening (18:00–18:45): sunset behind the ridge, a torii gate, crows heading home
  - Night (21:30–4:30): moon, stars
- **Falling petals** — turn the sakura on or off.

Settings sync through your Chrome account (`chrome.storage.sync`). If your system has
"reduce motion" turned on, the cards and background stay still.

## Files

- `newtab.html` / `styles.css` — page and design
- `countdown.js` — flip cards, countdown maths, settings sheet
- `scene.js` — canvas background: the four looks and how they blend (hours are in `phaseAt`,
  loop length is `LOOP_SECONDS`)
