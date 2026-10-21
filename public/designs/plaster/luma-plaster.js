/*
 * Plaster on Luma. Loaded after luma-bridge.js.
 *
 * The standalone design had its couple written into the markup. Here their
 * details arrive from Luma (window.lumaBoot); this addresses the envelope,
 * prints the card, writes the notes pinned beside it, builds the order of the
 * day from their schedule, then starts the design's own plaster.js (the
 * opening) and page.js (everything below it).
 */
(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

  function blank(v) { return !v || !String(v).trim(); }
  function txt(v, d) { v = v == null ? '' : String(v).trim(); return v || d || ''; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function byId(id) { return document.getElementById(id); }
  function setText(id, v) { var e = byId(id); if (e) e.textContent = v; }
  /* lines separated by <br>, the way the envelope and the notes are set */
  function setLines(e, lines) {
    if (!e) return;
    e.textContent = '';
    lines.filter(Boolean).forEach(function (l, i) {
      if (i) e.appendChild(el('br'));
      e.appendChild(document.createTextNode(l));
    });
  }

  function clock(t) {
    var m = /^(\d{1,2})[:.h]?(\d{2})?\s*([ap])?/i.exec(txt(t));
    if (!m) return null;
    var h = +m[1], mi = +(m[2] || 0), ap = (m[3] || '').toLowerCase();
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return { h: h, mi: mi };
  }
  /* 17:00 -> "five o'clock", 19:30 -> "half past seven", as the design says hours */
  function timeWords(t) {
    var c = clock(t);
    if (!c) return txt(t);
    var h12 = function (x) { x = x % 12; return ONES[x === 0 ? 12 : x]; };
    if (c.mi === 0) return h12(c.h) + ' o’clock';
    if (c.mi === 15) return 'quarter past ' + h12(c.h);
    if (c.mi === 30) return 'half past ' + h12(c.h);
    if (c.mi === 45) return 'quarter to ' + h12(c.h + 1);
    return txt(t);
  }
  function hhmm(t) {
    var c = clock(t);
    return c ? (c.h < 10 ? '0' : '') + c.h + ':' + (c.mi < 10 ? '0' : '') + c.mi : txt(t);
  }
  function dateParts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    return { y: y, m: mo, d: d, weekday: DAYS[new Date(y, mo - 1, d).getDay()], month: MONTHS[mo - 1] };
  }
  function real(url) { return /^(https:|blob:)/.test(txt(url)); }
  /* the town, for the postmark: the last part of the address that isn't a postcode */
  function town(address, venue) {
    var parts = txt(address).split(',').map(function (p) { return p.replace(/\b\d[\d\s-]*\b/g, '').trim(); }).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : txt(venue);
  }

  function render(d) {
    var one = txt(d.partner1), two = txt(d.partner2);
    var dp = dateParts(d.date);
    var sched = Array.isArray(d.schedule) ? d.schedule.filter(function (s) { return s && !blank(s.title); }) : [];
    var venue = txt(d.venueName), address = txt(d.venueAddress);
    var initials = (one.charAt(0) + two.charAt(0)).toUpperCase();

    document.title = one + ' & ' + two + (dp ? ' · ' + dp.d + ' ' + dp.month + ' ' + dp.y : '');
    var mono = document.querySelector('.index .ix-mono');
    if (mono) mono.textContent = initials;
    document.querySelectorAll('.seal b.initials').forEach(function (b) { b.textContent = initials; });

    // the card
    setText('cardWhen', dp ? dp.weekday + ' ' + dp.d + ' ' + dp.month : '');
    var h1 = byId('cardNames');
    if (h1) {
      h1.textContent = '';
      h1.appendChild(document.createTextNode(one));
      h1.appendChild(el('span', 'amp', '&'));
      h1.appendChild(document.createTextNode(two));
    }
    var place = town(address, '');
    setLines(byId('cardWhere'), venue ? [venue, place !== venue ? place : ''] : [address]);
    setText('cardYear', dp ? String(dp.y) : '');

    // the envelope, addressed from the two of them
    setLines(byId('envFrom'), [one + ' & ' + two, venue, place !== venue ? place : '']);
    setText('frankDay', dp ? String(dp.d) : '');
    setText('frankMonth', dp ? ROMAN[dp.m - 1] + ' · ' + String(dp.y).slice(2) : '');

    // the notes pinned beside it on a wide screen: the hours, and what to know
    setLines(byId('noteL'), sched.slice(0, 3).map(function (s) { return txt(s.title) + ' at ' + timeWords(s.time); }));
    setLines(byId('noteR'), [txt(d.dressCode), txt(d.dressCodeNote), blank(d.rsvpDeadline) ? '' : 'Reply by ' + txt(d.rsvpDeadline)]);

    // how it started: their photograph as a print on the wall, or the leaf alone
    var story = byId('beginning');
    var img = document.querySelector('#beginning img.couple');
    if (real(d.heroPhoto) && img) { img.src = d.heroPhoto; img.hidden = false; }
    else if (story) story.classList.add('nophoto');
    var head = byId('storyHeadline');
    if (head) { head.textContent = txt(d.storyHeadline); head.hidden = blank(d.storyHeadline); }
    setText('storyP1', txt(d.story1));
    if (story && blank(d.story1) && blank(d.storyHeadline) && !real(d.heroPhoto)) story.classList.add('luma-empty');

    // two sheets
    setText('whoOne', one);
    setText('whoTwo', two);
    setText('storyP2', txt(d.story2));
    var p2 = byId('storyP2'); if (p2) p2.hidden = blank(d.story2);

    // the day
    var big = byId('bigDate');
    if (big && dp) {
      big.textContent = dp.d + ' ' + dp.month + ' ';
      big.appendChild(el('span', null, String(dp.y)));
    }
    setText('markPlace', town(address, venue).toUpperCase());
    setText('markWhen', dp ? dp.weekday + (clock(d.time) ? ' · ' + hhmm(d.time) : '') : hhmm(d.time));
    var facts = document.querySelector('#the-day .facts');
    if (facts) {
      facts.textContent = '';
      [['Where', venue], ['Address', address],
       ['Dress', [txt(d.dressCode), txt(d.dressCodeNote)].filter(Boolean).join('. ')],
       ['Reply by', txt(d.rsvpDeadline)]].forEach(function (f) {
        if (!f[1]) return;
        var div = el('div');
        div.appendChild(el('span', null, f[0]));
        div.appendChild(el('b', null, f[1]));
        facts.appendChild(div);
      });
    }
    var vl = byId('venueLink');
    if (vl) {
      var q = [venue, address].filter(Boolean).join(', ');
      if (q) vl.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
      else vl.hidden = true;
    }

    // the order of the day, each hour pressed with a drop of the seal's wax
    var rail = byId('tlItems');
    if (rail) {
      var thread = rail.querySelector('.thread');
      rail.textContent = '';
      if (thread) rail.appendChild(thread);
      sched.forEach(function (s) {
        var stop = el('div', 'stop');
        var drop = el('span', 'drop'); drop.setAttribute('aria-hidden', 'true');
        stop.appendChild(drop);
        stop.appendChild(el('p', 'at', hhmm(s.time)));
        stop.appendChild(el('h3', null, txt(s.title)));
        if (!blank(s.venue)) stop.appendChild(el('p', 'note', txt(s.venue)));
        rail.appendChild(stop);
      });
    }
    var first = sched.length ? timeWords(sched[0].time) : '';
    setText('scheduleHeading', txt(d.scheduleHeading, first ? (dp ? dp.weekday + ', from ' : 'From ') + first : 'The order of the day'));
    if (!sched.length) { var ss = byId('schedule'); if (ss) ss.classList.add('luma-empty'); }

    // photographs: prints laid on the wall
    setText('galleryHeading', txt(d.galleryHeading, 'Before any of this was arranged'));
    var grid = document.querySelector('#gallery .gallery-grid');
    var gallery = Array.isArray(d.gallery) ? d.gallery.filter(function (g) { return g && real(g.photo); }) : [];
    if (grid) {
      grid.textContent = '';
      gallery.forEach(function (g) {
        var fig = el('figure');
        var im = el('img'); im.src = g.photo; im.alt = txt(g.caption, 'A photograph of the two of you'); im.loading = 'lazy';
        fig.appendChild(im);
        grid.appendChild(fig);
      });
    }
    if (!gallery.length) { var gs = byId('gallery'); if (gs) gs.classList.add('luma-empty'); }

    // worth asking: the couple's questions
    var asks = byId('faq-drawer-list');
    var faq = Array.isArray(d.faq) ? d.faq.filter(function (f) { return f && !blank(f.question); }) : [];
    if (asks) {
      asks.textContent = '';
      faq.forEach(function (f) {
        var det = el('details');
        det.appendChild(el('summary', null, txt(f.question)));
        det.appendChild(el('p', null, txt(f.answer)));
        asks.appendChild(det);
      });
    }
    if (!faq.length) { var fs = byId('faq'); if (fs) fs.classList.add('luma-empty'); }

    // the reply goes back in an envelope addressed to them
    setLines(byId('retFrom'), [one + ' & ' + two, venue]);
    setText('sentTo', 'It is on its way to ' + one + ' and ' + two + '.');
    setText('footNames', one + ' and ' + two + (dp ? ', ' + dp.y : ''));

    // the calendar links in page.js read this
    var start = clock(d.time) || { h: 17, mi: 0 };
    window.__lumaPlaster = {
      when: dp ? { y: dp.y, m: dp.m, d: dp.d, startH: start.h, startM: start.mi, hours: 9 } : null,
      title: one + ' & ' + two + ', wedding',
      where: [venue, address].filter(Boolean).join(', ')
    };
  }

  function start(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = resolve;
      document.body.appendChild(s);
    });
  }

  window.lumaBoot.then(function (d) {
    if (!d) return;
    function go() {
      render(d);
      if (typeof window.lumaAfterRender === 'function') window.lumaAfterRender(d);
      start('plaster.js?v=5').then(function () { return start('page.js?v=9'); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  });
})();
