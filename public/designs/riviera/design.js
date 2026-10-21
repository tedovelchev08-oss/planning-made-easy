/* ============================================================
   RIEN NE VA PLUS - the wheel, the opening, and the seam onto the core.

   The core owns invitationData (declared inline in index.html) and everything
   outside the design: drawer, save, share, export, music. This file pours the
   data into the page and runs the wheel.

   THE ONE INPUT THAT DRIVES THE WHEEL IS THE WEDDING DATE. Its day of the month
   is the winning pocket (a European wheel has 0-36, so every day 1-31 exists),
   and the wheel is rebuilt whenever the date changes in the editor.

   STATES
     intro    the wheel is lifted to the middle of the screen over a blurred
              copy of the photograph, waiting for a tap
     spinning rotor and ball animating
     landed   ball in the pocket, the wheel has become the thin dial in the
              hero, the opening overlay is gone
   Every path into "landed" (spin, Skip, reduced motion, replaying the editor,
   a resize across the desktop breakpoint) ends in placeLanded() or toHero(),
   and toHero() itself finishes by calling placeLanded(), so the end state is
   written in exactly one place.
   ============================================================ */
function txt(v,d){ v=(v==null?'':String(v)).trim(); return v||d||''; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function setText(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
function data(){ return (typeof invitationData==='object'&&invitationData)?invitationData:{}; }
function pad2(n){ n=+n; return (n<10?'0':'')+n; }

/* The pristine sample, for the drawer's "Start over". Captured at parse time,
   before the core's DOMContentLoaded init merges any shared-link payload. */
var SAMPLE = (function(){ try{ return JSON.stringify(data()); }catch(e){ return null; } })();

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DESKTOP_Q = window.matchMedia('(min-width:900px) and (min-aspect-ratio:1/1)');

/* ------------------------------------------------------------
   DATE
   ------------------------------------------------------------ */
var ORD = ['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth',
  'eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth',
  'nineteenth','twentieth','twenty-first','twenty-second','twenty-third','twenty-fourth','twenty-fifth',
  'twenty-sixth','twenty-seventh','twenty-eighth','twenty-ninth','thirtieth','thirty-first'];
var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function weddingDate(){
  var p = String(txt(data().date,'')).split('-');
  if(p.length !== 3) return null;
  var dt = new Date(+p[0], +p[1]-1, +p[2]);
  return isNaN(dt) ? null : dt;
}
function weddingDay(){ var dt = weddingDate(); return dt ? dt.getDate() : 12; }
/* "Saturday, the twelfth of June" (+ year). An explicit dateWords from the
   drawer always wins, so the line can be written in any language. */
function dateWords(withYear){
  var own = txt(data().dateWords,'');
  if(own) return own;
  var dt = weddingDate();
  if(!dt) return '';
  var s = DAYS[dt.getDay()]+', the '+ORD[dt.getDate()]+' of '+MONTHS[dt.getMonth()];
  return withYear ? s+' '+dt.getFullYear() : s;
}

/* ------------------------------------------------------------
   THE WHEEL
   Drawn once as SVG: a static bowl (walnut rim, ball track, deflectors), a
   rotor (37 pockets, frets, numbers, cone and turret), and the ball. The
   layers are separate groups so a rendered, photoreal wheel can replace the
   bowl and rotor artwork later without touching any of the motion below.
   ------------------------------------------------------------ */
var ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
var REDS  = {1:1,3:1,5:1,7:1,9:1,12:1,14:1,16:1,18:1,19:1,21:1,23:1,25:1,27:1,30:1,32:1,34:1,36:1};
var STEP  = 360 / ORDER.length;
var NS    = 'http://www.w3.org/2000/svg';
var R_TRACK = 229, R_POCKET = 161, R_BEZEL = 188;

/* Where the ball parks in the hero: clear paper beside the first name on a
   phone, above it on the desktop split. */
function heroAngle(){ return DESKTOP_Q.matches ? 28 : 60; }

function pt(r, a){ var t = a*Math.PI/180; return [r*Math.sin(t), -r*Math.cos(t)]; }
function sector(r0, r1, a0, a1){
  var A=pt(r1,a0), B=pt(r1,a1), C=pt(r0,a1), D=pt(r0,a0);
  return 'M'+A[0]+' '+A[1]+'A'+r1+' '+r1+' 0 0 1 '+B[0]+' '+B[1]+'L'+C[0]+' '+C[1]+'A'+r0+' '+r0+' 0 0 0 '+D[0]+' '+D[1]+'Z';
}

function buildWheelSvg(day, angle){
  var win = ORDER.indexOf(day);
  var defs =
    '<defs>'+
      '<radialGradient id="gWood" cx="50%" cy="50%" r="50%"><stop offset="78%" stop-color="#6b3418"/><stop offset="90%" stop-color="#8d4a24"/><stop offset="97%" stop-color="#5a2a12"/><stop offset="100%" stop-color="#3f1d0c"/></radialGradient>'+
      '<radialGradient id="gTrack" cx="50%" cy="50%" r="50%"><stop offset="80%" stop-color="#b98252"/><stop offset="92%" stop-color="#d4a271"/><stop offset="100%" stop-color="#9c6438"/></radialGradient>'+
      '<linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dc9a"/><stop offset=".45" stop-color="#c39a45"/><stop offset=".7" stop-color="#e9cb7f"/><stop offset="1" stop-color="#8f6a26"/></linearGradient>'+
      '<radialGradient id="gCone" cx="42%" cy="38%" r="70%"><stop offset="0" stop-color="#a5602f"/><stop offset=".55" stop-color="#6e3519"/><stop offset="1" stop-color="#3f1c0b"/></radialGradient>'+
      '<radialGradient id="gDome" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff3c8"/><stop offset=".35" stop-color="#e2be6c"/><stop offset="1" stop-color="#7d5a1d"/></radialGradient>'+
      '<radialGradient id="gBall" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#efe8da"/><stop offset="1" stop-color="#a99f8c"/></radialGradient>'+
      '<radialGradient id="gGloss" cx="34%" cy="22%" r="62%"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'+
      '<pattern id="gGrain" width="520" height="6" patternUnits="userSpaceOnUse"><path d="M0 1.5h520M0 4.2h520" stroke="#2a1206" stroke-opacity=".10" stroke-width=".7"/></pattern>'+
      '<filter id="fBall" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="1.2" dy="2.2" stdDeviation="1.6" flood-color="#1b0e05" flood-opacity=".45"/></filter>'+
    '</defs>';

  var bowl = '<g class="bowl">'+
    '<circle r="258" fill="url(#gWood)"/><circle r="258" fill="url(#gGrain)" opacity=".7"/>'+
    '<circle r="244" fill="none" stroke="url(#gGold)" stroke-width="3.5"/>'+
    '<circle r="241" fill="url(#gTrack)"/><circle r="241" fill="url(#gGrain)" opacity=".35"/>'+
    '<circle r="206" fill="#4a230f"/>';
  for(var i=0;i<8;i++){
    var a=i*45+22.5, q=pt(218,a);
    bowl += '<path d="M0 -9L4 0L0 9L-4 0Z" fill="url(#gGold)" transform="translate('+q[0]+' '+q[1]+') rotate('+a+')"/>';
  }
  bowl += '</g>';

  var rotor = '<g class="rotor">';
  ORDER.forEach(function(n, i){
    var a=i*STEP, fill = n===0 ? '#1f7a4c' : (REDS[n] ? '#a8202b' : '#1c1915');
    rotor += '<path class="pocket'+(i===win?' win':'')+'" d="'+sector(146,200,a-STEP/2,a+STEP/2)+'" fill="'+fill+'"/>';
  });
  rotor += '<path class="win-glow" d="'+sector(146,200,win*STEP-STEP/2,win*STEP+STEP/2)+'" fill="none" stroke="#ffe7a3" stroke-width="3"/>';
  for(var j=0;j<ORDER.length;j++){
    var b=j*STEP+STEP/2, p0=pt(146,b), p1=pt(200,b);
    rotor += '<line class="fret" x1="'+p0[0]+'" y1="'+p0[1]+'" x2="'+p1[0]+'" y2="'+p1[1]+'" stroke="url(#gGold)" stroke-width="1.6"/>';
  }
  rotor += '<circle r="200" fill="none" stroke="url(#gGold)" stroke-width="3"/>'+
           '<circle r="176" fill="none" stroke="url(#gGold)" stroke-width="1.2"/>'+
           '<circle class="fret" r="146" fill="none" stroke="url(#gGold)" stroke-width="2.2"/>'+
           '<path class="win-mark" d="'+sector(176,200,win*STEP-STEP/2,win*STEP+STEP/2)+'" fill="url(#gGold)"/>'+
           /* The day, large and upright, just outside the dial. Counter-rotated
              by the angle the pocket will finally rest at. */
           '<text class="win-label" transform="rotate('+(win*STEP)+') translate(0 -236) rotate('+(-angle)+')" text-anchor="middle" dominant-baseline="central" font-family="Gloock, serif" font-size="34" fill="#8a6a26">'+day+'</text>';
  ORDER.forEach(function(n, i){
    rotor += '<text class="num'+(i===win?' win':'')+'" transform="rotate('+(i*STEP)+') translate(0 -188)" text-anchor="middle" dominant-baseline="central" font-family="Gloock, serif" font-size="14" fill="#f4ecd8">'+n+'</text>';
  });
  rotor += '<g class="cone"><circle r="145" fill="url(#gCone)"/><circle r="145" fill="url(#gGrain)" opacity=".45"/>'+
           '<circle r="70" fill="none" stroke="url(#gGold)" stroke-width="2"/>';
  for(var k=0;k<4;k++){
    rotor += '<g transform="rotate('+(k*90)+')"><rect x="-3.5" y="-66" width="7" height="58" rx="3.5" fill="url(#gDome)"/><circle cy="-68" r="7.5" fill="url(#gDome)"/></g>';
  }
  rotor += '<circle r="20" fill="url(#gDome)"/><circle r="7" fill="#fff6d8" opacity=".7" cx="-5" cy="-6"/></g></g>';

  var gloss = '<circle class="bowl" r="258" fill="url(#gGloss)" pointer-events="none"/>';
  var ball  = '<g class="ball"><circle r="7.5" fill="url(#gBall)" filter="url(#fBall)"/></g>';

  var svg = document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','-262 -262 524 524');
  svg.setAttribute('aria-hidden','true');
  svg.innerHTML = defs + bowl + rotor + gloss + ball;
  return svg;
}

/* ------------------------------------------------------------
   WHEEL STATE
   ------------------------------------------------------------ */
var backEl  = document.getElementById('wheelBack');
var frontEl = document.getElementById('wheelFront');
var svgBack = null;
var phase   = 'intro';
var built   = { day:null, angle:null };
var spinTimers = [];

function rotorOf(svg){ return svg.querySelector('.rotor'); }
function ballOf(svg){ return svg.querySelector('.ball'); }
function setRotor(svg, a){ rotorOf(svg).setAttribute('transform','rotate('+a+')'); }
function setBall(svg, a, r){ ballOf(svg).setAttribute('transform','rotate('+a+') translate(0 '+(-r)+')'); }

/* Rebuild the drawing if the day (or the breakpoint angle) changed. */
function ensureWheel(){
  if(!backEl) return;
  var day = weddingDay(), angle = heroAngle();
  if(svgBack && built.day === day && built.angle === angle) return;
  backEl.innerHTML = '';
  svgBack = buildWheelSvg(day, angle);
  backEl.appendChild(svgBack);
  built = { day:day, angle:angle };
}

function cloneFront(){
  if(!frontEl || !svgBack) return;
  frontEl.innerHTML = '';
  /* The clone's gradient ids duplicate the original's; both resolve to
     identical definitions, so that is harmless. */
  frontEl.appendChild(svgBack.cloneNode(true));
}

function clearSpinTimers(){ spinTimers.forEach(clearTimeout); spinTimers = []; }

/* The end state, written in one place. */
function placeLanded(){
  clearSpinTimers();
  phase = 'landed';
  ensureWheel();
  var angle = heroAngle(), P = ORDER.indexOf(weddingDay()) * STEP;
  setRotor(svgBack, angle - P);
  setBall(svgBack, angle, R_BEZEL);
  svgBack.classList.add('ring','won');
  cloneFront();
  backEl.classList.remove('morphing');
  backEl.style.transform = '';
  document.body.classList.remove('intro-on','intro-leaving');
  document.body.classList.add('dial-settled');
  backEl.setAttribute('tabindex','-1');
  fitNames();
}

/* ---- the opening ---- */
function introTransform(){
  backEl.style.transform = 'none';
  var r = backEl.getBoundingClientRect();
  var target = Math.min(innerWidth*.86, innerHeight*.58, 600);
  var s = target / r.width;
  var dx = innerWidth/2 - (r.left + r.width/2);
  var dy = innerHeight/2 - (r.top + r.height/2);
  return 'translate('+dx+'px,'+dy+'px) scale('+s+')';
}

var spinParams = null;
function spinStartAngles(){
  var angle = heroAngle(), P = ORDER.indexOf(weddingDay()) * STEP;
  var R_FINAL = angle - P, R_START = R_FINAL - 2.6*360;
  return { P:P, R_FINAL:R_FINAL, R_START:R_START };
}

function enterIntro(){
  clearSpinTimers();
  phase = 'intro';
  ensureWheel();
  svgBack.classList.remove('ring','won');
  if(frontEl) frontEl.innerHTML = '';
  document.body.classList.remove('dial-settled','intro-leaving');
  document.body.classList.add('intro-on');
  backEl.classList.remove('morphing');
  backEl.setAttribute('tabindex','0');

  spinParams = spinStartAngles();
  var T1 = 2400, OFF = 34, DB = 4*360;
  spinParams.B_START = rotorAt(T1) + spinParams.P + OFF + DB;
  setRotor(svgBack, spinParams.R_START);
  setBall(svgBack, spinParams.B_START, R_TRACK);

  var d = data();
  setText('introLine', txt(d.introCall,'Faites vos jeux'));
  var btn = document.getElementById('introSpin');
  if(btn){ btn.disabled = false; btn.textContent = txt(d.introButton,'Spin the wheel'); }

  window.scrollTo(0,0);
  backEl.style.transform = introTransform();
}

/* LUMA: shortened from 6.2 s; the whole opening ran 11.5 s before the
   invitation, which is long to hold a guest at a gaming table */
var T = 4400, T1 = 2400, TB = 800, OFF = 34, DB = 4*360;
function easeOutCubic(u){ return 1 - Math.pow(1-u, 3); }
function freeEase(u){ return .82*(1-Math.pow(1-u,2)) + .18*u; }   /* still rolling when it drops */
function rotorAt(t){
  var s = spinParams;
  return s.R_START + (s.R_FINAL - s.R_START) * easeOutCubic(Math.min(t/T, 1));
}

function frame(t){
  var rot = rotorAt(t), P = spinParams.P;
  setRotor(svgBack, rot);
  if(t < T1){
    setBall(svgBack, spinParams.B_START - DB*freeEase(t/T1), R_TRACK);
  } else if(t < T1+TB){
    var s = (t-T1)/TB;
    var off = OFF*Math.pow(1-s,2) + 7*Math.sin(s*Math.PI*3)*(1-s);
    var rad = R_POCKET + (R_TRACK-R_POCKET)*Math.pow(1-s,2)*Math.abs(Math.cos(s*Math.PI*2.5));
    setBall(svgBack, rot+P+off, rad);
  } else {
    setBall(svgBack, rot+P, R_POCKET);
  }
}

function swapLine(text, delay){
  spinTimers.push(setTimeout(function(){
    var line = document.getElementById('introLine'); if(!line) return;
    line.classList.add('fade');
    spinTimers.push(setTimeout(function(){ line.textContent = text; line.classList.remove('fade'); }, 450));
  }, delay));
}

function spin(){
  if(phase !== 'intro') return;
  phase = 'spinning';
  var btn = document.getElementById('introSpin'); if(btn) btn.disabled = true;
  swapLine('', 0);
  var t0 = null;
  function tick(now){
    if(phase !== 'spinning') return;              /* landed by the fallback, or skipped */
    if(t0 === null) t0 = now;
    var t = now - t0;
    frame(t);
    if(t < T) requestAnimationFrame(tick); else land();
  }
  requestAnimationFrame(tick);
  /* rAF stalls in a hidden tab; this guarantees the guest still arrives. */
  spinTimers.push(setTimeout(function(){ if(phase === 'spinning'){ frame(T+1); land(); } }, T+1500));
}

function land(){
  if(phase !== 'spinning') return;
  phase = 'won';
  frame(T+1);
  svgBack.classList.add('won');
  var d = data();
  swapLine(txt(d.introLanded,'Rien ne va plus'), 150);
  swapLine(dateWords(false), 1200);
  spinTimers.push(setTimeout(toHero, 2700));
}

/* The wheel settles into the dial while the opening dissolves. */
function toHero(){
  if(phase !== 'won') return;
  phase = 'morphing';
  backEl.classList.add('morphing');
  void backEl.offsetWidth;                        /* commit the start without waiting on rAF */
  document.body.classList.add('intro-leaving');
  backEl.style.transform = '';
  svgBack.classList.add('ring');

  /* the pocket band fades away, so the ball rises onto the number bezel */
  var angle = heroAngle(), t0 = Date.now(), dur = 900;
  var lift = setInterval(function(){
    var u = Math.min((Date.now()-t0)/dur, 1);
    setBall(svgBack, angle, R_POCKET + (R_BEZEL-R_POCKET)*(1-Math.pow(1-u,3)));
    if(u >= 1) clearInterval(lift);
  }, 16);
  spinTimers.push(setTimeout(function(){ clearInterval(lift); placeLanded(); }, 1700));
}

function skipIntro(){ if(phase === 'landed') return; placeLanded(); }

if(backEl){
  backEl.addEventListener('click', spin);
  backEl.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); spin(); }
  });
}
(function(){
  var b = document.getElementById('introSpin'); if(b) b.addEventListener('click', spin);
  var s = document.getElementById('introSkip'); if(s) s.addEventListener('click', skipIntro);
})();

window.addEventListener('resize', (function(){
  var t = null;
  return function(){
    clearTimeout(t);
    t = setTimeout(function(){
      if(phase === 'intro'){ ensureWheel(); backEl.style.transform = introTransform(); }
      else if(phase === 'landed'){ placeLanded(); }
      else fitNames();
    }, 150);
  };
})());

/* ------------------------------------------------------------
   NAMES FIT
   The names are set as large as the composition allows; a long name is
   scaled down until it fits the space to the right of the left margin.
   ------------------------------------------------------------ */
function fitNames(){
  var h = document.querySelector('.hero-names'); if(!h) return;
  document.documentElement.style.setProperty('--fit', 1);
  var left = h.getBoundingClientRect().left;
  var avail = window.innerWidth - left - 20;
  var widest = 0;
  h.querySelectorAll('.hn').forEach(function(el){
    var r = document.createRange(); r.selectNodeContents(el);
    widest = Math.max(widest, r.getBoundingClientRect().width);
  });
  if(widest > avail && widest > 0){
    document.documentElement.style.setProperty('--fit', Math.max(.5, avail/widest).toFixed(3));
  }
}
/* The intro transform is measured against the viewport, which can still be
   settling at parse time (fonts, the studio bar, a mobile address bar).
   Re-centre once everything has arrived. */
function recentre(){
  fitNames();
  if(phase === "intro" && backEl){ backEl.style.transform = introTransform(); }
}
if(document.fonts && document.fonts.ready){ document.fonts.ready.then(recentre); }
window.addEventListener("load", recentre);

/* ------------------------------------------------------------
   CONTENT
   ------------------------------------------------------------ */
function renderTimeline(){
  var host = document.getElementById('tlItems'); if(!host) return;
  var items = Array.isArray(data().schedule) ? data().schedule : [];
  var section = document.getElementById('schedule');
  if(section) section.style.display = items.length ? '' : 'none';
  host.innerHTML = items.map(function(it){
    return '<li class="tl-item rv">'+
             '<div class="tl-chip"><span class="tl-time">'+esc(txt(it.time,''))+'</span></div>'+
             '<div class="tl-title">'+esc(txt(it.title,''))+'</div>'+
             (txt(it.venue,'') ? '<div class="tl-venue">'+esc(it.venue)+'</div>' : '')+
           '</li>';
  }).join('');
  observeReveals();
}

function renderGallery(){
  var grid = document.querySelector('.postcards'); if(!grid) return;
  var items = Array.isArray(data().gallery) ? data().gallery.filter(function(g){ return txt(g.photo,''); }) : [];
  var section = document.getElementById('gallery');
  if(section) section.style.display = items.length ? '' : 'none';
  grid.innerHTML = items.map(function(it, i){
    return '<figure class="pc rv'+(i>3?' extra':'')+'">'+
             '<img src="'+esc(it.photo)+'" alt="'+esc(txt(it.caption,''))+'" loading="lazy">'+
             '<figcaption>'+esc(txt(it.caption,''))+'</figcaption>'+
           '</figure>';
  }).join('');
  observeReveals();
}

var SHIPPED_TRACKS = { gnossienne:1, clairdelune:1 };
function guardMusicTrack(){
  var d = data();
  // LUMA: "couple" is the couple's own uploaded song, registered by the core
  if(d.music && typeof d.music === 'object' && d.music.track !== 'couple' && !SHIPPED_TRACKS[d.music.track]) d.music.track = 'gnossienne';
}

function calendarLinks(){
  var d = data();
  var g = document.getElementById('gcal-link'), ics = document.getElementById('ics-link');
  var p = String(txt(d.date,'')).split('-');
  if(p.length !== 3) return;
  function hhmm(t){
    var m = String(t||'').trim().match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/i);
    if(!m) return [16,0];
    var h=+m[1], mi=+(m[2]||0), ap=(m[3]||'').toLowerCase();
    if(ap==='pm' && h<12) h+=12;
    if(ap==='am' && h===12) h=0;
    return [h,mi];
  }
  function stamp(dt){ return dt.getUTCFullYear()+pad2(dt.getUTCMonth()+1)+pad2(dt.getUTCDate())+'T'+pad2(dt.getUTCHours())+pad2(dt.getUTCMinutes())+'00Z'; }
  var t0 = hhmm(d.time), start = new Date(Date.UTC(+p[0],+p[1]-1,+p[2],t0[0],t0[1])),
      end = new Date(start.getTime()+5*3600*1000);
  var couple = txt(d.partner1,'')+' and '+txt(d.partner2,'');
  var loc = [txt(d.venueName,''),txt(d.venueAddress,'')].filter(Boolean).join(', ');
  if(g){
    g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      +'&text='+encodeURIComponent(couple+' - Wedding')
      +'&dates='+stamp(start)+'/'+stamp(end)
      +'&details='+encodeURIComponent('Celebrating the wedding of '+couple+'.')
      +'&location='+encodeURIComponent(loc);
  }
  if(ics){
    if(location.protocol === 'file:'){
      ics.removeAttribute('href'); ics.style.cursor = 'pointer';
      ics.onclick = function(e){ e.preventDefault(); if(typeof window.downloadICS === 'function') window.downloadICS(); };
    } else {
      ics.href = '/.netlify/functions/calendar?'+new URLSearchParams({
        p1:txt(d.partner1,''), p2:txt(d.partner2,''), date:txt(d.date,''),
        time:txt(d.time,''), venue:txt(d.venueName,''), address:txt(d.venueAddress,'')
      }).toString();
      ics.onclick = null;
    }
  }
}

function buildContent(){
  guardMusicTrack();
  var d = data();
  var one = txt(d.partner1,''), two = txt(d.partner2,''); /* LUMA: never a sample couple */

  document.querySelectorAll('[data-sync="one"]').forEach(function(el){ el.textContent = one; });
  document.querySelectorAll('[data-sync="two"]').forEach(function(el){ el.textContent = two; });
  document.querySelectorAll('[data-sync="dateWords"]').forEach(function(el){ el.textContent = dateWords(true); });
  document.querySelectorAll('[data-sync="day"]').forEach(function(el){ el.textContent = weddingDay(); });
  document.title = one+' & '+two+' - Rien ne va plus';

  /* photographs */
  document.body.classList.toggle('photos-as-taken', d.photoTone === false);
  var hero = txt(d.heroPhoto,''); /* LUMA: the couple's photo or their placeholder; no stock photo ships */
  ['heroImg','introImg'].forEach(function(id){
    var im = document.getElementById(id);
    if(im && im.getAttribute('src') !== hero) im.setAttribute('src', hero);
  });

  /* hero */
  setText('heroPlace', txt(d.heroPlace,''));
  setText('heroCta', txt(d.heroCta,'Reply'));
  if(phase === 'intro'){
    setText('introLine', txt(d.introCall,'Faites vos jeux'));
    var sb = document.getElementById('introSpin'); if(sb) sb.textContent = txt(d.introButton,'Spin the wheel');
  }

  /* story */
  setText('storyTitle', txt(d.storyTitle,'How it began'));
  setText('storyP1', txt(d.story1,''));
  setText('storyP2', txt(d.story2,''));

  /* the day */
  setText('dayTime', txt(d.time,''));
  setText('dayVenue', txt(d.venueName,''));
  setText('dayAddr', txt(d.venueAddress,''));
  setText('dayDress', [txt(d.dressCode,''), txt(d.dressCodeNote,'')].filter(Boolean).join(', '));
  var vl = document.getElementById('venueLink');
  if(vl) vl.href = 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((txt(d.venueName,'')+' '+txt(d.venueAddress,'')).trim());
  calendarLinks();

  /* headings */
  setText('scheduleHeading', txt(d.scheduleHeading,'The order of the day'));
  setText('galleryHeading', txt(d.galleryHeading,'Postcards from the Riviera'));
  setText('faqHeading', txt(d.faqHeading,'Things you might ask'));

  /* rsvp */
  setText('rsvpLead', txt(d.rsvpKicker,''));
  setText('rsvpTitle', txt(d.rsvpTag,'Will you join us?'));
  var dl = txt(d.rsvpDeadline,'');
  setText('rsvpDeadline', dl ? (txt(d.rsvpDeadlinePrefix,'Kindly reply by')+' '+dl) : '');
  setText('rsvpNameLabel', txt(d.rsvpNameLabel,'Your name'));
  setText('joinLabel', txt(d.rsvpAttendanceLabel,'Will you be there?'));
  setText('rsvpYesLabel', txt(d.rsvpYesLabel,'Yes'));
  setText('rsvpNoLabel', txt(d.rsvpNoLabel,'No'));
  setText('rsvpGuestsLabel', txt(d.rsvpGuestsLabel,'How many of you'));
  setText('rsvpPlusOneLabel', txt(d.rsvpPlusOneLabel,"Your guest's name"));
  setText('rsvpNotesLabel', txt(d.rsvpNotesLabel,'A note for us'));
  setText('rsvpSubmitLabel', txt(d.rsvpSubmitLabel,'Send reply'));
  var contact = document.getElementById('rsvpContact');
  if(contact){ contact.textContent = txt(d.rsvpEmailText,''); contact.hidden = !txt(d.rsvpEmailText,''); }
  var doneSub = document.getElementById('rsvpDoneSub');
  if(doneSub && !document.getElementById('rsvp-confirmed').hidden){
    doneSub.textContent = lastReplyYes ? txt(d.rsvpDoneYes,'') : txt(d.rsvpDoneNo,'');
  }
  setText('rsvpDoneTitle', txt(d.introLanded,'Rien ne va plus')+'.');

  /* footer */
  setText('footNames', one+' & '+two);
  setText('footTag', txt(d.hashtag,''));

  renderTimeline();
  renderGallery();
  if(typeof window.renderFaqPublic === 'function'){ try{ window.renderFaqPublic(); }catch(e){} }
  if(typeof window.handleRsvpGuestCountChange === 'function'){ try{ window.handleRsvpGuestCountChange(); }catch(e){} }

  /* A changed date moves the winning pocket. */
  if(phase === 'landed'){ if(built.day !== weddingDay()) placeLanded(); else fitNames(); }
  else if(phase === 'intro'){ if(built.day !== weddingDay()){ ensureWheel(); enterIntro(); } }
  fitNames();
}

/* ------------------------------------------------------------
   REVEALS
   ------------------------------------------------------------ */
var revealObserver = null;
function observeReveals(){
  var els = document.querySelectorAll('.rv:not(.in)');
  if(reduced || !window.IntersectionObserver){ els.forEach(function(el){ el.classList.add('in'); }); return; }
  if(!revealObserver){
    revealObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        en.target.classList.add('in');
        revealObserver.unobserve(en.target);
      });
    }, { rootMargin:'0px 0px -10% 0px', threshold:0.12 });
  }
  els.forEach(function(el, i){ el.style.transitionDelay = (i % 4)*70+'ms'; revealObserver.observe(el); });
}

/* ------------------------------------------------------------
   RSVP
   ------------------------------------------------------------ */
(function(){
  var labels = document.querySelectorAll('.rsvp-choice .choice');
  function sync(){
    labels.forEach(function(l){ var i = l.querySelector('input'); l.classList.toggle('selected', !!(i && i.checked)); });
    var att = document.querySelector('input[name="attending"]:checked');
    var g = document.getElementById('rsvp-guests-wrap');
    if(g) g.style.display = (att && att.value === 'no') ? 'none' : '';
  }
  labels.forEach(function(l){ var i = l.querySelector('input'); if(i) i.addEventListener('change', sync); });
  sync();
})();

/* The visible number input and the hidden <select> the form posts must agree. */
(function(){
  var num = document.getElementById('rsvpGuests'), sel = document.getElementById('rsvp-guest-count');
  if(!num || !sel) return;
  function syncCount(){
    var v = Math.max(1, Math.min(6, parseInt(num.value,10) || 1));
    sel.value = String(v);
    if(typeof window.handleRsvpGuestCountChange === 'function'){ try{ window.handleRsvpGuestCountChange(); }catch(e){} }
  }
  num.addEventListener('input', syncCount);
  num.addEventListener('change', syncCount);
  syncCount();
})();

/* THE CORE DOES NOT WIRE THE RSVP FORM (it defines submitRSVP but never
   attaches it). Without a handler the browser does a native POST and the
   whole invitation reloads. This design writes its own: fire-and-forget POST
   to Netlify Forms, then the ball drops into the confirmation. */
var lastReplyYes = true;
(function(){
  var form = document.getElementById('rsvp-form');
  var errorEl = document.getElementById('rsvp-error');
  var doneEl = document.getElementById('rsvp-confirmed');
  if(!form) return;
  var sent = false;

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(sent) return;
    var nameEl = document.getElementById('rsvpName');
    var name = nameEl ? nameEl.value.trim() : '';
    if(!name){
      if(errorEl){ errorEl.textContent = txt(data().rsvpNameMissing,'Please add your name.'); errorEl.hidden = false; }
      if(nameEl) nameEl.focus();
      return;
    }
    if(errorEl) errorEl.hidden = true;
    sent = true;
    var att = form.querySelector('input[name="attending"]:checked');
    lastReplyYes = !att || att.value === 'yes';

    /* LUMA: the reply goes to /api/rsvp (luma-bridge.js answers this POST):
       wait for it, so a guest is never told it was sent when it wasn't. */
    // read the answers BEFORE disabling the fields: disabled fields aren't sent
    var body = new URLSearchParams(new FormData(form)).toString();
    var controls = form.querySelectorAll('input, textarea, button, select');
    controls.forEach(function(el){ el.disabled = true; });
    function failed(message){
      sent = false;
      controls.forEach(function(el){ el.disabled = false; });
      if(errorEl){ errorEl.textContent = message || "That didn't send. Please try again."; errorEl.hidden = false; }
    }
    fetch('/', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: body })
      .then(function(res){
        if(!res.ok) return res.json().then(function(b){ failed(b && b.error); }, function(){ failed(); });
        form.hidden = true;
        if(doneEl){
          var d = data();
          setText('rsvpDoneTitle', txt(d.introLanded,'Rien ne va plus')+'.');
          setText('rsvpDoneSub', lastReplyYes ? txt(d.rsvpDoneYes,'Your reply is with us.') : txt(d.rsvpDoneNo,'Your reply is with us.'));
          doneEl.hidden = false;
          var again = document.getElementById('rsvpAgain'); if(again) again.focus({ preventScroll:true });
        }
      })
      .catch(function(){ failed(); });
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
window.renderScheduleTimeline   = function(){ renderTimeline(); };
window.renderGalleryPublic      = function(){ renderGallery(); };
/* renderFaqPublic is the core's own: it writes into #faq-list / #faq-section. */

/* Wording fields (data-mp-field) are not handled by the core. */
function syncMpFields(){
  var d = data();
  document.querySelectorAll('[data-mp-field]').forEach(function(el){
    var k = el.getAttribute('data-mp-field');
    if(d[k] != null) el.value = d[k];
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
    var t = document.getElementById('cfg-photo-tone');
    if(t) t.checked = (data().photoTone !== false);
  };
  var coreUpdate = window.updateInvitationFromInputs;
  window.updateInvitationFromInputs = function(){
    var t = document.getElementById('cfg-photo-tone');
    if(t && typeof invitationData === 'object') invitationData.photoTone = !!t.checked;
    if(typeof coreUpdate === 'function') coreUpdate.apply(this, arguments);
  };
})();

/* Drawer buttons wired by name in the shared markup. */
if(typeof window.mpTogglePeek !== 'function'){
  window.mpTogglePeek = function(){
    var d = document.getElementById('customizer-drawer'), b = document.getElementById('mp-peek-btn');
    if(!d) return;
    var peeking = d.style.opacity === '0.12';
    d.style.opacity = peeking ? '' : '0.12';
    d.style.pointerEvents = peeking ? '' : 'none';
    if(b) b.setAttribute('aria-pressed', peeking ? 'false' : 'true');
  };
}
if(typeof window.mpStartOver !== 'function'){
  window.mpStartOver = function(){
    if(!SAMPLE) return;
    if(!window.confirm('Discard your changes and go back to the sample invitation?')) return;
    try{
      var fresh = JSON.parse(SAMPLE);
      Object.keys(invitationData).forEach(function(k){ delete invitationData[k]; });
      Object.assign(invitationData, fresh);
    }catch(e){ return; }
    if(typeof window.syncDataToInputs === 'function') window.syncDataToInputs();
    if(typeof window.renderGalleryDrawer === 'function'){ try{ window.renderGalleryDrawer(); }catch(e){} }
    if(typeof window.renderScheduleDrawer === 'function'){ try{ window.renderScheduleDrawer(); }catch(e){} }
    if(typeof window.renderFaqDrawer === 'function'){ try{ window.renderFaqDrawer(); }catch(e){} }
    buildContent();
  };
}

/* The builder bar's "Replay Opening" button, and the core's instant reset. */
window.resetEnvelopeIntro = function(){ if(reduced){ placeLanded(); return; } enterIntro(); };
window.resetEnvelopeIntroInstant = function(){};

/* Guest preview shows the opening exactly as a guest gets it. */
(function(){
  var coreToggle = window.toggleGuestPreview;
  if(typeof coreToggle !== 'function') return;
  window.toggleGuestPreview = function(){
    var was = document.body.classList.contains('guest-mode');
    coreToggle.apply(this, arguments);
    var now = document.body.classList.contains('guest-mode');
    if(now && !was) window.resetEnvelopeIntro();
    else if(!now && was) placeLanded();
  };
})();

/* This design prints times and names, never icons: strip the shared icon picker. */
(function(){
  function stripIcons(){
    document.querySelectorAll('#schedule-drawer-list .schedule-icon-picker').forEach(function(p){
      var block = p.parentNode;
      if(block && block.parentNode) block.parentNode.removeChild(block);
      else if(p.parentNode) p.parentNode.removeChild(p);
    });
  }
  var coreRender = window.renderScheduleDrawer;
  if(typeof coreRender === 'function'){
    window.renderScheduleDrawer = function(){ coreRender.apply(this, arguments); stripIcons(); };
  }
  document.addEventListener('DOMContentLoaded', stripIcons);
})();

/* ---------- go ----------
   An exported guest file is a snapshot of a live page, so it arrives with the
   wheel already drawn and state classes on <body>. Start clean either way. */
document.body.classList.remove('intro-on','intro-leaving','dial-settled');
if(frontEl) frontEl.innerHTML = '';
if(backEl){ backEl.innerHTML = ''; backEl.style.transform = ''; backEl.classList.remove('morphing'); }
svgBack = null;

try{ buildContent(); }catch(e){ if(window.console) console.error(e); }
try{ syncMpFields(); }catch(e){}
if(reduced) placeLanded(); else enterIntro();
observeReveals();
