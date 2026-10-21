/* ============================================================
   LIQUID GOLD  ·  design-8  ·  the design layer
   Loads AFTER wedding-core.js and overrides the core by NAME.

   HOW THE TWO HALVES MEET

   The core owns one object, invitationData, and everything that touches
   the outside world: the setup drawer, saving, sharing, the RSVP post to
   Netlify, the calendar links. It knows nothing about this design.

   This design's engine came from a standalone page and runs off its own
   config object, `wedding`. Rather than rewrite the engine, buildWedding()
   below pours invitationData into `wedding` and buildContent() redraws from
   it. So there is exactly one seam between the two, and it is in this file.

   WHAT WAS BROKEN IN THE ORIGINAL TEMPLATE, and is fixed here:
     * the RSVP went nowhere. It faded the form out and showed a thank-you
       panel without sending anything - no Netlify attributes, no form-name,
       and field names of its own invention. The core owns the submit now.
     * every photograph was painted procedurally on a canvas. Beautiful, and
       useless for a wedding: there was no way for a couple to use their own
       pictures. photo() now returns an uploaded photograph when there is
       one and falls back to the painted version when there is not.
     * content was built once by an IIFE, so nothing could change after load
       and the setup drawer would have had nothing to talk to.
============================================================ */
(function(){
'use strict';

/* ---- design-specific drawer fields -------------------------------------
   The core syncs anything with a data-mp-field attribute into
   invitationData under this key, so a field can be added in index.html
   and it persists, exports and shares with no extra code. */
/* EVERY KEY HERE MUST BE AN ELEMENT ID IN index.html, and every one of
   those elements must have a matching data-mp-field input in the drawer.
   That pairing IS the mechanism - the loop below writes invitationData[key]
   into getElementById(key). A key with no element edits nothing and fails
   silently, which is exactly how design-7's leftovers sat in this drawer
   doing nothing.

   To check the pairing holds, list the drawer's data-mp-field values and
   the document's ids and compare them; anything in one and not the other
   is a field that cannot work. */
const LG_FIELDS = [
  'dayCaption','dayTag','faqHeading','faqTag','galleryTag',
  'heroEyebrow','rsvpAttendanceLabel','rsvpDeadlinePrefix','rsvpEmailText',
  'rsvpErrorText','rsvpGuestsLabel','rsvpKicker','rsvpNameLabel','rsvpNoLabel',
  'rsvpNotesLabel','rsvpPlusOneLabel','rsvpSubmitLabel','rsvpTag','rsvpYesLabel',
  'scheduleHeading','storyOpener','storyTag','storyTitle'
];

/* The shape the engine expects. Everything here is replaced by
   buildWedding() before the first paint; these are only the fallbacks for
   a field a couple has emptied. */
let wedding = {
  couple:{personOne:'',personTwo:'',initials:''}, /* LUMA: never a sample couple */
  date:{display:'24 · 08 · 2027',iso:'2027-08-24',parts:['24','08','2027']},
  hero:{eyebrow:'THE WEDDING OF',statement:'A beautiful beginning.'},
  story:{title:'OUR STORY',statements:['IT STARTED WITH TWO','TWO LIVES','ONE UNEXPECTED MOMENT','AND NOW','US']},
  ceremony:{time:'16:00',venue:'The Gilded Hall',address:'',description:'',dress:''},
  celebration:{time:'19:00',venue:'The Long Table',address:'',words:'DINNER,MUSIC,DANCING'},
  timeline:[], gallery:[],
  rsvp:{deadline:'',email:''}
};
/* ================================================================
   01 · utilities
   ================================================================ */
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH=matchMedia('(hover:none)').matches;
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const eIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const eI=t=>t*t*t;
const heavy=t=>1-Math.pow(1-clamp(t,0,1),4);
if(history.scrollRestoration)history.scrollRestoration='manual';
scrollTo(0,0);
function mulberry32(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ================================================================
   02 · procedural photography
   ================================================================ */
function paintPhoto(seed,kind){
  const w=620,h=kind==='hero'?900:780,c=document.createElement('canvas');
  c.width=w;c.height=h;const g=c.getContext('2d'),R=mulberry32(seed);
  let gr=g.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,'#0b0805');gr.addColorStop(.5,'#070503');gr.addColorStop(1,'#030202');
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  if(kind==='rim'||kind==='hero'){
    const cx=w*(.35+R()*.3),cy=h*(.42+R()*.2);
    gr=g.createRadialGradient(cx,cy,10,cx,cy,w*.62);
    gr.addColorStop(0,'rgba(240,214,160,.28)');gr.addColorStop(.35,'rgba(180,130,60,.12)');gr.addColorStop(1,'transparent');
    g.fillStyle=gr;g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(246,224,170,.5)';g.lineWidth=2.2;g.beginPath();
    g.arc(cx,cy,w*(.22+R()*.1),-.6+R(),1.4+R()*.5);g.stroke();
    g.lineWidth=8;g.strokeStyle='rgba(246,224,170,.08)';g.stroke();
  }
  if(kind==='candle'){
    for(let i=0;i<14;i++){const x=R()*w,y=h*.3+R()*h*.6,r=8+R()*44;
      gr=g.createRadialGradient(x,y,0,x,y,r);
      gr.addColorStop(0,`rgba(238,200,130,${.05+R()*.14})`);gr.addColorStop(1,'transparent');
      g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}
  }
  if(kind==='cloth'){
    for(let x=0;x<w;x+=2){const v=Math.sin(x*.02+R()*.4)*.5+Math.sin(x*.061)*.5;
      g.fillStyle=`rgba(200,160,90,${.015+Math.max(0,v)*.05})`;g.fillRect(x,0,2,h);}
  }
  if(kind==='window'){
    for(let i=0;i<3;i++){g.save();g.translate(w*(.2+R()*.6),0);g.rotate(.12+R()*.1);
      gr=g.createLinearGradient(0,0,60,0);
      gr.addColorStop(0,'transparent');gr.addColorStop(.5,`rgba(235,205,150,${.05+R()*.08})`);gr.addColorStop(1,'transparent');
      g.fillStyle=gr;g.fillRect(0,-40,90+R()*90,h+80);g.restore();}
  }
  if(kind==='night'){
    const hy=h*(.55+R()*.15);
    gr=g.createLinearGradient(0,hy-90,0,hy+90);
    gr.addColorStop(0,'transparent');gr.addColorStop(.5,'rgba(214,169,79,.14)');gr.addColorStop(1,'transparent');
    g.fillStyle=gr;g.fillRect(0,hy-90,w,180);
    for(let i=0;i<40;i++){g.globalAlpha=.2+R()*.5;g.fillStyle='#e9dcc0';
      g.fillRect(R()*w,R()*hy*.9,1,1);}g.globalAlpha=1;
  }
  for(let i=0;i<2600;i++){
    g.fillStyle=R()>.5?`rgba(255,240,210,${R()*.028})`:`rgba(0,0,0,${R()*.09})`;
    g.fillRect(R()*w,R()*h,1,1);}
  gr=g.createRadialGradient(w/2,h/2,h*.22,w/2,h/2,h*.8);
  gr.addColorStop(0,'transparent');gr.addColorStop(1,'rgba(0,0,0,.8)');
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  return c.toDataURL('image/jpeg',.88);
}
const photoCache={};
function photo(seed,kind){const k=seed+kind;return photoCache[k]||(photoCache[k]=paintPhoto(seed,kind));}

/* ================================================================

/* ============================================================
   THE SEAM  ·  invitationData  ->  wedding
============================================================ */

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function txt(v, fallback){
  const s = (v == null ? '' : String(v)).trim();
  return s || fallback || '';
}
/* Splits a one-field list. Accepts commas, newlines OR the middot, because
   the shared data already writes celebrationPlace as three words joined by
   a middot ("Dinner / Music / Dancing" with U+00B7 between them), and
   splitting on commas alone turned all three into a single word.
   The middot is written as the escape · rather than pasted in, because
   this project's PowerShell tooling reads .js as ANSI and turns a literal
   one into mojibake - which has already happened twice here. */
function listOf(v, fallback){
  /* DELETED IS NOT THE SAME AS NEVER SET.

     This used to fall back whenever the value was falsy, so a couple who
     cleared the rising lines got OUR five sample lines back on the page -
     silently, and looking for all the world like their own words. That is
     the same failure the sample-wording counter exists to prevent.

     The fallback now applies only when the key is genuinely absent, which
     means an old saved draft or a share link from before the field existed.
     An empty string is a decision, and it is honoured. */
  const missing = (v === undefined || v === null);
  const raw = missing ? (fallback || '') : String(v);
  return raw.split(/[\n,·]+/).map(s => s.trim()).filter(Boolean);
}

/* The date arrives as an ISO string. Split it WITHOUT new Date(): parsing
   "2027-08-24" as a Date makes it midnight UTC, which in any timezone west
   of London is the 23rd - the invitation would show the wrong day. */
function dateParts(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso, ''));
  if (!m) return { display:'', iso:'', parts:['','',''] };
  const [, y, mo, d] = m;
  return { display: `${d} · ${mo} · ${y}`, iso: `${y}-${mo}-${d}`, parts:[d, mo, y] };
}

function initialsOf(a, b){
  const x = txt(a, '').charAt(0).toUpperCase();
  const y = txt(b, '').charAt(0).toUpperCase();
  return (x && y) ? `${x} & ${y}` : (x || y || '&');
}

function buildWedding(){
  const d = (typeof invitationData === 'object' && invitationData) ? invitationData : {};
  const dt = dateParts(d.date);

  wedding = {
    couple:{
      /* LUMA: names always come from the couple's wedding, never a sample */
      personOne: txt(d.partner1,''),
      personTwo: txt(d.partner2,''),
      initials:  initialsOf(d.partner1, d.partner2)
    },
    date: dt, /* LUMA: the couple's date, never the sample one */
    hero:{
      eyebrow:   txt(d.heroEyebrow,'The Wedding Of').toUpperCase(),
      /* heroQuote is two lines in the shared data; this design shows one. */
      /* LUMA: without their own line, the place they marry, not a stock motto */
      statement: txt((d.heroQuote||'').split('\n')[0], txt(d.venueName,'') ? 'At ' + txt(d.venueName,'') : '')
    },
    story:{
      title:      txt(d.storyTitle,'Our Story').toUpperCase(),
      opener:     txt(d.storyOpener,'HOW IT BEGAN').toUpperCase(),
      /* LUMA: by default the rising lines are theirs (their names, then the
         month they marry) instead of "Two lives / One unexpected moment" */
      statements: listOf(d.storyStatements,
                    [txt(d.partner1,''), 'AND', txt(d.partner2,''),
                     (function(){ var m = /^\d{4}-(\d{2})/.exec(txt(d.date,'')); return m ? 'ONE DAY IN ' + ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][+m[1]-1] : ''; })(),
                     'US'].filter(Boolean).join(','))
                    .map(s => s.toUpperCase())
    },
    ceremony:{
      time:        txt(d.time,''),
      venue:       txt(d.venueName,''),
      address:     txt(d.venueAddress,''),
      /* ceremonyNote, NOT story1. The ceremony card had no field of its
         own and borrowed the first paragraph of the couple's story, so a
         guest reading "4:00 PM, Villa Cora" was told how the couple met
         rather than anything about the ceremony. */
      description: txt(d.ceremonyNote,''),
      dress:       [txt(d.dressCode,''), txt(d.dressCodeNote,'')].filter(Boolean).join(' · ')
    },
    celebration:{
      time:    txt(d.celebrationTime, txt(d.time,'')),
      venue:   txt(d.celebrationAddress,''),
      address: txt(d.celebrationPlace,''),
      /* celebrationPlace is passed straight through, NOT through txt() with
         a default - wrapping it would put "Dinner, Music, Dancing" back on
         the page for a couple who deliberately cleared it. */
      words:   listOf(d.celebrationPlace, 'Dinner,Music,Dancing')
                 .map(s => s.toUpperCase())
    },
    timeline: Array.isArray(d.schedule) ? d.schedule.map(ev => ({
      time: txt(ev.time,''), title: txt(ev.title,''), description: txt(ev.venue,'')
    })) : [],
    gallery: Array.isArray(d.gallery) ? d.gallery.map(g => ({
      caption: txt(g.caption,''), photo: txt(g.photo,'')
    })) : [],
    rsvp:{ deadline: txt(d.rsvpDeadline,''), email: txt(d.rsvpEmailText,'') }
  };
  return wedding;
}

/* ---- photographs -------------------------------------------------------
   The template painted every picture on a canvas. Gorgeous, and no use to
   a couple who want their own. A real photograph wins whenever there is
   one; the painted version stays as the fallback, which is what a brand
   new copy of the invitation shows before anything is uploaded. */
function realOrPainted(src, seed, kind){
  const s = txt(src, '');
  return s ? s : photo(seed, kind);
}

/* ============================================================
   CONTENT  ·  re-runnable

   The original ran this once as an IIFE, so nothing could change after
   load. It is a named function now and every container is CLEARED before
   it is filled - append-only rendering duplicated the whole gallery each
   time a caption was edited.
============================================================ */
function buildContent(){
  const w = wedding;
  const d = (typeof invitationData === "object" && invitationData) ? invitationData : {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const html = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };

  set('srTitle', `The wedding of ${w.couple.personOne} and ${w.couple.personTwo} — ${w.date.display}. ${w.hero.statement}`);
  html('brand', esc(w.couple.initials));
  /* The opening's engraved mark is the couple's own initials, not the
     sample ones sitting in the markup. */
  set('introMarkA', w.couple.personOne.charAt(0).toUpperCase());
  set('introMarkB', String.fromCharCode(38) + ' ' + w.couple.personTwo.charAt(0).toUpperCase());
  set('heroEyebrow', w.hero.eyebrow);
  html('heroNames', `${esc(w.couple.personOne.toUpperCase())}<span class="amp">&amp;</span>${esc(w.couple.personTwo.toUpperCase())}`);
  set('heroDate', w.date.display);
  set('heroState', w.hero.statement);
  set('menuDate', w.date.display);
  html('endNames', esc(w.couple.initials));
  set('rdNames', (w.couple.personOne + ' & ' + w.couple.personTwo).toUpperCase());

  set('storyTitle', w.story.title);
  set('storyOpener', w.story.opener);

  /* The two prose paragraphs. Hidden as a block when both are empty, so a
     couple who would rather let the rising lines speak alone is not left
     with a gap where the text used to be. */
  const p1 = txt(d.story1,''), p2 = txt(d.story2,'');
  set('storyP1', p1); set('storyP2', p2);
  const p1el = document.getElementById('storyP1');
  const p2el = document.getElementById('storyP2');
  if (p1el) p1el.style.display = p1 ? '' : 'none';
  if (p2el) p2el.style.display = p2 ? '' : 'none';
  const prose = document.getElementById('storyProse');
  if (prose) prose.style.display = (p1 || p2) ? '' : 'none';

  /* Venue, address and dress code live in The Day now. The rest of what
     the ceremony and celebration cards used to show - their times, the
     ceremony note, the three celebration words - is either in the timeline
     or gone with those cards, so the setters for it were writing into
     elements that no longer exist. A setter with no target fails silently,
     which is exactly how a drawer full of controls that edit nothing
     survives unnoticed. */
  set('cerVenue', w.ceremony.venue);
  set('cerAddr', w.ceremony.address);
  set('cerDress', w.ceremony.dress);

  set('rsvpDeadlineText', w.rsvp.deadline);
  set('rsvpEmailText', w.rsvp.email);

  html('dateStack', w.date.parts.map(p => `<div class="date-num goldtext">${esc(p)}</div>`).join(''));

  html('wordTwo', 'TWO'.split('').map((ch,i) => `<span class="lt" style="--i:${i}">${ch}</span>`).join(''));
  html('wordOne', 'ONE'.split('').map((ch,i) => `<span class="lt" style="--i:${i}">${ch}</span>`).join(''));

  html('statements', w.story.statements.map((s,i) => {
    const last = i === w.story.statements.length - 1;
    return `<p class="statement-row ${last ? 'g' : ''} rv" style="--d:.1s">
      <span class="maskline"><span>${esc(s)}</span></span></p>`;
  }).join(''));

  /* Photographs. The hero and the story frame take the couple's own when
     they have uploaded one. */
  const heroImg = document.getElementById('heroImg');
  if (heroImg) heroImg.src = realOrPainted(d.heroPhoto, 7, 'hero');
  if (heroImg) heroImg.alt = `${w.couple.personOne} and ${w.couple.personTwo}`;

  buildGallery();
  buildTimeline();

  /* The drawer's own wording fields. Written LAST so they win over anything
     set above - several of these ids (rsvpEmailText, rsvpDeadlinePrefix,
     storyTitle) are also written from the mapped `wedding` object, and the
     couple's typed value has to be the one that survives. */
  applyDesignFields();

  /* Menu. Built from the sections that actually exist, so a hidden
     schedule or an emptied Questions list never leaves a link that
     scrolls to nothing. */
  /* No numerals. They used to run 01-08 down the menu and 01-07 across the
     section labels, which implied an order that is not real: Questions is
     not the seventh step of anything, and RSVP is an action rather than a
     stage. The one part of this invitation that IS a sequence - the day
     itself - is numbered by the clock, 4:00 PM through midnight, which
     tells a guest something the numerals never did. */
  const wanted = [
    ['OUR STORY','#s-story'],
    ['THE DAY','#s-day'],
    ['THE EVENING','#schedule-timeline-section'],
    ['PHOTOGRAPHS','#gallery-section'],
    ['RSVP','#s-rsvp'],
    ['QUESTIONS','#faq-section']
  ].filter(m => {
    const el = document.querySelector(m[1]);
    return el && getComputedStyle(el).display !== 'none';
  });
  html('menuList', wanted.map((m,i) =>
    `<li style="transition-delay:${(0.1 + i * 0.09).toFixed(2)}s"><a href="${m[1]}">${m[0]}</a></li>`).join(''));

  /* infPath is animated with stroke-dashoffset, so it needs its own length
     measured before it can be drawn on. framePath went with the story
     photograph's frame. */
  ['infPath'].forEach(id => {
    const p = document.getElementById(id);
    if (!p) return;
    try{
      const L = p.getTotalLength();
      p.style.setProperty('--len', L);
      p.style.strokeDasharray = L;
    }catch(e){}
  });

  document.querySelectorAll('.field select').forEach(s => {
    const f = s.closest('.field'); if (f) f.classList.add('filled');
  });

  if (typeof window.__lgRebind === 'function') window.__lgRebind();
}

/* Pours the drawer's wording fields onto the page, and the page's values
   back into the drawer. The shared core knows nothing about any of these -
   they are this design's own labels - so without this the whole Wording
   half of every panel would type into a void. */
function applyDesignFields(){
  const d = (typeof invitationData === 'object' && invitationData) ? invitationData : {};
  LG_FIELDS.forEach(key => {
    const el = document.getElementById(key);
    if (el && d[key] != null && String(d[key]).trim() !== '') el.textContent = d[key];
  });
}


/* ---------------- GALLERY CAPTIONS ----------------
   The line under each photograph - "The Proposal · Amalfi Coast" - was not
   editable. The drawer has always had an empty #mp-caption-list waiting for
   it and nothing ever filled it, so the captions read as fixed text a
   couple could not change. Ported from design-7.

   The caption lives on the same gallery object the core owns, so it travels
   with reordering, with a shared link and with the exported file - there is
   no second place to keep it in step. */
function renderCaptionEditor(){
  const wrap = document.getElementById('mp-caption-list');
  if (!wrap) return;
  const photos = (typeof invitationData === 'object' && invitationData && invitationData.gallery) || [];

  if (!photos.length){
    wrap.innerHTML = '<p class="ed-hint">No photographs yet.</p>';
    return;
  }

  /* Rebuild only when the row COUNT changes. Re-creating the inputs on every
     keystroke would take focus out of the field being typed in. */
  if (wrap.childElementCount !== photos.length){
    wrap.innerHTML = '';
    photos.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'ed-field';

      const label = document.createElement('label');
      label.textContent = 'Caption ' + (idx + 1);
      label.setAttribute('for', 'mp-cap-' + idx);

      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'mp-cap-' + idx;
      input.placeholder = 'Optional';
      input.addEventListener('input', () => {
        const list = invitationData.gallery || [];
        if (!list[idx]) return;
        list[idx].caption = input.value;
        /* buildGallery renders from `wedding`, which buildWedding fills from
           invitationData - so writing the caption and calling buildGallery
           alone repaints the OLD text. Refresh the seam first. */
        buildWedding();
        buildGallery();
        if (typeof window.__lgRebind === 'function') window.__lgRebind();
      });

      row.appendChild(label);
      row.appendChild(input);
      wrap.appendChild(row);
    });
  }

  /* Values are refreshed separately, so reordering or a restored draft shows
     the right text without the inputs being thrown away underneath the
     cursor. */
  [].slice.call(wrap.children).forEach((row, idx) => {
    const input = row.querySelector('input');
    if (!input || !photos[idx]) return;
    const v = photos[idx].caption || '';
    if (input.value !== v && document.activeElement !== input) input.value = v;
  });
}

/* The core rebuilds the drawer's photo grid whenever a photograph is added,
   removed or reordered; the caption rows have to follow it. */
const coreRenderGalleryDrawer = window.renderGalleryDrawer;
if (typeof coreRenderGalleryDrawer === 'function'){
  window.renderGalleryDrawer = function(){
    coreRenderGalleryDrawer.apply(this, arguments);
    renderCaptionEditor();
  };
}
function syncDesignInputs(){
  const d = (typeof invitationData === 'object' && invitationData) ? invitationData : {};
  document.querySelectorAll('[data-mp-field]').forEach(el => {
    const key = el.getAttribute('data-mp-field');
    if (d[key] != null) el.value = d[key];
  });
  renderCaptionEditor();
}

/* One delegated listener rather than one per input: the drawer's rows are
   rebuilt from scratch on every add and remove, and anything bound directly
   would be thrown away with them. */
document.addEventListener('input', (e) => {
  const el = e.target.closest && e.target.closest('[data-mp-field]');
  if (!el) return;
  if (typeof invitationData !== 'object') return;
  invitationData[el.getAttribute('data-mp-field')] = el.value;
  buildWedding();
  buildContent();
});

function buildGallery(){
  const host = document.getElementById('gallery');
  if (!host) return;
  const kinds = ['rim','candle','cloth','window','night','rim'];
  host.innerHTML = wedding.gallery.map((m,i) => {
    const seed = 31 + i * 17;
    const rot  = ((i % 2 ? -1 : 1) * (0.6 + i * 0.2)).toFixed(2);
    const src  = realOrPainted(m.photo, seed, kinds[i % 6]);
    return `<figure class="gal" data-depth="${((i % 2 ? -0.1 : 0.1) + (i % 3) * 0.02).toFixed(3)}"
        data-rot="${rot}deg" style="transform:rotate(${rot}deg)">
        <div class="gal-skin"><div class="gal-in">
          <img alt="${esc(m.caption)}" src="${esc(src)}" loading="lazy" decoding="async">
          <div class="gal-melt" aria-hidden="true"></div></div></div>
        <div class="gal-reflect" aria-hidden="true"></div>
        <figcaption>${esc(m.caption)}</figcaption></figure>`;
  }).join('');

  /* The reflection under each frame is a second copy of the same <img>. */
  host.querySelectorAll('.gal').forEach(g => {
    const src = g.querySelector('.gal-in img');
    const rf  = g.querySelector('.gal-reflect');
    if (src && rf) rf.appendChild(src.cloneNode());
  });

  const section = document.getElementById('gallery-section');
  if (section) section.style.display = wedding.gallery.length ? '' : 'none';
}

function buildTimeline(){
  const track = document.getElementById('tlTrack');
  const section = document.getElementById('schedule-timeline-section');
  if (!track) return;

  /* #tlLine is the gold thread the engine animates down the middle. It has
     to survive a rebuild, so it is put back rather than re-created. */
  const line = document.getElementById('tlLine');
  track.innerHTML = '';
  if (line) track.appendChild(line);

  wedding.timeline.forEach(ev => {
    track.insertAdjacentHTML('beforeend',
      `<div class="tl-item"><div class="tl-pool" aria-hidden="true"></div>
       <div class="tl-time">${esc(ev.time)}</div>
       <div class="tl-title">${esc(ev.title)}</div>
       <div class="tl-desc">${esc(ev.description)}</div></div>`);
  });

  /* An emptied schedule hides the whole section rather than leaving a
     heading over nothing - and the section is 340vh of scroll, so leaving
     it in place would be 340vh of empty page. */
  if (section) section.style.display = wedding.timeline.length ? '' : 'none';
}
/* ================================================================
/* ================================================================
   04 · THE OPENING — two doors, and nothing else

   What was here: 670 lines of WebGL, a gold-dust particle canvas, a
   fifteen-second intro on its own clock, and seven scroll-scrubbed
   "tick" systems sharing one mutable state object.

   Why it is gone, in one line each:
     - a media query hid the canvas below 760px, so no phone ever saw
       any of it;
     - scrubbed animation has no duration of its own, so its speed was
       whatever the reader's thumb did - untunable by design;
     - one shared mutable object written by seven ticks produced a
       standing bug class where leaving a section left its state behind.

   What replaced it: CSS. The doors are two elements and a transform.
   Everything else reveals once, on a fixed duration, when it comes into
   view. There is no render loop in this file any more.
   ================================================================ */
const introEl = $('#intro');
let state = 'intro', introDone = false;

function finishIntro(){
  if (introDone) return;
  introDone = true;
  state = 'journey';
  document.body.classList.add('ready','reveal');
  document.documentElement.classList.remove('lock');
  if (introEl) introEl.classList.add('gone');
  lgObserveAll();
}

/* The name the core and the rest of this file already use for "land on
   the finished state without playing anything". */
function fastForward(){
  if (introEl) introEl.classList.add('instant');
  finishIntro();
}
function skipIntro(){ if (state === 'intro') fastForward(); }

/* The opening runs 6.2s. Every beat is a CSS animation-delay in
   wedding-design.css - this only starts the timeline and clears up after
   it. If you retune the delays there, move these three to match:

     OPENING_MS  the parting begins; body.opening starts the hero's
                 push-in, so the photograph travels while the gold
                 withdraws instead of sitting still behind it
     REVEAL_MS   the halves are far enough apart that the photograph
                 behind them should be fading up
     INTRO_MS    the last beat ends. The right half now releases 120ms
                 after the left and runs 2.15s, so this must clear
                 4.72 + 2.15 or the parting is cut off mid-travel. */
const OPENING_MS = 3270, REVEAL_MS = 3870, INTRO_MS = 6620;

function playIntro(){
  if (!introEl) return finishIntro();
  /* NO SCROLL LOCK.

     The opening used to hold the document still for its whole run. Locking
     input during an animation is the one thing motion guidance is
     unanimous about never doing: for six and a half seconds the product
     did not answer the finger, and a page that does not answer reads as a
     page that has hung - especially to someone who has seen it before and
     simply wants to get to the RSVP.

     Nothing needs the lock. Any wheel, key, tap or touch already ends the
     opening immediately, so the first flick both skips the sequence and
     scrolls, which is exactly what the person doing it wanted. Those who
     wait still get every beat. */
  introEl.classList.remove('gone','instant','play');
  /* Force a reflow with .play OFF before turning it back on. On a REPLAY the
     child animations (the gold drop, the parting halves) sit at their filled
     end state; without a committed style flush between the remove and the
     re-add, the browser can coalesce the two and never restart them - so the
     body-class timeline below still runs on its timers and reveals the hero
     while no gold ever animates. That is exactly the "replay jumps to the
     hero with no opening" report. The reflow makes the restart reliable. */
  void introEl.offsetWidth;
  /* setTimeout, deliberately, not requestAnimationFrame. rAF does not run
     in a backgrounded tab, and an opening that never opens leaves the page
     locked behind a closed door - the worst possible failure for the first
     six seconds of the product. Timers still fire. */
  setTimeout(() => {
    introEl.classList.add('play');
    /* Depth: three rates of travel. The gold withdraws, the light spills
       through the gap, and the photograph pushes in - all at once, none of
       them at the same speed. */
    setTimeout(() => document.body.classList.add('opening'), OPENING_MS);
    /* The hero fades up WHILE the doors are still moving, so the
       photograph is already there to be revealed rather than appearing
       after the fact. */
    setTimeout(() => {
      document.body.classList.add('ready','reveal');
      document.documentElement.classList.remove('lock');
    }, REVEAL_MS);
    setTimeout(finishIntro, INTRO_MS);
  }, 60);
}

/* ================================================================
   05 · REVEALS — the whole motion system, now

   Enter once, transition on a fixed duration, never scrub. "Too fast"
   is one number in the CSS instead of seven thresholds per section, and
   scrolling back up cannot desynchronise anything because nothing is
   reading scroll position.
   ================================================================ */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
}), {threshold:.18, rootMargin:'0px 0px -8% 0px'});

function lgObserveAll(){
  document.querySelectorAll('.rv,.gal,.tl-item,#s-story')
    .forEach(el => io.observe(el));
}
lgObserveAll();

/* The cue belongs to the top of the page and nothing else. */
const scrollCue = $('#scrollCue');
addEventListener('scroll', () => {
  if (scrollCue) scrollCue.style.opacity = (state !== 'journey' || scrollY > 60) ? 0 : 1;
}, {passive:true});

/* ================================================================
   06 · MENU
   ================================================================ */
let menuOpen = false;
const menu = $('#menu');
function openMenu(){
  menuOpen = true; menu.classList.add('open');
  document.documentElement.classList.add('lock');
  $('#menuBtn').setAttribute('aria-expanded','true');
}
function closeMenu(){
  if (!menuOpen) return;
  menuOpen = false; menu.classList.remove('open');
  if (state === 'journey') document.documentElement.classList.remove('lock');
  $('#menuBtn').setAttribute('aria-expanded','false');
}
$('#menuBtn').onclick = () => { menuOpen ? closeMenu() : openMenu(); };
$('#menuClose').onclick = closeMenu;
$('#menuVeil').onclick = closeMenu;
menu.addEventListener('click', e => { if (e.target.tagName === 'A') closeMenu(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

document.querySelectorAll('.field input,.field select,.field textarea').forEach(f => {
  f.addEventListener('change', () => f.closest('.field').classList.toggle('filled', !!f.value));
  f.addEventListener('blur',   () => f.closest('.field').classList.toggle('filled', !!f.value));
});

/* Re-bind after the content is rewritten from the drawer. The observer only
   ever saw the elements that existed at load, so a photograph or a schedule
   row added later would sit at opacity 0 for good. Observing twice is a
   no-op, so this is safe to call on every render. */
window.__lgRebind = function(){ lgObserveAll(); };

/* THE BUILDER BAR HAS BEEN SITTING ON TOP OF THE HERO ALL ALONG.

   The core pads <main> to clear its fixed bar, but that function opens by
   returning early when there is no <header> element - and this design has
   none, design-7 does. So the offset has never once run here. Measured on
   a phone: bar 133px tall, hero eyebrow at 102px, THE BEGINNING clipped by
   31px, and #world carrying no top padding at all.

   Guests never see this, because the bar is hidden in guest mode. It only
   ever hit the couple editing their own invitation - which is to say the
   person deciding whether they like what they bought.

   The bar wraps onto more rows on narrow screens, so its height is
   measured rather than assumed, and re-measured whenever it changes. */
function lgSyncBarOffset(){
  const world = document.getElementById('world');
  if (!world) return;
  /* THE HERO IS FULL-BLEED; THE BAR FLOATS OVER IT.
     Padding the world by the bar height pushed the whole first screen -
     the hero photograph included - down by ~89px, and the strip it exposed
     above the photo was not black but the goldfield showing through, which
     read as a stray brownish line pinned under the toolbar. The hero fills
     100vh with its content vertically centred, so the bar (a builder-only
     overlay a guest never sees) can sit over its top edge with nothing but
     photograph behind it. No offset: the opening screen is whole again, and
     every section below simply scrolls under the floating bar the way a
     sticky toolbar is meant to work. */
  world.style.paddingTop = '';
}
if ('ResizeObserver' in window){
  const lgBar = document.getElementById('builder-bar');
  if (lgBar) new ResizeObserver(lgSyncBarOffset).observe(lgBar);
}
addEventListener('resize', lgSyncBarOffset);
lgSyncBarOffset();


/* ================================================================
   09 · THE PHOTOGRAPHS — rail on a phone, viewer everywhere

   The core's lightbox opens one photograph by id and offers no way to
   reach the next one, so seeing six meant opening and closing six times.
   This adds paging over the core's own markup rather than replacing it:
   the element, its close button and closeGalleryLightbox() all still
   belong to the core.
   ================================================================ */
(function(){
  const modal = document.getElementById('gallery-lightbox');
  const img   = document.getElementById('gallery-lightbox-img');
  if (!modal || !img) return;

  let shots = [], at = 0;

  /* Read the photographs off the rendered figures, so a couple who adds or
     removes one in the drawer gets a viewer that already agrees with the
     page - no second list to keep in step. */
  function collect(){
    shots = [].map.call(document.querySelectorAll('#gallery .gal'), g => {
      const i = g.querySelector('.gal-in img');
      const c = g.querySelector('figcaption');
      return { src: i ? i.getAttribute('src') : '', cap: c ? c.textContent : '' };
    }).filter(s => s.src);
  }

  const count = document.createElement('p'); count.className = 'lb-count';
  const cap   = document.createElement('p'); cap.className   = 'lb-cap';
  const prev  = document.createElement('button');
  const next  = document.createElement('button');
  prev.type = next.type = 'button';
  prev.className = 'lb-nav lb-prev'; next.className = 'lb-nav lb-next';
  prev.innerHTML = '&#10094;';       next.innerHTML = '&#10095;';
  prev.setAttribute('aria-label','Previous photograph');
  next.setAttribute('aria-label','Next photograph');
  modal.append(count, cap, prev, next);

  function show(i){
    if (!shots.length) return;
    at = (i + shots.length) % shots.length;      /* wraps, so neither end dead-ends */
    img.src = shots[at].src;
    img.alt = shots[at].cap || '';
    cap.textContent = shots[at].cap || '';
    count.textContent = (at + 1) + ' / ' + shots.length;
    const solo = shots.length < 2;
    prev.hidden = next.hidden = solo;
  }
  function openAt(i){ collect(); show(i); modal.classList.add('is-open');
    document.documentElement.classList.add('lock'); }
  function close(){ modal.classList.remove('is-open');
    document.documentElement.classList.remove('lock'); }

  /* The core's markup closes on any click on the backdrop. The controls
     live inside it, so they must not bubble into that. */
  [prev, next].forEach((b, k) => b.addEventListener('click', e => {
    e.stopPropagation(); show(at + (k ? 1 : -1));
  }));
  img.addEventListener('click', e => e.stopPropagation());

  /* Replaces the core's version by name; the core calls this from its own
     markup, and anything already calling it keeps working. */
  window.openGalleryLightbox = function(id){
    collect();
    let i = 0;
    if (typeof id === 'number') i = id;
    openAt(i);
  };
  const coreClose = window.closeGalleryLightbox;
  window.closeGalleryLightbox = function(){
    close();
    if (typeof coreClose === 'function') { try{ coreClose(); }catch(e){} }
  };

  /* Delegated, because the figures are rebuilt whenever the drawer edits
     the photographs and anything bound directly would be thrown away. */
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('#gallery .gal');
    if (!g) return;
    collect();
    openAt([].indexOf.call(document.querySelectorAll('#gallery .gal'), g));
  });

  addEventListener('keydown', e => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape')     { close(); }
    if (e.key === 'ArrowRight') { show(at + 1); }
    if (e.key === 'ArrowLeft')  { show(at - 1); }
  });

  /* Swipe. A phone expects the picture to follow the thumb; 45px is far
     enough not to fire on a tap that drifts. */
  let x0 = null;
  modal.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive:true});
  modal.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 45) show(at + (dx < 0 ? 1 : -1));
    x0 = null;
  }, {passive:true});

  /* The rail needs to say how many photographs are on it, or the first
     one reads as the only one. */

  /* ---- where you are in the rail ----------------------------------
     The counter said how many photographs there are. It did not say which
     one you are on, and it did not move - so the rail still read as a
     single static picture. These dots track the scroll, and tapping one
     jumps to that photograph.

     Driven by scroll position rather than by a stored index, so a flick
     that lands between two frames still resolves to whichever is nearest
     the middle and nothing can drift out of step. */
  function railDots(){
    const host = document.getElementById('gallery');
    if (!host) return;
    const frames = [].slice.call(host.querySelectorAll('.gal'));
    let dots = document.querySelector('.gal-dots');

    if (frames.length < 2){ if (dots) dots.remove(); return; }

    if (!dots){
      dots = document.createElement('div');
      dots.className = 'gal-dots';
      /* A plain group, not a tablist: these buttons are not tabs and do not
         control tab panels, and role=tablist without role=tab on the
         children is a promise to a screen reader that nothing keeps. */
      dots.setAttribute('role', 'group');
      dots.setAttribute('aria-label', 'Photographs');
      const meta = document.querySelector('.gal-rail-meta');
      (meta || host).insertAdjacentElement('afterend', dots);
    }

    if (dots.children.length !== frames.length){
      dots.innerHTML = '';
      frames.forEach((f, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gal-dot';
        b.setAttribute('aria-label', 'Photograph ' + (i + 1) + ' of ' + frames.length);
        b.addEventListener('click', () => {
          f.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
        });
        dots.appendChild(b);
      });
    }

    function mark(){
      /* Measure in VIEWPORT coordinates, not offsetLeft/scrollLeft. The rail
         (#gallery) is the scroll container, but each .gal's offsetParent is
         the positioned #gallery-section - and the rail also has horizontal
         padding - so f.offsetLeft and host.scrollLeft live in different
         origins. Comparing them picked a photo that was off by that constant,
         so the active photo and dot never matched the one you swiped to.
         getBoundingClientRect puts both on the same origin and just works. */
      const hostRect = host.getBoundingClientRect();
      const mid = hostRect.left + hostRect.width / 2;
      let best = 0, bestD = Infinity;
      frames.forEach((f, i) => {
        const r = f.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(c - mid);
        if (d < bestD){ bestD = d; best = i; }
      });
      frames.forEach((f, i) => f.classList.toggle('is-current', i === best));
      [].slice.call(dots.children).forEach((b, i) => {
        b.classList.toggle('on', i === best);
        /* aria-current, not aria-selected - selection belongs to tabs and
           options; this is "the one you are on". */
        if (i === best) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }

    if (!host.dataset.dotsBound){
      host.dataset.dotsBound = '1';
      /* Passive: this only reads layout and toggles a class, so it must
         never hold up the scroll it is watching. */
      host.addEventListener('scroll', () => {
        if (host.__dotTick) return;
        host.__dotTick = setTimeout(() => { host.__dotTick = null; mark(); }, 90);
      }, {passive:true});
      addEventListener('resize', mark, {passive:true});
    }
    mark();
  }
  function railMeta(){
    const host = document.getElementById('gallery');
    if (!host) return;
    const n = host.querySelectorAll('.gal').length;
    let meta = document.querySelector('.gal-rail-meta');
    if (!n){ if (meta) meta.remove(); return; }
    if (!meta){
      meta = document.createElement('p');
      meta.className = 'gal-rail-meta';
      host.insertAdjacentElement('afterend', meta);
    }
    meta.innerHTML = 'Swipe &middot; <span class="gal-count">' + n + ' photographs</span>';
  }
  railMeta();
  railDots();
  const rebind = window.__lgRebind;
  window.__lgRebind = function(){
    if (typeof rebind === 'function') rebind();
    collect(); railMeta(); railDots();
  };
})();
/* SAFETY NET — nothing may depend on one mechanism.

   Every reveal in this design is gated on that single IntersectionObserver.
   If it never delivers - a browser quirk, a tab that never repaints, a
   engine that throttles observers - the page is correct markup at opacity
   0. A blank invitation. That is the exact failure this whole rebuild
   existed to remove, so it does not get to come back through the door it
   was thrown out of.

   If nothing at all has revealed shortly after the opening ends, stop
   trusting the observer and simply show everything. A page that fades in
   all at once is a small disappointment; a page that shows nothing is a
   refund. */
setTimeout(function(){
  if (document.querySelector('.rv.in')) return;
  document.querySelectorAll('.rv,.gal,.tl-item')
    .forEach(function(el){ el.classList.add('in'); });
}, INTRO_MS + 2500);

/* Skipping. Any deliberate input during the opening ends it. */
['wheel','keydown','pointerdown','touchstart'].forEach(ev =>
  addEventListener(ev, () => skipIntro(), {passive:true}));

if (RM) fastForward(); else playIntro();

/* ============================================================
   CORE OVERRIDES

   Replaced BY NAME on window. wedding-core.js calls these; it does not
   know this file exists. Anything not overridden here keeps the core's
   behaviour, which is the point of the split.
============================================================ */

/* The one the core calls after loading, after every keystroke in the
   drawer, and after a shared link is decoded. */
window.renderInvitationFromData = function(){
  buildWedding();
  buildContent();
  renderCaptionEditor();
};

/* The core fills its own cfg-* inputs from invitationData; it has no idea
   the drawer also carries this design's data-mp-field ones. Wrapped rather
   than replaced, so the core keeps doing its half. Without this the whole
   Wording half of the drawer opens blank, and a couple who then closed the
   drawer would have written those empty values back over their own text. */
const coreSyncToInputs = window.syncDataToInputs;
window.syncDataToInputs = function(){
  if (typeof coreSyncToInputs === 'function') coreSyncToInputs.apply(this, arguments);
  syncDesignInputs();
};

/* The core renders the schedule as a list of rows; this design draws it as
   a lit thread down a 340vh scroll, so it takes the data and hands off to
   the engine's own builder. */
window.renderScheduleTimeline = function(){
  buildWedding();
  buildTimeline();
  if (typeof window.__lgRebind === 'function') window.__lgRebind();
};

window.renderGalleryPublic = function(){
  buildWedding();
  buildGallery();
  if (typeof window.__lgRebind === 'function') window.__lgRebind();
};

/* Questions. Hidden entirely when the list is emptied, rather than leaving
   a heading over nothing. */
window.renderFaqPublic = function(){
  const section = document.getElementById('faq-section');
  const list = document.getElementById('faq-list');
  if (!section || !list) return;

  const items = (typeof invitationData === 'object' && Array.isArray(invitationData.faq))
    ? invitationData.faq.filter(f => txt(f.question,'') || txt(f.answer,''))
    : [];

  if (!items.length){ section.style.display = 'none'; list.innerHTML = ''; return; }
  section.style.display = '';

  list.innerHTML = items.map((f, i) => `
    <div class="faq-item" data-i="${i}">
      <button type="button" class="faq-q" aria-expanded="false" onclick="toggleFaqPublicItem(${i})">
        <span>${esc(f.question)}</span><span class="mark" aria-hidden="true"></span>
      </button>
      <div class="faq-a" id="faq-a-${i}" role="region"><p>${esc(f.answer)}</p></div>
    </div>`).join('');
};

/* max-height cannot animate from a fixed value to `auto`, so the real
   height is measured and set in pixels, then cleared when it closes. */
window.toggleFaqPublicItem = function(i){
  const item = document.querySelector(`.faq-item[data-i="${i}"]`);
  if (!item) return;
  const panel = item.querySelector('.faq-a');
  const btn = item.querySelector('.faq-q');
  const open = item.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (panel) panel.style.maxHeight = open ? (panel.scrollHeight + 'px') : '';
};

/* Guest mode.

   FORWARD EVERY ARGUMENT. This wrapper used to take (on) and pass on (on),
   which silently dropped the core's second parameter.

   toggleGuestPreview() calls enableGuestMode(true, { viaToggle: true }),
   and the core uses that flag to decide whether to add .show-exit-btn -
   the class that reveals the way out of preview. Someone opening a shared
   guest link should not get a button into the editing tools, so the flag
   matters; dropping it meant the couple never got the button either, and
   preview became a room with no door.

   .apply(this, arguments) passes whatever the core was given, including
   parameters added later. */
const coreEnableGuestMode = window.enableGuestMode;
window.enableGuestMode = function(activate, opts){
  if (typeof coreEnableGuestMode === 'function') coreEnableGuestMode.apply(this, arguments);
  lgSyncBarOffset();
  /* PREVIEW BEGINS THE WAY A GUEST'S VISIT BEGINS - WITH THE OPENING.
     The core lands guest-preview on the finished hero (resetEnvelopeIntroInstant),
     which is right for restoring a shared link but wrong for the builder's
     own Preview button: a guest's first impression is the gold opening, and
     previewing should show exactly that, not skip past it. So when the couple
     toggles into preview, replay the opening. Restoring a real shared link
     does not pass viaToggle, so it still lands instantly. */
  opts = opts || {};
  if (activate && opts.viaToggle
      && document.body.classList.contains('guest-mode')
      && typeof window.resetEnvelopeIntro === 'function'){
    window.resetEnvelopeIntro();
  }
};

/* Escape is the other way out, and worth advertising on a device that has
   the key. The menu owns Escape while it is open. */
addEventListener('keydown', function(e){
  if (e.key !== 'Escape') return;
  if (menuOpen) return;
  if (document.body.classList.contains('guest-mode') && typeof toggleGuestPreview === 'function'){
    toggleGuestPreview();
  }
});
if (!TOUCH){
  const xb = document.getElementById('exit-preview-btn');
  if (xb) xb.textContent = 'Exit preview ' + String.fromCharCode(183) + ' Esc';
}

/* A photograph that fails to load leaves a broken-image icon in the middle
   of an otherwise finished invitation. Fall back to the painted version. */
window.photoFallback = function(img){
  if (!img || img.dataset.lgFallback === '1') return;
  img.dataset.lgFallback = '1';
  const isHero = img.id === 'heroImg';
  img.src = photo(isHero ? 7 : 19, isHero ? 'hero' : 'rim');
};

/* The core's Replay button and this design's "Begin again" both call this.
   The core's own version rewinds design-7's envelope, which does not exist
   here - so it is replaced with a rewind of this design's opening.

   Rewinding used to mean unwinding a shader's worth of state: ripple
   arrays, a shared mutable object, four intro booleans and a clock. There
   is none of that left. Shut the doors, take the reveals off, play it
   again - and because every reveal is a class rather than a scrubbed
   value, taking them off is genuinely all that "rewind" means now. */
window.resetEnvelopeIntro = function(){
  try{
    scrollTo(0,0);
    document.body.classList.remove('ready','reveal','opening');
    document.querySelectorAll('.in').forEach(el => el.classList.remove('in'));
    const cue = document.getElementById('scrollCue');
    if (cue) cue.style.opacity = 0;
    introDone = false;
    state = 'intro';
    playIntro();
  }catch(e){ location.reload(); }
};

/* The core calls this when it needs the invitation to be ALREADY past the
   opening - restoring a shared link, or entering guest preview - so it must
   land on the finished state without playing anything. */
window.resetEnvelopeIntroInstant = function(){
  try{ if (typeof skipIntro === 'function') skipIntro(); }catch(e){}
  document.documentElement.classList.remove('lock');
};

/* THE RSVP DIAGNOSTIC HAS BEEN REMOVED.

   While Netlify Forms was not yet enabled, this file wrapped submitRSVP to
   fire a second, honeypot-filled POST after every submission in builder
   mode, so it could tell a 404 ("form detection is off") apart from a
   dropped connection and say so plainly.

   The comment that shipped with it claimed Netlify "discards" such a post
   so asking cost nothing. That was wrong: Netlify RECORDS it, as a spam
   submission. Once form detection was switched on, every test the couple
   ran filed one real reply and one spam entry beside it - which is exactly
   what the dashboard showed, and is a bad thing to leave in a product
   whose entire job is collecting replies.

   The question it answered is settled - submissions arrive - so it is
   gone rather than made conditional. submitRSVP is the core's again. */



/* ---------------- MUSIC ----------------
   This design keeps its tracks in assets/music/ rather than the shared
   assets/audio/. sync-core-to-designs.bat mirrors assets/audio into every
   design folder, so anything living there would be overwritten and the two
   tracks this design does not use would be added back.

   The core reads its table through resolveTrack(), a plain global - so
   pointing that at this table is the whole override, and the shared
   wedding-core.js stays untouched.

   WHY NOT THE BACH SET THIS FOLDER SHIPPED WITH: those three came from
   Mirror Palace, where the argument for them was symmetry - the Goldberg
   Variations being one theme reflected thirty ways, which was that
   design's whole idea. This design has no mirrors. It is molten, warm and
   slow, so the music should pool rather than resolve. Satie and Debussy do
   that; Bach, beautiful as it is, is crystalline and architectural, and
   next to liquid gold it reads as cold.

   All three are public domain in BOTH layers - composition and recording -
   and were already normalised to -19 LUFS as part of the shared set, so
   switching tracks in the builder never jumps in volume. */
const LG_TRACKS = {
  gnossienne: {
    label: 'Satie — Gnossienne No. 1',
    url:   '../_shared/audio/gnossienne.mp3' /* LUMA: the shared copy of the same recording */
  },
  clairdelune: {
    label: 'Debussy — Clair de Lune',
    url:   '../_shared/audio/clairdelune.mp3' /* LUMA: the shared copy of the same recording */
  },
  pavane: {
    label: 'Ravel — Pavane pour une infante défunte',
    url:   '../_shared/audio/pavane.mp3' /* LUMA: the shared copy of the same recording */
  }
};

window.resolveTrack = function(key){
  // LUMA: the couple's own uploaded song, registered by the core as "couple"
  if (key === 'couple' && typeof MUSIC_TRACKS !== 'undefined' && MUSIC_TRACKS.couple) return MUSIC_TRACKS.couple;
  return LG_TRACKS[key] || LG_TRACKS.gnossienne;
};
/* ---------------- PHOTO UPLOADS ----------------
   The drawer has had two upload controls all along - the opening photograph
   and the one in Our Story - and nothing was listening to either of them.
   The <input type="file"> existed, the label opened the picker, a file was
   chosen, and the change event fell on the floor: no handler anywhere in
   this design or the shared core. Picking a photo genuinely did nothing.

   design-7 has the handler; it was never ported when this design was built.
   Its version keeps a parallel MP_PHOTO_TARGETS table and writes to the
   <img> elements itself. This one does not need to: buildContent() already
   resolves both photographs through realOrPainted(), so putting the data
   URI into invitationData and re-rendering is the whole job, and there is
   no second table to fall out of step.

   processImageFile() is the core's - it owns the HEIC handling, the EXIF
   orientation fix and the downscale. A second copy of that would rot the
   moment the core's is fixed. */
function mpPhotoStatus(msg){
  const el = document.getElementById('mp-photo-status');
  if (el) el.textContent = msg || '';
}

document.addEventListener('change', (e) => {
  const input = e.target.closest && e.target.closest('input[type="file"][data-mp-photo]');
  if (!input || !input.files || !input.files[0]) return;

  const key = input.getAttribute('data-mp-photo');
  if (typeof processImageFile !== 'function'){
    mpPhotoStatus('Could not read that image.');
    return;
  }

  mpPhotoStatus('Reading photo…');
  processImageFile(input.files[0], mpPhotoStatus, (dataUrl) => {
    if (typeof invitationData !== 'object' || !invitationData) return;
    invitationData[key] = dataUrl;

    /* The drawer's own thumbnail. Set directly rather than through a render,
       because it lives in the editor rather than the invitation. */
    const thumb = document.getElementById('mp-thumb-' + key);
    if (thumb) thumb.src = dataUrl;

    /* The opening photograph is also the core's heroPhoto, and the core
       keeps its own preview of it. Without this the two show different
       pictures for the same field. */
    if (key === 'heroPhoto'){
      const hidden = document.getElementById('cfg-hero-photo');
      if (hidden) hidden.value = dataUrl;
      if (typeof syncHeroPhotoPreview === 'function') syncHeroPhotoPreview(dataUrl);
    }

    if (typeof window.renderInvitationFromData === 'function') window.renderInvitationFromData();
    mpPhotoStatus('Photo updated.');
    input.value = '';          // so the same file can be chosen again
  });
});
/* ---------------- PARTY SIZE CHIPS ----------------
   A native <select> is the most generic thing a form can contain, and on a
   phone it opens a full-screen wheel to pick a number between one and six.
   The chips are built from the select's OWN options, so the range is
   defined in one place, and they drive it rather than replacing it - the
   core reads #rsvp-guest-count.value and the form posts it.

   Ported from design-7. Without it #rsvpCountChips stays an empty div and
   the guest count silently has no visible control at all: the label is
   there, the row below it is blank, and the select it is standing in for
   is clipped out of sight. */
const countSelect = document.getElementById('rsvp-guest-count');
const countChips  = document.getElementById('rsvpCountChips');
if (countSelect && countChips && !countChips.children.length){
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
      if (typeof handleRsvpGuestCountChange === 'function') handleRsvpGuestCountChange();
    });
    countChips.appendChild(b);
  });
  paint();
  countSelect.addEventListener('change', paint);
}

/* Field labels float up when a field has content. The core writes values
   straight into the inputs when a shared link is decoded, and that does
   NOT fire an input event - so the labels sat over the text until the
   guest clicked. */
function syncFilledFields(){
  document.querySelectorAll('.field input,.field select,.field textarea').forEach(f => {
    const wrap = f.closest('.field');
    if (wrap) wrap.classList.toggle('filled', !!f.value);
  });
}
document.addEventListener('input', e => {
  if (e.target && e.target.closest && e.target.closest('.field')) {
    e.target.closest('.field').classList.toggle('filled', !!e.target.value);
  }
}, true);

/* ============================================================
   THE EDITOR LAYER

   Ported from design-7. None of it is Mirror Palace specific - it is the
   machinery that makes the shared drawer usable, and the shared core does
   not ship any of it:

     * autosave, because nothing in the core persists anything and losing
       thirty fields and four photos to a stray refresh is unforgivable
     * the sample-wording counter, so nobody sends a real invitation still
       carrying "Villa Cora"
     * drawer tabs that scroll the page to what they edit
     * aria-labels on the core's repeater rows, which are otherwise 28
       anonymous text boxes to a screen reader
     * peek, so an edit can be seen on a phone where the drawer covers
       the page instead of narrowing it
============================================================ */
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

  const MP_DRAFT_KEY = 'liquid-gold-draft-v1';

  /* VIEW STATE IS NOT CONTENT, AND MUST NEVER BE PERSISTED.
     isGuestView says "render this as the guest sees it, with no builder".
     It travels inside a shared link's payload, which is correct there. It
     must NEVER reach the autosave draft: a draft is the couple's wording and
     photos, saved so the editor can restore them. If isGuestView:true got
     saved, restoring it would drop the editor into guest mode on load - no
     builder bar, no way back - and because the draft is per-browser, that
     device stays locked out until localStorage is cleared by hand.

     This happened. Opening a guest link (?id=) loads invitationData with
     isGuestView:true, and the render + pagehide autosave then wrote that
     flag into the editor's own draft. Stripped on the way out AND on the way
     back in, so any already-poisoned draft heals itself on the next load. */
  const MP_VIEW_ONLY_KEYS = ['isGuestView'];
  function mpStripViewState(obj){
    const clean = {};
    Object.keys(obj).forEach(k => { if (MP_VIEW_ONLY_KEYS.indexOf(k) === -1) clean[k] = obj[k]; });
    return clean;
  }

  /* A shared / guest URL must not write the editor's draft at all. The tab
     is showing somebody a finished invitation, not an editing session, and
     its data carries isGuestView + whatever that couple sent - none of which
     belongs in the local editor's saved work. */
  const MP_IS_SHARED_URL = (function(){
    const params = new URLSearchParams(window.location.search);
    return !!params.get('id') || /(?:lz|data)=/.test(window.location.hash);
  })();

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
    /* Never persist a draft from a shared/guest view - see MP_IS_SHARED_URL. */
    if (MP_IS_SHARED_URL) return;
    if (window.lumaBoot) return; // LUMA: nothing of the couple's is kept in a guest's browser

    const clean = mpStripViewState(invitationData);
    if (tryWriteDraft(JSON.stringify(clean))){
      mpDraftNotice('');
      return;
    }

    /* Almost always the ~5MB quota, reached by uploaded photos: each one is
       stored as a base64 data-URI, so four of them can fill it on their own.
       Rather than lose everything, drop the photo payloads and keep the
       wording — then say so, because a photo that silently isn't saved is
       worse than one the couple knows about. */
    const light = mpStripViewState(invitationData);

    ['heroPhoto'].forEach(k => {
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
      /* Strip view-state from any older, poisoned draft so a device that was
         locked into guest mode heals itself here, before guest mode is read. */
      if (saved && typeof saved === 'object') Object.assign(invitationData, mpStripViewState(saved));
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


  /* ---------------- DRAWER TABS FOLLOW THE PAGE ----------------
     Opening a tab scrolls the invitation to whatever that tab edits, so the
     couple can see the thing they are about to change.

     The keys are the tab titles the core writes from each panel's <h4>. If
     a panel is renamed in index.html, rename it here too or that tab simply
     stops scrolling - it will not throw, which is exactly why it is easy to
     miss. */
  const TAB_SECTIONS = {
    'The Couple':       's-hero',
    'Your Story':       's-story',
    'The Day':          's-day',
    'The Events':       'schedule-timeline-section',
    'Photographs':      'gallery-section',
    'RSVP':             's-rsvp',
    'Questions':        'faq-section',
    'Finale & Music':   's-close'
  };

  /* The design's own smooth scroll. It cannot use scroll-behavior alone,
     because the opening locks the document and a scroll requested while
     html.lock is on goes nowhere. */
  function scrollToSection(id){
    const el = document.getElementById(id);
    if (!el) return;
    document.documentElement.classList.remove('lock');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    } catch (err) {
      window.scrollTo(0, el.offsetTop);
    }
  }
  window.scrollToSection = scrollToSection;

  function bindDrawerTabScrolling(){
    document.querySelectorAll('#customizer-drawer .drawer-tab').forEach(tab => {
      if (tab.dataset.lgScrollBound === 'true') return;
      tab.dataset.lgScrollBound = 'true';
      const target = TAB_SECTIONS[tab.title];
      if (!target) return;
      tab.addEventListener('click', () => scrollToSection(target));
    });
  }

  /* The core builds the tab bar lazily, on the drawer's FIRST open, so the
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

/* ============================================================
   START

   The engine's own top-level code has already run by this point: the
   canvases are sized, the observers are attached and the loop is turning.
   What it has NOT had is any content, because that comes from
   invitationData and the core owns when that is ready.

   The core calls renderInvitationFromData() during its own init. This
   first call is for the case where the core is slow, absent or errored -
   an invitation that renders the sample wording beats a blank page. */
buildWedding();
buildContent();
syncDesignInputs();
syncFilledFields();

document.addEventListener('DOMContentLoaded', () => {
  syncFilledFields();
  if (typeof window.__lgRebind === 'function') window.__lgRebind();
});

/* ?skipintro=1 lands straight on the invitation with the opening already
   finished.

   Two reasons it exists. A couple checking a change should not sit through
   fifteen seconds of opening every reload. And the screenshot tooling has
   no other way in: the opening is driven by a requestAnimationFrame clock,
   and headless Chrome's --virtual-time-budget does not advance it, so a
   capture without this is fifteen seconds of black no matter how long the
   budget is. */
/* ?diag=1 writes the page length and every section's height into
   document.title, where --dump-dom can read it. There is no other way to
   measure this from headless Chrome: --screenshot cannot scroll, and a
   scroll-driven design's real cost is its total height, not what one
   viewport shows. Kept because tuning the length is a recurring job. */
if (/[?&]diag=1/.test(location.search)) {
  window.__lgDiag = true;
  addEventListener('load', () => setTimeout(() => {
    const vh = innerHeight;
    const parts = [...document.querySelectorAll('main > section, main > div[id]')]
      .map(s => `${s.id}=${(s.offsetHeight / vh).toFixed(1)}`);
    const total = (document.documentElement.scrollHeight / vh).toFixed(1);

    /* ?diag=1&inside=<id> breaks one section down by child, which is the
       only way to find out WHICH element is making it tall. Cutting the
       padding on a section whose height comes from its children changes
       nothing, and it is impossible to tell those two cases apart from
       the outside. */
    const inside = new URLSearchParams(location.search).get('inside');
    if (inside) {
      const host = document.getElementById(inside);
      const kids = host ? [...host.querySelectorAll('*')]
        .filter(el => el.offsetHeight > vh * 0.25)
        .map(el => `${el.tagName.toLowerCase()}${el.id ? '#'+el.id : (el.className && typeof el.className === 'string' ? '.'+el.className.trim().split(/\s+/)[0] : '')}=${(el.offsetHeight/vh).toFixed(2)}`)
        .slice(0, 14) : ['(no such section)'];
      document.title = `DIAG ${inside} total=${total}vh :: ${kids.join(' ')}`;
      return;
    }
    document.title = `DIAG total=${total}vh ${parts.join(' ')}`;
  }, 400));
}

if (/[?&]skipintro=1/.test(location.search)) {
  const jump = () => { try{ fastForward(); }catch(e){}
    document.documentElement.classList.remove('lock');
    document.body.classList.add('ready','reveal');
    /* The reveal observer only fires on scroll, and a capture never
       scrolls - so everything below the fold would stay at opacity 0. */
    document.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', jump);
  else jump();
}

})();
