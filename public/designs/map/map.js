/* ============================================================
   THE CROSSING — the map is opened
   ------------------------------------------------------------
   Two beats, in the order paper actually gives way: the top
   panel folds out, then the bottom one. Both are one rotateX
   about the crease they are hinged on.

   Everything is CSS. This file moves the sheet between states,
   guarantees the last one is reached, and keeps the names inside
   the panel whoever they belong to.
   ============================================================ */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  /* The finished state, and the failsafe. Folded, two thirds of the
     sheet is face down behind the middle panel; if this never ran,
     the guest would be holding a closed map. */
  function open() {
    timers.forEach(clearTimeout);
    document.body.classList.add('opened');
    /* The bottom panel finishes last: 1100ms of swing behind a 420ms
       delay. After that the sheet is at rest, so the compositor
       layers go back and the prompt stops being a control — leaving
       role="button" on it offers a screen reader a button that no
       longer does anything. Immediate when nothing animated. */
    settle(reduce || beat ? 0 : 1620);
  }
  function settle(ms) {
    var done = function () {
      document.body.classList.add('settled');
      var h = document.getElementById('hint');
      if (!h) return;
      if (h === document.activeElement) h.blur();
      h.removeAttribute('role');
      h.removeAttribute('tabindex');
    };
    if (ms) setTimeout(done, ms); else done();
  }
  function close() {
    document.body.classList.remove('opened');
    document.body.classList.remove('settled');
  }

  var params = new URLSearchParams(location.search);
  var beat = params.get('beat');

  /* ?sim=390x844 lays the page out as if the viewport were that
     size. Headless Chrome here always lays out at 500x749 and only
     crops the capture, so a still taken without this is a crop of a
     wider layout. --pw and the scene height are the only
     viewport-relative values. MUST track map.css. Dev only. */
  var sim = params.get('sim');
  if (sim && /^\d+x\d+$/.test(sim)) {
    var W = parseInt(sim, 10), H = parseInt(sim.split('x')[1], 10);
    var pw = Math.max(258, Math.min(0.84 * W, 0.40 * H, 440));
    var st = document.createElement('style');
    st.textContent =
      'html,body{width:' + W + 'px}' +
      ':root{--pw:' + pw.toFixed(2) + 'px}' +
      '.scene{min-height:' + H + 'px}' +
      /* A position:fixed box resolves against the REAL viewport, not
         the simulated body, so the index and the prompt have to be
         pinned or everything inside them is measured at the wrong
         width — which reported the index's list as overflowing when
         it was only ever the simulator lying. */
      '.index,.hint{width:' + W + 'px}' +
      (beat
        ? 'html,body{height:' + H + 'px;overflow:hidden}' +
          '.scene{height:' + H + 'px}' +
          '.table,.hint{position:absolute}'
        : '.table{position:absolute;top:0;width:' + W + 'px;height:100%}' +
          '.hint{position:absolute}');
    document.head.appendChild(st);
  }

  /* The prompt becomes a control BEFORE any state is decided, so that
     the paths which open immediately can retire it again. Setting it
     afterwards handed the role back to a prompt that was already
     spent. */
  var hint = document.getElementById('hint');
  if (hint) { hint.setAttribute('role', 'button'); hint.tabIndex = 0; }

  if (beat) {
    var css = document.createElement('style');
    css.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(css);
    if (beat === 'opened') open(); else close();
  } else if (reduce) {
    open();
  } else {
    /* It opens on a tap, and opens by itself if nobody taps: a guest
       who does not realise the map is a control must not be left
       holding it shut. */
    var go = function () { open(); };
    document.addEventListener('pointerdown', go, { once: true });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') go();
    }, { once: true });
    later(go, 1400);
    later(open, 3800);
  }


  /* ---------- THE NAMES FIT, WHOEVER THEY BELONG TO ----------
     Set in Playfair capitals at a ninth of the panel width, which
     is right for "Marit and Jonas" and wrong for a longer pair.
     Every panel holds a copy, so every copy is measured and they
     are all stepped down together: if they drifted apart the
     printing would no longer line up across the creases. */
  function fitNames() {
    var all = [].slice.call(document.querySelectorAll('.face .title h1, .face .title .nm'));
    if (!all.length) return;
    all.forEach(function (h) { h.style.fontSize = ''; });
    var probe = all[0];
    var avail = probe.clientWidth;
    if (!avail) return;
    var size = parseFloat(getComputedStyle(probe).fontSize);
    for (var i = 0; i < 8; i++) {
      if (probe.scrollWidth <= avail) break;
      size = size * 0.92;
      all.forEach(function (h) { h.style.fontSize = size.toFixed(2) + 'px'; });
    }
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitNames).catch(fitNames);
  } else {
    setTimeout(fitNames, 260);
  }
  addEventListener('resize', fitNames);

  window.__map = { open: open, close: close };

  /* ---------- ?probe=1 ----------
     Prints measurements INTO the page, because --dump-dom here
     ignores the window size and a screenshot cropped to a width
     cannot show what happens at a greater one.

     What it answers: where the two creases fall on the title block
     (the interlock only works if they land in leading, not through
     a letter), and whether anything overflows the sheet. The
     overflow scan walks every element, skipping position:fixed
     (which resolves against the real viewport, not the simulated
     body) and anything inside a clipping ancestor, or it is all
     false positives. Dev only. */
  if (params.get('probe')) {
    setTimeout(function () {
      var out = [];
      var face = document.querySelector('.panel.mid .face');
      var fr = face.getBoundingClientRect();
      var ph = document.querySelector('.panel.mid').getBoundingClientRect().height;
      var gapEl = getComputedStyle(document.documentElement).getPropertyValue('--gap');
      var gap = parseFloat(gapEl) || 3;
      out.push('face h=' + Math.round(fr.height) + ' ph=' + Math.round(ph) + ' gap=' + gap);

      /* crease positions in the face's own coordinates */
      var c1 = ph, c2 = ph * 2 + gap;
      out.push('crease1=' + Math.round(c1) + ' crease2=' + Math.round(c2));

      ['.title', '.title h1', '.title .amp', '.title .spec', '.detail', '.scale']
        .forEach(function (sel) {
          var el = face.querySelector(sel);
          if (!el) { out.push(sel + ' MISSING'); return; }
          var r = el.getBoundingClientRect();
          var t = Math.round(r.top - fr.top), b = Math.round(r.bottom - fr.top);
          var hits = [];
          if (c1 > t && c1 < b) hits.push('c1@' + Math.round(c1 - t));
          if (c2 > t && c2 < b) hits.push('c2@' + Math.round(c2 - t));
          out.push(sel + ' [' + t + ',' + b + '] ' + (hits.join(' ') || '-'));
        });

      /* does the h1 still fit, and did fitNames have to step it down */
      var h1 = face.querySelector('.title h1');
      out.push('h1 ' + getComputedStyle(h1).fontSize +
               ' sw=' + h1.scrollWidth + ' cw=' + h1.clientWidth);

      /* overflow scan */
      var bw = document.body.clientWidth, bad = [];
      /* Stop AT body. The page sets body{overflow-x:hidden}, so a walk
         that includes body finds a clipping ancestor for every
         element on the page and the probe reports "none" whatever is
         actually hanging off the edge. */
      function clipped(el) {
        for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          var o = getComputedStyle(p).overflowX;
          if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return true;
        }
        return false;
      }
      [].slice.call(document.querySelectorAll('body *')).forEach(function (el) {
        if (getComputedStyle(el).position === 'fixed') return;
        /* off-screen on purpose: the honeypot, the visually-hidden
           form controls, and the hint, whose containing block under
           ?sim is the real viewport rather than the simulated body */
        if (el.closest('.hp') || el.classList.contains('visually-hidden') ||
            el.id === 'hint' || el.classList.contains('table')) return;
        if (clipped(el)) return;
        var r = el.getBoundingClientRect();
        if (r.width === 0) return;
        if (r.right > bw + 1 || r.left < -1) {
          bad.push((el.className || el.tagName) + ' ' +
                   Math.round(r.left) + '..' + Math.round(r.right));
        }
      });
      out.push('body w=' + bw + ' scroll=' + document.documentElement.scrollWidth);
      out.push('over: ' + (bad.length ? bad.slice(0, 6).join(' | ') : 'none'));

      /* the two things the audit fixed, asserted rather than assumed */
      var hintEl = document.getElementById('hint');
      out.push('settled=' + document.body.classList.contains('settled') +
               ' wc=' + getComputedStyle(document.querySelector('.panel.mid')).willChange +
               ' hintrole=' + (hintEl && hintEl.getAttribute('role') || 'none'));
      out.push('h1=' + document.querySelectorAll('h1').length +
               ' exposed=' + document.querySelectorAll('.panel:not([aria-hidden]) .face').length);

      var pre = document.createElement('pre');
      pre.style.cssText = 'position:fixed;z-index:99;left:0;top:0;margin:0;padding:4px 6px;' +
        'background:#000;color:#0f0;font:9px/1.35 ui-monospace,monospace;' +
        'white-space:pre-wrap;max-width:100%';
      pre.textContent = out.join('\n');
      document.body.appendChild(pre);
    }, 400);
  }
})();
