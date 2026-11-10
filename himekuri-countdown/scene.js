// One ink-wash landscape that drifts through the day without ever cutting.
// Four designed looks are blended continuously by the clock:
//   morning   – red rising sun, a line of cranes, pink mist
//   afternoon – Mount Fuji under a woodblock-blue sky with banded kasumi clouds
//   evening   – the sun setting behind the ridge, a torii gate, crows heading home
//   night     – moon, stars and drifting sakura
(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HINT_KEY = 'himekuri-scene';

  // ---------- small helpers ----------

  // Seeded random so the landscape is the same place every time you open a tab.
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+a.toFixed(3)})`;

  // ---------- the four looks ----------

  // Ridge shapes, far → near. The land never changes; only the light does.
  const GEO = [
    { base: 0.66, amp: 0.2, f: [1.6, 4.1, 19] },
    { base: 0.73, amp: 0.15, f: [2.3, 5.9, 26] },
    { base: 0.82, amp: 0.12, f: [2.9, 7.4, 33] },
    { base: 0.93, amp: 0.1, f: [3.7, 9.8, 41] },
  ];

  const THEMES = {
    morning: {
      sky: [[0, '#7f93c2'], [0.25, '#b7a9cf'], [0.46, '#eab4b8'], [0.62, '#f9cfa8'], [0.8, '#fde8c4'], [1, '#fdf0d8']],
      layers: [
        { rgb: [196, 190, 218], fade: 0.1 },
        { rgb: [154, 162, 206], fade: 0.3 },
        { rgb: [106, 124, 180], fade: 0.65 },
        { rgb: [52, 70, 128], fade: 1 },
      ],
      mist: [255, 242, 234], mistA: 2.2,
      cloud: [255, 246, 238], cloudA: [0.55, 0],     // [first two cloud banks, the rest]
      fujiC: [176, 174, 210],
      petals: ['#f29bb0', '#f6b4c2', '#ee88a2', '#fbd0d9', '#f7a8bb'],
      show: { cranes: 1 },
    },
    afternoon: {
      // deep band at the very top is the bokashi gradation of woodblock skies
      sky: [[0, '#1c4a88'], [0.1, '#3f79b6'], [0.3, '#86b6d8'], [0.55, '#bcd9e2'], [0.75, '#e6ebd8'], [1, '#f6efdc']],
      layers: [
        { rgb: [168, 201, 190], fade: 0.12 },
        { rgb: [122, 174, 156], fade: 0.32 },
        { rgb: [74, 138, 122], fade: 0.7 },
        { rgb: [28, 86, 84], fade: 1 },
      ],
      mist: [255, 255, 250], mistA: 1.8,
      cloud: [253, 249, 238], cloudA: [0.86, 0.86],
      fujiC: [148, 176, 212],
      petals: ['#fbd3dc', '#f7b6c6', '#fde9ee', '#f3a9bd', '#ffffff'],
      show: { fuji: 1 },
    },
    evening: {
      sky: [[0, '#1d1b3f'], [0.22, '#45295c'], [0.4, '#94405e'], [0.52, '#d9653f'], [0.62, '#f2a04e'], [0.76, '#f8cf7a'], [1, '#f9dc9a']],
      layers: [
        { rgb: [160, 78, 100], fade: 0.22 },
        { rgb: [112, 54, 90], fade: 0.42 },
        { rgb: [70, 38, 76], fade: 0.75 },
        { rgb: [28, 20, 46], fade: 1 },
      ],
      mist: [255, 200, 160], mistA: 1.3,
      cloud: [255, 206, 158], cloudA: [0, 0],
      fujiC: [150, 86, 112],
      petals: ['#ffe3d6', '#ffd0c2', '#fbe9dc', '#ffc4b4', '#fff1e6'],
      show: { torii: 1, crows: 1, starsEarly: 1 },
    },
    night: {
      sky: [[0, '#0f1530'], [0.42, '#232650'], [0.66, '#4d4579'], [0.8, '#8a6f9c'], [1, '#c79bab']],
      layers: [
        { rgb: [118, 106, 154], fade: 0.15 },
        { rgb: [80, 73, 122], fade: 0.35 },
        { rgb: [46, 45, 88], fade: 0.7 },
        { rgb: [20, 24, 50], fade: 1 },
      ],
      mist: [226, 212, 236], mistA: 1,
      cloud: [206, 196, 226], cloudA: [0, 0],
      fujiC: [70, 66, 110],
      petals: ['#f8d6de', '#f2bfcb', '#fbe6ea', '#eeb3c2', '#f5cbd5'],
      show: { moon: 1, stars: 1 },
    },
  };
  const FLAGS = ['fuji', 'torii', 'moon', 'cranes', 'crows', 'stars', 'starsEarly'];
  const SKY_N = 16;

  // Bring every look to the same shape so any two can be mixed.
  const LOOK = {};
  for (const [key, t] of Object.entries(THEMES)) {
    const stops = t.sky.map(([p, c]) => [p, hex(c)]);
    const sky = [];
    for (let i = 0; i < SKY_N; i++) {
      const p = i / (SKY_N - 1);
      let j = 0;
      while (j < stops.length - 2 && p > stops[j + 1][0]) j++;
      const [p0, c0] = stops[j], [p1, c1] = stops[j + 1];
      sky.push(mix(c0, c1, clamp((p - p0) / (p1 - p0))));
    }
    const show = {};
    for (const f of FLAGS) show[f] = (t.show && t.show[f]) || 0;
    LOOK[key] = { ...t, sky, petals: t.petals.map(hex), show };
  }

  // Which looks are in play at hour h (0–24), and how far between them.
  // Each look holds for a while, then melts slowly into the next.
  function phaseAt(h) {
    const x = h < 4.5 ? h + 24 : h;
    if (x < 7) return ['night', 'morning', smooth(4.5, 7, x)];
    if (x < 8.5) return ['morning', 'morning', 0];
    if (x < 12.5) return ['morning', 'afternoon', smooth(8.5, 12.5, x)];
    if (x < 15) return ['afternoon', 'afternoon', 0];
    if (x < 18) return ['afternoon', 'evening', smooth(15, 18, x)];
    if (x < 18.75) return ['evening', 'evening', 0];
    if (x < 21.5) return ['evening', 'night', smooth(18.75, 21.5, x)];
    return ['night', 'night', 0];
  }

  function blendAt(h) {
    const [a, b, k] = phaseAt(h);
    const A = LOOK[a], B = LOOK[b];
    const show = {};
    for (const f of FLAGS) show[f] = lerp(A.show[f], B.show[f], k);
    return {
      name: k < 0.5 ? a : b,
      sky: A.sky.map((c, i) => mix(c, B.sky[i], k)),
      layers: A.layers.map((L, i) => ({ rgb: mix(L.rgb, B.layers[i].rgb, k), fade: lerp(L.fade, B.layers[i].fade, k) })),
      mist: mix(A.mist, B.mist, k),
      mistA: lerp(A.mistA, B.mistA, k),
      cloud: mix(A.cloud, B.cloud, k),
      cloudA: [lerp(A.cloudA[0], B.cloudA[0], k), lerp(A.cloudA[1], B.cloudA[1], k)],
      fujiC: mix(A.fujiC, B.fujiC, k),
      petals: A.petals.map((c, i) => css(mix(c, B.petals[i], k))),
      show,
    };
  }

  // ---------- what hour to show ----------

  const PIN = { morning: 7.6, afternoon: 13.75, evening: 18.35, night: 0.5 };
  const LOOP_SECONDS = 300;             // one whole day, in "loop" mode
  const MODES = ['auto', 'loop', ...Object.keys(PIN)];

  const clockH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };

  let mode = 'auto';
  try { const hint = localStorage.getItem(HINT_KEY); if (MODES.includes(hint)) mode = hint; } catch {}
  let loopH = clockH();
  const targetH = () => (mode === 'loop' && !reduce ? loopH : PIN[mode] != null ? PIN[mode] : clockH());
  let shownH = targetH();

  // ---------- scene state ----------

  let W = 0, H = 0, dpr = 1, unit = 0;
  let S = null, name = '';
  let ridges = [], ridgePaths = [], aboveFarRidge = null;
  let fuji = null, toriiGround = 0, sunKeys = [];
  let stars = [], mists = [], petals = [], clouds = [], cranes = null, crows = null;
  let petalsOn = true, t = 0, last = 0;

  const ridgeAt = (i, x) => ridges[i][Math.max(0, Math.min(ridges[i].length - 1, Math.round(x / 4)))];
  const peak = (x) => Math.pow(1 - Math.abs(Math.sin(x)), 1.7);

  function buildRidges() {
    ridges = GEO.map((L, i) => {
      const r = rng(101 + i * 37);
      const p = [r() * 6.28, r() * 6.28, r() * 6.28];
      const top = H * (L.base - L.amp), bottom = H * L.base;
      const ys = [];
      let jitter = 0;
      for (let x = 0; x <= W + 4; x += 4) {
        const u = (x / W) * Math.PI;
        jitter = jitter * 0.7 + (r() - 0.5) * 0.03;
        const s = 0.62 * peak(u * L.f[0] + p[0]) +
                  0.28 * peak(u * L.f[1] + p[1]) +
                  0.1 * (0.5 + 0.5 * Math.sin(u * L.f[2] + p[2])) + jitter;
        ys.push(bottom - s * (bottom - top));
      }
      return ys;
    });
    ridgePaths = ridges.map((ys) => {
      const p = new Path2D();
      p.moveTo(0, H);
      ys.forEach((y, k) => p.lineTo(k * 4, y));
      p.lineTo(W, H);
      p.closePath();
      return p;
    });
    aboveFarRidge = new Path2D();        // the sun is clipped to this, so it never shows through the hills
    aboveFarRidge.moveTo(0, -H);
    ridges[0].forEach((y, k) => aboveFarRidge.lineTo(k * 4, y + 1));
    aboveFarRidge.lineTo(W, -H);
    aboveFarRidge.closePath();
  }

  function buildFuji() {
    const px = W * 0.8, py = H * 0.3, by = H * 0.74;
    const rise = by - py;
    const hw = Math.max(W * 0.36, rise * 1.55);
    const tw = hw * 0.07;
    const cone = new Path2D();
    cone.moveTo(px - hw, by);
    cone.quadraticCurveTo(px - hw * 0.36, by - rise * 0.4, px - tw, py);
    cone.lineTo(px - tw * 0.35, py + rise * 0.014);
    cone.lineTo(px + tw * 0.3, py - rise * 0.004);
    cone.lineTo(px + tw, py + rise * 0.012);
    cone.quadraticCurveTo(px + hw * 0.36, by - rise * 0.4, px + hw, by);
    cone.closePath();

    // snow cap with long melting tongues
    const r = rng(77);
    const sy = py + rise * 0.17, a = rise * 0.05, half = hw * 0.24, n = 17;
    const snow = new Path2D();
    snow.moveTo(px - half, py - 20);
    for (let k = 0; k <= n; k++) {
      const x = px - half + (2 * half * k) / n;
      const y = k % 2 ? sy + a * (0.8 + r() * 1.6) : sy - a * (0.3 + r() * 0.8);
      snow.lineTo(x, y);
    }
    snow.lineTo(px + half, py - 20);
    snow.closePath();
    fuji = { cone, snow, py, by };
  }

  // The sun's path over the day: up from behind the ridge on the right, out over the
  // top of the sky around midday, and back down behind the ridge on the left.
  function buildSun() {
    const rM = unit * 0.085, rN = unit * 0.07, rE = unit * 0.1;
    const xM = W * 0.77, xE = W * 0.22;
    const yM = ridgeAt(0, xM) - rM * 0.4;        // morning look: about a third still hidden
    const yE = ridgeAt(0, xE) - rE * 0.16;       // evening look: nearly half set
    sunKeys = [
      [5.5, W * 0.8, Math.max(yM, ridgeAt(0, W * 0.8)) + rM * 1.3, rM],
      [7.5, xM, yM, rM],
      [10.5, W * 0.66, -rN * 7, rN],
      [15, W * 0.36, -rN * 7, rN],
      [18.3, xE, yE, rE],
      [19.6, W * 0.19, Math.max(yE, ridgeAt(0, W * 0.19)) + rE * 1.3, rE],
    ];
  }

  const SUN = {
    morning: { core: [[238, 93, 67], [212, 57, 42]], glow: [244, 112, 84], glowA: 0.34 },
    noon: { core: [[255, 248, 224], [255, 226, 150]], glow: [255, 238, 196], glowA: 0.3 },
    evening: { core: [[255, 240, 184], [255, 179, 71]], glow: [255, 190, 100], glowA: 0.5 },
  };

  function sunAt(h) {
    if (h <= sunKeys[0][0] || h >= sunKeys[sunKeys.length - 1][0]) return null;
    let j = 0;
    while (h > sunKeys[j + 1][0]) j++;
    const A = sunKeys[j], B = sunKeys[j + 1];
    const k = (h - A[0]) / (B[0] - A[0]);
    const up = smooth(7.8, 10.2, h), down = smooth(14.5, 17.8, h);
    const tone = (get) => mix(mix(get(SUN.morning), get(SUN.noon), up), get(SUN.evening), down);
    return {
      x: lerp(A[1], B[1], k), y: lerp(A[2], B[2], k), r: lerp(A[3], B[3], k),
      core: [tone((s) => s.core[0]), tone((s) => s.core[1])],
      glow: tone((s) => s.glow),
      glowA: lerp(lerp(SUN.morning.glowA, SUN.noon.glowA, up), SUN.evening.glowA, down) *
             clamp((h - 5.5) / 1.2) * clamp((19.6 - h) / 0.8),
    };
  }

  function makePetal(r, scattered) {
    return {
      x: r() * W * 1.2 - W * 0.2,
      y: scattered ? r() * H : -20 - r() * H * 0.4,
      z: 0.45 + r() * 0.8,
      rot: r() * 6.28,
      vr: (r() - 0.5) * 2.2,
      flip: r() * 6.28,
      vf: 1.4 + r() * 2.6,
      sway: r() * 6.28,
      swayF: 0.5 + r() * 1.1,
      ci: Math.floor(r() * 5),
    };
  }

  // Kasumi: flat stepped bands with rounded ends, as in woodblock prints.
  function makeCloud(r) {
    const hb = Math.max(12, H * 0.02);
    const rows = 2 + Math.floor(r() * 3);
    const bars = [];
    for (let k = 0; k < rows; k++) {
      bars.push({ dx: (r() - 0.5) * W * 0.12, dy: k * hb, w: W * (0.1 + r() * 0.2), h: hb });
    }
    return { x: r() * W, y: H * (0.1 + r() * 0.42), speed: 2.5 + r() * 4, bars, span: W * 0.3 };
  }

  function makeFlock(B) {
    const r = rng(29);
    const list = [];
    for (let k = 0; k < B.n; k++) {
      const rank = Math.ceil(k / 2), side = k % 2 ? 1 : -1;
      list.push(B.form === 'v'
        ? { dx: -rank * 30 * B.size * B.dir, dy: side * rank * 13 * B.size - rank * 3, ph: r() * 6.28, fs: 4.2 + r() * 0.8 }
        : { dx: (r() - 0.5) * 220, dy: (r() - 0.5) * 90, ph: r() * 6.28, fs: 5.5 + r() * 2 });
    }
    return { ...B, x: W * B.x0, y: H * B.y, list };
  }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    unit = Math.min(W, H);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildRidges();
    buildFuji();
    buildSun();

    const tx = W * 0.86, reach = H * 0.17 * 0.62;   // the torii stands on the highest ground under it
    toriiGround = H;
    for (let dx = -reach; dx <= reach; dx += 4) toriiGround = Math.min(toriiGround, ridgeAt(3, tx + dx));

    const r = rng(11);
    stars = Array.from({ length: Math.round((W * H) / 12000) }, () => {
      const s = {
        x: r() * W,
        y: Math.pow(r(), 1.5) * H * 0.5,
        s: 0.4 + r() * 1.1,
        a: 0.2 + r() * 0.55,
        ph: r() * 6.28,
        sp: 0.4 + r() * 1.4,
      };
      s.early = s.y < H * 0.22 && r() < 0.5;       // the first stars out at dusk
      return s;
    });

    const mr = rng(53);
    mists = [0, 0, 1, 1, 2].map((layer, k) => ({
      layer,
      x: mr() * W,
      y: H * (GEO[layer].base - 0.02 - mr() * 0.05),
      w: W * (0.45 + mr() * 0.4),
      h: H * (0.035 + mr() * 0.035),
      speed: (3 + mr() * 7) * (k % 2 ? -1 : 1),
      a: 0.07 + mr() * 0.07,
    }));

    const cr = rng(211);
    clouds = Array.from({ length: 5 }, () => makeCloud(cr));
    cranes = makeFlock({ n: 7, form: 'v', rgb: [58, 64, 108], a: 0.75, y: 0.17, x0: 0.12, dir: 1, speed: 15, size: 1.05 });
    crows = makeFlock({ n: 5, form: 'loose', rgb: [26, 18, 42], a: 0.85, y: 0.13, x0: 0.84, dir: -1, speed: 22, size: 0.9 });

    const n = Math.round(Math.min(70, Math.max(18, (W * H) / 26000)));
    petals = Array.from({ length: n }, () => makePetal(Math.random, true));
  }

  // ---------- drawing ----------

  function drawDisc(x, y, r, core, glow, glowA, spread, alpha, clip) {
    if (alpha < 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glowA > 0.005) {
      const R = r * spread;
      const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, R);
      halo.addColorStop(0, css(glow, glowA));
      halo.addColorStop(1, css(glow, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
    if (clip) ctx.clip(clip);
    const disc = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    disc.addColorStop(0, css(core[0]));
    disc.addColorStop(1, css(core[1]));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFuji(alpha) {
    if (alpha < 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const body = ctx.createLinearGradient(0, fuji.py, 0, fuji.by);
    body.addColorStop(0, css(S.fujiC, 1));
    body.addColorStop(0.55, css(S.fujiC, 0.8));
    body.addColorStop(1, css(S.fujiC, 0.15));
    ctx.fillStyle = body;
    ctx.fill(fuji.cone);
    ctx.clip(fuji.cone);
    ctx.fillStyle = css(mix(S.fujiC, [253, 250, 242], smooth(0.35, 1, alpha)));
    ctx.fill(fuji.snow);
    ctx.restore();
  }

  function drawTorii(alpha, color) {
    if (alpha < 0.01) return;
    const h = H * 0.17, w = h * 1.12;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W * 0.86, toriiGround);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w * 1.5, h * 0.8);       // rounded hilltop under the gate
    ctx.quadraticCurveTo(-w * 0.72, h * 0.02, -w * 0.46, 0);
    ctx.lineTo(w * 0.46, 0);
    ctx.quadraticCurveTo(w * 0.72, h * 0.02, w * 1.5, h * 0.8);
    ctx.closePath();
    const leg = [[0.375, 0.4], [0.3, 0.4], [0.27, -0.86], [0.335, -0.86]];
    for (const s of [-1, 1]) {           // pillars lean in slightly
      const q = s > 0 ? leg : [...leg].reverse();
      q.forEach(([px, py], k) => ctx[k ? 'lineTo' : 'moveTo'](s * px * w, py * h));
      ctx.closePath();
    }
    ctx.rect(-w * 0.47, -h * 0.7, w * 0.94, h * 0.058);    // tie beam
    ctx.rect(-w * 0.035, -h * 0.86, w * 0.07, h * 0.17);   // centre strut
    ctx.rect(-w * 0.5, -h * 0.885, w, h * 0.05);           // lower lintel
    ctx.moveTo(-w * 0.63, -h * 1.0);                       // curved top lintel
    ctx.quadraticCurveTo(0, -h * 0.9, w * 0.63, -h * 1.0);
    ctx.lineTo(w * 0.6, -h * 0.925);
    ctx.quadraticCurveTo(0, -h * 0.845, -w * 0.6, -h * 0.925);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMist(m) {
    const a = Math.min(0.5, m.a * S.mistA);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(m.w, m.h);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, css(S.mist, a));
    g.addColorStop(1, css(S.mist, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function drawCloud(c, alpha) {
    if (alpha < 0.01) return;
    ctx.fillStyle = css(S.cloud, alpha);
    ctx.beginPath();
    for (const b of c.bars) ctx.roundRect(c.x + b.dx - b.w / 2, c.y + b.dy, b.w, b.h, b.h / 2);
    ctx.fill();
  }

  function drawFlock(F, alpha) {
    if (alpha < 0.01) return;
    ctx.strokeStyle = css(F.rgb, F.a * alpha);
    ctx.lineWidth = 1.7 * F.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const b of F.list) {
      const flap = reduce ? 0.4 : Math.sin(t * b.fs + b.ph);
      const span = 10 * F.size, lift = (1.5 + 4.2 * flap) * F.size;
      const x = F.x + b.dx, y = F.y + b.dy + Math.sin(t * 0.6 + b.ph) * 3;
      ctx.beginPath();
      ctx.moveTo(x - span, y - lift);
      ctx.quadraticCurveTo(x - span * 0.45, y - lift * 1.25 - 1.5 * F.size, x, y);
      ctx.quadraticCurveTo(x + span * 0.45, y - lift * 1.25 - 1.5 * F.size, x + span, y - lift);
      ctx.stroke();
    }
  }

  function drawPetal(p) {
    const c = Math.cos(p.flip);
    const size = 6.5 * p.z;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(size * (0.25 + 0.75 * Math.abs(c)), size);
    ctx.globalAlpha = (0.45 + 0.45 * Math.min(1, p.z)) * (c < 0 ? 0.78 : 1);
    ctx.fillStyle = S.petals[p.ci];
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.bezierCurveTo(-0.95, 0.55, -0.9, -0.6, -0.36, -1);
    ctx.quadraticCurveTo(-0.12, -1.06, 0, -0.76);
    ctx.quadraticCurveTo(0.12, -1.06, 0.36, -1);
    ctx.bezierCurveTo(0.9, -0.6, 0.95, 0.55, 0, 1);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    S = blendAt(shownH);
    if (S.name !== name) {               // text colours follow whichever look is nearer
      name = S.name;
      document.body.dataset.time = name;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    S.sky.forEach((c, i) => sky.addColorStop(i / (SKY_N - 1), css(c)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (S.show.stars > 0.01 || S.show.starsEarly > 0.01) {
      ctx.fillStyle = '#f6eee2';
      for (const s of stars) {
        const vis = Math.min(1, S.show.stars + (s.early ? S.show.starsEarly : 0));
        if (vis < 0.01) continue;
        const tw = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * s.sp + s.ph);
        ctx.globalAlpha = s.a * tw * vis;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawDisc(W * 0.79, H * 0.2, unit * 0.055, [[251, 243, 230], [234, 219, 200]], [246, 232, 222], 0.22, 6, S.show.moon, null);
    const sun = sunAt(shownH);
    if (sun) drawDisc(sun.x, sun.y, sun.r, sun.core, sun.glow, sun.glowA, 5, 1, aboveFarRidge);

    drawFuji(S.show.fuji);
    clouds.forEach((c, i) => drawCloud(c, S.cloudA[i < 2 ? 0 : 1]));
    drawFlock(cranes, S.show.cranes);
    drawFlock(crows, S.show.crows);

    GEO.forEach((L, i) => {
      const { rgb, fade } = S.layers[i];
      const top = H * (L.base - L.amp), bottom = H * L.base;
      if (i === GEO.length - 1) drawTorii(smooth(0.6, 0.95, S.show.torii), css(rgb));
      // Solid at the ridge, dissolving into mist toward the foot, like sumi-e.
      const grad = ctx.createLinearGradient(0, top, 0, Math.min(H, bottom + H * 0.12));
      grad.addColorStop(0, css(rgb, 1));
      grad.addColorStop(0.55, css(rgb, 0.55 + fade * 0.45));
      grad.addColorStop(1, css(rgb, fade));
      ctx.fillStyle = grad;
      ctx.fill(ridgePaths[i]);
      for (const m of mists) if (m.layer === i) drawMist(m);
    });

    if (petalsOn) for (const p of petals) drawPetal(p);
  }

  // ---------- motion ----------

  function step(dt) {
    // time of day: follow the clock, the loop, or glide to a pinned hour the short way round
    if (mode === 'loop') {
      loopH = (loopH + (dt * 24) / LOOP_SECONDS) % 24;
      shownH = loopH;
    } else {
      const d = ((targetH() - shownH + 36) % 24) - 12;
      shownH = Math.abs(d) < 0.002 ? targetH() : (shownH + d * Math.min(1, dt * 2.2) + 24) % 24;
    }

    const wind = 14 + 12 * Math.sin(t * 0.11) + 6 * Math.sin(t * 0.37);
    for (const p of petals) {
      p.x += (wind * p.z + Math.sin(t * p.swayF + p.sway) * 18 * p.z) * dt;
      p.y += (20 + 26 * p.z) * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      if (p.y > H + 30 || p.x > W + 40) Object.assign(p, makePetal(Math.random, false));
    }
    for (const m of mists) {
      m.x += m.speed * dt;
      if (m.speed > 0 && m.x - m.w > W) m.x = -m.w;
      if (m.speed < 0 && m.x + m.w < 0) m.x = W + m.w;
    }
    for (const c of clouds) {
      c.x += c.speed * dt;
      if (c.x - c.span > W) c.x = -c.span;
    }
    for (const F of [cranes, crows]) {
      F.x += F.speed * F.dir * dt;
      if (F.dir > 0 && F.x - 260 > W) F.x = -80;
      if (F.dir < 0 && F.x + 260 < 0) F.x = W + 80;
    }
  }

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    t += dt;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // With "reduce motion" on, nothing animates: a still picture, refreshed once a minute.
  function still() {
    shownH = targetH();
    draw();
  }

  let resizeTimer = 0;
  new ResizeObserver(() => {
    if (canvas.clientWidth === W && canvas.clientHeight === H) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); if (reduce) still(); }, 100);
  }).observe(canvas);

  build();
  draw();
  if (reduce) {
    setInterval(still, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) still(); });
  } else {
    requestAnimationFrame(frame);
  }

  window.HimekuriScene = {
    setPetals(on) {
      petalsOn = !!on;
      if (reduce) still();
    },
    // 'auto' follows the clock, 'loop' runs a whole day every few minutes,
    // or pin one of morning / afternoon / evening / night.
    setTheme(next) {
      const m = MODES.includes(next) ? next : 'auto';
      if (m === 'loop' && mode !== 'loop') loopH = shownH;   // start the loop from what's on screen
      mode = m;
      try { localStorage.setItem(HINT_KEY, mode); } catch {}
      if (reduce) still();
    },
  };
})();
