/*
 * Liquid Gold on Luma. Loaded after design.js.
 *
 * design.js replaces the shared engine's render outright, so the bridge's
 * after-render step (hide what's closed, prefill the guest's name, reveal
 * the page) is called from here. It also tidies the RSVP line: "Kindly
 * answer before <date> · <contact>", each part only when the couple gave it.
 */
(function () {
  'use strict';
  function blank(v) { return !v || !String(v).trim(); }
  function show(el, on) { if (el) el.style.display = on ? '' : 'none'; }

  var render = window.renderInvitationFromData;
  if (typeof render !== 'function') return;
  window.renderInvitationFromData = function () {
    render.apply(this, arguments);
    var d = typeof invitationData === 'object' ? invitationData : {};

    var hasDeadline = !blank(d.rsvpDeadline), hasContact = !blank(d.rsvpEmailText);
    var deadline = document.getElementById('rsvpDeadlineText');
    show(document.getElementById('rsvpDeadlinePrefix'), hasDeadline);
    show(deadline, hasDeadline);
    show(document.getElementById('rsvpEmailText'), hasContact);
    var line = deadline && deadline.parentElement;
    if (line) {
      show(line.querySelector('.sep'), hasDeadline && hasContact);
      show(line, hasDeadline || hasContact);
    }

    if (typeof window.lumaAfterRender === 'function') window.lumaAfterRender(d);
  };
})();
