(function(){
"use strict";
var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function lerp(a,b,t){ return a + (b-a)*t; }
function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function pad2(n){ n=+n; return (n<10?'0':'')+n; }  /* coerce: '08' must not become '008' */
function storeGet(s,k){ try{ return window[s].getItem(k); }catch(e){ return null; } }
function storeSet(s,k,v){ try{ window[s].setItem(k,v); }catch(e){} }

/* ============================================================
   THE SEAM onto the shared core.
   The core owns the global `invitationData` (declared inline in index.html,
   loaded before this file) and everything outside: the builder drawer, save,
   share, export, the RSVP post to Netlify, music. This file reads that data and
   pours it into The Picture House. buildContent() is re-runnable and the core
   calls it (by the names exposed at the bottom) after every edit.
============================================================ */
function txt(v,d){ v=(v==null?'':String(v)).trim(); return v||d||''; }
function setText(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
function initialsOf(a,b){ var x=txt(a).charAt(0).toUpperCase(), y=txt(b).charAt(0).toUpperCase(); return (x&&y)?(x+'·'+y):(x||y||''); /* LUMA: no sample initials */ }
function fmtDate(iso){ var p=String(iso||'').split('-'); return p.length===3 ? pad2(p[2])+' · '+pad2(p[1])+' · '+p[0] : (iso||''); }
function fmtDateSlate(iso){ var p=String(iso||'').split('-'); return p.length===3 ? pad2(p[2])+'·'+pad2(p[1])+'·'+String(p[0]).slice(2) : (iso||''); }
function mapsHref(q){ return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q||''); }
function data(){ return (typeof invitationData==='object'&&invitationData)?invitationData:{}; }

/* ---------- photo fallback ---------- */
window.photoFallback = function(img){
  img.onerror = null;
  /* LUMA: guests see this, so no "add your photo" instruction: a dark frame
     with the couple's initials, like a title card, until they add one. */
  var d = data();
  var label = [txt(d.partner1,''), txt(d.partner2,'')].map(function(n){ return n.charAt(0).toUpperCase(); }).filter(Boolean).join(' & ').replace(/[<>&]/g, function(c){ return c === '&' ? '&amp;' : ''; });
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#0d0b09"/><rect x="40" y="40" width="1520" height="920" fill="none" stroke="#c99b4c" stroke-opacity="0.35" stroke-width="2"/><text x="800" y="530" text-anchor="middle" fill="#c99b4c" font-family="Georgia,serif" font-style="italic" font-size="88" letter-spacing="6">'+label+'</text></svg>';
  img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
};

/* ---------- filmstrip metrics (read by the scroll engine below) ---------- */
var filmTrack = document.getElementById('filmTrack');
var stripMetrics = [], trackWidth = 0;
function measureStrip(){
  if(!filmTrack) return;
  trackWidth = filmTrack.scrollWidth;
  stripMetrics = Array.prototype.map.call(filmTrack.children, function(el){
    return { el: el, centre: el.offsetLeft + el.offsetWidth/2 };
  });
}

/* ---------- the call sheet (Act III), re-runnable ----------
   THE DESIGN OWNS THE SCENE NUMBER, not the couple. They type only the action
   ("Fireworks & Farewell") and the call sheet prints "Scene V — Fireworks &
   Farewell" in front of it, renumbering itself when rows are added, deleted or
   reordered. Before this, a new row arrived with no scene number at all and the
   couple had to type "Scene VI —" by hand into every title. */
var _schSig='';
function romanOf(n){
  var R=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV',
         'XV','XVI','XVII','XVIII','XIX','XX'];
  return R[n] || String(n);
}
/* Strip any "Scene IV — " the couple (or older sample data) typed themselves, so
   the prefix is never printed twice. */
function actionOf(title){
  return String(title||'').replace(/^\s*scene\s+[ivxlcdm]+\s*(?:[—–-]\s*)?/i,'').trim();
}
function buildSchedule(){
  var list=document.getElementById('scheduleList'), section=document.getElementById('act3');
  var items=(data().schedule)||[];
  if(section) section.style.display = items.length ? '' : 'none';
  if(!list) return;
  var sig=JSON.stringify(items);
  if(sig===_schSig && list.children.length){ return; }  /* skip rebuild if unchanged (no flicker) */
  _schSig=sig;
  list.innerHTML='';
  items.forEach(function(it,i){
    var row=document.createElement('div'); row.className='sheet-row';
    row.style.transitionDelay=(i*70)+'ms'; row.classList.add('in');
    var act   = actionOf(it.title);
    var label = 'Scene ' + romanOf(i+1);
    var title = act ? (label + ' \u2014 ' + act) : label;
    /* A real call sheet numbers its shots too. Keep whatever the sample shipped;
       derive a plausible one for rows the couple adds. */
    var scene = String(it.scene||'').trim() || ('SC. ' + (41 + i*3));
    [['sc-time',it.time],['sc-scene',scene],['sc-title',title],['sc-venue',it.venue]].forEach(function(pair){
      var s=document.createElement('span'); s.className=pair[0]; s.textContent=pair[1]||''; row.appendChild(s);
    });
    list.appendChild(row);
  });
}

/* ---------- the filmstrip (gallery), re-runnable ---------- */
var _galSig='';
function buildGallery(){
  if(!filmTrack) return;
  var stage=document.getElementById('gallery-stage');
  var items=(data().gallery)||[];
  if(stage) stage.style.display = items.length ? '' : 'none';
  var sig=JSON.stringify(items);
  if(sig===_galSig && filmTrack.children.length){ return; }  /* skip rebuild if unchanged (no flicker) */
  _galSig=sig;
  filmTrack.innerHTML='';
  items.forEach(function(item,idx){
    var fig=document.createElement('figure'); fig.className='frame';
    var img=document.createElement('img');
    img.src=item.photo||''; img.alt=item.caption||''; img.loading='lazy';
    img.onerror=function(){ window.photoFallback(img); };
    var cap=document.createElement('figcaption'); cap.textContent=item.caption||'';
    fig.appendChild(img); fig.appendChild(cap);
    fig.addEventListener('click', function(){ openLightbox(idx); });
    filmTrack.appendChild(fig);
  });
  measureStrip();
}

/* ---------- the seam: pour invitationData into the page ---------- */
function buildContent(){
  var d=data();
  var p1=txt(d.partner1,''), p2=txt(d.partner2,''); /* LUMA: never a sample couple */
  document.querySelectorAll('[data-sync="one"]').forEach(function(el){ el.textContent=p1; });
  document.querySelectorAll('[data-sync="two"]').forEach(function(el){ el.textContent=p2; });
  document.querySelectorAll('[data-sync="date"]').forEach(function(el){ el.textContent=fmtDate(d.date); });
  document.title = p1+' & '+p2+' — The Picture House';
  setText('navGram', initialsOf(p1,p2));
  setText('slateDate', fmtDateSlate(d.date));
  setText('heroEyebrow', txt(d.heroEyebrow,'')); /* LUMA: the couple's slate line (Luma supplies a generic one) */

  /* Act II — venue & date */
  setText('venueName', txt(d.venueName,''));
  setText('venueAddr', txt(d.venueAddress,''));
  var vlink=document.getElementById('venueLink'); if(vlink) vlink.href=mapsHref((txt(d.venueName,'')+' '+txt(d.venueAddress,'')).trim());
  var dress=[txt(d.dressCode,''),txt(d.dressCodeNote,'')].filter(Boolean).join(', ');
  setText('dressLine', dress ? ('Dress code — '+dress) : '');

  /* Act I — story */
  setText('storyP1', txt(d.story1,''));
  setText('storyP2', txt(d.story2,''));

  /* hero background photograph */
  var hb=document.getElementById('heroBg');
  if(hb && txt(d.heroPhoto,'')) hb.style.backgroundImage="url('"+d.heroPhoto+"')";

  /* RSVP wording */
  setText('rsvpTag', txt(d.rsvpTag,'Reel 05 · The Reply'));
  setText('rsvpDeadlinePrefix', txt(d.rsvpDeadlinePrefix,'Kindly reply by'));
  setText('rsvpDeadlineText', txt(d.rsvpDeadline,''));
  setText('rsvpNameLabel', txt(d.rsvpNameLabel,'Your name'));
  setText('rsvpYesLabel', txt(d.rsvpYesLabel,'Joyfully attending'));
  setText('rsvpNoLabel', txt(d.rsvpNoLabel,'Regretfully declining'));
  setText('rsvpPlusOneLabel', txt(d.rsvpPlusOneLabel,'Name of your guest'));
  setText('rsvpNotesLabel', txt(d.rsvpNotesLabel,'Dietary requirements & notes'));
  setText('rsvpSubmitLabel', txt(d.rsvpSubmitLabel,'Tear the stub · Send RSVP'));
  var attL=document.getElementById('attLabel'); if(attL) attL.textContent=txt(d.rsvpAttendanceLabel,'Attendance');
  var gL=document.getElementById('guestLabel'); if(gL) gL.textContent=txt(d.rsvpGuestsLabel,'Seats in your party');

  /* credits location */
  /* LUMA: the couple's venue, not the sample one in Florence */
  setText('crLocation', txt(d.venueName,''));
  setText('ecLocation', txt(d.venueName,''));

  buildSchedule();
  buildGallery();

  /* Last: the plus-one label is count-aware (singular vs plural), and the core
     owns that wording. Re-running it here stops the setText above from leaving
     "Name of your guest" on a party of four after any redraw. */
  if(typeof window.handleRsvpGuestCountChange === 'function'){
    try{ window.handleRsvpGuestCountChange(); }catch(e){}
  }
}

/* Expose the seam. The shared core calls these by name after every drawer edit. */
window.renderInvitationFromData = buildContent;
window.renderScheduleTimeline = buildSchedule;
window.renderGalleryPublic = buildGallery;
window.renderFaqPublic = function(){};   /* this design has no FAQ section */

/* ---------- Events editor: no icons ----------
   This design's call sheet prints time / scene / action / setting — never an
   icon. The SHARED drawer still renders an icon picker because other designs do
   use it, so strip it here rather than forking wedding-core.js for one design. */
(function(){
  function stripIcons(){
    var pickers = document.querySelectorAll('#schedule-drawer-list .schedule-icon-picker');
    Array.prototype.forEach.call(pickers, function(p){
      var block = p.parentNode;              /* the <div> wrapping the label + picker */
      if(block && block.parentNode){ block.parentNode.removeChild(block); }
      else if(p.parentNode){ p.parentNode.removeChild(p); }
    });
  }
  var coreRender = window.renderScheduleDrawer;
  if(typeof coreRender === 'function'){
    window.renderScheduleDrawer = function(){
      coreRender.apply(this, arguments);
      stripIcons();
    };
  }
  document.addEventListener('DOMContentLoaded', stripIcons);
  stripIcons();
})();

/* ---------- data-mp-field wording fields ----------
   The shared core handles cfg-* inputs but NOT the data-mp-field "wording"
   inputs (section labels, RSVP wording). Liquid Gold wired these in its own
   design.js; this is the compact port so those drawer fields actually edit. */
function syncMpFields(){
  var d = data();
  document.querySelectorAll('[data-mp-field]').forEach(function(el){
    var key = el.getAttribute('data-mp-field');
    if (d[key] != null) el.value = d[key];
  });
}
document.addEventListener('input', function(e){
  var el = e.target.closest && e.target.closest('[data-mp-field]');
  if (!el || typeof invitationData !== 'object') return;
  invitationData[el.getAttribute('data-mp-field')] = el.value;
  buildContent();
});
/* The core fills cfg-* inputs via syncDataToInputs; wrap it so the wording
   fields fill too (e.g. after loading a saved invitation). */
(function(){
  var coreSync = window.syncDataToInputs;
  window.syncDataToInputs = function(){
    if (typeof coreSync === 'function') coreSync.apply(this, arguments);
    syncMpFields();
  };
})();

/* Drawer buttons call these by name (the mp-* peek + start-over). Minimal, safe
   versions so they work without Liquid Gold's full mp machinery. */
window.mpTogglePeek = function(force){
  var dr = document.getElementById('customizer-drawer'); if(!dr) return;
  var on = (typeof force === 'boolean') ? force : !dr.classList.contains('mp-peek');
  dr.style.opacity = on ? '0.15' : '';
  dr.style.pointerEvents = on ? 'none' : '';
  var btn = document.getElementById('mp-peek-btn'); if(btn) btn.setAttribute('aria-pressed', String(on));
};
window.mpStartOver = function(){
  if(window.lumaBoot) return; // LUMA: nothing to start over on a guest page, and Luma's own storage is not this design's
  if(!window.confirm('Discard your changes and restore the sample wording?')) return;
  try{ Object.keys(localStorage).forEach(function(k){ if(/invitation|wedding|draft/i.test(k)) localStorage.removeItem(k); }); }catch(e){}
  location.reload();
};

/* ---------- lightbox ---------- */
var lightbox = document.getElementById('lightbox'), lbImg = document.getElementById('lbImg'),
    lbCap = document.getElementById('lbCap'), lbClose = document.getElementById('lbClose'), lbLast = null;
function openLightbox(idx){
  var item = (invitationData.gallery||[])[idx]; if(!item) return;
  lbLast = document.activeElement;
  lbImg.src = item.photo||''; lbImg.alt = item.caption||''; lbCap.textContent = item.caption||'';
  lightbox.classList.add('open'); document.body.style.overflow = 'hidden'; lbClose.focus();
}
function closeLightbox(){
  lightbox.classList.remove('open'); document.body.style.overflow = '';
  if(lbLast && lbLast.focus) lbLast.focus();
}
lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', function(e){ if(e.target===lightbox) closeLightbox(); });

/* ---------- menu ---------- */
var MENU = [['hero','Title Card'],['act1','Act I — The Meeting'],['act2','Act II — The Vows'],
            ['act3','Act III — The Celebration'],['gallery-stage','The Filmstrip'],
            ['rsvp','RSVP — Admit Two'],['credits','Credits']];
var menuOverlay = document.getElementById('menuOverlay'), menuBtn = document.getElementById('navMenuBtn'),
    menuLinks = document.getElementById('menuLinks'), menuClose = document.getElementById('menuClose'), menuLast = null;
function buildMenu(){
  menuLinks.innerHTML = '';
  MENU.forEach(function(m,i){
    var el = document.getElementById(m[0]);
    if(!el || getComputedStyle(el).display==='none') return;
    var a = document.createElement('a'); a.href = '#'+m[0];
    a.innerHTML = '<i>'+pad2(i+1)+'</i>';
    a.appendChild(document.createTextNode(m[1]));
    a.style.transitionDelay = (90 + i*55)+'ms';
    a.addEventListener('click', function(e){
      e.preventDefault(); closeMenu();
      setTimeout(function(){
        var top = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: Math.max(0,top), behavior: RM?'auto':'smooth' });
      }, RM?0:300);
    });
    menuLinks.appendChild(a);
  });
}
function openMenu(){
  buildMenu(); menuLast = document.activeElement;
  menuOverlay.hidden = false;
  requestAnimationFrame(function(){ menuOverlay.classList.add('open'); });
  menuBtn.setAttribute('aria-expanded','true');
  document.body.style.overflow = 'hidden'; menuClose.focus();
}
function closeMenu(){
  if(menuOverlay.hidden) return;
  menuOverlay.classList.remove('open');
  menuBtn.setAttribute('aria-expanded','false');
  document.body.style.overflow = '';
  setTimeout(function(){ menuOverlay.hidden = true; }, RM?0:520);
  if(menuLast && menuLast.focus) menuLast.focus();
}
menuBtn.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
menuOverlay.addEventListener('click', function(e){ if(e.target===menuOverlay) closeMenu(); });

/* ---------- intro ---------- */
var intro = document.getElementById('intro'), skipBtn = document.getElementById('skipBtn'),
    leaderNum = document.getElementById('leaderNum'), hero = document.getElementById('hero'),
    introTimers = [], leaderIv = null;
function clearIntroTimers(){ introTimers.forEach(clearTimeout); introTimers = []; if(leaderIv){ clearInterval(leaderIv); leaderIv = null; } }
function finishIntro(){
  clearIntroTimers();
  intro.classList.add('done');
  document.body.style.overflow = '';
  storeSet('sessionStorage','pictureHouseVisited','1');
  hero.classList.add('in');
}
function runIntro(){
  document.body.style.overflow = 'hidden';
  intro.classList.add('ignite');                              // projector strikes
  introTimers.push(setTimeout(function(){ intro.classList.remove('ignite'); }, 1050));
  var seq = ['3','2','1'], li = 0;
  leaderIv = setInterval(function(){
    li = (li+1)%3; leaderNum.textContent = seq[li];
    leaderNum.classList.remove('swap'); void leaderNum.offsetWidth; leaderNum.classList.add('swap');
    if(typeof introBeep === 'function') introBeep(false);      // tick on each count (if sound on)
  }, 780);
  introTimers.push(setTimeout(function(){                       // the clapperboard snaps
    if(leaderIv){ clearInterval(leaderIv); leaderIv = null; }
    intro.classList.add('phase-slate');
    if(typeof introBeep === 'function') setTimeout(function(){ introBeep(true); }, 560); // clap crack on the snap
  }, 2500));
  introTimers.push(setTimeout(function(){ intro.classList.add('phase-card'); }, 3650));
  introTimers.push(setTimeout(function(){ intro.classList.add('phase-open'); }, 4950));
  /* Reveal the hero only AFTER the title card has fully faded (it hits opacity 0
     and visibility:hidden ~5250ms), so the two never paint at once — this is what
     caused the doubled/ghosted hero names on the handoff. */
  introTimers.push(setTimeout(function(){ hero.classList.add('in'); }, 5650));
  introTimers.push(setTimeout(finishIntro, 6450));
}
if(RM || storeGet('sessionStorage','pictureHouseVisited')==='1'){
  intro.classList.add('done'); hero.classList.add('in');
}else{ runIntro(); }
skipBtn.addEventListener('click', finishIntro);

/* ---------- reveal observer ---------- */
var cueBurn = document.getElementById('cueBurn'), cueSeen = false;
function flashCue(){
  if(RM || !cueBurn) return;
  if(!cueSeen){ cueSeen = true; return; }   /* skip the first (hero already on screen) */
  cueBurn.classList.remove('flash'); void cueBurn.offsetWidth; cueBurn.classList.add('flash');
}
var rvIO = new IntersectionObserver(function(es){
  es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); flashCue(); rvIO.unobserve(e.target); } });
},{threshold:0.18, rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('[data-io]').forEach(function(el){ if(RM){ el.classList.add('in'); } else rvIO.observe(el); });
if(RM) hero.classList.add('in');

/* ---------- reel marker ---------- */
var reelNum = document.getElementById('reelNum');
var reelIO = new IntersectionObserver(function(es){
  es.forEach(function(e){ if(e.isIntersecting) reelNum.textContent = e.target.getAttribute('data-reel'); });
},{rootMargin:'-45% 0px -45% 0px', threshold:0});
document.querySelectorAll('[data-reel]').forEach(function(el){ reelIO.observe(el); });

/* ---------- the start, from the couple's own date and time ----------
   LUMA: read when it is needed, not when this file loads (the couple's
   details may not be in yet, which showed NaN in every box), and from
   their time rather than a fixed 15:30 in Italy. Local to the guest's
   device, like every other design on Luma. */
function weddingStart(){
  var p = String(invitationData.date || '').split('-');
  if(p.length < 3) return null;
  var m = /^(\d{1,2})[:.h]?(\d{2})?\s*([ap])?/i.exec(String(invitationData.time || ''));
  var h = m ? +m[1] : 16, mi = m ? +(m[2] || 0) : 0, ap = m ? (m[3] || '').toLowerCase() : '';
  if(ap === 'p' && h < 12) h += 12;
  if(ap === 'a' && h === 12) h = 0;
  var dt = new Date(+p[0], +p[1]-1, +p[2], h, mi, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

/* ---------- showtime ----------
   Was four ticking boxes of days, hours, minutes and seconds - the one
   piece of every wedding template that says template. A cinema prints the
   day and the time the film starts, so this does. Rewritten each second
   only because the couple's details can arrive after this file loads. */
(function(){
  var el = document.getElementById('showtime');
  if(!el) return;
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function write(){
    var start = weddingStart();
    var v = start ? DAYS[start.getDay()] + '  \u00b7  Showtime ' + pad2(start.getHours()) + ':' + pad2(start.getMinutes()) : '';
    if(el.textContent !== v) el.textContent = v;
  }
  write(); setInterval(write, 1000);
})();

/* ---------- add to calendar ---------- */
(function(){
  var calBtn = document.getElementById('calBtn');
  if(!calBtn) return;
  /* floating local time: the calendar shows it at the hour on the invitation */
  function fmt(dt){
    return dt.getFullYear() + pad2(dt.getMonth()+1) + pad2(dt.getDate()) + 'T' + pad2(dt.getHours()) + pad2(dt.getMinutes()) + '00';
  }
  calBtn.addEventListener('click', function(e){
    e.preventDefault();
    var start = weddingStart();
    if(!start) return;
    var end = new Date(start.getTime() + 8*3600*1000);
    var title = invitationData.partner1 + ' & ' + invitationData.partner2 + ', wedding';
    var dress = [invitationData.dressCode, invitationData.dressCodeNote].filter(function(x){ return x && String(x).trim(); }).join('. ');
    var loc = document.getElementById('venueAddr') ? document.getElementById('venueAddr').textContent : '';
    var now = new Date();
    var ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Luma//The Picture House//EN','BEGIN:VEVENT',
      'UID:'+Date.now()+'@luma.invite','DTSTAMP:'+fmt(now),
      'DTSTART:'+fmt(start), 'DTEND:'+fmt(end),
      'SUMMARY:'+title, dress ? 'DESCRIPTION:Dress code: '+dress : '',
      'LOCATION:'+loc, 'END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');
    var blob = new Blob([ics], {type:'text/calendar'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wedding.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });
})();

/* ---------- smooth scroll engine ---------- */
var tcTime = document.getElementById('tcTime'),
    heroBg = document.getElementById('heroBg'),
    galleryStage = document.getElementById('gallery-stage'),
    galleryBar = document.getElementById('galleryBar'),
    creditsSection = document.getElementById('credits'),
    creditsInner = document.getElementById('creditsInner'),
    RUNTIME = 872, creditsH = 0,
    smStrip = 0, smCred = 0, smHero = 0;
function progressOf(el){
  var r = el.getBoundingClientRect();
  var total = r.height - window.innerHeight;
  return total <= 0 ? 0 : clamp01(-r.top/total);
}
function measureCredits(){ if(creditsInner) creditsH = creditsInner.offsetHeight; }
function tcFormat(p){
  var secs = p*RUNTIME;
  return pad2(Math.floor(secs/3600))+':'+pad2(Math.floor(secs/60)%60)+':'+pad2(Math.floor(secs)%60)+':'+pad2(Math.floor((secs%1)*24));
}
function paintScroll(){
  var doc = document.documentElement;
  var total = doc.scrollHeight - window.innerHeight;
  tcTime.textContent = tcFormat(total>0 ? clamp01(window.scrollY/total) : 0);
  var vh = window.innerHeight;
  var hyT = Math.min(window.scrollY, vh)*0.16;
  smHero = lerp(smHero, hyT, 0.1);
  heroBg.style.transform = 'translate3d(0,'+smHero.toFixed(1)+'px,0) scale(1.12)';
  if(galleryStage && filmTrack){
    var p = progressOf(galleryStage);
    var viewW = window.innerWidth;
    var maxT = Math.max(0, trackWidth - viewW + viewW*0.1);
    smStrip = lerp(smStrip, p*maxT, 0.09);
    filmTrack.style.transform = 'translate3d(-'+smStrip.toFixed(1)+'px,0,0)';
    galleryBar.style.width = (p*100)+'%';
    var vc = viewW/2, litIdx = -1, litDist = 1e9;
    for(var i=0;i<stripMetrics.length;i++){
      var m = stripMetrics[i];
      var d = (m.centre - smStrip - vc)/vc;
      var b = 1 - Math.min(1, Math.abs(d))*0.55;
      m.el.firstChild.style.filter = 'brightness('+b.toFixed(3)+') saturate(.9) sepia(.1)';
      var ad = Math.abs(d);
      if(ad < litDist){ litDist = ad; litIdx = i; }
    }
    for(var k=0;k<stripMetrics.length;k++) stripMetrics[k].el.classList.toggle('lit', k===litIdx && litDist < 0.5);
  }
  if(creditsSection && creditsInner){
    var pc = progressOf(creditsSection);
    var tyT = vh - pc*(vh + creditsH);
    smCred = lerp(smCred, tyT, 0.12);
    creditsInner.style.transform = 'translate3d(0,'+smCred.toFixed(1)+'px,0)';
  }
  requestAnimationFrame(paintScroll);
}
if(!RM){ measureCredits(); requestAnimationFrame(paintScroll); }
else { tcTime.textContent = tcFormat(0); }
var rsTimer = null;
window.addEventListener('resize', function(){
  clearTimeout(rsTimer);
  rsTimer = setTimeout(function(){ measureStrip(); measureCredits(); if(ecOpen) ecMeasure(); }, 150);
});
window.addEventListener('load', function(){ measureStrip(); measureCredits(); });

/* ---------- RSVP ---------- */
var guestChips = document.getElementById('guestChips');
for(var g=1; g<=6; g++){
  var lab = document.createElement('label'); lab.className = 'gchip';
  var rad = document.createElement('input'); rad.type='radio'; rad.name='guests'; rad.value=String(g);
  if(g===2) rad.checked = true;
  lab.appendChild(rad); lab.appendChild(document.createTextNode(String(g)));
  guestChips.appendChild(lab);
}
var rsvpForm = document.getElementById('rsvp-form'),
    rsvpError = document.getElementById('rsvpError'),
    ticket = document.getElementById('ticket'),
    rsvpNameInput = document.getElementById('rsvpName'),
    rowName = document.getElementById('rowName'),
    rowAtt = document.getElementById('rowAtt'),
    submitBtn = document.getElementById('rsvpSubmitBtn'),
    rsvpSent = false;

function syncChoiceClasses(){
  if(!rsvpForm) return;
  rsvpForm.querySelectorAll('.att, .gchip').forEach(function(l){
    var inp = l.querySelector('input');
    l.classList.toggle('checked', !!(inp && inp.checked));
  });
}
/* Mirror the chosen seat chip into the hidden <select name="guest_count">, which
   is the field Netlify actually registers and posts. */
function syncGuestCount(){
  var g = rsvpForm && rsvpForm.querySelector('input[name="guests"]:checked');
  var sel = document.getElementById('rsvp-guest-count');
  if(g && sel) sel.value = g.value;
  /* The core owns the plus-one reveal; it reads the select, so tell it the
     chip changed (2+ seats asks who else is coming). */
  if(typeof window.handleRsvpGuestCountChange === 'function'){
    try{ window.handleRsvpGuestCountChange(); }catch(e){}
  }
}
syncChoiceClasses(); syncGuestCount();
if(rsvpForm) rsvpForm.addEventListener('change', function(){
  syncChoiceClasses(); syncGuestCount();
  if(rowAtt) rowAtt.classList.remove('bad');
  rsvpError.classList.remove('show');
});
if(rsvpNameInput) rsvpNameInput.addEventListener('input', function(){
  if(rsvpNameInput.value.trim()){ rowName.classList.remove('bad'); rsvpError.classList.remove('show'); }
});

/* paper fibres burst off the seam as the stub tears */
function spawnRip(){
  if(RM || !ticket) return;
  var mobile = window.innerWidth < 820;
  /* fibres burst the length of the whole seam, not just off the stub */
  for(var i=0;i<22;i++){
    var b = document.createElement('span'); b.className = 'rip-bit';
    if(mobile){
      b.style.left = (5 + Math.random()*90) + '%';
      b.style.top = '50%';
      b.style.setProperty('--dx', (Math.random()*180-90)+'px');
      b.style.setProperty('--dy', (Math.random()*140+50)+'px');
    }else{
      b.style.right = '232px';
      b.style.top = (3 + Math.random()*94) + '%';
      b.style.setProperty('--dx', (Math.random()*220-110)+'px');
      b.style.setProperty('--dy', (Math.random()*240-60)+'px');
    }
    b.style.setProperty('--rr', (Math.random()*640-320)+'deg');
    ticket.appendChild(b);
    (function(el){ setTimeout(function(){ el.remove(); }, 1050); })(b);
  }
}

function handleRsvp(e){
  if(e && e.preventDefault) e.preventDefault();
  if(rsvpSent || !rsvpForm) return;
  var name = rsvpNameInput ? rsvpNameInput.value.trim() : '';
  var att = rsvpForm.querySelector('input[name="attending"]:checked');
  var ok = true;
  if(rowName) rowName.classList.toggle('bad', !name); if(!name) ok = false;
  if(rowAtt) rowAtt.classList.toggle('bad', !att); if(!att) ok = false;
  if(!ok){
    if(rsvpError){
      rsvpError.textContent = !name && !att
        ? 'Almost — write your name and choose an attendance, then tear the stub.'
        : (!name ? 'Almost — the ticket needs your name before it can be torn.'
                 : 'Almost — choose whether you\u2019ll be attending.');
      rsvpError.classList.add('show');
    }
    if(ticket && !RM){ ticket.classList.remove('shake'); void ticket.offsetWidth; ticket.classList.add('shake'); }
    if(!name && rsvpNameInput) rsvpNameInput.focus();
    return;
  }
  rsvpSent = true;
  if(rsvpError) rsvpError.classList.remove('show');
  var guests = rsvpForm.querySelector('input[name="guests"]:checked');
  var n = guests ? guests.value : '2';
  var yes = att.value === 'yes';
  var notesEl = document.getElementById('rsvpNotes');

  /* Post the reply to Netlify Forms. The form carries name="rsvp", data-netlify
     and a hidden form-name; the field names (guest_names, attending, guest_count,
     notes) match every design so replies land in one shape. Fire-and-forget: the
     ticket still tears even if the post is slow or the page is previewed off Netlify. */
  var gcSel = document.getElementById('rsvp-guest-count'); if(gcSel) gcSel.value = n;
  /* LUMA: the reply goes to /api/rsvp (luma-bridge.js answers this POST):
     wait for it, so a guest is never told it was sent when it wasn't. */
  // read the answers BEFORE disabling the fields: disabled fields aren't sent
  var params = new URLSearchParams(new FormData(rsvpForm)).toString();
  var controls = rsvpForm.querySelectorAll('input, textarea, button');
  controls.forEach(function(el){ el.disabled = true; });
  function failed(message){
    rsvpSent = false;
    controls.forEach(function(el){ el.disabled = false; });
    if(rsvpError){ rsvpError.textContent = message || "That didn't send. Please try again."; rsvpError.classList.add('show'); }
  }
  fetch('/', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: params })
    .then(function(res){
      if(!res.ok) return res.json().then(function(b){ failed(b && b.error); }, function(){ failed(); });
      admitted();
    })
    .catch(function(){ failed(); });

  function admitted(){
  try{
    var eg = document.getElementById('ecGuest'); if(eg) eg.textContent = name;
    var es = document.getElementById('ecGuestSub');
    if(es) es.textContent = yes ? 'party of '+n+' \u00b7 orchestra seats held'
                                : 'missed, with love \u00b7 a seat kept in our hearts';
    var ek = document.getElementById('ecGuestKick');
    if(ek) ek.textContent = yes ? 'RSVP received' : 'Held in absentia';
    var cg = document.getElementById('crGuest');
    if(cg) cg.textContent = name + ' \u2014 and everyone in the audience';
  }catch(err){}
  if(yes){
    /* Attending: the ticket is torn — you're admitted. */
    ticket.classList.add('torn');
    spawnRip();
    setTimeout(function(){ ticket.classList.add('sent'); }, RM?0:220);
    setTimeout(function(){ if(endCredits) openEndCredits(); }, RM?500:1250);
  } else {
    /* Declining: the ticket is KEPT, not torn — stamped Rain Check, then a
       gentler roll (the credits carry the "held in absentia" line already). */
    ticket.classList.add('declined');
    setTimeout(function(){ if(endCredits) openEndCredits(); }, RM?500:2100);
  }
  }
}
if(rsvpForm) rsvpForm.addEventListener('submit', handleRsvp);
if(submitBtn) submitBtn.addEventListener('click', handleRsvp);

/* ---------- END CREDITS overlay: fast start, brisk roll ---------- */
var endCredits = document.getElementById('endCredits'), ecTrack = document.getElementById('ecTrack'),
    ecSkip = document.getElementById('ecSkip'), ecActions = document.getElementById('ecActions'),
    ecReturn = document.getElementById('ecReturn'),
    ecOpen = false, ecRaf = 0, ecT0 = 0, ecDur = 0, ecDist = 0, ecVh = 0, ecStartY = 0, ecDone = false;
var EC_SPEED = 132; /* px per second — a proper, steady credit roll */
/* Start the roll with the first credits ALREADY in view (42% down) instead of
   fully below the fold, and roll at a constant speed. The old smoothstep ease
   crawled for the first second from off-screen, which read as a dead pause. */
function ecMeasure(){ ecVh = window.innerHeight; ecStartY = ecVh*0.42; ecDist = ecStartY + ecTrack.offsetHeight; ecDur = (ecDist/EC_SPEED)*1000; }
function ecFinish(){
  ecDone = true;
  ecTrack.style.transform = 'translate3d(0,'+(ecStartY - ecDist).toFixed(1)+'px,0)';
  ecActions.classList.add('show');
}
function ecStep(t){
  if(!ecOpen) return;
  var q = clamp01((t - ecT0)/ecDur);
  ecTrack.style.transform = 'translate3d(0,'+(ecStartY - q*ecDist).toFixed(1)+'px,0)';
  if(q >= 1){ ecFinish(); return; }
  ecRaf = requestAnimationFrame(ecStep);
}
function openEndCredits(){
  ecOpen = true; ecDone = false;
  endCredits.setAttribute('aria-hidden','false');
  endCredits.classList.add('open');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function(){ endCredits.classList.add('bars'); });
  ecTrack.style.opacity = '0';   /* the roll fades UP rather than snapping in */
  if(RM){ ecTrack.style.opacity='1'; endCredits.classList.add('static'); ecActions.classList.add('show'); return; }
  setTimeout(function(){
    ecMeasure();
    ecTrack.style.transition = 'opacity 1.1s ease';
    ecTrack.style.opacity = '1';
    ecT0 = performance.now();
    ecRaf = requestAnimationFrame(ecStep);
  }, 260);
}
function closeEndCredits(){
  ecOpen = false; cancelAnimationFrame(ecRaf);
  endCredits.classList.remove('open','bars','static');
  endCredits.setAttribute('aria-hidden','true');
  ecActions.classList.remove('show');
  document.body.style.overflow = '';
}
if(ecSkip) ecSkip.addEventListener('click', function(){ cancelAnimationFrame(ecRaf); ecFinish(); });
if(ecReturn) ecReturn.addEventListener('click', closeEndCredits);

/* ---------- escape ---------- */
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  if(ecOpen){ if(!ecDone && !RM){ cancelAnimationFrame(ecRaf); ecFinish(); } else closeEndCredits(); return; }
  if(lightbox.classList.contains('open')){ closeLightbox(); return; }
  if(!menuOverlay.hidden) closeMenu();
});

/* ---------- projector ambience ---------- */
var soundBtn = document.getElementById('soundBtn'), amb = null, soundOn = false;
function buildAmbience(){
  var AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
  var ctx = new AC();
  var master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  var len = ctx.sampleRate*2, buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
  for(var i=0;i<len;i++) ch[i] = Math.random()*2-1;
  var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  var lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 320; lp.Q.value = .7;
  var ng = ctx.createGain(); ng.gain.value = .5;
  noise.connect(lp); lp.connect(ng); ng.connect(master); noise.start();
  var hum = ctx.createOscillator(); hum.type='sine'; hum.frequency.value = 46;
  var hg = ctx.createGain(); hg.gain.value = .12; hum.connect(hg); hg.connect(master); hum.start();
  var lfo = ctx.createOscillator(); lfo.frequency.value = .13;
  var lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  return { ctx: ctx, master: master };
}
/* Projector tick on each countdown number, and a sharp clap-crack on the
   slate snap. Synthesised — no audio files. Silent unless the guest has
   turned Sound on (audio can't autoplay before a gesture anyway). */
function introBeep(isClap){
  if(!soundOn || !amb) return;
  var ctx = amb.ctx, t = ctx.currentTime;
  if(isClap){
    var len = Math.floor(ctx.sampleRate*0.09), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    for(var i=0;i<len;i++) ch[i] = (Math.random()*2-1)*Math.pow(1-i/len, 2.2);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1900; bp.Q.value=.7;
    var g = ctx.createGain(); g.gain.value=.7;
    src.connect(bp); bp.connect(g); g.connect(amb.master); src.start(t);
  } else {
    var osc = ctx.createOscillator(); osc.type='sine'; osc.frequency.value=1000;
    var g2 = ctx.createGain(); g2.gain.setValueAtTime(.0001,t);
    g2.gain.exponentialRampToValueAtTime(.32,t+.008); g2.gain.exponentialRampToValueAtTime(.0001,t+.11);
    osc.connect(g2); g2.connect(amb.master); osc.start(t); osc.stop(t+.13);
  }
}
if(soundBtn) soundBtn.addEventListener('click', function(){
  if(!amb) amb = buildAmbience();
  if(!amb) return;
  soundOn = !soundOn;
  if(soundOn){ amb.ctx.resume(); amb.master.gain.linearRampToValueAtTime(.14, amb.ctx.currentTime + 1.2); }
  else { amb.master.gain.linearRampToValueAtTime(0, amb.ctx.currentTime + .6); }
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.textContent = soundOn ? 'Sound On' : 'Sound';
});

/* ============================================================
   SEAM: initial paint + the hooks the shared core calls by name
============================================================ */
/* Paint the page from invitationData once now; the core also calls
   window.renderInvitationFromData after it merges any saved/guest data. */
try{ buildContent(); syncMpFields(); }catch(e){}

/* Entering guest preview must SHOW THE OPENING, exactly as a guest gets it.
   The core's enableGuestMode calls resetEnvelopeIntroInstant(), which bails out
   when there is no #envelope-box-el — this design has none, so preview used to
   drop straight onto the hero and looked like nothing happened. Wrap the toggle
   and run the real projector opening instead. */
(function(){
  var coreToggle = window.toggleGuestPreview;
  if(typeof coreToggle !== 'function') return;
  window.toggleGuestPreview = function(){
    var was = document.body.classList.contains('guest-mode');
    coreToggle.apply(this, arguments);
    var now = document.body.classList.contains('guest-mode');
    if(now && !was){
      try{ window.resetEnvelopeIntro(); }catch(e){}
    } else if(!now && was){
      /* leaving preview: never leave the overlay (and its scroll lock) behind */
      try{ finishIntro(); }catch(e){}
    }
  };
})();

/* The builder bar's "Replay Opening" button calls this by name — it replays
   The Picture House's projector opening rather than an envelope. */
window.resetEnvelopeIntro = function(){
  if(!intro) return;
  try{ clearIntroTimers(); }catch(e){}
  storeSet('sessionStorage','pictureHouseVisited','0');
  intro.classList.remove('done','ignite','phase-slate','phase-card','phase-open');
  if(hero) hero.classList.remove('in');
  var ln=document.getElementById('leaderNum'); if(ln) ln.textContent='3';
  window.scrollTo(0,0);
  runIntro();
};
})();
