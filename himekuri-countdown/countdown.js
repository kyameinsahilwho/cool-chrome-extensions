(() => {
  'use strict';

  const DAY = 86400000, HOUR = 3600000, MIN = 60000, SEC = 1000;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { name: '', date: '', time: '', mode: 'days', petals: true, scene: 'auto' };
  const $ = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Storage (chrome.storage.sync, localStorage when opened as a plain page) ----------

  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;
  const store = {
    async load() {
      try {
        if (hasChrome) return (await chrome.storage.sync.get('countdown')).countdown || null;
        return JSON.parse(localStorage.getItem('countdown'));
      } catch { return null; }
    },
    async save(value) {
      if (hasChrome) return chrome.storage.sync.set({ countdown: value });
      try { localStorage.setItem('countdown', JSON.stringify(value)); } catch {}
    },
  };

  // ---------- Flip card ----------

  class Flap {
    constructor() {
      const el = document.createElement('div');
      el.className = 'flap';
      el.innerHTML =
        '<div class="half upper"><span></span></div>' +
        '<div class="half lower"><span></span></div>' +
        '<div class="leaf leaf-upper"><span></span></div>' +
        '<div class="leaf leaf-lower"><span></span></div>' +
        '<i class="ring"></i><i class="ring"></i>';
      this.el = el;
      [this.upper, this.lower, this.leafUpper, this.leafLower] = el.children;
      this.value = null;   // what the card currently shows
      this.target = null;  // what it will show once queued flips finish
      this.queue = Promise.resolve();
    }

    write(node, v) { node.firstChild.textContent = v; }

    set(v) {
      this.value = this.target = v;
      this.write(this.upper, v);
      this.write(this.lower, v);
    }

    flipTo(v, dur = 640) {
      this.target = v;
      this.queue = this.queue.then(() => this.flip(v, dur));
      return this.queue;
    }

    async flip(next, dur) {
      const cur = this.value;
      if (cur === next) return;
      if (reduceMotion || document.hidden || cur === null) { this.set(next); return; }

      this.write(this.upper, next);
      this.write(this.leafUpper, cur);
      this.write(this.leafLower, next);
      this.write(this.lower, cur);
      this.el.classList.add('flipping');

      const half = dur / 2;
      const fall = this.leafUpper.animate(
        [{ transform: 'rotateX(0deg)', filter: 'brightness(1)' },
         { transform: 'rotateX(-90deg)', filter: 'brightness(.6)' }],
        { duration: half, easing: 'cubic-bezier(.55,0,.8,.25)', fill: 'forwards' });
      await fall.finished.catch(() => {});

      const land = this.leafLower.animate(
        [{ transform: 'rotateX(90deg)', filter: 'brightness(.6)' },
         { transform: 'rotateX(0deg)', filter: 'brightness(1)' }],
        { duration: half, easing: 'cubic-bezier(.2,.85,.35,1.08)', fill: 'forwards' });
      await land.finished.catch(() => {});

      this.write(this.lower, next);
      this.value = next;
      this.el.classList.remove('flipping');
      fall.cancel();
      land.cancel();
    }
  }

  // ---------- A row of flip cards showing one number ----------

  class Group {
    constructor(container, minDigits = 2) {
      this.c = container;
      this.min = minDigits;
      this.flaps = [];
    }

    digits(n) { return String(Math.max(0, n)).padStart(this.min, '0').split(''); }

    build(len) {
      this.c.textContent = '';
      this.flaps = Array.from({ length: len }, () => new Flap());
      this.flaps.forEach((f) => this.c.append(f.el));
      this.onBuild && this.onBuild(len);
    }

    set(n) {
      const d = this.digits(n);
      if (d.length !== this.flaps.length) this.build(d.length);
      d.forEach((x, i) => this.flaps[i].set(x));
    }

    update(n) {
      const d = this.digits(n);
      if (d.length !== this.flaps.length) return this.set(n);
      d.forEach((x, i) => { if (this.flaps[i].target !== x) this.flaps[i].flipTo(x); });
    }

    // Start one higher and flip once, like tearing off a single calendar sheet.
    // The flip starts on the very first frame, so the old number is only ever seen falling away.
    intro(n, { dur = 800 } = {}) {
      const d = this.digits(n);
      this.build(d.length);
      if (reduceMotion) { this.set(n); return; }
      const from = this.digits(n + 1).slice(-d.length);
      d.forEach((x, i) => {
        const f = this.flaps[i];
        f.set(from[i]);
        f.flipTo(x, dur);
      });
    }
  }

  // ---------- Time maths ----------

  // Wall-clock milliseconds, so a daylight-saving change never adds or drops a day.
  const wall = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(),
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());

  function targetOf(s) {
    if (!s || !s.date) return null;
    const [y, m, d] = s.date.split('-').map(Number);
    const [hh, mm] = (s.time || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  }

  function partsOf(ms, mode) {
    if (ms <= 0) return { days: 0, h: 0, m: 0, s: 0, done: true };
    if (mode === 'days') return { days: Math.ceil(ms / DAY), h: 0, m: 0, s: 0, done: false };
    const days = Math.floor(ms / DAY);
    let r = ms - days * DAY;
    const h = Math.floor(r / HOUR); r -= h * HOUR;
    const m = Math.floor(r / MIN); r -= m * MIN;
    return { days, h, m, s: Math.floor(r / SEC), done: false };
  }


  // ---------- Page ----------

  const daysG = new Group($('#days'), 2);
  daysG.onBuild = (len) => { document.body.dataset.len = len; };
  const hoursG = new Group($('#hours'), 2);
  const minsG = new Group($('#minutes'), 2);
  const secsG = new Group($('#seconds'), 2);

  const caption = $('#caption'), cta = $('#cta'), small = $('#small');
  let settings = null;
  let timer = 0;

  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };

  function render(intro = false) {
    const t = targetOf(settings);
    const mode = (settings && settings.mode) || 'days';
    document.body.dataset.mode = mode;
    small.hidden = !t || mode === 'days';

    if (!t) {
      daysG.set(0);
      setText(caption, 'Pick a date to start your countdown.');
      cta.hidden = true;
      return;
    }

    const p = partsOf(wall(t) - wall(new Date()), mode);
    const name = (settings.name || '').trim();

    if (intro) {
      daysG.intro(p.days);
      if (mode !== 'days') {
        const opts = { dur: 640 };
        hoursG.intro(p.h, opts);
        minsG.intro(p.m, opts);
        secsG.intro(p.s, opts);
      }
    } else {
      daysG.update(p.days);
      if (mode !== 'days') { hoursG.update(p.h); minsG.update(p.m); secsG.update(p.s); }
    }


    if (p.done) {
      setText(caption, name ? `${name} is here.` : 'The day is here.');
      cta.hidden = false;
      return;
    }

    setText(caption, name);
    cta.hidden = true;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { render(); schedule(); }, 1000 - (Date.now() % 1000) + 10);
  }

  function apply(intro) {
    if (window.HimekuriScene) {
      window.HimekuriScene.setPetals(settings ? settings.petals !== false : true);
      window.HimekuriScene.setTheme((settings && settings.scene) || 'auto');
    }
    render(intro);
  }

  // ---------- Settings sheet ----------

  const dlg = $('#settings'), form = $('#form'), err = $('#f-error');
  const fName = $('#f-name'), fDate = $('#f-date'), fTime = $('#f-time'), fPetals = $('#f-petals'), fScene = $('#f-scene');

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function openSettings() {
    const s = { ...DEFAULTS, ...(settings || {}) };
    const first = !settings || !settings.date;
    fName.value = s.name;
    fDate.value = s.date;
    fDate.min = todayStr();
    fTime.value = s.time;
    form.elements.mode.value = s.mode;
    fPetals.checked = s.petals !== false;
    fScene.value = s.scene || 'auto';
    err.textContent = '';
    $('#cancel').hidden = first;
    $('#save').textContent = first ? 'Start countdown' : 'Save changes';
    dlg.showModal();
    (first ? fName : fDate).focus();
  }

  // The first-run sheet can't be dismissed without a date.
  dlg.addEventListener('cancel', (e) => { if (!settings || !settings.date) e.preventDefault(); });
  $('#cancel').addEventListener('click', () => dlg.close());
  $('#openSettings').addEventListener('click', openSettings);
  cta.addEventListener('click', openSettings);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fDate.value) { err.textContent = 'Choose the date you are counting down to.'; fDate.focus(); return; }
    const next = {
      name: fName.value.trim(),
      date: fDate.value,
      time: fTime.value || '',
      mode: form.elements.mode.value || 'days',
      petals: fPetals.checked,
      scene: fScene.value || 'auto',
    };
    if (wall(targetOf(next)) <= wall(new Date())) {
      err.textContent = 'That moment has already passed. Pick a later date or time.';
      fDate.focus();
      return;
    }
    await store.save(next);
    settings = next;
    dlg.close();
    apply(true);
  });

  // Keep other open tabs in step when the countdown changes.
  if (hasChrome && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes.countdown) return;
      const v = changes.countdown.newValue || null;
      if (JSON.stringify(v) === JSON.stringify(settings)) return;
      settings = v;
      apply(true);
    });
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  // ---------- Start ----------

  (async () => {
    settings = await store.load();
    render(false); // lay out (hidden) so nothing jumps
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    await Promise.race([fonts, wait(900)]);
    apply(true);
    document.body.classList.add('ready'); // reveal in the same frame the flip begins
    schedule();
    if (!settings || !settings.date) openSettings();
  })();
})();
