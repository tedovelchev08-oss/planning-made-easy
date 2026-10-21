/*
 * The Tide on Luma. Loaded after luma-bridge.js.
 *
 * The couple's details arrive from Luma (window.lumaBoot). This prints the
 * card lying on the sand, writes the day out, sets the order of the day as a
 * tide table, then starts page.js, which brings the wave in.
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
  /* 17:00 -> "five o'clock", 19:30 -> "half past seven" */
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
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
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

  /* The tide table: the water rises through the day and each moment is
     marked on it where its hour falls. Drawn in the curve's own units
     (600 x 120), stretched to the width it is given. */
  function drawCurve(svg, sched) {
    if (!svg) return;
    var NS = 'http://www.w3.org/2000/svg';
    var mins = sched.map(function (s) { var c = clock(s.time); return c ? c.h * 60 + c.mi : null; });
    var known = mins.filter(function (m) { return m != null; });
    var lo = known.length ? Math.min.apply(null, known) : 0, hi = known.length ? Math.max.apply(null, known) : 1;
    if (hi - lo < 60) { lo -= 30; hi += 30; }
    var pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    function x(m, i) { return m == null ? 30 + i * (540 / Math.max(1, sched.length - 1)) : 600 * (m - lo) / (hi - lo); }
    // a long swell rising toward the evening, with a little chop on it
    function y(px) { return 100 - 70 * (0.5 - 0.5 * Math.cos(Math.PI * px / 600)) - 5 * Math.sin(px / 23); }
    var d = 'M0 ' + y(0).toFixed(1);
    for (var px = 6; px <= 600; px += 6) d += ' L' + px + ' ' + y(px).toFixed(1);
    svg.textContent = '';
    var defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc9c6" stop-opacity=".55"/><stop offset="1" stop-color="#2f97a8" stop-opacity=".12"/></linearGradient>';
    svg.appendChild(defs);
    var water = document.createElementNS(NS, 'path');
    water.setAttribute('class', 'water'); water.setAttribute('d', d + ' L600 120 L0 120 Z');
    svg.appendChild(water);
    var edge = document.createElementNS(NS, 'path');
    edge.setAttribute('class', 'edge'); edge.setAttribute('d', d);
    svg.appendChild(edge);
    sched.forEach(function (s, i) {
      var cx = Math.max(8, Math.min(592, x(mins[i], i)));
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'mark'); c.setAttribute('cx', cx.toFixed(1)); c.setAttribute('cy', y(cx).toFixed(1)); c.setAttribute('r', '5');
      svg.appendChild(c);
    });
  }

  function render(d) {
    var one = txt(d.partner1), two = txt(d.partner2);
    var dp = dateParts(d.date);
    var sched = Array.isArray(d.schedule) ? d.schedule.filter(function (s) { return s && !blank(s.title); }) : [];
    var venue = txt(d.venueName), address = txt(d.venueAddress);
    var place = town(address, '');

    document.title = one + ' & ' + two + (dp ? ' · ' + dp.d + ' ' + dp.month + ' ' + dp.y : '');

    // the card on the sand
    setText('cardAbove', txt(d.cardAbove, 'Together with their families'));
    var h1 = byId('cardNames');
    if (h1) {
      h1.textContent = '';
      h1.appendChild(document.createTextNode(one));
      h1.appendChild(el('em', null, 'and'));
      h1.appendChild(document.createTextNode(two));
    }
    setText('cardDate', dp ? dp.d + ' ' + dp.month + ' ' + dp.y : '');
    setLines(byId('cardPlace'), venue ? [venue, place !== venue ? place : ''] : [address]);
    setText('cardLine', txt(d.cardLine));

    // how it started
    var story = byId('beginning');
    var img = document.querySelector('#beginning img.couple');
    if (real(d.heroPhoto) && img) { img.src = d.heroPhoto; img.hidden = false; }
    else if (story) story.classList.add('nophoto');
    setText('storyHeadline', txt(d.storyHeadline));
    setText('storyP1', txt(d.story1));
    setText('storyP2', txt(d.story2));
    if (story && blank(d.story1) && blank(d.story2) && blank(d.storyHeadline) && !real(d.heroPhoto)) story.classList.add('luma-empty');

    // the day
    setText('dayTitle', dp ? dp.weekday + ', ' + dp.d + ' ' + dp.month : '');
    var facts = document.querySelector('#the-day .facts');
    if (facts) {
      facts.textContent = '';
      [['Where', venue], ['Address', address], ['Time', clock(d.time) ? cap(timeWords(d.time)) : txt(d.time)],
       ['Dress', [txt(d.dressCode), txt(d.dressCodeNote)].filter(Boolean).join('. ')],
       ['Reply by', txt(d.rsvpDeadline)]].forEach(function (f) {
        if (!f[1]) return;
        var div = el('div');
        div.appendChild(el('dt', null, f[0]));
        div.appendChild(el('dd', null, f[1]));
        facts.appendChild(div);
      });
    }
    var vl = byId('venueLink');
    if (vl) {
      var q = [venue, address].filter(Boolean).join(', ');
      if (q) vl.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
      else vl.hidden = true;
    }

    // the tide table
    var list = byId('tlItems');
    if (list) {
      list.textContent = '';
      sched.forEach(function (s, i) {
        var li = el('li');
        li.appendChild(el('span', 'n', String(i + 1)));
        li.appendChild(el('span', 'at', hhmm(s.time)));
        li.appendChild(el('h3', null, txt(s.title)));
        if (!blank(s.venue)) li.appendChild(el('p', 'where', txt(s.venue)));
        list.appendChild(li);
      });
    }
    drawCurve(byId('tideCurve'), sched);
    var first = sched.length ? timeWords(sched[0].time) : '';
    setText('scheduleHeading', txt(d.scheduleHeading, first ? 'From ' + first + ', as the tide comes in' : 'As the tide comes in'));
    if (!sched.length) { var ss = byId('schedule'); if (ss) ss.classList.add('luma-empty'); }

    // photographs
    setText('galleryHeading', txt(d.galleryHeading, 'A few of ours'));
    var prints = document.querySelector('#gallery .prints');
    var gallery = Array.isArray(d.gallery) ? d.gallery.filter(function (g) { return g && real(g.photo); }) : [];
    if (prints) {
      prints.textContent = '';
      gallery.forEach(function (g) {
        var fig = el('figure');
        var im = el('img'); im.src = g.photo; im.alt = txt(g.caption, 'A photograph of the two of you'); im.loading = 'lazy';
        fig.appendChild(im);
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

    // the reply
    setText('replyBy', blank(d.rsvpDeadline) ? '' : 'Please reply by ' + txt(d.rsvpDeadline));
    setText('sentTo', 'It is on its way to ' + one + ' and ' + two + '.');
    // and the close: their names in the sand
    setText('writtenNames', one + ' & ' + two);
    setText('closingLine', txt(d.closingLine, 'We can\u2019t wait to celebrate with you'));
    setText('footNames', one + ' and ' + two + (dp ? ', ' + dp.y : ''));

    // the calendar links in page.js read this
    var start = clock(d.time) || { h: 17, mi: 0 };
    window.__lumaTide = {
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
      start('page.js?v=2');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  });
})();
