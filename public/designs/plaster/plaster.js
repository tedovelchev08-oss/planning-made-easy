/* ============================================================
   THE LIGHT TEST — the opening
   ------------------------------------------------------------
   Four beats, in the order the real object performs them:

     1  the seal breaks, its halves going with the paper each was
        stuck to
     2  the flap rotates up about its own crease
     3  the flap is now behind everything, so its z-index drops
     4  the card rises, and as it clears the paper the type stops
        being read through the sheet and becomes crisp

   Everything above is CSS transitions; this file only moves the
   piece between states and guarantees the last one is reached.
   ============================================================ */
(function () {
  'use strict';

  var post = document.getElementById('post');
  var tap  = document.getElementById('tap');
  if (!post) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var state  = 'sealed';
  var timers = [];

  function clear() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  /* The finished invitation: open, card out, type crisp. Also the
     failsafe. If a transition is dropped, a tab is backgrounded
     mid-sequence, or this file throws after the first beat, the
     page must still be an invitation somebody can read rather
     than a sealed envelope nobody can get into. */
  function final() {
    clear();
    document.body.classList.add('went');
    post.classList.remove('opening');
    post.classList.add('opened', 'risen');
    state = 'open';
  }

  function sealed() {
    clear();
    document.body.classList.remove('went');
    post.classList.remove('opening', 'opened', 'risen');
    state = 'sealed';
  }

  function open() {
    if (state !== 'sealed') return;
    state = 'opening';
    document.body.classList.add('went');

    if (reduce) { final(); return; }

    post.classList.add('opening');

    /* The flap is in front while it is folded down and behind once
       it has passed vertical, so its stacking has to change with
       it. transitionend is the honest signal; the timer is there
       because transitionend does not fire on a backgrounded tab. */
    var advanced = false;
    function advance() {
      if (advanced) return;
      advanced = true;
      post.classList.add('opened');
      later(function () { post.classList.add('risen'); }, 90);
    }
    post.querySelector('.flap').addEventListener('transitionend', function (e) {
      if (e.propertyName === 'transform') advance();
    }, { once: true });
    later(advance, 1250);

    /* and whatever happens above, the card is out by now */
    later(function () { if (state !== 'open') final(); }, 3400);
  }

  /* ?beat=sealed|breaking|opened|risen|half[:0.45] freezes one beat
     for a still. Development only, and harmless in production: with
     no such parameter nothing below runs. Headless Chrome does not
     fire requestAnimationFrame, so driving the sequence by hand is
     the only way to photograph the middle of it. */
  var params = new URLSearchParams(location.search);
  var q = params.get('beat');

  /* ?sim=390x844 lays the page out as if the viewport were exactly
     that size. Headless Chrome in this environment always lays out
     at 500x749 and merely crops the capture to --window-size, so
     every phone still taken without this is a crop of a wider
     layout — which is how a card that looked centred turned out to
     be running off the right edge. Everything viewport-relative in
     this design comes from --env-w, .scene's height and two fixed
     layers, so restating those four things in pixels is enough to
     reproduce a real phone faithfully. Dev only. */
  var sim = params.get('sim');
  if (sim && /^\d+x\d+$/.test(sim)) {
    var W = parseInt(sim, 10), H = parseInt(sim.split('x')[1], 10);
    var envw = Math.min(0.76 * W, 0.37 * H, 400);
    var sst = document.createElement('style');
    sst.textContent =
      'html,body{width:' + W + 'px}' +
      ':root{--env-w:' + envw.toFixed(2) + 'px}' +
      '.scene{min-height:' + H + 'px}' +
      /* with a beat frozen we want only the hero, one screen tall;
         without one we want the whole scroll at the right width */
      (q
        ? 'html,body{height:' + H + 'px;overflow:hidden}' +
          '.scene{height:' + H + 'px}' +
          '.wall,.tap,.index{position:absolute}' +
          '.sec,footer{display:none}'
        : '.wall{position:absolute;top:0;height:100%;width:' + W + 'px}.wall img{height:100%}.index{max-width:' + (W - 16) + 'px}') +
      /* media queries still test the real viewport, so the desktop
         rules have to be restated for a simulated desktop */
      (W >= 900 && H >= 620
        ? '.wallnote{display:block;position:absolute;z-index:3;top:50%;' +
          'transform:translateY(-50%);width:' + Math.min(0.21 * W, 200).toFixed(0) + 'px;' +
          'font-size:10px;letter-spacing:.22em;text-transform:uppercase;line-height:2.3;' +
          'color:rgba(255,242,226,.92);text-shadow:0 1px 10px rgba(80,34,20,.5)}' +
          '.wallnote.l{right:calc(50% + ' + (envw * 0.62 + 42).toFixed(0) + 'px);text-align:right}' +
          '.wallnote.r{left:calc(50% + ' + (envw * 0.62 + 42).toFixed(0) + 'px);text-align:left}'
        : '');
    document.head.appendChild(sst);
  }

  if (q) {
    /* nothing autoplays; the beat is applied at the foot of this
       file, once the hooks it needs exist */
  } else if (reduce) {
    final();
  } else {
    /* It opens on a tap, and opens by itself if nobody taps —
       a guest who does not realise the envelope is a control
       must not be left looking at a sealed envelope. */
    var go = function () { open(); };
    document.addEventListener('pointerdown', go, { once: true });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') go();
    }, { once: true });
    later(go, 1900);
  }

  if (tap) { tap.setAttribute('role', 'button'); tap.tabIndex = 0; }

  /* ---------- THE NAMES FIT, WHOEVER THEY BELONG TO ----------
     The card's type is sized as a ratio of the card, which is right
     for "Alma and Rafael" and wrong for "Konstantina and
     Bartholomew" — that pair ran to both card edges. CSS cannot
     size type to the length of its own content, so this steps the
     display size down until the longest line fits, and stops.

     It runs after the webfont loads, because measuring against a
     fallback serif gives the wrong answer. */
  function fitNames() {
    var h1 = document.querySelector('.card h1');
    if (!h1) return;
    h1.style.fontSize = '';
    var avail = h1.parentElement.clientWidth;
    if (!avail) return;
    for (var step = 0; step < 8; step++) {
      /* scrollWidth is the widest line, so a two-line pair is judged
         on its longer half rather than on both together */
      if (h1.scrollWidth <= avail) break;
      var now = parseFloat(getComputedStyle(h1).fontSize);
      h1.style.fontSize = (now * 0.92).toFixed(2) + 'px';
    }
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitNames).catch(fitNames);
  } else {
    setTimeout(fitNames, 260);
  }
  addEventListener('resize', fitNames);

  /* A still cannot wait for paper to move. */
  window.__lt = {
    sealed: sealed,
    open: open,
    final: final,
    /* freeze a named beat with transitions off, for stills */
    beat: function (name) {
      clear();
      var css = document.createElement('style');
      css.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
      document.head.appendChild(css);
      document.body.classList.remove('went');
      post.classList.remove('opening', 'opened', 'risen');
      if (name === 'sealed') return;
      document.body.classList.add('went');
      if (name === 'breaking') { post.classList.add('opening'); return; }
      if (name === 'opened')   { post.classList.add('opened'); return; }
      post.classList.add('opened', 'risen');
    },
    /* freeze the card part-way out, which is the moment the type
       is being read through the paper */
    half: function (f) {
      f = (f == null ? 0.45 : f);
      this.beat('opened');
      var cs = getComputedStyle(document.documentElement);
      var envH  = parseFloat(getComputedStyle(post).height);
      var rise  = envH * 0.60, lower = envH * 0.30;
      var card = post.querySelector('.card');
      post.style.transform = 'rotate(-1.6deg) translateY(' + (lower * f).toFixed(1) + 'px)';
      card.style.transform =
        'translateY(' + (-(rise + lower) * f).toFixed(1) + 'px) scale(' + (1 + 0.12 * f).toFixed(3) + ')';
      card.querySelector('.face').style.filter = 'blur(1.5px) contrast(.64) brightness(1.16) saturate(.7)';
      card.querySelector('.glow').style.opacity = '1';
      return cs.getPropertyValue('--env-w');
    },
    /* the numbers that decide whether the composition works, read
       out of the page rather than judged from a screenshot */
    probe: function () {
      var r = function (el) { var b = el.getBoundingClientRect();
        return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      var front = post.querySelector('.env-front');
      var card  = post.querySelector('.card');
      var year  = post.querySelector('.year');
      var yb = year.getBoundingClientRect(), fb = front.getBoundingClientRect();
      return {
        view: [innerWidth, innerHeight],
        post: r(post), card: r(card), front: r(front), year: r(year),
        yearHiddenPct: Math.round(Math.max(0, Math.min(yb.bottom, fb.bottom) - Math.max(yb.top, fb.top)) / yb.height * 100),
        cardHiddenPct: Math.round(Math.max(0, card.getBoundingClientRect().bottom - fb.top) / card.getBoundingClientRect().height * 100),
        whenOverflow: (function (e) { return e.scrollWidth - e.clientWidth; })(post.querySelector('.when')),
        topGap: Math.round(card.getBoundingClientRect().top),
        bottomOver: Math.round(post.getBoundingClientRect().bottom - innerHeight)
      };
    }
  };

  if (q) {
    var s = document.createElement('style');
    s.textContent = '.after{display:none!important}html,body{height:100vh;overflow:hidden}';
    document.head.appendChild(s);
    var parts = q.split(':');
    if (parts[0] === 'half') window.__lt.half(parseFloat(parts[1] || '0.45'));
    else window.__lt.beat(parts[0]);

    /* &probe=1 prints the measurements into the DOM, so a headless
       dump can report the composition as numbers. Judging a fixed,
       transformed, 3D scene from a screenshot has cost hours in
       this project; measuring it has not. */
    if (new URLSearchParams(location.search).get('probe')) {
      var pre = document.createElement('pre');
      pre.id = '__probe';
      /* On screen, not only in the DOM: headless Chrome honours
         --window-size for --screenshot but not for --dump-dom, so
         the only way to read measurements taken at the real
         viewport is to have the render carry them. */
      pre.style.cssText = 'position:fixed;z-index:99;left:0;top:0;margin:0;padding:4px 6px;' +
        'background:#000;color:#0f0;font:11px/1.45 ui-monospace,monospace;white-space:pre-wrap;max-width:100%';
      var p = window.__lt.probe();
      pre.textContent = Object.keys(p).map(function (k) {
        return k + '=' + JSON.stringify(p[k]);
      }).join('\n');
      document.body.appendChild(pre);
    }
  }
})();
