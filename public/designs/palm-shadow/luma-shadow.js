/*
 * Palm Shadow on Luma. Loaded after luma-bridge.js.
 *
 * The couple's details arrive from Luma (window.lumaBoot). This writes their
 * names in the light on the wall, prints the day on the cotton card, sets out
 * the evening and the reply, then starts page.js, which lets the shadow of
 * the palm drift across the page.
 */
(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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

  function clock(t) {
    var m = /^(\d{1,2})[:.h]?(\d{2})?\s*([ap])?/i.exec(txt(t));
    if (!m) return null;
    var h = +m[1], mi = +(m[2] || 0), ap = (m[3] || '').toLowerCase();
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return { h: h, mi: mi };
  }
  /* 16:00 -> "four o'clock", 19:30 -> "half past seven" */
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
  function town(address, venue) {
    var parts = txt(address).split(',').map(function (p) { return p.replace(/\b\d[\d\s-]*\b/g, '').trim(); }).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : txt(venue);
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function ordinal(n) {
    var W = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
      'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth',
      'twentieth', 'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth',
      'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'];
    return W[n] || String(n);
  }

  function render(d) {
    var one = txt(d.partner1), two = txt(d.partner2);
    var dp = dateParts(d.date);
    var sched = Array.isArray(d.schedule) ? d.schedule.filter(function (s) { return s && !blank(s.title); }) : [];
    var venue = txt(d.venueName), address = txt(d.venueAddress);
    var place = town(address, venue);

    document.title = one + ' & ' + two + (dp ? ' · ' + dp.d + ' ' + dp.month + ' ' + dp.y : '');

    // their names, in the light on the wall
    setText('cardAbove', txt(d.cardAbove, 'Together with their families'));
    var h1 = byId('cardNames');
    if (h1) {
      h1.textContent = '';
      h1.appendChild(el('span', 'n', one));
      h1.appendChild(el('span', 'amp', '&'));
      h1.appendChild(el('span', 'n', two));
    }
    setText('cardDate', dp ? dp.weekday + ', the ' + ordinal(dp.d) + ' of ' + dp.month : '');
    setText('cardPlace', [venue, place !== venue ? place : ''].filter(Boolean).join(' \u00b7 '));

    // the day, on the cotton card
    setText('dayTime', clock(d.time) ? cap(timeWords(d.time)) : txt(d.time));
    setText('dayVenue', venue);
    setText('dayAddr', address);
    setText('dayDress', [txt(d.dressCode), txt(d.dressCodeNote)].filter(Boolean).join(' \u00b7 '));
    var vl = byId('venueLink');
    if (vl) {
      var q = [venue, address].filter(Boolean).join(', ');
      if (q) vl.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
      else vl.hidden = true;
    }

    // how it started
    var story = byId('story');
    var img = document.querySelector('#story img.couple');
    if (real(d.heroPhoto) && img) { img.src = d.heroPhoto; img.hidden = false; }
    else if (story) story.classList.add('nophoto');
    setText('storyHeadline', txt(d.storyHeadline));
    setText('storyP1', txt(d.story1));
    setText('storyP2', txt(d.story2));
    if (story && blank(d.story1) && blank(d.story2) && blank(d.storyHeadline) && !real(d.heroPhoto)) story.classList.add('luma-empty');

    // the evening
    setText('scheduleHeading', txt(d.scheduleHeading, 'The order of the day'));
    var list = byId('tlItems');
    if (list) {
      list.textContent = '';
      sched.forEach(function (s) {
        var li = el('li');
        li.appendChild(el('span', 'at', hhmm(s.time)));
        var what = el('span', 'what');
        what.appendChild(el('span', 'title', txt(s.title)));
        if (!blank(s.venue)) what.appendChild(el('span', 'where', txt(s.venue)));
        li.appendChild(what);
        list.appendChild(li);
      });
    }
    if (!sched.length) { var ss = byId('schedule'); if (ss) ss.classList.add('luma-empty'); }

    // photographs
    setText('galleryHeading', txt(d.galleryHeading, 'A few of ours'));
    var prints = document.querySelector('#gallery .prints');
    var gallery = Array.isArray(d.gallery) ? d.gallery.filter(function (g) { return g && real(g.photo); }) : [];
    if (prints) {
      prints.textContent = '';
      gallery.forEach(function (g) {
        var fig = el('figure', 'rv');
        var im = el('img'); im.src = g.photo; im.alt = txt(g.caption, 'A photograph of the two of you'); im.loading = 'lazy';
        fig.appendChild(im);
        if (!blank(g.caption)) fig.appendChild(el('figcaption', null, txt(g.caption)));
        prints.appendChild(fig);
      });
    }
    if (!gallery.length) { var gs = byId('gallery'); if (gs) gs.classList.add('luma-empty'); }

    // questions
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

    // the reply and the close
    setText('replyBy', blank(d.rsvpDeadline) ? '' : 'Kindly reply by ' + txt(d.rsvpDeadline));
    setText('sentTo', 'Your reply is on its way to ' + one + ' and ' + two + '.');
    setText('writtenNames', one + ' & ' + two);
    setText('closingLine', txt(d.closingLine));
    setText('footNames', one + ' and ' + two + (dp ? ', ' + dp.y : ''));

    // the calendar links in page.js read this
    var start = clock(d.time) || { h: 16, mi: 0 };
    window.__lumaShadow = {
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
      start('page.js?v=1');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  });
})();
