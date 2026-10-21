/* ============================================================
   RIVIERA - the postcard, the opening, and the seam onto the core.

   The core owns invitationData (declared inline in index.html) and everything
   outside the design: drawer, save, share, export, music. This file pours the
   data into the page and runs the postcard.

   The postcard's states and its one end state are described where it is
   built, below.
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
   THE POSTCARD
   The opening is one real object: a 1960s postcard of the harbour. Turned
   over, the back carries the couple's note in their hand, a stamp, and a
   postmark with their date and place. Then it lifts away to the page.

   STATES  intro (face up, waiting) -> turned (note showing) -> landed.
   Every path into "landed" (turn, Skip, reduced motion, the editor's
   replay) ends in placeLanded(), so the end state is written once.
   ------------------------------------------------------------ */
var cardEl = document.getElementById('pcCard');
var phase  = 'intro';
var spinTimers = [];
function clearSpinTimers(){ spinTimers.forEach(clearTimeout); spinTimers = []; }

/* the note on the back: their own words if they wrote some, otherwise one
   written from their date and place */
function postcardNote(){
  var d = data(), own = txt(d.postcardNote,'');
  var one = txt(d.partner1,''), two = txt(d.partner2,'');
  if(own) return { body: own, sign: one+' & '+two };
  var when = dateWords(false), where = txt(d.venueName,'');
  var body = "We're getting married"+(when ? ' on '+when.replace(/^(\w+), the/, '$1 the') : '')+(where ? ', at '+where : '')+'. Come and celebrate with us by the sea.';
  return { body: body, sign: one+' & '+two };
}
function writeNote(){
  var host = document.getElementById('pcNote'); if(!host) return;
  var n = postcardNote();
  host.textContent = '';
  var hi = document.createElement('p'); hi.className = 'pc-hi'; hi.textContent = txt(data().postcardGreeting,'Dear you,');
  var body = document.createElement('p'); body.className = 'pc-body'; body.textContent = n.body;
  var love = document.createElement('p'); love.className = 'pc-love'; love.textContent = 'With love,';
  var sign = document.createElement('p'); sign.className = 'pc-sign'; sign.textContent = n.sign;
  [hi, body, love, sign].forEach(function(el){ host.appendChild(el); });
}

/* the postmark: the day and month in capitals, the place round the rim */
function postmarkText(){
  var dt = weddingDate();
  var short = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var date = dt ? pad2(dt.getDate())+' '+short[dt.getMonth()]+' '+String(dt.getFullYear()).slice(2) : '';
  var place = txt(data().heroPlace,'') || txt(data().venueName,'');
  return { date: date, place: place.toUpperCase() };
}

function placeLanded(){
  clearSpinTimers();
  phase = 'landed';
  document.body.classList.remove('intro-on','intro-leaving');
  document.body.classList.add('dial-settled');
  if(cardEl) cardEl.setAttribute('tabindex','-1');
  fitNames();
}

function enterIntro(){
  clearSpinTimers();
  phase = 'intro';
  document.body.classList.remove('dial-settled','intro-leaving');
  document.body.classList.add('intro-on');
  if(cardEl){ cardEl.classList.remove('turned'); cardEl.setAttribute('tabindex','0'); }
  var d = data();
  setText('introLine', txt(d.introCall,'A postcard for you'));
  var btn = document.getElementById('introSpin');
  if(btn){ btn.disabled = false; btn.textContent = txt(d.introButton,'Turn it over'); }
  window.scrollTo(0,0);
}

/* turn it over, give the note time to be read, then lift it away */
function spin(){
  if(phase !== 'intro') return;
  phase = 'turned';
  if(cardEl) cardEl.classList.add('turned');
  var btn = document.getElementById('introSpin');
  if(btn){ btn.textContent = 'Open the invitation'; }
  setText('introLine', '');
  spinTimers.push(setTimeout(toHero, 6500));
}
function toHero(){
  if(phase === 'landed') return;
  clearSpinTimers();
  phase = 'leaving';
  document.body.classList.add('intro-leaving');
  spinTimers.push(setTimeout(placeLanded, 1500));
}
function skipIntro(){ if(phase === 'landed') return; placeLanded(); }

if(cardEl){
  cardEl.addEventListener('click', function(){ phase === 'intro' ? spin() : toHero(); });
  cardEl.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); phase === 'intro' ? spin() : toHero(); }
  });
}
(function(){
  var b = document.getElementById('introSpin');
  if(b) b.addEventListener('click', function(){ phase === 'intro' ? spin() : toHero(); });
  var s = document.getElementById('introSkip'); if(s) s.addEventListener('click', skipIntro);
})();

window.addEventListener('resize', (function(){
  var t = null;
  return function(){ clearTimeout(t); t = setTimeout(fitNames, 150); };
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
function recentre(){ fitNames(); }
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
    /* LUMA: there is no calendar function on Luma; the core makes the file in the browser */
    if(location.protocol === 'file:' || window.lumaBoot){
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
  document.title = one+' & '+two+' - a postcard';

  /* photographs */
  document.body.classList.toggle('photos-as-taken', d.photoTone === false);
  /* LUMA: the couple's photo; without one, the harbour from the postcard
     (generated for this design, see assets/CREDITS.txt) rather than a blank */
  var hero = /^(https:|blob:)/.test(txt(d.heroPhoto,'')) ? txt(d.heroPhoto,'') : 'assets/postcard-harbour.jpg';
  ['heroImg','introImg'].forEach(function(id){
    var im = document.getElementById(id);
    if(im && im.getAttribute('src') !== hero) im.setAttribute('src', hero);
  });

  /* hero */
  setText('heroPlace', txt(d.heroPlace,''));
  setText('heroCta', txt(d.heroCta,'Reply'));
  if(phase === 'intro'){
    setText('introLine', txt(d.introCall,'A postcard for you'));
    var sb = document.getElementById('introSpin'); if(sb) sb.textContent = txt(d.introButton,'Turn it over');
  }
  writeNote();
  var pm = postmarkText();
  document.querySelectorAll('[data-sync="pmDate"]').forEach(function(el){ el.textContent = pm.date; });
  document.querySelectorAll('[data-sync="pmPlace"]').forEach(function(el){ el.textContent = pm.place; });

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
  setText('rsvpDoneTitle', txt(d.introLanded,'Posted')+'.');

  /* footer */
  setText('footNames', one+' & '+two);
  setText('footTag', txt(d.hashtag,''));

  renderTimeline();
  renderGallery();
  if(typeof window.renderFaqPublic === 'function'){ try{ window.renderFaqPublic(); }catch(e){} }
  if(typeof window.handleRsvpGuestCountChange === 'function'){ try{ window.handleRsvpGuestCountChange(); }catch(e){} }

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
          setText('rsvpDoneTitle', txt(d.introLanded,'Posted')+'.');
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

try{ buildContent(); }catch(e){ if(window.console) console.error(e); }
try{ syncMpFields(); }catch(e){}
if(reduced) placeLanded(); else enterIntro();
observeReveals();
