
        let isGuestModeActive = false;

        // The builder bar's height isn't fixed — its buttons wrap onto extra
        // rows on narrow screens. The header below it used to sit at a
        // hardcoded offset, so a taller bar could cover it completely. This
        // keeps the header pinned just below the bar's *actual* height at
        // all times, and keeps the page content clear of both.
        function syncFixedBarOffsets() {
            const bar = document.getElementById('builder-bar');
            const header = document.querySelector('header');
            const main = document.querySelector('main');
            if (!header) return;

            const guestModeActive = document.body.classList.contains('guest-mode');
            const barHeight = (bar && !guestModeActive) ? bar.offsetHeight : 0;

            header.style.top = barHeight + 'px';

            if (main) {
                const headerHeight = header.offsetHeight || 64;
                main.style.paddingTop = Math.max(128, barHeight + headerHeight + 24) + 'px';
            }
        }

        function initFixedBarSync() {
            const bar = document.getElementById('builder-bar');
            const header = document.querySelector('header');
            if (!header) return;

            if ('ResizeObserver' in window) {
                const ro = new ResizeObserver(syncFixedBarOffsets);
                if (bar) ro.observe(bar);
                ro.observe(header);
            }
            window.addEventListener('resize', syncFixedBarOffsets);
            window.addEventListener('orientationchange', syncFixedBarOffsets);
            syncFixedBarOffsets();
        }

        window.addEventListener('DOMContentLoaded', async () => {
            // A short link (?id=xxxxx) means the invitation data lives on
            // the server, not in the URL — fetch it first. This takes
            // priority since it's the preferred method when available.
            const urlParams = new URLSearchParams(window.location.search);
            // LUMA: served by Luma, the couple's data comes from /api/invitation
            // through luma-bridge.js (window.lumaBoot), never from a Netlify
            // short link or a URL hash.
            const shortLinkId = window.lumaBoot ? null : urlParams.get('id');
            if (window.lumaBoot) {
                try {
                    const lumaData = await window.lumaBoot;
                    if (lumaData) {
                        invitationData = { ...invitationData, ...lumaData };
                        if (lumaData.music && lumaData.music.coupleUrl) {
                            MUSIC_TRACKS.couple = { label: lumaData.music.coupleName || 'Our song', url: lumaData.music.coupleUrl };
                        }
                    }
                } catch (e) {
                    console.warn('Luma: the invitation could not be loaded', e);
                }
            }
            else if (shortLinkId) {
                try {
                    const response = await fetch(`/.netlify/functions/get-invitation?id=${encodeURIComponent(shortLinkId)}`);
                    if (response.ok) {
                        const parsed = await response.json();
                        invitationData = { ...invitationData, ...parsed };
                    } else {
                        console.warn('Short link lookup failed:', response.status);
                    }
                } catch (e) {
                    console.warn('Could not reach the backend for this short link — the site may not have its functions deployed.', e);
                }
            }
            // Check for an encoded payload in the URL hash. New links use
            // "lz=" (LZ-String compressed, much shorter); older shared
            // links may still use "data=" (plain base64) — both are
            // supported so previously-sent links keep working.
            else if (window.location.hash && window.location.hash.includes('lz=')) {
                try {
                    const encodedPayload = window.location.hash.split('lz=')[1];
                    const decodedJson = LZString.decompressFromEncodedURIComponent(encodedPayload);
                    const parsed = JSON.parse(decodedJson);
                    invitationData = { ...invitationData, ...parsed };
                } catch (e) {
                    console.warn("Could not parse compressed URL hash payload", e);
                }
            } else if (window.location.hash && window.location.hash.includes('data=')) {
                try {
                    const encodedPayload = window.location.hash.split('data=')[1];
                    const decodedJson = decodeURIComponent(escape(atob(encodedPayload)));
                    const parsed = JSON.parse(decodedJson);
                    invitationData = { ...invitationData, ...parsed };
                } catch (e) {
                    console.warn("Could not parse URL hash payload", e);
                }
            }

            // Lock into guest mode if flag is set (e.g. in downloaded or guest shared version)
            if (invitationData.isGuestView || window.location.hash.includes('view=guest') || shortLinkId) {
                enableGuestMode(true);
            }

            syncDataToInputs();
            renderInvitationFromData();
            updateCountdown();
            initScrollReveal();
            initFixedBarSync();
            initGalleryAutoplayPausing();
            handleRsvpAttendingChange();
            handleRsvpGuestCountChange();
        });

        // Reveals sections/elements as they enter the viewport, and re-hides them
        // when they leave, so the animation replays whether scrolling down or
        // back up. Skipped entirely for prefers-reduced-motion.
        function initScrollReveal() {
            const targets = document.querySelectorAll('.reveal');
            if (!targets.length) return;

            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return; // leave everything visible, no animation
            }
            if (!('IntersectionObserver' in window)) {
                targets.forEach(el => el.classList.add('is-visible'));
                return;
            }

            document.body.classList.add('js-reveal-active');

            // Reveal once and stay revealed. This used to toggle on
            // intersection, so anything scrolled past was un-revealed and
            // re-animated on the way back — a guest scrolling up to
            // re-read the venue watched the whole page fade in again.
            // Measured before the change: 14 of 18 elements had reset by
            // the time you reached the bottom.
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            }, {
                threshold: 0.12,
                rootMargin: '0px 0px -6% 0px'
            });

            targets.forEach(el => observer.observe(el));
        }

        function toggleGuestPreview() {
            enableGuestMode(!isGuestModeActive, { viaToggle: true });
        }

        function enableGuestMode(activate, opts) {
            opts = opts || {};
            isGuestModeActive = activate;
            const btn = document.getElementById('guest-preview-btn');
            if (isGuestModeActive) {
                resetEnvelopeIntroInstant();
                window.scrollTo(0, 0);
                document.body.classList.add('guest-mode');
                if (btn) btn.innerHTML = `<i class="fas fa-edit text-gold"></i> Back to Builder`;
                // The "Exit Guest Preview" button only makes sense when the
                // couple clicked into this from an active editing session —
                // it lets them flip back to the builder. Someone who just
                // opened a shared guest-view link has no builder session to
                // "exit" into, and definitely shouldn't be handed a button
                // that reveals the editing tools.
                document.body.classList.toggle('show-exit-btn', !!opts.viaToggle);
            } else {
                document.body.classList.remove('guest-mode', 'show-exit-btn');
                if (btn) btn.innerHTML = `<i class="fas fa-eye text-gold"></i> Preview Guest View`;
            }
            if (typeof syncFixedBarOffsets === 'function') syncFixedBarOffsets();
            if (typeof updateDocumentTitle === 'function') updateDocumentTitle();
        }

        // Resets the envelope to sealed without visibly playing the closing
        // animation in reverse — used when jumping into guest preview.
        function resetEnvelopeIntroInstant() {
            const box = document.getElementById('envelope-box-el');
            if (!box) return;
            box.classList.add('envelope-no-transition');
            resetEnvelopeIntro();
            void box.offsetWidth; // force reflow so the reset is applied with transitions off
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    box.classList.remove('envelope-no-transition');
                });
            });
        }

        function setInputValue(id, value) {
            const el = document.getElementById(id);
            if (el) el.value = value;
        }

        function getStoryText(field) {
            return invitationData[field] || '';
        }

        function setStoryText(field, value) {
            invitationData[field] = value;
        }

        function escapeHtml(str) {
            return String(str == null ? '' : str).replace(/[&<>"']/g, s => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]
            ));
        }

        // Curated icon set for schedule events, drawn from the FontAwesome
        // Free set already loaded on the page.
        const SCHEDULE_ICONS = [
            { key: 'fa-ring', label: 'Rings' },
            { key: 'fa-heart', label: 'Heart' },
            { key: 'fa-champagne-glasses', label: 'Cocktail' },
            { key: 'fa-utensils', label: 'Dinner' },
            { key: 'fa-cake-candles', label: 'Cake' },
            { key: 'fa-music', label: 'Music' },
            { key: 'fa-camera', label: 'Photos' },
            { key: 'fa-car-side', label: 'Send-Off' },
            { key: 'fa-plane-departure', label: 'Departure' },
            { key: 'fa-gift', label: 'Gifts' },
            { key: 'fa-users', label: 'Guests' },
            { key: 'fa-star', label: 'Moment' }
        ];

        // Bundled locally in assets/audio/ rather than hotlinked.
        //
        // The previous set pointed at Internet Archive uploads whose own names
        // gave them away — "ClairDeLuneFromTwilight", "CannonInDFromDudeWhereIsMyCar".
        // Those are soundtrack rips. The compositions are long out of copyright,
        // but a RECORDING carries its own separate copyright, so shipping them
        // in a product sold to hundreds of couples was a real exposure. They
        // were also fragile: a takedown or an archive.org outage silently kills
        // the music in every invitation ever sold.
        //
        // Every file here is Public Domain or CC0, sourced from Wikimedia
        // Commons and re-encoded to MP3 because Safari does not reliably play
        // .ogg or .opus, and most wedding guests open these on an iPhone.
        // Full provenance is in assets/audio/CREDITS.txt.
        const MUSIC_TRACKS = {
            nocturne: {
                label: 'Chopin — Nocturne, Op. 9 No. 2',
                url: '../_shared/audio/nocturne.mp3'
            },
            clairdelune: {
                label: 'Debussy — Clair de Lune',
                url: '../_shared/audio/clairdelune.mp3'
            },
            gnossienne: {
                label: 'Satie — Gnossienne No. 1',
                url: '../_shared/audio/gnossienne.mp3'
            },
            traumerei: {
                label: 'Schumann — Träumerei',
                url: '../_shared/audio/traumerei.mp3'
            },
            pavane: {
                label: 'Ravel — Pavane pour une infante défunte',
                url: '../_shared/audio/pavane.mp3'
            }
        };

        // Invitations saved before this set changed carry retired keys like
        // "bachair". Falling back keeps their music working instead of
        // silently playing nothing.
        function resolveTrack(key) {
            return MUSIC_TRACKS[key] || MUSIC_TRACKS.clairdelune;
        }

        // Browsers block autoplay-with-sound, and it's more considerate to
        // guests anyway — so music only ever starts from an explicit tap on
        // the floating button, never automatically.
        function toggleMusic() {
            const audio = document.getElementById('bg-music-audio');
            const btn = document.getElementById('music-toggle-btn');
            const icon = document.getElementById('music-toggle-icon');
            if (!audio) return;

            if (audio.paused) {
                audio.play().then(() => {
                    if (icon) { icon.classList.remove('fa-music'); icon.classList.add('fa-pause'); }
                    if (btn) btn.classList.add('is-playing');
                }).catch((err) => {
                    console.error('Background music could not play:', err);
                    showMusicError();
                });
            } else {
                audio.pause();
                if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-music'); }
                if (btn) btn.classList.remove('is-playing');
            }
        }

        function showMusicError() {
            const toast = document.getElementById('music-error-toast');
            if (!toast) return;
            toast.classList.remove('hidden');
            clearTimeout(showMusicError._t);
            showMusicError._t = setTimeout(() => toast.classList.add('hidden'), 5000);
        }

        // Shows/hides the floating music button and wires up the selected
        // track based on the couple's drawer settings.
        function syncMusicPlayer() {
            const btn = document.getElementById('music-toggle-btn');
            const audio = document.getElementById('bg-music-audio');
            if (!btn || !audio) return;

            const music = invitationData.music || {};
            const track = resolveTrack(music.track);

            if (music.enabled && track) {
                if (audio.getAttribute('data-current-track') !== music.track) {
                    const wasPlaying = !audio.paused;

                    // Detach the error handler and fully reset the element
                    // before loading a new source. Simply reassigning .src
                    // on an element that already has media loaded/playing
                    // can fire a spurious 'error' event for the *old*
                    // source being interrupted, which was being misread as
                    // a real failure.
                    audio.onerror = null;
                    audio.pause();
                    audio.removeAttribute('src');
                    audio.load();

                    audio.src = track.url;
                    audio.setAttribute('data-current-track', music.track);
                    audio.load();

                    const icon = document.getElementById('music-toggle-icon');
                    if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-music'); }
                    btn.classList.remove('is-playing');

                    // Re-attach the error handler slightly after the swap
                    // so the reset itself can't be mistaken for a failure.
                    setTimeout(() => {
                        audio.onerror = () => {
                            console.error('Background music failed to load:', track.url);
                            showMusicError();
                        };
                    }, 400);

                    // If a track was actively playing when the couple
                    // switched it, keep the music going on the new track
                    // rather than silently stopping.
                    if (wasPlaying) {
                        audio.play().then(() => {
                            if (icon) { icon.classList.remove('fa-music'); icon.classList.add('fa-pause'); }
                            btn.classList.add('is-playing');
                        }).catch(() => {});
                    }
                }
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
                audio.pause();
            }
        }

        function getScheduleTitle(item) {
            return item.title || '';
        }

        function setScheduleTitle(item, value) {
            item.title = value;
        }

        function findScheduleItem(id) {
            return (invitationData.schedule || []).find(i => i.id === id);
        }

        function addScheduleItem() {
            const newId = 'sch-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            if (!Array.isArray(invitationData.schedule)) invitationData.schedule = [];
            invitationData.schedule.push({
                id: newId,
                time: '',
                venue: '',
                icon: 'fa-heart',
                title: ''
            });
            renderScheduleDrawer();
            renderScheduleTimeline();
        }

        function removeScheduleItem(id) {
            invitationData.schedule = (invitationData.schedule || []).filter(i => i.id !== id);
            renderScheduleDrawer();
            renderScheduleTimeline();
        }

        function moveScheduleItem(id, direction) {
            const arr = invitationData.schedule || [];
            const idx = arr.findIndex(i => i.id === id);
            const newIdx = idx + direction;
            if (idx === -1 || newIdx < 0 || newIdx >= arr.length) return;
            [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
            renderScheduleDrawer();
            renderScheduleTimeline();
        }

        function updateScheduleField(id, field, value) {
            const item = findScheduleItem(id);
            if (!item) return;
            item[field] = value;
            renderScheduleTimeline();
        }

        function updateScheduleTitleField(id, value) {
            const item = findScheduleItem(id);
            if (!item) return;
            setScheduleTitle(item, value);
            renderScheduleTimeline();
        }

        function setScheduleIcon(id, iconKey) {
            const item = findScheduleItem(id);
            if (!item) return;
            item.icon = iconKey;
            renderScheduleDrawer();
            renderScheduleTimeline();
        }

        // Renders the guest-facing alternating timeline. Even-indexed items
        // sit on the left, odd on the right (mobile collapses both to a
        // single left-aligned column via CSS).
        // Turns "1h 30m" into something a guest reads at a glance.
        function formatGap(minutes) {
            if (minutes <= 0) return '';
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            if (h && m) return `${h} hr ${m} min`;
            if (h) return h === 1 ? '1 hour' : `${h} hours`;
            return `${m} min`;
        }

        // Spacing on the timeline is proportional to the real gap between
        // events, so the layout carries information rather than decorating.
        // A long afternoon between the ceremony and dinner visibly breathes;
        // back-to-back moments sit tight together. Guests can see the shape
        // of the day without reading a single time.
        //
        // Clamped at both ends: below the minimum, entries would collide;
        // above the maximum, one long gap would push everything off screen.
        const SCHEDULE_MIN_GAP_PX = 26;
        const SCHEDULE_MAX_GAP_PX = 190;
        const SCHEDULE_PX_PER_MIN = 0.95;

        function renderScheduleTimeline() {
            const container = document.getElementById('schedule-timeline');
            if (!container || !Array.isArray(invitationData.schedule)) return;

            // Minutes from midnight for each entry, so gaps can be measured.
            // Anything unparseable falls back to an even gap rather than
            // collapsing the timeline.
            const minutesOf = (t) => {
                const p = parseEventTime(t);
                return p ? p.hours * 60 + p.minutes : null;
            };

            const stamps = invitationData.schedule.map(i => minutesOf(i.time));

            container.innerHTML = invitationData.schedule.map((item, idx) => {
                const align = (idx % 2 === 0) ? 'align-left' : 'align-right';
                const title = getScheduleTitle(item);
                const venueHtml = item.venue
                    ? `<p class="schedule-venue">${escapeHtml(item.venue)}</p>`
                    : '';

                let gapMinutes = 0;
                if (idx > 0 && stamps[idx] != null && stamps[idx - 1] != null) {
                    gapMinutes = stamps[idx] - stamps[idx - 1];
                    // An evening that runs past midnight reads as negative.
                    if (gapMinutes < 0) gapMinutes += 24 * 60;
                }

                const gapPx = idx === 0
                    ? 0
                    : Math.round(Math.min(SCHEDULE_MAX_GAP_PX,
                        Math.max(SCHEDULE_MIN_GAP_PX, gapMinutes * SCHEDULE_PX_PER_MIN)));

                const gapLabel = gapMinutes > 0
                    ? `<span class="schedule-gap" aria-hidden="true">${escapeHtml(formatGap(gapMinutes))}</span>`
                    : '';

                return `
                <div class="schedule-row ${align}" style="--gap-px:${gapPx}px">
                    ${gapLabel}
                    <div class="schedule-content">
                        <span class="schedule-icon"><i class="fas ${escapeHtml(item.icon || 'fa-heart')}"></i></span>
                        <div class="schedule-text">
                            <span class="schedule-time">${escapeHtml(item.time)}</span>
                            <h3 class="schedule-title">${escapeHtml(title)}</h3>
                            ${venueHtml}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        // Renders the builder-only editable list: time / event name / venue
        // / icon picker, plus reorder and delete controls, per item.
        function renderScheduleDrawer() {
            const container = document.getElementById('schedule-drawer-list');
            if (!container || !Array.isArray(invitationData.schedule)) return;
            const items = invitationData.schedule;

            container.innerHTML = items.map((item, idx) => {
                const title = getScheduleTitle(item);
                const iconButtons = SCHEDULE_ICONS.map(ic => `
                    <button type="button" onclick="setScheduleIcon('${item.id}','${ic.key}')" title="${escapeHtml(ic.label)}" class="schedule-icon-btn${item.icon === ic.key ? ' schedule-icon-btn-active' : ''}">
                        <i class="fas ${ic.key}"></i>
                    </button>`).join('');

                return `
                <div class="schedule-drawer-item">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-gold/80">#${idx + 1}</span>
                        <div class="flex items-center gap-1">
                            <button type="button" onclick="moveScheduleItem('${item.id}', -1)" class="schedule-mini-btn" ${idx === 0 ? 'disabled' : ''} aria-label="Move up"><i class="fas fa-chevron-up"></i></button>
                            <button type="button" onclick="moveScheduleItem('${item.id}', 1)" class="schedule-mini-btn" ${idx === items.length - 1 ? 'disabled' : ''} aria-label="Move down"><i class="fas fa-chevron-down"></i></button>
                            <button type="button" onclick="removeScheduleItem('${item.id}')" class="schedule-mini-btn schedule-mini-btn-danger" aria-label="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-warmgray mb-1">Time</label>
                            <input type="text" value="${escapeHtml(item.time)}" oninput="updateScheduleField('${item.id}','time',this.value)" class="w-full p-2 rounded-lg border border-gold/30 bg-cream/50 font-sans text-xs focus:outline-none focus:border-gold">
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-warmgray mb-1">Event Name</label>
                            <input type="text" value="${escapeHtml(title)}" oninput="updateScheduleTitleField('${item.id}',this.value)" class="w-full p-2 rounded-lg border border-gold/30 bg-cream/50 font-sans text-xs focus:outline-none focus:border-gold">
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="block text-[10px] font-semibold uppercase tracking-wider text-warmgray mb-1">Venue</label>
                        <input type="text" value="${escapeHtml(item.venue)}" oninput="updateScheduleField('${item.id}','venue',this.value)" class="w-full p-2 rounded-lg border border-gold/30 bg-cream/50 font-sans text-xs focus:outline-none focus:border-gold">
                    </div>
                    <div>
                        <label class="block text-[10px] font-semibold uppercase tracking-wider text-warmgray mb-1">Icon</label>
                        <div class="schedule-icon-picker">${iconButtons}</div>
                    </div>
                </div>`;
            }).join('');
        }

        // ===== Photo Gallery (up to 6, add/reorder/delete) =====
        const GALLERY_MAX = 6;

        function findGalleryItem(id) {
            return (invitationData.gallery || []).find(i => i.id === id);
        }

        function handleGalleryFileSelected(inputEl) {
            const file = inputEl.files && inputEl.files[0];
            if (!file) return;
            const statusEl = document.getElementById('gallery-upload-status');
            const setStatus = (msg) => { if (statusEl) statusEl.innerText = msg; };

            if (!Array.isArray(invitationData.gallery)) invitationData.gallery = [];
            if (invitationData.gallery.length >= GALLERY_MAX) {
                setStatus(`You can add up to ${GALLERY_MAX} photos.`);
                inputEl.value = '';
                return;
            }

            processImageFile(file, setStatus, (dataUrl) => {
                invitationData.gallery.push({
                    id: 'gal-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    photo: dataUrl
                });
                renderGalleryDrawer();
                renderGalleryPublic();
            });
            inputEl.value = '';
        }

        function removeGalleryPhoto(id) {
            invitationData.gallery = (invitationData.gallery || []).filter(i => i.id !== id);
            renderGalleryDrawer();
            renderGalleryPublic();
        }

        function moveGalleryPhoto(id, direction) {
            const arr = invitationData.gallery || [];
            const idx = arr.findIndex(i => i.id === id);
            const newIdx = idx + direction;
            if (idx === -1 || newIdx < 0 || newIdx >= arr.length) return;
            [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
            renderGalleryDrawer();
            renderGalleryPublic();
        }

        function renderGalleryDrawer() {
            const container = document.getElementById('gallery-drawer-grid');
            if (!container) return;
            const items = invitationData.gallery || [];

            let html = items.map((item, idx) => `
                <div class="gallery-drawer-tile">
                    <img src="${item.photo}" alt="">
                    <div class="gallery-drawer-tile-controls">
                        <button type="button" onclick="moveGalleryPhoto('${item.id}', -1)" class="schedule-mini-btn" ${idx === 0 ? 'disabled' : ''} aria-label="Move left"><i class="fas fa-chevron-left"></i></button>
                        <button type="button" onclick="moveGalleryPhoto('${item.id}', 1)" class="schedule-mini-btn" ${idx === items.length - 1 ? 'disabled' : ''} aria-label="Move right"><i class="fas fa-chevron-right"></i></button>
                        <button type="button" onclick="removeGalleryPhoto('${item.id}')" class="schedule-mini-btn schedule-mini-btn-danger" aria-label="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`).join('');

            if (items.length < GALLERY_MAX) {
                html += `
                <label class="gallery-drawer-add-tile">
                    <input type="file" accept="image/*" class="hidden" onchange="handleGalleryFileSelected(this)">
                    <i class="fas fa-plus"></i>
                    <span>Add Photo</span>
                </label>`;
            }

            container.innerHTML = html;
        }

        function openGalleryLightbox(id) {
            const item = findGalleryItem(id);
            const modal = document.getElementById('gallery-lightbox');
            const img = document.getElementById('gallery-lightbox-img');
            if (!item || !modal || !img) return;
            img.src = item.photo;
            modal.classList.add('is-open');
        }

        function closeGalleryLightbox() {
            const modal = document.getElementById('gallery-lightbox');
            if (modal) modal.classList.remove('is-open');
        }

        // ===== Photo Gallery: coverflow carousel =====
        let galleryActiveIndex = 0;
        let galleryAutoplayTimer = null;

        // Shortest signed distance from index i to the active index, wrapping
        // around the ends of the list — so navigating past the last photo
        // loops smoothly back to the first instead of jumping backwards.
        function galleryShortestOffset(i, active, count) {
            let diff = i - active;
            if (diff > count / 2) diff -= count;
            if (diff < -count / 2) diff += count;
            return diff;
        }

        function galleryLayoutForOffset(offset, isMobile) {
            // Spacing follows the carousel's own width rather than a fixed
            // number of pixels. With a hardcoded 210 the photos bunched into
            // the middle of a large screen no matter how wide the design made
            // the carousel; deriving it means a design can widen the carousel
            // and the slides spread to fill it.
            const track = document.getElementById('gallery-carousel-track');
            const trackWidth = track ? track.getBoundingClientRect().width : 0;
            const derived = trackWidth ? trackWidth * 0.17 : (isMobile ? 110 : 190);
            const spacing = Math.max(isMobile ? 92 : 150, Math.min(derived, 300));

            const dist = Math.abs(offset);
            const dir = offset < 0 ? -1 : 1;

            // Each ring is placed by its own multiplier rather than by
            // offset * multiplier. The old form multiplied by the offset a
            // second time, so the second ring landed at 3.4x the spacing
            // while the first sat at 1x — the outer photographs drifted off
            // on their own with a gap in between. These step 1 / 1.72 / 2.3,
            // which reads as a stack falling away rather than two clusters.
            if (dist === 0) return { x: 0, scale: 1, opacity: 1, z: 3 };
            if (dist === 1) return { x: dir * spacing, scale: isMobile ? 0.68 : 0.78, opacity: 0.62, z: 2 };
            if (dist === 2) return { x: dir * spacing * 1.72, scale: isMobile ? 0.5 : 0.6, opacity: 0.28, z: 1 };
            return { x: dir * spacing * 2.3, scale: 0.46, opacity: 0, z: 0 };
        }

        // Rebuilds the carousel's DOM from scratch — only needed when the
        // actual set of photos changes (add/remove/reorder), or on first
        // render. Elements get their FINAL position immediately, so there's
        // nothing to animate here — that's intentional and expected.
        function buildGalleryCarouselDOM() {
            const track = document.getElementById('gallery-carousel-track');
            if (!track) return;
            const items = invitationData.gallery || [];
            if (galleryActiveIndex >= items.length) galleryActiveIndex = 0;

            const isMobile = window.innerWidth < 640;
            track.innerHTML = items.map((item, i) => {
                const offset = galleryShortestOffset(i, galleryActiveIndex, items.length);
                const layout = galleryLayoutForOffset(offset, isMobile);
                return `<button type="button" class="gallery-carousel-item" data-gallery-index="${i}" onclick="galleryCarouselItemClick(${i})" aria-label="${i === galleryActiveIndex ? 'Enlarge photo' : 'Show this photo'}"
                    style="transform: translate(-50%,-50%) translateX(${layout.x}px) scale(${layout.scale}); opacity:${layout.opacity}; z-index:${layout.z}; pointer-events:${layout.opacity < 0.05 ? 'none' : 'auto'};">
                    <img src="${item.photo}" alt="" loading="lazy">
                </button>`;
            }).join('');

            updateGalleryNavVisibility();
        }

        // Updates the position/scale/opacity of the *existing* DOM elements
        // (rather than recreating them) so the CSS transition has a real
        // "before" state to animate from — this is what makes photos
        // actually slide left/right instead of just popping into place.
        function updateGalleryCarouselLayout() {
            const track = document.getElementById('gallery-carousel-track');
            if (!track) return;
            const items = invitationData.gallery || [];
            const isMobile = window.innerWidth < 640;

            track.querySelectorAll('.gallery-carousel-item').forEach((el) => {
                const i = parseInt(el.getAttribute('data-gallery-index'), 10);
                const offset = galleryShortestOffset(i, galleryActiveIndex, items.length);
                const layout = galleryLayoutForOffset(offset, isMobile);
                el.style.transform = `translate(-50%,-50%) translateX(${layout.x}px) scale(${layout.scale})`;
                el.style.opacity = layout.opacity;
                el.style.zIndex = layout.z;
                el.style.pointerEvents = layout.opacity < 0.05 ? 'none' : 'auto';
                el.setAttribute('aria-label', i === galleryActiveIndex ? 'Enlarge photo' : 'Show this photo');
            });
        }

        function updateGalleryNavVisibility() {
            const outer = document.querySelector('.gallery-carousel-outer');
            const prevBtn = document.querySelector('.gallery-nav-prev');
            const nextBtn = document.querySelector('.gallery-nav-next');
            const items = invitationData.gallery || [];
            const showNav = items.length > 1;
            if (prevBtn) prevBtn.style.display = showNav ? 'flex' : 'none';
            if (nextBtn) nextBtn.style.display = showNav ? 'flex' : 'none';
            if (outer) outer.classList.toggle('single-photo', items.length === 1);
        }

        function galleryCarouselItemClick(i) {
            if (i === galleryActiveIndex) {
                const item = (invitationData.gallery || [])[i];
                if (item) openGalleryLightbox(item.id);
            } else {
                galleryActiveIndex = i;
                updateGalleryCarouselLayout();
                startGalleryAutoplay();
            }
        }

        function galleryCarouselNav(direction) {
            const items = invitationData.gallery || [];
            if (items.length === 0) return;
            galleryActiveIndex = (galleryActiveIndex + direction + items.length) % items.length;
            updateGalleryCarouselLayout();
            startGalleryAutoplay();
        }

        function stopGalleryAutoplay() {
            if (galleryAutoplayTimer) clearInterval(galleryAutoplayTimer);
            galleryAutoplayTimer = null;
        }

        // Restarts the autoplay timer from zero — called both on initial
        // render and after any manual navigation, so a manual click doesn't
        // get immediately overridden by an autoplay tick a moment later.
        function startGalleryAutoplay() {
            stopGalleryAutoplay();
            const items = invitationData.gallery || [];
            if (items.length < 2) return;
            galleryAutoplayTimer = setInterval(() => {
                galleryActiveIndex = (galleryActiveIndex + 1) % items.length;
                updateGalleryCarouselLayout();
            }, 2500);
        }

        function renderGalleryPublic() {
            const section = document.getElementById('gallery-section');
            if (!section) return;
            const items = invitationData.gallery || [];

            if (items.length === 0) {
                section.style.display = 'none';
                stopGalleryAutoplay();
                return;
            }
            section.style.display = '';
            buildGalleryCarouselDOM();
            startGalleryAutoplay();
        }

        // Recalculate the coverflow spacing/scale on resize (e.g. rotating
        // a phone, or the browser window changing size) so it stays correct
        // relative to the mobile/desktop breakpoint.
        let galleryResizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(galleryResizeTimer);
            galleryResizeTimer = setTimeout(updateGalleryCarouselLayout, 150);
        });

        // Pause autoplay while a visitor is actually looking at a photo
        // (hovering/focused), and whenever the browser tab isn't visible,
        // so it doesn't keep advancing unattended or burn battery in the
        // background.
        function initGalleryAutoplayPausing() {
            const outer = document.querySelector('.gallery-carousel-outer');
            if (outer) {
                outer.addEventListener('mouseenter', stopGalleryAutoplay);
                outer.addEventListener('mouseleave', startGalleryAutoplay);
            }
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    stopGalleryAutoplay();
                } else {
                    startGalleryAutoplay();
                }
            });
        }

        // ===== FAQ (editable Q&A list) =====
        function findFaqItem(id) {
            return (invitationData.faq || []).find(i => i.id === id);
        }

        function addFaqItem() {
            const newId = 'faq-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            if (!Array.isArray(invitationData.faq)) invitationData.faq = [];
            invitationData.faq.push({
                id: newId,
                question: '',
                answer: ''
            });
            renderFaqDrawer();
            renderFaqPublic();
        }

        function removeFaqItem(id) {
            invitationData.faq = (invitationData.faq || []).filter(i => i.id !== id);
            renderFaqDrawer();
            renderFaqPublic();
        }

        function moveFaqItem(id, direction) {
            const arr = invitationData.faq || [];
            const idx = arr.findIndex(i => i.id === id);
            const newIdx = idx + direction;
            if (idx === -1 || newIdx < 0 || newIdx >= arr.length) return;
            [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
            renderFaqDrawer();
            renderFaqPublic();
        }

        function updateFaqField(id, part, value) {
            // part is 'question' or 'answer'
            const item = findFaqItem(id);
            if (!item) return;
            item[part] = value;
            renderFaqPublic();
        }

        function renderFaqDrawer() {
            const container = document.getElementById('faq-drawer-list');
            if (!container || !Array.isArray(invitationData.faq)) return;
            const items = invitationData.faq;

            container.innerHTML = items.map((item, idx) => {
                const questionVal = item.question || '';
                const answerVal = item.answer || '';
                return `
                <div class="schedule-drawer-item">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-gold/80">#${idx + 1}</span>
                        <div class="flex items-center gap-1">
                            <button type="button" onclick="moveFaqItem('${item.id}', -1)" class="schedule-mini-btn" ${idx === 0 ? 'disabled' : ''} aria-label="Move up"><i class="fas fa-chevron-up"></i></button>
                            <button type="button" onclick="moveFaqItem('${item.id}', 1)" class="schedule-mini-btn" ${idx === items.length - 1 ? 'disabled' : ''} aria-label="Move down"><i class="fas fa-chevron-down"></i></button>
                            <button type="button" onclick="removeFaqItem('${item.id}')" class="schedule-mini-btn schedule-mini-btn-danger" aria-label="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="block text-[10px] font-semibold uppercase tracking-wider text-warmgray mb-1">Question</label>
                        <input type="text" value="${escapeHtml(questionVal)}" oninput="updateFaqField('${item.id}','question',this.value)" class="w-full p-2 rounded-lg border border-gold/30 bg-cream/50 font-sans text-xs focus:outline-none focus:border-gold">
                    </div>
                    <div>
                        <label class="block text-[10px] font-semibold uppercase tracking-wider text-warmgray mb-1">Answer</label>
                        <textarea rows="2" oninput="updateFaqField('${item.id}','answer',this.value)" class="w-full p-2 rounded-lg border border-gold/30 bg-cream/50 font-sans text-xs focus:outline-none focus:border-gold">${escapeHtml(answerVal)}</textarea>
                    </div>
                </div>`;
            }).join('');
        }

        function toggleFaqPublicItem(id) {
            const answerEl = document.getElementById('faq-answer-' + id);
            const btnEl = document.getElementById('faq-question-' + id);
            if (!answerEl || !btnEl) return;
            const isOpen = answerEl.classList.contains('faq-answer-open');
            answerEl.classList.toggle('faq-answer-open', !isOpen);
            btnEl.classList.toggle('faq-question-open', !isOpen);
        }

        function renderFaqPublic() {
            const section = document.getElementById('faq-section');
            const list = document.getElementById('faq-list');
            if (!section || !list) return;
            const items = invitationData.faq || [];

            if (items.length === 0) {
                section.style.display = 'none';
                return;
            }
            section.style.display = '';
            list.innerHTML = items.map(item => {
                const q = item.question || '';
                const a = item.answer || '';
                if (!q) return '';
                return `
                <div class="faq-item">
                    <button type="button" id="faq-question-${item.id}" class="faq-question" onclick="toggleFaqPublicItem('${item.id}')">
                        <span>${escapeHtml(q)}</span>
                        <i class="fas fa-chevron-down faq-chevron"></i>
                    </button>
                    <div id="faq-answer-${item.id}" class="faq-answer">
                        <p>${escapeHtml(a)}</p>
                    </div>
                </div>`;
            }).join('');
        }


        function syncDataToInputs() {
            setInputValue('cfg-partner1', invitationData.partner1);
            setInputValue('cfg-partner2', invitationData.partner2);
            setInputValue('cfg-hashtag', invitationData.hashtag);
            setInputValue('cfg-date', invitationData.date);
            setInputValue('cfg-time', invitationData.time);
            setInputValue('cfg-venue-name', invitationData.venueName);
            setInputValue('cfg-venue-address', invitationData.venueAddress);
            setInputValue('cfg-dresscode', invitationData.dressCode);
            setInputValue('cfg-dresscode-note', invitationData.dressCodeNote);
            setInputValue('cfg-rsvp-deadline', invitationData.rsvpDeadline);
            setInputValue('cfg-hero-photo', invitationData.heroPhoto);
            syncHeroPhotoPreview(invitationData.heroPhoto);
            const musicEnabledEl = document.getElementById('cfg-music-enabled');
            if (musicEnabledEl) musicEnabledEl.checked = !!(invitationData.music && invitationData.music.enabled);
            setInputValue('cfg-music-track', (invitationData.music && invitationData.music.track) || 'clairdelune');
            syncMusicPlayer();
            setInputValue('cfg-story-1', getStoryText('story1'));
            setInputValue('cfg-story-2', getStoryText('story2'));
            renderScheduleDrawer();
            renderScheduleTimeline();
            renderGalleryDrawer();
            renderGalleryPublic();
            renderFaqDrawer();
            renderFaqPublic();
        }



        function syncHeroPhotoPreview(url) {
            const preview = document.getElementById('cfg-hero-photo-preview');
            const icon = document.getElementById('cfg-hero-photo-placeholder-icon');
            if (!preview) return;
            if (url) {
                preview.src = url;
                preview.classList.remove('hidden');
                if (icon) icon.classList.add('hidden');
            } else {
                preview.src = '';
                preview.classList.add('hidden');
                if (icon) icon.classList.remove('hidden');
            }
        }

        // Reads an uploaded photo, resizes it down to a sane max dimension, and
        // hands back a compressed JPEG data URL — most phone photos are 5-12MB
        // straight out of the camera, which would otherwise bloat the page badly.
        // Shared by the hero photo and the gallery photo slots.
        function processImageFile(file, setStatus, onSuccess) {
            if (!file) return;

            const name = (file.name || '').toLowerCase();
            const isHeic = /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/.test(name);
            if (isHeic) {
                setStatus("iPhone HEIC photos aren't supported by browsers yet — in your photo picker, choose \"Options\" and switch the format to JPEG, or pick a screenshot/JPG/PNG instead.");
                return;
            }

            // Some browsers/OSes don't set a MIME type for certain files — fall back
            // to checking the extension rather than rejecting outright.
            const looksLikeImage = file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/.test(name);
            if (!looksLikeImage) {
                setStatus('Please choose a JPG or PNG image file.');
                return;
            }

            setStatus('Processing photo…');

            const processImage = (imgLike, cleanup) => {
                try {
                    const maxDim = 1400;
                    let width = imgLike.width;
                    let height = imgLike.height;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round(height * (maxDim / width));
                            width = maxDim;
                        } else {
                            width = Math.round(width * (maxDim / height));
                            height = maxDim;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imgLike, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                    onSuccess(dataUrl);
                    setStatus(`Photo added (${Math.round(dataUrl.length / 1024)} KB) — saved in the page itself`);
                } catch (err) {
                    setStatus('Could not process that photo (' + (err && err.message ? err.message : 'unknown error') + '). Try a different file.');
                } finally {
                    if (cleanup) cleanup();
                }
            };

            const tryFileReaderFallback = () => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => processImage(img, null);
                    img.onerror = () => {
                        setStatus("Couldn't read that image — this photo's format may not be supported by your browser. Try a JPG, PNG, or a screenshot of the photo instead.");
                    };
                    img.src = e.target.result;
                };
                reader.onerror = () => {
                    const detail = (reader.error && (reader.error.message || reader.error.name)) || 'unknown error';
                    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                    setStatus(`Could not read that photo — every method failed (${detail}). File: ${sizeMB}MB, type: ${file.type || 'unknown'}. This looks like a phone/browser-level bug rather than anything wrong with the photo. Try: closing other browser tabs then retrying, restarting your browser, or uploading from a laptop/desktop instead.`);
                };
                reader.readAsDataURL(file);
            };

            const tryObjectUrlFallback = () => {
                let objectUrl;
                try {
                    objectUrl = URL.createObjectURL(file);
                } catch (err) {
                    tryFileReaderFallback();
                    return;
                }
                const img = new Image();
                img.onload = () => processImage(img, () => URL.revokeObjectURL(objectUrl));
                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    tryFileReaderFallback();
                };
                img.src = objectUrl;
            };

            // Primary approach: createImageBitmap decodes through the browser's
            // native media pipeline rather than general file-reading APIs, which
            // sidesteps a known class of iOS Safari "I/O read operation failed"
            // bugs that can affect FileReader and object URLs identically.
            if (window.createImageBitmap) {
                createImageBitmap(file)
                    .then((bitmap) => processImage(bitmap, () => bitmap.close && bitmap.close()))
                    .catch(() => tryObjectUrlFallback());
            } else {
                tryObjectUrlFallback();
            }
        }

        function handleHeroPhotoUpload(inputEl) {
            const file = inputEl.files && inputEl.files[0];
            const statusEl = document.getElementById('cfg-hero-photo-status');
            const setStatus = (msg) => { if (statusEl) statusEl.innerText = msg; };
            if (!file) return;

            processImageFile(file, setStatus, (dataUrl) => {
                document.getElementById('cfg-hero-photo').value = dataUrl;
                updateInvitationFromInputs();
                syncHeroPhotoPreview(dataUrl);
            });
            inputEl.value = '';
        }

        function getInputValue(id, fallback) {
            const el = document.getElementById(id);
            return el ? el.value : fallback;
        }

        function updateInvitationFromInputs() {
            invitationData.partner1 = getInputValue('cfg-partner1', invitationData.partner1) || "Partner 1";
            invitationData.partner2 = getInputValue('cfg-partner2', invitationData.partner2) || "Partner 2";
            invitationData.hashtag = getInputValue('cfg-hashtag', invitationData.hashtag) || "";
            invitationData.date = getInputValue('cfg-date', invitationData.date) || "2027-04-17";
            invitationData.time = getInputValue('cfg-time', invitationData.time) || "4:00 PM";
            invitationData.venueName = getInputValue('cfg-venue-name', invitationData.venueName) || "Venue Name";
            invitationData.venueAddress = getInputValue('cfg-venue-address', invitationData.venueAddress) || "Venue Location";
            invitationData.dressCode = getInputValue('cfg-dresscode', invitationData.dressCode) || "Formal";
            invitationData.dressCodeNote = getInputValue('cfg-dresscode-note', invitationData.dressCodeNote) || "";
            invitationData.rsvpDeadline = getInputValue('cfg-rsvp-deadline', invitationData.rsvpDeadline) || "";
            invitationData.heroPhoto = getInputValue('cfg-hero-photo', invitationData.heroPhoto);
            const musicEnabledEl = document.getElementById('cfg-music-enabled');
            if (!invitationData.music) invitationData.music = { enabled: false, track: 'clairdelune' };
            invitationData.music.enabled = musicEnabledEl ? musicEnabledEl.checked : invitationData.music.enabled;
            invitationData.music.track = getInputValue('cfg-music-track', invitationData.music.track) || 'clairdelune';
            syncMusicPlayer();
            setStoryText('story1', getInputValue('cfg-story-1', getStoryText('story1')));
            setStoryText('story2', getInputValue('cfg-story-2', getStoryText('story2')));

            renderInvitationFromData();

            // The countdown used to wait for its own 1-second interval, so an
            // edit appeared to do nothing for a beat — and in a background
            // tab, where browsers throttle timers to once a minute, it looked
            // broken outright. Refresh it on the same tick as everything else.
            updateCountdown();

            flagUnreadableTime();
        }

        // An unparseable ceremony time silently becomes 4pm. That is a
        // reasonable fallback for rendering, but the couple needs to know it
        // happened, otherwise the invitation quietly shows the wrong time.
        function flagUnreadableTime() {
            const input = document.getElementById('cfg-time');
            if (!input) return;
            const raw = input.value.trim();
            const understood = !raw || parseEventTime(raw).ok;
            const field = input.parentElement;
            if (field) field.classList.toggle('field-warning', !understood);
            input.setAttribute('aria-invalid', understood ? 'false' : 'true');
        }

        // Every value a design is allowed to display, keyed by name. A design
        // marks an element with data-field="venueName" (or any key below), as
        // many times and in whatever arrangement it likes, and the core fills
        // it in. This is what lets a new design lay itself out freely instead
        // of having to reproduce a fixed skeleton of element ids.
        function getFieldValues() {
            const p1 = invitationData.partner1 || '';
            const p2 = invitationData.partner2 || '';
            const dateFormatted = formatDateDisplay(invitationData.date);

            return {
                partner1: p1,
                partner2: p2,
                coupleNames: `${p1} & ${p2}`,
                initial1: p1.charAt(0),
                initial2: p2.charAt(0),
                initials: `${p1.charAt(0)}&${p2.charAt(0)}`,
                hashtag: invitationData.hashtag,
                dateFormatted: dateFormatted,
                time: invitationData.time,
                venueName: invitationData.venueName,
                venueAddress: invitationData.venueAddress,
                dateAndPlace: `${dateFormatted} • ${invitationData.venueAddress}`,
                dressCode: invitationData.dressCode,
                dressCodeNote: invitationData.dressCodeNote,
                rsvpDeadline: invitationData.rsvpDeadline,
                rsvpDeadlineText: `Please reply by ${invitationData.rsvpDeadline}`,
                story1: getStoryText('story1'),
                story2: getStoryText('story2'),
                heroPhoto: invitationData.heroPhoto
            };
        }

        // Fills in every [data-field] on the page. Images get their src set,
        // everything else gets text. A name this core doesn't know is skipped
        // rather than throwing, so a design referencing a field that doesn't
        // exist yet degrades quietly instead of breaking the whole render.
        function applyFieldBindings() {
            const values = getFieldValues();
            document.querySelectorAll('[data-field]').forEach(el => {
                const key = el.getAttribute('data-field');
                if (!Object.prototype.hasOwnProperty.call(values, key)) return;

                const value = values[key] == null ? '' : values[key];
                if (el.tagName === 'IMG') {
                    if (value) el.src = value;
                } else {
                    el.innerText = value;
                }
            });
        }

        function renderInvitationFromData() {
            const coupleFormatted = `${invitationData.partner1} & ${invitationData.partner2}`;

            applyFieldBindings();

            renderScheduleTimeline();
            renderGalleryPublic();
            renderFaqPublic();

            updateDocumentTitle();

            const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(coupleFormatted + ' Wedding')}&dates=${toCalendarStamp(getEventStart())}/${toCalendarStamp(getEventEnd())}&details=${encodeURIComponent('Celebrating the wedding of ' + coupleFormatted + '!')}&location=${encodeURIComponent(invitationData.venueName + ', ' + invitationData.venueAddress)}`;
            /* Guarded like the ics-link below it. A design that offers no Google
               Calendar button is a legitimate design, and an unguarded null here
               threw mid-render and abandoned everything after it. */
            const gcalLink = document.getElementById('gcal-link');
            if (gcalLink) gcalLink.href = gcalUrl;

            // LUMA: lets luma-bridge.js hide what the couple hasn't filled in
            if (typeof window.lumaAfterRender === 'function') window.lumaAfterRender(invitationData);

            // The Apple/iCal button points at a function that serves a real
            // .ics with Content-Type: text/calendar. Generating the file in the
            // browser works on desktop but is dead on iOS, which needs a proper
            // URL to hand to its calendar. Opened as a local file there's no
            // backend to call, so fall back to the in-browser download there.
            const icsLink = document.getElementById('ics-link');
            if (icsLink) {
                // LUMA: no Netlify calendar function behind Luma, so the
                // in-browser .ics download is used there too.
                if (window.location.protocol === 'file:' || window.lumaBoot) {
                    icsLink.removeAttribute('href');
                    icsLink.style.cursor = 'pointer';
                    icsLink.onclick = (e) => { e.preventDefault(); downloadICS(); };
                } else {
                    const params = new URLSearchParams({
                        p1: invitationData.partner1,
                        p2: invitationData.partner2,
                        date: invitationData.date,
                        time: invitationData.time,
                        venue: invitationData.venueName,
                        address: invitationData.venueAddress
                    });
                    icsLink.href = `/.netlify/functions/calendar?${params.toString()}`;
                    icsLink.onclick = null;
                }
            }
        }

        function formatDateDisplay(dateStr) {
            if (!dateStr) return "April 17, 2027";
            const parts = dateStr.split('-');
            if (parts.length < 3) return dateStr;
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }

        // The celebration runs 7 hours from the ceremony start — the same span
        // the original fixed 4pm–11pm window covered.
        const EVENT_DURATION_HOURS = 7;

        // The builder takes the ceremony time as free text so couples can write
        // it however they like ("4:00 PM", "16:00", "7.30pm"), which means
        // everything downstream — countdown, Google Calendar link, .ics file —
        // has to parse it rather than assume. Everything used to assume 4pm, so
        // setting any other time silently did nothing.
        function parseEventTime(timeStr) {
            // `ok` tells the caller whether the text was actually understood.
            // Without it an unreadable time silently became 4pm — and the
            // couple had no way to know their ceremony time hadn't taken.
            const fallback = { hours: 16, minutes: 0, ok: false };
            if (!timeStr) return fallback;

            // The meridiem group accepts am/pm, a.m./p.m., and "a m" spacing.
            // The previous pattern only matched a bare "am|pm", so "4:00 p.m."
            // parsed as 04:00 — four in the morning, silently, and that wrong
            // time went into the countdown, the Google Calendar link and the
            // .ics file alike.
            const m = String(timeStr).trim()
                .match(/^(\d{1,2})\s*[:.h]?\s*(\d{2})?\s*(?:([ap])\s*\.?\s*m?\s*\.?)?\s*$/i);
            if (!m) return fallback;

            let hours = parseInt(m[1], 10);
            const minutes = m[2] ? parseInt(m[2], 10) : 0;
            const meridiem = m[3] ? m[3].toLowerCase() : null;

            if (isNaN(hours) || isNaN(minutes) || minutes > 59) return fallback;
            if (meridiem === 'p' && hours < 12) hours += 12;
            if (meridiem === 'a' && hours === 12) hours = 0;
            if (hours > 23) return fallback;

            return { hours, minutes, ok: true };
        }

        function getEventStart() {
            const parts = (invitationData.date || '2027-04-17').split('-');
            const { hours, minutes } = parseEventTime(invitationData.time);
            return new Date(parts[0], parts[1] - 1, parts[2], hours, minutes, 0, 0);
        }

        function getEventEnd() {
            const end = getEventStart();
            end.setHours(end.getHours() + EVENT_DURATION_HOURS);
            return end;
        }

        // Calendar timestamp in "floating" local form (YYYYMMDDTHHMMSS, no
        // trailing Z). Deliberately not UTC: we don't know the venue's timezone,
        // and a floating time shows up in the guest's calendar as the wall-clock
        // time the couple actually typed. The old code appended Z, which turned
        // a 4pm California ceremony into a 9am one.
        function toCalendarStamp(d) {
            const p = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
        }

        // The browser tab and bookmark name. Not what drives link previews —
        // crawlers don't run scripts, so those come from the meta tags in the
        // head. Guests should never see the word "Builder".
        function updateDocumentTitle() {
            const couple = `${invitationData.partner1} & ${invitationData.partner2}`;
            document.title = (invitationData.isGuestView || isGuestModeActive)
                ? `${couple} • ${formatDateDisplay(invitationData.date)}`
                : `${couple} — Invitation Builder`;
        }

        function handleImageUpload(e, targetInputId) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    document.getElementById(targetInputId).value = evt.target.result;
                    updateInvitationFromInputs();
                };
                reader.readAsDataURL(file);
            }
        }

        /* REALISTIC MULTI-STAGE ENVELOPE UNSEALING */
        function openEnvelope() {
            const box = document.getElementById('envelope-box-el');
            const overlay = document.getElementById('envelope-overlay');
            const hint = document.getElementById('envelope-hint-text');

            if (box.classList.contains('envelope-open')) return;

            box.classList.add('envelope-open');
            if (hint) hint.innerText = hint.getAttribute('data-hint-opening') || 'Opening invitation...';

            // How long the reveal animation runs before the overlay starts to
            // fade, and how long that fade takes. Every design animates its
            // reveal differently — gates sweeping apart take longer than an
            // envelope flap lifting — so the timings are read from the markup
            // rather than fixed here. Defaults match the original envelope.
            const revealMs = parseInt(overlay.getAttribute('data-reveal-ms'), 10) || 1450;
            const fadeMs = parseInt(overlay.getAttribute('data-fade-ms'), 10) || 1000;

            // Stage 2: reveal finishes, overlay fades out
            setTimeout(() => {
                overlay.classList.add('opacity-0', 'pointer-events-none');

                // Stage 3: once the 1s fade has actually finished, take the
                // overlay out of the tab order and the accessibility tree. It
                // stays in the DOM so it can be re-sealed, but an invisible
                // focusable envelope layered over the invitation traps anyone
                // navigating by keyboard or screen reader.
                setTimeout(() => {
                    overlay.classList.add('envelope-overlay-hidden');
                    overlay.setAttribute('aria-hidden', 'true');

                    const scene = document.querySelector('.envelope-3d-scene');
                    if (scene) scene.setAttribute('tabindex', '-1');

                    // Hand focus to the invitation itself, so the next Tab
                    // continues into the page rather than starting over.
                    const main = document.querySelector('main');
                    if (main) {
                        main.setAttribute('tabindex', '-1');
                        main.focus({ preventScroll: true });
                    }
                }, fadeMs);
            }, revealMs);
        }

        function handleEnvelopeKeydown(e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault(); // stop Space from scrolling the page behind the overlay
                openEnvelope();
            }
        }

        function resetEnvelopeIntro() {
            const box = document.getElementById('envelope-box-el');
            const overlay = document.getElementById('envelope-overlay');
            const hint = document.getElementById('envelope-hint-text');

            box.classList.remove('envelope-open');
            overlay.classList.remove('opacity-0', 'pointer-events-none', 'envelope-overlay-hidden');
            overlay.removeAttribute('aria-hidden');

            const scene = document.querySelector('.envelope-3d-scene');
            if (scene) scene.setAttribute('tabindex', '0');

            if (hint) hint.innerText = hint.getAttribute('data-hint') || 'Tap or press Enter to unseal';
        }

        // The drawer was one continuous scroll roughly nine screens long,
        // most of it the schedule section. Each group becomes a tab instead.
        //
        // The tabs are built from the groups themselves — their heading text
        // and icon — rather than from a hardcoded list, so a design can add,
        // rename or reorder sections and the tab bar follows without anyone
        // touching this function.
        function initDrawerTabs() {
            const drawer = document.getElementById('customizer-drawer');
            if (!drawer) return;

            const scroller = drawer.querySelector('.overflow-y-auto');
            if (!scroller || scroller.dataset.tabbed === 'true') return;

            const groups = Array.from(scroller.children).filter(el => el.querySelector('h4'));
            if (groups.length < 2) return;

            const bar = document.createElement('div');
            bar.className = 'drawer-tabs';
            bar.setAttribute('role', 'tablist');

            groups.forEach((group, i) => {
                const heading = group.querySelector('h4');
                const iconEl = heading.querySelector('i');
                const labelEl = heading.querySelector('span');
                const label = (labelEl || heading).textContent.trim();

                // Keep only the fa-* names; the sizing classes on the heading
                // icon would make the tab icons tiny.
                const iconClasses = iconEl
                    ? (iconEl.className.match(/\bfa-[a-z0-9-]+/g) || ['fa-circle']).join(' ')
                    : 'fa-circle';

                group.classList.add('drawer-panel');
                if (!group.id) group.id = 'drawer-panel-' + i;
                group.hidden = i !== 0;
                heading.hidden = true; // the tab carries the label now

                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'drawer-tab' + (i === 0 ? ' is-active' : '');
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
                tab.setAttribute('aria-controls', group.id);
                tab.title = label;
                tab.innerHTML = '<i class="fas ' + iconClasses + '" aria-hidden="true"></i><span></span>';
                tab.querySelector('span').textContent = label;
                tab.addEventListener('click', () => showDrawerPanel(i));
                bar.appendChild(tab);
            });

            scroller.parentNode.insertBefore(bar, scroller);
            scroller.dataset.tabbed = 'true';
        }

        function showDrawerPanel(index) {
            const drawer = document.getElementById('customizer-drawer');
            if (!drawer) return;
            const panels = drawer.querySelectorAll('.drawer-panel');
            const tabs = drawer.querySelectorAll('.drawer-tab');

            panels.forEach((p, i) => { p.hidden = i !== index; });
            tabs.forEach((t, i) => {
                t.classList.toggle('is-active', i === index);
                t.setAttribute('aria-selected', i === index ? 'true' : 'false');
            });

            const scroller = drawer.querySelector('.overflow-y-auto');
            if (scroller) scroller.scrollTop = 0;
        }

        function toggleCustomizerDrawer() {
            const drawer = document.getElementById('customizer-drawer');
            const opening = drawer.classList.contains('translate-x-full');

            // Built on first open rather than at load, so any sections a
            // design renders dynamically are already in place.
            if (opening) initDrawerTabs();

            drawer.classList.toggle('translate-x-full');

            // Narrow the invitation rather than covering it, so the couple
            // can watch their edits land. wedding-ui.css only honours this
            // above 1100px — on anything narrower there isn't room for both
            // and the drawer stays an overlay.
            document.body.classList.toggle('editor-open', opening);
        }

        function updateCountdown() {
            const diff = getEventStart().getTime() - Date.now();

            const set = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.innerText = String(value).padStart(2, '0');
            };

            // Once the day arrives the clock has nothing left to count. Leaving
            // the last computed numbers frozen on screen (as this used to) just
            // reads as a broken timer.
            if (diff <= 0) {
                set('cd-days', 0);
                set('cd-hours', 0);
                set('cd-minutes', 0);
                set('cd-seconds', 0);
                return;
            }

            set('cd-days', Math.floor(diff / (1000 * 60 * 60 * 24)));
            set('cd-hours', Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
            set('cd-minutes', Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
            set('cd-seconds', Math.floor((diff % (1000 * 60)) / 1000));
        }
        setInterval(updateCountdown, 1000);

        /* ENHANCED READY PRODUCT SHARE & LINK GENERATION */
        function openShareModal() {
            const cleanData = { ...invitationData, isGuestView: true };

            // An uploaded photo is a base64 data URL that can easily run
            // 100KB+ on its own — far too big to put in a URL. Fall back to
            // the default stock photo for the *link* specifically; the
            // downloadable file above still has the couple's real photo.
            if (cleanData.heroPhoto && cleanData.heroPhoto.length > 2000) {
                cleanData.heroPhoto = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1000";
            }
            // Same story for the photo gallery — any uploaded images would
            // make the link unusably long (or outright break in some apps),
            // so the link carries everything *except* photos. Guests still
            // get the full gallery once the file is properly hosted.
            if (Array.isArray(cleanData.gallery) && cleanData.gallery.length > 0) {
                cleanData.gallery = [];
            }

            const json = JSON.stringify(cleanData);
            const payload = (typeof LZString !== 'undefined')
                ? LZString.compressToEncodedURIComponent(json)
                : btoa(unescape(encodeURIComponent(json))); // fallback if the CDN script failed to load

            let shareUrl = "";
            let currentHref = window.location.href;

            try {
                if (window.parent && window.parent.location && window.parent.location.href) {
                    currentHref = window.parent.location.href;
                }
            } catch (e) {
                // Cross-origin restriction
            }

            const warningEl = document.getElementById('sandbox-domain-warning');

            if (currentHref && (currentHref.startsWith('http://') || currentHref.startsWith('https://')) && !currentHref.includes('example.com') && !currentHref.includes('about:srcdoc')) {
                const baseUrl = currentHref.split('#')[0];
                shareUrl = `${baseUrl}#view=guest&lz=${payload}`;
                if (warningEl) warningEl.classList.add('hidden');
            } else {
                shareUrl = `https://your-custom-wedding-domain.com/#view=guest&lz=${payload}`;
                if (warningEl) warningEl.classList.remove('hidden');
            }

            document.getElementById('share-url-input').value = shareUrl;
            document.getElementById('share-modal').classList.remove('hidden');
        }

        function closeShareModal() {
            document.getElementById('share-modal').classList.add('hidden');
        }

        function copyShareUrl() {
            const input = document.getElementById('share-url-input');
            if (input) {
                input.select();
                try {
                    document.execCommand('copy');
                } catch (e) {
                    console.error('Copy to clipboard failed:', e);
                }
            }
            const toast = document.getElementById('copy-toast');
            if (toast) {
                toast.classList.remove('hidden');
                setTimeout(() => {
                    toast.classList.add('hidden');
                }, 3000);
            }
        }

        // Saves the full invitation (including real photos) to this site's
        // storage via a backend function, and gets back a short link built
        // from a small ID rather than the data itself — so it stays short
        // no matter how much content the invitation has.
        async function saveInvitationAndGetShortLink() {
            const btn = document.getElementById('save-short-link-btn');
            const statusEl = document.getElementById('short-link-status');
            const resultEl = document.getElementById('short-link-result');
            const originalBtnHtml = btn.innerHTML;

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Saving…</span>';
            if (statusEl) { statusEl.classList.add('hidden'); statusEl.classList.remove('text-red-600', 'text-emerald-700'); }
            if (resultEl) resultEl.classList.add('hidden');

            const cleanData = { ...invitationData, isGuestView: true };

            try {
                const response = await fetch('/.netlify/functions/save-invitation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cleanData)
                });

                if (!response.ok) {
                    const errBody = await response.json().catch(() => ({}));
                    throw new Error(errBody.error || `Request failed (${response.status})`);
                }

                const { id } = await response.json();
                if (!id) throw new Error('No ID returned from server');

                let baseHref = window.location.href;
                try {
                    if (window.parent && window.parent.location && window.parent.location.href) {
                        baseHref = window.parent.location.href;
                    }
                } catch (e) {}
                const baseUrl = baseHref.split('#')[0].split('?')[0];

                const shortUrl = `${baseUrl}?id=${id}`;
                const input = document.getElementById('short-link-input');
                if (input) input.value = shortUrl;
                if (resultEl) resultEl.classList.remove('hidden');

                if (statusEl) {
                    statusEl.textContent = 'Saved! Copy the link below to share it.';
                    statusEl.classList.remove('hidden');
                    statusEl.classList.add('text-emerald-700');
                }
            } catch (err) {
                console.error('Failed to save invitation:', err);
                if (statusEl) {
                    statusEl.textContent = `Couldn't save: ${err.message}`;
                    statusEl.classList.remove('hidden');
                    statusEl.classList.add('text-red-600');
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        }

        function copyShortLink() {
            const input = document.getElementById('short-link-input');
            if (input) {
                input.select();
                try {
                    document.execCommand('copy');
                } catch (e) {
                    console.error('Copy to clipboard failed:', e);
                }
            }
        }


        // The exported file has to stand completely alone — someone may open it
        // straight from their Downloads folder, with no server and no sibling
        // files. Now that the CSS and JS live in their own files, they have to
        // be pulled back inline at export time or the download would be a bare
        // skeleton. Local files can't be fetched from a file:// page, so this
        // only works from a served site; the caller reports that if it fails.
        async function inlineExternalAssets(cloneDoc) {
            const links = [...cloneDoc.querySelectorAll('link[rel="stylesheet"]')]
                .filter(el => {
                    const href = el.getAttribute('href') || '';
                    return href && !/^https?:\/\//i.test(href);
                });

            for (const link of links) {
                const css = await fetch(link.getAttribute('href')).then(r => {
                    if (!r.ok) throw new Error(`${link.getAttribute('href')} (${r.status})`);
                    return r.text();
                });
                const style = cloneDoc.ownerDocument.createElement('style');
                style.textContent = css;
                link.replaceWith(style);
            }

            const scripts = [...cloneDoc.querySelectorAll('script[src]')]
                .filter(el => {
                    const src = el.getAttribute('src') || '';
                    return src && !/^https?:\/\//i.test(src);
                });

            for (const script of scripts) {
                const js = await fetch(script.getAttribute('src')).then(r => {
                    if (!r.ok) throw new Error(`${script.getAttribute('src')} (${r.status})`);
                    return r.text();
                });
                const inline = cloneDoc.ownerDocument.createElement('script');
                inline.textContent = js;
                script.replaceWith(inline);
            }
        }

        async function downloadStandaloneHTML() {
            // Prepare a read-only payload baked directly into the standalone file
            const guestData = { ...invitationData, isGuestView: true };
            
            // Clone current DOM to manipulate for export
            const cloneDoc = document.documentElement.cloneNode(true);
            
            // Remove builder tools completely from the standalone guest HTML
            const builderBar = cloneDoc.querySelector('#builder-bar');
            const customizerDrawer = cloneDoc.querySelector('#customizer-drawer');
            const shareModal = cloneDoc.querySelector('#share-modal');
            const exitBtn = cloneDoc.querySelector('#exit-preview-btn');
            
            if (builderBar) builderBar.remove();
            if (customizerDrawer) customizerDrawer.remove();
            if (shareModal) shareModal.remove();
            if (exitBtn) exitBtn.remove();

            // Make sure the exported file always opens with a sealed envelope,
            // even if the couple left it open while editing in the builder
            const cloneEnvelopeBox = cloneDoc.querySelector('#envelope-box-el');
            const cloneOverlay = cloneDoc.querySelector('#envelope-overlay');
            const cloneHint = cloneDoc.querySelector('#envelope-hint-text');
            if (cloneEnvelopeBox) cloneEnvelopeBox.classList.remove('envelope-open');
            if (cloneOverlay) {
                cloneOverlay.classList.remove('opacity-0', 'pointer-events-none', 'envelope-overlay-hidden');
                cloneOverlay.removeAttribute('aria-hidden');
            }
            const cloneScene = cloneDoc.querySelector('.envelope-3d-scene');
            if (cloneScene) cloneScene.setAttribute('tabindex', '0');
            if (cloneHint) cloneHint.innerText = cloneHint.getAttribute('data-hint') || 'Tap or press Enter to unseal';

            // Reset header top position for standalone view
            const header = cloneDoc.querySelector('header');
            if (header) {
                header.classList.remove('top-12');
                header.classList.add('top-0');
            }

            // Inject the guest-ready data directly into the DOM clone by
            // targeting the dedicated script element itself — this can never
            // mismatch, unlike searching the serialized text for a pattern
            // (which breaks once this same code also appears elsewhere, e.g.
            // inside this very function's own source once cloned).
            const dataScriptEl = cloneDoc.querySelector('#invitation-data-script');
            if (dataScriptEl) {
                dataScriptEl.textContent = `let invitationData = ${JSON.stringify(guestData, null, 4)};`;
            }

            // Must happen before serialising, so the saved file carries its own
            // styling and behaviour rather than pointing at files that won't be
            // sitting next to it.
            try {
                await inlineExternalAssets(cloneDoc);
            } catch (err) {
                console.error('Could not inline the design files for export:', err);
                alert(
                    "Couldn't build the standalone file because the design files couldn't be read.\n\n" +
                    "This works from the published site, but not when index.html is opened directly " +
                    "from your computer — browsers block reading neighbouring files that way.\n\n" +
                    "Publish the site and export from there."
                );
                return;
            }

            let fullDoc = "<!DOCTYPE html>\n<html lang=\"en\" class=\"scroll-smooth\">\n" + cloneDoc.innerHTML + "\n</html>";

            const fileName = `${invitationData.partner1}_and_${invitationData.partner2}_Wedding_Invitation.html`;

            try {
                const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8;' });
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            } catch (e) {
                const encodedUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(fullDoc);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

        function downloadICS() {
            const p1 = invitationData.partner1;
            const p2 = invitationData.partner2;

            // RFC 5545 escaping for TEXT values. An unescaped comma or semicolon
            // in a venue name ("Sonoma Estate, Gardens") silently truncates the
            // field in most calendar apps.
            const esc = (s) => String(s == null ? '' : s)
                .replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\r?\n/g, '\\n');

            // UID and DTSTAMP are required by the spec — without them Outlook
            // and some Google import paths reject the file outright. The whole
            // thing is CRLF-delimited for the same reason.
            const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@wedding-invitation`;
            const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

            const icsData = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Wedding Invitation//EN',
                'CALSCALE:GREGORIAN',
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${dtstamp}`,
                `SUMMARY:${esc(`${p1} & ${p2} Wedding`)}`,
                `DESCRIPTION:${esc(`Celebrating the wedding of ${p1} and ${p2}!`)}`,
                `LOCATION:${esc(`${invitationData.venueName}, ${invitationData.venueAddress}`)}`,
                `DTSTART:${toCalendarStamp(getEventStart())}`,
                `DTEND:${toCalendarStamp(getEventEnd())}`,
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\r\n');

            const fileName = `${p1}_and_${p2}_Wedding.ics`;

            // iOS Safari ignores the download attribute on a blob: URL, so the
            // anchor-click below silently does nothing on an iPhone — the button
            // just appears dead. Opening the calendar data instead lets iOS
            // recognise the text/calendar type and show its "Add to Calendar"
            // sheet. iPadOS reports itself as a Mac, hence the touch-point check.
            const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

            if (isIOS) {
                const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
                const blobUrl = URL.createObjectURL(blob);

                // A new tab keeps the invitation open behind the import sheet.
                // If the popup is blocked, fall back to the current tab so the
                // button still does something.
                const opened = window.open(blobUrl, '_blank');
                if (!opened) window.location.href = blobUrl;

                // Kept alive well past the click — iOS needs the URL to still
                // resolve while the user is interacting with the import sheet.
                setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
                return;
            }

            try {
                const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            } catch (e) {
                const encodedUri = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsData);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

        // Shows the party-size / plus-one fields only when the guest is
        // actually attending — no point asking those questions otherwise.
        function handleRsvpAttendingChange() {
            const attending = document.querySelector('input[name="attending"]:checked');
            const extra = document.getElementById('rsvp-attending-extra-fields');
            if (!extra) return;
            extra.style.display = (attending && attending.value === 'yes') ? '' : 'none';
        }

        // The plus-one name field only appears once the party size is 2 or
        // more, and clears itself if the guest dials the count back down.
        function handleRsvpGuestCountChange() {
            const countEl = document.getElementById('rsvp-guest-count');
            const wrap = document.getElementById('rsvp-plusone-wrap');
            if (!countEl || !wrap) return;
            const count = parseInt(countEl.value, 10) || 1;
            const show = count >= 2;
            wrap.style.display = show ? '' : 'none';
            if (!show) {
                const nameInput = document.getElementById('rsvp-plusone-name');
                if (nameInput) nameInput.value = '';
            }

            /* Two seats asks for a name; three or more asks for names. Asking a
               party of four for "the name of your guest" reads as a mistake and
               quietly tells them only one companion is expected.

               THE COUPLE'S OWN WORDING ALWAYS WINS. The plural is only used when
               they have left the default wording in place, or when they have
               written a plural of their own in rsvpPlusOneLabelPlural. A design
               without this label element simply skips it. */
            const labelEl = document.getElementById('rsvpPlusOneLabel');
            if (!labelEl || !show) return;
            const DEFAULT_ONE = 'Name of your guest';
            const DEFAULT_MANY = 'Names of your guests';
            const d = (typeof invitationData === 'object' && invitationData) ? invitationData : {};
            const one = String(d.rsvpPlusOneLabel || '').trim();
            const many = String(d.rsvpPlusOneLabelPlural || '').trim();
            const usesDefaultWording = !one || one.toLowerCase() === DEFAULT_ONE.toLowerCase();
            labelEl.textContent = (count >= 3)
                ? (many || (usesDefaultWording ? DEFAULT_MANY : one))
                : (one || DEFAULT_ONE);

            /* The placeholder follows the same rule, so the field never says
               "Also in the credits…" in the singular for a table of six. */
            const nameInput = document.getElementById('rsvp-plusone-name');
            if (nameInput && nameInput.dataset.plural !== undefined && count >= 3) {
                nameInput.placeholder = nameInput.dataset.plural;
            } else if (nameInput && nameInput.dataset.singular !== undefined) {
                nameInput.placeholder = nameInput.dataset.singular;
            }
        }

        function submitRSVP(e) {
            e.preventDefault();
            const form = document.getElementById('rsvp-form');
            const submitBtn = form.querySelector('button[type="submit"]');
            const errorEl = document.getElementById('rsvp-error');
            const originalBtnText = submitBtn.innerHTML;

            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Sending…';
            if (errorEl) errorEl.classList.add('hidden');

            const body = new URLSearchParams(new FormData(form)).toString();

            fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body
            })
                .then((response) => {
                    if (!response.ok) throw new Error('Network response was not ok');

                    const attendingEl = form.querySelector('input[name="attending"]:checked');
                    const isDeclining = attendingEl && attendingEl.value === 'no';

                    const headingEl = document.getElementById('rsvp-success-heading');
                    const msgEl = document.getElementById('rsvp-success-message');
                    const iconEl = document.getElementById('rsvp-success-icon');

                    if (isDeclining) {
                        if (headingEl) headingEl.textContent = "You'll Be Missed!";
                        if (msgEl) msgEl.textContent = "Thank you for letting us know. We're sorry you can't celebrate with us, but we'll be thinking of you on our big day!";
                        if (iconEl) { iconEl.classList.remove('fa-check'); iconEl.classList.add('fa-heart'); }
                    } else {
                        if (headingEl) headingEl.textContent = 'Thank You!';
                        if (msgEl) msgEl.textContent = 'Your response has been saved. We look forward to celebrating with you!';
                        if (iconEl) { iconEl.classList.remove('fa-heart'); iconEl.classList.add('fa-check'); }
                    }

                    document.getElementById('rsvp-form').classList.add('hidden');
                    document.getElementById('rsvp-success').classList.remove('hidden');

                    if (!isDeclining && typeof confetti === 'function') {
                        confetti({
                            particleCount: 80,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#C5A880', '#E3CDA4', '#FAF8F5']
                        });
                    }
                })
                .catch((err) => {
                    console.error('RSVP submission failed:', err);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                    if (errorEl) errorEl.classList.remove('hidden');
                });
        }

        /* ============================================================
           STUDIO BAR — the compact icon row (from design-7, Mirror Palace)

           Shared, so every design gets the same editor chrome instead of
           each one restyling the bar. Lives here rather than in a design's
           own CSS because two designs ship no design.js at all.

           IT FAILS SAFE, and that is the whole point of the gate below.
           The compact layout hides each button's real label (font-size:0)
           and prints a short form from data-short. If the short form is
           ever missing, the result is a row of unlabelled icons - so the
           class that switches the layout on is only added once every
           button has been given one. A design this cannot label keeps the
           wide bar it already had.

           Labels are derived, not looked up from a fixed table: design-4
           says "See guest view" and "Download for guests" where design-8
           says "Preview Guest View" and "Export Read-Only File". Matching
           on intent, with the first word as a last resort, means a new
           design gets sensible labels without being added to a list. */
        function labelStudioBar() {
            const bar = document.getElementById('builder-bar');
            if (!bar) return;
            const buttons = Array.from(bar.querySelectorAll('button'));
            if (!buttons.length) return;

            const RULES = [
                [/preview|guest view|back to builder/i, 'Preview'],
                [/customi|edit/i,       'Edit'],
                [/replay|opening|envelope/i, 'Replay'],
                [/export|download|share/i, 'Export'],
                [/couple|details/i,     'Couple']
            ];

            let labelled = 0;
            buttons.forEach(btn => {
                let span = btn.querySelector('span');

                /* THE SPAN IS NOT GUARANTEED TO SURVIVE.

                   enableGuestMode() rewrites this button wholesale on every
                   toggle - `<i class="..."></i> Back to Builder` - which
                   replaces the span with a bare text node. The compact bar
                   hides the button's own text at font-size:0 and prints the
                   label out of span[data-short], so the moment that span
                   goes, the button is an icon with no name. That is exactly
                   what came back from preview: an eye and nothing else.

                   So rather than assume a span, put one back: adopt the
                   button's bare text into one. Costs nothing when the markup
                   already has it, and survives any rewrite the core does. */
                if (!span) {
                    const textNode = Array.from(btn.childNodes)
                        .find(n => n.nodeType === 3 && n.textContent.trim());
                    if (!textNode) return;
                    span = document.createElement('span');
                    span.textContent = textNode.textContent.trim();
                    btn.replaceChild(span, textNode);
                }

                const full = (span.textContent || '').trim();
                if (!full) return;

                let short = '';
                for (const [test, label] of RULES) {
                    if (test.test(full)) { short = label; break; }
                }
                /* Last resort: the first word, which is nearly always the verb. */
                if (!short) {
                    const first = full.split(/\s+/)[0] || '';
                    short = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
                }
                if (!short) return;

                span.dataset.short = short;
                /* The full wording stays in the DOM, so the accessible name a
                   screen reader announces is still the long explicit one; it
                   becomes the tooltip too, so hovering explains a short label. */
                btn.title = full;
                btn.toggleAttribute('data-primary', short === 'Edit');
                labelled++;
            });

            if (labelled === buttons.length) bar.classList.add('studio-compact');
        }

        /* Re-label whenever anything rewrites the bar. The core swaps button
           contents for guest mode and again for the "Saving…" state, and a
           label that only survives until the first toggle is not a label.

           Guarded and deferred, because labelling mutates the very subtree
           being observed - without the flag this feeds itself. */
        function watchStudioBar() {
            const bar = document.getElementById('builder-bar');
            if (!bar || !window.MutationObserver) return;
            let queued = false;
            new MutationObserver(() => {
                if (queued) return;
                queued = true;
                /* setTimeout, not requestAnimationFrame: rAF does not fire in a
                   backgrounded tab, and a label that only repairs itself once
                   the tab is looked at is a label that is broken when it
                   matters. Timers still run. */
                setTimeout(() => { queued = false; labelStudioBar(); }, 0);
            }).observe(bar, { childList: true, subtree: true });
        }

        function initStudioBar(){ labelStudioBar(); watchStudioBar(); }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initStudioBar);
        } else {
            initStudioBar();
        }
