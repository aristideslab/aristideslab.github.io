/* ==========================================================================
   ARISTIDES LAB — section state machine, device screens, generative field
   ========================================================================== */
(function () {
    'use strict';

    var SECTIONS = ['index', 'portfolio', 'apps', 'links', 'skills', 'contact'];
    var SCREEN_CHROME = ['light', 'light', 'light', 'dark', 'dark', 'dark']; // status-bar ink per screen
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var titles  = Array.prototype.slice.call(document.querySelectorAll('.title'));
    var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
    var panels  = Array.prototype.slice.call(document.querySelectorAll('.panel'));
    var dots    = Array.prototype.slice.call(document.querySelectorAll('.dot'));
    var statusbar = document.getElementById('statusbar');
    var deviceScreen = document.querySelector('.device__screen');

    var current = -1;
    var locked = false;

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

        [titles, screens, panels].forEach(function (group) {
            group.forEach(function (el, i) {
                var on = i === index;
                el.classList.toggle('is-active', on);
                setInert(el, !on);
            });
        });

        dots.forEach(function (d, i) {
            if (i === index) d.setAttribute('aria-current', 'true');
            else d.removeAttribute('aria-current');
        });

        statusbar.setAttribute('data-chrome', SCREEN_CHROME[index]);
        deviceScreen.setAttribute('data-chrome', SCREEN_CHROME[index]);

        if (index === 1) showReel(reelIndex, true);
        if (index === 0) field.start(); else field.stop();

        if (!fromHash) {
            var hash = '#' + SECTIONS[index];
            if (window.location.hash !== hash) {
                history.replaceState(null, '', index === 0 ? window.location.pathname : hash);
            }
        }

        locked = true;
        setTimeout(function () { locked = false; }, reduceMotion ? 60 : 620);
    }

    function step(delta) { go(current + delta); }

    /* ---------------------------------------------------------------------
       Should this event scroll inner content instead of paging?
       --------------------------------------------------------------------- */
    function scrollableAncestor(node, dir) {
        while (node && node !== document.body) {
            if (node.nodeType === 1) {
                var style = window.getComputedStyle(node);
                var oy = style.overflowY;
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
        if (scrollableAncestor(e.target, dir)) return;   // let the inner screen scroll
        e.preventDefault();
        if (locked) return;

        wheelAccum += e.deltaY;
        clearTimeout(wheelReset);
        wheelReset = setTimeout(function () { wheelAccum = 0; }, 160);

        if (Math.abs(wheelAccum) > 42) {
            wheelAccum = 0;
            step(dir);
        }
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
            case 'ArrowDown': case 'PageDown': case 'j':
                e.preventDefault(); step(1); break;
            case 'ArrowUp': case 'PageUp': case 'k':
                e.preventDefault(); step(-1); break;
            case 'Home': e.preventDefault(); go(0); break;
            case 'End':  e.preventDefault(); go(SECTIONS.length - 1); break;
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
            touchScrollable = scrollableAncestor(e.target, dy > 0 ? 1 : -1) ? true : false;
        }
        if (touchScrollable) return;
        if (locked || Math.abs(dy) < 52) return;
        touchY = null;
        step(dy > 0 ? 1 : -1);
    }, { passive: true });

    window.addEventListener('touchend', function () { touchY = null; }, { passive: true });

    /* ---------------------------------------------------------------------
       Click targets: dots, titles, wordmark, pager, panel buttons
       --------------------------------------------------------------------- */
    document.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;
        var goEl = e.target.closest('[data-goto]');
        if (goEl) { e.preventDefault(); go(parseInt(goEl.getAttribute('data-goto'), 10)); return; }

        var stepEl = e.target.closest('[data-step]');
        if (stepEl) { e.preventDefault(); step(parseInt(stepEl.getAttribute('data-step'), 10)); return; }
    });

    titles.forEach(function (t, i) {
        t.addEventListener('click', function () { if (i === current) step(1); });
    });

    /* ---------------------------------------------------------------------
       Instagram reels — lazy iframes
       --------------------------------------------------------------------- */
    var reelEls = Array.prototype.slice.call(document.querySelectorAll('.reel'));
    var reelIndex = 0;
    var reelCounter = document.getElementById('reelIndex');

    function loadReel(i) {
        var el = reelEls[i];
        if (!el || el.dataset.loaded) return;
        el.dataset.loaded = '1';
        var frame = document.createElement('iframe');
        frame.src = 'https://www.instagram.com/reel/' + el.getAttribute('data-reel') + '/embed/';
        frame.setAttribute('title', 'Instagram reel by @aristides.lab');
        frame.setAttribute('loading', 'lazy');
        frame.setAttribute('scrolling', 'no');
        frame.setAttribute('allowtransparency', 'true');
        frame.addEventListener('load', function () { el.classList.add('is-loaded'); });
        el.querySelector('.reel__crop').appendChild(frame);
    }

    // allowLoad stays false until the portfolio section is actually reached,
    // so four Instagram iframes never load on first paint.
    function showReel(i, allowLoad) {
        reelIndex = (i + reelEls.length) % reelEls.length;
        reelEls.forEach(function (el, n) { el.classList.toggle('is-active', n === reelIndex); });
        reelCounter.textContent = String(reelIndex + 1);
        if (allowLoad) {
            loadReel(reelIndex);
            loadReel((reelIndex + 1) % reelEls.length);   // prefetch the next one
        }
    }

    document.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;
        if (e.target.closest('[data-reel-next]')) showReel(reelIndex + 1, true);
        if (e.target.closest('[data-reel-prev]')) showReel(reelIndex - 1, true);
    });

    showReel(0, false);

    /* ---------------------------------------------------------------------
       Apps — hovering an icon highlights its detail in the right panel
       --------------------------------------------------------------------- */
    var appIcons   = Array.prototype.slice.call(document.querySelectorAll('.appicon'));
    var appDetails = Array.prototype.slice.call(document.querySelectorAll('[data-app-detail]'));

    function focusApp(i) {
        appDetails.forEach(function (d, n) { d.classList.toggle('is-focused', n === i); });
    }

    appIcons.forEach(function (icon, i) {
        icon.addEventListener('mouseenter', function () { focusApp(i); });
        icon.addEventListener('focus', function () { focusApp(i); });
    });
    appDetails.forEach(function (d, i) {
        d.addEventListener('mouseenter', function () { focusApp(i); });
    });
    focusApp(0);

    /* ---------------------------------------------------------------------
       Live clock in the status bar
       --------------------------------------------------------------------- */
    var clock = document.getElementById('clock');
    function tickClock() {
        var d = new Date();
        var h = d.getHours() % 12; if (h === 0) h = 12;
        clock.textContent = h + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    tickClock();
    setInterval(tickClock, 15000);

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
       Generative depth field — screen 0
       --------------------------------------------------------------------- */
    var field = (function () {
        var canvas = document.getElementById('field');
        var ctx = canvas.getContext('2d');
        var pts = [];
        var raf = null;
        var w = 0, h = 0, dpr = 1;
        var t = 0;
        var pointer = { x: 0.5, y: 0.5, on: false };

        function size() {
            var r = canvas.getBoundingClientRect();
            if (!r.width || !r.height) return false;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = r.width; h = r.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return true;
        }

        // A perspective ground plane of scan rows: rows bunch toward the
        // horizon and spread toward the viewer, so it reads as a LiDAR sweep
        // over terrain rather than random noise.
        var ROWS = 34;
        var HORIZON = 0.30;

        function seed() {
            var perRow = Math.max(20, Math.round(w / 7));
            pts = [];
            for (var r = 0; r < ROWS; r++) {
                var k = r / (ROWS - 1);           // 0 = far, 1 = near
                var near = Math.pow(k, 2.1);      // perspective compression
                for (var i = 0; i < perRow; i++) {
                    var u = i / (perRow - 1);
                    pts.push({
                        u: u,
                        k: k,
                        near: near,
                        // lateral spread widens as the row approaches the viewer
                        spread: 0.5 + (u - 0.5) * (0.42 + 1.5 * near),
                        y: HORIZON + (1 - HORIZON) * near,
                        p: (u * 5.4) + r * 0.55,
                        j: (Math.random() - 0.5) * 0.5
                    });
                }
            }
        }

        function accent() {
            return document.body.classList.contains('dark') ? [255, 95, 38] : [224, 60, 0];
        }

        function draw() {
            t += 0.0032;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#08080a';
            ctx.fillRect(0, 0, w, h);

            var a = accent();
            var cx = pointer.on ? pointer.x : 0.5 + Math.sin(t * 0.7) * 0.16;
            var cy = pointer.on ? pointer.y : 0.42 + Math.cos(t * 0.5) * 0.12;

            // the scan bar travels from horizon to viewer and lights each row it crosses
            var sweep = (t * 0.34) % 1.35;

            for (var i = 0; i < pts.length; i++) {
                var p = pts[i];

                // terrain height — rolling wave that scrolls toward the viewer
                var wave = Math.sin(p.p + t * 2.4 - p.k * 4.2) * 0.055 * p.near;

                // depth-well around the pointer
                var dx = p.spread - cx, dy = p.y - cy;
                var pull = 0.045 / ((dx * dx + dy * dy) * 20 + 0.08);

                var x = (p.spread + dx * pull * 0.8) * w;
                var y = (p.y - wave + dy * pull * 0.4) * h;

                var depth = 0.12 + p.near * 0.88;                    // near points read brighter
                var scan = Math.max(0, 1 - Math.abs(p.near - sweep) * 9);
                var hot = Math.min(1, pull * 1.9 + scan);
                var r = (0.5 + p.near * 1.9) * (1 + scan * 0.8) + p.j * 0.3;

                if (hot > 0.04) {
                    ctx.fillStyle = 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + Math.min(1, hot * (0.35 + depth)).toFixed(3) + ')';
                } else {
                    ctx.fillStyle = 'rgba(226,229,238,' + (0.09 + depth * 0.4).toFixed(3) + ')';
                }
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 6.2832);
                ctx.fill();
            }

            // horizon haze
            var haze = ctx.createLinearGradient(0, (HORIZON - 0.16) * h, 0, (HORIZON + 0.06) * h);
            haze.addColorStop(0, 'rgba(255,255,255,0)');
            haze.addColorStop(1, 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',0.09)');
            ctx.fillStyle = haze;
            ctx.fillRect(0, (HORIZON - 0.16) * h, w, 0.22 * h);

            // scrim so the headline stays readable over the bright near field
            var scrim = ctx.createLinearGradient(0, 0.5 * h, 0, h);
            scrim.addColorStop(0, 'rgba(8,8,10,0)');
            scrim.addColorStop(1, 'rgba(8,8,10,0.82)');
            ctx.fillStyle = scrim;
            ctx.fillRect(0, 0.5 * h, w, 0.5 * h);

            raf = requestAnimationFrame(draw);
        }

        function start() {
            if (raf || reduceMotion) { if (reduceMotion) still(); return; }
            if (!size()) { requestAnimationFrame(start); return; }
            if (!pts.length) seed();
            raf = requestAnimationFrame(draw);
        }

        function still() {
            if (!size()) return;
            if (!pts.length) seed();
            draw();
            cancelAnimationFrame(raf);
            raf = null;
        }

        function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

        canvas.addEventListener('pointermove', function (e) {
            var r = canvas.getBoundingClientRect();
            pointer.x = (e.clientX - r.left) / r.width;
            pointer.y = (e.clientY - r.top) / r.height;
            pointer.on = true;
        });
        canvas.addEventListener('pointerleave', function () { pointer.on = false; });

        window.addEventListener('resize', function () {
            if (size()) seed();
        });

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stop();
            else if (current === 0) start();
        });

        return { start: start, stop: stop };
    })();

    /* ---------------------------------------------------------------------
       Boot
       --------------------------------------------------------------------- */
    var start = SECTIONS.indexOf((window.location.hash || '').replace('#', ''));
    if (new URLSearchParams(window.location.search).has('submitted')) {
        var form = document.querySelector('.contact-form');
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
