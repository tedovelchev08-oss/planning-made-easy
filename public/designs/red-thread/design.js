/* ============================================================
   THE RED THREAD - the seam onto the shared core, and the thread itself.

   The core owns the global invitationData (declared inline in index.html and
   loaded before this file) and everything outside the design: the builder
   drawer, save, share, export, the RSVP post to Netlify, music. This file reads
   that data, pours it into the page, and then draws the thread.

   THE THREAD IS GENERATED, NOT DRAWN BY HAND. buildRail() measures the real
   pixel positions of the hero ring and of every section, then emits two smooth
   paths that cross at each section boundary. That is why it always embraces the
   content that is actually on the page: add a schedule row, change a name, load
   on a phone, and the geometry is recomputed rather than approximated.

   buildContent() runs BEFORE the motion section on purpose. The scroll timelines
   bind to nodes that must already exist, and the rail measures a DOM that must
   already be its final height.
   ============================================================ */
function txt(v,d){ v=(v==null?'':String(v)).trim(); return v||d||''; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function setText(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
function setHTML(id,v){ var el=document.getElementById(id); if(el) el.innerHTML=v; }
function data(){ return (typeof invitationData==='object'&&invitationData)?invitationData:{}; }
function pad2(n){ n=+n; return (n<10?'0':'')+n; }
/* A single separator, not a chain of them. */
function fmtDate(iso){ var p=String(iso||'').split('-'); return p.length===3 ? pad2(p[2])+' . '+pad2(p[1])+' . '+p[0] : (iso||''); }
function initialsOf(a,b){ var x=txt(a).charAt(0).toUpperCase(), y=txt(b).charAt(0).toUpperCase(); return (x&&y)?(x+' / '+y):(x||y||''); /* LUMA: no sample initials */ }

let wedding = {};
function buildWedding(){
  var d = data();
  wedding = {
    /* LUMA: names always come from the couple's wedding, never a sample */
    couple:{ personOne:txt(d.partner1,''), personTwo:txt(d.partner2,''),
             initials:initialsOf(d.partner1,d.partner2) },
    date:{ display:fmtDate(d.date), iso:txt(d.date,''), year:String(txt(d.date,'')).split('-')[0]||'' },
    hero:{ eyebrow:txt(d.heroEyebrow,'The Wedding Of'), place:txt(d.heroPlace,''),
           legend:txt(d.heroQuote,'') },
    ceremony:{ time:txt(d.time,''), venue:txt(d.venueName,''), address:txt(d.venueAddress,'') },
    timeline: Array.isArray(d.schedule)?d.schedule:[],
    gallery: Array.isArray(d.gallery)?d.gallery:[],
    rsvp:{ deadline:txt(d.rsvpDeadline,''), email:txt(d.rsvpEmailText,'') }
  };
  return wedding;
}

function fillPhoto(phEl, src, tag){
  if(!phEl) return;
  var img = phEl.querySelector('img.real');
  if(txt(src,'')){
    if(!img){ img=document.createElement('img'); img.className='real'; img.alt=''; phEl.insertBefore(img, phEl.firstChild); }
    img.src=src; img.style.display='';
  } else if(img){ img.style.display='none'; }
  var t = phEl.querySelector('.ph-tag');
  if(t && tag!=null) t.textContent = tag;
}

/* ---------------- The order of the day ----------------
   No rules between the rows: the thread is already drawing a line down the
   middle of this section, and a second set of hairlines would fight it. */
function renderTimeline(){
  var host=document.getElementById('tlItems'); if(!host) return;
  var items=wedding.timeline||[];
  var section=document.getElementById('schedule');
  if(section) section.style.display = items.length ? '' : 'none';

  var existing=host.querySelectorAll('.tl-item');
  if(existing.length===items.length){
    items.forEach(function(it,i){
      var el=existing[i];
      el.setAttribute('data-time', txt(it.time,''));
      var t=el.querySelector('.tl-time'), n=el.querySelector('.tl-title');
      if(t) t.textContent=txt(it.time,'');
      if(n) n.textContent=txt(it.title,'');
    });
    return;
  }
  host.innerHTML = items.map(function(it){
    return '<div class="tl-item" data-time="'+esc(txt(it.time,''))+'">'+
             '<div class="tl-time serif">'+esc(txt(it.time,''))+'</div>'+
             '<span class="tl-dot"></span>'+
             '<div class="tl-title">'+esc(txt(it.title,''))+'</div>'+
           '</div>';
  }).join('');
  observeReveals();
  scheduleRailRebuild();
}

function renderGallery(){
  var grid=document.querySelector('.gallery-grid'); if(!grid) return;
  var items=wedding.gallery||[];
  var section=document.getElementById('gallery');
  if(section) section.style.display = items.length ? '' : 'none';

  var slots=grid.querySelectorAll('.g-item');
  if(slots.length===items.length){
    items.forEach(function(it,i){ fillPhoto(slots[i].querySelector('.ph'), it.photo, txt(it.caption,'')); });
    return;
  }
  grid.innerHTML = items.map(function(it,i){
    var cls = i<4 ? ('g-item g'+(i+1)) : 'g-item g-extra';
    return '<div class="'+cls+'"><div class="ph">'+
           (txt(it.photo,'')?'<img class="real" src="'+esc(it.photo)+'" alt="">':'')+
           '<div class="ph-tag">'+esc(txt(it.caption,''))+'</div></div></div>';
  }).join('');
  observeReveals();
  scheduleRailRebuild();
}

/* This design ships two of the five tracks the shared core knows about. The
   core's resolveTrack() falls back to clairdelune for a key it does not
   recognise, but a RETIRED key it does recognise still resolves to a file that
   is no longer in the folder, which would be a silent 404. Coerce anything that
   is not shipped here back to the default before the core ever reads it.
   (clairdelune is deliberately one of the two kept: it is the core's own
   fallback, so that path can never point at a missing file either.) */
var SHIPPED_TRACKS = { gnossienne:1, clairdelune:1 };
function guardMusicTrack(){
  var d = data();
  if(!d || typeof d !== 'object') return;
  if(!d.music || typeof d.music !== 'object') return;
  // LUMA: "couple" is the couple's own uploaded song, registered by the core
  if(d.music.track !== 'couple' && !SHIPPED_TRACKS[d.music.track]) d.music.track = 'gnossienne';
}

function buildContent(){
  guardMusicTrack();
  buildWedding();
  var d=data(), w=wedding;

  /* Names are set in sentence case, not shouted. The display face carries them. */
  document.querySelectorAll('[data-sync="one"]').forEach(function(el){ el.textContent=w.couple.personOne; });
  document.querySelectorAll('[data-sync="two"]').forEach(function(el){ el.textContent=w.couple.personTwo; });
  document.querySelectorAll('[data-sync="date"]').forEach(function(el){ el.textContent=w.date.display; });
  document.title = w.couple.personOne+' and '+w.couple.personTwo+' - The Red Thread';

  var mark=document.querySelector('.nav-mark'); if(mark) mark.textContent=w.couple.initials;

  setText('heroEyebrow', w.hero.eyebrow);
  setText('ovEyeb', w.hero.eyebrow);
  if(w.hero.legend) setText('heroLegend', w.hero.legend);

  /* Hero footer: time, place and dress code, each with its last word emphasised
     so the strip reads as three facts rather than a decorative caption. */
  (function(){
    function pair(id, value){
      var el=document.getElementById(id); if(!el) return;
      var v=txt(value,'');
      if(!v){ el.style.display='none'; return; }
      el.style.display='';
      /* Emphasise the last word only. Slice rather than split/join so commas and
         other punctuation survive: "Villa Serrano, Lake Como", not "Villa
         Serrano Lake Como". */
      var i=v.lastIndexOf(' ');
      if(i<0){ el.textContent=v; return; }
      el.innerHTML = esc(v.slice(0,i+1))+'<b>'+esc(v.slice(i+1))+'</b>';
    }
    pair('heroTime', w.ceremony.time);
    pair('heroPlace', w.hero.place || w.ceremony.venue);
    pair('heroDress', txt(d.dressCode,''));
  })();

  /* Whether the couple's own photographs are settled into the palette. Default
     on, because a mixed set of phone snaps and photographer's pictures reads as
     one page that way. Explicit false is respected. */
  document.body.classList.toggle('photos-as-taken', d.photoTone === false);

  setText('storyP1', txt(d.story1,''));
  setText('storyP2', txt(d.story2,''));

  setText('dayVenue', txt(d.venueName,''));
  setText('dayAddr',  txt(d.venueAddress,''));
  var dress=[txt(d.dressCode,''),txt(d.dressCodeNote,'')].filter(Boolean).join(', ');
  setText('dayDress', dress);
  var vl=document.getElementById('venueLink');
  if(vl) vl.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((txt(d.venueName,'')+' '+txt(d.venueAddress,'')).trim());

  setText('rsvpLead', txt(d.rsvpKicker,'Now, we would love to have you with us'));
  setText('rsvpNameLabel', txt(d.rsvpNameLabel,'Your Name'));
  setText('rsvpYesLabel', txt(d.rsvpYesLabel,'Yes'));
  setText('rsvpNoLabel', txt(d.rsvpNoLabel,'No'));
  setText('rsvpGuestsLabel', txt(d.rsvpGuestsLabel,'Number of Guests'));
  setText('rsvpNotesLabel', txt(d.rsvpNotesLabel,'A Message for the Couple'));
  setText('rsvpSubmitLabel', txt(d.rsvpSubmitLabel,'Send our reply'));
  var jl=document.getElementById('joinLabel'); if(jl) jl.textContent=txt(d.rsvpAttendanceLabel,'Will You Join Us?');

  var both = w.couple.personOne+' and '+w.couple.personTwo;
  setText('footNames', both + (w.date.year?(', '+w.date.year):''));
  setText('closeNames', both);

  fillPhoto(document.querySelector('#heroPhoto .ph'), d.heroPhoto, '');

  /* Calendar links. The core builds these in its own render pass, but that pass
     bails early on a design without its countdown markup, so the two links were
     left pointing at "#". Building them here keeps the feature working and
     depends on nothing but this design's own data. */
  (function(){
    var g=document.getElementById('gcal-link'), ics=document.getElementById('ics-link');
    if(!g && !ics) return;
    var p=String(txt(d.date,'')).split('-');
    if(p.length!==3) return;
    function hhmm(t){
      var m=String(t||'').trim().match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/i);
      if(!m) return [16,0];
      var h=+m[1], mi=+(m[2]||0), ap=(m[3]||'').toLowerCase();
      if(ap==='pm' && h<12) h+=12;
      if(ap==='am' && h===12) h=0;
      return [h,mi];
    }
    function stamp(dt){ return dt.getUTCFullYear()+pad2(dt.getUTCMonth()+1)+pad2(dt.getUTCDate())+'T'+pad2(dt.getUTCHours())+pad2(dt.getUTCMinutes())+'00Z'; }
    var t0=hhmm(d.time), start=new Date(Date.UTC(+p[0],+p[1]-1,+p[2],t0[0],t0[1])),
        end=new Date(start.getTime()+5*3600*1000);
    var couple=w.couple.personOne+' and '+w.couple.personTwo;
    var loc=[txt(d.venueName,''),txt(d.venueAddress,'')].filter(Boolean).join(', ');
    if(g){
      g.href='https://calendar.google.com/calendar/render?action=TEMPLATE'
        +'&text='+encodeURIComponent(couple+' - Wedding')
        +'&dates='+stamp(start)+'/'+stamp(end)
        +'&details='+encodeURIComponent('Celebrating the wedding of '+couple+'.')
        +'&location='+encodeURIComponent(loc);
    }
    if(ics){
      /* LUMA: no calendar function on Luma either, so the same fallback */
      if(location.protocol==='file:' || window.lumaBoot){
        /* No backend when the file is opened directly. Fall back to the core's
           in-browser download. */
        ics.removeAttribute('href'); ics.style.cursor='pointer';
        ics.onclick=function(e){ e.preventDefault(); if(typeof window.downloadICS==='function') window.downloadICS(); };
      } else {
        ics.href='/.netlify/functions/calendar?'+new URLSearchParams({
          p1:txt(d.partner1,''), p2:txt(d.partner2,''), date:txt(d.date,''),
          time:txt(d.time,''), venue:txt(d.venueName,''), address:txt(d.venueAddress,'')
        }).toString();
        ics.onclick=null;
      }
    }
  })();

  renderTimeline();
  renderGallery();

  if(typeof window.handleRsvpGuestCountChange==='function'){ try{ window.handleRsvpGuestCountChange(); }catch(e){} }
  scheduleRailRebuild();
}

/* ============================================================
   MOTION
   ============================================================ */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(window.gsap && window.ScrollTrigger){ gsap.registerPlugin(ScrollTrigger); }

/* ------------------------------------------------------------
   THE THREAD

   Two paths. Each enters at the top of the page, crosses its partner at
   the brass ring in the hero, and then alternates sides down the
   document, crossing again at every section boundary. Every section
   therefore sits inside an eye formed by the two threads, and the last
   crossing is directly above the RSVP.

   Wide viewports: the threads run out into the page margins and embrace
   the content. Narrow viewports: they collapse into a braided spine down
   the left edge, and the CSS indents the content off it.
   ------------------------------------------------------------ */
const railEl = document.getElementById('thread-rail');
const mainEl = document.getElementById('main');
const SECTION_IDS = ['beginning','us','the-day','schedule','gallery','rsvp'];
let railTween = null;

/* Catmull-Rom through the anchor points, emitted as cubic beziers. A thread
   should never show a corner. */
function smoothPath(pts){
  if(pts.length < 2) return '';
  var d = 'M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);
  for(var i=0;i<pts.length-1;i++){
    var p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || pts[i+1];
    var c1x = p1[0] + (p2[0]-p0[0])/6, c1y = p1[1] + (p2[1]-p0[1])/6;
    var c2x = p2[0] - (p3[0]-p1[0])/6, c2y = p2[1] - (p3[1]-p1[1])/6;
    d += 'C'+c1x.toFixed(1)+','+c1y.toFixed(1)+' '+c2x.toFixed(1)+','+c2y.toFixed(1)+
         ' '+p2[0].toFixed(1)+','+p2[1].toFixed(1);
  }
  return d;
}

function railAnchors(){
  var mainRect = mainEl.getBoundingClientRect();
  var W = mainEl.offsetWidth, H = mainEl.offsetHeight;
  var narrow = W < 900;

  /* The ring is measured, never assumed: it is a real element in the hero's
     flow, so its centre moves with the type above it. */
  var ring = document.getElementById('heroRing');
  var cx, ringY;
  if(ring){
    var r = ring.getBoundingClientRect();
    cx    = r.left + r.width/2  - mainRect.left;
    ringY = r.top  + r.height/2 - mainRect.top;
  } else {
    cx = narrow ? 30 : W/2; ringY = Math.min(H*0.62, 620);
  }

  var spread = Math.min(W*0.30, 380);   /* how far apart at the top */

  /* HOW FAR THE THREADS BOW OUT.
     Measured from the real content column, not guessed as a fraction of the
     viewport: the bow has to clear the text and the photographs, so the thread
     frames the page instead of drawing across somebody's face. The crossings
     happen at section boundaries, which are padding, so the centre is always
     free.

     A PHONE GETS THE SAME COMPOSITION, NOT A DIFFERENT ONE. There is no room to
     clear a wide column and still stay on screen, so the stylesheet narrows the
     column on small screens and the bow simply runs closer to the edge. The
     threads still embrace every section and still cross at every boundary, which
     is the whole point of the design; only the scale changes. */
  var wrapEl  = document.querySelector('.sec .wrap');
  var colHalf = wrapEl ? wrapEl.offsetWidth/2 : Math.min(570, W*0.4);
  var amp     = Math.min(colHalf + (narrow ? 20 : 68), W/2 - 12);

  /* Vary the bow so the rhythm never reads as a machine sine wave, but only
     ever outward: any value below 1 would put the thread back over the text. */
  var VAR = [1, 1.07, 1.02, 1.1, 1.0, 1.05];

  var secs = SECTION_IDS
    .map(function(id){ return document.getElementById(id); })
    .filter(function(el){ return el && el.offsetParent !== null; });

  /* --- above the ring: the two threads arrive --- */
  var headA = [[cx-spread, -70], [cx-spread*0.95, ringY*0.40], [cx-spread*0.52, ringY*0.76], [cx, ringY]];
  var headB = [[cx+spread, -70], [cx+spread*0.95, ringY*0.40], [cx+spread*0.52, ringY*0.76], [cx, ringY]];

  /* --- below the ring: they braid down the document --- */
  var tailA = [[cx, ringY]], tailB = [[cx, ringY]];
  secs.forEach(function(el, i){
    var top = el.offsetTop, h = el.offsetHeight;
    var a = Math.min(amp * VAR[i % VAR.length], W/2 - 12);
    var sign = (i % 2 === 0) ? 1 : -1;

    /* Hold the bow open for the WHOLE height of the content and close it only
       inside the section's own padding. A single mid-height anchor would let the
       thread cut diagonally back across the bottom of a tall section, which is
       exactly where the gallery's photographs are. */
    var cs = getComputedStyle(el);
    var padT = parseFloat(cs.paddingTop)  || 0;
    var padB = parseFloat(cs.paddingBottom) || 0;
    var yIn  = top + Math.min(padT * 0.55, h * 0.3);
    var yOut = top + h - Math.min(padB * 0.55, h * 0.3);

    tailA.push([cx + sign*a, yIn]);  tailA.push([cx + sign*a, yOut]);
    tailB.push([cx - sign*a, yIn]);  tailB.push([cx - sign*a, yOut]);
    tailA.push([cx, top + h]);            /* the crossing */
    tailB.push([cx, top + h]);
  });
  /* They leave together. */
  tailA.push([cx-4, H+90]);
  tailB.push([cx+4, H+90]);

  return { W:W, H:H, narrow:narrow, ringX:cx, ringY:ringY, headA:headA, headB:headB, tailA:tailA, tailB:tailB };
}

/* The stylesheet cancels the core's #main padding, so the hero owns the whole
   viewport. What it still needs to know is how tall the floating studio bar is,
   so the eyebrow and the site nav clear it while the builder is open. Measured
   rather than hardcoded, because the bar wraps to two rows on narrow windows.
   In guest view the bar is display:none and this is 0. */
function syncMainPad(){
  var bar = document.getElementById('builder-bar');
  var h = 0;
  if(bar && !document.body.classList.contains('guest-mode')){
    var cs = getComputedStyle(bar);
    if(cs.display !== 'none' && cs.position === 'fixed') h = bar.offsetHeight;
  }
  document.documentElement.style.setProperty('--bar-h', h+'px');
}

function buildRail(){
  if(!railEl || !mainEl) return;
  syncMainPad();
  var g = railAnchors();

  /* Nothing that the thread depends on has moved, so leave it alone. This is
     what stops the size observer feeding itself. */
  var state = [g.W, g.H, Math.round(g.headA[3][1]), g.tailA.length].join('|');
  if(window.__railHistory) window.__railHistory.push(state);
  if(state === railState) return;
  railState = state;

  /* The element box MUST equal the viewBox, in pixels, or SVG's default
     preserveAspectRatio letterboxes the drawing: the moment #main is even
     slightly taller than the height the paths were built for, the whole thread
     is scaled to fit and centred, which shifts it down by half the difference
     and silently decouples it from the layout it was measured against. Sizing
     the element explicitly (rather than leaving the stylesheet's height:100% to
     track a document that keeps growing) keeps the mapping exactly 1:1. */
  railEl.setAttribute('viewBox', '0 0 '+g.W+' '+g.H);
  railEl.setAttribute('width',  g.W);
  railEl.setAttribute('height', g.H);
  railEl.style.width  = g.W+'px';
  railEl.style.height = g.H+'px';

  var defs = [
    ['shadow','headA', smoothPath(g.headA)], ['shadow','headB', smoothPath(g.headB)],
    ['shadow','tailA', smoothPath(g.tailA)], ['shadow','tailB', smoothPath(g.tailB)],
    ['line','headA',   smoothPath(g.headA)], ['line','headB',   smoothPath(g.headB)],
    ['line','tailA',   smoothPath(g.tailA)], ['line','tailB',   smoothPath(g.tailB)]
  ];
  /* The ring is painted here, at the same crossing point the threads were built
     from, rather than as a separate element in the hero. One source of truth:
     if the rail is ever measured against a stale layout, the ring moves with it
     instead of drifting away from it. */
  var rx = g.ringX, ry = g.ringY;
  /* A slightly smaller ring on a phone, for proportion against smaller type. */
  var rr = g.narrow ? 22 : 26;
  var ring =
    '<g class="rail-ring" transform="translate('+rx.toFixed(1)+','+ry.toFixed(1)+')">'+
      '<circle r="'+rr+'" fill="none" stroke="#8a6c33" stroke-width="4.4" opacity=".3" transform="translate(1.5,3)"/>'+
      '<circle r="'+rr+'" fill="none" stroke="#b9954f" stroke-width="3.4"/>'+
      '<circle r="'+rr+'" fill="none" stroke="#e8cf95" stroke-width="1" opacity=".85" stroke-dasharray="'+(rr*1.15).toFixed(0)+' 130" stroke-dashoffset="-14"/>'+
    '</g>';

  railEl.innerHTML =
    '<g transform="translate(2,5)">'+
      defs.slice(0,4).map(function(p){ return '<path class="rail-shadow" data-seg="'+p[1]+'" d="'+p[2]+'"/>'; }).join('')+
    '</g>'+
    defs.slice(4).map(function(p){ return '<path class="rail-line" data-seg="'+p[1]+'" d="'+p[2]+'"/>'; }).join('')+
    ring;

  /* The head is the hero's own composition, so it is always drawn. Only the
     tail is dealt out by scrolling. */
  var tails = railEl.querySelectorAll('[data-seg="tailA"],[data-seg="tailB"]');
  Array.prototype.forEach.call(tails, function(p){
    var len = p.getTotalLength();
    p.style.strokeDasharray  = len;
    p.style.strokeDashoffset = reduced ? 0 : len;
  });

  if(railTween){ railTween.scrollTrigger && railTween.scrollTrigger.kill(); railTween.kill(); railTween = null; }
  if(reduced || !window.gsap || !window.ScrollTrigger || !tails.length) return;

  /* Motivated motion: the thread is the narrative, and dealing it out at the
     reader's own pace is what makes the page a story rather than a poster. */
  railTween = gsap.to(tails, {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '#beginning', start: 'top bottom',
      endTrigger: 'footer',  end: 'top bottom',
      scrub: 0.6, invalidateOnRefresh: true
    }
  });
}

/* Content renders can change the document height, so coalesce rebuilds into one
   frame rather than measuring a DOM that is still settling. */
/* What the current rail was measured against. Rebuilding is cheap but not free,
   and the observer below would otherwise loop: setting --main-pad changes the
   hero's height, which changes #main's height, which fires the observer again. */
let railState = '';

let railPending = null;
function scheduleRailRebuild(){
  if(railPending) return;
  /* setTimeout rather than requestAnimationFrame on purpose. Layout is already
     settled by the time a timeout runs, and rAF does not fire in headless
     rendering, which would leave the thread measured against a pre-font layout
     in any screenshot or export. */
  railPending = setTimeout(function(){
    railPending = null;
    try{ buildRail(); }catch(e){}
    if(window.ScrollTrigger){ try{ ScrollTrigger.refresh(); }catch(e){} }
  }, 0);
}
window.addEventListener('resize', (function(){
  var t=null, lastW=window.innerWidth;
  return function(){
    /* Mobile browsers fire resize when the address bar hides. Only rebuild when
       the width actually changed, or the thread twitches during a scroll. */
    if(window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(t); t=setTimeout(scheduleRailRebuild, 180);
  };
})());

/* THE DOCUMENT SETTLES IN STAGES, AND THE THREAD HAS TO FOLLOW IT.
   wedding-core.js writes its #main padding after this file is parsed, fonts swap
   in after first paint, and photographs land later still. Each of those moves
   the hero ring, so a rail built once is a rail anchored to a layout that no
   longer exists. A size observer catches all three causes with one mechanism,
   and railState stops it looping on its own output. */
if(window.ResizeObserver && mainEl){
  var ro = new ResizeObserver(function(){ scheduleRailRebuild(); });
  ro.observe(mainEl);
  var heroForRo = document.getElementById('hero');
  if(heroForRo) ro.observe(heroForRo);
}
window.addEventListener('load', scheduleRailRebuild);
if(document.fonts && document.fonts.ready){ document.fonts.ready.then(scheduleRailRebuild); }

/* ------------------------------------------------------------
   SECTION REVEALS
   IntersectionObserver rather than a ScrollTrigger each: these are simple
   "arrive once" fades and do not need the scroll engine.
   ------------------------------------------------------------ */
let revealObserver = null;
function observeReveals(){
  if(reduced) return;
  if(!revealObserver){
    revealObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        en.target.classList.add('in');
        revealObserver.unobserve(en.target);
      });
    }, { rootMargin:'0px 0px -12% 0px', threshold:0.15 });
  }
  document.querySelectorAll('.tl-item:not(.in), .g-item:not(.in)').forEach(function(el, i){
    el.style.transitionDelay = (i % 4) * 60 + 'ms';
    revealObserver.observe(el);
  });
}

/* ------------------------------------------------------------
   NAV BACKDROP
   The index is fixed, so once the page scrolls under it the monogram would sit
   on top of whatever heading is passing. A sentinel at the top of the document
   toggles the backdrop, so there is no scroll listener and it works with the
   scroll engine disabled.
   ------------------------------------------------------------ */
(function(){
  var nav = document.getElementById('site-nav');
  var sentinel = document.getElementById('nav-sentinel');
  if(!nav || !sentinel || !window.IntersectionObserver) return;
  new IntersectionObserver(function(entries){
    nav.classList.toggle('is-stuck', !entries[0].isIntersecting);
  }, { rootMargin:'-24px 0px 0px 0px' }).observe(sentinel);
})();

/* ------------------------------------------------------------
   ENTRY
   The loader is a thread starting to draw. The entry is that same
   gesture at full size, ending in the hero's own composition so the
   overlay can dissolve without anything appearing to move.
   ------------------------------------------------------------ */
const introEl   = document.getElementById('intro');
const loaderEl  = document.getElementById('loader');
const introSkip = document.getElementById('introSkip');
let entryTl = null;

function finishEntry(){
  if(entryTl){ try{ entryTl.kill(); }catch(e){} entryTl=null; }
  if(loaderEl) loaderEl.style.display='none';
  if(introEl){ introEl.style.opacity='0'; introEl.style.display='none'; }
  document.body.style.overflow='';
  /* Releasing the scroll lock restores the scrollbar and therefore changes the
     layout width, so the thread is re-anchored before the reader sees it. */
  scheduleRailRebuild();
}

function startIntro(){
  if(reduced || !window.gsap || !introEl){ finishEntry(); return; }
  document.body.style.overflow='hidden';

  var a=document.getElementById('ovA'), b=document.getElementById('ovB');
  [a,b].forEach(function(p){
    if(!p) return;
    var len=p.getTotalLength();
    p.style.strokeDasharray=len; p.style.strokeDashoffset=len;
  });
  gsap.set('#ovRing', { opacity:0, scale:0.6, transformOrigin:'center' });
  gsap.set(['.ov-eyeb','.ov-amp','.ov-names span[data-sync]'], { opacity:0, y:14 });

  entryTl = gsap.timeline({ onComplete:finishEntry });
  entryTl
    /* the loader's own line finishes filling */
    .to('#loaderFill', { height:120, duration:0.55, ease:'power2.inOut' })
    .to(loaderEl, { opacity:0, duration:0.4, onComplete:function(){ if(loaderEl) loaderEl.style.display='none'; } })
    /* the two threads come down */
    .to([a,b], { strokeDashoffset:0, duration:1.5, ease:'power2.inOut' }, '-=0.15')
    /* they meet, and the ring catches the light */
    .to('#ovRing', { opacity:1, scale:1, duration:0.6, ease:'back.out(2)' }, '-=0.28')
    .fromTo('#ovGlint', { rotation:-140, transformOrigin:'center' },
                        { rotation:200, duration:1.1, ease:'power2.inOut' }, '<')
    /* the names appear on the line the threads make */
    .to('.ov-eyeb', { opacity:1, y:0, duration:0.5, ease:'power2.out' }, '-=0.7')
    .to('.ov-names span[data-sync]', { opacity:1, y:0, duration:0.7, stagger:0.16, ease:'power3.out' }, '-=0.3')
    .to('.ov-amp', { opacity:1, y:0, duration:0.5, ease:'power2.out' }, '-=0.5')
    .to({}, { duration:0.9 })
    .to(introEl, { opacity:0, duration:0.9, ease:'power2.inOut' });
}

/* Two failsafes. A guest must never be stranded on a blank overlay because a
   font, a photo or a CDN was slow: the entry starts even if `load` never fires,
   and it is abandoned outright after six seconds. */
var entryFailsafe = setTimeout(function(){ finishEntry(); }, 6000);
var entryStarted = false;
function beginOnce(){ if(entryStarted) return; entryStarted = true; startIntro(); }
window.addEventListener('load', beginOnce);
setTimeout(function(){ if(!entryStarted) beginOnce(); }, 2600);
if(introSkip) introSkip.addEventListener('click', function(){ clearTimeout(entryFailsafe); finishEntry(); });
if(reduced) finishEntry();

/* ------------------------------------------------------------
   INDEX MENU
   ------------------------------------------------------------ */
(function(){
  const indexMenu = document.getElementById('index-menu');
  const openBtn   = document.getElementById('indexOpen');
  const closeBtn  = document.getElementById('indexClose');
  if(!indexMenu) return;
  function open(){ indexMenu.classList.add('open'); if(openBtn) openBtn.setAttribute('aria-expanded','true'); }
  function close(){ indexMenu.classList.remove('open'); if(openBtn) openBtn.setAttribute('aria-expanded','false'); }
  if(openBtn)  openBtn.addEventListener('click', open);
  if(closeBtn) closeBtn.addEventListener('click', close);
  indexMenu.querySelectorAll('.index-item').forEach(function(item){
    item.addEventListener('click', function(){
      var t=document.querySelector(item.getAttribute('data-target'));
      close();
      if(t) t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block:'start' });
    });
  });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') close(); });
})();

/* ------------------------------------------------------------
   RSVP CONTROLS
   ------------------------------------------------------------ */
(function(){
  const choiceLabels = document.querySelectorAll('.choice-btn');
  function syncChoice(){
    choiceLabels.forEach(function(l){
      var input=l.querySelector('input');
      l.classList.toggle('selected', !!(input && input.checked));
    });
  }
  choiceLabels.forEach(function(l){
    var input=l.querySelector('input');
    if(input) input.addEventListener('change', syncChoice);
  });
  syncChoice();
})();

/* The visible number input and the hidden <select> the core posts must agree. */
(function(){
  const guestNum = document.getElementById('rsvpGuests');
  const guestSel = document.getElementById('rsvp-guest-count');
  if(!guestNum || !guestSel) return;
  function syncGuestCount(){
    var v = Math.max(1, Math.min(6, parseInt(guestNum.value,10) || 1));
    guestSel.value = String(v);
    if(typeof window.handleRsvpGuestCountChange==='function'){
      try{ window.handleRsvpGuestCountChange(); }catch(e){}
    }
  }
  guestNum.addEventListener('input', syncGuestCount);
  guestNum.addEventListener('change', syncGuestCount);
  syncGuestCount();
})();

/* ------------------------------------------------------------
   RSVP CONFIRMATION
   The threads finish the gesture they started in the hero: they tie.
   ------------------------------------------------------------ */
/* THE CORE DOES NOT WIRE THE RSVP FORM. wedding-core.js defines submitRSVP()
   but never attaches it: designs 4 to 8 call it from an onsubmit attribute in
   their own markup, and design-9 writes its own handler. Without either, the
   browser performs a NATIVE POST and the whole invitation reloads, which is
   exactly what it looked like. This design writes its own, so nothing reloads
   and the reply gets a confirmation that belongs to the design.

   No confetti anywhere: the core's only call sits inside that unattached
   function, and the library is no longer loaded by this design. */
(function(){
  const form    = document.getElementById('rsvp-form');
  const closing = document.getElementById('closing');
  const errorEl = document.getElementById('rsvp-error');
  const doneEl  = document.getElementById('rsvp-confirmed');
  if(!form) return;

  let sent = false;

  function drawFigure(yes){
    var ids = yes ? ['clKnot'] : ['clOpenA','clOpenB'];
    var paths = ids.map(function(id){ return document.getElementById(id); }).filter(Boolean);
    if(!window.gsap || reduced){
      paths.forEach(function(p){ p.style.strokeDasharray=''; p.style.strokeDashoffset=0; });
      var c=document.querySelector('.cl-copy'); if(c) c.style.opacity=1;
      return;
    }
    paths.forEach(function(p){
      var len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
    var ring = document.getElementById('clRing');
    var copy = document.querySelector('.cl-copy');

    /* The end state, reachable without the animation. A guest who has just
       replied must never be left looking at half a knot and no message, and
       requestAnimationFrame is throttled in a background tab.

       The timeline is KILLED first. Writing the final values while it is still
       running achieves nothing: GSAP owns those properties and overwrites them
       on its next tick, which is exactly what a throttled tab does slowly. */
    var tl;
    function settle(){
      if(tl){ try{ tl.kill(); }catch(e){} tl = null; }
      paths.forEach(function(p){ p.style.strokeDashoffset = 0; });
      if(ring){ gsap.set(ring, { opacity:1, scale:1 }); }
      if(copy) copy.style.opacity = 1;
    }
    var guard = setTimeout(settle, (yes ? 2200 : 1600) + 1800);

    tl = gsap.timeline({ onComplete:function(){ clearTimeout(guard); settle(); } });
    tl.to(paths, { strokeDashoffset:0, duration: yes ? 2.2 : 1.6, ease:'power2.inOut' });
    if(yes && ring){
      gsap.set(ring, { opacity:0, scale:0.5, transformOrigin:'center' });
      tl.to(ring, { opacity:1, scale:1, duration:0.6, ease:'back.out(2)' }, '-=0.5');
    }
    tl.to(copy, { opacity:1, duration:0.8, ease:'power2.out' }, '-=0.35');
  }

  function show(yes, name){
    if(!closing) return;
    closing.classList.remove('is-yes','is-no');
    closing.classList.add('on', yes ? 'is-yes' : 'is-no');
    closing.setAttribute('aria-hidden','false');
    setText('closeText', yes ? 'See you there' : 'You will be missed');
    setText('closeSub',  yes ? 'With love,' : 'Thinking of you on the day,');
    document.body.style.overflow = 'hidden';
    drawFigure(yes);
    var dismiss = document.getElementById('closeDismiss');
    if(dismiss) dismiss.focus();
  }

  function hide(){
    if(!closing) return;
    closing.classList.remove('on');
    closing.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    scheduleRailRebuild();
  }

  function handleRsvp(e){
    if(e && e.preventDefault) e.preventDefault();
    if(sent) return;

    var nameEl = document.getElementById('rsvpName');
    var name = nameEl ? nameEl.value.trim() : '';
    var att  = form.querySelector('input[name="attending"]:checked');

    if(!name){
      if(errorEl){
        errorEl.textContent = 'Please add your name so we know who is replying.';
        errorEl.style.display = '';
      }
      if(nameEl) nameEl.focus();
      return;
    }
    if(errorEl) errorEl.style.display = 'none';
    sent = true;

    var yes = !att || att.value === 'yes';

    /* LUMA: on Luma the reply goes to /api/rsvp (luma-bridge.js answers this
       POST), so wait for it: a guest must never be told it was sent when it
       wasn't. A refusal (the human check, too many answers) is shown as is. */
    var params = new URLSearchParams(new FormData(form)).toString();
    var controls = form.querySelectorAll('input, textarea, button, select');
    controls.forEach(function(el){ el.disabled = true; });

    function failed(message){
      sent = false;
      controls.forEach(function(el){ el.disabled = false; });
      if(errorEl){
        errorEl.textContent = message || txt(data().rsvpErrorText, "That didn't send. Please try again.");
        errorEl.style.display = '';
      }
    }

    fetch('/', { method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: params })
      .then(function(res){
        if(res.ok){
          form.hidden = true;
          if(doneEl){
            doneEl.hidden = false;
            setText('rsvpDoneTitle', 'Your reply is with us.');
            setText('rsvpDoneSub',   yes ? 'We will see you there.' : 'You will be missed.');
          }
          show(yes, name);
          return;
        }
        return res.json().then(function(b){ failed(b && b.error); }, function(){ failed(); });
      })
      .catch(function(){ failed(); });
  }

  form.addEventListener('submit', handleRsvp);

  var dismiss = document.getElementById('closeDismiss');
  if(dismiss) dismiss.addEventListener('click', hide);
  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape' && closing && closing.classList.contains('on')) hide();
  });

  /* Let a guest correct a mistaken reply rather than reloading the page. */
  var again = document.getElementById('rsvpAgain');
  if(again) again.addEventListener('click', function(){
    sent = false;
    form.querySelectorAll('input, textarea, button, select').forEach(function(el){ el.disabled = false; });
    form.hidden = false;
    if(doneEl) doneEl.hidden = true;
    var n = document.getElementById('rsvpName'); if(n) n.focus();
    scheduleRailRebuild();
  });
})();

/* ============================================================
   HOOKS the shared core calls by name.
   ============================================================ */
window.renderInvitationFromData = function(){
  buildContent();
  /* Rebuilt nodes need the scroll engine told, or triggers keep the old
     geometry and the thread is measured against a stale document height. */
  scheduleRailRebuild();
};
window.renderScheduleTimeline = function(){ buildWedding(); renderTimeline(); };
window.renderGalleryPublic    = function(){ buildWedding(); renderGallery(); };
window.renderFaqPublic        = function(){};   /* this design has no FAQ section */

/* The wording fields (data-mp-field) are not handled by the core - it owns the
   cfg-* inputs only. Fill them, write them back, and repaint on every keystroke. */
function syncMpFields(){
  var d = data();
  document.querySelectorAll('[data-mp-field]').forEach(function(el){
    var k = el.getAttribute('data-mp-field');
    if (d[k] != null) el.value = d[k];
  });
}
document.addEventListener('input', function(e){
  var el = e.target.closest && e.target.closest('[data-mp-field]');
  if(!el || typeof invitationData !== 'object') return;
  invitationData[el.getAttribute('data-mp-field')] = el.value;
  buildContent();
});
(function(){
  var coreSync = window.syncDataToInputs;
  window.syncDataToInputs = function(){
    if(typeof coreSync === 'function') coreSync.apply(this, arguments);
    syncMpFields();
    /* The core reads a fixed list of cfg-* ids, so a field this design adds has
       to be carried in and out by hand. */
    var t = document.getElementById('cfg-photo-tone');
    if(t) t.checked = (data().photoTone !== false);
  };

  var coreUpdate = window.updateInvitationFromInputs;
  window.updateInvitationFromInputs = function(){
    var t = document.getElementById('cfg-photo-tone');
    if(t && typeof invitationData === 'object') invitationData.photoTone = !!t.checked;
    /* Set BEFORE the core runs: it finishes by calling renderInvitationFromData,
       which is where buildContent reads this. */
    if(typeof coreUpdate === 'function') coreUpdate.apply(this, arguments);
  };
})();

/* The drawer's peek and start-over buttons are wired to these names in the
   shared markup, so they must exist even on designs that do not use them. */
if(typeof window.mpTogglePeek !== 'function'){
  window.mpTogglePeek = function(){
    var d=document.getElementById('customizer-drawer'), b=document.getElementById('mp-peek-btn');
    if(!d) return;
    var peeking = d.style.opacity === '0.12';
    d.style.opacity = peeking ? '' : '0.12';
    d.style.pointerEvents = peeking ? '' : 'none';
    if(b) b.setAttribute('aria-pressed', peeking ? 'false' : 'true');
  };
}

/* The builder bar's "Replay Opening" button. */
window.resetEnvelopeIntro = function(){
  if(!introEl) return;
  clearTimeout(entryFailsafe);
  entryFailsafe = setTimeout(function(){ finishEntry(); }, 6000);
  document.body.style.overflow='hidden';
  window.scrollTo(0,0);
  if(loaderEl){ loaderEl.style.display=''; loaderEl.style.opacity='1'; }
  gsap && gsap.set('#loaderFill', { height:0 });
  introEl.style.display=''; introEl.style.opacity='1';
  try{ startIntro(); }catch(e){ finishEntry(); }
};

/* Guest preview must SHOW the opening, exactly as a guest gets it. The core's
   enableGuestMode calls resetEnvelopeIntroInstant(), which bails out when there
   is no #envelope-box-el - this design has none, so preview would otherwise drop
   straight onto the page and look like nothing happened. */
(function(){
  var coreToggle = window.toggleGuestPreview;
  if(typeof coreToggle !== 'function') return;
  window.toggleGuestPreview = function(){
    var was = document.body.classList.contains('guest-mode');
    coreToggle.apply(this, arguments);
    var now = document.body.classList.contains('guest-mode');
    if(now && !was){ try{ window.resetEnvelopeIntro(); }catch(e){} }
    else if(!now && was){ finishEntry(); }
    scheduleRailRebuild();
  };
})();

/* ---------- Events editor: no icons ----------
   This design's schedule prints a time and a name, never an icon. The SHARED
   drawer still renders an icon picker because other designs do use it, so strip
   it here rather than forking wedding-core.js for one design. */
(function(){
  function stripIcons(){
    var pickers = document.querySelectorAll('#schedule-drawer-list .schedule-icon-picker');
    Array.prototype.forEach.call(pickers, function(p){
      var block = p.parentNode;
      if(block && block.parentNode){ block.parentNode.removeChild(block); }
      else if(p.parentNode){ p.parentNode.removeChild(p); }
    });
  }
  var coreRender = window.renderScheduleDrawer;
  if(typeof coreRender === 'function'){
    window.renderScheduleDrawer = function(){ coreRender.apply(this, arguments); stripIcons(); };
  }
  document.addEventListener('DOMContentLoaded', stripIcons);
  stripIcons();
})();

/* ---------- go ---------- */
try{ buildContent(); }catch(e){}
try{ syncMpFields(); }catch(e){}
observeReveals();
buildRail();
