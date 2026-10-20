/*
 * The Glasshouse on Luma. Loaded after design.js.
 *
 * design.js replaces the shared engine's render outright, so the bridge's
 * after-render step (hide what's closed, prefill the guest's name, reveal
 * the page) is called from here once the page has drawn the couple's data.
 */
(function () {
  'use strict';
  var render = window.renderInvitationFromData;
  if (typeof render !== 'function') return;
  window.renderInvitationFromData = function () {
    render.apply(this, arguments);
    if (typeof window.lumaAfterRender === 'function' && typeof invitationData === 'object') {
      window.lumaAfterRender(invitationData);
    }
  };
})();
