/*
 * Mirror Palace on Luma (Block 18d). Loaded after design.js.
 *
 * design.js draws most of the page itself; this adds what it leaves to its
 * old standalone builder: the ceremony and celebration photos, the story
 * text, and hiding the couple's own wording when they left it empty (with
 * the separators around it), so a guest never sees a sample or a stray "·".
 * Photos the couple hasn't added keep the design's drawn plates.
 */
(function () {
  'use strict';

  function blank(v) { return !v || !String(v).trim(); }
  function show(el, on) { if (el) el.style.display = on ? '' : 'none'; }

  /** the couple's photo, or the plate already in the markup */
  function photo(id, url) {
    var img = document.getElementById(id);
    if (!img || blank(url) || img.dataset.lumaSrc === url) return;
    img.dataset.lumaSrc = url;
    delete img.dataset.triedPlate;
    delete img.dataset.placeholder;
    img.onerror = function () { if (window.photoFallback) window.photoFallback(img); };
    img.src = url;
  }

  /** the text node between two elements: a " · " separator */
  function separatorAfter(el) {
    var n = el && el.nextSibling;
    while (n && n.nodeType !== 3) n = n.nextSibling;
    return n;
  }

  function apply() {
    var d = (typeof invitationData === 'object' && invitationData) || {};

    photo('ceremonyImg', d.ceremonyPhoto);
    photo('celebrationImg', d.celebrationPhoto);

    // "How we met": the shared engine fills story1/story2 slots this design doesn't have
    var story = document.getElementById('storyText');
    if (story) {
      var text = [d.story1, d.story2].filter(function (s) { return !blank(s); }).join('\n\n');
      story.textContent = text;
      story.style.whiteSpace = 'pre-line';
      show(story, !!text);
    }

    // hero: "date · city"
    var date = document.querySelector('.hero-date [data-sync="date"]');
    var sep = separatorAfter(date);
    if (sep) sep.nodeValue = blank(d.heroCity) ? '' : '  ·  ';

    show(document.getElementById('dateCaptionText'), !blank(d.dateCaptionText));
    show(document.getElementById('celebrationAddress'), !blank(d.celebrationAddress));

    // RSVP: "Kindly respond by <date> · <contact>", each part only when given
    var hasDeadline = !blank(d.rsvpDeadline), hasContact = !blank(d.rsvpEmailText);
    show(document.getElementById('rsvpDeadlinePrefix'), hasDeadline);
    show(document.getElementById('rsvpDeadlineText'), hasDeadline);
    show(document.getElementById('rsvpEmailText'), hasContact);
    var metaSep = separatorAfter(document.getElementById('rsvpDeadlineText'));
    if (metaSep) metaSep.nodeValue = hasDeadline && hasContact ? '  ·  ' : '';
    show(document.getElementById('rsvpMeta'), hasDeadline || hasContact);

    show(document.getElementById('schedule'), !!(d.schedule && d.schedule.length));
  }

  var render = window.renderInvitationFromData;
  if (typeof render === 'function') {
    window.renderInvitationFromData = function () {
      render.apply(this, arguments);
      apply();
    };
  }
})();
