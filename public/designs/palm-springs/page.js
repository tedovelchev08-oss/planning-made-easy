/* ============================================================
   PALM SPRINGS: everything that moves
   ------------------------------------------------------------
   The pool is a photograph seen through an SVG filter: a slow
   turbulence displaces it, so the floor and its light wobble the way
   a pool floor does at noon. Their names are laid into that floor as
   mosaic, one small tile per pixel of the letter, drawn here from
   the couple's own names, and they sit under the same water. The
   bright parts of the photograph (the caustics) are lifted out and
   laid back over the tiles, so the light plays across the letters
   too. Touching the water sends a ring out and stirs it.

   Anything that hides content until a script runs has a failsafe:
   an invitation without its ripple is fine, one with its words
   still hidden is not.
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

  /* ---------- THE MOSAIC ----------
     Each line is rasterised small, one canvas pixel per tile, and every
     pixel the letter covers becomes a glazed tile with grout around it. */
  function rasterLine(text, capRows) {
    var c = document.createElement('canvas');
    var size = Math.round(capRows * 1.42);
    var ctx = c.getContext('2d');
    ctx.font = '800 ' + size + 'px Fraunces, Georgia, serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = Math.max(1, Math.round(capRows / 9)) + 'px';
    var w = Math.ceil(ctx.measureText(text).width) + 6;
    var h = Math.ceil(size * 1.3);
    c.width = w; c.height = h;
    ctx.font = '800 ' + size + 'px Fraunces, Georgia, serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = Math.max(1, Math.round(capRows / 9)) + 'px';
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 3, Math.round(size * 1.02));
    var px = ctx.getImageData(0, 0, w, h).data;
    var on = [], minX = w, maxX = 0, minY = h, maxY = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] > 120) {
          on.push([x, y]);
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!on.length) return { cols: 0, rows: 0, on: [] };
    return {
      cols: maxX - minX + 1, rows: maxY - minY + 1,
      on: on.map(function (p) { return [p[0] - minX, p[1] - minY]; })
    };
  }

  /* lines: [{ text, rows, colour }]; returns a data URL and its size in tiles */
  function mosaic(lines, seed) {
    var r = rng(seed || 7);
    var set = lines.filter(function (l) { return l.text; }).map(function (l) {
      var m = rasterLine(l.text, l.rows); m.colour = l.colour; m.gap = l.gap == null ? 3 : l.gap; return m;
    });
    var cols = Math.max.apply(null, set.map(function (m) { return m.cols; }).concat([1]));
    var rows = set.reduce(function (s, m, i) { return s + m.rows + (i ? m.gap : 0); }, 0);
    var T = 12, pad = 3;
    var c = document.createElement('canvas');
    c.width = (cols + pad * 2) * T; c.height = (rows + pad * 2) * T;
    var ctx = c.getContext('2d');
    /* the panel the letters are set in: pale glazed tile, edged with one
       row of dark tile, as a pool marks its depth. It also keeps the lane
       line and the light on the floor from running through the letters. */
    for (var gy = 0; gy < rows + pad * 2; gy++) {
      for (var gx = 0; gx < cols + pad * 2; gx++) {
        var edge = gx === 0 || gy === 0 || gx === cols + pad * 2 - 1 || gy === rows + pad * 2 - 1;
        ctx.fillStyle = shade(edge ? NAVY_TILE : PALE_TILE, (r() - 0.5) * (edge ? 0.16 : 0.06));
        roundRect(ctx, gx * T + 0.9, gy * T + 0.9, T - 1.8, T - 1.8, 1.6);
        ctx.fill();
      }
    }
    var top = pad;
    set.forEach(function (m, i) {
      if (i) top += m.gap;
      var left = pad + Math.floor((cols - m.cols) / 2);
      m.on.forEach(function (p) {
        var x = (left + p[0]) * T, y = (top + p[1]) * T;
        // each tile its own shade: fired glaze is never quite even
        var j = (r() - 0.5) * 0.16;
        ctx.fillStyle = shade(m.colour, j);
        roundRect(ctx, x + 0.9, y + 0.9, T - 1.8, T - 1.8, 1.6);
        ctx.fill();
        // a little glaze catching the light on the upper edge
        ctx.fillStyle = 'rgba(255,255,255,' + (0.10 + r() * 0.10).toFixed(2) + ')';
        ctx.fillRect(x + 2, y + 1.6, T - 4.5, 1.4);
      });
      top += m.rows;
    });
    return { url: c.toDataURL('image/png'), cols: cols + pad * 2, rows: rows + pad * 2 };
  }
  function shade(hex, j) {
    var n = parseInt(hex.slice(1), 16), rr = n >> 16, gg = (n >> 8) & 255, bb = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(v * (1 + j)))); };
    return 'rgb(' + f(rr) + ',' + f(gg) + ',' + f(bb) + ')';
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

  /* ---------- THE WATER ---------- */
  var PHOTOS = {
    tall: { src: 'assets/pool-tall.jpg', W: 900, H: 1600, dry: 250 },
    wide: { src: 'assets/pool-wide.jpg', W: 1600, H: 900, dry: 212 }
  };
  var pools = [];

  function buildPool(svg, lines, idx) {
    var host = svg.parentNode;
    var shape = host.clientWidth / Math.max(1, host.clientHeight) >= 1 ? 'wide' : 'tall';
    var P = PHOTOS[shape];
    var fid = 'ripple' + idx, hid = 'lift' + idx, cid = 'dry' + idx;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + P.W + ' ' + P.H);

    var defs = svgEl('defs', {});
    var filter = svgEl('filter', { id: fid, x: '-4%', y: '-4%', width: '108%', height: '108%', 'color-interpolation-filters': 'sRGB' });
    var turb = svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.008 0.021', numOctaves: '2', seed: String(3 + idx), result: 'n' });
    if (!reduce) {
      turb.appendChild(svgEl('animate', { attributeName: 'baseFrequency', dur: '13s', values: '0.008 0.021;0.010 0.026;0.009 0.019;0.008 0.021', repeatCount: 'indefinite' }));
    }
    var disp = svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: reduce ? '5' : '11', xChannelSelector: 'R', yChannelSelector: 'G' });
    filter.appendChild(turb); filter.appendChild(disp);
    defs.appendChild(filter);
    // the caustics: only the brightest light in the photograph, kept
    var lift = svgEl('filter', { id: hid, 'color-interpolation-filters': 'sRGB' });
    lift.appendChild(svgEl('feColorMatrix', { type: 'matrix', values: '0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0' }));
    var ct = svgEl('feComponentTransfer', {});
    ['feFuncR', 'feFuncG', 'feFuncB'].forEach(function (f) { ct.appendChild(svgEl(f, { type: 'table', tableValues: '0 0 0 0 0 0 0.25 0.9 1' })); });
    lift.appendChild(ct);
    defs.appendChild(lift);
    var clip = svgEl('clipPath', { id: cid });
    clip.appendChild(svgEl('rect', { x: 0, y: 0, width: P.W, height: P.dry }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    var under = svgEl('g', { filter: 'url(#' + fid + ')' });
    under.appendChild(svgEl('image', { href: P.src, width: P.W, height: P.H, preserveAspectRatio: 'none' }));
    var tiles = svgEl('image', { 'class': 'tiles' });
    under.appendChild(tiles);
    var glint = svgEl('image', { href: P.src, width: P.W, height: P.H, preserveAspectRatio: 'none', filter: 'url(#' + hid + ')', style: 'mix-blend-mode:screen', opacity: '.5' });
    under.appendChild(glint);
    svg.appendChild(under);
    // the coping is stone, not water: laid back over, dry and still
    svg.appendChild(svgEl('image', { href: P.src, width: P.W, height: P.H, preserveAspectRatio: 'none', 'clip-path': 'url(#' + cid + ')' }));

    var m = mosaic(lines, 11 + idx);
    tiles.setAttribute('href', m.url);
    var pool = { svg: svg, host: host, P: P, tiles: tiles, m: m, disp: disp, base: reduce ? 5 : 11, shape: shape, lines: lines, idx: idx };
    place(pool);
    pools[idx] = pool;
    return pool;
  }

  /* the tiles go in the middle of whatever part of the pool is on screen */
  function place(pool) {
    var P = pool.P, w = pool.host.clientWidth, h = pool.host.clientHeight;
    var s = Math.max(w / P.W, h / P.H);
    var visW = w / s, visH = h / s, x0 = (P.W - visW) / 2, y0 = (P.H - visH) / 2;
    var top = Math.max(P.dry, y0) + 24, bottom = y0 + visH - 24;
    var maxW = visW * (w < 700 ? 0.86 : 0.46), maxH = (bottom - top) * 0.74;
    var k = Math.min(maxW / pool.m.cols, maxH / pool.m.rows);
    var tw = pool.m.cols * k, th = pool.m.rows * k;
    pool.tiles.setAttribute('width', tw.toFixed(1));
    pool.tiles.setAttribute('height', th.toFixed(1));
    pool.tiles.setAttribute('x', ((P.W - tw) / 2).toFixed(1));
    pool.tiles.setAttribute('y', (top + (bottom - top - th) * 0.46).toFixed(1));
  }

  /* touch the water: a ring goes out and the water is stirred, then settles */
  function stir(pool, clientX, clientY) {
    if (!pool) return;
    var rect = pool.host.getBoundingClientRect();
    var ring = document.createElement('span');
    ring.className = 'ring';
    ring.style.left = (clientX - rect.left) + 'px';
    ring.style.top = (clientY - rect.top) + 'px';
    pool.host.appendChild(ring);
    setTimeout(function () { ring.remove(); }, 1800);
    if (reduce) return;
    var t0 = performance.now(), peak = pool.base * 3.2;
    function step(t) {
      var p = Math.min(1, (t - t0) / 1600);
      // up fast, down slowly, with one small echo
      var v = p < 0.12 ? pool.base + (peak - pool.base) * (p / 0.12)
            : pool.base + (peak - pool.base) * Math.exp(-(p - 0.12) * 4.2) * (0.85 + 0.15 * Math.cos((p - 0.12) * 18));
      pool.disp.setAttribute('scale', v.toFixed(1));
      if (p < 1) requestAnimationFrame(step); else pool.disp.setAttribute('scale', String(pool.base));
    }
    requestAnimationFrame(step);
  }

  function upper(s) { return String(s || '').toLocaleUpperCase(); }
  function splitLine(s) {
    var words = String(s || '').split(/\s+/).filter(Boolean);
    if (words.join(' ').length <= 12 || words.length < 2) return [words.join(' ')];
    var best = 1, diff = 1e9;
    for (var i = 1; i < words.length; i++) {
      var d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
      if (d < diff) { diff = d; best = i; }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }

  var NAVY = '#173f80', CORAL = '#e2725b';
  var NAVY_TILE = '#1d4a8c', PALE_TILE = '#e3f3f1';
  var heroLines = [
    { text: upper(L.one), rows: 13, colour: NAVY },
    { text: '&', rows: 9, colour: CORAL, gap: 3 },
    { text: upper(L.two), rows: 13, colour: NAVY, gap: 3 },
    { text: L.mark || '', rows: 6, colour: NAVY, gap: 6 }
  ];
  var endLines = splitLine(upper(L.closing)).map(function (t, i) { return { text: t, rows: 9, colour: i ? CORAL : NAVY, gap: 3 }; });

  function build() {
    var hero = document.getElementById('water');
    var end = document.getElementById('water2');
    if (hero) buildPool(hero, heroLines, 0);
    if (end) buildPool(end, endLines, 1);
    document.documentElement.classList.add('pool-ready');
  }

  // the tiles need the typeface before they can be laid
  var fontReady = document.fonts && document.fonts.load ? document.fonts.load('800 40px Fraunces') : Promise.resolve();
  Promise.race([fontReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(build, build);

  // a new shape of screen (a phone turned round) may want the other photograph
  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      pools.forEach(function (p) {
        if (!p) return;
        var shape = p.host.clientWidth / Math.max(1, p.host.clientHeight) >= 1 ? 'wide' : 'tall';
        if (shape !== p.shape) buildPool(p.svg, p.lines, p.idx); else place(p);
      });
    }, 160);
  });

  var heroEl = document.getElementById('hero');
  var hint = document.getElementById('hint');
  if (heroEl) {
    heroEl.addEventListener('pointerdown', function (e) {
      stir(pools[0], e.clientX, e.clientY);
      if (hint) hint.classList.add('gone');
    });
    // once by itself, so a guest sees that it is water
    if (!reduce) setTimeout(function () {
      var r = heroEl.getBoundingClientRect();
      if (pools[0] && r.bottom > 0) stir(pools[0], r.left + r.width * 0.62, r.top + r.height * 0.7);
    }, 1900);
  }
  var endEl = document.getElementById('closing');
  if (endEl) endEl.addEventListener('pointerdown', function (e) { stir(pools[1], e.clientX, e.clientY); });

  // a pool off screen is not worth animating
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var svg = en.target.querySelector('svg.water');
        if (!svg || !svg.pauseAnimations) return;
        if (en.isIntersecting) svg.unpauseAnimations(); else svg.pauseAnimations();
      });
    }, { rootMargin: '80px' });
    document.querySelectorAll('.pool').forEach(function (s) { io.observe(s); });
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
    }, { threshold: 0.18 });
    rv.forEach(function (e) { seen.observe(e); });
    // whatever happens, nothing stays hidden
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
      var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Luma//Palm Springs//EN', 'BEGIN:VEVENT',
        'DTSTART:' + startAt, 'DTEND:' + endAt, 'SUMMARY:' + TITLE, 'LOCATION:' + WHERE,
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
      var a = document.createElement('a');
      a.href = url; a.download = 'wedding.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  /* ---------- THE REPLY ---------- */
  var reply = document.getElementById('reply');
  var form = document.getElementById('rsvp-form');
  var done = document.getElementById('rsvp-confirmed');
  var err = document.getElementById('rsvp-error');
  var coming = document.getElementById('comingFields');
  var plusWrap = document.getElementById('rsvp-plusone-wrap');
  var count = document.getElementById('rsvp-guest-count');

  function syncFields() {
    var no = form && form.querySelector('input[name="attending"]:checked').value === 'no';
    if (coming) coming.hidden = no;
    if (plusWrap) plusWrap.hidden = no || !count || +count.value < 2;
  }
  document.querySelectorAll('.choice .opt input').forEach(function (input) {
    input.addEventListener('change', function () {
      document.querySelectorAll('.choice .opt').forEach(function (o) {
        o.classList.toggle('selected', o.contains(input) && input.checked);
      });
      syncFields();
    });
  });
  if (count) count.addEventListener('change', syncFields);
  if (form) syncFields();

  /* the tag is dropped in the pool, and only once the answer is saved;
     a moment later the answer tag floats up in its place */
  function takeOut() {
    if (!reply) return;
    if (reduce) { form.hidden = true; done.hidden = false; return; }
    reply.classList.add('dropping');
    setTimeout(function () {
      if (form) form.hidden = true;
      if (done) done.hidden = false;
      reply.classList.remove('dropping');
      reply.classList.add('surfaced');
      setTimeout(function () { reply.classList.remove('surfaced'); }, 1400);
    }, 1150);
  }
  function bringBack() {
    if (done) done.hidden = true;
    if (form) { form.hidden = false; form.reset(); syncFields(); }
    document.querySelectorAll('.choice .opt').forEach(function (o, i) { o.classList.toggle('selected', i === 0); });
    var first = document.getElementById('rsvpName');
    if (first) first.focus();
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (err) err.hidden = true;
      var name = document.getElementById('rsvpName');
      if (name && !name.value.trim()) {
        if (err) { err.textContent = 'We need a name to match you to the list.'; err.hidden = false; }
        name.focus();
        return;
      }
      /* the reply goes to /api/rsvp (luma-bridge.js answers this POST to
         "/"), and the tag goes in the pool only once it is saved: a guest
         is never told it was sent when it wasn't. The form is read BEFORE
         its fields are disabled, which drops them. */
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
  window.__springs = { stir: function (x, y) { stir(pools[0], x, y); }, takeOut: takeOut, bringBack: bringBack };
})();
