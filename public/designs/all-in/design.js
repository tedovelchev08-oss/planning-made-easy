/* ============================================================
   ALL IN - the deal, the cards, and the seam onto the core.

   The core owns invitationData (declared inline in index.html) and everything
   outside the design: drawer, save, share, export, music. This file pours the
   data into the cards and runs the deal.

   STATES (classes on <body>)
     deck     five cards stacked face down, "Tap to deal", page scroll locked
     dealing  the deck has been tapped: cards fly into the hand and turn over,
              the names follow. Transitions only, so a throttled tab simply
              arrives at the end state instead of stalling.
     (none)   the dealt hand, settled
     instant  added for one frame to jump to the end with no transitions
              (Skip, reduced motion, leaving guest preview)
   ============================================================ */
function txt(v,d){ v=(v==null?'':String(v)).trim(); return v||d||''; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function setText(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
function data(){ return (typeof invitationData==='object'&&invitationData)?invitationData:{}; }
function pad2(n){ n=+n; return (n<10?'0':'')+n; }

/* The pristine sample, for the drawer's "Start over". */
var SAMPLE = (function(){ try{ return JSON.stringify(data()); }catch(e){ return null; } })();
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var SAMPLE_ACE = 'assets/photos/ace.jpg';
var SAMPLE_STORY = 'assets/photos/couple-wide.jpg';

/* ------------------------------------------------------------
   DATE
   ------------------------------------------------------------ */
var ORD = ['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth',
  'eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth',
  'nineteenth','twentieth','twenty-first','twenty-second','twenty-third','twenty-fourth','twenty-fifth',
  'twenty-sixth','twenty-seventh','twenty-eighth','twenty-ninth','thirtieth','thirty-first'];
var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var ROMAN  = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function weddingDate(){
  var p = String(txt(data().date,'')).split('-');
  if(p.length !== 3) return null;
  var dt = new Date(+p[0], +p[1]-1, +p[2]);
  return isNaN(dt) ? null : dt;
}
function dateWords(){
  var own = txt(data().dateWords,'');
  if(own) return own;
  var dt = weddingDate(); if(!dt) return '';
  return DAYS[dt.getDay()]+', the '+ORD[dt.getDate()]+' of '+MONTHS[dt.getMonth()]+' '+dt.getFullYear();
}
function initials(){
  var own = txt(data().monogram,'');
  if(own) return own;
  var a = txt(data().partner1,'').charAt(0).toUpperCase(), b = txt(data().partner2,'').charAt(0).toUpperCase();
  return (a && b) ? a+'&'+b : (a || b || 'E&M');
}

/* ------------------------------------------------------------
   THE DEAL
   ------------------------------------------------------------ */
var body = document.body;
var dealTimers = [];
function clearDealTimers(){ dealTimers.forEach(clearTimeout); dealTimers = []; }

function settle(){
  clearDealTimers();
  body.classList.add('instant');
  body.classList.remove('deck','dealing');
  void body.offsetWidth;                         /* commit the end state with no transitions */
  dealTimers.push(setTimeout(function(){ body.classList.remove('instant'); }, 50));
  fitAll();
}

function enterDeck(){
  clearDealTimers();
  body.classList.add('instant');
  body.classList.remove('dealing');
  body.classList.add('deck');
  void body.offsetWidth;
  body.classList.remove('instant');
  window.scrollTo(0,0);
  var d = data();
  setText('introLine', txt(d.introCall,'You have been dealt a hand'));
  setText('introDeal', txt(d.introButton,'Tap to deal'));
  var ace = document.querySelector('.c-a'); if(ace){ ace.setAttribute('tabindex','0'); ace.setAttribute('role','button'); ace.setAttribute('aria-label', txt(d.introButton,'Tap to deal')); }
}

function deal(){
  if(!body.classList.contains('deck')) return;
  body.classList.add('dealing');
  body.classList.remove('deck');
  var ace = document.querySelector('.c-a'); if(ace){ ace.removeAttribute('tabindex'); ace.removeAttribute('role'); ace.removeAttribute('aria-label'); }
  /* the last name and the details finish arriving at about 3.7s */
  dealTimers.push(setTimeout(function(){ body.classList.remove('dealing'); }, 4000));
}

(function(){
  document.querySelectorAll('#hero .card').forEach(function(c){
    c.addEventListener('click', deal);
    c.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); deal(); } });
  });
  var b = document.getElementById('introDeal'); if(b) b.addEventListener('click', deal);
  var s = document.getElementById('introSkip'); if(s) s.addEventListener('click', settle);
})();

/* ------------------------------------------------------------
   FITTING
   The court cards print the names at a fixed share of the card width; a
   long name is scaled down until it fits inside the court frame. The hero
   names get the same treatment against the viewport.
   ------------------------------------------------------------ */
function textWidth(el){ var r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; }
function fitCourts(){
  document.querySelectorAll('.court').forEach(function(court){
    court.style.setProperty('--nf', 1);
    var n = court.querySelector('.n'); if(!n) return;
    /* measured unrotated: the card's own rotation does not change its layout width */
    var avail = court.clientWidth * .88, w = n.scrollWidth || textWidth(n);
    if(w > avail && w > 0) court.style.setProperty('--nf', Math.max(.45, avail/w).toFixed(3));
  });
}
function fitNames(){
  var h = document.querySelector('.hero-names'); if(!h) return;
  document.documentElement.style.setProperty('--fit', 1);
  var avail = window.innerWidth - 32, widest = 0;
  h.querySelectorAll('.hn').forEach(function(el){ widest = Math.max(widest, textWidth(el)); });
  if(widest > avail && widest > 0) document.documentElement.style.setProperty('--fit', Math.max(.5, avail/widest).toFixed(3));
}
function fitAll(){ fitCourts(); fitNames(); }
if(document.fonts && document.fonts.ready){ document.fonts.ready.then(fitAll); }
window.addEventListener('load', fitAll);
window.addEventListener('resize', (function(){ var t=null; return function(){ clearTimeout(t); t=setTimeout(fitAll,150); }; })());

/* ------------------------------------------------------------
   CONTENT
   ------------------------------------------------------------ */
var SUITS = [['&hearts;','red'],['&spades;','navy'],['&diams;','red'],['&clubs;','navy']];

function renderTimeline(){
  var host = document.getElementById('tlItems'); if(!host) return;
  var items = Array.isArray(data().schedule) ? data().schedule : [];
  var section = document.getElementById('schedule');
  if(section) section.style.display = items.length ? '' : 'none';
  host.innerHTML = items.map(function(it, i){
    var s = SUITS[i % 4], time = esc(txt(it.time,''));
    return '<li class="ev-card rv">'+
             '<div class="face">'+
               '<div class="idx tl '+s[1]+'">'+time+'<span class="s">'+s[0]+'</span></div>'+
               '<div class="ev-body"><span class="ev-suit '+s[1]+'">'+s[0]+'</span>'+
                 '<span class="ev-title">'+esc(txt(it.title,''))+'</span>'+
                 (txt(it.venue,'') ? '<span class="ev-venue">'+esc(it.venue)+'</span>' : '')+
               '</div>'+
               '<div class="idx br '+s[1]+'">'+time+'<span class="s">'+s[0]+'</span></div>'+
             '</div>'+
           '</li>';
  }).join('');
  observeReveals();
}

function renderGallery(){
  var grid = document.querySelector('.photo-hand'); if(!grid) return;
  var items = Array.isArray(data().gallery) ? data().gallery.filter(function(g){ return txt(g.photo,''); }) : [];
  var section = document.getElementById('gallery');
  if(section) section.style.display = items.length ? '' : 'none';
  var RANKS = ['A','K','Q','J'];
  grid.innerHTML = items.map(function(it, i){
    var s = SUITS[i % 4];
    return '<figure class="pcard rv'+(i>3?' extra':'')+'">'+
             '<div class="frame"><span class="pc-idx '+s[1]+'">'+RANKS[i % 4]+s[0]+'</span>'+
               '<img src="'+esc(it.photo)+'" alt="'+esc(txt(it.caption,''))+'" loading="lazy"></div>'+
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

var lastReplyYes = true;
function syncAll(sel, v){ document.querySelectorAll('[data-sync="'+sel+'"]').forEach(function(el){ el.textContent = v; }); }

function buildContent(){
  guardMusicTrack();
  var d = data();
  var one = txt(d.partner1,''), two = txt(d.partner2,''); /* LUMA: never a sample couple */
  var dt = weddingDate();

  syncAll('one', one);
  syncAll('two', two);
  syncAll('mono', initials());
  syncAll('dateWords', dateWords());
  syncAll('day', dt ? dt.getDate() : '');
  syncAll('weekday', dt ? DAYS[dt.getDay()] : '');
  syncAll('month', dt ? MONTHS[dt.getMonth()] : '');
  syncAll('roman', dt ? ROMAN[dt.getMonth()] : '');
  syncAll('year', dt ? dt.getFullYear() : '');
  document.title = one+' & '+two+' - All In';

  /* photographs: the Ace always shows the couple's opening photograph; the
     story shows it wide, falling back to the wide sample while it is still
     the sample crop. */
  body.classList.toggle('photos-as-taken', d.photoTone === false);
  var hero = txt(d.heroPhoto, ''); /* LUMA: the couple's photo or their placeholder; no stock photo ships */
  var heroImg = document.getElementById('heroImg');
  if(heroImg && heroImg.getAttribute('src') !== hero) heroImg.setAttribute('src', hero);
  var storyImg = document.getElementById('storyImg');
  var story = hero; /* LUMA: luma.js hides the wide story photo while it's only the placeholder */
  if(storyImg && storyImg.getAttribute('src') !== story) storyImg.setAttribute('src', story);

  /* hero */
  setText('heroPlace', txt(d.heroPlace,''));
  setText('heroCta', txt(d.heroCta,'Reply'));
  if(body.classList.contains('deck')){
    setText('introLine', txt(d.introCall,'You have been dealt a hand'));
    setText('introDeal', txt(d.introButton,'Tap to deal'));
  }

  /* story */
  setText('storyTitle', txt(d.storyTitle,'How we met'));
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
  setText('galleryHeading', txt(d.galleryHeading,'A few of ours'));
  setText('faqHeading', txt(d.faqHeading,'Things you might ask'));

  /* rsvp */
  setText('rsvpLead', txt(d.rsvpKicker,''));
  setText('rsvpTitle', txt(d.rsvpTag,"We're all in. Are you?"));
  var dl = txt(d.rsvpDeadline,'');
  setText('rsvpDeadline', dl ? (txt(d.rsvpDeadlinePrefix,'Kindly reply by')+' '+dl) : '');
  setText('rsvpNameLabel', txt(d.rsvpNameLabel,'Your name'));
  setText('joinLabel', txt(d.rsvpAttendanceLabel,'Will you be there?'));
  setText('rsvpYesLabel', txt(d.rsvpYesLabel,'All in'));
  setText('rsvpNoLabel', txt(d.rsvpNoLabel,'With regret'));
  setText('rsvpGuestsLabel', txt(d.rsvpGuestsLabel,'How many of you'));
  setText('rsvpPlusOneLabel', txt(d.rsvpPlusOneLabel,"Your guest's name"));
  setText('rsvpNotesLabel', txt(d.rsvpNotesLabel,'A note for us'));
  setText('rsvpSubmitLabel', txt(d.rsvpSubmitLabel,'Send reply'));
  setText('rsvpDoneTitle', txt(d.rsvpDoneTitle,'Thank you.'));
  var contact = document.getElementById('rsvpContact');
  if(contact){ contact.textContent = txt(d.rsvpEmailText,''); contact.hidden = !txt(d.rsvpEmailText,''); }
  var doneEl = document.getElementById('rsvp-confirmed');
  if(doneEl && !doneEl.hidden) setText('rsvpDoneSub', lastReplyYes ? txt(d.rsvpDoneYes,'') : txt(d.rsvpDoneNo,''));

  /* footer */
  setText('footNames', one+' & '+two);
  setText('footTag', txt(d.hashtag,''));

  renderTimeline();
  renderGallery();
  if(typeof window.renderFaqPublic === 'function'){ try{ window.renderFaqPublic(); }catch(e){} }
  if(typeof window.handleRsvpGuestCountChange === 'function'){ try{ window.handleRsvpGuestCountChange(); }catch(e){} }
  fitAll();
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
  els.forEach(function(el, i){ el.style.transitionDelay = (i % 4)*80+'ms'; revealObserver.observe(el); });
}

/* ------------------------------------------------------------
   RSVP
   ------------------------------------------------------------ */
(function(){
  var labels = document.querySelectorAll('.choice-cards .choice');
  function sync(){
    labels.forEach(function(l){ var i = l.querySelector('input'); l.classList.toggle('selected', !!(i && i.checked)); });
    var att = document.querySelector('input[name="attending"]:checked');
    var g = document.getElementById('rsvp-guests-wrap');
    if(g) g.style.display = (att && att.value === 'no') ? 'none' : '';
  }
  labels.forEach(function(l){ var i = l.querySelector('input'); if(i) i.addEventListener('change', sync); });
  sync();
})();

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

/* THE CORE DOES NOT WIRE THE RSVP FORM (submitRSVP is defined but never
   attached). Without a handler the browser does a native POST and the whole
   invitation reloads. This design writes its own: a fire-and-forget POST to
   Netlify Forms, then the chosen card turns face up. */
(function(){
  var form = document.getElementById('rsvp-form');
  var errorEl = document.getElementById('rsvp-error');
  var doneEl = document.getElementById('rsvp-confirmed');
  var doneCard = document.getElementById('doneCard');
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
    fetch('/', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: body })
      .then(function(res){
        if(!res.ok) return res.json().then(function(b){ failed(b && b.error); }, function(){ failed(); });
        form.hidden = true;
        var d = data();
        /* the card that turns over is the one the guest chose */
        var idx = document.getElementById('doneIdx'), suit = document.getElementById('doneSuit');
        if(idx){ idx.className = 'dc-idx '+(lastReplyYes?'red':'navy'); idx.innerHTML = lastReplyYes ? 'A<span class="s">&hearts;</span>' : '2<span class="s">&clubs;</span>'; }
        if(suit){ suit.className = 'dc-suit '+(lastReplyYes?'red':'navy'); suit.innerHTML = lastReplyYes ? '&hearts;' : '&clubs;'; }
        setText('rsvpDoneTitle', txt(d.rsvpDoneTitle,'Thank you.'));
        setText('rsvpDoneSub', lastReplyYes ? txt(d.rsvpDoneYes,'Your reply is with us.') : txt(d.rsvpDoneNo,'Your reply is with us.'));
        if(doneEl){
          doneEl.hidden = false;
          if(doneCard){ doneCard.classList.remove('up'); void doneCard.offsetWidth; setTimeout(function(){ doneCard.classList.add('up'); }, 30); }
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
    if(doneCard) doneCard.classList.remove('up');
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
    ['renderGalleryDrawer','renderScheduleDrawer','renderFaqDrawer'].forEach(function(f){
      if(typeof window[f] === 'function'){ try{ window[f](); }catch(e){} }
    });
    buildContent();
  };
}

/* The builder bar's "Replay Opening" button, and the core's instant reset. */
window.resetEnvelopeIntro = function(){ if(reduced){ settle(); return; } enterDeck(); };
window.resetEnvelopeIntroInstant = function(){};

/* Guest preview shows the deal exactly as a guest gets it. */
(function(){
  var coreToggle = window.toggleGuestPreview;
  if(typeof coreToggle !== 'function') return;
  window.toggleGuestPreview = function(){
    var was = body.classList.contains('guest-mode');
    coreToggle.apply(this, arguments);
    var now = body.classList.contains('guest-mode');
    if(now && !was) window.resetEnvelopeIntro();
    else if(!now && was) settle();
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
   An exported guest file is a snapshot of a live page, so it can arrive with
   state classes on <body>. Start clean either way. */
body.classList.remove('dealing','instant');
try{ buildContent(); }catch(e){ if(window.console) console.error(e); }
try{ syncMpFields(); }catch(e){}
if(reduced) settle(); else enterDeck();
observeReveals();
