/*
 * The Picture House (Cinema) on Luma. Loaded after design.js.
 *
 * design.js replaces the shared engine's render outright, so the bridge's
 * after-render step (hide what's closed, prefill the guest's name, reveal
 * the page) is called from here. It also fills the three stills in Act I,
 * which the original kept as fixed files: the couple's own photos, or a
 * title card with their initials (window.photoFallback) until they add them.
 */
(function () {
  'use strict';
  var STILLS = { storyImgOne: 'storyPhotoOne', storyImgTwo: 'storyPhotoTwo', storyImgTogether: 'storyPhotoTogether' };

  function still(id, url) {
    var img = document.getElementById(id);
    if (!img) return;
    var want = url || 'placeholder';
    if (img.dataset.lumaSrc === want) return;
    img.dataset.lumaSrc = want;
    if (url) {
      img.onerror = function () { if (window.photoFallback) window.photoFallback(img); };
      img.src = url;
    } else if (window.photoFallback) {
      window.photoFallback(img);
    }
  }

  var render = window.renderInvitationFromData;
  if (typeof render !== 'function') return;
  window.renderInvitationFromData = function () {
    render.apply(this, arguments);
    var d = typeof invitationData === 'object' ? invitationData : {};
    Object.keys(STILLS).forEach(function (id) { still(id, d[STILLS[id]]); });
    if (typeof window.lumaAfterRender === 'function') window.lumaAfterRender(d);
  };
})();
