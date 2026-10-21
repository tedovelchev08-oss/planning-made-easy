/* ============================================================
   CELESTIAL — the real sky, computed

   This design's one idea: the chart on the invitation is not a drawn
   constellation, it is the northern sky as it actually stood above the
   couple on their wedding evening, and the moon shown is the moon that
   was actually up that night. Both come from the date and time already
   entered in the builder — nothing extra is asked of the couple.

   Only this design loads this file. wedding-core.js knows nothing about
   it, and the other designs are unaffected.

   On the one approximation: the ceremony time is treated as local mean
   solar time at the venue's meridian. Doing that makes longitude cancel
   out of the sidereal-time formula, so the chart needs no coordinates.
   Real clocks run on zone time, so the sky can be rotated by up to half
   a timezone — about 7 degrees. At this size that is a star's width.
   ============================================================ */

(function () {
    'use strict';

    var SYNODIC = 29.530588853;      // mean lunar month, days
    var NEW_MOON_JD = 2451550.1;     // a known new moon: 2000-01-06 18:14 UT
    var J2000 = 2451545.0;

    /* Bright northern stars, J2000. [name, right ascension (hours),
       declination (degrees), visual magnitude]. Only declination 0 and
       above — this is a north-polar chart, so the celestial equator is
       its rim and the southern sky is simply not on it. */
    var STARS = [
        ['Polaris',      2.530, 89.264, 1.98], ['Kochab',     14.845, 74.155, 2.08],
        ['Pherkad',     15.345, 71.834, 3.05], ['DeltaUMi',   17.537, 86.586, 4.36],
        ['EpsilonUMi',  16.766, 82.037, 4.23], ['ZetaUMi',    15.734, 77.794, 4.32],
        ['EtaUMi',      16.291, 75.755, 4.95],

        ['Dubhe',       11.062, 61.751, 1.79], ['Merak',      11.031, 56.382, 2.37],
        ['Phecda',      11.897, 53.695, 2.44], ['Megrez',     12.257, 57.033, 3.31],
        ['Alioth',      12.900, 55.960, 1.77], ['Mizar',      13.399, 54.925, 2.23],
        ['Alkaid',      13.792, 49.313, 1.86],

        ['Schedar',      0.675, 56.537, 2.24], ['Caph',        0.153, 59.150, 2.28],
        ['GammaCas',     0.945, 60.717, 2.47], ['Ruchbah',     1.430, 60.235, 2.68],
        ['EpsilonCas',   1.907, 63.670, 3.38],

        ['Deneb',       20.690, 45.280, 1.25], ['Sadr',       20.371, 40.257, 2.23],
        ['Albireo',     19.512, 27.960, 3.08], ['DeltaCyg',   19.750, 45.131, 2.87],
        ['Gienah',      20.770, 33.970, 2.48],

        ['Vega',        18.615, 38.784, 0.03], ['Altair',     19.846,  8.868, 0.76],
        ['Capella',      5.278, 45.998, 0.08], ['Arcturus',   14.261, 19.182, -0.05],

        ['Castor',       7.577, 31.888, 1.58], ['Pollux',      7.755, 28.026, 1.14],
        ['Betelgeuse',   5.919,  7.407, 0.50], ['Bellatrix',   5.418,  6.350, 1.64],

        ['Mirfak',       3.405, 49.861, 1.79], ['Algol',       3.136, 40.956, 2.09],
        ['Alpheratz',    0.140, 29.090, 2.06], ['Mirach',      1.162, 35.620, 2.06],
        ['Almach',       2.065, 42.330, 2.10],

        ['Eltanin',     17.943, 51.489, 2.23], ['Rastaban',   17.507, 52.301, 2.79],
        ['Thuban',      14.073, 64.376, 3.65], ['Edasich',    15.415, 58.966, 3.29],

        ['Alphecca',    15.578, 26.715, 2.22], ['Regulus',    10.140, 11.967, 1.40],
        ['Denebola',    11.818, 14.572, 2.14], ['Algieba',    10.333, 19.841, 2.08],

        ['Aldebaran',    4.599, 16.509, 0.85], ['Elnath',      5.438, 28.608, 1.65],
        ['CorCaroli',   12.934, 38.318, 2.89], ['Kornephoros', 16.504, 21.490, 2.77],
        ['ZetaHer',     16.688, 31.603, 2.81], ['Rasalhague',  17.582, 12.560, 2.08],

        ['Markab',      23.079, 15.205, 2.48], ['Scheat',     23.063, 28.083, 2.42],
        ['Algenib',      0.220, 15.184, 2.83], ['Alderamin',  21.309, 62.585, 2.45],
        ['BetaCep',     21.477, 70.561, 3.23], ['GammaCep',   23.656, 77.632, 3.21],
        ['Unukalhai',   15.738,  6.426, 2.63]
    ];

    /* Real asterisms, not decorative joins. The Plough and Cassiopeia's W
       are the two shapes almost anyone can pick out, and the Summer
       Triangle spans three constellations, so between them something
       recognisable is on the chart whatever the date. */
    var LINES = [
        ['Alkaid', 'Mizar'], ['Mizar', 'Alioth'], ['Alioth', 'Megrez'],
        ['Megrez', 'Phecda'], ['Phecda', 'Merak'], ['Merak', 'Dubhe'], ['Dubhe', 'Megrez'],

        ['Polaris', 'DeltaUMi'], ['DeltaUMi', 'EpsilonUMi'], ['EpsilonUMi', 'ZetaUMi'],
        ['ZetaUMi', 'EtaUMi'], ['EtaUMi', 'Pherkad'], ['Pherkad', 'Kochab'], ['Kochab', 'ZetaUMi'],

        ['Caph', 'Schedar'], ['Schedar', 'GammaCas'], ['GammaCas', 'Ruchbah'], ['Ruchbah', 'EpsilonCas'],

        ['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['DeltaCyg', 'Sadr'], ['Sadr', 'Gienah'],

        ['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega']
    ];

    var byName = {};
    STARS.forEach(function (s) { byName[s[0]] = s; });

    /* ---------- time ---------- */

    // Reads "4:00 PM", "16:00", "7.30 p.m." — the core already solves this,
    // so use its parser when it is there rather than keeping a second one
    // that could drift out of step with it.
    function hoursFromTime(timeStr) {
        if (typeof parseEventTime === 'function') {
            var p = parseEventTime(timeStr);
            return p.hours + p.minutes / 60;
        }
        var m = String(timeStr || '').trim()
            .match(/^(\d{1,2})\s*[:.h]?\s*(\d{2})?\s*(?:([ap])\s*\.?\s*m?\s*\.?)?\s*$/i);
        if (!m) return 16;
        var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0;
        var mer = m[3] ? m[3].toLowerCase() : null;
        if (mer === 'p' && h < 12) h += 12;
        if (mer === 'a' && h === 12) h = 0;
        return h + min / 60;
    }

    function julianDayStart(y, m, d) {
        if (m <= 2) { y -= 1; m += 12; }
        var A = Math.floor(y / 100);
        var B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
    }

    // Local sidereal time in hours. Longitude cancels because the clock
    // time is taken as local mean solar time — see the note at the top.
    function siderealHours(jd0, localHours) {
        var deg = (100.46 + 0.985647 * (jd0 - J2000) + 15 * localHours) % 360;
        if (deg < 0) deg += 360;
        return deg / 15;
    }

    function readEvent() {
        var data = (typeof invitationData === 'object' && invitationData) ? invitationData : {};
        var parts = String(data.date || '2027-04-17').split('-');
        var y = parseInt(parts[0], 10) || 2027;
        var m = parseInt(parts[1], 10) || 4;
        var d = parseInt(parts[2], 10) || 17;
        var h = hoursFromTime(data.time);
        var jd0 = julianDayStart(y, m, d);
        return { jd0: jd0, month: m, day: d, hours: h, jd: jd0 + h / 24, lst: siderealHours(jd0, h) };
    }

    /* ---------- the chart ---------- */

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var CX = 170, CY = 170, R = 150;

    // North-polar projection: declination 90 at the centre, 0 at the rim.
    // Hour angle puts whatever was crossing the meridian at the top.
    function project(raHours, decDeg, lstHours) {
        var r = R * (90 - decDeg) / 90;
        var angle = (lstHours - raHours) * 15 * Math.PI / 180;
        return { x: CX + r * Math.sin(angle), y: CY - r * Math.cos(angle) };
    }

    function el(name, attrs) {
        var n = document.createElementNS(SVG_NS, name);
        for (var k in attrs) { if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); }
        return n;
    }

    function drawSky(svg, lst) {
        while (svg.firstChild) { svg.removeChild(svg.firstChild); }

        // The rim is the celestial equator, so it is a real boundary and
        // worth drawing rather than a decorative ring.
        svg.appendChild(el('circle', {
            cx: CX, cy: CY, r: R, class: 'sky-rim',
            fill: 'none', stroke: 'currentColor'
        }));

        var lineGroup = el('g', { class: 'sky-lines' });
        var starGroup = el('g', { class: 'sky-stars-g' });
        svg.appendChild(lineGroup);
        svg.appendChild(starGroup);

        LINES.forEach(function (pair, i) {
            var a = byName[pair[0]], b = byName[pair[1]];
            if (!a || !b) return;
            var pa = project(a[1], a[2], lst), pb = project(b[1], b[2], lst);
            var path = el('path', {
                class: 'c-line', pathLength: 100,
                d: 'M' + pa.x.toFixed(1) + ' ' + pa.y.toFixed(1) +
                   ' L' + pb.x.toFixed(1) + ' ' + pb.y.toFixed(1)
            });
            path.style.animationDelay = (0.85 + i * 0.035).toFixed(3) + 's';
            lineGroup.appendChild(path);
        });

        // Brightest first. That is also the order they appear at dusk, so
        // the reveal is doing something true rather than just staggering.
        var sorted = STARS.slice().sort(function (p, q) { return p[3] - q[3]; });
        sorted.forEach(function (s, i) {
            var p = project(s[1], s[2], lst);
            var mag = s[3];
            var dot = el('circle', {
                class: 'c-star',
                cx: p.x.toFixed(1), cy: p.y.toFixed(1),
                // The floor was 0.6, which on a 260px mobile chart renders at
                // under half a pixel and simply vanishes. 0.95 stays visible
                // there while still leaving the magnitude steps distinct.
                r: Math.max(0.95, 2.8 - 0.5 * mag).toFixed(2)
            });
            dot.style.animationDelay = (0.1 + i * 0.022).toFixed(3) + 's';
            if (mag < 1.6) { dot.setAttribute('class', 'c-star c-star-bright'); }
            starGroup.appendChild(dot);
        });
    }

    /* ---------- the moon ---------- */

    function moonAge(jd) {
        var a = (jd - NEW_MOON_JD) % SYNODIC;
        return a < 0 ? a + SYNODIC : a;
    }

    function phaseName(age) {
        if (age < 1.85) return 'New Moon';
        if (age < 5.54) return 'Waxing Crescent';
        if (age < 9.23) return 'First Quarter';
        if (age < 12.91) return 'Waxing Gibbous';
        if (age < 16.61) return 'Full Moon';
        if (age < 20.30) return 'Waning Gibbous';
        if (age < 23.99) return 'Last Quarter';
        if (age < 27.68) return 'Waning Crescent';
        return 'New Moon';
    }

    // The lit limb is a half circle closed by a half ellipse. The ellipse's
    // width is the cosine of the phase angle, which is what makes the
    // terminator flatten to a straight line at the quarters.
    function moonPath(cx, cy, r, age) {
        var theta = 2 * Math.PI * age / SYNODIC;
        var rx = Math.abs(r * Math.cos(theta));
        var waxing = age < SYNODIC / 2;
        var gibbous = Math.cos(theta) < 0;
        var outer = waxing ? 1 : 0;
        var inner = gibbous ? outer : 1 - outer;
        return 'M ' + cx + ' ' + (cy - r) +
               ' A ' + r + ' ' + r + ' 0 0 ' + outer + ' ' + cx + ' ' + (cy + r) +
               ' A ' + rx.toFixed(2) + ' ' + r + ' 0 0 ' + inner + ' ' + cx + ' ' + (cy - r) + ' Z';
    }

    function drawMoon(age) {
        var svg = document.getElementById('moon-disc');
        if (!svg) return;
        var lit = (1 - Math.cos(2 * Math.PI * age / SYNODIC)) / 2;

        while (svg.firstChild) { svg.removeChild(svg.firstChild); }
        svg.appendChild(el('circle', { cx: 40, cy: 40, r: 30, class: 'moon-dark' }));
        if (lit > 0.01) {
            svg.appendChild(el('path', { d: moonPath(40, 40, 30, age), class: 'moon-lit' }));
        }
        svg.appendChild(el('circle', {
            cx: 40, cy: 40, r: 30, class: 'moon-edge', fill: 'none', stroke: 'currentColor'
        }));

        var nameEl = document.getElementById('moon-phase-name');
        var litEl = document.getElementById('moon-phase-lit');
        if (nameEl) nameEl.textContent = phaseName(age);
        if (litEl) litEl.textContent = Math.round(lit * 100) + '% lit';
    }

    /* ---------- meteor showers ----------
       The annual showers are fixed calendar events, so a wedding date either
       falls in one or it does not. Roughly a third do. When it does the page
       runs that shower and names it; the rest get sporadics, which is what a
       real sky gives you on an ordinary night.
       [name, peak month, peak day, window in days either side, rate] */
    var SHOWERS = [
        ['the Quadrantids',  1,  3, 3, 'strong'],
        ['the Lyrids',       4, 22, 4, 'light'],
        ['the Eta Aquariids',5,  6, 5, 'medium'],
        ['the Perseids',     8, 12, 6, 'strong'],
        ['the Orionids',    10, 21, 5, 'light'],
        ['the Leonids',     11, 17, 4, 'medium'],
        ['the Geminids',    12, 14, 5, 'strong']
    ];

    function activeShower(month, day) {
        for (var i = 0; i < SHOWERS.length; i++) {
            var s = SHOWERS[i];
            if (s[1] !== month) continue;
            if (Math.abs(day - s[2]) <= s[3]) {
                return { name: s[0], rate: s[4] };
            }
        }
        return null;
    }

    // Meteors are one absolutely positioned streak each, animated on transform
    // and opacity only, with long pauses between passes. Three at most, so the
    // sky stays a sky rather than a screensaver.
    function buildMeteors(shower) {
        var host = document.querySelector('.page-meteors');
        if (!host) return;
        while (host.firstChild) { host.removeChild(host.firstChild); }

        var count = shower ? (shower.rate === 'strong' ? 3 : 2) : 1;
        var period = shower ? (shower.rate === 'strong' ? 9 : 14) : 22;

        for (var i = 0; i < count; i++) {
            var m = document.createElement('span');
            m.className = 'page-meteor';
            m.style.top = (8 + i * 26) + '%';
            m.style.animationDuration = period + 's';
            m.style.animationDelay = (i * (period / count) + 2).toFixed(1) + 's';
            host.appendChild(m);
        }

        // Name it only when there is something to name. A line claiming a
        // shower on a date with none would be the exact opposite of the point.
        var label = document.getElementById('shower-note');
        if (label) {
            if (shower) {
                label.textContent = shower.name.charAt(0).toUpperCase() +
                    shower.name.slice(1) + ' were falling that night.';
                label.hidden = false;
            } else {
                label.hidden = true;
            }
        }
    }

    /* ---------- the sky turns as you scroll ----------
       The schedule ticks already show the sky turning 90 degrees across the
       evening. This does the same thing at page scale: scrolling from the
       ceremony down to the send-off rotates the starfield. Transform only, on
       layers that are already composited, so it costs a matrix update rather
       than a repaint. */
    function bindScrollSky() {
        var far = document.querySelector('.page-sky-far');
        var near = document.querySelector('.page-sky-near');
        var band = document.querySelector('.page-band');
        if (!far || !near) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        var ticking = false;

        function apply() {
            ticking = false;
            var doc = document.documentElement;
            var max = (doc.scrollHeight - doc.clientHeight) || 1;
            var p = Math.min(1, Math.max(0, (window.pageYOffset || doc.scrollTop) / max));

            // 90 degrees over the full scroll: the same arc the evening covers.
            var turn = p * 90;
            far.style.transform  = 'rotate(' + (turn * 0.45).toFixed(2) + 'deg) translate3d(0,' + (p * -40).toFixed(1) + 'px,0)';
            near.style.transform = 'rotate(' + turn.toFixed(2) + 'deg) translate3d(0,' + (p * -110).toFixed(1) + 'px,0)';
            // Only the delta. The base angle stays in CSS so the mobile media
            // query can steepen it without this overwriting the whole value.
            if (band) {
                band.style.setProperty('--band-turn', (turn * 0.3).toFixed(2) + 'deg');
            }
        }

        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; window.requestAnimationFrame(apply); }
        }, { passive: true });

        apply();
    }

    /* ---------- the rim, engraved ----------
       Hour marks of right ascension, which turn with the sky (so the rim is
       true for that night, not a decorative dial), and the night itself
       written round the top: where, when. */
    var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    function txt(v) { return String(v == null ? '' : v).trim(); }

    function inscription() {
        var data = (typeof invitationData === 'object' && invitationData) ? invitationData : {};
        var parts = txt(data.date).split('-');
        var bits = [];
        if (txt(data.venueName)) bits.push('Above ' + txt(data.venueName));
        if (parts.length === 3) {
            var dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
            bits.push(DAYS[dt.getDay()] + ' ' + (+parts[2]) + ' ' + MONTHS[+parts[1] - 1] + ' ' + parts[0]);
        }
        if (txt(data.time)) bits.push(txt(data.time));
        return bits.join('  ·  ');
    }

    function drawRing(lst) {
        var svg = document.getElementById('sky-ring');
        if (!svg) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        svg.appendChild(el('circle', { cx: CX, cy: CY, r: R + 8, class: 'rim2' }));
        for (var h = 0; h < 24; h += 0.5) {
            var major = h % 1 === 0;
            var a = (lst - h) * 15 * Math.PI / 180;
            var r1 = R + 1, r2 = R + (major ? 7 : 4);
            svg.appendChild(el('line', {
                class: 'tick' + (major ? ' major' : ''),
                x1: (CX + r1 * Math.sin(a)).toFixed(2), y1: (CY - r1 * Math.cos(a)).toFixed(2),
                x2: (CX + r2 * Math.sin(a)).toFixed(2), y2: (CY - r2 * Math.cos(a)).toFixed(2)
            }));
            if (h % 3 === 0) {
                var rt = R + 16;
                var t = el('text', {
                    class: 'hour', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
                    x: (CX + rt * Math.sin(a)).toFixed(2), y: (CY - rt * Math.cos(a)).toFixed(2)
                });
                t.textContent = h + 'h';
                svg.appendChild(t);
            }
        }
        // the inscription rides a circle over the top of the chart
        var rr = R + 32;
        var defs = el('defs', {});
        defs.appendChild(el('path', {
            id: 'ring-path',
            d: 'M ' + (CX - rr) + ' ' + CY + ' A ' + rr + ' ' + rr + ' 0 0 1 ' + (CX + rr) + ' ' + CY
        }));
        svg.appendChild(defs);
        var words = el('text', { class: 'inscr', 'text-anchor': 'middle' });
        var tp = el('textPath', { href: '#ring-path', startOffset: '50%' });
        tp.textContent = inscription().toUpperCase();
        words.appendChild(tp);
        svg.appendChild(words);
    }

    /* ---------- the evening, as the sky turns ----------
       The sky turns fifteen degrees an hour. Each moment of the day is
       marked on an arc at the angle the sky had turned since the first one,
       so the gaps are true: a long dinner is a long stretch of arc. */
    function drawDial() {
        var svg = document.getElementById('evening-dial');
        var cap = document.getElementById('evening-turn');
        if (!svg) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        var data = (typeof invitationData === 'object' && invitationData) ? invitationData : {};
        var items = (data.schedule || []).filter(function (s) { return s && txt(s.title); });
        if (!items.length) { if (cap) cap.textContent = ''; return; }

        var hours = items.map(function (s) { return hoursFromTime(s.time); });
        for (var i = 1; i < hours.length; i++) {
            while (hours[i] < hours[i - 1]) hours[i] += 24;   // past midnight
        }
        var turn = (hours[hours.length - 1] - hours[0]) * 15;   // degrees
        var scale = turn > 160 ? 160 / turn : 1;
        var span = turn * scale;
        var cx = 300, cy = 268, r = 236;
        function at(deg, rad) {
            var a = (-90 - span / 2 + deg * scale) * Math.PI / 180;   // 0 deg = straight up
            return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
        }
        function arc(from, to, rad) {
            var p = at(from, rad), q = at(to, rad);
            var large = Math.abs(to - from) * scale > 180 ? 1 : 0;
            return 'M ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' A ' + rad + ' ' + rad + ' 0 ' + large + ' 1 ' + q.x.toFixed(1) + ' ' + q.y.toFixed(1);
        }
        svg.appendChild(el('line', { class: 'hz', x1: 20, y1: cy, x2: 580, y2: cy }));
        svg.appendChild(el('path', { class: 'arc', d: 'M ' + (cx - r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy }));
        if (turn > 0) svg.appendChild(el('path', { class: 'arc-lit', d: arc(0, turn, r) }));
        hours.forEach(function (h, i) {
            var deg = (h - hours[0]) * 15;
            var p = at(deg, r), n = at(deg, r + 26), l = at(deg, r - 30);
            svg.appendChild(el('circle', { class: 'mk-glow', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 10 }));
            svg.appendChild(el('circle', { class: 'mk', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 3.6 }));
            var num = el('text', { class: 'num', x: n.x.toFixed(1), y: (n.y + 4).toFixed(1) });
            num.textContent = String(i + 1);
            svg.appendChild(num);
            var lbl = el('text', { class: 'lbl', x: l.x.toFixed(1), y: (l.y + 4).toFixed(1) });
            lbl.textContent = txt(items[i].time);
            svg.appendChild(lbl);
        });
        if (cap) {
            cap.textContent = items.length > 1 && turn > 0
                ? 'Between the first of these and the last, the sky turns ' + Math.round(turn) + '°.'
                : '';
        }
    }

    /* the photographs are laid flat as prints, so a tap enlarges one
       straight away rather than first turning a carousel to it */
    function bindPrints() {
        var track = document.getElementById('gallery-carousel-track');
        if (!track) return;
        track.addEventListener('click', function (e) {
            var item = e.target.closest && e.target.closest('.gallery-carousel-item');
            if (!item || typeof openGalleryLightbox !== 'function') return;
            var i = parseInt(item.getAttribute('data-gallery-index'), 10);
            var g = ((typeof invitationData === 'object' && invitationData.gallery) || [])[i];
            if (!g) return;
            e.preventDefault(); e.stopPropagation();
            openGalleryLightbox(g.id);
        }, true);
    }

    /* ---------- wiring ---------- */

    // Sidereal time, written out as a real clock reading. It is the number
    // that makes the chart checkable rather than decorative: anyone can look
    // it up for that date and time and get the same answer.
    function formatSidereal(h) {
        var hh = Math.floor(h);
        var mm = Math.round((h - hh) * 60);
        if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
        return ('0' + hh).slice(-2) + 'h ' + ('0' + mm).slice(-2) + 'm';
    }

    /* ---------- the sky turning through the evening ----------
       The sky turns 15 degrees an hour, so a 4pm ceremony and a 10pm send-off
       stand 90 degrees apart. Each event on the timeline gets a tick on its
       marker showing where the sky actually was at that hour. This is the
       honest version of what the moon phases used to pretend to do here:
       the marker now encodes something that genuinely changes across the
       evening, rather than a gradient that changed for the look of it. */
    function markScheduleRotation(ev) {
        var rows = document.querySelectorAll('#schedule-timeline .schedule-row');
        if (!rows.length) return;
        Array.prototype.forEach.call(rows, function (row) {
            var timeEl = row.querySelector('.schedule-time');
            if (!timeEl) return;
            var lst = siderealHours(ev.jd0, hoursFromTime(timeEl.textContent));
            row.style.setProperty('--sky-turn', (lst * 15).toFixed(1) + 'deg');
        });
    }

    // The core rebuilds the whole timeline whenever the couple edits an event
    // and offers no hook to run afterwards, so watch the container instead.
    // childList only: writing a custom property onto a child is an attribute
    // mutation, so this cannot re-trigger itself.
    function observeSchedule() {
        var host = document.getElementById('schedule-timeline');
        if (!host || typeof MutationObserver === 'undefined') return;
        new MutationObserver(function () {
            markScheduleRotation(readEvent());
        }).observe(host, { childList: true });
    }

    function render() {
        var ev = readEvent();
        markScheduleRotation(ev);

        // Two charts share one computation: the reveal's and the keepsake's
        // in the page. Same sky, drawn twice, styled differently.
        ['sky-chart', 'sky-chart-keepsake'].forEach(function (id) {
            var svg = document.getElementById(id);
            if (svg) drawSky(svg, ev.lst);
        });

        drawRing(ev.lst);
        drawDial();
        drawMoon(moonAge(ev.jd));
        buildMeteors(activeShower(ev.month, ev.day));

        var lstEl = document.getElementById('sky-lst');
        if (lstEl) lstEl.textContent = formatSidereal(ev.lst);
    }

    // The core rebuilds from the inputs on every keystroke but has no hook
    // to call afterwards, so this listens to the two fields the sky depends
    // on. Anything else the couple types cannot change the sky.
    function bind() {
        ['cfg-date', 'cfg-time'].forEach(function (id) {
            var input = document.getElementById(id);
            if (input) { input.addEventListener('input', render); input.addEventListener('change', render); }
        });
        observeSchedule();
        bindScrollSky();
        bindPrints();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }

    // Guest links and short links load their data asynchronously, after
    // DOMContentLoaded has already gone. Redraw once that has landed.
    window.addEventListener('load', render);
    window.renderCelestialSky = render;

    /* LUMA: the couple's details arrive from Luma after the page loads, and
       on a slow connection after the load event too, which left the chart
       drawn for the sample date. Redraw after every render the engine does
       with their data. */
    var afterRender = window.lumaAfterRender;
    window.lumaAfterRender = function (d) {
        if (typeof afterRender === 'function') afterRender(d);
        render();
    };
})();
