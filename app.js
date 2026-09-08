/* ============================================================
   PhysDeck — application logic
   Vanilla JS, no build step, no backend. State lives in
   localStorage under STORE_KEY.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     Constants
     --------------------------------------------------------- */
  const STORE_KEY = 'physdeck.v1';
  const DAY = 86400000;
  const MAX_BOX = 5;
  /* Leitner review intervals in days, indexed by box number. */
  const BOX_DAYS = [0, 1, 2, 4, 8, 16];
  const SESSION_SIZE = 20;
  const SPRINT_SECONDS = 60;
  const MATCH_PAIRS = 6;
  /* XP awarded per correct answer = difficulty x weight for the mode. */
  const XP_WEIGHT = { flip: 10, recall: 12, sprint: 5, match: 6 };

  const RANKS = [
    { min: 1,  name: 'Kinematics Cadet' },
    { min: 3,  name: 'Vector Voyager' },
    { min: 5,  name: 'Momentum Marshal' },
    { min: 7,  name: 'Energy Engineer' },
    { min: 9,  name: 'Elastic Envoy' },
    { min: 11, name: 'Wave Warden' },
    { min: 13, name: 'Interference Inspector' },
    { min: 15, name: 'Circuit Sentinel' },
    { min: 17, name: 'Nuclear Navigator' },
    { min: 20, name: 'Field Theorist' }
  ];

  /* Formulas and units read best in the monospace face; prose does not. */
  function isMono(card) { return card.type === 'formula' || card.type === 'unit'; }

  const TYPE_LABEL = {
    formula: 'formula', definition: 'definition',
    theorem: 'law / theorem', unit: 'unit'
  };

  /* ---------------------------------------------------------
     Tiny helpers
     --------------------------------------------------------- */
  const $  = function (id) { return document.getElementById(id); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n) { return shuffle(arr).slice(0, n); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function topicColor(topicId) {
    return (TOPIC_BY_ID[topicId] && TOPIC_BY_ID[topicId].color) || '#4895ef';
  }
  function topicName(topicId) {
    return (TOPIC_BY_ID[topicId] && TOPIC_BY_ID[topicId].name) || topicId;
  }

  /* ---------------------------------------------------------
     Persistent state
     --------------------------------------------------------- */
  const defaultState = function () {
    return {
      v: 1,
      xp: 0,
      cards: {},                       /* id -> { box, due, seen, right, wrong } */
      streak: { count: 0, last: null },
      sprint: [],                      /* personal bests, best first */
      totals: { right: 0, wrong: 0 }
    };
  };

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      if (!parsed || typeof parsed !== 'object') return base;
      base.xp = Number(parsed.xp) || 0;
      base.cards = (parsed.cards && typeof parsed.cards === 'object') ? parsed.cards : {};
      base.streak = parsed.streak || base.streak;
      base.sprint = Array.isArray(parsed.sprint) ? parsed.sprint : [];
      base.totals = parsed.totals || base.totals;
      /* Drop records for cards that no longer exist in data.js */
      Object.keys(base.cards).forEach(function (id) {
        if (!CARD_BY_ID[id]) delete base.cards[id];
      });
      return base;
    } catch (err) {
      console.warn('PhysDeck: could not read saved progress —', err);
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('PhysDeck: could not save progress —', err);
    }
  }

  function rec(id) { return state.cards[id] || null; }

  function ensureRec(id) {
    if (!state.cards[id]) {
      state.cards[id] = { box: 1, due: Date.now(), seen: 0, right: 0, wrong: 0 };
    }
    return state.cards[id];
  }

  /* ---------------------------------------------------------
     Leitner scheduling
     --------------------------------------------------------- */
  function schedule(id, correct) {
    const r = ensureRec(id);
    r.seen += 1;
    if (correct) {
      r.right += 1;
      r.box = Math.min(r.box + 1, MAX_BOX);
    } else {
      r.wrong += 1;
      r.box = 1;
    }
    r.due = Date.now() + BOX_DAYS[r.box] * DAY;
    return r.box;
  }

  /* Sprint and Match record exposure only — the review schedule is
     driven by the deliberate self-grading in Flip Deck and Recall. */
  function touch(id, correct) {
    const isNew = !state.cards[id];
    const r = ensureRec(id);
    r.seen += 1;
    if (correct) r.right += 1; else r.wrong += 1;
    /* A card first met in a sprint enters box 1: tomorrow if it was
       recognised, straight away if it was not. */
    if (isNew) r.due = Date.now() + (correct ? BOX_DAYS[1] * DAY : 0);
  }

  function dueCards(topicId) {
    const now = Date.now();
    return CARDS.filter(function (c) {
      if (topicId && c.topic !== topicId) return false;
      const r = rec(c.id);
      return !!r && r.due <= now;
    });
  }
  function newCards(topicId) {
    return CARDS.filter(function (c) {
      return (!topicId || c.topic === topicId) && !rec(c.id);
    });
  }

  /* Due first (most overdue first), then unseen, then the rest. */
  function buildQueue(topicId, size) {
    const now = Date.now();
    const due = dueCards(topicId).sort(function (a, b) { return rec(a.id).due - rec(b.id).due; });
    const fresh = shuffle(newCards(topicId));
    const rest = CARDS.filter(function (c) {
      if (topicId && c.topic !== topicId) return false;
      const r = rec(c.id);
      return !!r && r.due > now;
    }).sort(function (a, b) { return rec(a.id).due - rec(b.id).due; });

    return due.concat(fresh, rest).slice(0, size || SESSION_SIZE).map(function (c) { return c.id; });
  }

  /* ---------------------------------------------------------
     XP, levels, streak
     --------------------------------------------------------- */
  function xpForLevel(level) { return 200 + (level - 1) * 80; }

  function levelInfo(xp) {
    let level = 1, remaining = xp, need = xpForLevel(1);
    while (remaining >= need) {
      remaining -= need;
      level += 1;
      need = xpForLevel(level);
    }
    return { level: level, into: remaining, need: need };
  }

  function rankFor(level) {
    let name = RANKS[0].name;
    RANKS.forEach(function (r) { if (level >= r.min) name = r.name; });
    return name;
  }

  function awardXp(amount) {
    if (amount <= 0) return;
    const before = levelInfo(state.xp).level;
    state.xp += amount;
    const after = levelInfo(state.xp).level;
    toast('+' + amount + ' XP', 'xp');
    if (after > before) {
      setTimeout(function () { toast('LEVEL ' + after + ' — ' + rankFor(after), 'level'); }, 420);
    }
    renderHud();
  }

  function bumpStreak() {
    const today = dayKey(Date.now());
    if (state.streak.last === today) return;
    const yesterday = dayKey(Date.now() - DAY);
    state.streak.count = (state.streak.last === yesterday) ? state.streak.count + 1 : 1;
    state.streak.last = today;
  }

  /* ---------------------------------------------------------
     Answer recording (single entry point)
     --------------------------------------------------------- */
  function record(cardId, correct, mode, xpOverride) {
    const card = CARD_BY_ID[cardId];
    if (!card) return;
    if (mode === 'flip' || mode === 'recall') schedule(cardId, correct); else touch(cardId, correct);
    if (correct) state.totals.right += 1; else state.totals.wrong += 1;
    bumpStreak();
    if (correct) {
      const xp = (typeof xpOverride === 'number') ? xpOverride : card.difficulty * (XP_WEIGHT[mode] || 10);
      awardXp(xp);
    }
    save();
  }

  /* ---------------------------------------------------------
     HUD + home rendering
     --------------------------------------------------------- */
  function renderHud() {
    const info = levelInfo(state.xp);
    $('rank-level').textContent = info.level;
    $('rank-name').textContent = rankFor(info.level);
    const pct = Math.round((info.into / info.need) * 100);
    $('xpbar-fill').style.width = pct + '%';
    $('xpbar').setAttribute('aria-valuenow', String(pct));
    $('xp-text').textContent = info.into + ' / ' + info.need + ' XP';

    /* A streak only counts while it is current (today or yesterday). */
    const today = dayKey(Date.now());
    const yesterday = dayKey(Date.now() - DAY);
    const live = (state.streak.last === today || state.streak.last === yesterday) ? state.streak.count : 0;
    $('streak-count').textContent = live;
    $('streak-chip').classList.toggle('is-hot', live > 0);
  }

  function masteryOf(topicId) {
    const pool = topicId ? CARDS.filter(function (c) { return c.topic === topicId; }) : CARDS;
    if (!pool.length) return 0;
    let sum = 0;
    pool.forEach(function (c) {
      const r = rec(c.id);
      if (r) sum += r.box / MAX_BOX;
    });
    return Math.round((sum / pool.length) * 100);
  }

  function renderHome() {
    const due = dueCards(null).length;
    const fresh = newCards(null).length;
    const seen = CARDS.length - fresh;
    const mastered = CARDS.filter(function (c) {
      const r = rec(c.id); return r && r.box === MAX_BOX;
    }).length;

    const dueLabel = document.querySelector('.stat--due .stat__label');
    if (due > 0 || fresh === 0) {
      $('stat-due').textContent = due;
      dueLabel.textContent = 'Due today';
    } else {
      $('stat-due').textContent = fresh;
      dueLabel.textContent = 'New to learn';
    }
    $('stat-mastered').textContent = mastered;
    $('stat-seen').innerHTML = seen + '<small>/' + CARDS.length + '</small>';
    $('stat-best').textContent = state.sprint.length ? state.sprint[0].score : '—';
    $('mode-flip-tag').textContent = due > 0 ? due + ' due' : (fresh > 0 ? fresh + ' new' : 'all scheduled');
    $('overall-mastery').textContent = masteryOf(null) + '% overall';

    const wrap = $('gauges');
    wrap.innerHTML = '';
    TOPICS.forEach(function (t) {
      const pct = masteryOf(t.id);
      const el = document.createElement('button');
      el.className = 'gauge';
      el.style.setProperty('--accent', t.color);
      el.title = t.name + ' — ' + pct + '% mastery';
      el.innerHTML =
        '<div class="gauge__ring" style="--pct:' + pct + '" data-lit="' + (pct > 0 ? 1 : 0) + '">' +
          '<span class="gauge__pct">' + pct + '</span>' +
        '</div>' +
        '<span class="gauge__name"></span>';
      el.querySelector('.gauge__name').textContent = t.short;
      el.addEventListener('click', function () { startFlip(t.id); });
      wrap.appendChild(el);
    });

    renderHud();
  }

  /* ---------------------------------------------------------
     Screens
     --------------------------------------------------------- */
  let currentScreen = 'home';

  function showScreen(name) {
    stopSprint();
    currentScreen = name;
    $$('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    const el = $('screen-' + name);
    if (el) el.classList.add('is-active');
    $('btn-back').hidden = (name === 'home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'home') renderHome();
  }

  /* ---------------------------------------------------------
     Toasts + particle FX
     --------------------------------------------------------- */
  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    el.textContent = text;
    $('toaster').appendChild(el);
    setTimeout(function () { el.remove(); }, 2000);
  }

  const fx = $('fx');
  const ctx = fx.getContext('2d');
  let particles = [];
  let fxRunning = false;

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    fx.width = Math.floor(window.innerWidth * dpr);
    fx.height = Math.floor(window.innerHeight * dpr);
    fx.style.width = window.innerWidth + 'px';
    fx.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  function burst(x, y, color, count) {
    const n = count || 26;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: 1,
        decay: 0.014 + Math.random() * 0.018,
        size: 1.5 + Math.random() * 2.6,
        color: color || '#4cc9f0'
      });
    }
    if (!fxRunning) { fxRunning = true; requestAnimationFrame(stepFx); }
  }

  function burstFrom(el, color) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, color);
  }

  function stepFx() {
    ctx.clearRect(0, 0, fx.width, fx.height);
    particles = particles.filter(function (p) { return p.life > 0; });
    particles.forEach(function (p) {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.14;          /* gravity */
      p.vx *= 0.985;
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    if (particles.length) { requestAnimationFrame(stepFx); }
    else { fxRunning = false; ctx.clearRect(0, 0, fx.width, fx.height); }
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove('is-shake');
    void el.offsetWidth;                   /* restart the animation */
    el.classList.add('is-shake');
    setTimeout(function () { el.classList.remove('is-shake'); }, 420);
  }

  /* ---------------------------------------------------------
     Topic picker sheet
     --------------------------------------------------------- */
  let sheetHandler = null;

  function openTopicPicker(title, onPick, opts) {
    const options = opts || {};
    sheetHandler = onPick;
    $('sheet-title').textContent = title;
    const list = $('topic-list');
    list.innerHTML = '';

    function row(id, name, color, count, dueN) {
      const b = document.createElement('button');
      b.className = 'topicrow';
      b.style.setProperty('--accent', color);
      b.innerHTML =
        '<span class="topicrow__dot"></span>' +
        '<span class="topicrow__name"></span>' +
        '<span class="topicrow__meta">' +
          (dueN > 0 ? '<b>' + dueN + ' due</b> · ' : '') + count + ' cards' +
        '</span>';
      b.querySelector('.topicrow__name').textContent = name;
      if (options.min && count < options.min) b.disabled = true;
      b.addEventListener('click', function () {
        closeSheet();
        if (sheetHandler) sheetHandler(id);
      });
      list.appendChild(b);
    }

    row(null, 'All topics', '#4cc9f0', CARDS.length, dueCards(null).length);
    TOPICS.forEach(function (t) {
      const count = CARDS.filter(function (c) { return c.topic === t.id; }).length;
      row(t.id, t.name, t.color, count, dueCards(t.id).length);
    });

    $('topic-sheet').hidden = false;
  }
  function closeSheet() { $('topic-sheet').hidden = true; }

  $$('[data-close-sheet]').forEach(function (el) {
    el.addEventListener('click', closeSheet);
  });

  /* =========================================================
     MODE 1 — FLIP DECK
     ========================================================= */
  const flip = { queue: [], index: 0, flipped: false, topic: null, right: 0, wrong: 0, busy: false };

  function startFlip(topicId) {
    flip.topic = topicId || null;
    flip.queue = buildQueue(flip.topic, SESSION_SIZE);
    flip.index = 0; flip.right = 0; flip.wrong = 0; flip.busy = false;
    if (!flip.queue.length) { toast('No cards in that topic', 'bad'); return; }
    $('flip-title').textContent = 'Flip Deck · ' + (flip.topic ? topicName(flip.topic) : 'All topics');
    showScreen('flip');
    renderFlip();
  }

  function renderFlip() {
    if (flip.index >= flip.queue.length) { endFlip(); return; }
    const card = CARD_BY_ID[flip.queue[flip.index]];
    const color = topicColor(card.topic);
    const screen = $('screen-flip');
    screen.style.setProperty('--accent', color);

    const el = $('flip-card');
    el.style.transition = 'none';
    el.classList.remove('is-flipped', 'is-gone-left', 'is-gone-right', 'is-enter');
    el.style.transform = '';
    void el.offsetWidth;                 /* commit the reset before re-enabling motion */
    el.style.transition = '';
    el.classList.add('is-enter');
    flip.flipped = false;

    $('flip-topic').textContent = topicName(card.topic);
    $('flip-topic-b').textContent = topicName(card.topic);
    $('flip-type').textContent = TYPE_LABEL[card.type] || card.type;
    const r = rec(card.id);
    $('flip-box').textContent = r ? ('Box ' + r.box + '/' + MAX_BOX) : 'New card';
    $('flip-term').textContent = card.term;
    $('flip-answer').textContent = card.answer;
    $('flip-answer').classList.toggle('is-mono', isMono(card));
    $('flip-detail').textContent = card.detail;

    $('flip-counter').textContent = (flip.index + 1) + ' / ' + flip.queue.length;
    $('flip-progress').style.width = ((flip.index / flip.queue.length) * 100) + '%';
    setGradeEnabled(false);
  }

  function setGradeEnabled(on) {
    $('btn-knew').disabled = !on;
    $('btn-again').disabled = !on;
  }

  function toggleFlip() {
    const el = $('flip-card');
    flip.flipped = !flip.flipped;
    el.classList.toggle('is-flipped', flip.flipped);
    if (flip.flipped) setGradeEnabled(true);
  }

  function gradeFlip(correct) {
    if (flip.busy || flip.index >= flip.queue.length) return;
    flip.busy = true;
    setGradeEnabled(false);

    const id = flip.queue[flip.index];
    record(id, correct, 'flip');

    if (correct) {
      flip.right += 1;
      burstFrom($('flip-card'), topicColor(CARD_BY_ID[id].topic));
    } else {
      flip.wrong += 1;
      shake($('flip-stage'));
      /* Missed cards come round again at the end of this session. */
      if (flip.queue.indexOf(id, flip.index + 1) === -1) flip.queue.push(id);
    }

    const el = $('flip-card');
    el.style.transition = '';
    el.classList.add(correct ? 'is-gone-right' : 'is-gone-left');

    setTimeout(function () {
      flip.index += 1;
      flip.busy = false;
      renderFlip();
    }, 290);
  }

  function endFlip() {
    $('flip-progress').style.width = '100%';
    const total = flip.right + flip.wrong;
    showResults({
      badge: '🗂',
      title: 'Deck complete',
      sub: flip.topic ? topicName(flip.topic) : 'Mixed topics',
      stats: [
        { val: flip.right, label: 'Knew it' },
        { val: flip.wrong, label: 'To review' },
        { val: total ? Math.round((flip.right / total) * 100) + '%' : '—', label: 'Accuracy' }
      ],
      again: function () { startFlip(flip.topic); }
    });
  }

  /* --- flip interactions --- */
  (function bindFlip() {
    const el = $('flip-card');
    let startX = 0, startY = 0, dx = 0, dragging = false, moved = false;

    el.addEventListener('pointerdown', function (e) {
      if (flip.busy) return;
      dragging = true; moved = false; dx = 0;
      startX = e.clientX; startY = e.clientY;
      el.style.transition = 'none';
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
    });

    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      if (!flip.flipped) return;                       /* grade only after seeing the answer */
      el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 24) + 'deg)';
    });

    function release() {
      if (!dragging) return;
      dragging = false;
      el.style.transition = '';
      if (!moved) { el.style.transform = ''; toggleFlip(); return; }
      if (flip.flipped && Math.abs(dx) > 90) { gradeFlip(dx > 0); return; }
      el.style.transform = '';
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', function () { dragging = false; el.style.transition = ''; el.style.transform = ''; });

    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleFlip(); }
    });

    $('btn-knew').addEventListener('click', function () { gradeFlip(true); });
    $('btn-again').addEventListener('click', function () { gradeFlip(false); });
  }());

  /* =========================================================
     MODE 2 — FORMULA RECALL
     ========================================================= */
  const recall = { queue: [], index: 0, topic: null, right: 0, wrong: 0, checked: false };

  /* Normalise notation so that "v^2 = u^2+2as" matches "v² = u² + 2as". */
  const SUPER = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
  const SUB   = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₋': '-', '₊': '+' };

  function normalise(str) {
    let s = String(str || '').toLowerCase();
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, function (ch) { return '^' + SUPER[ch]; });
    s = s.replace(/[₀₁₂₃₄₅₆₇₈₉₋₊]/g, function (ch) { return '_' + SUB[ch]; });
    s = s.replace(/\^\^/g, '^').replace(/__/g, '_');
    s = s.replace(/[×⋅·]/g, '*').replace(/[÷]/g, '/');
    s = s.replace(/[−–—]/g, '-');
    s = s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
    s = s.replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/⅓/g, '1/3').replace(/⅔/g, '2/3');
    s = s.replace(/\bdelta\b/g, 'Δ').replace(/Δ/g, 'd');
    s = s.replace(/\brho\b/g, 'ρ').replace(/\blambda\b/g, 'λ')
         .replace(/\btheta\b/g, 'θ').replace(/\bsigma\b/g, 'σ')
         .replace(/\bepsilon\b/g, 'ε').replace(/\bomega\b/g, 'ω')
         .replace(/\bpi\b/g, 'π').replace(/\bohm(s)?\b/g, 'Ω');
    s = s.replace(/[\s,;()\[\]{}_·]/g, '');
    s = s.replace(/[.]+$/g, '');
    return s;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    const longest = Math.max(a.length, b.length);
    if (!longest) return 1;
    return 1 - levenshtein(a, b) / longest;
  }

  /* The model answer often reads "Mass per unit volume: ρ = m / V" — accept
     the whole thing, or any clause of it, so typing just the formula counts. */
  function answerCandidates(answer) {
    const out = [answer];
    answer.split(/[:;,]|\.\s/).forEach(function (part) {
      const trimmed = part.trim();
      if (trimmed.length > 1) out.push(trimmed);
    });
    /* "E = ½Fx = ½kx²" should also accept "E = ½kx²" on its own. */
    out.slice().forEach(function (clause) {
      const parts = clause.split('=');
      if (parts.length > 2) {
        for (let i = 1; i < parts.length; i++) out.push(parts[0] + '=' + parts[i]);
      }
    });
    return out.map(normalise).filter(function (s) { return s.length > 0; });
  }

  function judge(input, answer) {
    const given = normalise(input);
    if (!given) return { verdict: 'miss', score: 0 };
    const cands = answerCandidates(answer);
    let best = 0;
    for (let i = 0; i < cands.length; i++) {
      if (cands[i] === given) return { verdict: 'hit', score: 1 };
      best = Math.max(best, similarity(given, cands[i]));
    }
    if (best >= 0.82) return { verdict: 'near', score: best };
    return { verdict: 'miss', score: best };
  }

  function startRecall(topicId) {
    recall.topic = topicId || null;
    /* Formulas and units first — they are the ones worth typing out. */
    const q = buildQueue(recall.topic, SESSION_SIZE);
    q.sort(function (a, b) {
      const rank = { formula: 0, unit: 1, theorem: 2, definition: 3 };
      return rank[CARD_BY_ID[a].type] - rank[CARD_BY_ID[b].type];
    });
    recall.queue = q;
    recall.index = 0; recall.right = 0; recall.wrong = 0;
    if (!recall.queue.length) { toast('No cards in that topic', 'bad'); return; }
    $('recall-title').textContent = 'Formula Recall · ' + (recall.topic ? topicName(recall.topic) : 'All topics');
    showScreen('recall');
    renderRecall();
  }

  function renderRecall() {
    if (recall.index >= recall.queue.length) { endRecall(); return; }
    const card = CARD_BY_ID[recall.queue[recall.index]];
    $('screen-recall').style.setProperty('--accent', topicColor(card.topic));
    $('recall-topic').textContent = topicName(card.topic);
    $('recall-type').textContent = TYPE_LABEL[card.type] || card.type;
    $('recall-term').textContent = card.term;
    $('recall-counter').textContent = (recall.index + 1) + ' / ' + recall.queue.length;
    $('recall-progress').style.width = ((recall.index / recall.queue.length) * 100) + '%';

    recall.checked = false;
    $('recall-result').hidden = true;
    $('recall-input-wrap').hidden = false;
    const input = $('recall-input');
    input.value = '';
    input.disabled = false;
    setTimeout(function () { input.focus(); }, 60);
  }

  function checkRecall() {
    if (recall.checked || recall.index >= recall.queue.length) return;
    const card = CARD_BY_ID[recall.queue[recall.index]];
    const typed = $('recall-input').value;
    const result = judge(typed, card.answer);
    recall.checked = true;

    const verdict = $('recall-verdict');
    verdict.className = 'recall__verdict is-' + result.verdict;
    verdict.textContent =
      result.verdict === 'hit'  ? '✓ Spot on' :
      result.verdict === 'near' ? '≈ Very close — check the details' :
                                  '✕ Not quite';

    $('recall-yours').textContent = typed.trim() || '(left blank)';
    $('recall-model').textContent = card.answer;
    $('recall-model').classList.toggle('is-mono', isMono(card));
    $('recall-detail').textContent = card.detail;
    $('recall-input-wrap').hidden = true;
    $('recall-result').hidden = false;

    if (result.verdict === 'hit') burstFrom($('recall-result'), topicColor(card.topic));
    else if (result.verdict === 'miss') shake($('recall-result'));
  }

  function gradeRecall(correct) {
    if (!recall.checked) return;
    const id = recall.queue[recall.index];
    record(id, correct, 'recall');
    if (correct) {
      recall.right += 1;
    } else {
      recall.wrong += 1;
      if (recall.queue.indexOf(id, recall.index + 1) === -1) recall.queue.push(id);
    }
    recall.index += 1;
    renderRecall();
  }

  function endRecall() {
    $('recall-progress').style.width = '100%';
    const total = recall.right + recall.wrong;
    showResults({
      badge: '⌨',
      title: 'Recall round complete',
      sub: recall.topic ? topicName(recall.topic) : 'Mixed topics',
      stats: [
        { val: recall.right, label: 'Got it' },
        { val: recall.wrong, label: 'Missed' },
        { val: total ? Math.round((recall.right / total) * 100) + '%' : '—', label: 'Accuracy' }
      ],
      again: function () { startRecall(recall.topic); }
    });
  }

  $('btn-check').addEventListener('click', checkRecall);
  $('recall-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); checkRecall(); }
  });
  $('btn-recall-good').addEventListener('click', function () { gradeRecall(true); });
  $('btn-recall-bad').addEventListener('click', function () { gradeRecall(false); });

  /* =========================================================
     MODE 3 — SPEED SPRINT
     ========================================================= */
  const sprint = {
    timer: null, endsAt: 0, score: 0, combo: 0, best: 0,
    correct: 0, wrong: 0, card: null, locked: false, pool: []
  };

  function comboMultiplier(combo) { return clamp(1 + Math.floor(combo / 3), 1, 5); }

  function startSprint() {
    stopSprint();
    sprint.score = 0; sprint.combo = 0; sprint.best = 0;
    sprint.correct = 0; sprint.wrong = 0; sprint.locked = false;
    sprint.pool = shuffle(CARDS);
    sprint.endsAt = Date.now() + SPRINT_SECONDS * 1000;
    showScreen('sprint');
    updateSprintHud();
    nextSprintQuestion();
    sprint.timer = setInterval(tickSprint, 100);
  }

  function stopSprint() {
    if (sprint.timer) { clearInterval(sprint.timer); sprint.timer = null; }
  }

  function tickSprint() {
    const left = Math.max(0, sprint.endsAt - Date.now());
    const secs = Math.ceil(left / 1000);
    $('sprint-time').textContent = secs;
    const frac = left / (SPRINT_SECONDS * 1000);
    $('sprint-timerfill').style.width = (frac * 100) + '%';
    const urgent = secs <= 10;
    $('sprint-timerfill').classList.toggle('is-urgent', urgent);
    $('sprint-time').parentElement.classList.toggle('is-urgent', urgent);
    if (left <= 0) endSprint();
  }

  function updateSprintHud() {
    $('sprint-score').textContent = sprint.score;
    $('sprint-combo').textContent = '×' + comboMultiplier(sprint.combo);
  }

  function nextSprintQuestion() {
    if (!sprint.pool.length) sprint.pool = shuffle(CARDS);
    const card = sprint.pool.pop();
    sprint.card = card;
    sprint.locked = false;

    $('screen-sprint').style.setProperty('--accent', topicColor(card.topic));
    $('sprint-topic').textContent = topicName(card.topic);
    $('sprint-term').textContent = card.term;

    /* Distractors: same type first (they read alike), then anything. */
    const used = { };
    used[normalise(card.answer)] = true;
    const pickFrom = function (list, want) {
      const out = [];
      shuffle(list).forEach(function (c) {
        if (out.length >= want) return;
        const key = normalise(c.answer);
        if (used[key]) return;
        used[key] = true;
        out.push(c.answer);
      });
      return out;
    };
    let distractors = pickFrom(CARDS.filter(function (c) {
      return c.id !== card.id && c.type === card.type;
    }), 3);
    if (distractors.length < 3) {
      distractors = distractors.concat(pickFrom(CARDS.filter(function (c) { return c.id !== card.id; }), 3 - distractors.length));
    }

    const options = shuffle([card.answer].concat(distractors));
    const box = $('sprint-options');
    box.className = 'sprint__options';
    box.innerHTML = '';
    options.forEach(function (text, i) {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = '<span class="opt__key">' + (i + 1) + '</span><span class="opt__text"></span>';
      b.querySelector('.opt__text').textContent = text;
      if (isMono(card)) b.querySelector('.opt__text').classList.add('is-mono');
      b.addEventListener('click', function () { answerSprint(b, text === card.answer); });
      box.appendChild(b);
    });
  }

  function answerSprint(btn, correct) {
    if (sprint.locked) return;
    sprint.locked = true;
    const card = sprint.card;
    const box = $('sprint-options');
    box.classList.add('is-locked');

    if (correct) {
      const mult = comboMultiplier(sprint.combo);
      const points = Math.round(10 * card.difficulty * mult);
      sprint.score += points;
      sprint.combo += 1;
      sprint.best = Math.max(sprint.best, sprint.combo);
      sprint.correct += 1;
      btn.classList.add('is-right');
      burstFrom(btn, topicColor(card.topic));
      record(card.id, true, 'sprint');
      if (mult > 1) toast('×' + mult + ' combo · +' + points, 'good');
    } else {
      sprint.combo = 0;
      sprint.wrong += 1;
      btn.classList.add('is-wrong');
      $$('.opt', box).forEach(function (o) {
        if (o.querySelector('.opt__text').textContent === card.answer) o.classList.add('is-right');
      });
      shake(box);
      record(card.id, false, 'sprint');
    }

    updateSprintHud();
    setTimeout(function () {
      if (sprint.timer) nextSprintQuestion();
    }, correct ? 320 : 900);
  }

  function endSprint() {
    stopSprint();
    $('sprint-timerfill').style.width = '0%';
    const total = sprint.correct + sprint.wrong;

    const entry = {
      score: sprint.score, correct: sprint.correct,
      combo: sprint.best, date: dayKey(Date.now())
    };
    state.sprint.push(entry);
    state.sprint.sort(function (a, b) { return b.score - a.score; });
    state.sprint = state.sprint.slice(0, 5);
    save();

    showResults({
      badge: '⚡',
      title: sprint.score + ' points',
      sub: state.sprint[0] === entry ? 'New personal best!' : 'Best so far: ' + state.sprint[0].score,
      stats: [
        { val: sprint.correct, label: 'Correct' },
        { val: sprint.wrong, label: 'Missed' },
        { val: '×' + comboMultiplier(sprint.best), label: 'Top combo' },
        { val: total ? Math.round((sprint.correct / total) * 100) + '%' : '—', label: 'Accuracy' }
      ],
      again: startSprint,
      leaderboard: entry
    });
    if (state.sprint[0] === entry && sprint.score > 0) {
      burst(window.innerWidth / 2, window.innerHeight / 3, '#ffd166', 60);
    }
  }

  /* =========================================================
     MODE 4 — MATCH PAIRS
     ========================================================= */
  const match = { topic: null, tiles: [], open: [], moves: 0, found: 0, startedAt: 0, locked: false };

  function startMatch(topicId) {
    match.topic = topicId || null;
    const pool = match.topic ? CARDS.filter(function (c) { return c.topic === match.topic; }) : CARDS;
    if (pool.length < MATCH_PAIRS) { toast('Not enough cards in that topic', 'bad'); return; }

    /* Never put two tiles with identical text in one grid — e.g. the term
       "Velocity" and the answer to "Gradient of a displacement-time graph". */
    const picked = [];
    const usedText = {};
    shuffle(pool).forEach(function (c) {
      if (picked.length >= MATCH_PAIRS) return;
      const a = normalise(c.term), b = normalise(c.answer);
      if (usedText[a] || usedText[b] || a === b) return;
      usedText[a] = true; usedText[b] = true;
      picked.push(c);
    });
    if (picked.length < MATCH_PAIRS) { toast('Not enough distinct cards there', 'bad'); return; }

    match.tiles = shuffle(picked.reduce(function (acc, c) {
      acc.push({ cardId: c.id, side: 'term', text: c.term, topic: c.topic });
      acc.push({ cardId: c.id, side: 'answer', text: c.answer, topic: c.topic });
      return acc;
    }, []));
    match.open = []; match.moves = 0; match.found = 0; match.locked = false;
    match.startedAt = Date.now();

    $('match-title').textContent = 'Match Pairs · ' + (match.topic ? topicName(match.topic) : 'All topics');
    showScreen('match');
    renderMatch();
    updateMatchHud();
  }

  function renderMatch() {
    const grid = $('matchgrid');
    grid.className = 'matchgrid';
    grid.innerHTML = '';
    match.tiles.forEach(function (tile, i) {
      const b = document.createElement('button');
      b.className = 'tile';
      b.style.setProperty('--accent', topicColor(tile.topic));
      b.dataset.index = String(i);
      b.setAttribute('aria-label', 'Hidden card ' + (i + 1));
      b.innerHTML =
        '<span class="tile__face tile__face--back">⚛</span>' +
        '<span class="tile__face tile__face--front' + (tile.side === 'answer' ? ' is-answer' : '') +
          (tile.side === 'answer' && isMono(CARD_BY_ID[tile.cardId]) ? ' is-mono' : '') + '"></span>';
      b.querySelector('.tile__face--front').textContent = tile.text;
      b.addEventListener('click', function () { openTile(i, b); });
      grid.appendChild(b);
    });
  }

  function updateMatchHud() {
    $('match-moves').textContent = match.moves + (match.moves === 1 ? ' move' : ' moves');
    $('match-found').textContent = match.found + ' / ' + MATCH_PAIRS;
  }

  function openTile(index, el) {
    if (match.locked) return;
    if (el.classList.contains('is-open') || el.classList.contains('is-done')) return;
    el.classList.add('is-open');
    el.setAttribute('aria-label', match.tiles[index].text);
    match.open.push({ index: index, el: el });
    if (match.open.length < 2) return;

    match.moves += 1;
    updateMatchHud();
    const a = match.open[0], b = match.open[1];
    const sameCard = match.tiles[a.index].cardId === match.tiles[b.index].cardId;
    const differentSides = match.tiles[a.index].side !== match.tiles[b.index].side;

    if (sameCard && differentSides) {
      match.open = [];
      match.found += 1;
      [a, b].forEach(function (t) { t.el.classList.remove('is-open'); t.el.classList.add('is-done'); });
      burstFrom(b.el, topicColor(match.tiles[a.index].topic));
      record(match.tiles[a.index].cardId, true, 'match');
      updateMatchHud();
      if (match.found === MATCH_PAIRS) setTimeout(endMatch, 620);
    } else {
      match.locked = true;
      $('matchgrid').classList.add('is-locked');
      [a, b].forEach(function (t) { t.el.classList.add('is-miss'); });
      setTimeout(function () {
        [a, b].forEach(function (t) {
          t.el.classList.remove('is-open', 'is-miss');
          t.el.setAttribute('aria-label', 'Hidden card');
        });
        match.open = [];
        match.locked = false;
        $('matchgrid').classList.remove('is-locked');
      }, 780);
    }
  }

  function endMatch() {
    const seconds = Math.round((Date.now() - match.startedAt) / 1000);
    const perfect = match.moves === MATCH_PAIRS;
    /* Bonus XP for an efficient grid. */
    const bonus = clamp(Math.round(60 - (match.moves - MATCH_PAIRS) * 4), 10, 60);
    awardXp(bonus);
    save();
    showResults({
      badge: '🧩',
      title: perfect ? 'Flawless grid!' : 'Grid cleared',
      sub: match.topic ? topicName(match.topic) : 'Mixed topics',
      stats: [
        { val: match.moves, label: 'Moves' },
        { val: seconds + 's', label: 'Time' },
        { val: '+' + bonus, label: 'Bonus XP' }
      ],
      again: function () { startMatch(match.topic); }
    });
  }

  $('btn-match-again').addEventListener('click', function () { startMatch(match.topic); });

  /* =========================================================
     RESULTS
     ========================================================= */
  let resultsAgain = null;

  function showResults(cfg) {
    resultsAgain = cfg.again || null;
    $('results-badge').textContent = cfg.badge || '✓';
    $('results-title').textContent = cfg.title || 'Round complete';
    $('results-sub').textContent = cfg.sub || '';

    const box = $('results-stats');
    box.innerHTML = '';
    (cfg.stats || []).forEach(function (s) {
      const d = document.createElement('div');
      d.className = 'rstat';
      d.innerHTML = '<b></b><span></span>';
      d.querySelector('b').textContent = s.val;
      d.querySelector('span').textContent = s.label;
      box.appendChild(d);
    });

    const lb = $('leaderboard');
    if (cfg.leaderboard && state.sprint.length) {
      const list = $('leaderboard-list');
      list.innerHTML = '';
      state.sprint.forEach(function (e, i) {
        const li = document.createElement('li');
        if (e === cfg.leaderboard) li.className = 'is-new';
        li.innerHTML = '<b></b><span></span>';
        li.querySelector('b').textContent = (i + 1) + '.  ' + e.score + ' pts';
        li.querySelector('span').textContent = e.correct + ' correct · ' + e.date;
        list.appendChild(li);
      });
      lb.hidden = false;
    } else {
      lb.hidden = true;
    }

    showScreen('results');
    renderHud();
  }

  $('btn-results-again').addEventListener('click', function () {
    if (resultsAgain) resultsAgain();
  });
  $('btn-results-home').addEventListener('click', function () { showScreen('home'); });

  /* =========================================================
     Wiring
     ========================================================= */
  $$('.mode').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const mode = btn.dataset.mode;
      if (mode === 'flip')   return openTopicPicker('Flip Deck — choose a topic', startFlip);
      if (mode === 'recall') return openTopicPicker('Formula Recall — choose a topic', startRecall);
      if (mode === 'match')  return openTopicPicker('Match Pairs — choose a topic', startMatch, { min: MATCH_PAIRS });
      if (mode === 'sprint') return startSprint();
    });
  });

  $('btn-back').addEventListener('click', function () { showScreen('home'); });

  $('btn-reset').addEventListener('click', function () {
    if (!window.confirm('Reset all PhysDeck progress? XP, review schedule and sprint scores will be erased.')) return;
    state = defaultState();
    save();
    renderHome();
    toast('Progress reset', 'bad');
  });

  document.addEventListener('keydown', function (e) {
    if (!$('topic-sheet').hidden) {
      if (e.key === 'Escape') closeSheet();
      return;
    }
    if (e.key === 'Escape' && currentScreen !== 'home') { showScreen('home'); return; }

    if (currentScreen === 'flip') {
      if (e.key === ' ' && e.target === document.body) { e.preventDefault(); toggleFlip(); }
      if (e.key === 'ArrowRight' && flip.flipped) gradeFlip(true);
      if (e.key === 'ArrowLeft'  && flip.flipped) gradeFlip(false);
    }
    if (currentScreen === 'sprint' && /^[1-4]$/.test(e.key)) {
      const opts = $$('.opt', $('sprint-options'));
      const target = opts[Number(e.key) - 1];
      if (target) target.click();
    }
    if (currentScreen === 'recall' && recall.checked) {
      if (e.key === 'ArrowRight') gradeRecall(true);
      if (e.key === 'ArrowLeft')  gradeRecall(false);
    }
  });

  /* Leaving a mode mid-round should never leave a timer running. */
  window.addEventListener('beforeunload', save);

  /* Boot */
  renderHome();
  showScreen('home');
}());
