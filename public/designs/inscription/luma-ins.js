/*
 * The Inscription on Luma. Loaded after luma-bridge.js.
 *
 * The standalone design had its couple cut into the markup. Here their
 * details arrive from Luma (window.lumaBoot); this writes them into the stone
 * (the date in words, the way an inscription is cut), builds the order of
 * the day from their schedule, then starts the design's own stone.js, which
 * splits every .cut line into letters, and page.js.
 */
(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'];
  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function blank(v) { return !v || !String(v).trim(); }
  function txt(v, d) { v = v == null ? '' : String(v).trim(); return v || d || ''; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function byId(id) { return document.getElementById(id); }
  function setText(id, v) { var e = byId(id); if (e) e.textContent = v; }

  /* 2027 -> "two thousand and twenty seven", as the original was cut */
  function under100(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
  function yearWords(y) {
    var th = Math.floor(y / 1000), rest = y % 1000, hu = Math.floor(rest / 100), lo = rest % 100;
    var out = [];
    if (th) out.push(ONES[th] + ' thousand');
    if (hu) out.push(ONES[hu] + ' hundred');
    if (lo) out.push((out.length ? 'and ' : '') + under100(lo));
    return out.join(' ');
  }
  /* 16:30 -> "half past four", the way the design says its hours */
  function timeWords(t) {
    var m = /^(\d{1,2})[:.h]?(\d{2})?\s*([ap])?/i.exec(txt(t));
    if (!m) return txt(t);
    var h = +m[1], mi = +(m[2] || 0), ap = (m[3] || '').toLowerCase();
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    var h12 = function (x) { x = x % 12; return ONES[x === 0 ? 12 : x]; };
    if (mi === 0) return h12(h) + " o'clock";
    if (mi === 15) return 'quarter past ' + h12(h);
    if (mi === 30) return 'half past ' + h12(h);
    if (mi === 45) return 'quarter to ' + h12(h + 1);
    return txt(t);
  }
  function dateParts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    return { y: y, m: mo, d: d, weekday: DAYS[new Date(y, mo - 1, d).getDay()], month: MONTHS[mo - 1] };
  }
  function clock(t) {
    var m = /^(\d{1,2})[:.h]?(\d{2})?\s*([ap])?/i.exec(txt(t));
    if (!m) return { h: 16, mi: 0 };
    var h = +m[1], mi = +(m[2] || 0), ap = (m[3] || '').toLowerCase();
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return { h: h, mi: mi };
  }
  function real(url) { return /^(https:|blob:)/.test(txt(url)); }

  function render(d) {
    var one = txt(d.partner1), two = txt(d.partner2);
    var dp = dateParts(d.date);
    var sched = Array.isArray(d.schedule) ? d.schedule : [];
    var venue = txt(d.venueName), address = txt(d.venueAddress);

    document.title = one + ' & ' + two + (dp ? ' · ' + dp.d + ' ' + dp.month + ' ' + dp.y : '');
    var mono = document.querySelector('.index .mono');
    if (mono) mono.textContent = (one.charAt(0) + two.charAt(0)).toUpperCase();

    // the inscription
    var above = document.querySelector('.inscription .above');
    if (above) above.textContent = txt(d.inscriptionAbove, 'They are to be married');
    var h1 = document.querySelector('.inscription h1');
    if (h1) {
      h1.textContent = '';
      h1.appendChild(document.createTextNode(one));
      h1.appendChild(el('span', 'amp', 'and'));
      h1.appendChild(document.createTextNode(two));
    }
    var below = document.querySelector('.inscription .below');
    if (below && dp) {
      below.textContent = '';
      below.appendChild(document.createTextNode('The ' + ORD[dp.d] + ' of ' + dp.month));
      below.appendChild(el('br'));
      below.appendChild(document.createTextNode(cap(yearWords(dp.y))));
    }

    // how it started: their photograph let into the stone, or the panel alone
    var story = byId('beginning');
    var img = document.querySelector('#beginning img.couple');
    if (real(d.heroPhoto) && img) { img.src = d.heroPhoto; img.hidden = false; }
    else if (story) story.classList.add('nophoto');
    var head = byId('storyHeadline');
    if (head) { head.textContent = txt(d.storyHeadline); head.hidden = blank(d.storyHeadline); }
    setText('storyP1', txt(d.story1));
    if (story && blank(d.story1) && blank(d.storyHeadline) && !real(d.heroPhoto)) story.classList.add('luma-empty');

    // the dedication
    setText('whoOne', one);
    setText('whoTwo', two);
    setText('storyP2', txt(d.story2));
    var p2 = byId('storyP2'); if (p2) p2.hidden = blank(d.story2);

    // the day
    setText('dayTitle', dp ? dp.weekday + ' the ' + ORD[dp.d] + ' of ' + dp.month : '');
    var facts = document.querySelector('#the-day .facts');
    if (facts) {
      facts.textContent = '';
      [['Where', venue], ['Address', address], ['Time', cap(timeWords(d.time))],
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
      if (q) { vl.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); vl.target = '_blank'; vl.rel = 'noopener'; }
      else vl.hidden = true;
    }

    // the order of the day, under a heading cut from its first hour
    var hours = byId('tlItems');
    if (hours) {
      var channel = hours.querySelector('.channel');
      hours.textContent = '';
      if (channel) hours.appendChild(channel);
      sched.forEach(function (s) {
        var h = el('div', 'hour');
        h.appendChild(el('p', 'at cut', txt(s.time)));
        h.appendChild(el('h3', null, txt(s.title)));
        if (!blank(s.venue)) h.appendChild(el('p', null, txt(s.venue)));
        hours.appendChild(h);
      });
    }
    setText('scheduleHeading', txt(d.scheduleHeading, sched.length ? 'From ' + timeWords(sched[0].time) : ''));
    if (!sched.length) { var ss = byId('schedule'); if (ss) ss.classList.add('luma-empty'); }

    // plates: the couple's photographs
    setText('galleryHeading', txt(d.galleryHeading, 'Before any of it was arranged'));
    var plates = document.querySelector('#gallery .plates');
    var gallery = Array.isArray(d.gallery) ? d.gallery.filter(function (g) { return g && real(g.photo); }) : [];
    if (plates) {
      plates.textContent = '';
      gallery.forEach(function (g) {
        var fig = el('figure');
        var im = el('img'); im.src = g.photo; im.alt = txt(g.caption, 'A photograph of the two of you'); im.loading = 'lazy';
        fig.appendChild(im);
        plates.appendChild(fig);
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

    // the reply
    setText('cutLead', dp ? 'Cut, the ' + ORD[dp.d] + ' of ' + dp.month : 'Cut');
    setText('footNames', one + ' and ' + two + (dp ? ', ' + dp.y : ''));

    // the calendar links in page.js read this
    var start = clock(d.time);
    window.__lumaIns = {
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
      start('stone.js?v=6').then(function () { return start('page.js?v=2'); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  });
})();
