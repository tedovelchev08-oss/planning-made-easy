/* ============================================================
   PALM SHADOW: everything that moves
   ------------------------------------------------------------
   One thing moves, and slowly: the shadow of a palm, cut from a
   photograph of a real one, lying across the whole page. As the
   guest reads down it drifts and turns a little, the way a shadow
   crosses a room through an afternoon. It is only ever moved by
   transform, so a phone composites it rather than repainting.

   Anything that hides content until a script runs has a failsafe.
   ============================================================ */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var L = window.__lumaShadow || {};

  /* ---------- THE SHADOW ---------- */
  var drift = document.getElementById('drift');
  if (drift && !reduce) {
    var ticking = false;
    function move() {
      ticking = false;
      var max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      var p = scrollY / max;                       // 0 at the top, 1 at the foot
      // across the page and back once, turning through a few degrees
      var x = Math.sin(p * Math.PI * 1.6) * 34 - 8;  // vw
      var y = -10 + p * 30;                          // vh
      var a = -14 + p * 22;                          // deg
      drift.style.transform = 'translate3d(' + x.toFixed(2) + 'vw,' + y.toFixed(2) + 'vh,0) rotate(' + a.toFixed(2) + 'deg)';
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(move); } }, { passive: true });
    addEventListener('resize', move);
    move();
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
      var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Luma//Palm Shadow//EN', 'BEGIN:VEVENT',
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

  /* the card slips away into the envelope, and only once the answer is
     saved; the thank-you comes up in its place */
  function takeOut() {
    if (!reply) return;
    if (reduce) { form.hidden = true; done.hidden = false; return; }
    reply.classList.add('sending');
    setTimeout(function () {
      if (form) form.hidden = true;
      if (done) done.hidden = false;
      reply.classList.remove('sending');
      reply.classList.add('sent');
      setTimeout(function () { reply.classList.remove('sent'); }, 1400);
    }, 900);
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
         "/"), and the card is sent only once it is saved: a guest
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
  window.__shadow = { takeOut: takeOut, bringBack: bringBack };
})();
