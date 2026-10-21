/* ============================================================
   THE INSCRIPTION — everything below the hero
   ------------------------------------------------------------
   Reveals, the channel scoring downward, the calendar links, and
   the guest's own name being cut when they reply.

   Rule followed throughout, learned the hard way on the two
   designs before this one: anything that hides content until a
   script runs gets a plain-timer failsafe. IntersectionObserver
   is throttled in background tabs and absent in some headless
   contexts, and an invitation that ships blank is worse than one
   that ships without its animation.
   ============================================================ */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ARRIVAL ---------- */
  var watched = [].slice.call(
    document.querySelectorAll('[data-reveal],[data-tablet],[data-hours]')
  );
  function settleAll() { watched.forEach(function (el) { el.classList.add('in'); }); }

  if (reduce || !('IntersectionObserver' in window)) {
    settleAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    watched.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      if (!document.querySelector('[data-reveal].in')) settleAll();
    }, 4200);
  }

  /* ---------- THE INDEX ---------- */
  document.querySelectorAll('.index a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ---------- CALENDAR ----------
     Both links come off one date, so they cannot disagree. */
  /* LUMA: the couple's day, set by luma-ins.js from their wedding */
  var L = window.__lumaIns || {};
  var WHEN = L.when || { y: 2027, m: 1, d: 1, startH: 16, startM: 0, hours: 9 };
  var TITLE = L.title || 'Wedding';
  var WHERE = L.where || '';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(h, mi) {
    return '' + WHEN.y + pad(WHEN.m) + pad(WHEN.d) + 'T' + pad(h) + pad(mi) + '00';
  }
  var startAt = stamp(WHEN.startH, WHEN.startM);
  var endAt   = stamp(WHEN.startH + WHEN.hours, WHEN.startM);

  var gcal = document.getElementById('gcal-link');
  if (gcal) {
    gcal.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent(TITLE)
      + '&dates=' + startAt + '/' + endAt
      + '&location=' + encodeURIComponent(WHERE);
  }
  var ics = document.getElementById('ics-link');
  if (ics) {
    ics.addEventListener('click', function (e) {
      e.preventDefault();
      var body = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Inscription//EN',
        'BEGIN:VEVENT',
        'DTSTART:' + startAt, 'DTEND:' + endAt,
        'SUMMARY:' + TITLE, 'LOCATION:' + WHERE,
        'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
      var url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
      var a = document.createElement('a');
      a.href = url; a.download = 'wedding.ics'; /* LUMA: no sample names */
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  /* ---------- THE REPLY ---------- */
  var reply = document.getElementById('reply');
  var form  = document.getElementById('rsvp-form');
  var done  = document.getElementById('rsvp-confirmed');
  var err   = document.getElementById('rsvp-error');
  var cutName = document.getElementById('rsvpCutName');

  document.querySelectorAll('.choice .opt input').forEach(function (input) {
    input.addEventListener('change', function () {
      document.querySelectorAll('.choice .opt').forEach(function (o) {
        o.classList.toggle('selected', o.contains(input) && input.checked);
      });
      var no = input.value === 'no' && input.checked;
      var count = document.getElementById('rsvpGuests');
      if (count) count.closest('.field').hidden = no;
    });
  });

  /* The visible number input is friendly; the hidden select is what
     Netlify receives, so the two must stay in step. */
  var guests = document.getElementById('rsvpGuests');
  var guestSel = document.getElementById('rsvp-guest-count');
  var plusWrap = document.getElementById('rsvp-plusone-wrap');
  if (guests && guestSel) {
    guests.addEventListener('input', function () {
      var n = Math.max(1, Math.min(6, parseInt(guests.value, 10) || 1));
      guestSel.value = String(n);
      if (plusWrap) plusWrap.hidden = n < 2;
    });
    guests.dispatchEvent(new Event('input'));
  }

  /* The guest's own name is cut into the stone, with the same
     incision and the same ochre as the two in the hero. That is the
     whole design applied to the person reading it, which is the
     only reason there is an animation here rather than a message. */
  function cut() {
    if (!reply) return;
    var typed = document.getElementById('rsvpName');
    if (cutName && typed && typed.value.trim()) {
      cutName.textContent = typed.value.trim();
    }
    reply.classList.add('sent');
    if (done) done.hidden = false;
    fitCut();
  }

  function uncut() {
    if (!reply) return;
    reply.classList.remove('sent');
    if (done) done.hidden = true;
    if (form) form.reset();
    var first = document.getElementById('rsvpName');
    if (first) first.focus();
  }

  /* A guest can type a long name, and it is set in wide capitals.
     Same step-down as the hero. */
  function fitCut() {
    if (!cutName) return;
    cutName.style.fontSize = '';
    var avail = cutName.clientWidth;
    if (!avail) return;
    for (var i = 0; i < 8; i++) {
      if (cutName.scrollWidth <= avail) break;
      var now = parseFloat(getComputedStyle(cutName).fontSize);
      cutName.style.fontSize = (now * 0.92).toFixed(2) + 'px';
    }
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (err) err.hidden = true;

      var name = document.getElementById('rsvpName');
      if (name && !name.value.trim()) {
        if (err) {
          err.textContent = 'We need a name to cut, and to match you to the list.';
          err.hidden = false;
        }
        name.focus();
        return;
      }

      /* LUMA: the reply goes to /api/rsvp (luma-bridge.js answers this
         POST to "/"), and the name is cut only once it is saved: a guest
         is never told it was sent when it wasn't. The form is read
         BEFORE its fields are disabled, which drops them. */
      var data = new URLSearchParams(new FormData(form)).toString();
      var controls = form.querySelectorAll('input, textarea, button');
      controls.forEach(function (el) { el.disabled = true; });
      function failed(message) {
        controls.forEach(function (el) { el.disabled = false; });
        if (err) { err.textContent = message || "That didn't send. Please try again."; err.hidden = false; }
      }
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (b) { failed(b && b.error); }, function () { failed(); });
        controls.forEach(function (el) { el.disabled = false; });
        cut();
      }).catch(function () { failed(); });
    });
  }

  var again = document.getElementById('rsvpAgain');
  if (again) again.addEventListener('click', uncut);
  addEventListener('resize', fitCut);

  window.__page = { settle: settleAll, cut: cut, uncut: uncut };

  /* ?page=settled forces every section to its finished state and
     &reply=sent cuts the name, for stills. */
  var params = new URLSearchParams(location.search);
  if (params.get('page') === 'settled' || params.get('reply') === 'sent') {
    var s = document.createElement('style');
    s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(s);
    settleAll();
    document.body.classList.add('lit');
    if (params.get('reply') === 'sent') {
      var t = document.getElementById('rsvpName');
      if (t) t.value = 'A guest';
      cut();
    }

    /* &probe=1 prints an overflow readout into the page. A block that
       runs off one edge is invisible in a screenshot cropped to that
       same width, which is how two overflows shipped on the designs
       before this one. */
    if (params.get('probe')) {
      setTimeout(function () {
        var w = document.body.clientWidth, bad = [];
        document.querySelectorAll('body *').forEach(function (el) {
          var cs = getComputedStyle(el);
          if (cs.position === 'fixed') return;
          for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            var pc = getComputedStyle(p);
            if (pc.overflow !== 'visible' || pc.position === 'fixed') return;
          }
          var r = el.getBoundingClientRect();
          if ((r.left < -1 || r.right > w + 1) && bad.length < 6) {
            bad.push(el.tagName.toLowerCase() + '.' +
              String(el.className || '').split(' ')[0] +
              '[' + Math.round(r.left) + ',' + Math.round(r.right) + ']');
          }
        });
        var pre = document.createElement('pre');
        pre.style.cssText = 'position:fixed;z-index:99;left:0;top:0;margin:0;padding:4px 6px;' +
          'background:#000;color:#0f0;font:11px/1.4 ui-monospace,monospace;' +
          'white-space:pre-wrap;max-width:100%';
        pre.textContent = ['clientW=' + w,
          'bodyScrollW=' + document.body.scrollWidth,
          'overflowing=' + (bad.length ? bad.join(' | ') : 'none')].join('\n');
        document.body.appendChild(pre);
      }, 300);
    }
  }
})();
