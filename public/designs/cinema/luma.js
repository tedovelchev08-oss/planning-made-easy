/*
 * The Picture House (Cinema) on Luma. Loaded after design.js.
 *
 * design.js replaces the shared engine's render outright, so the bridge's
 * after-render step (hide what's closed, prefill the guest's name, reveal
 * the page) is called from here. It also fills the three stills in Act I,
 * which the original kept as fixed files: the couple's own photos, and the
 * frame left out until they add one.
 */
(function () {
  'use strict';
  var STILLS = { storyImgOne: 'storyPhotoOne', storyImgTwo: 'storyPhotoTwo', storyImgTogether: 'storyPhotoTogether' };

  function still(id, url) {
    var img = document.getElementById(id);
    if (!img) return;
    var want = url || 'none';
    if (img.dataset.lumaSrc === want) return;
    img.dataset.lumaSrc = want;
    /* a still they haven't added is left out, rather than shown as a black
       title card: an empty frame is the first thing that reads as unfinished */
    var fig = img.closest('figure');
    if (fig) fig.hidden = !url;
    if (url) {
      img.onerror = function () { if (fig) fig.hidden = true; };
      img.src = url;
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
