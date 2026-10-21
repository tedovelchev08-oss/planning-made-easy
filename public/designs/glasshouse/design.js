/* ============================================================
   THE GLASSHOUSE - the seam onto the shared core, and the glass.

   The core owns the global invitationData (declared inline in index.html and
   loaded before this file) and everything outside the design: the builder
   drawer, save, share, export, the RSVP post to Netlify, music. This file
   reads that data, pours it into the page, and runs the one mechanic.

   THE ONE MECHANIC: a section arrives behind fogged glass and clears when it
   is reached. Everything else stays still. That is deliberate - the
   photographs are doing the work, and motion piled on top of them would be
   decoration rather than meaning.
   ============================================================ */
function txt(v,d){ v=(v==null?'':String(v)).trim(); return v||d||''; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function setText(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
function data(){ return (typeof invitationData==='object'&&invitationData)?invitationData:{}; }
function pad2(n){ n=+n; return (n<10?'0':'')+n; }
/* A single separator, not a chain of them. */
function fmtDate(iso){ var p=String(iso||'').split('-'); return p.length===3 ? pad2(p[2])+' . '+pad2(p[1])+' . '+p[0] : (iso||''); }
/* Northern-hemisphere seasons, which is what a nursery label would print.
   Falls back to the bare year rather than guessing when the date is empty. */
function seasonOf(iso){
  var p=String(iso||'').split('-'); if(p.length!==3) return 'The Glasshouse';
  var m=+p[1], y=p[0];
  var s = (m<=2||m===12) ? 'Winter' : m<=5 ? 'Spring' : m<=8 ? 'Summer' : 'Autumn';
  return s+' '+y;
}

/* The backdrops that ship with the design. A key that is not one of these
   (a retired file, or a payload from another design) falls back to the first,
   so the hero can never end up pointing at an image that is not here. */
var BACKDROPS = ['assets/backdrops/backdrop-3.jpg','assets/backdrops/backdrop-1.jpg',
                 'assets/backdrops/backdrop-2.jpg'];
function resolveBackdrop(v){
  v = txt(v,'');
  if(BACKDROPS.indexOf(v) > -1) return v;
  /* An uploaded photograph is a data URL and is allowed through. */
  if(v.slice(0,11) === 'data:image/') return v;
  return BACKDROPS[0];
}

let wedding = {};
function buildWedding(){
  var d = data();
  wedding = {
    couple:{ personOne:txt(d.partner1,''), personTwo:txt(d.partner2,'') }, /* LUMA: never a sample couple */
    date:{ display:fmtDate(d.date), iso:txt(d.date,''), year:String(txt(d.date,'')).split('-')[0]||'' },
    ceremony:{ time:txt(d.time,''), venue:txt(d.venueName,''), address:txt(d.venueAddress,'') },
    timeline: Array.isArray(d.schedule)?d.schedule:[],
    gallery: Array.isArray(d.gallery)?d.gallery:[]
  };
  return wedding;
}

function fillPhoto(phEl, src){
  if(!phEl) return;
  var img = phEl.querySelector('img.real');
  if(txt(src,'')){
    if(!img){ img=document.createElement('img'); img.className='real'; img.alt=''; phEl.insertBefore(img, phEl.firstChild); }
    img.src=src; img.style.display='';
  } else if(img){ img.style.display='none'; }
}

/* ---------------- The order of the day ----------------
   A single hairline above the group and one between rows, rather than a rule
   under every row: the long-list default that reads as a spec sheet. */
function renderTimeline(){
  var host=document.getElementById('tlItems'); if(!host) return;
  var items=wedding.timeline||[];
  var section=document.getElementById('schedule');
  if(section) section.style.display = items.length ? '' : 'none';

  var existing=host.querySelectorAll('.tl-item');
  if(existing.length===items.length){
    items.forEach(function(it,i){
      var t=existing[i].querySelector('.tl-time'), n=existing[i].querySelector('.tl-title');
      if(t) t.textContent=txt(it.time,'');
      if(n) n.textContent=txt(it.title,'');
    });
    return;
  }
  host.innerHTML = items.map(function(it){
    return '<div class="tl-item">'+
             '<div class="tl-time">'+esc(txt(it.time,''))+'</div>'+
             '<div class="tl-title">'+esc(txt(it.title,''))+'</div>'+
           '</div>';
  }).join('');
}

function renderGallery(){
  var grid=document.querySelector('.gallery-grid'); if(!grid) return;
  var items=wedding.gallery||[];
  var section=document.getElementById('gallery');
  if(section) section.style.display = items.length ? '' : 'none';

  var slots=grid.querySelectorAll('.g-item');
  if(slots.length===items.length){
    items.forEach(function(it,i){ fillPhoto(slots[i].querySelector('.ph'), it.photo); });
    return;
  }
  grid.innerHTML = items.map(function(it,i){
    var cls = i<4 ? ('g-item g'+(i+1)) : 'g-item g-extra';
    return '<div class="'+cls+'"><div class="ph">'+
           (txt(it.photo,'')?'<img class="real" src="'+esc(it.photo)+'" alt="'+esc(wedding.couple.personOne+' and '+wedding.couple.personTwo)+'">':'')+
           '<div class="ph-tag"></div></div></div>';
  }).join('');
}

function buildContent(){
  buildWedding();
  var d=data(), w=wedding;

  document.querySelectorAll('[data-sync="one"]').forEach(function(el){ el.textContent=w.couple.personOne; });
  document.querySelectorAll('[data-sync="two"]').forEach(function(el){ el.textContent=w.couple.personTwo; });
  document.querySelectorAll('[data-sync="date"]').forEach(function(el){ el.textContent=w.date.display; });
  document.title = w.couple.personOne+' and '+w.couple.personTwo+' - The Glasshouse';

  var mark=document.querySelector('.nav-mark');
  /* LUMA: the couple's initials. The venue's first word made "VILLA" or
     "THE" the mark of half the weddings on it. */
  if(mark) mark.textContent = [txt(d.partner1,''), txt(d.partner2,'')].map(function(n){ return n.charAt(0).toUpperCase(); }).filter(Boolean).join(' \u00b7 ');

  /* Whether the couple's own photographs are settled into the palette. Default
     on. Explicit false is respected. */
  document.body.classList.toggle('photos-as-taken', d.photoTone === false);

  /* THE BACKDROP. An uploaded hero photo wins; otherwise the chosen plate. */
  var back = resolveBackdrop(txt(d.heroPhoto,'') || txt(d.backdrop,''));
  ['heroBackdrop','ovShot'].forEach(function(id){
    var el=document.getElementById(id); if(el && el.getAttribute('src')!==back) el.src=back;
  });
  var cl=document.getElementById('clShot');
  if(cl){ var other = BACKDROPS[(BACKDROPS.indexOf(back)+1+BACKDROPS.length)%BACKDROPS.length] || BACKDROPS[1]; cl.src = other; }
  markBackdropChoice(back);

  /* Hero corner: two facts, each with its own line under a quiet label. */
  (function(){
    var when=document.getElementById('heroWhen'), where=document.getElementById('heroWhere');
    var dateLong = (function(){
      var p=String(txt(d.date,'')).split('-'); if(p.length!==3) return w.date.display;
      var M=['January','February','March','April','May','June','July','August',
             'September','October','November','December'];
      return 'The '+(+p[2])+ordinal(+p[2])+' of '+(M[+p[1]-1]||'');
    })();
    if(when)  when.innerHTML  = esc(dateLong)+'<b>'+esc(txt(d.time,''))+'</b>';
    if(where) where.innerHTML = esc(txt(d.venueName,''))+'<b>'+esc(lastPart(txt(d.venueAddress,'')))+'</b>';
  })();

  /* The wording a buyer can change. Every one of these has an input in the
     editor, and an input whose text never reaches the page is worse than no
     input at all. */
  setText('heroSub',      txt(d.heroQuote,''));
  setText('storyTitle',   txt(d.storyTitle,''));
  setText('schedHeading', txt(d.scheduleHeading,''));
  setText('rsvpPlusOneLabel', txt(d.rsvpPlusOneLabel,'Name of your guest'));

  /* UNDER GLASS. One line, split on its middle word so the connector can be
     set in amber at a smaller size. Two words means no connector to find. */
  (function(){
    /* LUMA: by default the couple themselves, "Ana and Boris", with the
       "and" in amber. The sample's "Warm in December" showed on every
       wedding, June ones included. */
    var line = txt(d.glassLine, [txt(d.partner1,''), 'and', txt(d.partner2,'')].join(' ')).split(/\s+/);
    var a=document.getElementById('word-you'), m=document.getElementById('story-amp'),
        b=document.getElementById('word-me');
    if(a && m && b){
      if(line.length >= 3){
        m.textContent = line[Math.floor(line.length/2)];
        a.textContent = line.slice(0, Math.floor(line.length/2)).join(' ');
        b.textContent = line.slice(Math.floor(line.length/2)+1).join(' ');
        m.style.display = '';
      } else {
        a.textContent = line[0]||''; b.textContent = line[1]||'';
        m.style.display = 'none';
      }
    }
    setText('story-us', txt(d.glassNote,''));
  })();

  setText('storyP1', txt(d.story1,''));
  setText('storyP2', txt(d.story2,''));

  setText('dayTime',  txt(d.time,''));
  setText('dayVenue', txt(d.venueName,''));
  /* The head of the label is a season, not the venue: Position already names
     that, and a label that says the same thing twice is a form, not an object. */
  setText('dayIssuer', seasonOf(txt(d.date,'')));
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

  /* Reply-by and the email fallback. The core stores both and no section on
     this page was showing either, so a guest never learned the deadline. */
  (function(){
    var by = txt(d.rsvpDeadline,''), pre = txt(d.rsvpDeadlinePrefix,'Kindly reply by');
    setText('rsvpDeadlineLine', by ? (pre+' '+by) : '');
    var mail = txt(d.rsvpEmailText,''), a = document.getElementById('rsvpEmailLink');
    if(a){
      a.textContent = mail;
      a.href = mail ? ('mailto:'+mail) : '#';
      a.style.display = mail ? '' : 'none';
    }
  })();
  var jl=document.getElementById('joinLabel'); if(jl) jl.textContent=txt(d.rsvpAttendanceLabel,'Will You Join Us?');

  var both = w.couple.personOne+' and '+w.couple.personTwo;
  setText('footNames', both + (w.date.year?(', '+w.date.year):''));
  setText('closeNames', both);

  /* The story frame keeps its own photograph, separate from the backdrop. */
  fillPhoto(document.querySelector('#heroPhoto .ph'), txt(d.storyPhoto,'')); /* LUMA: the couple's photo; no stock photo ships */

  buildCalendarLinks(d, w);
  renderTimeline();
  renderGallery();
  observeGlass();

  if(typeof window.handleRsvpGuestCountChange==='function'){ try{ window.handleRsvpGuestCountChange(); }catch(e){} }
}

function ordinal(n){
  if(n>3 && n<21) return 'th';
  return ({1:'st',2:'nd',3:'rd'})[n%10] || 'th';
}
function lastPart(s){ var p=String(s||'').split(','); return (p[p.length-1]||'').trim() || s; }

/* Calendar links. The core builds these in its own render pass, but that pass
   bails early on a design without its countdown markup, so the two links were
   left pointing at "#". */
function buildCalendarLinks(d, w){
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
    if(location.protocol==='file:'){
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
}

/* ============================================================
   MOTION
   ============================================================ */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   THE GLASS
   IntersectionObserver rather than a ScrollTrigger each: these are
   "arrive once" reveals and do not need the scroll engine. Motivated,
   not decorative: the whole design is about seeing through glass, and
   this is the moment it clears.
   ------------------------------------------------------------ */
function clearAllGlass(){
  document.querySelectorAll('.glass').forEach(function(el){ el.classList.add('cleared'); });
}

/* THE FAILSAFE THAT MATTERS MOST. Every section starts at opacity 0, so if the
   observer never runs the invitation is not merely static, it is BLANK. That is
   a far worse failure than no animation, so after twelve seconds everything is
   shown regardless of whether anything was ever observed. */
setTimeout(clearAllGlass, 12000);

let glassObserver = null;
function observeGlass(){
  if(reduced || !window.IntersectionObserver){ clearAllGlass(); return; }
  if(!glassObserver){
    glassObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        en.target.classList.add('cleared');
        glassObserver.unobserve(en.target);
      });
    }, { rootMargin:'0px 0px -10% 0px', threshold:0.12 });
  }
  document.querySelectorAll('.glass:not(.cleared)').forEach(function(el){ glassObserver.observe(el); });
}

/* ------------------------------------------------------------
   THE CONDENSATION

   The signature. A misted copy of the hero photograph sits over the sharp
   one, so wiping it erases holes and the picture comes through underneath.
   It mists back over slowly, the way a real pane does.

   THREE CANVASES, AND THE REASON WHY.

   The obvious build is one canvas: paint the mist, erase with
   destination-out, and re-mist by painting the mist again at a very low
   alpha every frame. That is what this was, and it is wrong. A canvas is
   eight bits per channel with premultiplied alpha, so every one of those
   low-alpha passes rounds; over a few hundred frames the rounding compounds
   into flat posterised patches with saturated green and red fringes. It
   looks like a corrupted JPEG, because arithmetically that is what it is.

   So nothing accumulates here. The mist is painted ONCE into an offscreen
   bitmap. The wipes go into a second offscreen bitmap used purely as a
   mask. The visible canvas is rebuilt from those two clean sources every
   frame that changes: draw mist, punch mask out of it, done. Re-misting is
   the mask being eaten away rather than the mist being layered on, which
   also means the expensive blur runs on resize instead of sixty times a
   second.
   ------------------------------------------------------------ */
(function(){
  var canvas = document.getElementById('fogCanvas');
  var hero   = document.getElementById('hero');
  var img    = document.getElementById('heroBackdrop');
  if(!canvas || !hero || !img) return;
  if(reduced){ canvas.style.display='none'; return; }

  var ctx  = canvas.getContext('2d');
  var mist = document.createElement('canvas'), mctx = mist.getContext('2d');
  var mask = document.createElement('canvas'), kctx = mask.getContext('2d');
  var dpr  = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0, h = 0, raf = null, dirty = false, idle = 0;

  /* Painted once per size change, never composited onto itself. */
  function paintMist(){
    if(!w || !h) return;
    mctx.setTransform(1,0,0,1,0,0);
    mctx.clearRect(0,0,mist.width,mist.height);
    mctx.setTransform(dpr,0,0,dpr,0,0);
    /* On the dark version the mist read as a pale wash. On a pale ground a wash
       is invisible and only flattens the picture, so what the fog does here is
       what fog on a bright window actually does: it blurs and it drains the
       colour. The wiped holes come back sharp and green. */
    try{ mctx.filter = 'blur(17px) brightness(1.03) saturate(.52)'; }catch(e){}
    var iw = img.naturalWidth || w, ih = img.naturalHeight || h;
    var scale = Math.max(w/iw, h/ih);
    var dw = iw*scale, dh = ih*scale;
    /* Drawn a touch larger than the frame so the blur never pulls transparent
       edges in and leaves a pale border round the hero. */
    mctx.drawImage(img, (w-dw)*0.52 - 24, (h-dh)*0.42 - 24, dw+48, dh+48);
    mctx.filter = 'none';
    mctx.fillStyle = 'rgba(240,244,238,0.10)';
    mctx.fillRect(0,0,w,h);
  }

  /* Rebuild the visible canvas from the two clean bitmaps. One composite,
     from sources that never change, so there is nothing to drift. */
  function compose(){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(mist,0,0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask,0,0);
    ctx.globalCompositeOperation = 'source-over';
  }

  function size(){
    var r = hero.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    var pw = Math.round(w*dpr), ph = Math.round(h*dpr);
    canvas.width = mist.width = mask.width  = pw;
    canvas.height= mist.height= mask.height = ph;
    canvas.style.width  = w+'px';
    canvas.style.height = h+'px';
    kctx.setTransform(dpr,0,0,dpr,0,0);
    paintMist();
    compose();
  }

  /* Erase where the reader touches - into the MASK, not into the picture.
     A soft brush, so the edge of the wipe is a smear rather than a cut-out. */
  function wipe(x, y, silent){
    var r = Math.max(52, Math.min(w,h) * 0.085);
    var g = kctx.createRadialGradient(x,y,0, x,y,r);
    g.addColorStop(0,   'rgba(255,255,255,0.62)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.26)');
    g.addColorStop(1,   'rgba(255,255,255,0)');
    kctx.fillStyle = g;
    kctx.beginPath(); kctx.arc(x,y,r,0,Math.PI*2); kctx.fill();
    dirty = true; idle = 0;
    if(!silent) document.body.classList.add('wiped');
  }

  var last = null;
  function onMove(e){
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if(x<0||y<0||x>w||y>h){ last=null; return; }
    /* Interpolate between samples or a fast drag leaves dots, not a smear. */
    if(last){
      var dx=x-last.x, dy=y-last.y, d=Math.hypot(dx,dy), steps=Math.min(24, Math.floor(d/14));
      for(var i=1;i<=steps;i++) wipe(last.x+dx*(i/steps), last.y+dy*(i/steps));
    }
    wipe(x,y);
    last = {x:x,y:y};
  }
  canvas.addEventListener('pointermove', onMove, { passive:true });
  canvas.addEventListener('pointerdown', onMove, { passive:true });
  canvas.addEventListener('pointerleave', function(){ last=null; }, { passive:true });

  /* It mists back over, and only while the hero is on screen, so an invisible
     canvas is never costing frames. */
  var heroVisible = true;
  if(window.IntersectionObserver){
    new IntersectionObserver(function(en){ heroVisible = en[0].isIntersecting; },
      { threshold:0 }).observe(hero);
  }

  function tick(){
    raf = requestAnimationFrame(tick);
    if(!heroVisible || !dirty) return;

    /* Eat the mask away rather than painting mist on top of mist. Low-alpha
       rounding stalls this just short of empty, which is what the idle count
       is for: once it has clearly finished, the mask is hard-cleared and the
       loop goes quiet until the reader touches the glass again. */
    kctx.setTransform(1,0,0,1,0,0);
    kctx.globalCompositeOperation = 'destination-out';
    kctx.fillStyle = 'rgba(0,0,0,0.014)';
    kctx.fillRect(0,0,mask.width,mask.height);
    kctx.globalCompositeOperation = 'source-over';
    kctx.setTransform(dpr,0,0,dpr,0,0);
    compose();

    if(++idle > 900){
      kctx.setTransform(1,0,0,1,0,0);
      kctx.clearRect(0,0,mask.width,mask.height);
      kctx.setTransform(dpr,0,0,dpr,0,0);
      compose();
      dirty = false; idle = 0;
    }
  }

  /* A hand goes across the glass once, by itself, a beat after the page
     settles. Two jobs: it is the first thing that moves, and it teaches the
     gesture without a tooltip explaining it. Then it mists back and the
     reader can do it themselves. */
  function demoWipe(){
    var t0 = 0, dur = 1500;
    var y0 = h*0.60, y1 = h*0.38, x0 = -w*0.06, x1 = w*1.06;
    function frame(ts){
      if(!t0) t0 = ts;
      var p = Math.min(1, (ts-t0)/dur);
      var e = p<0.5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;
      var x = x0 + (x1-x0)*e;
      var y = y0 + (y1-y0)*e + Math.sin(e*Math.PI)*h*0.05;
      wipe(x, y, true);
      wipe(x, y - h*0.09, true);
      wipe(x, y + h*0.09, true);
      compose();
      if(p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function start(){
    size();
    if(!raf) tick();
    setTimeout(function(){ if(!document.body.classList.contains('wiped')) demoWipe(); }, 1900);
  }
  if(img.complete && img.naturalWidth) start();
  else img.addEventListener('load', start, { once:true });
  /* A backdrop swap in the editor repaints with the new picture. */
  window.__repaintGlass = function(){ if(img.complete && img.naturalWidth){ paintMist(); compose(); } };

  window.addEventListener('resize', (function(){
    var t=null, lw=window.innerWidth;
    return function(){
      if(window.innerWidth===lw) return; lw=window.innerWidth;
      clearTimeout(t); t=setTimeout(size, 200);
    };
  })());
})();


/* ------------------------------------------------------------
   THE LIGHT

   The page is one afternoon in a glasshouse. Scrolling it is walking
   through that afternoon: flat four o'clock daylight at the top, golden
   hour by the order of the day, dusk through the photographs, lamplight
   at the RSVP. The sun crosses the panes left to right as you go.

   Driven by scroll POSITION rather than by a clock, so it is the reader
   moving through the evening and not a slideshow playing at them. Four
   fixed layers crossfade on opacity alone - no paint, no layout - and the
   whole thing is one rAF-throttled listener.
   ------------------------------------------------------------ */
(function(){
  var host = document.querySelector('.daylight');
  if(!host) return;
  var layers = host.querySelectorAll('b');
  if(layers.length < 4) return;

  /* Where each hour of the evening sits along the page. Not evenly spaced:
     golden hour is given the most room because that is where the invitation
     itself is, and the last stretch goes dark quickly the way dusk does. */
  var STOPS = [0.00, 0.30, 0.62, 0.88];

  function weights(p){
    var w = [0,0,0,0];
    if(p <= STOPS[0]){ w[0]=1; return w; }
    if(p >= STOPS[3]){ w[3]=1; return w; }
    for(var i=0;i<3;i++){
      if(p >= STOPS[i] && p <= STOPS[i+1]){
        var t = (p-STOPS[i]) / (STOPS[i+1]-STOPS[i]);
        /* smoothstep, so no seam is visible where two hours meet */
        t = t*t*(3-2*t);
        w[i] = 1-t; w[i+1] = t;
        return w;
      }
    }
    return w;
  }

  var root = document.documentElement;
  var ticking = false, lastP = -1;

  function apply(){
    ticking = false;
    var doc = document.documentElement;
    var span = doc.scrollHeight - window.innerHeight;
    var p = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0;
    if(Math.abs(p - lastP) < 0.0015) return;
    lastP = p;

    var w = weights(p);
    for(var i=0;i<4;i++) layers[i].style.opacity = w[i].toFixed(3);

    /* The sun itself. It travels further than the page is wide so it leaves
       at the end rather than parking in the corner. */
    root.style.setProperty('--sun-x', (14 + p*78).toFixed(1) + '%');
  }

  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  }

  if(reduced){
    /* Still lit, still an evening - it simply does not move. Golden hour,
       because that is the light the invitation is written in. */
    layers[0].style.opacity = '0';
    layers[1].style.opacity = '1';
    root.style.setProperty('--sun-x', '46%');
    return;
  }

  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll, { passive:true });
  apply();
  /* Sections reveal as they clear, so the page gets taller after load and the
     first reading of scrollHeight is short. Re-read once things have settled. */
  setTimeout(function(){ lastP = -1; apply(); }, 1200);
})();
/* ------------------------------------------------------------
   DEPTH THROUGH THE GLASS
   The photograph drifts slower than the page as you leave the hero, which is
   what looking through a window while you walk actually does. Scrubbed, so it
   is tied to the reader's own scrolling rather than playing at them.
   ------------------------------------------------------------ */
(function(){
  if(reduced || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  var shot = document.querySelector('#hero .shot');
  if(!shot) return;
  gsap.to(shot, {
    yPercent: 14, scale: 1.06, ease: 'none',
    scrollTrigger: { trigger:'#hero', start:'top top', end:'bottom top',
                     scrub: 0.4, invalidateOnRefresh: true }
  });
})();

/* wedding-core.js writes an inline padding-top onto #main to clear its fixed
   studio bar, and the stylesheet cancels it. What the hero still needs is the
   bar's real height, measured rather than assumed, because the bar wraps to two
   rows on a narrow window. In guest view it is 0. */
function syncBarHeight(){
  var bar = document.getElementById('builder-bar');
  var h = 0;
  if(bar && !document.body.classList.contains('guest-mode')){
    var cs = getComputedStyle(bar);
    if(cs.display !== 'none' && cs.position === 'fixed') h = bar.offsetHeight;
  }
  document.documentElement.style.setProperty('--bar-h', h+'px');
}

/* ------------------------------------------------------------
   NAV BACKDROP
   The index is fixed, so once the page scrolls under it the mark would sit on
   whatever heading is passing. A sentinel toggles the backdrop, so there is no
   scroll listener and it works with the scroll engine disabled.
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
   The glass is fogged, then it clears, and the names are behind it. It ends on
   the hero's own photograph so the overlay dissolves onto the same picture.
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
  document.body.classList.add('arrived');
  /* Set the hero's fog directly as well as via the class. The class alone is
     enough in a healthy page, but this is the one element that would leave the
     invitation looking permanently out of focus if anything went wrong. */
  var fog = document.getElementById('shotFog');
  if(fog) fog.style.opacity = '0';
  syncBarHeight();
  observeGlass();
}

function startIntro(){
  if(reduced || !window.gsap || !introEl){ finishEntry(); return; }
  document.body.style.overflow='hidden';
  document.body.classList.remove('arrived');

  gsap.set('#ovFog', { opacity:1 });
  gsap.set(['.ov-eyeb','.ov-amp','.ov-names span[data-sync]'], { opacity:0, y:16 });
  gsap.set('#ovShot', { scale:1.06, transformOrigin:'50% 45%' });

  /* The end state, reachable without the animation. rAF is throttled in a
     background tab, and a guest must never be left looking at fogged glass.
     The timeline is killed first: writing final values while it still owns
     them achieves nothing, because it overwrites them on its next tick. */
  var tl;
  function settle(){
    if(tl){ try{ tl.kill(); }catch(e){} tl = null; }
    finishEntry();
  }
  var guard = setTimeout(settle, 6000);

  tl = gsap.timeline({ onComplete:function(){ clearTimeout(guard); settle(); } });
  tl.to('#loaderFill', { width:120, duration:0.55, ease:'power2.inOut' })
    .to(loaderEl, { opacity:0, duration:0.4, onComplete:function(){ if(loaderEl) loaderEl.style.display='none'; } })
    /* the glass clears */
    .to('#ovFog', { opacity:0, duration:1.7, ease:'power2.inOut' }, '-=0.1')
    .to('#ovShot', { scale:1, duration:2.4, ease:'power2.out' }, '<')
    .to('.ov-eyeb', { opacity:1, y:0, duration:0.6, ease:'power2.out' }, '-=1.3')
    .to('.ov-names span[data-sync]', { opacity:1, y:0, duration:0.8, stagger:0.16, ease:'power3.out' }, '-=0.9')
    .to('.ov-amp', { opacity:1, y:0, duration:0.5, ease:'power2.out' }, '-=0.6')
    .to({}, { duration:0.8 })
    .to(introEl, { opacity:0, duration:0.9, ease:'power2.inOut' });
}

/* Two failsafes: the entry starts even if `load` never fires, and it is
   abandoned outright after six seconds. */
var entryFailsafe = setTimeout(function(){ finishEntry(); }, 6500);
var entryStarted = false;
function beginOnce(){ if(entryStarted) return; entryStarted = true; startIntro(); }
window.addEventListener('load', beginOnce);
setTimeout(function(){ if(!entryStarted) beginOnce(); }, 2600);
if(introSkip) introSkip.addEventListener('click', function(){ clearTimeout(entryFailsafe); finishEntry(); });
if(reduced) finishEntry();

window.addEventListener('load', syncBarHeight);
window.addEventListener('resize', (function(){
  var t=null, lastW=window.innerWidth;
  return function(){
    if(window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(t); t=setTimeout(syncBarHeight, 160);
  };
})());

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
   THE BACKDROP PICKER
   ------------------------------------------------------------ */
function markBackdropChoice(src){
  document.querySelectorAll('#cfg-backdrops .gh-bd').forEach(function(b){
    var on = b.getAttribute('data-backdrop') === src;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
(function(){
  var wrap = document.getElementById('cfg-backdrops');
  if(!wrap) return;
  wrap.addEventListener('click', function(e){
    var b = e.target.closest('.gh-bd');
    if(!b || typeof invitationData !== 'object') return;
    invitationData.backdrop = b.getAttribute('data-backdrop');
    /* Choosing a plate clears any uploaded photograph, or the upload would
       silently keep winning and the click would appear to do nothing. */
    invitationData.heroPhoto = '';
    var hidden = document.getElementById('cfg-hero-photo');
    if(hidden) hidden.value = '';
    if(typeof syncHeroPhotoPreview === 'function'){ try{ syncHeroPhotoPreview(''); }catch(err){} }
    buildContent();
    /* the misted copy has to be repainted from the new picture */
    setTimeout(function(){ if(window.__repaintGlass) window.__repaintGlass(); }, 260);
  });
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

/* THE CORE DOES NOT WIRE THE RSVP FORM. wedding-core.js defines submitRSVP()
   but never attaches it: designs 4 to 8 call it from an onsubmit attribute in
   their own markup. Without either, the browser performs a NATIVE POST and the
   whole invitation reloads. This design writes its own. */
(function(){
  const form    = document.getElementById('rsvp-form');
  const closing = document.getElementById('closing');
  const errorEl = document.getElementById('rsvp-error');
  const doneEl  = document.getElementById('rsvp-confirmed');
  if(!form) return;

  let sent = false;

  function show(yes){
    if(!closing) return;
    closing.classList.add('on');
    closing.setAttribute('aria-hidden','false');
    setText('closeText', yes ? 'See you there' : 'You will be missed');
    setText('closeSub',  yes ? 'With love,' : 'Thinking of you on the day,');
    document.body.style.overflow = 'hidden';

    var copy = document.querySelector('.cl-copy');
    var shot = document.getElementById('clShot');
    var dismiss = document.getElementById('closeDismiss');

    /* Focus moves FIRST, before the reduced-motion early return below. It used
       to sit at the end of the animated path only, so with reduced motion on,
       an aria-modal dialog opened and left focus behind it in the hidden form.
       While it is open, Tab is kept inside it - there is exactly one control. */
    if(dismiss) dismiss.focus();
    closing.addEventListener('keydown', function(e){
      if(e.key === 'Tab'){ e.preventDefault(); if(dismiss) dismiss.focus(); }
      if(e.key === 'Escape' && dismiss) dismiss.click();
    });

    if(reduced || !window.gsap){ if(copy) copy.style.opacity = 1; return; }

    var tl;
    function settle(){
      if(tl){ try{ tl.kill(); }catch(e){} tl=null; }
      if(copy) copy.style.opacity = 1;
      if(shot) gsap.set(shot, { scale:1, filter:'blur(0px)' });
    }
    var guard = setTimeout(settle, 3600);

    gsap.set(shot, { scale:1.08, filter:'blur(14px)', transformOrigin:'50% 45%' });
    tl = gsap.timeline({ onComplete:function(){ clearTimeout(guard); settle(); } });
    tl.to(shot, { filter:'blur(0px)', scale:1, duration:1.8, ease:'power2.out' })
      .to(copy, { opacity:1, duration:0.9, ease:'power2.out' }, '-=1.0');

  }

  function hide(){
    if(!closing) return;
    closing.classList.remove('on');
    closing.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  function handleRsvp(e){
    if(e && e.preventDefault) e.preventDefault();
    if(sent) return;

    var nameEl = document.getElementById('rsvpName');
    var name = nameEl ? nameEl.value.trim() : '';
    var att  = form.querySelector('input[name="attending"]:checked');

    if(!name){
      if(errorEl){
        errorEl.textContent = txt(data().rsvpErrorText,'Please add your name so we know who is replying.');
        errorEl.style.display = '';
      }
      if(nameEl) nameEl.focus();
      return;
    }
    if(errorEl) errorEl.style.display = 'none';
    sent = true;

    var yes = !att || att.value === 'yes';

    /* LUMA: the reply goes to /api/rsvp (luma-bridge.js answers this POST):
       wait for it, so a guest is never told it was sent when it wasn't. */
    // read the answers BEFORE disabling the fields: disabled fields aren't sent
    var params = new URLSearchParams(new FormData(form)).toString();
    var controls = form.querySelectorAll('input, textarea, button, select');
    controls.forEach(function(el){ el.disabled = true; });
    function failed(message){
      sent = false;
      controls.forEach(function(el){ el.disabled = false; });
      if(errorEl){ errorEl.textContent = message || "That didn't send. Please try again."; errorEl.style.display = ''; }
    }
    fetch('/', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: params })
      .then(function(res){
        if(!res.ok) return res.json().then(function(b){ failed(b && b.error); }, function(){ failed(); });
        form.hidden = true;
        if(doneEl){
          doneEl.hidden = false;
          setText('rsvpDoneSub', yes ? 'We will see you there.' : 'You will be missed.');
        }
        show(yes);
      })
      .catch(function(){ failed(); });
  }

  form.addEventListener('submit', handleRsvp);

  var dismiss = document.getElementById('closeDismiss');
  if(dismiss) dismiss.addEventListener('click', hide);
  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape' && closing && closing.classList.contains('on')) hide();
  });

  var again = document.getElementById('rsvpAgain');
  if(again) again.addEventListener('click', function(){
    sent = false;
    form.querySelectorAll('input, textarea, button, select').forEach(function(el){ el.disabled = false; });
    form.hidden = false;
    if(doneEl) doneEl.hidden = true;
    var n = document.getElementById('rsvpName'); if(n) n.focus();
  });
})();

/* ============================================================
   HOOKS the shared core calls by name.
   ============================================================ */
window.renderInvitationFromData = function(){ buildContent(); };
window.renderScheduleTimeline = function(){ buildWedding(); renderTimeline(); };
window.renderGalleryPublic    = function(){ buildWedding(); renderGallery(); observeGlass(); };
window.renderFaqPublic        = function(){};   /* this design has no FAQ section */

/* THE WORDING FIELDS. wedding-core.js owns the cfg-* inputs and NOTHING else -
   it has no handler for data-mp-field at all - so every design has to fill
   these, write them back, and repaint on its own. Skip this and roughly thirty
   inputs in the editor look completely normal and silently write nowhere. */
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

/* The core reads a FIXED list of cfg-* ids, so fields this design adds have to
   be carried in and out by hand. Both directions, or the setting is lost on a
   share link and on export. */
(function(){
  var coreSync = window.syncDataToInputs;
  window.syncDataToInputs = function(){
    if(typeof coreSync === 'function') coreSync.apply(this, arguments);
    syncMpFields();
    var t = document.getElementById('cfg-photo-tone');
    if(t) t.checked = (data().photoTone !== false);
    markBackdropChoice(resolveBackdrop(txt(data().heroPhoto,'') || txt(data().backdrop,'')));
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
  entryFailsafe = setTimeout(function(){ finishEntry(); }, 6500);
  document.body.style.overflow='hidden';
  window.scrollTo(0,0);
  if(loaderEl){ loaderEl.style.display=''; loaderEl.style.opacity='1'; }
  if(window.gsap) gsap.set('#loaderFill', { width:0 });
  introEl.style.display=''; introEl.style.opacity='1';
  try{ startIntro(); }catch(e){ finishEntry(); }
};

/* Guest preview must SHOW the opening, exactly as a guest gets it. The core's
   enableGuestMode calls resetEnvelopeIntroInstant(), which bails out when there
   is no #envelope-box-el - this design has none, so preview would otherwise
   drop straight onto the page and look like nothing happened. */
(function(){
  var coreToggle = window.toggleGuestPreview;
  if(typeof coreToggle !== 'function') return;
  window.toggleGuestPreview = function(){
    var was = document.body.classList.contains('guest-mode');
    coreToggle.apply(this, arguments);
    var now = document.body.classList.contains('guest-mode');
    if(now && !was){ try{ window.resetEnvelopeIntro(); }catch(e){} }
    else if(!now && was){ finishEntry(); }
    syncBarHeight();
  };
})();

/* ---------- Events editor: no icons ----------
   This design's schedule prints a time and a name, never an icon. The SHARED
   drawer still renders an icon picker because other designs use it, so strip
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
syncBarHeight();
observeGlass();
