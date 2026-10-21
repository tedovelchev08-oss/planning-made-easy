(function(){
  "use strict";

  /* ---------------- PHOTO FALLBACK ----------------
     Photographs live in assets/photos/. Until they are dropped in, show a
     placeholder in the page's own palette rather than a broken-image icon.
     On window because inline onerror="" cannot see inside this closure. */
  window.photoFallback = function(img){
    img.onerror = null;                       // never loop

    /* A drawn preview plate ships beside each expected photo name, so an
       invitation nobody has added photos to still previews as a finished
       piece. Try assets/photos/NAME.svg before giving up on NAME.jpg — which
       means the markup keeps pointing at .jpg and the couple replaces the
       photos without editing a single path. */
    const src = img.getAttribute('src') || '';
    const plate = src.replace(/\.(jpe?g|png|webp)(\?.*)?$/i, '.svg');
    if (plate !== src && img.dataset.triedPlate !== 'true'){
      img.dataset.triedPlate = 'true';
      img.onerror = function(){ window.photoFallback(img); };
      img.src = plate;
      return;
    }

    const label = (img.getAttribute('alt') || 'Your photo').replace(/[<>&]/g, '');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1500">' +
        '<rect width="1200" height="1500" fill="#18171a"/>' +
        '<rect x="60" y="60" width="1080" height="1380" fill="none" ' +
          'stroke="#c6b89c" stroke-opacity="0.3" stroke-width="2"/>' +
        '<text x="600" y="735" text-anchor="middle" fill="#c6b89c" ' +
          'font-family="Georgia,Times,serif" font-style="italic" font-size="54">' + label + '</text>' +
        '<text x="600" y="805" text-anchor="middle" fill="#c6b89c" fill-opacity="0.65" ' +
          'font-family="Helvetica,Arial,sans-serif" font-size="26" letter-spacing="8">ADD YOUR PHOTO</text>' +
      '</svg>';
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    img.dataset.placeholder = 'true';
  };

  /* Images sit above this script in the document, so a missing file can fail
     before the function above exists — the inline onerror then throws a
     ReferenceError and the photo stays broken. Sweep whatever already failed,
     and again at load for anything still in flight. */
  function sweepBrokenPhotos(){
    document.querySelectorAll('img').forEach((img) => {
      if (img.complete && img.naturalWidth === 0 && img.dataset.placeholder !== 'true'){
        window.photoFallback(img);
      }
    });
  }
  sweepBrokenPhotos();
  window.addEventListener('load', sweepBrokenPhotos);

  /* ---------------- SAFE STORAGE ----------------
     Storage can throw on access rather than return null — Safari private
     browsing, some in-app webviews (Instagram, Facebook), and pages opened
     straight from disk. An unguarded read aborts the whole script and leaves
     the guest with a dead page, so every access goes through these. */
  function storeGet(store, key){
    try { return window[store].getItem(key); } catch (err) { return null; }
  }
  function storeSet(store, key, value){
    try { window[store].setItem(key, value); } catch (err) { /* not fatal */ }
  }
  function storeRemove(store, key){
    try { window[store].removeItem(key); } catch (err) { /* not fatal */ }
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ---------------- AUTOSAVE ----------------
     Nothing in the shared core persists anything. Without this, filling in
     thirty-odd fields and uploading four photos is lost to a stray refresh —
     and the photos especially, since uploads live only as data-URIs in
     memory until the invitation is exported or shared.

     Everything goes through storeGet/storeSet, because reading localStorage
     THROWS rather than returning null in Safari private browsing and in some
     in-app webviews (gotcha 9). */
  /* The template's own wording, captured before any saved draft is merged
     in — so it always means "what shipped", never "what I typed last time". */
  const MP_SHIPPED = JSON.parse(JSON.stringify(invitationData));

  const MP_DRAFT_KEY = 'mirror-palace-draft-v1';

  /* Writes and reports, unlike storeSet which swallows the failure. The
     difference matters here: a silent failure means the couple believes the
     work is saved when it is not. */
  function tryWriteDraft(payload){
    try {
      window.localStorage.setItem(MP_DRAFT_KEY, payload);
      return true;
    } catch (err) {
      return false;
    }
  }

  function saveDraft(){
    if (window.lumaBoot) return; // LUMA: nothing of the couple's is kept in a guest's browser
    if (tryWriteDraft(JSON.stringify(invitationData))){
      mpDraftNotice('');
      return;
    }

    /* Almost always the ~5MB quota, reached by uploaded photos: each one is
       stored as a base64 data-URI, so four of them can fill it on their own.
       Rather than lose everything, drop the photo payloads and keep the
       wording — then say so, because a photo that silently isn't saved is
       worse than one the couple knows about. */
    const light = {};
    Object.keys(invitationData).forEach(k => { light[k] = invitationData[k]; });

    ['heroPhoto', 'storyPhotoOne', 'storyPhotoTwo', 'storyPhotoTogether'].forEach(k => {
      if (typeof light[k] === 'string' && light[k].indexOf('data:') === 0) delete light[k];
    });
    if (Array.isArray(light.gallery)){
      light.gallery = light.gallery.map(item => {
        if (item && typeof item.photo === 'string' && item.photo.indexOf('data:') === 0){
          const copy = {}; Object.keys(item).forEach(k => { copy[k] = item[k]; });
          delete copy.photo;
          return copy;
        }
        return item;
      });
    }

    if (tryWriteDraft(JSON.stringify(light))){
      mpDraftNotice('Your wording is saved, but the uploaded photos are too large to keep here. Export or share before closing this tab.');
    } else {
      mpDraftNotice('Changes are not being saved in this browser. Export before closing this tab.');
    }
  }

  /* Sits in the drawer footer rather than as a toast — it needs to persist
     while the couple decides what to do about it. */
  function mpDraftNotice(msg){
    let el = document.getElementById('mp-draft-notice');
    if (!msg){
      if (el) el.remove();
      return;
    }
    if (el && el.textContent === msg) return;
    if (!el){
      const drawer = document.getElementById('customizer-drawer');
      if (!drawer) return;
      const footer = drawer.querySelector('.border-t');
      if (!footer) return;
      el = document.createElement('p');
      el.id = 'mp-draft-notice';
      el.className = 'mp-draft-notice';
      el.setAttribute('role', 'status');
      footer.parentNode.insertBefore(el, footer);
    }
    el.textContent = msg;
  }

  let draftTimer = null;
  function queueDraftSave(){
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
  }

  /* Runs at parse time, before the core's DOMContentLoaded handler. That
     ordering matters: a share link (?id= / #lz=) is restored by the core in
     that handler and must win over whatever is saved locally, otherwise a
     guest opening a link on the same browser the couple edited on would see
     the couple's unsent draft bleed through. */
  (function restoreDraft(){
    // LUMA: the couple's data comes from Luma; a draft in this browser could
    // be another couple's (a guest who opened two invitations).
    if (window.lumaBoot) return;
    const params = new URLSearchParams(window.location.search);
    const sharedLink = params.get('id') || /(?:lz|data)=/.test(window.location.hash);
    if (sharedLink) return;

    const raw = storeGet('localStorage', MP_DRAFT_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') Object.assign(invitationData, saved);
    } catch (err) {
      /* A corrupt draft should not take the invitation down with it. */
    }
  })();

  /* The core mutates invitationData from a dozen places — typing, schedule
     rows, FAQ rows, gallery uploads. Rather than wrap each one, hook the two
     funnels they all pass through on their way to the page. */
  const coreUpdateFromInputs = window.updateInvitationFromInputs;
  if (typeof coreUpdateFromInputs === 'function'){
    window.updateInvitationFromInputs = function(){
      coreUpdateFromInputs.apply(this, arguments);
      queueDraftSave();
    };
  }

  const coreRenderForSave = window.renderInvitationFromData;
  if (typeof coreRenderForSave === 'function'){
    window.renderInvitationFromData = function(){
      coreRenderForSave.apply(this, arguments);
      queueDraftSave();
    };
  }

  // Design-only fields and photo uploads don't pass through either funnel.
  document.addEventListener('input', (e) => {
    if (e.target.closest('[data-mp-field]')) queueDraftSave();
  });
  document.addEventListener('change', (e) => {
    if (e.target.closest('[data-mp-photo]')) setTimeout(saveDraft, 800);
  });

  // A tab closed mid-edit still keeps the last keystroke.
  window.addEventListener('pagehide', saveDraft);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveDraft();
  });

  /* Discards the draft and returns to the wording this template shipped
     with. Confirmed first — it cannot be undone. */
  window.mpStartOver = function(){
    const ok = window.confirm(
      'Discard your changes and go back to the original sample wording and photos?\n\n' +
      'This cannot be undone.'
    );
    if (!ok) return;
    storeRemove('localStorage', MP_DRAFT_KEY);
    window.location.reload();
  };

  /* ---------------- LOADER ---------------- */
  const loader = document.getElementById('loader');
  window.addEventListener('load', () => {
    setTimeout(() => { loader.classList.add('hide'); }, reduceMotion ? 200 : 1900);
  });

  /* ---------------- INTRO SEQUENCE ---------------- */
  const intro = document.getElementById('intro');
  const skipBtn = document.getElementById('skipBtn');
  const body = document.body;
  let introTimers = [];
  const visited = storeGet('sessionStorage', 'mirrorPalaceVisited') === '1';

  function clearIntroTimers(){ introTimers.forEach(t => clearTimeout(t)); introTimers = []; }

  function finishIntro(){
    clearIntroTimers();
    intro.classList.add('done');
    body.classList.add('intro-complete');
    body.style.overflow = '';
    storeSet('sessionStorage', 'mirrorPalaceVisited', '1');
    skipBtn.classList.remove('show');
  }

  function runIntro(){
    body.style.overflow = 'hidden';
    // Each stage's start time is spaced to let its own transition actually
    // finish (with a little overlap for continuity) before the next begins,
    // and "names" / "subtitle" get a real hold so they're readable.
    const stages = ['glow','expand','lights','sync','names','subtitle','split'];
    const timing =  [400,   1300,    2500,   3700,  4300,   5500,      6900];
    const doorDuration = 1900; // matches .mirror-door transform transition
    stages.forEach((cls, i) => {
      introTimers.push(setTimeout(() => intro.classList.add(cls), timing[i]));
    });
    const splitTime = timing[timing.length - 1];
    // Reveal the site + enable scrolling as soon as the doors begin
    // parting, so the camera feels like it pushes through the opening
    // rather than waiting for the doors to finish before anything happens.
    introTimers.push(setTimeout(() => {
      body.classList.add('intro-complete');
      body.style.overflow = '';
    }, splitTime + 150));
    // Only tear down the intro overlay once the door animation has
    // actually completed, so the payoff is fully seen, not cut off.
    introTimers.push(setTimeout(finishIntro, splitTime + doorDuration + 300));
    introTimers.push(setTimeout(() => skipBtn.classList.add('show'), 300));
  }

  if (reduceMotion || visited) {
    // Skip elaborate opening on repeat visits or reduced-motion preference
    intro.classList.add('done');
    body.classList.add('intro-complete');
    storeSet('sessionStorage', 'mirrorPalaceVisited', '1');
  } else {
    runIntro();
  }

  skipBtn.addEventListener('click', finishIntro);

  /* ---------------- GALLERY: the mirror hall ----------------
     The core owns the photo data now — invitationData.gallery, edited in the
     drawer, carried into share links and downloads. This replaces the core's
     coverflow renderer with the mirror hall, so the design keeps its own look
     while inheriting uploads, reordering, deletion and the lightbox.

     Overriding by name works because the core is plain global scope: its own
     internal calls to renderGalleryPublic() resolve through the same binding
     reassigned here. */
  const track = document.getElementById('galleryTrack');

  /* Widths cycle so the row keeps its rhythm at any number of photos. */
  const FRAME_RHYTHM = ['w-wide', 'w-narrow', 'w-tall', 'w-narrow'];

  /* Frame positions are measured once per build/resize rather than read in the
     scroll loop. Calling getBoundingClientRect() on every frame of every frame
     forces a layout each time and is what makes this kind of effect stutter. */
  let galleryMetrics = [];
  let galleryTrackWidth = 0;

  function measureGallery(){
    if (!track) return;
    galleryTrackWidth = track.scrollWidth;
    galleryMetrics = Array.prototype.map.call(track.children, (el) => ({
      el: el,
      centre: el.offsetLeft + el.offsetWidth / 2
    }));
  }

  function buildGallery(){
    if (!track) return;
    const photos = (typeof invitationData === 'object' && invitationData.gallery) || [];
    const stage = document.getElementById('gallery-stage');

    // An empty gallery should take the whole section with it rather than
    // leaving a titled, empty corridor.
    if (stage) stage.style.display = photos.length ? '' : 'none';

    track.innerHTML = '';
    photos.forEach((item, idx) => {
      const src = item.photo || item.url || "";
      const cap = item.caption || '';

      const div = document.createElement('div');
      div.className = 'gallery-item ' + FRAME_RHYTHM[idx % FRAME_RHYTHM.length];

      // Built as nodes, not an HTML string: captions are user-editable, and an
      // apostrophe or quote in one would otherwise break out of the attribute.
      const frame = document.createElement('div');
      frame.className = 'gallery-frame';

      const img = document.createElement('img');
      img.src = src;
      img.alt = cap;
      img.loading = 'lazy';
      img.onerror = function(){ window.photoFallback(img); };

      const caption = document.createElement('div');
      caption.className = 'gallery-caption';
      caption.textContent = cap;

      frame.appendChild(img);
      frame.appendChild(caption);

      // Opens the core's lightbox, which is keyed by the photo's own id.
      if (item.id && typeof openGalleryLightbox === 'function'){
        frame.style.cursor = 'zoom-in';
        frame.addEventListener('click', () => openGalleryLightbox(item.id));
      }

      // Sibling of the frame, not a child — the frame clips its overflow, so a
      // reflection nested inside it would never be visible.
      const reflect = document.createElement('div');
      reflect.className = 'gallery-reflect';
      reflect.setAttribute('aria-hidden', 'true');

      /* The reflection is a CSS background, so it cannot follow the img's
         onerror chain — pointed at a missing .jpg it would just stay blank
         under a frame that had fallen back to a plate. Mirror whatever the
         img actually settled on instead. */
      const mirrorSrc = () => {
        reflect.style.backgroundImage = 'url("' + img.src.replace(/"/g, '%22') + '")';
      };
      mirrorSrc();
      img.addEventListener('load', mirrorSrc);

      div.appendChild(frame);
      div.appendChild(reflect);
      track.appendChild(div);
    });

    measureGallery();
    if (typeof sweepBrokenPhotos === 'function') sweepBrokenPhotos();
  }

  // The core calls this whenever the gallery data changes.
  window.renderGalleryPublic = buildGallery;
  buildGallery();

  /* ---------------- SCROLL-LINKED EFFECTS (rAF loop) ---------------- */
  const storyStage = document.getElementById('storyStage');
  const panelA = document.getElementById('panelA');
  const panelB = document.getElementById('panelB');
  const storyCenter = document.getElementById("storyCenter");
  const panelTogether = document.getElementById("panelTogether");

  /* The starting gap between the two portraits was a hardcoded 320px. On a
     phone the panels are 38vw — about 142px on a 375px screen — so at the
     top of the section their centres sat at ±320px and BOTH were entirely
     off the viewport. That is the stretch of black you scroll through before
     anything appears, and it is why the merge then felt rushed: by the time
     the panels were visible at all, the cross-fade was already due.

     Measured from the panel's real width instead, so they start side by side
     with a small gap at every screen size. */
  let storyMaxSpread = 240;

  function measureStory(){
    if (!panelA) return;
    const w = panelA.offsetWidth;
    if (!w) return;
    // Half a panel puts them edge to edge; the rest is the gap between them.
    storyMaxSpread = Math.round(w / 2 + Math.min(28, w * 0.09));
  }

  /* Smoothstep. A cross-fade driven straight off raw scroll position moves
     at a constant rate and reads as mechanical — this eases in and out of
     both ends, which is what makes it feel like it settles rather than
     stops. */
  function ease(t){
    t = clamp01(t);
    return t * t * (3 - 2 * t);
  }
  measureStory();

  const dateSection = document.getElementById('date-section');
  const dateReflection = document.getElementById('dateReflection');

  const gallerySection = document.getElementById('galleryScroll');
  const galleryTrackEl = document.getElementById('galleryTrack');
  const galleryProgressBar = document.getElementById('galleryProgressBar');

  const tboScroll = document.getElementById('tboScroll');
  const tboLeft = document.getElementById('tboLeft');
  const tboRight = document.getElementById('tboRight');
  const tboLine = document.getElementById('tboLine');
  const tboFlash = document.getElementById('tboFlash');
  const tboNames = document.getElementById('tboNames');
  const tboLabel = document.getElementById('tboLabel');

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function progressOf(el, extra){
    const r = el.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    if (total <= 0) return 0;
    return clamp01(-r.top / total);
  }

  /* On a phone the story and the two lights play by themselves once they
     are on screen, and the mirror hall is swiped rather than scrolled
     through, so each is one screen instead of two to four of black travel.
     A laptop keeps all three on the scroll. */
  const phone = window.matchMedia('(max-width: 640px)');
  const played = new Map();
  function playedOf(el, ms){
    if (!played.has(el)){
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.3 || r.bottom < window.innerHeight * 0.6) return 0;
      played.set(el, performance.now());
    }
    return clamp01((performance.now() - played.get(el)) / ms);
  }
  function stageOf(el, ms){
    if (!phone.matches) return progressOf(el);
    return reduceMotion ? 1 : playedOf(el, ms);
  }

  function updateScroll(){
    // STORY — the pair converge, merge into one photograph, then the text
    if (storyStage){
      const p = stageOf(storyStage, 4600);

      /* Convergence runs across most of the section and eases, so the two
         slow as they meet rather than sliding at a constant rate into each
         other. Spread is measured from the panel width — see measureStory. */
      const closing = ease(clamp01(p / 0.70));
      const spread = storyMaxSpread * (1 - closing);
      panelA.style.setProperty('--sp', spread.toFixed(1));
      panelB.style.setProperty('--sp', spread.toFixed(1));

      /* The swap takes 38% of the section rather than 20%, and is eased at
         both ends. It still finishes before the pair fully overlap — two
         portraits stacked on each other is the one frame of this that looks
         like a mistake. */
      const merge = ease(clamp01((p - 0.40) / 0.38));   // merged by 0.78

      if (panelTogether){
        panelTogether.style.setProperty('--tg-op', merge.toFixed(3));
        // Settles into place rather than simply appearing.
        panelTogether.style.setProperty('--tg-scale', (0.955 + merge * 0.045).toFixed(4));
      }
      panelA.style.setProperty('--ab-op', (1 - merge).toFixed(3));
      panelB.style.setProperty('--ab-op', (1 - merge).toFixed(3));
      // The pair recede very slightly as they hand over.
      const pairScale = (1 - merge * 0.03).toFixed(4);
      panelA.style.setProperty('--ab-scale', pairScale);
      panelB.style.setProperty('--ab-scale', pairScale);

      // Text takes the last stretch, once the merge has settled.
      storyCenter.style.setProperty('--sc-op', ease(clamp01((p - 0.80) / 0.15)).toFixed(3));
    }

    // DATE reflection sharpens near viewport center
    if (dateSection){
      const r = dateSection.getBoundingClientRect();
      const centerDist = Math.abs((r.top + r.height/2) - window.innerHeight/2);
      const t = clamp01(1 - centerDist / (window.innerHeight * 0.7));
      dateReflection.style.setProperty('--refl-op', (0.06 + t * 0.26).toFixed(3));

      /* The countdown lives below the mirror line, so it is part of the same
         reflection and focuses on the same curve — the whole reflected world
         resolves together as the section reaches the middle of the screen.
         It only ever dims to 0.52, never to the gleam's 0.06: the gleam is
         decoration and may vanish, but these numbers have to stay readable.
         The CSS fallback is the bright end, so if this loop never runs the
         countdown is fully legible rather than stuck faint. */
      dateSection.style.setProperty('--refl-t', t.toFixed(3));
    }

    // GALLERY — walk down the mirror hall
    if (gallerySection && !reduceMotion){
      const viewW = window.innerWidth;
      let translate;
      if (phone.matches){
        // The track scrolls itself; read where the guest's finger left it.
        translate = galleryTrackEl.scrollLeft;
        const max = galleryTrackEl.scrollWidth - galleryTrackEl.clientWidth;
        galleryTrackEl.style.transform = '';
        galleryProgressBar.style.width = (max > 0 ? translate / max * 100 : 0) + '%';
      } else {
        const p = progressOf(gallerySection);
        const maxTranslate = Math.max(0, galleryTrackWidth - viewW + viewW * 0.08);
        translate = p * maxTranslate;
        galleryTrackEl.style.transform = `translateX(-${translate}px)`;
        galleryProgressBar.style.width = (p * 100) + '%';
      }

      /* Each mirror turns to face the centre of the corridor and shrinks with
         distance, so the row reads as a receding hall rather than a filmstrip.
         Derived from the cached centres — no layout reads in here. */
      const viewCentre = viewW / 2;
      const maxTurn = viewW < 780 ? 11 : 17;   // matches the shallower phone perspective
      for (let i = 0; i < galleryMetrics.length; i++){
        const m = galleryMetrics[i];
        const offset = (m.centre - translate - viewCentre) / viewCentre; // -1 … 1
        const d = Math.max(-1.6, Math.min(1.6, offset));
        const turn = (-d * maxTurn).toFixed(2);
        const scale = (1 - Math.abs(d) * 0.07).toFixed(3);
        const lift = (Math.abs(d) * 1.6).toFixed(2);
        m.el.style.transform =
          `rotateY(${turn}deg) scale(${scale}) translateY(${lift}%)`;
        m.el.style.opacity = (1 - Math.abs(d) * 0.28).toFixed(3);
      }
    }

    // TWO BECOME ONE
    if (tboScroll){
      const p = stageOf(tboScroll, 3800);
      // phase 1 (0-0.55): lights converge
      const conv = clamp01(p / 0.55);
      const startOffset = 42; // vw-ish via %
      const pos = startOffset * (1 - conv);
      tboLeft.style.left = pos + '%';
      tboRight.style.right = pos + '%';
      // phase 2 (0.5-0.65): flash + line
      const flashT = clamp01((p - 0.5) / 0.15);
      tboFlash.style.opacity = (flashT < 1 ? flashT * 0.8 : Math.max(0, 0.8 - (p-0.65)*4)).toString();
      tboLine.style.height = (clamp01((p-0.45)/0.2) * 40) + 'vh';
      // phase 3 (0.6-1): names appear
      const nameT = clamp01((p - 0.62) / 0.3);
      tboNames.style.opacity = nameT.toString();
      tboLabel.style.opacity = clamp01((p - 0.8) / 0.2).toString();
    }

    requestAnimationFrame(updateScroll);
  }
  requestAnimationFrame(updateScroll);

  /* The cached frame positions are in layout pixels, so they go stale on
     resize and on phone orientation changes. Debounced — resize fires in
     bursts, and re-measuring reads layout. */
  let galleryResizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(galleryResizeTimer);
    galleryResizeTimer = setTimeout(() => { measureGallery(); measureStory(); }, 150);
  });

  /* The header gets its backing once the opening photograph has gone by. */
  const heroEl = document.getElementById('hero');
  function backNav(){
    const past = heroEl ? heroEl.getBoundingClientRect().bottom < 90 : window.scrollY > 300;
    body.classList.toggle('nav-backed', past);
  }
  window.addEventListener('scroll', backNav, { passive:true });
  backNav();

  /* ---------------- CURSOR LIGHT ---------------- */
  if (!isTouch && !reduceMotion){
    const cursorLight = document.getElementById('cursorLight');
    let cx = 0, cy = 0, active = false;
    window.addEventListener('mousemove', (e) => {
      cx = e.clientX; cy = e.clientY;
      cursorLight.style.transform = `translate(${cx}px, ${cy}px) translate(-50%,-50%)`;
      if (!active){ active = true; cursorLight.style.opacity = '1'; }
    });
    window.addEventListener('mouseleave', () => { cursorLight.style.opacity = '0'; active = false; });
  }

  /* ---------------- CLOSING ---------------- */
  const closing = document.getElementById('closing');
  const closingIO = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting){ closing.classList.add('expand'); } });
  }, { threshold: 0.4 });
  closingIO.observe(closing);

  /* Replays this design's opening. The builder bar's "Replay Opening" button
     calls the core's resetEnvelopeIntro(), so that name is pointed here too —
     this design has no envelope, and the core only ever calls it by name. */
  function replayOpening(){
    storeRemove('sessionStorage', 'mirrorPalaceVisited');
    played.clear();
    window.scrollTo({ top: 0, behavior: 'auto' });
    intro.classList.remove('done','glow','expand','lights','sync','names','subtitle','split');
    body.classList.remove('intro-complete');

    // The RSVP form belongs to the core now; put it back to its unsent state.
    const form = document.getElementById('rsvp-form');
    const success = document.getElementById('rsvp-success');
    if (form) form.classList.remove('hidden');
    if (success) success.classList.add('hidden');

    if (!reduceMotion) runIntro(); else finishIntro();
  }
  document.getElementById('replayBtn').addEventListener('click', replayOpening);
  window.resetEnvelopeIntro = replayOpening;

  /* ---------------- BUILDER BAR / NAV OFFSET ----------------
     The core's syncFixedBarOffsets() looks for a <header> and, finding one,
     also pads <main> down by ~128px. This design has no header — the nav
     floats over a full-bleed hero on purpose — and that padding would shove
     the hero down the page. So the core bails out on its own (no <header>)
     and the nav is offset here instead, which moves nothing else. */
  const builderBar = document.getElementById('builder-bar');
  const siteNav = document.querySelector('.site-nav');

  if (builderBar && siteNav){
    const syncNavTop = () => {
      const hidden = document.body.classList.contains('guest-mode')
        || getComputedStyle(builderBar).display === 'none';
      const h = hidden ? 0 : builderBar.offsetHeight;
      siteNav.style.top = h + 'px';
      // Published so anything else pinned to the top can clear the bar too —
      // the menu's close button sits up there and was landing behind it.
      document.documentElement.style.setProperty('--mp-bar-h', h + 'px');
    };
    syncNavTop();

    // The bar's buttons wrap onto extra rows on narrow screens, so its height
    // is not a constant — watch it rather than measuring once.
    if ('ResizeObserver' in window) new ResizeObserver(syncNavTop).observe(builderBar);
    window.addEventListener('resize', syncNavTop);

    // Guest preview hides the bar; the nav should close the gap with it.
    new MutationObserver(syncNavTop).observe(document.body, {
      attributes: true, attributeFilter: ['class']
    });
  }

  /* ---------------- THIS DESIGN'S OWN FIELDS ----------------
     The core renders the invitation through data-field attributes. This
     design's markup predates that and uses data-sync plus a set of ids, and
     it carries wording the core has no concept of — the hero eyebrow, the
     ceremony lines, the Two Become One label. None of it would ever update.

     So the core's renderer is wrapped rather than replaced: it runs first and
     does everything it knows about, then this fills in the rest. */

  /* ---------------- STORY PHOTO UPLOADS ----------------
     The core's uploader is hard-wired to the hero photo, so these three run
     through the same processImageFile() it uses — that is where the resizing,
     the HEIC handling and the EXIF-orientation fix live, and a second copy of
     that would rot the moment the core's is fixed. */
  const MP_PHOTO_TARGETS = {
    heroPhoto:          'heroImg',
    storyPhotoOne:      'panelAImg',
    storyPhotoTwo:      'panelBImg',
    storyPhotoTogether: 'panelTogetherImg'
  };

  function mpPhotoStatus(msg){
    const el = document.getElementById('mp-photo-status');
    if (el) el.textContent = msg || '';
  }

  function applyDesignPhotos(){
    Object.keys(MP_PHOTO_TARGETS).forEach(key => {
      const value = invitationData[key];
      if (!value) return;

      /* Compare against the last value applied, NOT against the live src:
         photoFallback rewrites src to the plate (and then to the card) when a
         file is missing, so testing src would see a difference every time and
         reset the image on every render — which re-runs the fallback, which
         rewrites src again. */
      const img = document.getElementById(MP_PHOTO_TARGETS[key]);
      if (img && img.dataset.mpApplied !== value){
        img.dataset.mpApplied = value;
        // Clear the fallback bookkeeping, or a slot that failed once would
        // refuse to try the newly chosen file.
        delete img.dataset.triedPlate;
        delete img.dataset.placeholder;
        img.onerror = function(){ window.photoFallback(img); };
        img.src = value;
      }

      const thumb = document.getElementById('mp-thumb-' + key);
      if (thumb && thumb.dataset.mpApplied !== value){
        thumb.dataset.mpApplied = value;
        delete thumb.dataset.triedPlate;
        delete thumb.dataset.placeholder;
        thumb.onerror = function(){ window.photoFallback(thumb); };
        thumb.src = value;
      }
    });
  }

  document.addEventListener('change', (e) => {
    const input = e.target.closest('input[type="file"][data-mp-photo]');
    if (!input || !input.files || !input.files[0]) return;

    const key = input.getAttribute('data-mp-photo');
    if (typeof processImageFile !== 'function'){
      mpPhotoStatus('Could not read that image.');
      return;
    }

    processImageFile(input.files[0], mpPhotoStatus, (dataUrl) => {
      invitationData[key] = dataUrl;
      applyDesignPhotos();

      /* The main photo is also the core's heroPhoto, and the core keeps its
         own preview of it on the Love Story tab. Without this the two
         uploaders show different pictures for the same field. */
      if (key === 'heroPhoto'){
        const hidden = document.getElementById('cfg-hero-photo');
        if (hidden) hidden.value = dataUrl;
        if (typeof syncHeroPhotoPreview === 'function') syncHeroPhotoPreview(dataUrl);
      }

      mpPhotoStatus('Photo updated.');
      input.value = '';            // so the same file can be chosen again
    });
  });

  /* heroQuote is deliberately NOT in this list. It is two lines separated by
     a <br>, and it gets its own handling below that preserves the break;
     this loop assigns textContent, which would flatten it. Today the entry
     was harmless only because no element carries id="heroQuote" — the moment
     one did, the break would silently disappear. */
  const MP_FIELDS = [
    'heroEyebrow','storyEyebrow','storyTitle',
    'celebrationPlace','celebrationAddress',
    'rsvpKicker','rsvpEmailText','tboLabelText','closingMsg',
    'heroCity','dateEyebrow','dateCaptionText','countdownEyebrow',
    'cdDaysLabel','cdHoursLabel','cdMinutesLabel','cdSecondsLabel',
    'ceremonyEyebrow','detailBtnLabel','celebrationEyebrow',
    'scheduleEyebrow','scheduleTitle','galleryEyebrow',
    'rsvpTitle','rsvpDeadlinePrefix','rsvpNameLabel','rsvpAttendanceLabel',
    'rsvpYesLabel','rsvpNoLabel','rsvpGuestsLabel','rsvpPlusOneLabel',
    'rsvpNotesLabel','rsvpSubmitLabel','rsvpErrorText',
    'faqEyebrow','faqTitle','replayBtnLabel'
    /* siteUrl / shareTitleSuffix / shareDescription are deliberately absent:
       they drive <meta> tags, not page elements, so renderShareMeta owns
       them. syncDesignInputs still fills their inputs from data-mp-field. */
  ];

  function pad2(n){ return String(n).padStart(2, '0'); }

  /* "2027-08-24" -> "24 · 08 · 2027", the form this design shows it in.
     Split manually rather than via new Date(), which reads a bare
     yyyy-mm-dd as UTC and can show the previous day west of Greenwich. */
  function mpFormatDate(iso){
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return iso || '';
    return pad2(parts[2]) + ' · ' + pad2(parts[1]) + ' · ' + parts[0];
  }

  function renderDesignFields(){
    if (typeof invitationData !== 'object') return;

    const p1 = invitationData.partner1 || '';
    const p2 = invitationData.partner2 || '';

    document.querySelectorAll('[data-sync="personOne"]').forEach(el => { el.textContent = p1; });
    document.querySelectorAll('[data-sync="personTwo"]').forEach(el => { el.textContent = p2; });
    /* The mirror line: the weekday and the hour, e.g. "Saturday · 16:00".
       The weekday comes from the date parts, never from new Date(iso),
       which reads a bare date as UTC. */
    const when = document.getElementById('mirrorWhen');
    if (when){
      const dp = String(invitationData.date || '').split('-');
      const day = dp.length === 3 ? new Date(+dp[0], +dp[1] - 1, +dp[2]) : null;
      const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      when.textContent = [day && !isNaN(day) ? DAYS[day.getDay()] : '', invitationData.time || '']
        .filter(Boolean).join(' \u00b7 ');
    }
    document.querySelectorAll('[data-sync="date"]').forEach(el => {
      el.textContent = mpFormatDate(invitationData.date);
    });
    document.querySelectorAll('[data-initial="one"]').forEach(el => { el.textContent = (p1[0] || '').toUpperCase(); });
    document.querySelectorAll('[data-initial="two"]').forEach(el => { el.textContent = (p2[0] || '').toUpperCase(); });

    MP_FIELDS.forEach(key => {
      const el = document.getElementById(key);
      if (el && invitationData[key] != null) el.textContent = invitationData[key];
    });

    // The hero quote is two lines; keep the break rather than collapsing it.
    const quote = document.getElementById('heroStatement');
    // LUMA: no line of their own means no line, not the sample's motto
    if (quote){
      quote.innerHTML = '';
      quote.hidden = !String(invitationData.heroQuote || '').trim();
      String(invitationData.heroQuote || '').split('\n').forEach((line, i, arr) => {
        quote.appendChild(document.createTextNode(line));
        if (i < arr.length - 1) quote.appendChild(document.createElement('br'));
      });
    }

    // The deadline sits inside a sentence, so it has its own span.
    const deadline = document.getElementById('rsvpDeadlineText');
    if (deadline && invitationData.rsvpDeadline) deadline.textContent = invitationData.rsvpDeadline;

    // The hero photo is uploaded through the core, which stores it as heroPhoto.
    const heroImg = document.getElementById('heroImg');
    if (heroImg && invitationData.heroPhoto) heroImg.src = invitationData.heroPhoto;

    applyDesignPhotos();

    document.title = p1 + " & " + p2 + " — The Mirror Palace";
  }

  /* Captions live on the same gallery objects the core owns, so they survive
     reordering, share links and downloads. Rebuilt whenever photos change. */
  function renderCaptionEditor(){
    const wrap = document.getElementById('mp-caption-list');
    if (!wrap) return;
    const photos = invitationData.gallery || [];

    if (!photos.length){
      wrap.innerHTML = '<p class="text-[11px] text-warmgray">No photos yet.</p>';
      return;
    }

    wrap.innerHTML = '';
    photos.forEach((item, idx) => {
      const row = document.createElement('div');

      const label = document.createElement('label');
      label.className = 'block text-[11px] font-semibold uppercase tracking-wider text-warmgray mb-1';
      label.textContent = 'Photo ' + (idx + 1);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'w-full p-2.5 rounded-lg border border-gold/30 bg-cream/50 font-sans text-xs';
      input.value = item.caption || '';
      input.placeholder = 'Optional';
      input.addEventListener('input', () => {
        item.caption = input.value;
        buildGallery();
      });

      row.appendChild(label);
      row.appendChild(input);
      wrap.appendChild(row);
    });
  }

  function syncDesignInputs(){
    document.querySelectorAll('[data-mp-field]').forEach(el => {
      const key = el.getAttribute('data-mp-field');
      if (invitationData[key] != null) el.value = invitationData[key];
    });
    renderCaptionEditor();
  }

  // One delegated listener, so it also catches the caption rows built later.
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-mp-field]');
    if (!el) return;
    invitationData[el.getAttribute('data-mp-field')] = el.value;
    renderDesignFields();
  });

  /* Wrap, don't replace: the core still does all its own work. */
  const coreRenderInvitation = window.renderInvitationFromData;
  window.renderInvitationFromData = function(){
    if (typeof coreRenderInvitation === 'function') coreRenderInvitation.apply(this, arguments);
    renderDesignFields();
    renderCaptionEditor();
  };

  const coreSyncInputs = window.syncDataToInputs;
  window.syncDataToInputs = function(){
    if (typeof coreSyncInputs === 'function') coreSyncInputs.apply(this, arguments);
    syncDesignInputs();
  };

  // The core already ran both by the time this file loads, so catch up once.
  renderDesignFields();
  syncDesignInputs();

  /* The core builds the drawer's photo tiles without an onerror, so a missing
     file would leave a blank box that reads as a broken builder. Sweep after
     each rebuild so those tiles get the same placeholder as the invitation. */
  const coreRenderGalleryDrawer = window.renderGalleryDrawer;
  if (typeof coreRenderGalleryDrawer === 'function'){
    window.renderGalleryDrawer = function(){
      coreRenderGalleryDrawer.apply(this, arguments);
      sweepBrokenPhotos();
      renderCaptionEditor();
    };
  }

  /* ---------------- RSVP REVEAL ----------------
     This section is a pale panel behind two ink doors that slide apart as it
     comes into view. Everything inside it — the field underlines, the radio
     labels, the submit button — is coloured var(--ink) because it is drawn
     against ivory, not against the dark page.

     Without the class that opens those doors the panel stays covered and the
     whole form renders near-black on near-black: labels visible, answers not.
     The trigger used to live in this design's own submit handler, which the
     shared core replaced, so it is kept here on its own. */
  const rsvpSection = document.getElementById('rsvp');
  if (rsvpSection){
    if (reduceMotion){
      rsvpSection.classList.add('opened');       // no animation, just readable
    } else {
      const rsvpIO = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting){
            rsvpSection.classList.add('opened');
            rsvpIO.unobserve(e.target);
          }
        });
      }, { threshold: 0.25 });
      rsvpIO.observe(rsvpSection);
    }
  }

  /* The core reveals the confirmation by removing .hidden. This design fades
     it in and runs the two dots together on .show, so the two are bridged
     rather than duplicating five keyframed rules in the stylesheet. */
  const rsvpSuccess = document.getElementById('rsvp-success');
  if (rsvpSuccess){
    const syncSuccess = () => {
      rsvpSuccess.classList.toggle('show', !rsvpSuccess.classList.contains('hidden'));
    };
    syncSuccess();
    new MutationObserver(syncSuccess).observe(rsvpSuccess, {
      attributes: true, attributeFilter: ['class']
    });
  }

  /* ---------------- MENU ----------------
     Built from the sections that are actually present and visible, so an
     emptied gallery or FAQ drops out of the list rather than offering a link
     to a hidden section. */
  const MENU_SECTIONS = [
    ['story',          'Our Story'],
    ['date-section',   'The Day'],
    ['ceremony',       'Ceremony'],
    ['celebration',    'The Celebration'],
    ['schedule',       'The Evening'],
    ['gallery-stage',  'The Gallery'],
    ['rsvp',           'RSVP'],
    ['faq-section',    'Questions']
  ];

  const menuOverlay = document.getElementById('menuOverlay');
  const menuBtn     = document.getElementById('navMenuBtn');
  const menuLinks   = document.getElementById('menuLinks');
  const menuClose   = document.getElementById('menuClose');

  /* Shared by the menu and by the builder drawer. The nav is fixed, so a
     plain anchor jump buries the top of the section underneath it. */
  function scrollToSection(id, opts){
    const el = document.getElementById(id);
    if (!el) return false;
    const nav = document.querySelector('.site-nav');
    const bar = document.getElementById('builder-bar');
    const guest = document.body.classList.contains('guest-mode');
    let offset = (nav ? nav.offsetHeight : 0);
    if (bar && !guest && getComputedStyle(bar).display !== 'none') offset += bar.offsetHeight;

    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset - 8);

    if ((opts && opts.instant) || reduceMotion){
      window.scrollTo({ top: top, behavior: 'auto' });
      return true;
    }

    /* This page is ~19,000px tall. Smooth-scrolling its full length takes
       about a second and a half and flings the reader through every section
       on the way, so long trips cannot simply glide.

       The obvious rule — glide when near, jump when far — is what this used
       to do, and it read as broken: the same click behaved differently
       depending on where you happened to be, with no way to predict which
       you would get.

       So every trip now ENDS the same way. A long one cuts instantly to a
       point just short of the target and glides the last stretch; a short
       one simply glides. The arrival is identical either way, which is the
       part the eye actually judges, and no trip ever takes longer than that
       final glide. Staging happens on the near side, so the closing movement
       always travels in the direction you asked for. */
    const dist = Math.abs(top - window.scrollY);
    const glide = Math.min(window.innerHeight * 0.85, 620);

    if (dist > glide * 1.6){
      const stageDir = top > window.scrollY ? -1 : 1;   // land short of it
      window.scrollTo({ top: Math.max(0, top + stageDir * glide), behavior: 'auto' });
      /* The cut has to be painted before the glide is asked for, or the
         browser coalesces the two and animates the whole distance anyway. */
      requestAnimationFrame(() => {
        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    } else {
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
    return true;
  }

  function buildMenuLinks(){
    if (!menuLinks) return;
    menuLinks.innerHTML = '';
    MENU_SECTIONS.forEach(([id, label], i) => {
      const el = document.getElementById(id);
      if (!el || getComputedStyle(el).display === 'none') return;

      const a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = label;
      // Staggered entrance, in source order.
      a.style.transitionDelay = (60 + i * 45) + 'ms';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        // Let the overlay clear before moving, or the scroll is invisible.
        setTimeout(() => scrollToSection(id), reduceMotion ? 0 : 260);
      });
      menuLinks.appendChild(a);
    });
  }

  let menuLastFocus = null;

  function openMenu(){
    if (!menuOverlay) return;
    buildMenuLinks();                 // rebuild each time, sections can change
    menuLastFocus = document.activeElement;
    menuOverlay.hidden = false;
    // A frame between unhide and the class, or the transition never runs.
    requestAnimationFrame(() => menuOverlay.classList.add('open'));
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (menuClose) menuClose.focus();
  }

  function closeMenu(){
    if (!menuOverlay || menuOverlay.hidden) return;
    menuOverlay.classList.remove('open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    const finish = () => { menuOverlay.hidden = true; };
    if (reduceMotion) finish(); else setTimeout(finish, 520);
    if (menuLastFocus && menuLastFocus.focus) menuLastFocus.focus();
  }

  if (menuBtn)   menuBtn.addEventListener('click', openMenu);
  if (menuClose) menuClose.addEventListener('click', closeMenu);
  if (menuOverlay){
    // Clicking the ground closes; clicking a link is handled above.
    menuOverlay.addEventListener('click', (e) => { if (e.target === menuOverlay) closeMenu(); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOverlay && !menuOverlay.hidden) closeMenu();
  });

  /* ---------------- DRAWER TABS FOLLOW THE PAGE ----------------
     Opening a tab now scrolls the invitation to whatever that tab edits, so
     the couple can see the thing they are about to change. The drawer narrows
     the page rather than covering it above 1100px, which is what makes this
     worth doing at all. */
  const TAB_SECTIONS = {
    'The Couple':       'hero',
    'Your Story':       'story',
    'The Day':          'date-section',
    'The Events':       'ceremony',
    'Photographs':      'gallery-stage',
    'RSVP':             'rsvp',
    'Questions':        'faq-section',
    'Finale & Music':   'tbo-stage'

  };

  function bindDrawerTabScrolling(){
    document.querySelectorAll('#customizer-drawer .drawer-tab').forEach(tab => {
      if (tab.dataset.mpScrollBound === 'true') return;
      tab.dataset.mpScrollBound = 'true';
      const target = TAB_SECTIONS[tab.title];
      if (!target) return;
      tab.addEventListener('click', () => scrollToSection(target));
    });
  }

  /* The core builds the tab bar lazily, on the drawer's first open, so the
     binding waits for the tabs to exist rather than running once at load. */
  const coreToggleDrawer = window.toggleCustomizerDrawer;
  if (typeof coreToggleDrawer === 'function'){
    window.toggleCustomizerDrawer = function(){
      coreToggleDrawer.apply(this, arguments);
      bindDrawerTabScrolling();
    };
  }
  bindDrawerTabScrolling();

  /* ---------------- DRAWER FIELD NAMES ----------------
     The core builds the schedule, gallery and FAQ rows, and its inputs sit
     beside a caption ("Time", "Event Name", "Venue") that is a plain <div>,
     not a <label for>. Sighted couples see the caption; a screen reader
     announces 28 anonymous text boxes in a row.

     The caption is already in the markup, so this borrows it rather than
     inventing wording that could drift from what is on screen. Only rows
     holding exactly one control are used — anything else risks gluing two
     captions together and naming the field something that reads as nonsense.

     It runs off a MutationObserver because those rows are rebuilt from
     scratch on every add, remove and edit; binding once at load would cover
     only the rows that happened to exist then. The observer watches childList
     only, so writing aria-label here cannot retrigger it. */
  function labelDrawerControls(){
    const root = document.getElementById('customizer-drawer');
    if (!root) return;

    root.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'hidden') return;
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
      if (el.labels && el.labels.length) return;

      const row = el.closest('div');
      let text = '';
      if (row && row.querySelectorAll('input, select, textarea').length === 1){
        text = (row.textContent || '').trim();
      }
      if (!text) text = el.getAttribute('placeholder') || '';
      if (text) el.setAttribute('aria-label', text.replace(/\s+/g, ' ').slice(0, 60));
    });
  }

  const drawerForLabels = document.getElementById('customizer-drawer');
  if (drawerForLabels && window.MutationObserver){
    let labelQueued = false;
    new MutationObserver(() => {
      if (labelQueued) return;
      labelQueued = true;
      requestAnimationFrame(() => { labelQueued = false; labelDrawerControls(); });
    }).observe(drawerForLabels, { childList: true, subtree: true });
  }
  labelDrawerControls();

  /* ---------------- STUDIO BAR LABELS ----------------
     "Export Read-Only File" across a quarter of a 375px screen is what forced
     the bar into a 2x2 grid of boxes. The short forms let all four sit in one
     hairline-divided row; CSS swaps them in below 560px and the full wording
     stays everywhere else. */
  const BAR_SHORT = {
    'Preview Guest View':    'Preview',
    'Customize Details':     'Edit',
    'Replay Opening':        'Replay',
    'Export Read-Only File': 'Export'
  };
  document.querySelectorAll('#builder-bar button').forEach(btn => {
    const span = btn.querySelector('span');
    if (!span) return;
    const short = BAR_SHORT[span.textContent.trim()];
    if (!short) return;
    span.dataset.short = short;
    if (short === 'Edit') btn.setAttribute('data-primary', '');
  });

  /* ---------------- GUEST PREVIEW ----------------
     The core enters preview by calling resetEnvelopeIntroInstant(), which for
     an envelope design means "put it back in its envelope without animating".
     This design's equivalent is the opening sequence, and preview is exactly
     when the couple wants to watch it — so it replays rather than skips.

     Every piece of builder chrome is hidden by CSS while guest-mode is on.
     That leaves no way back on a phone, where there is no Escape key, so the
     exit control fades in on the first movement and fades out after a pause. */
  window.resetEnvelopeIntroInstant = function(){
    storeRemove('sessionStorage', 'mirrorPalaceVisited');
    if (reduceMotion) { finishIntro(); return; }
    intro.classList.remove('done','glow','expand','lights','sync','names','subtitle','split');
    body.classList.remove('intro-complete');
    runIntro();
  };

  let exitHintTimer = null;
  function showExitHint(){
    if (!document.body.classList.contains('guest-mode')) return;
    document.body.classList.add('show-exit-hint');
    clearTimeout(exitHintTimer);
    exitHintTimer = setTimeout(() => {
      document.body.classList.remove('show-exit-hint');
    }, 3200);
  }

  ['mousemove', 'touchstart', 'keydown', 'scroll'].forEach(evt => {
    window.addEventListener(evt, showExitHint, { passive: true });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // The menu owns Escape while it is open.
    const menu = document.getElementById('menuOverlay');
    if (menu && !menu.hidden) return;
    if (document.body.classList.contains('guest-mode') && typeof toggleGuestPreview === 'function'){
      toggleGuestPreview();
    }
  });

  /* Leaving preview should put the builder back as it was, not drop the
     couple wherever the guest view happened to be scrolled to. */
  const coreEnableGuestMode = window.enableGuestMode;
  if (typeof coreEnableGuestMode === 'function'){
    window.enableGuestMode = function(activate){
      coreEnableGuestMode.apply(this, arguments);
      if (activate){
        /* Show the way out once on entry, then let it fade. Otherwise the
           couple is dropped into a preview with no visible exit and has to
           guess. It currently happens by accident anyway — the core scrolls
           to the top on entry and that fires the scroll listener — but
           relying on that side effect would break the moment it changes. */
        showExitHint();
      } else {
        document.body.classList.remove('show-exit-hint');
        clearTimeout(exitHintTimer);
      }
    };
  }

  /* Esc is worth advertising on a device that has the key. */
  const exitBtn = document.getElementById('exit-preview-btn');
  if (exitBtn && !isTouch) exitBtn.textContent = 'Exit preview · Esc';

  /* ---------------- MUSIC ----------------
     This design has its own music, in assets/music/ rather than the shared
     assets/audio/. The sync script mirrors assets\audio into every design;
     assets/music sits outside that, so a core sync cannot overwrite or
     re-add tracks here.

     The core reads its track table through resolveTrack(), which is a plain
     function declaration in global scope — so pointing it at this table is
     enough, and the shared file stays untouched. */
  const MP_TRACKS = {
    aria: {
      label: 'Bach — Aria, Goldberg Variations',
      url:   'assets/music/aria.mp3'
    },
    'prelude-ebm': {
      label: 'Bach — Prelude in E-flat minor, BWV 853',
      url:   'assets/music/prelude-ebm.mp3'
    },
    'prelude-csm': {
      label: 'Bach — Prelude in C-sharp minor, BWV 849',
      url:   'assets/music/prelude-csm.mp3'
    }
  };

  window.resolveTrack = function(key){
    // LUMA: the couple's own uploaded song, registered by the core as "couple"
    if (key === 'couple' && typeof MUSIC_TRACKS !== 'undefined' && MUSIC_TRACKS.couple) return MUSIC_TRACKS.couple;
    return MP_TRACKS[key] || MP_TRACKS.aria;
  };

  /* ---------------- SAMPLE-CONTENT MARKERS ----------------
     "Villa Cora", "Viale Machiavelli 18", "1st June 2027" all look filled
     in. Nothing distinguishes wording the couple wrote from wording that
     shipped with the template, so it is entirely possible to send a real
     invitation carrying a sample address.

     MP_SHIPPED is captured before the draft is restored, so it is always the
     template's own text and never a previous session's edits. */
  const MP_CORE_FIELD_KEYS = {
    'cfg-partner1':      'partner1',
    'cfg-partner2':      'partner2',
    'cfg-hashtag':       'hashtag',
    'cfg-date':          'date',
    'cfg-time':          'time',
    'cfg-venue-name':    'venueName',
    'cfg-venue-address': 'venueAddress',
    'cfg-dresscode':     'dressCode',
    'cfg-dresscode-note':'dressCodeNote',
    'cfg-rsvp-deadline': 'rsvpDeadline',
    'cfg-story-1':       'story1',
    'cfg-story-2':       'story2'
  };

  function mpFieldKey(el){
    const mp = el.getAttribute('data-mp-field');
    if (mp) return mp;
    return MP_CORE_FIELD_KEYS[el.id] || null;
  }

  function refreshSampleMarkers(){
    const drawer = document.getElementById('customizer-drawer');
    if (!drawer) return;

    let untouched = 0;
    drawer.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(el => {
      const key = mpFieldKey(el);
      if (!key) return;
      const shipped = MP_SHIPPED[key];
      if (typeof shipped !== 'string') return;

      const isSample = el.value.trim() === shipped.trim();
      el.classList.toggle('is-sample', isSample);
      const field = el.closest('.ed-field');
      if (field) field.classList.toggle('is-sample', isSample);
      if (isSample) untouched++;
    });

    const el = document.getElementById('mp-sample-count');
    if (!el) return;
    if (untouched === 0){
      el.textContent = 'Every field has been edited.';
      el.classList.remove('has-samples');
    } else {
      el.textContent = untouched === 1
        ? '1 field still shows the sample wording'
        : untouched + ' fields still show the sample wording';
      el.classList.add('has-samples');
    }
  }

  let sampleTimer = null;
  function queueSampleRefresh(){
    clearTimeout(sampleTimer);
    sampleTimer = setTimeout(refreshSampleMarkers, 250);
  }
  document.addEventListener('input', queueSampleRefresh);
  document.addEventListener('change', queueSampleRefresh);

  /* ---------------- PEEK ----------------
     Below 1100px the drawer covers the invitation rather than narrowing it,
     so on a phone there is no way to see an edit land. This drops the drawer
     out of the way, leaving a handle to bring it back. Deliberate rather
     than automatic — a panel that slides about on its own while you type is
     worse than not being able to see. */
  function mpTogglePeek(force){
    const on = typeof force === 'boolean' ? force : !document.body.classList.contains('mp-peeking');
    document.body.classList.toggle('mp-peeking', on);
    const btn = document.getElementById('mp-peek-btn');
    if (btn) btn.setAttribute('aria-pressed', String(on));
  }
  window.mpTogglePeek = mpTogglePeek;

  // Closing the drawer must not leave the page stuck in peek.
  const coreToggleForPeek = window.toggleCustomizerDrawer;
  if (typeof coreToggleForPeek === 'function'){
    window.toggleCustomizerDrawer = function(){
      coreToggleForPeek.apply(this, arguments);
      mpTogglePeek(false);
      refreshSampleMarkers();
    };
  }

  refreshSampleMarkers();

  /* ---------------- CEREMONY VENUE ----------------
     The ceremony panel used to carry its own time, venue and address, which
     restated what the timeline and the calendar fields already said — in a
     different format, and separately editable, so the three could drift
     apart. A couple moving the ceremony to 4:30 would have had to remember
     three places.

     Now the panel is the WHERE and the timeline is the WHEN. The venue name
     and address come from venueName / venueAddress, the same pair that
     builds the .ics file and the Google Calendar link, so the invitation
     cannot contradict what a guest puts in their diary. */
  function renderCeremonyVenue(){
    const name = (invitationData.venueName || '').trim();
    const addr = (invitationData.venueAddress || '').trim();

    const nameEl = document.getElementById('ceremonyVenueName');
    const addrEl = document.getElementById('ceremonyVenueAddress');
    if (nameEl) nameEl.textContent = name;
    if (addrEl) addrEl.textContent = addr;

    /* A maps search on the written address rather than coordinates: the
       couple types a human address, and this has to work for a villa in
       Tuscany as readily as a postcode in Kent. */
    const link = document.getElementById('ceremonyDirections');
    if (!link) return;
    const query = [name, addr].filter(Boolean).join(', ');
    if (query){
      link.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
      link.style.display = '';
    } else {
      // Nothing to point at — a dead link is worse than no link.
      link.removeAttribute('href');
      link.style.display = 'none';
    }
  }

  const coreRenderForVenue = window.renderInvitationFromData;
  if (typeof coreRenderForVenue === 'function'){
    window.renderInvitationFromData = function(){
      coreRenderForVenue.apply(this, arguments);
      renderCeremonyVenue();
    };
  }
  renderCeremonyVenue();


  /* ---------------- THE EVENING, SET AS A PROGRAMME ----------------
     The core renders an alternating timeline: a centre thread, circular
     Font Awesome icons, rows pushed left and right. It is the default
     wedding-timeline pattern and it reads as generic next to the rest of
     this design — the icons especially.

     Bodoni is a Didone, a typeface cut for playbills and opera programmes.
     So the evening is set as one: centred, numbered by act, hairline rules
     between entries. Symmetry rather than a literal reflection — the one
     mirror gesture the page had not already spent on the names and the date.

     Overriding by name works because the core is plain global scope. */
  function mpRoman(n){
    const map = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let out = '';
    for (let i = 0; i < map.length; i++){
      while (n >= map[i][0]){ out += map[i][1]; n -= map[i][0]; }
    }
    return out;
  }

  function renderProgramme(){
    const container = document.getElementById('schedule-timeline');
    if (!container) return;
    const items = (typeof invitationData === 'object' && invitationData.schedule) || [];

    /* An empty programme has to take its whole section with it. The core
       already does this for the gallery and the FAQ, but nothing did it for
       the schedule — so a couple who cleared the timeline was left with
       "The Evening / How the Day Unfolds" standing over nothing, and a menu
       entry pointing straight at the void. Restoring an item brings it back:
       this runs on every edit, so the section follows the data both ways.
       The menu skips sections computing to display:none, so hiding here
       removes the dead link without any menu-specific handling. */
    const section = document.getElementById('schedule');
    if (section) section.style.display = items.length ? '' : 'none';

    container.innerHTML = '';
    container.classList.add('programme');

    items.forEach((item, idx) => {
      const entry = document.createElement('div');
      entry.className = 'prog-entry';

      /* The act number sits in a gap in the rule, the way a programme marks
         one. The rule is drawn by CSS on either side of the numeral. */
      const rule = document.createElement('div');
      rule.className = 'prog-rule';
      const num = document.createElement('span');
      num.className = 'prog-num';
      num.textContent = mpRoman(idx + 1);
      rule.appendChild(num);

      const time = document.createElement('div');
      time.className = 'prog-time';
      time.textContent = item.time || '';

      const title = document.createElement('h3');
      title.className = 'prog-title';
      // Built as text nodes, not markup: these are user-typed and an
      // apostrophe in "Michael's Toast" must not become a parse problem.
      title.textContent = (typeof getScheduleTitle === 'function')
        ? getScheduleTitle(item)
        : (item.title || '');

      entry.appendChild(rule);
      entry.appendChild(time);
      entry.appendChild(title);

      if (item.venue){
        const venue = document.createElement('p');
        venue.className = 'prog-venue';
        venue.textContent = item.venue;
        entry.appendChild(venue);
      }

      container.appendChild(entry);
    });

    animateProgramme(container);
  }

  /* Each act typesets itself as it arrives: the numeral first, the rules
     drawing outward from it, then time, title and venue settling in turn.
     Slower than a plain fade because the page's own easing is slow — a
     quick fade-up here would read as a different design's animation. */
  let programmeFirstRender = true;
  let programmeIO = null;

  function animateProgramme(container){
    const entries = container.querySelectorAll('.prog-entry');

    if (reduceMotion){
      entries.forEach(el => el.classList.add('is-in', 'no-anim'));
      programmeFirstRender = false;
      return;
    }

    if (programmeIO) programmeIO.disconnect();
    programmeIO = new IntersectionObserver((obs) => {
      obs.forEach(o => {
        if (!o.isIntersecting) return;
        o.target.classList.add('is-in');
        programmeIO.unobserve(o.target);      // plays once, not on every pass
      });
    }, { threshold: 0.3, rootMargin: '0px 0px -6% 0px' });

    entries.forEach(el => {
      /* Re-rendering happens on every edit in the drawer. Anything already
         on screen should just be there — replaying the entrance each time a
         letter is typed would be maddening. */
      const r = el.getBoundingClientRect();
      const onScreen = r.top < window.innerHeight && r.bottom > 0;
      if (!programmeFirstRender && onScreen){
        el.classList.add('is-in', 'no-anim');
      } else {
        programmeIO.observe(el);
      }
    });

    programmeFirstRender = false;
  }

  window.renderScheduleTimeline = renderProgramme;
  renderProgramme();


  /* ---------------- PARTY SIZE CHIPS ----------------
     A native <select> is the most generic thing a form can contain, and on
     a phone it opens a full-screen wheel to choose a number between one and
     six. The chips are built from the select's own options so the range is
     defined in one place, and they drive it rather than replacing it — the
     core reads #rsvp-guest-count.value and the form posts it. */
  const countSelect = document.getElementById('rsvp-guest-count');
  const countChips  = document.getElementById('rsvpCountChips');

  if (countSelect && countChips){
    const paint = () => {
      countChips.querySelectorAll('button').forEach(b => {
        b.setAttribute('aria-checked', String(b.dataset.value === countSelect.value));
      });
    };

    Array.prototype.forEach.call(countSelect.options, (opt) => {
      const b = document.createElement('button');
      b.type = 'button';                       // never submits the form
      b.dataset.value = opt.value;
      b.textContent = opt.textContent;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', () => {
        countSelect.value = opt.value;
        paint();
        // The core hides the plus-one field below two, and clears it.
        if (typeof handleRsvpGuestCountChange === 'function') handleRsvpGuestCountChange();
      });
      countChips.appendChild(b);
    });

    paint();
    // Keeps the chips honest if anything else sets the select.
    countSelect.addEventListener('change', paint);
  }


  /* ---------------- LINK PREVIEW ----------------
     Every one of these tags shipped hardcoded: the couple's names, the date,
     and example.netlify.app. A bride who changed her name in the editor
     still had "Alexandra & Julian" and a dead image URL in the preview that
     WhatsApp shows — which, for an invitation whose entire delivery is a
     shared link, is the most visible thing that can be wrong.

     They are written from invitationData here. Social crawlers do not run
     JavaScript, so this alone would not help a deployed page — but the core
     exports by cloning the live DOM, so the standalone file the couple
     actually uploads carries the corrected tags as static markup. */
  function setMeta(selector, value){
    const el = document.head.querySelector(selector);
    if (el && value) el.setAttribute('content', value);
  }

  function renderShareMeta(){
    if (typeof invitationData !== 'object') return;
    const p1 = (invitationData.partner1 || '').trim();
    const p2 = (invitationData.partner2 || '').trim();
    const both = [p1, p2].filter(Boolean).join(' & ');
    if (!both) return;

    /* Long form for the sentence — "24 August 2027" rather than the
       24 · 08 · 2027 the page itself uses, because this is read as prose in
       a chat window. */
    let pretty = '';
    const parts = String(invitationData.date || '').split('-');
    if (parts.length === 3){
      const months = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
      const m = months[parseInt(parts[1], 10) - 1];
      if (m) pretty = parseInt(parts[2], 10) + ' ' + m + ' ' + parts[0];
    }

    const title = both + ' — ' + (invitationData.shareTitleSuffix || "You're Invited");
    const desc  = (pretty ? pretty + '. ' : '') +
                  (invitationData.shareDescription || 'Kindly RSVP.');

    setMeta('meta[property="og:site_name"]', both);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[property="og:description"]', desc);
    setMeta('meta[name="twitter:description"]', desc);
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:image:alt"]', both + ' wedding invitation');

    /* og:url is not touched: the markup has no such tag, on purpose. Every
       crawler then falls back to the address it fetched, which is this
       couple's own site — always right, and nothing to fill in.

       The image is the one thing that must be an absolute address, so it
       ships pointing at the demo copy. Identical for every couple by
       design, so it is never wrong — only borrowed. Entering a site address
       serves it from their own domain instead. */
    const site = (invitationData.siteUrl || '').trim().replace(/\/+$/, '');
    if (!site) return;
    setMeta('meta[property="og:image"]', site + '/preview.jpg');
    setMeta('meta[name="twitter:image"]', site + '/preview.jpg');
  }

  const coreRenderForMeta = window.renderInvitationFromData;
  if (typeof coreRenderForMeta === 'function'){
    window.renderInvitationFromData = function(){
      coreRenderForMeta.apply(this, arguments);
      renderShareMeta();
    };
  }
  renderShareMeta();


  /* ---------------- FAQ ACCESSIBILITY ----------------
     The core's toggle swaps two classes but never tells assistive tech what
     just happened. These are disclosure buttons, so they need aria-expanded
     and a link to the panel they control — otherwise a screen reader
     announces a button that appears to do nothing. */
  function syncFaqAria(){
    document.querySelectorAll('#faq-list .faq-question').forEach(btn => {
      const id = btn.id.replace('faq-question-', '');
      const panel = document.getElementById('faq-answer-' + id);
      if (!panel) return;
      if (!panel.id) return;
      btn.setAttribute('aria-controls', panel.id);
      btn.setAttribute('aria-expanded', String(panel.classList.contains('faq-answer-open')));
    });
  }

  const coreToggleFaq = window.toggleFaqPublicItem;
  if (typeof coreToggleFaq === 'function'){
    window.toggleFaqPublicItem = function(){
      coreToggleFaq.apply(this, arguments);
      syncFaqAria();
    };
  }

  // The list is rebuilt whenever the FAQ changes, which drops the attributes.
  const coreRenderFaq = window.renderFaqPublic;
  if (typeof coreRenderFaq === 'function'){
    window.renderFaqPublic = function(){
      coreRenderFaq.apply(this, arguments);
      syncFaqAria();
    };
  }
  syncFaqAria();


})();
