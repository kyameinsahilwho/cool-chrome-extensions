// Item Numbers — content script.
// Finds groups of sibling elements that repeat (result rows, cards, feed posts, comments)
// and draws a small number badge on each one, in an overlay that never touches the page's
// own layout or blocks clicks.

(() => {
  'use strict';

  // If an older copy of this script is still around (extension reloaded, or injected
  // twice), shut it down so this one takes over cleanly.
  try { globalThis.__itemNumbersCleanup?.(); } catch {}
  document.querySelectorAll('[data-item-numbers-host]').forEach((n) => n.remove());

  const MIN_ITEMS = 3;
  const HTML_NS = 'http://www.w3.org/1999/xhtml';

  // Never look inside these.
  const SKIP_SUBTREE = new Set([
    'script', 'style', 'noscript', 'template', 'svg', 'math', 'pre', 'code', 'select',
    'textarea', 'iframe', 'canvas', 'video', 'audio', 'object', 'embed', 'head', 'picture',
  ]);
  // Never number these themselves (their children may still be lists).
  const SKIP_ITEM = new Set([
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'wbr', 'img', 'source', 'track',
    'input', 'option', 'optgroup', 'label', 'td', 'th', 'col', 'colgroup', 'caption',
    'thead', 'tbody', 'tfoot', 'b', 'i', 'em', 'strong', 'u', 's', 'small', 'sub', 'sup',
    'abbr', 'cite', 'q', 'mark', 'time', 'kbd', 'samp', 'var', 'dfn', 'bdi', 'bdo', 'data',
    'meta', 'link', 'area', 'map', 'legend', 'param', 'summary', 'slot',
  ]);
  const ITEM_TAGS = new Set(['li', 'tr', 'article', 'dt']);
  const ITEM_ROLES = new Set(['listitem', 'article', 'row', 'option', 'treeitem', 'gridcell', 'feed']);
  const ACTION_SEL = 'a[href],button,[role="link"],[role="button"],[onclick]';
  const MEDIA_SEL = 'img,video,picture,canvas,[style*="background-image"]';
  // Classes that describe state rather than kind (`active`, `is-open`, `card--featured`...)
  // or are per-item ids (`post-12345`). Ignored when deciding whether siblings match.
  const STATE_RE = /(^|[-_])(active|selected|current|focus(ed)?|hover(ed)?|open(ed)?|expanded|collapsed|visited|checked|disabled|hidden|first|last|odd|even|new|unread|read|highlight(ed)?|show|visible|loading|loaded)($|[-_])|^(is|has)[-_]|--|\d{3,}/i;
  const COLORS = ['#4f46e5', '#e11d48', '#059669', '#d97706', '#0891b2', '#7c3aed', '#db2777', '#65a30d'];

  let enabled = false;
  let nested = false;
  let groups = []; // [{ items: Element[], color, clipsByParent: Map }]
  let host = null;
  let layer = null;
  const pool = [];
  let observer = null;
  let rafId = 0;
  let scanTimer = 0;
  let scanDeadline = 0;
  let tickTimer = 0;
  let scrollScanTimer = 0;

  // ---------- DOM helpers ----------

  function parentOf(node) {
    if (node instanceof ShadowRoot) return node.host;
    return node.parentElement || (node.parentNode instanceof ShadowRoot ? node.parentNode.host : null);
  }

  function classesOf(el) {
    const out = [];
    if (el.classList) for (const c of el.classList) if (!STATE_RE.test(c)) out.push(c);
    return out;
  }

  function sigOf(node) {
    if (node instanceof ShadowRoot) return '#shadow';
    return node.localName + '.' + classesOf(node).sort().join('.');
  }

  function jaccard(a, b) {
    if (!a.length && !b.length) return 1;
    const sb = new Set(b);
    let inter = 0;
    for (const c of a) if (sb.has(c)) inter++;
    return inter / (a.length + b.length - inter);
  }

  const nodeIds = new WeakMap();
  let nextNodeId = 1;
  function idOf(node) {
    if (!node) return 0;
    let id = nodeIds.get(node);
    if (!id) nodeIds.set(node, (id = nextNodeId++));
    return id;
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // ---------- Detection ----------

  // Every element (and open shadow root) with enough children to hold a list.
  function collectParents(root, out) {
    if (root.childElementCount >= MIN_ITEMS) out.push(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n === host || SKIP_SUBTREE.has(n.localName)) return NodeFilter.FILTER_REJECT;
        const ce = n.getAttribute('contenteditable');
        if (ce !== null && ce !== 'false') return NodeFilter.FILTER_REJECT; // editors
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.childElementCount >= MIN_ITEMS) out.push(n);
      if (n.shadowRoot) collectParents(n.shadowRoot, out);
    }
  }

  // Split a parent's children into clusters of look-alike siblings.
  function clusterChildren(parent) {
    const clusters = [];
    let seen = 0;
    for (const child of parent.children) {
      if (++seen > 3000) break;
      const tag = child.localName;
      if (child.namespaceURI !== HTML_NS || SKIP_ITEM.has(tag) || SKIP_SUBTREE.has(tag) || child === host) continue;
      const role = child.getAttribute('role') || '';
      const cls = classesOf(child);
      let target = null;
      for (const c of clusters) {
        if (c.tag === tag && c.role === role && jaccard(cls, c.cls) >= 0.5) { target = c; break; }
      }
      if (target) target.items.push(child);
      else clusters.push({ tag, role, cls, items: [child] });
    }
    return clusters.filter((c) => c.items.length >= MIN_ITEMS);
  }

  // Is this element visible, and does it look like a real entry (has something to click
  // plus some text or a picture) rather than a nav link, icon or spacer?
  function inspect(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 10) return null;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true })) return null;
    if (el.localName === 'tr' && !el.querySelector('td')) return null; // header rows
    // Rendered text only, so a nav button with a hidden dropdown menu doesn't count as wordy.
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim().length;
    const actionable =
      ITEM_TAGS.has(el.localName) ||
      ITEM_ROLES.has(el.getAttribute('role')) ||
      el.matches(ACTION_SEL) ||
      !!el.querySelector(ACTION_SEL);
    const area = r.width * r.height;
    const media = area >= 5000 && (el.matches(MEDIA_SEL) || !!el.querySelector(MEDIA_SEL));
    return { text, height: r.height, ok: actionable && (text >= 20 || media) };
  }

  function evaluate(items) {
    const visible = [];
    let ok = 0;
    let textSum = 0;
    let heightSum = 0;
    for (const el of items) {
      const info = inspect(el);
      if (!info) continue;
      visible.push(el);
      if (info.ok) ok++;
      textSum += Math.min(info.text, 300);
      heightSum += info.height;
    }
    const n = visible.length;
    if (n < MIN_ITEMS || ok / n < 0.6) return null;
    if (heightSum / n > innerHeight * 3) return null; // page-sized layout blocks, not entries
    return { items: visible, n, avgText: textSum / n };
  }

  const scoreOf = (n, avgText) => Math.pow(n, 1.5) * Math.log2(2 + avgText);

  function scan() {
    scanTimer = 0;
    scanDeadline = 0;
    if (!enabled || !document.body) return;

    const parents = [];
    collectParents(document.body, parents);

    // One list per parent: the best-scoring cluster (earliest one if it's close, so
    // Hacker News-style "title row + detail row" pairs number the title rows).
    const merged = new Map();
    for (const parent of parents) {
      const passing = [];
      for (const cl of clusterChildren(parent)) {
        const ev = evaluate(cl.items);
        if (ev) passing.push({ ...ev, cl, score: scoreOf(ev.n, ev.avgText) });
      }
      if (!passing.length) continue;
      const max = Math.max(...passing.map((p) => p.score));
      const best = passing.find((p) => p.score >= 0.75 * max);

      // Lists of the same kind that sit side by side (e.g. one <ul> per date heading)
      // are joined into one continuous sequence.
      const anchor = parentOf(parentOf(parent) || parent);
      const key = `${best.cl.tag}[${best.cl.role}].${[...best.cl.cls].sort().join('.')}|${sigOf(parent)}|${idOf(anchor)}`;
      let g = merged.get(key);
      if (!g) merged.set(key, (g = { key, items: [], n: 0, textSum: 0 }));
      g.items.push(...best.items);
      g.n += best.n;
      g.textSum += best.avgText * best.n;
    }

    const candidates = [...merged.values()]
      .map((g) => ({ ...g, score: scoreOf(g.n, g.textSum / g.n) }))
      .sort((a, b) => b.score - a.score);

    // Unless nested lists are wanted, keep only the strongest list in any branch of the
    // page: drop a group whose items contain, or sit inside, an already chosen item.
    const chosen = [];
    const taken = new Set();
    const takenAncestors = new Set();
    for (const g of candidates) {
      if (!nested) {
        let conflict = false;
        outer: for (const el of g.items) {
          if (taken.has(el) || takenAncestors.has(el)) { conflict = true; break; }
          for (let p = parentOf(el); p; p = parentOf(p)) {
            if (taken.has(p)) { conflict = true; break outer; }
          }
        }
        if (conflict) continue;
      }
      chosen.push(g);
      for (const el of g.items) {
        taken.add(el);
        if (!nested) for (let p = parentOf(el); p && !takenAncestors.has(p); p = parentOf(p)) takenAncestors.add(p);
      }
    }

    // Colour follows the kind of item (stable across rescans); neighbours that would
    // share a colour move to the next free one.
    const used = new Set();
    groups = chosen.map((g) => {
      let c = hashStr(g.key.split('|')[0]) % COLORS.length;
      for (let k = 0; k < COLORS.length && used.has(c); k++) c = (c + 1) % COLORS.length;
      used.add(c);
      // Single-column list (every item starts at the same x)? Then the badge can sit in
      // the left margin instead of over the content.
      const lefts = g.items.map((el) => el.getBoundingClientRect().left);
      const column = Math.max(...lefts) - Math.min(...lefts) < 3;
      return { items: g.items, color: COLORS[c], column, clipsByParent: new Map() };
    });
    for (const g of groups) {
      for (const el of g.items) {
        const p = parentOf(el);
        if (p && !g.clipsByParent.has(p)) g.clipsByParent.set(p, clipAncestors(p));
      }
    }
    scheduleRender();
  }

  // Ancestors that scroll or clip, so badges for items scrolled out of a sidebar don't
  // float over the rest of the page.
  function clipAncestors(start) {
    const out = [];
    for (let a = start; a && a !== document.body && a !== document.documentElement; a = parentOf(a)) {
      if (a instanceof ShadowRoot) continue;
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') out.push(a);
      if (cs.position === 'fixed') break;
    }
    return out;
  }

  // ---------- Rendering ----------

  function ensureHost() {
    if (host) {
      if (!host.isConnected) document.documentElement.appendChild(host);
      return;
    }
    host = document.createElement('div');
    host.setAttribute('data-item-numbers-host', '');
    host.style.cssText =
      'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden;contain:strict;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      .b {
        position: absolute; top: 0; left: 0;
        box-sizing: border-box; min-width: 18px; height: 18px; padding: 0 5px;
        border-radius: 9px; border: 1.5px solid #fff;
        font: 700 11px/15px system-ui, -apple-system, "Segoe UI", sans-serif;
        font-variant-numeric: tabular-nums; text-align: center; color: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,.35); opacity: .95;
        white-space: nowrap; will-change: transform;
      }
    </style><div class="l"></div>`;
    layer = root.querySelector('.l');
    document.documentElement.appendChild(host);
  }

  function badge(i) {
    let b = pool[i];
    if (!b) {
      b = document.createElement('div');
      b.className = 'b';
      b._text = '';
      b._color = '';
      layer.appendChild(b);
      pool[i] = b;
    }
    return b;
  }

  function hide(b) {
    if (b.style.display !== 'none') b.style.display = 'none';
  }

  function render() {
    rafId = 0;
    if (!enabled) return;
    ensureHost();
    const vw = document.documentElement.clientWidth || innerWidth;
    const vh = innerHeight;
    const rectCache = new Map();
    const rectOf = (el) => {
      let r = rectCache.get(el);
      if (!r) rectCache.set(el, (r = el.getBoundingClientRect()));
      return r;
    };

    let i = 0;
    for (const g of groups) {
      let num = 0;
      for (const el of g.items) {
        num++;
        const b = badge(i++);
        if (!el.isConnected) { hide(b); continue; }
        const r = el.getBoundingClientRect();
        if ((!r.width && !r.height) || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) { hide(b); continue; }

        // Visible part of the item: viewport ∩ every clipping ancestor.
        let top = 0, left = 0, bottom = vh, right = vw;
        const clips = g.clipsByParent.get(parentOf(el)) || [];
        for (const c of clips) {
          if (!c.isConnected) continue;
          const cr = rectOf(c);
          if (cr.top > top) top = cr.top;
          if (cr.left > left) left = cr.left;
          if (cr.bottom < bottom) bottom = cr.bottom;
          if (cr.right < right) right = cr.right;
        }
        const visTop = Math.max(r.top, top);
        const visBottom = Math.min(r.bottom, bottom);
        if (visBottom - visTop < 10 || Math.min(r.right, right) - Math.max(r.left, left) < 10) { hide(b); continue; }

        // Lists: in the left margin. Grids: straddling the top-left corner. Either way it
        // slides down with you while you read an item taller than the screen.
        const text = String(num);
        const width = Math.max(18, 10 + 7 * text.length);
        const x = Math.max(left + 1, g.column ? r.left - width - 3 : r.left - 6);
        const y = Math.max(top + 1, g.column ? r.top + 1 : r.top - 6);

        if (b._text !== text) { b.textContent = text; b._text = text; }
        if (b._color !== g.color) { b.style.background = g.color; b._color = g.color; }
        b.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.min(y, visBottom - 18))}px)`;
        if (b.style.display === 'none') b.style.display = '';
      }
    }
    for (; i < pool.length; i++) hide(pool[i]);
  }

  function scheduleRender() {
    if (enabled && !rafId) rafId = requestAnimationFrame(render);
  }

  // Debounced rescan: waits for the page to go quiet, but never more than 1.5 s.
  function scheduleScan(delay = 300) {
    if (!enabled) return;
    const now = Date.now();
    if (!scanDeadline) scanDeadline = now + 1500;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, Math.max(0, Math.min(delay, scanDeadline - now)));
  }

  // ---------- On / off ----------

  function onScroll() {
    scheduleRender();
    clearTimeout(scrollScanTimer);
    scrollScanTimer = setTimeout(() => scheduleScan(0), 500); // catch lazy-loaded rows
  }

  function onResize() {
    scheduleRender();
    scheduleScan();
  }

  function onMutations(records) {
    for (const r of records) {
      if (r.target === host || (r.target === document.documentElement && [...r.addedNodes, ...r.removedNodes].every((n) => n === host))) continue;
      scheduleScan();
      return;
    }
  }

  function start() {
    ensureHost();
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'open', 'aria-hidden', 'aria-expanded'],
    });
    addEventListener('scroll', onScroll, { capture: true, passive: true });
    addEventListener('resize', onResize, { passive: true });
    tickTimer = setInterval(scheduleRender, 1000); // images loading, animations settling
    scan();
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    removeEventListener('scroll', onScroll, { capture: true });
    removeEventListener('resize', onResize);
    clearInterval(tickTimer);
    clearTimeout(scanTimer);
    clearTimeout(scrollScanTimer);
    cancelAnimationFrame(rafId);
    rafId = scanTimer = scanDeadline = 0;
    groups = [];
    pool.length = 0;
    host?.remove();
    host = layer = null;
  }

  function report() {
    try { chrome.runtime.sendMessage({ type: 'state', enabled }).catch(() => {}); } catch {}
  }

  function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    if (on) start();
    else stop();
    report();
  }

  // ---------- Wiring ----------

  function onMessage(msg, _sender, reply) {
    if (msg?.type === 'toggle') setEnabled(!enabled);
    else if (msg?.type === 'set') setEnabled(!!msg.enabled);
    else if (msg?.type !== 'getState') return;
    reply({ enabled });
  }

  function onStorage(changes, area) {
    if (area !== 'sync' || !changes.itemNumbers) return;
    const s = changes.itemNumbers.newValue || {};
    if (!!s.nested !== nested) {
      nested = !!s.nested;
      if (enabled) scan();
    }
    if (s.sites?.[location.hostname] && !changes.itemNumbers.oldValue?.sites?.[location.hostname]) setEnabled(true);
  }

  chrome.runtime.onMessage.addListener(onMessage);
  chrome.storage.onChanged.addListener(onStorage);

  globalThis.__itemNumbersCleanup = () => {
    stop();
    enabled = false;
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch {}
    try { chrome.storage.onChanged.removeListener(onStorage); } catch {}
  };

  chrome.storage.sync.get('itemNumbers').then(({ itemNumbers }) => {
    nested = !!itemNumbers?.nested;
    if (itemNumbers?.sites?.[location.hostname]) setEnabled(true);
    else report(); // clears a stale toolbar badge
  }).catch(() => {});
})();
