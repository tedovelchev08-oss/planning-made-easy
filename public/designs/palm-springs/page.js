/* ============================================================
   PALM SPRINGS: everything that moves
   ------------------------------------------------------------
   Slowly, and only a few things:
   - the pool: a photograph seen through a slow SVG turbulence, so
     its floor and light move as water does. Set into the floor, a
     medallion of blue and gold-leaf glass mosaic carrying their
     initials, drawn here tile by tile; now and then the light runs
     across the gold.
   - the walls: the light the pool throws up, rippling across the
     stucco behind the letterhead and the frames.
   - the palm shadows, swaying.
   - the reply: stamped, then sealed in its envelope.
   Each of the moving layers stops while it is off screen. Anything
   that hides content until a script runs has a failsafe.
   ============================================================ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var L = window.__lumaSprings || {};

  /* a small seeded random, so the tiles are the same on every visit */
  function rng(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function roundRect(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  /* ---------- THE MEDALLION ----------
     Drawn first as flat colour on a small canvas, one pixel per tile:
     a border of blue and gold, a wreath of gold fronds on blue, and
     their initials on pale glass in the middle. Each pixel then becomes
     a glazed tile with grout around it. The gold is also drawn on its
     own as a mask, so light can be run across it alone. */
  var KEYS = {
    pale: [236, 228, 210], blue: [30, 56, 102], gold: [201, 160, 74]
  };
  function nearest(r, g, b) {
    var best = null, dist = 1e9;
    for (var k in KEYS) {
      var c = KEYS[k], d = (r - c[0]) * (r - c[0]) + (g - c[1]) * (g - c[1]) + (b - c[2]) * (b - c[2]);
      if (d < dist) { dist = d; best = k; }
    }
    return best;
  }
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  function medallion(a, b) {
    var N = 132, c = N / 2;
    var m = document.createElement('canvas');
    m.width = m.height = N;
    var x = m.getContext('2d');
    function ring(r1, r2, col) {
      x.beginPath(); x.arc(c, c, r2, 0, Math.PI * 2); x.arc(c, c, r1, 0, Math.PI * 2, true);
      x.fillStyle = rgb(KEYS[col]); x.fill('evenodd');
    }
    function disc(r, col) { x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.fillStyle = rgb(KEYS[col]); x.fill(); }
    disc(65.5, 'blue');
    ring(62.5, 64, 'gold');
    disc(62.5, 'blue');
    ring(47.5, 49, 'gold');
    // the wreath: fronds laid around the band, leaning the same way
    var n = 30;
    x.fillStyle = rgb(KEYS.gold);
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2;
      x.save();
      x.translate(c + Math.cos(ang) * 55.5, c + Math.sin(ang) * 55.5);
      x.rotate(ang + Math.PI / 2 + 0.55);
      x.beginPath(); x.ellipse(0, 0, 6.2, 2.1, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    disc(47.5, 'pale');
    ring(44, 45.2, 'gold');
    // their initials
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = 'italic 600 46px "Bodoni Moda", Georgia, serif';
    x.fillStyle = rgb(KEYS.blue);
    x.fillText(a || '', c - 21, c + 15);
    x.fillText(b || '', c + 22, c + 15);
    x.font = 'italic 500 22px "Bodoni Moda", Georgia, serif';
    x.fillStyle = rgb(KEYS.gold);
    x.fillText('&', c + 1, c + 9);

    var px = x.getImageData(0, 0, N, N).data;
    var T = 10, r = rng(19);
    var out = document.createElement('canvas'); out.width = out.height = N * T;
    var o = out.getContext('2d');
    var gm = document.createElement('canvas'); gm.width = gm.height = N * T;
    var g = gm.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, N * T, N * T);
    for (var ty = 0; ty < N; ty++) {
      for (var tx = 0; tx < N; tx++) {
        var p = (ty * N + tx) * 4;
        if (px[p + 3] < 128) continue;
        var k = nearest(px[p], px[p + 1], px[p + 2]);
        var base = KEYS[k], j = (r() - 0.5) * (k === 'pale' ? 0.07 : 0.16);
        var col = base.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * (1 + j)))); });
        var X = tx * T, Y = ty * T;
        if (k === 'gold') {
          // gold-leaf glass: each tile catches the light at its own angle
          var gr = o.createLinearGradient(X, Y, X + T, Y + T);
          var hi = r() < 0.25;
          gr.addColorStop(0, hi ? '#f6dc95' : '#d9b45f');
          gr.addColorStop(1, hi ? '#b98d36' : '#9c7329');
          o.fillStyle = gr;
          g.fillStyle = '#fff';
          roundRect(g, X + 0.8, Y + 0.8, T - 1.6, T - 1.6, 1.4); g.fill();
        } else {
          o.fillStyle = rgb(col);
        }
        roundRect(o, X + 0.8, Y + 0.8, T - 1.6, T - 1.6, 1.4);
        o.fill();
        o.fillStyle = 'rgba(255,255,255,' + (0.08 + r() * 0.08).toFixed(2) + ')';
        o.fillRect(X + 2, Y + 1.4, T - 4.5, 1.2);
      }
    }
    return { url: out.toDataURL('image/png'), gold: gm.toDataURL('image/png') };
  }

  /* ---------- THE POOL ---------- */
  var PHOTOS = {
    tall: { src: 'assets/pool-tall.jpg', W: 900, H: 1600, water: { x: 65, y: 422, w: 835, h: 1004 } },
    wide: { src: 'assets/pool-wide.jpg', W: 1600, H: 900, water: { x: 367, y: 158, w: 1041, h: 566 } }
  };
  var pool = null;

  function visible(P, host) {
    var w = host.clientWidth, h = host.clientHeight;
    var s = Math.max(w / P.W, h / P.H);
    var vw = w / s, vh = h / s;
    return { s: s, x0: (P.W - vw) / 2, y0: (P.H - vh) / 2, vw: vw, vh: vh };
  }

  function buildPool(svg, med) {
    var host = svg.parentNode;
    var shape = host.clientWidth / Math.max(1, host.clientHeight) >= 1 ? 'wide' : 'tall';
    var P = PHOTOS[shape], Wt = P.water;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + P.W + ' ' + P.H);

    var defs = svgEl('defs', {});
    var filter = svgEl('filter', { id: 'ripple', x: '-4%', y: '-4%', width: '108%', height: '108%', 'color-interpolation-filters': 'sRGB' });
    var turb = svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.007 0.017', numOctaves: '2', seed: '5', result: 'n' });
    if (!reduce) turb.appendChild(svgEl('animate', { attributeName: 'baseFrequency', dur: '19s', values: '0.007 0.017;0.009 0.021;0.008 0.016;0.007 0.017', repeatCount: 'indefinite' }));
    var disp = svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: reduce ? '4' : '9', xChannelSelector: 'R', yChannelSelector: 'G' });
    filter.appendChild(turb); filter.appendChild(disp);
    defs.appendChild(filter);
    // only the brightest light on the floor, to lay back over the tiles
    var lift = svgEl('filter', { id: 'lift', 'color-interpolation-filters': 'sRGB' });
    lift.appendChild(svgEl('feColorMatrix', { type: 'matrix', values: '0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0' }));
    var ct = svgEl('feComponentTransfer', {});
    ['feFuncR', 'feFuncG', 'feFuncB'].forEach(function (f) { ct.appendChild(svgEl(f, { type: 'table', tableValues: '0 0 0 0 0 0 0 0.35 1' })); });
    lift.appendChild(ct);
    defs.appendChild(lift);
    // the stone around the water stays dry and still
    var dry = svgEl('clipPath', { id: 'dry' });
    dry.appendChild(svgEl('path', { 'clip-rule': 'evenodd', d: 'M0 0H' + P.W + 'V' + P.H + 'H0Z M' + Wt.x + ' ' + Wt.y + 'h' + Wt.w + 'v' + Wt.h + 'h-' + Wt.w + 'Z' }));
    defs.appendChild(dry);
    // a band of light run across the gold now and then
    var sweep = svgEl('linearGradient', { id: 'sweep', x1: '0', y1: '0', x2: '1', y2: '0.35' });
    [['0', 0], ['.42', 0], ['.5', 0.85], ['.58', 0], ['1', 0]].forEach(function (st) {
      sweep.appendChild(svgEl('stop', { offset: st[0], 'stop-color': '#fff6da', 'stop-opacity': String(st[1]) }));
    });
    defs.appendChild(sweep);
    var gmask = svgEl('mask', { id: 'goldmask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: P.W, height: P.H });
    var gimg = svgEl('image', { href: med.gold });
    gmask.appendChild(gimg);
    defs.appendChild(gmask);
    svg.appendChild(defs);

    var under = svgEl('g', { filter: 'url(#ripple)' });
    under.appendChild(svgEl('image', { href: P.src, width: P.W, height: P.H, preserveAspectRatio: 'none' }));
    var tiles = svgEl('image', { href: med.url, opacity: '.96' });
    under.appendChild(tiles);
    var shine = svgEl('rect', { fill: 'url(#sweep)', mask: 'url(#goldmask)', style: 'mix-blend-mode:screen' });
    if (!reduce) {
      shine.appendChild(svgEl('animate', { attributeName: 'x', dur: '9s', repeatCount: 'indefinite', keyTimes: '0;0.55;1', values: '0;0;0', calcMode: 'spline', keySplines: '0 0 1 1;.4 0 .2 1' }));
    }
    under.appendChild(shine);
    under.appendChild(svgEl('image', { href: P.src, width: P.W, height: P.H, preserveAspectRatio: 'none', filter: 'url(#lift)', style: 'mix-blend-mode:screen', opacity: '.45' }));
    svg.appendChild(under);
    svg.appendChild(svgEl('image', { href: P.src, width: P.W, height: P.H, preserveAspectRatio: 'none', 'clip-path': 'url(#dry)' }));

    pool = { svg: svg, host: host, P: P, shape: shape, tiles: tiles, gimg: gimg, shine: shine, disp: disp, base: reduce ? 4 : 9, med: med };
    place();
    return pool;
  }

  /* the medallion in the middle of the water that is on screen; their
     names on the stone above it */
  function place() {
    if (!pool) return;
    var P = pool.P, Wt = P.water, v = visible(P, pool.host);
    var left = Math.max(Wt.x, v.x0), right = Math.min(Wt.x + Wt.w, v.x0 + v.vw);
    var top = Math.max(Wt.y, v.y0), bottom = Math.min(Wt.y + Wt.h, v.y0 + v.vh);
    var size = Math.min(right - left, bottom - top) * 0.8;
    var cx = (left + right) / 2, cy = (top + bottom) / 2;
    var x = cx - size / 2, y = cy - size / 2;
    [pool.tiles, pool.gimg].forEach(function (im) {
      im.setAttribute('x', x.toFixed(1)); im.setAttribute('y', y.toFixed(1));
      im.setAttribute('width', size.toFixed(1)); im.setAttribute('height', size.toFixed(1));
    });
    // the band of light starts off the medallion and runs across it
    pool.shine.setAttribute('y', y.toFixed(1));
    pool.shine.setAttribute('width', size.toFixed(1));
    pool.shine.setAttribute('height', size.toFixed(1));
    pool.shine.setAttribute('x', (x - size).toFixed(1));
    pool.shine.querySelectorAll('animate').forEach(function (an) {
      an.setAttribute('values', (x - size).toFixed(0) + ';' + (x - size).toFixed(0) + ';' + (x + size).toFixed(0));
    });
    // the names go in the middle of the stone above the water
    var eng = document.getElementById('engraved');
    if (eng) {
      var stoneTop = Math.max(0, (0 - v.y0) * v.s), stoneBottom = (Wt.y - v.y0) * v.s;
      eng.style.top = ((stoneTop + stoneBottom) / 2).toFixed(0) + 'px';
    }
  }

  function stir(clientX, clientY) {
    if (!pool || reduce) return;
    var t0 = performance.now(), peak = pool.base * 2.2;
    function step(t) {
      var p = Math.min(1, (t - t0) / 2200);
      var v = p < 0.15 ? pool.base + (peak - pool.base) * (p / 0.15) : pool.base + (peak - pool.base) * Math.exp(-(p - 0.15) * 3.4);
      pool.disp.setAttribute('scale', v.toFixed(1));
      if (p < 1) requestAnimationFrame(step); else pool.disp.setAttribute('scale', String(pool.base));
    }
    requestAnimationFrame(step);
  }

  function build() {
    var svg = document.getElementById('water');
    if (!svg) return;
    var med = medallion(L.a, L.b);
    buildPool(svg, med);
    document.documentElement.classList.add('pool-ready');
  }
  var fontReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('italic 600 46px "Bodoni Moda"'), document.fonts.load('italic 500 26px "Bodoni Moda"')])
    : Promise.resolve();
  Promise.race([fontReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(build, build);
  // whatever happens, the names on the stone are shown
  setTimeout(function () { document.documentElement.classList.add('pool-ready'); }, 2500);

  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (!pool) return;
      var shape = pool.host.clientWidth / Math.max(1, pool.host.clientHeight) >= 1 ? 'wide' : 'tall';
      if (shape !== pool.shape) buildPool(pool.svg, pool.med); else place();
    }, 160);
  });
  var heroEl = document.getElementById('hero');
  if (heroEl) heroEl.addEventListener('pointerdown', function (e) { stir(e.clientX, e.clientY); });

  /* ---------- LIGHT OFF THE WATER ----------
     On the walls near the pool: ridged turbulence, thresholded to thin
     bright lines, which is what sunlight reflected off moving water
     looks like on a wall. It drifts slowly. */
  document.querySelectorAll('svg.glow').forEach(function (svg, i) {
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', '0 0 800 800');
    var id = 'caustic' + i;
    var f = svgEl('filter', { id: id, x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' });
    var t = svgEl('feTurbulence', { type: 'turbulence', baseFrequency: '0.012 0.03', numOctaves: '2', seed: String(7 + i) });
    if (!reduce) t.appendChild(svgEl('animate', { attributeName: 'baseFrequency', dur: (16 + i * 3) + 's', values: '0.012 0.030;0.015 0.024;0.011 0.033;0.012 0.030', repeatCount: 'indefinite' }));
    f.appendChild(t);
    f.appendChild(svgEl('feColorMatrix', { type: 'matrix', values: '0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.84  -2.2 0 0 0 1.05' }));
    var ct = svgEl('feComponentTransfer', {});
    ct.appendChild(svgEl('feFuncA', { type: 'table', tableValues: '0 0 0 0.05 0.35 0.9' }));
    f.appendChild(ct);
    var defs = svgEl('defs', {});
    defs.appendChild(f);
    svg.appendChild(defs);
    svg.appendChild(svgEl('rect', { width: 800, height: 800, filter: 'url(#' + id + ')' }));
  });

  // nothing moves while it is off screen
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var svg = en.target.querySelector('svg.water, svg.glow');
        if (!svg || !svg.pauseAnimations) return;
        if (en.isIntersecting) svg.unpauseAnimations(); else svg.pauseAnimations();
      });
    }, { rootMargin: '80px' });
    document.querySelectorAll('#hero, .lit').forEach(function (s) { io.observe(s); });
  }

  /* ---------- REVEALS ---------- */
  var rv = document.querySelectorAll('.rv');
  if (reduce || !('IntersectionObserver' in window)) {
    rv.forEach(function (e) { e.classList.add('in'); });
  } else {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); seen.unobserve(en.target); }
      });
    }, { threshold: 0.16 });
    rv.forEach(function (e) { seen.observe(e); });
    setTimeout(function () { rv.forEach(function (e) { e.classList.add('in'); }); }, 12000);
  }

  /* ---------- THE DAY: CALENDAR LINKS ---------- */
  var WHEN = L.when || { y: 2027, m: 1, d: 1, startH: 16, startM: 0, hours: 9 };
  var TITLE = L.title || 'Wedding';
  var WHERE = L.where || '';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(h, mi) {
    var dt = new Date(WHEN.y, WHEN.m - 1, WHEN.d, h, mi);
    return '' + dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + pad(dt.getMinutes()) + '00';
  }
  var startAt = stamp(WHEN.startH, WHEN.startM);
  var endAt = stamp(WHEN.startH + WHEN.hours, WHEN.startM);
  var gcal = document.getElementById('gcal-link');
  if (gcal) {
    gcal.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent(TITLE) + '&dates=' + startAt + '/' + endAt
      + '&location=' + encodeURIComponent(WHERE);
  }
  var ics = document.getElementById('ics-link');
  if (ics) {
    ics.addEventListener('click', function (e) {
      e.preventDefault();
      var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Twofold//Palm Springs//EN', 'BEGIN:VEVENT',
        'DTSTART:' + startAt, 'DTEND:' + endAt, 'SUMMARY:' + TITLE, 'LOCATION:' + WHERE,
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
      var a = document.createElement('a');
      a.href = url; a.download = 'wedding.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  /* ---------- THE RESERVATION CARD ---------- */
  var reply = document.getElementById('reply');
  var form = document.getElementById('rsvp-form');
  var done = document.getElementById('rsvp-confirmed');
  var err = document.getElementById('rsvp-error');
  var coming = document.getElementById('comingFields');
  var plusWrap = document.getElementById('rsvp-plusone-wrap');

  function party() {
    var c = form && form.querySelector('input[name="guest_count"]:checked');
    return c ? +c.value : 1;
  }
  function syncFields() {
    if (!form) return;
    var no = form.querySelector('input[name="attending"]:checked').value === 'no';
    if (coming) coming.hidden = no;
    if (plusWrap) plusWrap.hidden = no || party() < 2;
    form.querySelectorAll('.tick').forEach(function (t) { t.classList.toggle('selected', t.querySelector('input').checked); });
    form.querySelectorAll('.numerals label').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
  }
  if (form) {
    form.querySelectorAll('input[type="radio"]').forEach(function (i) { i.addEventListener('change', syncFields); });
    syncFields();
  }

  /* stamped, then folded into the envelope, which seals; only ever once
     the answer is saved */
  function takeOut() {
    if (!reply) return;
    if (reduce) { reply.classList.add('sealed'); form.hidden = true; done.hidden = false; return; }
    reply.classList.add('stamped');
    setTimeout(function () { reply.classList.add('folding'); }, 1300);
    setTimeout(function () { form.hidden = true; reply.classList.add('sealing'); }, 2000);
    setTimeout(function () { reply.classList.add('sealed'); done.hidden = false; }, 3600);
  }
  function bringBack() {
    reply.classList.remove('stamped', 'folding', 'sealing', 'sealed');
    if (done) done.hidden = true;
    if (form) { form.hidden = false; form.reset(); syncFields(); }
    var first = document.getElementById('rsvpName');
    if (first) first.focus();
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (err) err.hidden = true;
      var name = document.getElementById('rsvpName');
      if (name && !name.value.trim()) {
        if (err) { err.textContent = 'A name, please, so we can find you on the list.'; err.hidden = false; }
        name.focus();
        return;
      }
      /* the reply goes to /api/rsvp (luma-bridge.js answers this POST to
         "/"), and the card is stamped and sealed only once it is saved: a
         guest is never told it was sent when it wasn't. The form is read
         BEFORE its fields are disabled, which drops them. */
      var data = new URLSearchParams(new FormData(form)).toString();
      var controls = form.querySelectorAll('input, textarea, select, button');
      controls.forEach(function (c) { c.disabled = true; });
      function failed(message) {
        controls.forEach(function (c) { c.disabled = false; });
        if (err) { err.textContent = message || "That didn't send. Please try again."; err.hidden = false; }
      }
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (b) { failed(b && b.error); }, function () { failed(); });
        controls.forEach(function (c) { c.disabled = false; });
        takeOut();
      }).catch(function () { failed(); });
    });
  }
  var again = document.getElementById('rsvpAgain');
  if (again) again.addEventListener('click', bringBack);

  /* hooks, so a still can be taken of any of it */
  window.__springs = { stir: stir, takeOut: takeOut, bringBack: bringBack };
})();
