/* ============================================================
   THE CROSSING — everything below the hero
   ------------------------------------------------------------
   Plates arriving, the track drawing across each photograph, the
   index appearing once the folded chart has gone past, the
   calendar links, and the guest being surveyed onto the chart
   when they reply.

   Rule followed throughout, learned the hard way on the designs
   before this one: anything that hides content until a script
   runs gets a plain-timer failsafe. IntersectionObserver is
   throttled in background tabs and absent in some headless
   contexts, and an invitation that ships blank is worse than one
   that ships without its animation.
   ============================================================ */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Read up here because the frozen-state hooks below have to switch
     off the observers: the hero observer fires after a forced state
     is applied and would undo it, which once made the index
     impossible to photograph at all. Dev only. */
  var params = new URLSearchParams(location.search);
  var frozen = params.get('page') === 'settled' || params.get('reply') === 'sent';

  /* ---------- ARRIVAL ----------
     Each plate, band and column arrives on its own. The photographs
     settle out of a 6-7% scale at the same time, which is the only
     motion on the page that is doing real work: it is the picture
     coming to rest, not a box sliding in. */
  var watched = [].slice.call(document.querySelectorAll('[data-reveal]'));
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
    }, { rootMargin: '0px 0px -14% 0px', threshold: 0.08 });
    watched.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      if (!document.querySelector('[data-reveal].in')) settleAll();
    }, 4200);
  }


  /* ---------- THE INDEX ----------
     Held off the screen until the folded chart has gone past. The
     hero is the whole first screen and the point of the design; a
     bar sitting on top of it from the start would be the one thing
     in front of the sheet. */
  var hero = document.getElementById('hero');
  function past(on) { document.body.classList.toggle('past-hero', on); }

  if (frozen) {
    past(true);
  } else if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      past(!entries[0].isIntersecting);
    }, { rootMargin: '-64px 0px 0px 0px', threshold: 0 }).observe(hero);
  } else {
    /* Failsafe: the index must be reachable even with no observer. */
    var onScroll = function () { past(scrollY > innerHeight * 0.72); };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

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
  /* LUMA: the couple's day, set by luma-map.js from their wedding */
  var L = window.__lumaMap || {};
  var WHEN = L.when || { y: 2027, m: 1, d: 1, startH: 15, startM: 0, hours: 10 };
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
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Crossing//EN',
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
  var placeName = document.getElementById('rsvpPlaceName');

  document.querySelectorAll('.choice .opt input').forEach(function (input) {
    input.addEventListener('change', function () {
      document.querySelectorAll('.choice .opt').forEach(function (o) {
        o.classList.toggle('selected', o.contains(input) && input.checked);
      });
      /* Nobody who is not coming needs to say how many of them are
         not coming. */
      var countField = document.getElementById('rsvpCountField');
      if (countField) countField.hidden = input.value === 'no' && input.checked;
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

  /* The name is plotted character by character, the way the hero's
     own names are struck. Split into WORDS first and each word kept
     unbreakable: wrapping bare characters in inline-block lets a
     line break between any two letters, which on the hero turned
     "TWENTY SEVEN" into "TWE / NTY SEVEN".

     Done in script because the guest types their own name and must
     never hand-wrap letters. */
  function plotName(text) {
    if (!placeName) return;
    var frag = document.createDocumentFragment();
    var i = 0;
    text.split(/(\s+)/).forEach(function (part) {
      if (part === '') return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); i++; return; }
      var word = document.createElement('span');
      word.className = 'wd';
      part.split('').forEach(function (chr) {
        var s = document.createElement('span');
        s.className = 'gl';
        s.style.setProperty('--i', i++);
        s.textContent = chr;
        word.appendChild(s);
      });
      frag.appendChild(word);
    });
    placeName.textContent = '';
    placeName.appendChild(frag);
  }

  function survey() {
    if (!reply) return;
    var typed = document.getElementById('rsvpName');
    if (placeName && typed && typed.value.trim()) plotName(typed.value.trim());
    reply.classList.add('sent');
    if (done) done.hidden = false;
    fitPlace();
  }

  function unsurvey() {
    if (!reply) return;
    reply.classList.remove('sent');
    if (done) done.hidden = true;
    if (form) form.reset();
    /* reset() fires neither input nor change, so the two synced
       controls and the chosen option go back by hand. */
    document.querySelectorAll('.choice .opt').forEach(function (o, i) {
      o.classList.toggle('selected', i === 0);
    });
    var countField = document.getElementById('rsvpCountField');
    if (countField) countField.hidden = false;
    if (guests) guests.dispatchEvent(new Event('input'));
    var first = document.getElementById('rsvpName');
    if (first) first.focus();
  }

  /* A place name is set in wide capitals, so a long one runs out of
     measure fast. Same step-down as the names in the hero. */
  function fitPlace() {
    if (!placeName) return;
    placeName.style.fontSize = '';
    var avail = placeName.clientWidth;
    if (!avail) return;
    for (var i = 0; i < 8; i++) {
      if (placeName.scrollWidth <= avail) break;
      var now = parseFloat(getComputedStyle(placeName).fontSize);
      placeName.style.fontSize = (now * 0.92).toFixed(2) + 'px';
    }
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (err) err.hidden = true;

      var name = document.getElementById('rsvpName');
      if (name && !name.value.trim()) {
        if (err) {
          err.textContent = 'We need a name to put on the sheet, and to match you to the list.';
          err.hidden = false;
        }
        name.focus();
        return;
      }

      /* LUMA: the reply goes to /api/rsvp (luma-bridge.js answers this
         POST to "/"), and the name goes on the sheet only once it is
         saved: a guest is never told it was sent when it wasn't. The
         form is read BEFORE its fields are disabled, which drops them. */
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
        survey();
      }).catch(function () { failed(); });
    });
  }

  var again = document.getElementById('rsvpAgain');
  if (again) again.addEventListener('click', unsurvey);
  addEventListener('resize', fitPlace);

  window.__page = { settle: settleAll, survey: survey, unsurvey: unsurvey };

  /* ?page=settled forces every section to its finished state and
     &reply=sent surveys a name, for stills. */
  if (frozen) {
    var s = document.createElement('style');
    s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(s);
    settleAll();
    past(true);
    /* The blanket rule above stops the dash transition too, so the
       tracks are set directly. &track=0.4 holds every one of them
       40% undrawn instead, which is the only way to photograph the
       middle of the draw — and whether the track actually advances
       is a question only the middle answers. Dev only. */
    var frac = parseFloat(params.get('track'));
    if (!(frac >= 0 && frac <= 1)) frac = 0;
    document.querySelectorAll('.stop .track').forEach(function (t) {
      t.style.clipPath = 'inset(0 ' + (frac * 100).toFixed(0) + '% 0 0)';
    });

    if (params.get('reply') === 'sent') {
      var t = document.getElementById('rsvpName');
      if (t) t.value = 'A guest';
      survey();

      /* &plot=380 holds every glyph at however far through its own
         plot it would be 380ms in, which is the only way to
         photograph the middle of the sequence. Dev only. */
      var at = params.get('plot');
      if (at !== null) {
        var T = parseFloat(at) || 0;
        var fz = document.createElement('style');
        fz.textContent =
          '.surveyed .name .gl{' +
          'animation:plot 460ms cubic-bezier(.2,.78,.3,1) both!important;' +
          'animation-delay:calc(var(--i,0) * 34ms - ' + T + 'ms)!important;' +
          'animation-play-state:paused!important}';
        document.head.appendChild(fz);
      }
    }

    /* &probe=1 prints measurements INTO the page. A block that runs
       off one edge is invisible in a screenshot cropped to that same
       width, which is how two overflows shipped on earlier designs.
       The walk stops AT body, because the page sets
       body{overflow-x:hidden} and a walk that includes it finds a
       clipping ancestor for every element and reports nothing. */
    if (params.get('probe')) {
      setTimeout(function () {
        var w = document.body.clientWidth, bad = [];
        function deliberate(el) {
          return el.closest('.hp') || el.classList.contains('visually-hidden') ||
                 el.id === 'hint';
        }
        document.querySelectorAll('body *').forEach(function (el) {
          if (getComputedStyle(el).position === 'fixed') return;
          if (deliberate(el)) return;
          for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            var o = getComputedStyle(p).overflowX;
            if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return;
          }
          var r = el.getBoundingClientRect();
          if (r.width === 0) return;
          if ((r.left < -1 || r.right > w + 1) && bad.length < 6) {
            bad.push(el.tagName.toLowerCase() + '.' +
              String(el.className || '').split(' ')[0] +
              '[' + Math.round(r.left) + ',' + Math.round(r.right) + ']');
          }
        });
        var small = [];
        document.querySelectorAll('a,button,summary,input,textarea,label.opt')
          .forEach(function (el) {
            if (deliberate(el) || el.tabIndex === -1) return;
            var r = el.getBoundingClientRect();
            if (!r.width && !r.height) return;
            if (r.height < 44) {
              small.push(String(el.className || el.tagName).split(' ')[0] +
                         '@' + Math.round(r.height));
            }
          });
        /* the index's list scrolls, so a label falling off the end is
           silent — and the label that falls off is Reply. Measured
           against the bar's inner edge, because the list's own
           scrollWidth says "fits" whenever it got the space it asked
           for, even while the last label paints past the bar. */
        var nul = document.querySelector('.index ul'), navFit = 'no index';
        if (nul) {
          var bar = document.querySelector('.index');
          var barR = bar.getBoundingClientRect().right -
                     parseFloat(getComputedStyle(bar).paddingRight);
          var links = nul.querySelectorAll('a');
          var lastR = links.length
            ? links[links.length - 1].getBoundingClientRect().right : 0;
          navFit = (lastR <= barR + 0.5)
            ? 'fits (' + Math.round(barR - lastR) + 'px spare)'
            : 'CLIPPED by ' + Math.round(lastR - barR) + 'px';
        }
        var pre = document.createElement('pre');
        pre.style.cssText = 'position:fixed;z-index:99;left:0;top:0;margin:0;padding:4px 6px;' +
          'background:#000;color:#0f0;font:10px/1.4 ui-monospace,monospace;' +
          'white-space:pre-wrap;max-width:100%';
        pre.textContent = [
          'clientW=' + w + ' bodyScrollW=' + document.body.scrollWidth,
          'index: ' + navFit,
          'over: ' + (bad.length ? bad.join(' | ') : 'none'),
          'under44: ' + (small.length ? small.join(' ') : 'none'),
          'h1=' + document.querySelectorAll('h1').length +
            ' revealed=' + document.querySelectorAll('[data-reveal].in').length +
            '/' + watched.length +
            ' plates=' + document.querySelectorAll('.stop .plate img').length
        ].join('\n');
        document.body.appendChild(pre);
      }, 400);
    }
  }
})();
