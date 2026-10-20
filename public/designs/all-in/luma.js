/*
 * All In on Luma. Loaded after design.js.
 *
 * design.js replaces the shared engine's render outright, so the bridge's
 * after-render step (hide what's closed, prefill the guest's name, reveal
 * the page) is called from here. The Ace shows the couple's photo, or their
 * initials until they add one; the wide story photo reuses it, so it waits
 * for a real photo rather than cropping the initials card.
 */
(function () {
  'use strict';
  var render = window.renderInvitationFromData;
  if (typeof render !== 'function') return;
  window.renderInvitationFromData = function () {
    render.apply(this, arguments);
    var d = typeof invitationData === 'object' ? invitationData : {};
    var story = document.getElementById('storyImg');
    var figure = story && story.closest('figure');
    var real = typeof d.heroPhoto === 'string' && /^(https:|blob:)/.test(d.heroPhoto);
    if (figure) figure.style.display = real ? '' : 'none';
    if (typeof window.lumaAfterRender === 'function') window.lumaAfterRender(d);
  };
})();
