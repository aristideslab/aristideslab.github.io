/* ==========================================================================
   ARISTIDES LAB — section state machine + the LiDAR field background
   ========================================================================== */
(function () {
    'use strict';

    var SECTIONS = ['index', 'portfolio', 'apps', 'links', 'skills', 'contact'];
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var titles = Array.prototype.slice.call(document.querySelectorAll('.title'));
    var frames = Array.prototype.slice.call(document.querySelectorAll('.frame'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
    var dots   = Array.prototype.slice.call(document.querySelectorAll('.dot'));

    var current = -1;
    var locked = false;

    /* ---------------------------------------------------------------------
       ACCENT ENGINE

       Each section re-rolls the accent from a fixed set of hues. Hues are
       specified in OKLCH because its lightness is perceptual: pinning every
       hue to the same L means yellow and ultramarine end up equally legible,
       which is not true in HSL. Muddy hues (brown/beige/cream are simply low
       chroma at low lightness) never appear because chroma is held high and
       lightness is fixed per theme.

       Three outputs per roll:
         vivid  graphics only — field points, dots, borders, focus rings
         ink    text and solid fills; darker on light ground, lighter on dark
         on     foreground for anything sitting on `ink`
       --------------------------------------------------------------------- */
    var HUES = [
        { name: 'red',         h: 27  },
        { name: 'orange',      h: 55  },
        { name: 'yellow',      h: 96  },
        { name: 'green',       h: 145 },
        { name: 'emerald',     h: 168 },
        { name: 'cyan',        h: 215 },
        { name: 'ultramarine', h: 264 },
        { name: 'violet',      h: 292 },
        { name: 'purple',      h: 315 },
        { name: 'pink',        h: 350 }
    ];

    // OKLCH -> sRGB. Done here rather than leaning on css oklch() so the same
    // numbers drive the canvas, where per-point alpha is needed.
    function oklch(L, C, Hdeg) {
        var hr = Hdeg * Math.PI / 180;
        var a = C * Math.cos(hr), b = C * Math.sin(hr);

        var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
        var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;

        var lin = [
             4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        ];

        return lin.map(function (v) {
            v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
            return Math.max(0, Math.min(255, Math.round(v * 255)));
        });
    }

    var accentRGB = [224, 60, 0];          // vivid, as [r,g,b] for the canvas
    var hueIndex = -1;

    function paintAccent(hue, dark) {
        var vivid = oklch(dark ? 0.76 : 0.66, 0.20, hue);
        var ink   = oklch(dark ? 0.80 : 0.46, 0.19, hue);

        // Must be set on <body>, not <html>: body.dark declares these same
        // properties, and a declaration on the element itself beats a value
        // inherited from its parent — so setting them on <html> would be
        // silently overridden in dark mode. An inline style on <body> wins.
        var el = document.body.style;
        el.setProperty('--accent', 'rgb(' + vivid.join(' ') + ')');
        el.setProperty('--accent-ink', 'rgb(' + ink.join(' ') + ')');
        el.setProperty('--accent-on', dark ? '#0b0b0c' : '#ffffff');

        accentRGB = vivid;
    }

    // Draw from a shuffled bag rather than picking at random each time. Pure
    // random repeats far more than people expect — six sections would often
    // show the same hue two or three times. A bag guarantees all ten appear
    // before any repeats, and the refill never starts on the colour it ended
    // with, so consecutive sections are always different.
    var bag = [];

    function refillBag() {
        var last = bag.length === 0 && hueIndex >= 0 ? hueIndex : -1;
        bag = HUES.map(function (_, i) { return i; });
        for (var i = bag.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
        }
        if (bag[bag.length - 1] === last) {           // pop() takes from the end
            bag.push(bag.shift());
        }
    }

    function rollAccent() {
        if (!bag.length) refillBag();
        hueIndex = bag.pop();
        paintAccent(HUES[hueIndex].h, document.body.classList.contains('dark'));
    }

    /* ---------------------------------------------------------------------
       Section switching
       --------------------------------------------------------------------- */
    function setInert(el, off) {
        if (off) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
        else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    }

    function go(index, fromHash) {
        index = Math.max(0, Math.min(SECTIONS.length - 1, index));
        if (index === current) return;
        current = index;

        document.body.setAttribute('data-section', String(index));
        rollAccent();

        [titles, frames, panels].forEach(function (group) {
            group.forEach(function (el, i) {
                var on = i === index;
                el.classList.toggle('is-active', on);
                setInert(el, !on);
                if (on) el.scrollTop = 0;
            });
        });

        dots.forEach(function (d, i) {
            if (i === index) d.setAttribute('aria-current', 'true');
            else d.removeAttribute('aria-current');
        });

        if (index === 1) Feed.reveal();

        if (!fromHash) {
            var hash = '#' + SECTIONS[index];
            if (window.location.hash !== hash) {
                history.replaceState(null, '', index === 0 ? window.location.pathname : hash);
            }
        }

        locked = true;
        setTimeout(function () { locked = false; }, reduceMotion ? 60 : 600);
    }

    function step(delta) { go(current + delta); }

    /* ---------------------------------------------------------------------
       Let inner content scroll before paging the section
       --------------------------------------------------------------------- */
    function scrollableAncestor(node, dir) {
        while (node && node !== document.body) {
            if (node.nodeType === 1) {
                var oy = window.getComputedStyle(node).overflowY;
                if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
                    var atTop = node.scrollTop <= 0;
                    var atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
                    if ((dir > 0 && !atBottom) || (dir < 0 && !atTop)) return node;
                }
            }
            node = node.parentNode;
        }
        return null;
    }

    /* ---------------------------------------------------------------------
       Wheel / trackpad
       --------------------------------------------------------------------- */
    var wheelAccum = 0;
    var wheelReset = null;

    window.addEventListener('wheel', function (e) {
        var dir = e.deltaY > 0 ? 1 : -1;
        if (Feed.isInside && Feed.isInside(e.target)) {
            if (Feed.wheel(e.deltaY)) { e.preventDefault(); return; }   // consumed
            e.preventDefault();                                          // at an end -> page
            if (locked) return;
            locked = true; setTimeout(function () { locked = false; }, 600);
            step(dir); return;
        }
        if (scrollableAncestor(e.target, dir)) return;
        e.preventDefault();
        if (locked) return;

        wheelAccum += e.deltaY;
        clearTimeout(wheelReset);
        wheelReset = setTimeout(function () { wheelAccum = 0; }, 160);

        if (Math.abs(wheelAccum) > 42) { wheelAccum = 0; step(dir); }
    }, { passive: false });

    /* ---------------------------------------------------------------------
       Keyboard
       --------------------------------------------------------------------- */
    window.addEventListener('keydown', function (e) {
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (document.getElementById('snake-canvas')) return;   // snake owns the keyboard

        switch (e.key) {
            case 'ArrowDown': case 'PageDown': case 'j': e.preventDefault(); step(1); break;
            case 'ArrowUp':   case 'PageUp':   case 'k': e.preventDefault(); step(-1); break;
            case 'Home': e.preventDefault(); go(0); break;
            case 'End':  e.preventDefault(); go(SECTIONS.length - 1); break;
            case 'ArrowLeft':  if (current === 1) { e.preventDefault(); Feed.step(-1); } break;
            case 'ArrowRight': if (current === 1) { e.preventDefault(); Feed.step(1); } break;
        }
    });

    /* ---------------------------------------------------------------------
       Touch — vertical swipe pages sections
       --------------------------------------------------------------------- */
    var touchY = null, touchScrollable = null;

    window.addEventListener('touchstart', function (e) {
        touchY = e.touches[0].clientY;
        touchScrollable = null;
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
        if (touchY === null) return;
        var dy = touchY - e.touches[0].clientY;
        if (touchScrollable === null) {
            touchScrollable = (Feed.isInside && Feed.isInside(e.target)) ||
                              !!scrollableAncestor(e.target, dy > 0 ? 1 : -1);
        }
        if (touchScrollable) return;
        if (locked || Math.abs(dy) < 52) return;
        touchY = null;
        step(dy > 0 ? 1 : -1);
    }, { passive: true });

    window.addEventListener('touchend', function () { touchY = null; }, { passive: true });

    /* ---------------------------------------------------------------------
       Click targets
       --------------------------------------------------------------------- */
    document.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;

        var goEl = e.target.closest('[data-goto]');
        if (goEl) { e.preventDefault(); go(parseInt(goEl.getAttribute('data-goto'), 10)); return; }

        var stepEl = e.target.closest('[data-step]');
        if (stepEl) { e.preventDefault(); step(parseInt(stepEl.getAttribute('data-step'), 10)); return; }

        if (e.target.closest('[data-reel-next]')) { Feed.step(1); return; }
        if (e.target.closest('[data-reel-prev]')) { Feed.step(-1); return; }
    });

    titles.forEach(function (t, i) {
        t.addEventListener('click', function () { if (i === current) step(1); });
    });

    /* ---------------------------------------------------------------------
       REEL FEED

       A phone-shaped viewport holding a vertical stack of Instagram embeds,
       driven by a hand-rolled momentum scroller rather than native overflow.
       Native scrolling gives inertia on trackpads but steps rigidly for mouse
       wheels; this integrates wheel, drag and touch into one velocity so all
       three feel the same, then eases to the nearest reel once the velocity
       decays. The feed reports when it is pinned at an end so the page can
       take the gesture back and move to the next section.
       --------------------------------------------------------------------- */
    var Feed = (function () {
        var screenEl = document.querySelector('.phone__screen');
        var track    = document.getElementById('feed');
        if (!screenEl || !track) return { wheel: function () { return false; }, reveal: function () {} };

        var slides = Array.prototype.slice.call(track.querySelectorAll('.slide'));
        var counter = document.getElementById('reelIndex');
        var thumb = document.getElementById('railThumb');

        var H = 0, maxY = 0;
        var y = 0, vel = 0, raf = null;
        var snapping = false, dragging = false, revealed = false;
        var lastY = 0, lastT = 0;
        var index = 0;

        var FRICTION = 0.935;   // per frame decay
        var SNAP = 0.16;        // easing toward the nearest reel
        var STOP = 0.5;         // velocity below which we start snapping

        function measure() {
            H = screenEl.clientHeight || 1;
            maxY = Math.max(0, (slides.length - 1) * H);
            y = Math.min(y, maxY);
            apply();
        }

        function apply() {
            track.style.transform = 'translate3d(0,' + (-y).toFixed(2) + 'px,0)';
            var i = Math.max(0, Math.min(slides.length - 1, Math.round(y / H)));
            if (i !== index) { index = i; mount(); }
            if (counter) counter.textContent = String(index + 1);
            if (thumb) {
                thumb.style.height = (100 / slides.length) + '%';
                thumb.style.transform = 'translateY(' + (y / H * 100) + '%)';
            }
        }

        // only build iframes around the current reel, so opening the section
        // does not fire eleven Instagram requests at once
        function mount() {
            if (!revealed) return;
            for (var i = index - 1; i <= index + 1; i++) {
                var el = slides[i];
                if (!el || el.dataset.loaded) continue;
                el.dataset.loaded = '1';
                var f = document.createElement('iframe');
                f.src = 'https://www.instagram.com/reel/' + el.getAttribute('data-code') + '/embed/';
                f.setAttribute('title', 'Instagram reel by @aristides.lab');
                f.setAttribute('loading', 'lazy');
                f.setAttribute('scrolling', 'no');
                f.addEventListener('load', function () { this.parentNode.classList.add('is-loaded'); });
                el.appendChild(f);
            }
        }

        function loop() {
            if (dragging) { raf = requestAnimationFrame(loop); return; }

            if (snapping) {
                var target = Math.round(y / H) * H;
                y += (target - y) * SNAP;
                if (Math.abs(target - y) < 0.4) {
                    y = target; snapping = false; apply();
                    raf = null; return;
                }
            } else {
                y += vel;
                if (y < 0) { y = 0; vel = 0; }
                if (y > maxY) { y = maxY; vel = 0; }
                vel *= FRICTION;
                if (Math.abs(vel) < STOP) { vel = 0; snapping = true; }
            }
            apply();
            raf = requestAnimationFrame(loop);
        }

        function kick() { if (!raf) raf = requestAnimationFrame(loop); }

        function atTop()    { return y <= 0.5; }
        function atBottom() { return y >= maxY - 0.5; }

        function wheel(delta) {
            if (!H) measure();
            // hand the gesture back to the page at either end
            if ((delta < 0 && atTop()) || (delta > 0 && atBottom())) return false;
            snapping = false;
            vel += delta * 0.20;
            vel = Math.max(-90, Math.min(90, vel));
            kick();
            return true;
        }

        function goTo(i) {
            index = Math.max(0, Math.min(slides.length - 1, i));
            vel = 0; snapping = true; kick(); mount();
            y += (index * H - y) * 0.001;   // nudge so the snap targets the new index
            y = index * H; apply();
        }

        function step(d) { goTo(Math.round(y / H) + d); }

        /* --- drag / touch --- */
        function down(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            dragging = true; vel = 0; snapping = false;
            lastY = e.clientY; lastT = e.timeStamp;
            screenEl.setPointerCapture(e.pointerId);
            kick();
        }
        function move(e) {
            if (!dragging) return;
            var dy = e.clientY - lastY;
            var dt = Math.max(1, e.timeStamp - lastT);
            y = Math.max(-H * 0.15, Math.min(maxY + H * 0.15, y - dy));
            vel = -dy / dt * 16;                       // px per frame
            lastY = e.clientY; lastT = e.timeStamp;
            apply();
            e.preventDefault();
        }
        function up(e) {
            if (!dragging) return;
            dragging = false;
            if (screenEl.hasPointerCapture(e.pointerId)) screenEl.releasePointerCapture(e.pointerId);
            if (Math.abs(vel) < 1.2) { vel = 0; snapping = true; }
            vel = Math.max(-90, Math.min(90, vel));
            kick();
        }

        screenEl.addEventListener('pointerdown', down);
        screenEl.addEventListener('pointermove', move);
        screenEl.addEventListener('pointerup', up);
        screenEl.addEventListener('pointercancel', up);
        screenEl.addEventListener('dragstart', function (e) { e.preventDefault(); });

        window.addEventListener('resize', measure);

        return {
            wheel: wheel,
            step: step,
            reveal: function () { revealed = true; measure(); mount(); },
            isInside: function (node) { return screenEl.contains(node); }
        };
    })();

    /* ---------------------------------------------------------------------
       Theme
       --------------------------------------------------------------------- */
    var toggle = document.getElementById('themeToggle');
    var label = toggle.querySelector('.theme-toggle__label');

    function applyTheme(dark) {
        document.body.classList.toggle('dark', dark);
        label.textContent = dark ? 'light' : 'dark';
        toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
        toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        // lightness targets differ per ground, so re-derive rather than reuse
        if (hueIndex >= 0) paintAccent(HUES[hueIndex].h, dark);
    }

    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (err) {}
    if (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches) saved = 'dark';
    applyTheme(saved === 'dark');

    toggle.addEventListener('click', function () {
        var dark = !document.body.classList.contains('dark');
        applyTheme(dark);
        try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (err) {}
    });

    /* ---------------------------------------------------------------------
       LiDAR field — a perspective ground plane of scan rows across the page.
       Rows bunch toward the horizon and spread toward the viewer; a scan bar
       travels outward lighting each row it crosses.
       --------------------------------------------------------------------- */
    (function field() {
        var canvas = document.getElementById('field');
        var ctx = canvas.getContext('2d');
        var pts = [];
        var raf = null;
        var w = 0, h = 0, dpr = 1, t = 0;
        var pointer = { x: 0.5, y: 0.72, on: false };

        var ROWS = 30;
        var HORIZON = 0.42;

        function size() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function seed() {
            var perRow = Math.max(26, Math.round(w / 22));
            pts = [];
            for (var r = 0; r < ROWS; r++) {
                var k = r / (ROWS - 1);          // 0 = far, 1 = near
                var near = Math.pow(k, 2.3);
                for (var i = 0; i < perRow; i++) {
                    var u = i / (perRow - 1);
                    pts.push({
                        k: k,
                        near: near,
                        spread: 0.5 + (u - 0.5) * (0.3 + 2.1 * near),
                        y: HORIZON + (1 - HORIZON) * near,
                        p: u * 5.2 + r * 0.6
                    });
                }
            }
        }

        function palette() {
            var dark = document.body.classList.contains('dark');
            var acc = accentRGB.join(',');           // follows the section's roll
            return dark
                ? { dot: '226,229,238', acc: acc, base: 0.32, hi: 0.66 }
                : { dot: '23,23,26',    acc: acc, base: 0.24, hi: 0.50 };
        }

        function draw() {
            t += 0.0026;
            ctx.clearRect(0, 0, w, h);

            var c = palette();
            var sweep = (t * 0.3) % 1.5;
            var cx = pointer.on ? pointer.x : 0.5 + Math.sin(t * 0.6) * 0.1;
            var cy = pointer.on ? pointer.y : 0.75;

            for (var i = 0; i < pts.length; i++) {
                var p = pts[i];

                var wave = Math.sin(p.p + t * 2.1 - p.k * 4) * 0.05 * p.near;

                var dx = p.spread - cx, dy = p.y - cy;
                var pull = 0.04 / ((dx * dx + dy * dy) * 26 + 0.09);

                var x = (p.spread + dx * pull * 0.7) * w;
                var y = (p.y - wave + dy * pull * 0.35) * h;
                if (x < -20 || x > w + 20) continue;

                var depth = 0.1 + p.near * 0.9;
                var scan = Math.max(0, 1 - Math.abs(p.near - sweep) * 8);
                var hot = Math.min(1, pull * 1.5 + scan);
                var r = (0.4 + p.near * 1.5) * (1 + scan * 0.7);

                if (hot > 0.05) {
                    ctx.fillStyle = 'rgba(' + c.acc + ',' + Math.min(c.hi, hot * depth * c.hi * 1.8).toFixed(3) + ')';
                } else {
                    ctx.fillStyle = 'rgba(' + c.dot + ',' + (depth * c.base).toFixed(3) + ')';
                }
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 6.2832);
                ctx.fill();
            }

            raf = requestAnimationFrame(draw);
        }

        function start() {
            if (raf) return;
            size();
            if (!pts.length) seed();
            if (reduceMotion) { draw(); stop(); return; }
            raf = requestAnimationFrame(draw);
        }
        function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

        window.addEventListener('pointermove', function (e) {
            pointer.x = e.clientX / window.innerWidth;
            pointer.y = e.clientY / window.innerHeight;
            pointer.on = true;
        }, { passive: true });
        window.addEventListener('pointerleave', function () { pointer.on = false; });

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () { size(); seed(); }, 120);
        });

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stop(); else start();
        });

        start();
    })();

    /* ---------------------------------------------------------------------
       Boot
       --------------------------------------------------------------------- */
    var start = SECTIONS.indexOf((window.location.hash || '').replace('#', ''));
    if (new URLSearchParams(window.location.search).has('submitted')) {
        var form = document.querySelector('.form');
        var success = document.getElementById('form-success');
        if (form && success) { form.hidden = true; success.hidden = false; }
        history.replaceState(null, '', window.location.pathname);
        start = 5;
    }
    go(start > 0 ? start : 0, true);

    window.addEventListener('hashchange', function () {
        var i = SECTIONS.indexOf(window.location.hash.replace('#', ''));
        if (i >= 0) go(i, true);
    });

})();
