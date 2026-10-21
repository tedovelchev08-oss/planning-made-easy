/* ============================================================
   THE LIGHT TEST — everything below the envelope
   ------------------------------------------------------------
   Reveals, the timeline, and the reply card going back into its
   envelope. Separate from plaster.js because that file owns one
   thing — the opening — and this owns the rest of the page.

   Rule followed throughout: anything that hides content until a
   script runs gets a plain-timer failsafe. rAF and
   IntersectionObserver are both throttled in background tabs and
   absent in some headless contexts, and an invitation that ships
   blank is worse than one that ships without its animation.
   ============================================================ */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ARRIVAL ----------
     One observer for every revealed thing. The classes it adds are
     the only difference between the hidden and settled states, so
     forcing them all on is always a valid finished page. */
  var reveals = [].slice.call(document.querySelectorAll('[data-reveal]'));
  var meet    = document.querySelector('.meet');
  var rail    = document.querySelector('.rail');
  var extras  = [meet, rail].filter(Boolean);

  function settleAll() {
    reveals.forEach(function (el) { el.classList.add('in'); });
    extras.forEach(function (el) { el.classList.add('in'); });
  }

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

    reveals.concat(extras).forEach(function (el) { io.observe(el); });

    /* Never a blank page: if nothing has settled a few seconds in,
       the observer is not doing its job and the content matters
       more than the entrance. */
    setTimeout(function () {
      if (!document.querySelector('[data-reveal].in')) settleAll();
    }, 4200);
  }

  /* ---------- THE INDEX ----------
     Smooth scroll that respects the motion preference, and the
     current section marked as you pass it. */
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

  /* ---------- THE DAY: CALENDAR LINKS ----------
     Built from one date so the two links can never disagree, and so
     changing the date in the editor changes both. */
  /* LUMA: the couple's day, set by luma-plaster.js from their wedding */
  var L = window.__lumaPlaster || {};
  var WHEN = L.when || { y: 2027, m: 1, d: 1, startH: 17, startM: 0, hours: 9 };
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
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Light Test//EN',
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

  /* ---------- THE REPLY CARD ---------- */
  var reply = document.getElementById('reply');
  var form  = document.getElementById('rsvp-form');
  var done  = document.getElementById('rsvp-confirmed');
  var err   = document.getElementById('rsvp-error');

  /* the two choice buttons, which have to look chosen */
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

  /* The visible number input is friendly; the hidden <select> is what
     Netlify actually receives, so the two must stay in step. */
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

  /* On send the card slides into the envelope, the flap folds over
     it and a seal is pressed. The invitation's own opening, run
     backwards — which is the only reason this animation is here
     rather than a spinner. */
  function seal() {
    if (!reply) return;
    reply.classList.add('sending');
    setTimeout(function () {
      reply.classList.add('sent');
      if (done) done.hidden = false;
    }, reduce ? 0 : 620);
  }

  function unseal() {
    if (!reply) return;
    reply.classList.remove('sending', 'sent');
    if (done) done.hidden = true;
    if (form) form.reset();
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

      /* LUMA: the reply goes to /api/rsvp (luma-bridge.js answers this
         POST to "/"), and the card is sealed only once it is saved: a
         guest is never told it was sent when it wasn't. The form is read
         BEFORE its fields are disabled, which drops them. */
      var data = new URLSearchParams(new FormData(form)).toString();
      var controls = form.querySelectorAll('input, textarea, select, button');
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
        seal();
      }).catch(function () { failed(); });
    });
  }

  var again = document.getElementById('rsvpAgain');
  if (again) again.addEventListener('click', unseal);

  /* hooks, so a still can be taken of any of it */
  window.__page = {
    settle: settleAll,
    seal: seal,
    unseal: unseal
  };

  /* ?reply=sent freezes the reply in its sealed state, so the
     confirmation can be photographed without waiting for it. */
  if (new URLSearchParams(location.search).get('reply') === 'sent') {
    var rs = document.createElement('style');
    rs.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(rs);
    settleAll();
    document.body.classList.add('went');
    if (reply) reply.classList.add('sending', 'sent');
    if (done) done.hidden = false;
  }

  /* ?page=settled forces every section to its finished state, for
     stills. Same reason plaster.js has ?beat. */
  if (new URLSearchParams(location.search).get('page') === 'settled') {
    var s = document.createElement('style');
    s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(s);
    settleAll();
    document.body.classList.add("went");

    /* &probe=1 prints an overflow readout into the page. A block that
       runs off one edge is invisible in a screenshot cropped to that
       same width, and moving things off the centre line is exactly
       the change that can cause it. */
    if (new URLSearchParams(location.search).get("probe")) {
      setTimeout(function () {
        var w = document.body.clientWidth, bad = [];
        /* every element, not a hand-written list: the first version of
           this check named the blocks I suspected and reported "none"
           while the body was 83px wider than the viewport. */
        document.querySelectorAll("body *")
          .forEach(function (el) {
            /* position:fixed resolves against the real viewport, which
               the simulator cannot change, so a fixed layer always
               reports as overflowing a simulated phone. Skip them, and
               skip anything inside a clipping ancestor, or the readout
               is nothing but false positives. */
            var cs = getComputedStyle(el);
            if (cs.position === "fixed") return;
            for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              var pc = getComputedStyle(p);
              if (pc.overflow !== "visible" || pc.position === "fixed") return;
            }
            var r = el.getBoundingClientRect();
            if (r.left < -1 || r.right > w + 1) {
              if (bad.length < 6) {
                bad.push(el.tagName.toLowerCase() + "." +
                  String(el.className || "").split(" ")[0] +
                  "[" + Math.round(r.left) + "," + Math.round(r.right) + "]" +
                  ' "' + (el.textContent || "").trim().slice(0, 22) + '"');
              }
            }
          });
        var pre = document.createElement("pre");
        pre.style.cssText = "position:fixed;z-index:99;left:0;top:0;margin:0;padding:4px 6px;" +
          "background:#000;color:#0f0;font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;max-width:100%";
        pre.textContent = ["clientW=" + w, "bodyScrollW=" + document.body.scrollWidth,
          "overflowing=" + (bad.length ? bad.join(" | ") : "none")].join("\n");
        document.body.appendChild(pre);
      }, 300);
    }
  }
})();
