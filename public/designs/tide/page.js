/* ============================================================
   THE TIDE: everything that moves
   ------------------------------------------------------------
   The wave is drawn once (a wavy edge, a lace of foam along it, a
   body of water that deepens behind it) and after that it is only
   ever moved by transform, so a phone composites it instead of
   repainting it. Three beats: the water comes up the beach, goes
   back out, and the card it leaves is clean.

   Anything that hides content until a script runs has a plain-timer
   failsafe: an invitation that ships without its wave is fine, one
   that ships covered in sand is not.
   ============================================================ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var shore = document.getElementById('hero');

  /* a small seeded random, so the foam is the same on every visit */
  function rng(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }
  function edgeY(x, base, amp, seed) {
    return base + amp * (Math.sin(x / 61 + seed) * 0.6 + Math.sin(x / 23 + seed * 2.1) * 0.28 + Math.sin(x / 9 + seed * 3.3) * 0.12);
  }

  /* One sheet of water: the edge, the body, the foam. W x H in its own
     units; the SVG is stretched to whatever it covers. */
  function drawWater(svg, W, H, base, amp, seed, deep) {
    if (!svg) return;
    var r = rng(seed * 997 + 13);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var id = 'w' + seed;
    var pts = [];
    for (var x = 0; x <= W; x += 8) pts.push([x, edgeY(x, base, amp, seed)]);
    var edge = 'M' + pts.map(function (p) { return p[0] + ' ' + p[1].toFixed(1); }).join(' L');
    var html =
      '<defs>' +
        '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#bfe6e2" stop-opacity=".6"/>' +
          '<stop offset="' + (base / H + 0.06).toFixed(3) + '" stop-color="#7cc9c6" stop-opacity=".7"/>' +
          '<stop offset="1" stop-color="' + deep + '" stop-opacity=".9"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="' + edge + ' L' + W + ' ' + H + ' L0 ' + H + ' Z" fill="url(#' + id + ')"/>';
    // the lace: foam that rides the edge, thickest at it and thinning behind
    html += '<path d="' + edge + '" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round" opacity=".9"/>';
    var bubbles = '';
    for (var i = 0; i < W / 3; i++) {
      var bx = r() * W, back = Math.pow(r(), 2.2) * 46;
      var by = edgeY(bx, base, amp, seed) + 3 + back;
      var br = (1 - back / 46) * (1.2 + r() * 3.4);
      bubbles += '<circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="' + br.toFixed(2) + '"/>';
    }
    html += '<g fill="#fff" opacity=".8">' + bubbles + '</g>';
    // a few looser threads of foam further in: broken, the way foam
    // actually breaks, never an even dash
    for (var k = 0; k < 3; k++) {
      var off = 60 + k * 70 + r() * 30, x2 = r() * 40;
      while (x2 < W) {
        var len = 160 + r() * 320, d = '';
        for (var xx = x2; xx <= Math.min(W, x2 + len); xx += 8) {
          d += (d ? ' L' : 'M') + xx.toFixed(0) + ' ' + edgeY(xx, base + off, amp * 0.35, seed + k + 1).toFixed(1);
        }
        html += '<path d="' + d + '" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="' + (1.2 + r() * (2.2 - k * 0.5)).toFixed(2) + '" opacity="' + (0.25 + r() * (0.4 - k * 0.1)).toFixed(2) + '"/>';
        x2 += len + 40 + r() * 160;
      }
    }
    svg.innerHTML = html;
  }

  /* Ripple marks: the long low ridges the water leaves in sand, denser
     and darker toward the waterline, and a few shells lying among them. */
  function drawRipples(svg) {
    if (!svg) return;
    var W = 1200, H = 900, r = rng(41);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var html = '';
    for (var y = 140; y < H + 20; y += 26 + (1 - y / H) * 30 + r() * 10) {
      var t = y / H, x = -40 - r() * 80;
      while (x < W) {
        var len = 260 + r() * 520, d = '', ph = r() * 6, a = 7 + r() * 6;
        for (var xx = x; xx <= x + len; xx += 12) d += (d ? ' L' : 'M') + xx.toFixed(0) + ' ' + (y + Math.sin(xx / 95 + ph) * a + Math.sin(xx / 41 + ph * 1.7) * a * 0.3).toFixed(1);
        html += '<path d="' + d + '" stroke="rgba(130,98,58,' + (0.04 + t * 0.08).toFixed(3) + ')" stroke-width="' + (2 + t * 2.4).toFixed(2) + '"/>';
        html += '<path d="' + d + '" transform="translate(0 2.5)" stroke="rgba(255,250,240,' + (0.14 + t * 0.16).toFixed(3) + ')" stroke-width="' + (1.4 + t * 1.4).toFixed(2) + '"/>';
        x += len + 60 + r() * 200;
      }
    }
    // shells: a small fan, a pale pebble, here and there
    for (var i = 0; i < 9; i++) {
      var sx = 60 + r() * (W - 120), sy = 260 + r() * (H - 300), sc = 0.6 + r() * 0.7, rot = (r() * 80 - 40).toFixed(0);
      if (sx > W * 0.3 && sx < W * 0.7 && sy < H * 0.8) continue; // never under the card
      if (r() < 0.6) {
        var ribs = '';
        for (var k = -3; k <= 3; k++) ribs += '<path d="M0 0 L' + (k * 4.2).toFixed(1) + ' -15" stroke="rgba(170,120,95,.45)" stroke-width=".8"/>';
        html += '<g transform="translate(' + sx.toFixed(0) + ' ' + sy.toFixed(0) + ') rotate(' + rot + ') scale(' + sc.toFixed(2) + ')">' +
          '<path d="M0 0 C -14 -6 -16 -16 -9 -19 C -4 -21 4 -21 9 -19 C 16 -16 14 -6 0 0 Z" fill="#f4dccd" stroke="rgba(170,120,95,.5)" stroke-width=".8"/>' + ribs +
          '<path d="M-3 1 L3 1 L2 4 L-2 4 Z" fill="#e6c4b2"/></g>';
      } else {
        html += '<ellipse cx="' + sx.toFixed(0) + '" cy="' + sy.toFixed(0) + '" rx="' + (6 * sc).toFixed(1) + '" ry="' + (4 * sc).toFixed(1) + '" fill="rgba(236,226,210,.95)" stroke="rgba(140,110,70,.25)" stroke-width=".8"/>';
      }
    }
    svg.innerHTML = '<g fill="none" stroke-linecap="round">' + html + '</g>';
  }

  drawRipples(document.getElementById('rippleSvg'));
  drawWater(document.getElementById('waveSvg'), 1000, 1200, 70, 26, 3, '#2f97a8');
  drawWater(document.getElementById('lapSvg'), 1000, 120, 34, 12, 7, '#5fb5b8');

  /* ---------- THE TIDE ---------- */
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  var state = 'dry';

  function final() {
    timers.forEach(clearTimeout); timers = [];
    shore.classList.remove('under');
    shore.classList.add('washed', 'dried');
    state = 'done';
  }
  function comeIn() {
    if (state !== 'dry') return;
    state = 'in';
    if (reduce) { final(); return; }
    shore.classList.add('under');
    later(function () { shore.classList.remove('under'); shore.classList.add('washed'); }, 1700);
    later(function () { shore.classList.add('dried'); state = 'done'; }, 6500);
  }
  if (shore) {
    if (reduce) final();
    else {
      // it comes in by itself; a tap only brings it sooner
      later(comeIn, 1400);
      shore.addEventListener('pointerdown', comeIn, { once: true });
      // and whatever happens to the timers, the card is clean
      setTimeout(function () { if (state !== 'done') final(); }, 9000);
    }
  }

  /* ---------- THE DAY: CALENDAR LINKS ---------- */
  var L = window.__lumaTide || {};
  var WHEN = L.when || { y: 2027, m: 1, d: 1, startH: 17, startM: 0, hours: 9 };
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
      var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Twofold//The Tide//EN', 'BEGIN:VEVENT',
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

  /* the card goes out on a wave, and only once the answer is saved */
  function takeOut() {
    if (!reply) return;
    reply.classList.add('sending');
    setTimeout(function () {
      if (form) form.hidden = true;
      if (done) done.hidden = false;
      reply.classList.remove('sending');
    }, reduce ? 0 : 1100);
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
         "/"), and the card goes out on the tide only once it is saved: a
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
  window.__tide = { comeIn: comeIn, final: final, takeOut: takeOut, bringBack: bringBack };
})();
