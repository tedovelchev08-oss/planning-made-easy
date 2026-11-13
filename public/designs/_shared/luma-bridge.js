/*
 * luma-bridge.js: connects one of the owner's own invitation designs to Luma
 * (Block 18). Load it BEFORE wedding-core.js.
 *
 *   - window.lumaBoot: a promise of the couple's invitationData, from
 *     /api/invitation (?slug= or ?token=). wedding-core.js awaits it instead
 *     of reading a Netlify short link or a URL hash. While it loads, the page
 *     stays hidden (html.luma-loading), so the design's sample couple never
 *     shows.
 *   - window.lumaAfterRender: after every render, hides what the couple
 *     hasn't filled in (story, dress code, schedule, hashtag, RSVP deadline)
 *     and the RSVP section when they don't collect answers.
 *   - RSVPs: the core POSTs the form to "/" (Netlify Forms). That one request
 *     is answered here instead: an invisible Turnstile check, then
 *     POST /api/rsvp, the same endpoint Luma's own invitation page uses.
 *   - ?preview=1: the couple's preview from the planner, read from
 *     localStorage "luma.designPreview"; nothing is sent from it.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');
  var slug = params.get('slug');
  var preview = params.get('preview') === '1';
  var SOURCES = ['link', 'whatsapp', 'instagram', 'messenger', 'email'];
  var source = SOURCES.indexOf(params.get('src')) >= 0 ? params.get('src') : 'link';

  var state = { slug: null, guest: null, siteKey: null };

  document.documentElement.classList.add('luma-loading');

  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function show() {
    document.documentElement.classList.remove('luma-loading');
  }

  /* A quiet full-page message instead of the invitation (closed, missing,
     failed). The returned promise never settles, so the core never renders
     the sample invitation underneath. */
  function notice(title, body, retry) {
    whenReady(function () {
      var wrap = document.createElement('div');
      wrap.className = 'luma-notice';
      wrap.setAttribute('role', 'status');
      var h = document.createElement('h1');
      h.textContent = title;
      var p = document.createElement('p');
      p.textContent = body;
      wrap.appendChild(h);
      wrap.appendChild(p);
      if (retry) {
        var a = document.createElement('a');
        a.href = window.location.href;
        a.textContent = 'Try again';
        wrap.appendChild(a);
      }
      document.body.innerHTML = '';
      document.body.className = '';
      document.body.appendChild(wrap);
      document.title = title;
      show();
    });
    return new Promise(function () {});
  }

  function load() {
    if (preview) {
      try {
        var saved = JSON.parse(window.localStorage.getItem('luma.designPreview') || 'null');
        if (saved && saved.invitation) return Promise.resolve(saved.invitation);
      } catch (e) { /* storage blocked: fall through */ }
      return notice('Nothing to preview', 'Open the preview again from your planner.');
    }
    var q = token ? 'token=' + encodeURIComponent(token) : slug ? 'slug=' + encodeURIComponent(slug) : '';
    if (!q) return notice('This invitation link is incomplete', 'Please open the link exactly as the couple sent it.');

    return fetch('/api/invitation?' + q, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (res.status === 409) {
          // the couple uses one of Luma's own designs: show that page instead
          window.location.replace('/#/invite' + window.location.search);
          return new Promise(function () {});
        }
        if (res.status === 404) return notice('We couldn’t find this invitation', 'Please check the link the couple sent you.');
        if (!res.ok) return notice('The invitation couldn’t be loaded', 'Please check your connection and try again.', true);
        return res.json().then(function (body) {
          if (body.status === 'closed') return notice('This invitation isn’t open yet', 'The couple will open it soon. Please check back later.');
          state.slug = body.slug || null;
          state.guest = body.guest || null;
          state.siteKey = body.turnstileSiteKey || null;
          return body.invitation;
        });
      })
      .catch(function () {
        return notice('The invitation couldn’t be loaded', 'Please check your connection and try again.', true);
      });
  }

  window.lumaBoot = load();

  // the planner rewrites the preview as the couple types: follow it, gently
  if (preview) {
    var reloadSoon = null;
    window.addEventListener('storage', function (e) {
      if (e.key !== 'luma.designPreview') return;
      clearTimeout(reloadSoon);
      reloadSoon = setTimeout(function () { window.location.reload(); }, 900);
    });
  }

  /* ------------------------- hide what's empty ------------------------- */

  function hide(el) { if (el) el.style.display = 'none'; }
  function hideLinksTo(hash) {
    document.querySelectorAll('a[href="' + hash + '"]').forEach(hide);
  }
  function blank(v) { return !v || !String(v).trim(); }

  window.lumaAfterRender = function (d) {
    // date and place without a dangling bullet when the address is empty
    var place = d.venueAddress || d.venueName;
    document.querySelectorAll('[data-field="dateAndPlace"]').forEach(function (el) {
      el.textContent = formatDate(d.date) + (blank(place) ? '' : ' • ' + place);
    });

    if (blank(d.time)) document.querySelectorAll('[data-field="time"]').forEach(hide);

    // the story: without words, show the couple's photo alone (or nothing)
    if (blank(d.story1) && blank(d.story2)) {
      var story = document.getElementById('our-story');
      var hasPhoto = d.heroPhoto && d.heroPhoto.indexOf('data:image/svg') !== 0;
      if (story && hasPhoto) {
        var text = document.getElementById('story-text-1');
        if (text && text.parentElement) hide(text.parentElement);
        var grid = story.querySelector('.grid');
        if (grid) { grid.style.gridTemplateColumns = 'minmax(0, 28rem)'; grid.style.justifyContent = 'center'; }
      } else {
        hide(story);
        hideLinksTo('#our-story');
      }
    } else {
      if (blank(d.story1)) hide(document.getElementById('story-text-1'));
      if (blank(d.story2)) hide(document.getElementById('story-text-2'));
    }

    // the dress code column of the banner
    if (blank(d.dressCode)) {
      var dc = document.getElementById('banner-dresscode');
      if (dc && dc.parentElement) {
        hide(dc.parentElement);
        var banner = dc.parentElement.parentElement;
        if (banner) {
          banner.classList.remove('md:grid-cols-3');
          banner.classList.add('md:grid-cols-2');
          var cols = banner.children;
          if (cols.length > 1) cols[1].classList.remove('md:border-r');
        }
      }
    } else if (blank(d.dressCodeNote)) {
      hide(document.getElementById('banner-dresscode-note'));
    }

    if (!d.schedule || !d.schedule.length) { hide(document.getElementById('schedule')); hideLinksTo('#schedule'); }
    if (blank(d.hashtag)) hide(document.getElementById('footer-hashtag'));
    if (blank(d.rsvpDeadline)) hide(document.getElementById('rsvp-deadline-text'));

    renderRegistry(d.registry);

    if (d.rsvpOpen === false) {
      hide(document.getElementById('rsvp'));
      hideLinksTo('#rsvp');
    } else if (state.guest && state.guest.name) {
      var nameInput = document.querySelector('#rsvp-form input[name="guest_names"]');
      if (nameInput && !nameInput.value) nameInput.value = state.guest.name;
    }

    show();
  };

  /* The couple's registry, under the reply: a short list in the design's
     own colours and heading face. Built with textContent only. */
  function renderRegistry(items) {
    var old = document.getElementById('luma-registry');
    if (old) old.parentNode.removeChild(old);
    if (!items || !items.length) return;
    var anchor = document.getElementById('rsvp');
    var host = anchor && anchor.style.display !== 'none' ? anchor : document.querySelector('footer');
    var look = window.getComputedStyle(host || document.body);
    var heading = document.querySelector('#rsvp h2, h2');
    var face = heading ? window.getComputedStyle(heading).fontFamily : 'inherit';

    if (!document.getElementById('luma-registry-style')) {
      var css = document.createElement('style');
      css.id = 'luma-registry-style';
      css.textContent =
        '#luma-registry{position:relative;z-index:5;isolation:isolate;padding:4.5rem 1.5rem;text-align:center}' +
        '#luma-registry h2{font-size:clamp(1.9rem,6vw,2.6rem);font-weight:400;line-height:1.1;margin:0}' +
        '#luma-registry p.lr-lead{margin:.9rem auto 0;max-width:30rem;opacity:.72;font-size:.98rem;line-height:1.6}' +
        '#luma-registry ul{list-style:none;margin:2.2rem auto 0;padding:0;max-width:34rem;text-align:left}' +
        '#luma-registry li{display:flex;align-items:baseline;gap:1rem;padding:.95rem 0;border-top:1px solid color-mix(in srgb,currentColor 18%,transparent)}' +
        '#luma-registry li:last-child{border-bottom:1px solid color-mix(in srgb,currentColor 18%,transparent)}' +
        '#luma-registry .lr-name{flex:1;min-width:0;font-size:1.05rem}' +
        '#luma-registry .lr-store{display:block;font-size:.82rem;opacity:.62;margin-top:.15rem}' +
        '#luma-registry a{color:inherit;font-size:.9rem;text-decoration:underline;text-underline-offset:4px;white-space:nowrap}' +
        '#luma-registry .lr-given{font-size:.85rem;font-style:italic;opacity:.6;white-space:nowrap}' +
        '#luma-registry li.is-given .lr-name{opacity:.55}';
      document.head.appendChild(css);
    }

    var sec = document.createElement('section');
    sec.id = 'luma-registry';
    sec.setAttribute('aria-label', 'Our registry');
    // its own ground, above the design's drawn decorations (a thread, stars)
    var ground = [host, document.body, document.documentElement].map(function (el) {
      return el ? window.getComputedStyle(el).backgroundColor : '';
    }).filter(function (c) { return c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent'; })[0];
    sec.style.color = look.color;
    if (ground) sec.style.backgroundColor = ground;
    var h = document.createElement('h2');
    h.textContent = 'Our registry';
    h.style.fontFamily = face;
    var lead = document.createElement('p');
    lead.className = 'lr-lead';
    lead.textContent = 'Having you there is the gift. If you would like to give something more, these are things we would love.';
    var ul = document.createElement('ul');
    items.forEach(function (it) {
      var li = document.createElement('li');
      if (it.given) li.className = 'is-given';
      var name = document.createElement('span');
      name.className = 'lr-name';
      name.textContent = it.name;
      if (it.store) {
        var st = document.createElement('span');
        st.className = 'lr-store';
        st.textContent = it.store;
        name.appendChild(st);
      }
      li.appendChild(name);
      if (it.given) {
        var g = document.createElement('span');
        g.className = 'lr-given';
        g.textContent = 'Given';
        li.appendChild(g);
      } else if (it.url && /^https?:\/\//i.test(it.url)) {
        var a = document.createElement('a');
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'View';
        a.setAttribute('aria-label', 'View ' + it.name);
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    sec.appendChild(h);
    sec.appendChild(lead);
    sec.appendChild(ul);
    if (host && host.tagName !== 'FOOTER' && host.parentNode) host.parentNode.insertBefore(sec, host.nextSibling);
    else if (host && host.parentNode) host.parentNode.insertBefore(sec, host);
    else document.body.appendChild(sec);
  }

  function formatDate(iso) {
    var p = String(iso || '').split('-');
    if (p.length < 3) return iso || '';
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  /* ------------------------------ RSVPs ------------------------------ */

  var turnstile = { id: null, token: null, loading: null };

  function loadTurnstile() {
    if (turnstile.loading) return turnstile.loading;
    if (window.turnstile) return (turnstile.loading = Promise.resolve(window.turnstile));
    turnstile.loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = function () { resolve(window.turnstile); };
      s.onerror = function () { reject(new Error('The check could not load')); };
      document.head.appendChild(s);
    });
    return turnstile.loading;
  }

  /* An invisible check: Cloudflare only shows it when it needs the guest to
     tick a box, and then inside the form, above the button. */
  function renderCheck() {
    if (!state.siteKey || turnstile.id !== null) return;
    var form = document.getElementById('rsvp-form');
    if (!form) return;
    loadTurnstile().then(function (ts) {
      if (turnstile.id !== null) return;
      var box = document.createElement('div');
      box.className = 'luma-check';
      var button = form.querySelector('button[type="submit"]');
      form.insertBefore(box, button);
      turnstile.id = ts.render(box, {
        sitekey: state.siteKey,
        appearance: 'interaction-only',
        size: 'flexible',
        callback: function (t) { turnstile.token = t; },
        'expired-callback': function () { turnstile.token = null; },
        'error-callback': function () { turnstile.token = null; }
      });
    }).catch(function () { /* the submit says so */ });
  }

  function humanToken() {
    var waited = 0;
    return new Promise(function (resolve) {
      (function poll() {
        if (turnstile.token) return resolve(turnstile.token);
        if (waited >= 10000) return resolve(null);
        waited += 200;
        setTimeout(poll, 200);
      })();
    });
  }

  function fail(message) {
    var el = document.getElementById('rsvp-error');
    if (el) el.textContent = message;
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  function clip(v, max) {
    v = String(v || '').trim();
    return v ? v.slice(0, max) : null;
  }

  function sendRsvp(form) {
    if (preview) return Promise.resolve(fail('This is your preview: answers are only sent from your guests’ link.'));

    var answer = form.get('attending') === 'no' ? 'no' : 'yes';
    var seats = parseInt(form.get('guest_count') || '1', 10) || 1;
    var notes = clip(form.get('notes'), 800);
    // some designs ask for dietary needs in a field of their own
    var dietary = answer === 'yes' ? clip(form.get('dietary'), 100) : null;
    var note = [answer === 'yes' && seats > 1 ? 'Party of ' + seats : '', dietary ? 'Dietary: ' + dietary : '', notes || '']
      .filter(Boolean).join(' · ');
    var name = clip(form.get('guest_names'), 120);
    if (!name || name.length < 2) return Promise.resolve(fail('Please write your name.'));

    renderCheck();
    return humanToken().then(function (human) {
      if (!human) return fail('We couldn’t confirm you’re not a robot. Please try again in a moment.');
      return window.__lumaRealFetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token, slug: state.slug, name: name, answer: answer,
          note: note || null,
          plusOne: answer === 'yes' ? clip(form.get('plusone_name'), 120) : null,
          meal: null, plusOneMeal: null,
          source: source, turnstile: human
        })
      }).then(function (res) {
        // a check token works once
        turnstile.token = null;
        if (window.turnstile && turnstile.id !== null) window.turnstile.reset(turnstile.id);
        if (res.ok) return res;
        return res.json().catch(function () { return {}; }).then(function (b) {
          return fail(b.error || 'Something went wrong sending your answer. Please try again.');
        });
      });
    });
  }

  window.__lumaRealFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var body = init && typeof init.body === 'string' ? init.body : '';
    if (input === '/' && init && init.method === 'POST' && /(^|&)form-name=rsvp(&|$)/.test(body)) {
      return sendRsvp(new URLSearchParams(body));
    }
    return window.__lumaRealFetch(input, init);
  };

  // start the check early, so it's usually done before the guest presses Send
  window.lumaBoot.then(function () { whenReady(renderCheck); });

  /* A design that draws itself may not call lumaAfterRender (its luma.js
     should). Whatever happens, a loaded invitation is never left hidden. */
  window.lumaBoot.then(function (data) {
    if (data) setTimeout(show, 2500);
  });
})();
