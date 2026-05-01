(function() {
    if (window.innerWidth <= 768) return;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var particles = [];
    var mouse = { x: -9999, y: -9999, active: false };
    var W, H;
    var rafId;

    var TYPE_DRIFT = 0;
    var TYPE_FOLLOWER = 1;
    var TYPE_ORBITER = 2;

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
        var count = Math.min(1400, Math.floor((W * H) / 1600));
        particles = [];

        for (var i = 0; i < count; i++) {
            var roll = Math.random();
            var type;
            if (roll < 0.55) type = TYPE_DRIFT;
            else if (roll < 0.85) type = TYPE_FOLLOWER;
            else type = TYPE_ORBITER;

            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() * 1.4 + 0.4,
                phase: Math.random() * Math.PI * 2,
                speed: 0.005 + Math.random() * 0.01,
                type: type,
                target: -1,
                partner: -1,
                orbitAngle: Math.random() * Math.PI * 2,
                orbitRadius: 14 + Math.random() * 22,
                orbitSpeed: (Math.random() < 0.5 ? -1 : 1) * (0.02 + Math.random() * 0.04),
                stateTimer: Math.random() * 600,
                escaping: false,
                escapeVx: 0,
                escapeVy: 0
            });
        }

        // Build follower chains
        for (var j = 0; j < particles.length; j++) {
            if (particles[j].type === TYPE_FOLLOWER) {
                var t;
                var tries = 0;
                do {
                    t = Math.floor(Math.random() * particles.length);
                    tries++;
                } while ((t === j || particles[t].type === TYPE_ORBITER) && tries < 10);
                particles[j].target = t;
            }
        }

        // Pair orbiters
        var orbiters = [];
        for (var k = 0; k < particles.length; k++) {
            if (particles[k].type === TYPE_ORBITER) orbiters.push(k);
        }
        for (var m = 0; m < orbiters.length - 1; m += 2) {
            var a = orbiters[m];
            var b = orbiters[m + 1];
            particles[a].partner = b;
            particles[b].partner = a;
            // Place near each other initially
            particles[b].x = particles[a].x + Math.cos(particles[a].orbitAngle) * particles[a].orbitRadius * 2;
            particles[b].y = particles[a].y + Math.sin(particles[a].orbitAngle) * particles[a].orbitRadius * 2;
        }
    }

    function tick() {
        ctx.clearRect(0, 0, W, H);
        var isDark = document.body.classList.contains('dark');
        var fillBase = isDark ? 'rgba(255,255,255,' : 'rgba(0,0,0,';
        var lineBase = isDark ? 'rgba(255,255,255,' : 'rgba(0,0,0,';

        // Draw connection lines for follower chains first (behind dots)
        ctx.lineWidth = 0.5;
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            if (p.type === TYPE_FOLLOWER && p.target >= 0) {
                var t = particles[p.target];
                var ddx = wrapDelta(t.x - p.x, W);
                var ddy = wrapDelta(t.y - p.y, H);
                if (ddx * ddx + ddy * ddy < 200 * 200) {
                    ctx.strokeStyle = lineBase + '0.12)';
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + ddx, p.y + ddy);
                    ctx.stroke();
                }
            }
        }

        for (var i2 = 0; i2 < particles.length; i2++) {
            var p2 = particles[i2];

            if (p2.type === TYPE_DRIFT) {
                p2.phase += p2.speed;
                p2.x += p2.vx + Math.sin(p2.phase) * 0.18;
                p2.y += p2.vy + Math.cos(p2.phase * 0.7) * 0.14;
                p2.vx *= 0.94;
                p2.vy *= 0.94;
            } else if (p2.type === TYPE_FOLLOWER) {
                p2.phase += p2.speed;
                if (p2.target >= 0) {
                    var tg = particles[p2.target];
                    var dx = wrapDelta(tg.x - p2.x, W);
                    var dy = wrapDelta(tg.y - p2.y, H);
                    var d = Math.sqrt(dx * dx + dy * dy);
                    if (d > 0.1) {
                        var follow = 0.025;
                        p2.vx += (dx / d) * follow;
                        p2.vy += (dy / d) * follow;
                    }
                }
                p2.vx += Math.sin(p2.phase) * 0.02;
                p2.vy += Math.cos(p2.phase * 0.8) * 0.02;
                p2.x += p2.vx;
                p2.y += p2.vy;
                p2.vx *= 0.92;
                p2.vy *= 0.92;
            } else if (p2.type === TYPE_ORBITER) {
                p2.stateTimer--;

                if (p2.escaping) {
                    p2.x += p2.escapeVx;
                    p2.y += p2.escapeVy;
                    p2.escapeVx *= 0.985;
                    p2.escapeVy *= 0.985;
                    if (p2.stateTimer <= 0) {
                        p2.escaping = false;
                        p2.stateTimer = 400 + Math.random() * 600;
                        p2.vx = p2.escapeVx;
                        p2.vy = p2.escapeVy;
                    }
                } else if (p2.partner >= 0) {
                    var pa = particles[p2.partner];
                    // Orbit around midpoint
                    var midX = p2.x + wrapDelta(pa.x - p2.x, W) / 2;
                    var midY = p2.y + wrapDelta(pa.y - p2.y, H) / 2;
                    p2.orbitAngle += p2.orbitSpeed;
                    var sign = (i2 < p2.partner) ? 1 : -1;
                    var targetX = midX + Math.cos(p2.orbitAngle) * p2.orbitRadius * sign;
                    var targetY = midY + Math.sin(p2.orbitAngle) * p2.orbitRadius * sign;
                    p2.x += (targetX - p2.x) * 0.25;
                    p2.y += (targetY - p2.y) * 0.25;

                    if (p2.stateTimer <= 0) {
                        // Run away
                        p2.escaping = true;
                        p2.stateTimer = 200 + Math.random() * 300;
                        var ang = p2.orbitAngle + Math.PI / 2 * sign;
                        var spd = 1.5 + Math.random() * 2;
                        p2.escapeVx = Math.cos(ang) * spd;
                        p2.escapeVy = Math.sin(ang) * spd;
                    }
                } else {
                    p2.x += p2.vx;
                    p2.y += p2.vy;
                    p2.vx *= 0.96;
                    p2.vy *= 0.96;
                }
            }

            // Mouse displacement (all types)
            if (mouse.active) {
                var mdx = p2.x - mouse.x;
                var mdy = p2.y - mouse.y;
                var dist2 = mdx * mdx + mdy * mdy;
                var radius = 130;
                if (dist2 < radius * radius && dist2 > 0.5) {
                    var dist = Math.sqrt(dist2);
                    var force = (1 - dist / radius) * 1.6;
                    p2.x += (mdx / dist) * force;
                    p2.y += (mdy / dist) * force;
                    p2.vx += (mdx / dist) * force * 0.4;
                    p2.vy += (mdy / dist) * force * 0.4;
                }
            }

            // Cap velocity
            var maxV = 4;
            if (p2.vx > maxV) p2.vx = maxV;
            else if (p2.vx < -maxV) p2.vx = -maxV;
            if (p2.vy > maxV) p2.vy = maxV;
            else if (p2.vy < -maxV) p2.vy = -maxV;

            // Wrap edges
            if (p2.x < 0) p2.x += W;
            else if (p2.x >= W) p2.x -= W;
            if (p2.y < 0) p2.y += H;
            else if (p2.y >= H) p2.y -= H;

            ctx.fillStyle = fillBase + '0.45)';
            ctx.beginPath();
            ctx.arc(p2.x, p2.y, p2.r, 0, Math.PI * 2);
            ctx.fill();
        }

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
