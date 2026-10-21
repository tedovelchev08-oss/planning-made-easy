/*
 * Map on Luma. Loaded after luma-bridge.js.
 *
 * The standalone design had its couple written into the markup. Here the
 * couple's details arrive from Luma (window.lumaBoot); this fills every slot
 * (the title block is printed on all three panels of the folded sheet, so
 * all three copies are filled alike), builds the passage from their
 * schedule, then starts the design's own map.js and page.js, which measure
 * what was written.
 *
 * Each moment of the day is a piece of the chart, drawn here in the hero's
 * own colours and lettering, unless the couple gave it a photograph.
 */
(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'];
  var SVG = 'http://www.w3.org/2000/svg';

  function blank(v) { return !v || !String(v).trim(); }
  function txt(v, d) { v = v == null ? '' : String(v).trim(); return v || d || ''; }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function setText(sel, v) { all(sel).forEach(function (e) { e.textContent = v; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function dateParts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    return { y: y, m: mo, d: d, weekday: DAYS[new Date(y, mo - 1, d).getDay()], month: MONTHS[mo - 1] };
  }
  function clock(t) {
    var m = /^(\d{1,2})[:.h]?(\d{2})?\s*([ap])?/i.exec(txt(t));
    if (!m) return { h: 15, mi: 0 };
    var h = +m[1], mi = +(m[2] || 0), ap = (m[3] || '').toLowerCase();
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return { h: h, mi: mi };
  }

  /* ---------- a piece of the chart ----------
     Same water, shoal, contour, land and sounding classes as the hero's
     sheet (map.css .art), so the excerpts read as cut from it. Seeded, so
     a moment always gets the same piece; alternate moments put the land
     on alternate sides, as the plates alternate. */
  function rng(seed) {
    var s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }
  function chartExcerpt(seed, w, h, flip) {
    var r = rng(seed * 7919 + 17);
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'art excerpt');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    function add(tag, attrs, text) {
      var n = document.createElementNS(SVG, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text != null) n.textContent = text;
      svg.appendChild(n);
      return n;
    }
    function P(x, y) { return flip ? [w - x, h - y] : [x, y]; }

    add('rect', { 'class': 'water', x: 0, y: 0, width: w, height: h });

    // the coast: land in one corner, its edge wandering across
    var reach = w * (0.42 + r() * 0.2), depthAt0 = h * (0.34 + r() * 0.18);
    var pts = [];
    for (var i = 0; i <= 36; i++) {
      var t = i / 36, x = reach * t;
      var y = depthAt0 * (1 - t) * (1 - t * 0.15) + Math.sin(t * 9 + r() * 0.6) * h * 0.018 + (r() - 0.5) * h * 0.012;
      pts.push([x, Math.max(0, y)]);
    }
    function line(off) {
      return pts.map(function (p, i) {
        var q = P(p[0] + off * 0.55, p[1] + off);
        return (i ? 'L ' : 'M ') + q[0].toFixed(2) + ' ' + q[1].toFixed(2);
      }).join(' ');
    }
    var corner = P(0, 0), edgeStart = P(0, pts[0][1]), edgeEnd = P(pts[pts.length - 1][0], 0);
    // shoal water just off the coast
    add('path', { 'class': 'shoal', d: line(h * 0.11) + ' L ' + P(reach + h * 0.06, 0).join(' ') + ' L ' + corner.join(' ') + ' Z' });
    add('path', { 'class': 'contour', d: line(h * 0.11) });
    add('path', { 'class': 'contour', d: line(h * 0.24) });
    add('path', { 'class': 'land', d: line(0) + ' L ' + edgeEnd.join(' ') + ' L ' + corner.join(' ') + ' L ' + edgeStart.join(' ') + ' Z' });
    add('path', { 'class': 'landEdge', d: line(0) });

    // a skerry or two off the point
    for (var k = 0; k < 2; k++) {
      var sx = reach * (0.3 + r() * 0.5), sy = depthAt0 * (0.5 + r() * 0.6);
      var c = P(sx, sy);
      add('ellipse', { 'class': 'land', cx: c[0].toFixed(2), cy: c[1].toFixed(2), rx: (0.9 + r() * 1.2).toFixed(2), ry: (0.5 + r() * 0.6).toFixed(2) });
    }

    // soundings, in metres, deepening away from the coast
    var cols = Math.round(w / 8), rows = Math.round(h / 8);
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var x0 = (gx + 0.3 + r() * 0.4) * w / cols, y0 = (gy + 0.4 + r() * 0.4) * h / rows;
        var coastY = depthAt0 * Math.pow(Math.max(0, 1 - x0 / reach), 2);
        if (x0 < reach && y0 < coastY + h * 0.06) continue;      // on land, or in the surf
        if (r() < 0.35) continue;                                  // a chart is never a grid
        var dist = Math.max(0, y0 - coastY) + Math.max(0, x0 - reach) * 0.5;
        // depth rises fast off the coast, then levels out, as a sea floor does
        var depth = Math.round(8 + 34 * (1 - Math.exp(-dist / 38)) + r() * 3);
        var q = P(x0, y0);
        add('text', { 'class': 'snd' + (r() < 0.25 ? ' big' : ''), x: q[0].toFixed(1), y: q[1].toFixed(1) }, String(depth));
      }
    }
    return svg;
  }

  /* ---------- the couple's details, into the sheet and the page ---------- */
  function render(d) {
    var one = txt(d.partner1), two = txt(d.partner2);
    var dp = dateParts(d.date);
    var sched = Array.isArray(d.schedule) ? d.schedule : [];
    var venue = txt(d.venueName), address = txt(d.venueAddress);
    var town = address.split(',').map(function (s) { return s.trim(); }).filter(Boolean).pop() || '';

    document.title = one + ' and ' + two + (dp ? ', ' + dp.d + ' ' + dp.month + ' ' + dp.y : '');
    setText('.index .mark', (one.charAt(0) + two.charAt(0)).toUpperCase());

    // the sheet: printed on all three panels, so filled alike
    var from = txt(d.fromPlace, town || 'The harbour'), to = txt(d.toPlace, venue || 'The island');
    setText('.face .place.a', from);
    setText('.face .place.b', to);
    setText('.face .region', txt(d.chartTitle, town));
    setText('.face .passage', from + ' to ' + to);
    setText('.face .sheetno', '');
    all('.face .sheetno').forEach(function (p) {
      if (!dp) return;
      p.appendChild(document.createTextNode('No. ' + pad(dp.d) + pad(dp.m) + String(dp.y).slice(2)));
      p.appendChild(el('br'));
      p.appendChild(document.createTextNode('Ed. 1'));
    });
    all('.face .title .nm').forEach(function (n) {
      n.textContent = '';
      n.appendChild(document.createTextNode(one));
      n.appendChild(el('span', 'amp', 'and'));
      n.appendChild(document.createTextNode(two));
    });
    all('.face .when').forEach(function (w) {
      w.textContent = '';
      if (!dp) return;
      w.appendChild(document.createTextNode(dp.weekday + ' '));
      w.appendChild(el('b', null, dp.d + ' ' + dp.month + ' ' + dp.y));
    });
    // sailing directions: the first three moments, then the reply-by date
    all('.face .detail dl').forEach(function (dl) {
      dl.textContent = '';
      sched.slice(0, 3).forEach(function (s) {
        dl.appendChild(el('dt', null, txt(s.title)));
        dl.appendChild(el('dd', null, [txt(s.time), txt(s.venue)].filter(Boolean).join(', ')));
      });
      if (!blank(d.rsvpDeadline)) {
        dl.appendChild(el('dt', null, 'Reply by'));
        dl.appendChild(el('dd', null, txt(d.rsvpDeadline)));
      }
    });

    // how it started: their photograph, or a piece of the chart
    var story = document.getElementById('beginning');
    var photo = document.querySelector('#beginning img.couple');
    var hasPhoto = /^(https:|blob:)/.test(txt(d.heroPhoto));
    if (hasPhoto && photo) {
      photo.src = d.heroPhoto; photo.hidden = false;
    } else if (story) {
      if (photo) photo.remove();
      story.classList.add('charted');
      story.insertBefore(chartExcerpt(101, 200, 125, false), story.firstChild);
    }
    var head = document.getElementById('storyHeadline');
    if (head) { head.textContent = txt(d.storyHeadline); head.hidden = blank(d.storyHeadline); }
    var p1 = document.getElementById('storyP1');
    if (p1) { p1.textContent = ''; if (!blank(d.story1)) p1.appendChild(el('p', null, txt(d.story1))); }
    if (story && blank(d.story1) && blank(d.storyHeadline) && !hasPhoto) story.classList.add('luma-empty');

    // the register
    setText('#whoOne', one);
    setText('#whoTwo', two);
    var p2 = document.getElementById('storyP2');
    if (p2) { p2.textContent = ''; if (!blank(d.story2)) p2.appendChild(el('p', null, txt(d.story2))); }

    // the passage: one stop per moment of the day
    setText('#scheduleHeading', txt(d.scheduleHeading, 'The day, as a passage.'));
    var lede = document.getElementById('scheduleLede');
    if (lede) { lede.textContent = ''; if (!blank(d.scheduleLede)) lede.appendChild(el('p', null, txt(d.scheduleLede))); }
    var list = document.getElementById('tlItems');
    if (list) {
      list.textContent = '';
      sched.forEach(function (s, i) {
        var stop = el('article', 'stop');
        stop.setAttribute('data-reveal', '');
        var plate = el('div', 'plate');
        if (/^(https:|blob:)/.test(txt(s.photo))) {
          var img = el('img');
          img.src = s.photo; img.alt = txt(s.title); img.loading = 'lazy';
          plate.appendChild(img);
        } else {
          plate.classList.add('charted');
          plate.appendChild(chartExcerpt(i + 1, 100, 64, i % 2 === 1));
        }
        var track = document.createElementNS(SVG, 'svg');
        track.setAttribute('class', 'track');
        track.setAttribute('viewBox', '0 0 100 64');
        track.setAttribute('preserveAspectRatio', 'none');
        track.setAttribute('aria-hidden', 'true');
        track.setAttribute('focusable', 'false');
        var path = document.createElementNS(SVG, 'path');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.setAttribute('d', 'M -2 18 C 22 26, 34 12, 52 24 C 70 36, 80 52, 102 50');
        var pin = document.createElementNS(SVG, 'circle');
        pin.setAttribute('cx', '52'); pin.setAttribute('cy', '24'); pin.setAttribute('r', '1');
        track.appendChild(path); track.appendChild(pin);
        plate.appendChild(track);
        var note = el('div', 'note');
        note.appendChild(el('p', 'at', txt(s.time)));
        note.appendChild(el('h3', 'd3', txt(s.title)));
        if (!blank(s.venue)) { var col = el('div', 'col'); col.appendChild(el('p', null, txt(s.venue))); note.appendChild(col); }
        stop.appendChild(plate); stop.appendChild(note);
        list.appendChild(stop);
      });
      var sec = document.getElementById('schedule');
      if (sec && !sched.length) sec.classList.add('luma-empty');
    }

    // the day
    setText('#dayTitle', dp ? dp.weekday + ' the ' + ORD[dp.d] + ' of ' + dp.month + ', ' + dp.y + '.' : '');
    var facts = document.querySelector('#the-day .facts');
    if (facts) {
      facts.textContent = '';
      [['Ceremony', [venue, txt(d.time)].filter(Boolean).join(', ')],
       ['Where', address],
       ['Dress', [txt(d.dressCode), txt(d.dressCodeNote)].filter(Boolean).join(', ')],
       ['Reply by', txt(d.rsvpDeadline)]].forEach(function (f) {
        if (!f[1]) return;
        var div = el('div');
        div.appendChild(el('dt', null, f[0]));
        div.appendChild(el('dd', null, f[1]));
        facts.appendChild(div);
      });
    }
    var vl = document.getElementById('venueLink');
    if (vl) {
      var q = [venue, address].filter(Boolean).join(', ');
      if (q) { vl.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); vl.target = '_blank'; vl.rel = 'noopener'; }
      else vl.hidden = true;
    }

    // the folio: the couple's photographs
    setText('#galleryHeading', txt(d.galleryHeading, 'A few of ours.'));
    var run = document.querySelector('#gallery .run');
    var gallery = Array.isArray(d.gallery) ? d.gallery.filter(function (g) { return g && /^(https:|blob:)/.test(txt(g.photo)); }) : [];
    if (run) {
      run.textContent = '';
      gallery.forEach(function (g) {
        var fig = el('figure');
        var img = el('img'); img.src = g.photo; img.alt = txt(g.caption, 'A photograph of the two of you'); img.loading = 'lazy';
        fig.appendChild(img);
        if (!blank(g.caption)) fig.appendChild(el('figcaption', null, txt(g.caption)));
        run.appendChild(fig);
      });
    }
    if (!gallery.length) { var gs = document.getElementById('gallery'); if (gs) gs.classList.add('luma-empty'); }

    // notes on the passage: the couple's questions
    var notes = document.getElementById('faq-drawer-list');
    var faq = Array.isArray(d.faq) ? d.faq.filter(function (f) { return f && !blank(f.question); }) : [];
    if (notes) {
      notes.textContent = '';
      faq.forEach(function (f) {
        var det = el('details');
        det.appendChild(el('summary', null, txt(f.question)));
        var col = el('div', 'col'); col.appendChild(el('p', null, txt(f.answer)));
        det.appendChild(col);
        notes.appendChild(det);
      });
    }
    if (!faq.length) { var ns = document.getElementById('notes'); if (ns) ns.classList.add('luma-empty'); }

    // the reply
    setText('#rsvp-confirmed .after', 'You are on it, with a light of your own.' + (dp ? ' There is nothing else to do until ' + dp.month + '.' : ''));
    setText('#footNames', one + ' and ' + two + (dp ? ', ' + dp.y : ''));

    // the calendar links in page.js read this
    var start = clock(d.time);
    window.__lumaMap = {
      when: dp ? { y: dp.y, m: dp.m, d: dp.d, startH: start.h, startM: start.mi, hours: 10 } : null,
      title: one + ' and ' + two + ', wedding',
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
      start('map.js?v=9').then(function () { return start('page.js?v=25'); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  });
})();
