/* ============================================================
   THE INSCRIPTION — the light arrives
   ------------------------------------------------------------
   One beat. A raking light crosses the slab, and as it passes the
   cut letters gain their shadow and their lit wall and become
   legible. Everything is CSS; this file only adds the class and
   guarantees it gets added.
   ============================================================ */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  /* The finished state, and the failsafe. The letters start at half
     opacity with almost no shading, so if this never runs the page
     is a slab with a faint inscription nobody can read. */
  function lit() {
    timers.forEach(clearTimeout);
    document.body.classList.add('lit');
  }
  function unlit() { document.body.classList.remove('lit'); }

  /* ---------- SPLIT FOR THE STRIKE ----------
     Each character becomes its own element carrying its position,
     so the light can cut them one after another as it crosses
     instead of the whole inscription fading up at once.

     Done in JS rather than in the markup because the buyer types
     their own names and must never have to hand-wrap letters. The
     text content is unchanged, so a screen reader still reads
     "VERA AND AURELIO" as one string, and the h1 keeps its own
     text rather than an aria-label that could drift out of sync.

     Runs before the light, and only on the cut headings. */
  function splitCut() {
    var i = 0;
    document.querySelectorAll('.cut').forEach(function (el) {
      if (el.dataset.split) return;
      var walk = function (node) {
        var kids = [].slice.call(node.childNodes);
        kids.forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            /* Split into WORDS first, and keep each word unbreakable.
               Wrapping bare characters in inline-block lets a line
               break between any two letters, which turned "TWENTY
               SEVEN" into "TWE / NTY SEVEN". Words break at spaces
               and nowhere else. */
            n.nodeValue.split(/(\s+)/).forEach(function (part) {
              if (part === '') return;
              if (/^\s+$/.test(part)) {
                frag.appendChild(document.createTextNode(' '));
                i++;
                return;
              }
              var word = document.createElement('span');
              word.className = 'wd';
              part.split('').forEach(function (chr) {
                var s = document.createElement('span');
                s.className = 'ch';
                s.style.setProperty('--i', i++);
                s.textContent = chr;
                word.appendChild(s);
              });
              frag.appendChild(word);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1) {
            walk(n);
          }
        });
      };
      walk(el);
      el.dataset.split = '1';
    });
  }
  splitCut();

  var params = new URLSearchParams(location.search);
  var beat = params.get('beat');

  /* ?sim=390x844 lays the page out as if the viewport were that
     size. Headless Chrome here always lays out at 500x749 and only
     crops the capture, so a still taken without this is a crop of a
     wider layout. --slab and the scene height are the only
     viewport-relative values. MUST track stone.css. Dev only. */
  var sim = params.get('sim');
  if (sim && /^\d+x\d+$/.test(sim)) {
    var W = parseInt(sim, 10), H = parseInt(sim.split('x')[1], 10);
    var slab = Math.max(280, Math.min(0.88 * W, 560));
    var st = document.createElement('style');
    st.textContent =
      'html,body{width:' + W + 'px}' +
      ':root{--slab:' + slab.toFixed(2) + 'px}' +
      '.scene{min-height:' + H + 'px}' +
      /* with a beat frozen we want one screen; without one, the whole
         scroll at the right width */
      (beat
        ? 'html,body{height:' + H + 'px;overflow:hidden}' +
          '.scene{height:' + H + 'px}' +
          '.slab,.hint,.index{position:absolute}' +
          '.sec,footer{display:none}'
        : '.slab{position:absolute;top:0;width:' + W + 'px;height:100%}' +
          '.hint{position:absolute}.index{max-width:' + (W - 16) + 'px}');
    document.head.appendChild(st);
  }

  /* ?strike=800 freezes the whole entry 800ms in: each character is
     held at however far through its own strike it would be at that
     moment, and the light band is placed where it would have got
     to. Without this there is no way to photograph the middle of
     the sequence, and "does anything actually happen" is a question
     only the middle can answer. Dev only. */
  var at = params.get('strike');
  if (at !== null) {
    var T = parseFloat(at) || 0;
    var STEP = 22, RUN = 1500, FROM = -58, TO = 14;
    var x = FROM + (TO - FROM) * Math.min(1, T / RUN);
    var fz = document.createElement('style');
    fz.textContent =
      '.ch{animation-delay:calc(var(--i,0) * ' + STEP + 'ms - ' + T + 'ms)!important;' +
      'animation-play-state:paused!important}' +
      '.slab .rake{transition:none!important;transform:translate3d(' + x.toFixed(2) + '%,0,0)!important}' +
      '.inscription .vein{transition:none!important}' +
      '.hint{opacity:0}';
    document.head.appendChild(fz);
    document.body.classList.add('lit');
    return;
  }

  if (beat) {
    var css = document.createElement('style');
    css.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(css);
    if (beat === 'lit') lit(); else unlit();
    return;
  }

  if (reduce) {
    lit();
  } else {
    /* The light comes on a tap, and comes by itself if nobody taps:
       a guest who does not realise the stone is a control must not
       be left looking at an inscription they cannot read. */
    var go = function () { lit(); };
    document.addEventListener('pointerdown', go, { once: true });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') go();
    }, { once: true });
    later(go, 1100);
    later(lit, 3600);
  }

  var hint = document.getElementById('hint');
  if (hint) { hint.setAttribute('role', 'button'); hint.tabIndex = 0; }

  /* ---------- THE NAMES FIT, WHOEVER THEY BELONG TO ----------
     Cinzel is capitals only and widely letterspaced, so a long name
     runs out of measure fast. Stepped down until the longest line
     fits, after the face has loaded. */
  function fitNames() {
    var h1 = document.querySelector('.inscription h1');
    if (!h1) return;
    h1.style.fontSize = '';
    var avail = h1.clientWidth;
    if (!avail) return;
    for (var i = 0; i < 8; i++) {
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

  window.__stone = { lit: lit, unlit: unlit };
})();
