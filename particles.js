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

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function init() {
        resize();
        var count = Math.min(140, Math.floor((W * H) / 16000));
        particles = [];
        for (var i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() * 1.6 + 0.6,
                phase: Math.random() * Math.PI * 2,
                speed: 0.005 + Math.random() * 0.01
            });
        }
    }

    function tick() {
        ctx.clearRect(0, 0, W, H);
        var isDark = document.body.classList.contains('dark');
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';

        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];

            p.phase += p.speed;
            p.x += p.vx + Math.sin(p.phase) * 0.18;
            p.y += p.vy + Math.cos(p.phase * 0.7) * 0.14;

            if (mouse.active) {
                var dx = p.x - mouse.x;
                var dy = p.y - mouse.y;
                var dist2 = dx * dx + dy * dy;
                var radius = 130;
                if (dist2 < radius * radius && dist2 > 0.5) {
                    var dist = Math.sqrt(dist2);
                    var force = (1 - dist / radius) * 1.6;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }
            }

            p.vx *= 0.94;
            p.vy *= 0.94;

            var maxV = 3.5;
            if (p.vx > maxV) p.vx = maxV;
            else if (p.vx < -maxV) p.vx = -maxV;
            if (p.vy > maxV) p.vy = maxV;
            else if (p.vy < -maxV) p.vy = -maxV;

            if (p.x < -10) p.x = W + 10;
            else if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            else if (p.y > H + 10) p.y = -10;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
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
