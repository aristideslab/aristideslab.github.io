(function() {
    if (window.innerWidth <= 768) return;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var mouse = { x: -9999, y: -9999, active: false };
    var W, H;
    var rafId;

    var lastScrollY = window.scrollY;
    var scrollDelta = 0;

    // === Simple drift particles in typed arrays ===
    var SIMPLE_COUNT = 0;
    var sx, sy, svx, svy, sph, sspd, sr;

    // === Special behavior particles ===
    var TYPE_FOLLOWER = 1;
    var TYPE_ORBITER = 2;
    var special = [];

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function wrapDelta(d, span) {
        if (d > span / 2) return d - span;
        if (d < -span / 2) return d + span;
        return d;
    }

    function init() {
        resize();

        SIMPLE_COUNT = Math.min(20000, Math.floor((W * H) / 110));
        sx = new Float32Array(SIMPLE_COUNT);
        sy = new Float32Array(SIMPLE_COUNT);
        svx = new Float32Array(SIMPLE_COUNT);
        svy = new Float32Array(SIMPLE_COUNT);
        sph = new Float32Array(SIMPLE_COUNT);
        sspd = new Float32Array(SIMPLE_COUNT);
        sr = new Float32Array(SIMPLE_COUNT);

        for (var i = 0; i < SIMPLE_COUNT; i++) {
            sx[i] = Math.random() * W;
            sy[i] = Math.random() * H;
            svx[i] = (Math.random() - 0.5) * 0.25;
            svy[i] = (Math.random() - 0.5) * 0.25;
            sph[i] = Math.random() * Math.PI * 2;
            sspd[i] = 0.004 + Math.random() * 0.012;
            sr[i] = Math.random() < 0.85 ? 0.6 : 1.1;
        }

        // Special particles
        var followerCount = 220;
        var orbiterPairCount = 60;
        special = [];

        for (var f = 0; f < followerCount; f++) {
            special.push({
                type: TYPE_FOLLOWER,
                x: Math.random() * W,
                y: Math.random() * H,
                vx: 0,
                vy: 0,
                r: 1.4,
                phase: Math.random() * Math.PI * 2,
                speed: 0.005 + Math.random() * 0.01,
                target: -1
            });
        }

        for (var o = 0; o < orbiterPairCount; o++) {
            var ax = Math.random() * W;
            var ay = Math.random() * H;
            var ang = Math.random() * Math.PI * 2;
            var rad = 14 + Math.random() * 22;
            var spd = (Math.random() < 0.5 ? -1 : 1) * (0.02 + Math.random() * 0.04);
            var aIndex = special.length;
            special.push({
                type: TYPE_ORBITER, x: ax, y: ay, vx: 0, vy: 0, r: 1.5,
                partner: aIndex + 1, orbitAngle: ang, orbitRadius: rad,
                orbitSpeed: spd, stateTimer: 400 + Math.random() * 600,
                escaping: false, escapeVx: 0, escapeVy: 0, sign: 1
            });
            special.push({
                type: TYPE_ORBITER,
                x: ax + Math.cos(ang) * rad * 2,
                y: ay + Math.sin(ang) * rad * 2,
                vx: 0, vy: 0, r: 1.5,
                partner: aIndex, orbitAngle: ang, orbitRadius: rad,
                orbitSpeed: spd, stateTimer: 400 + Math.random() * 600,
                escaping: false, escapeVx: 0, escapeVy: 0, sign: -1
            });
        }

        // Build follower chains — chain follower -> follower -> ... or follower -> simple-target-position
        for (var ff = 0; ff < followerCount; ff++) {
            var t;
            var tries = 0;
            do {
                t = Math.floor(Math.random() * special.length);
                tries++;
            } while ((t === ff || special[t].type === TYPE_ORBITER) && tries < 8);
            special[ff].target = t;
        }
    }

    function tick() {
        // Consume scroll delta — push all particles
        if (scrollDelta !== 0) {
            var sd = scrollDelta;
            scrollDelta = 0;
            for (var s0 = 0; s0 < SIMPLE_COUNT; s0++) sy[s0] += sd;
            for (var sp0 = 0; sp0 < special.length; sp0++) special[sp0].y += sd;
        }

        ctx.clearRect(0, 0, W, H);
        var isDark = document.body.classList.contains('dark');
        var dotColor = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.38)';
        var lineColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';

        var hasMouse = mouse.active;
        var mx = mouse.x, my = mouse.y;
        var radius2 = 130 * 130;

        // === Update + render simple particles in two passes ===
        // Pass 1: update positions
        for (var i = 0; i < SIMPLE_COUNT; i++) {
            sph[i] += sspd[i];
            sx[i] += svx[i] + Math.sin(sph[i]) * 0.16;
            sy[i] += svy[i] + Math.cos(sph[i] * 0.7) * 0.12;
            svx[i] *= 0.95;
            svy[i] *= 0.95;

            if (hasMouse) {
                var ddx = sx[i] - mx;
                var ddy = sy[i] - my;
                var d2 = ddx * ddx + ddy * ddy;
                if (d2 < radius2 && d2 > 1) {
                    var d = Math.sqrt(d2);
                    var f = (1 - d / 130) * 1.2;
                    sx[i] += (ddx / d) * f;
                    sy[i] += (ddy / d) * f;
                    svx[i] += (ddx / d) * f * 0.3;
                    svy[i] += (ddy / d) * f * 0.3;
                }
            }

            if (sx[i] < 0) sx[i] += W;
            else if (sx[i] >= W) sx[i] -= W;
            if (sy[i] < 0) sy[i] += H;
            else if (sy[i] >= H) sy[i] -= H;
        }

        // Pass 2: draw all simple particles in a single path
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        for (var j = 0; j < SIMPLE_COUNT; j++) {
            var rj = sr[j];
            ctx.moveTo(sx[j] + rj, sy[j]);
            ctx.arc(sx[j], sy[j], rj, 0, Math.PI * 2);
        }
        ctx.fill();

        // === Special particles ===
        // Draw follower chain lines first
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (var ll = 0; ll < special.length; ll++) {
            var lp = special[ll];
            if (lp.type === TYPE_FOLLOWER && lp.target >= 0) {
                var lt = special[lp.target];
                var ldx = wrapDelta(lt.x - lp.x, W);
                var ldy = wrapDelta(lt.y - lp.y, H);
                if (ldx * ldx + ldy * ldy < 200 * 200) {
                    ctx.moveTo(lp.x, lp.y);
                    ctx.lineTo(lp.x + ldx, lp.y + ldy);
                }
            }
        }
        ctx.stroke();

        // Update + draw special particles
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        for (var k = 0; k < special.length; k++) {
            var p = special[k];

            if (p.type === TYPE_FOLLOWER) {
                p.phase += p.speed;
                if (p.target >= 0) {
                    var tg = special[p.target];
                    var tdx = wrapDelta(tg.x - p.x, W);
                    var tdy = wrapDelta(tg.y - p.y, H);
                    var td = Math.sqrt(tdx * tdx + tdy * tdy);
                    if (td > 0.1) {
                        p.vx += (tdx / td) * 0.025;
                        p.vy += (tdy / td) * 0.025;
                    }
                }
                p.vx += Math.sin(p.phase) * 0.015;
                p.vy += Math.cos(p.phase * 0.8) * 0.015;
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.92;
                p.vy *= 0.92;
            } else if (p.type === TYPE_ORBITER) {
                p.stateTimer--;
                if (p.escaping) {
                    p.x += p.escapeVx;
                    p.y += p.escapeVy;
                    p.escapeVx *= 0.985;
                    p.escapeVy *= 0.985;
                    if (p.stateTimer <= 0) {
                        p.escaping = false;
                        p.stateTimer = 400 + Math.random() * 600;
                    }
                } else if (p.partner >= 0) {
                    var pa = special[p.partner];
                    var midX = p.x + wrapDelta(pa.x - p.x, W) / 2;
                    var midY = p.y + wrapDelta(pa.y - p.y, H) / 2;
                    p.orbitAngle += p.orbitSpeed;
                    var tx = midX + Math.cos(p.orbitAngle) * p.orbitRadius * p.sign;
                    var ty = midY + Math.sin(p.orbitAngle) * p.orbitRadius * p.sign;
                    p.x += (tx - p.x) * 0.25;
                    p.y += (ty - p.y) * 0.25;
                    if (p.stateTimer <= 0) {
                        p.escaping = true;
                        p.stateTimer = 200 + Math.random() * 300;
                        var ang2 = p.orbitAngle + Math.PI / 2 * p.sign;
                        var spd2 = 1.5 + Math.random() * 2;
                        p.escapeVx = Math.cos(ang2) * spd2;
                        p.escapeVy = Math.sin(ang2) * spd2;
                    }
                }
            }

            if (hasMouse) {
                var mdx = p.x - mx;
                var mdy = p.y - my;
                var md2 = mdx * mdx + mdy * mdy;
                if (md2 < radius2 && md2 > 1) {
                    var md = Math.sqrt(md2);
                    var mf = (1 - md / 130) * 1.6;
                    p.x += (mdx / md) * mf;
                    p.y += (mdy / md) * mf;
                    p.vx += (mdx / md) * mf * 0.4;
                    p.vy += (mdy / md) * mf * 0.4;
                }
            }

            if (p.x < 0) p.x += W;
            else if (p.x >= W) p.x -= W;
            if (p.y < 0) p.y += H;
            else if (p.y >= H) p.y -= H;

            ctx.moveTo(p.x + p.r, p.y);
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        }
        ctx.fill();

        rafId = requestAnimationFrame(tick);
    }

    document.addEventListener('mousemove', function(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    });

    document.addEventListener('mouseleave', function() {
        mouse.active = false;
    });

    window.addEventListener('scroll', function() {
        var ny = window.scrollY;
        scrollDelta += (ny - lastScrollY);
        lastScrollY = ny;
    }, { passive: true });

    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768) {
            cancelAnimationFrame(rafId);
            rafId = null;
            canvas.style.display = 'none';
            return;
        }
        canvas.style.display = '';
        init();
        if (!rafId) rafId = requestAnimationFrame(tick);
    });

    init();
    rafId = requestAnimationFrame(tick);
})();
