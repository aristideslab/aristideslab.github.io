/* ==========================================================================
   ARISTIDES LAB — boid field

   A flocking particle background. Simulation runs on the CPU over typed
   arrays with a uniform spatial hash, which keeps neighbour lookups near
   O(n) instead of O(n²); rendering goes through WebGL2 as gl.POINTS so the
   whole flock is one draw call, with a Canvas2D fallback at lower density.

   Trails are motion blur, not stored paths: each frame paints the background
   colour over the previous frame at a low alpha, so old positions decay
   exponentially. That costs one quad regardless of trail length, and makes
   the length a single uniform the slider can drive.

   Talks to app.js only through events (lab:section, lab:theme, lab:trail)
   and the shared window.LAB palette.
   ========================================================================== */
(function () {
    'use strict';

    var canvas = document.getElementById('field');
    if (!canvas) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var coarse = window.matchMedia('(pointer: coarse)').matches;

    /* ---------------------------------------------------------------- state */
    var W = 0, H = 0, dpr = 1;
    var N = 0;
    var px, py, vx, vy, size, colA, colB, wander;
    var gridW, gridH, cellSize = 46, cellHead, cellNext;

    var pointer = { x: -9999, y: -9999, on: false };
    var burst = null;                 // active click influence
    var wipe = null;                  // active colour wipe
    var trail = 0.4;                  // 0 = none, 1 = longest

    var palette = [];                 // [[r,g,b], ...] for the current theme
    var bg = [243, 242, 238];
    var bgTarget = bg.slice();

    /* --------------------------------------------------------------- palette */
    function buildPalette() {
        var LAB = window.LAB;
        var dark = document.body.classList.contains('dark');
        palette = [];
        if (LAB && LAB.hues && LAB.oklch) {
            for (var i = 0; i < LAB.hues.length; i++) {
                palette.push(LAB.oklch(dark ? 0.76 : 0.62, 0.19, LAB.hues[i].h));
            }
        } else {
            palette = [[224, 60, 0]];
        }
    }

    // Reads the --bg token rather than the resolved background-color: body
    // transitions its background over 400ms, so querying the computed colour
    // straight after a theme toggle returns the colour we are leaving, not the
    // one we are heading to. Custom properties are not interpolated, so the
    // token is correct immediately.
    function readBg() {
        var v = window.getComputedStyle(document.body).getPropertyValue('--bg').trim();
        var c = parseColour(v);
        if (c) bgTarget = c;
    }

    function parseColour(v) {
        if (!v) return null;
        if (v.charAt(0) === '#') {
            if (v.length === 4) {
                return [parseInt(v[1] + v[1], 16), parseInt(v[2] + v[2], 16), parseInt(v[3] + v[3], 16)];
            }
            return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
        }
        var m = v.match(/[\d.]+/g);
        return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null;
    }

    function randomColour() { return palette[(Math.random() * palette.length) | 0]; }

    /* ------------------------------------------------------------ simulation */
    function allocate(count) {
        N = count;
        px = new Float32Array(N); py = new Float32Array(N);
        vx = new Float32Array(N); vy = new Float32Array(N);
        size = new Float32Array(N);
        wander = new Float32Array(N);
        colA = new Float32Array(N * 3);
        colB = new Float32Array(N * 3);
        for (var i = 0; i < N; i++) {
            px[i] = Math.random() * W;
            py[i] = Math.random() * H;
            var a = Math.random() * 6.2832, s = 0.5 + Math.random() * 1.1;
            vx[i] = Math.cos(a) * s; vy[i] = Math.sin(a) * s;
            size[i] = 1.1 + Math.random() * 1.9;
            wander[i] = Math.random() * 6.2832;
            setColour(colA, i, randomColour());
            setColour(colB, i, randomColour());
        }
    }

    function setColour(arr, i, c) {
        arr[i * 3] = c[0] / 255; arr[i * 3 + 1] = c[1] / 255; arr[i * 3 + 2] = c[2] / 255;
    }

    function buildGrid() {
        gridW = Math.max(1, Math.ceil(W / cellSize));
        gridH = Math.max(1, Math.ceil(H / cellSize));
        var cells = gridW * gridH;
        if (!cellHead || cellHead.length !== cells) cellHead = new Int32Array(cells);
        if (!cellNext || cellNext.length !== N) cellNext = new Int32Array(N);
        cellHead.fill(-1);
        for (var i = 0; i < N; i++) {
            var cx = (px[i] / cellSize) | 0, cy = (py[i] / cellSize) | 0;
            if (cx < 0) cx = 0; else if (cx >= gridW) cx = gridW - 1;
            if (cy < 0) cy = 0; else if (cy >= gridH) cy = gridH - 1;
            var c = cy * gridW + cx;
            cellNext[i] = cellHead[c];
            cellHead[c] = i;
        }
    }

    var SEP_R2 = 17 * 17, NEI_R2 = 42 * 42;
    var MAXV = 2.4, MINV = 0.65;

    // Global timescale. Applied to acceleration, integration and the wander
    // phase together, so it stretches time rather than just shortening each
    // step — the flock traces the same paths, it simply takes twice as long to
    // trace them. Scaling only the position step would keep the turn rate per
    // frame and make the paths tighter and curlier instead of slower.
    var DT = 0.5;

    function stepSim(t) {
        buildGrid();

        for (var i = 0; i < N; i++) {
            var x = px[i], y = py[i];
            var sepx = 0, sepy = 0, alix = 0, aliy = 0, cohx = 0, cohy = 0, n = 0;

            var cx = (x / cellSize) | 0, cy = (y / cellSize) | 0;
            for (var oy = -1; oy <= 1; oy++) {
                var gy = cy + oy; if (gy < 0 || gy >= gridH) continue;
                for (var ox = -1; ox <= 1; ox++) {
                    var gx = cx + ox; if (gx < 0 || gx >= gridW) continue;
                    for (var j = cellHead[gy * gridW + gx]; j !== -1; j = cellNext[j]) {
                        if (j === i) continue;
                        var dx = px[j] - x, dy = py[j] - y;
                        var d2 = dx * dx + dy * dy;
                        if (d2 > NEI_R2 || d2 === 0) continue;
                        if (d2 < SEP_R2) { sepx -= dx / d2; sepy -= dy / d2; }
                        alix += vx[j]; aliy += vy[j];
                        cohx += px[j]; cohy += py[j];
                        n++;
                    }
                }
            }

            var ax = sepx * 26, ay = sepy * 26;
            if (n > 0) {
                ax += (alix / n - vx[i]) * 0.055;
                ay += (aliy / n - vy[i]) * 0.055;
                ax += (cohx / n - x) * 0.0016;
                ay += (cohy / n - y) * 0.0016;
            }

            // per-boid wander keeps the flock from settling into a steady state
            wander[i] += 0.045 * DT;
            ax += Math.cos(wander[i]) * 0.035;
            ay += Math.sin(wander[i]) * 0.035;

            // gentle parting around the cursor
            if (pointer.on) {
                var mx = x - pointer.x, my = y - pointer.y;
                var md2 = mx * mx + my * my;
                if (md2 < 9000 && md2 > 1) {
                    var f = 12 / md2;
                    ax += mx * f; ay += my * f;
                }
            }

            if (burst) { burstForce(i, x, y); ax += bfx; ay += bfy; }

            vx[i] += ax * DT; vy[i] += ay * DT;

            var sp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
            if (sp > MAXV) { vx[i] *= MAXV / sp; vy[i] *= MAXV / sp; }
            else if (sp < MINV && sp > 0) { vx[i] *= MINV / sp; vy[i] *= MINV / sp; }

            x += vx[i] * DT; y += vy[i] * DT;
            if (x < -8) x += W + 16; else if (x > W + 8) x -= W + 16;
            if (y < -8) y += H + 16; else if (y > H + 8) y -= H + 16;
            px[i] = x; py[i] = y;
        }

        if (burst && !burst.held) {
            burst.life -= 1 / 60;
            if (burst.life <= 0) burst = null;
        }
    }

    /* ------------------------------------------------- click influence field */
    var bfx = 0, bfy = 0;

    // writes the pair into bfx/bfy rather than returning, so one distance
    // computation serves both axes
    function burstForce(i, x, y) {
        bfx = 0; bfy = 0;
        var dx = x - burst.x, dy = y - burst.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 1) d2 = 1;
        var d = Math.sqrt(d2);
        if (d > burst.radius) return;

        var falloff = (1 - d / burst.radius) * (burst.life / burst.max);
        var nx = dx / d, ny = dy / d;
        var k;

        switch (burst.kind) {
            case 'attract':
                k = -1.9 * falloff; bfx = nx * k; bfy = ny * k; break;
            case 'repel':
                k = 2.4 * falloff; bfx = nx * k; bfy = ny * k; break;
            case 'orbit': {
                var ring = (burst.radius * 0.42 - d) * 0.02 * falloff;   // pull to a fixed radius
                bfx = nx * ring - ny * 1.5 * falloff;
                bfy = ny * ring + nx * 1.5 * falloff;
                break;
            }
            case 'zigzag': {
                var w = Math.sin(d * 0.07 - burst.age * 7) * 2.1 * falloff;
                bfx = -ny * w; bfy = nx * w;
                break;
            }
            case 'shockwave': {
                var ringR = (1 - burst.life / burst.max) * burst.radius;
                var band = Math.max(0, 1 - Math.abs(d - ringR) / 55);
                k = band * 4.2;
                bfx = nx * k; bfy = ny * k;
                break;
            }
            case 'vortex':
                k = 2.6 * falloff;
                bfx = -ny * k + nx * 0.35 * falloff;
                bfy = nx * k + ny * 0.35 * falloff;
                break;
            case 'scatter': {
                var jitter = ((i * 2654435761) % 1000) / 1000 - 0.5;
                k = 3.0 * falloff;
                bfx = (nx + jitter) * k; bfy = (ny - jitter) * k;
                break;
            }
        }
    }

    // Press and hold gathers the flock into a ring and keeps it there. While
    // held the life never ticks down, so the falloff term stays at 1 and the
    // orbit is sustained indefinitely; release starts the decay.
    function fireBurst(x, y) {
        var max = 1.1;
        burst = { kind: 'orbit', x: x, y: y, radius: 330, life: max, max: max, age: 0, held: true };

        // every click also recolours nearby boids — a local version of the wipe
        var r2 = 270 * 270;
        for (var i = 0; i < N; i++) {
            var dx = px[i] - x, dy = py[i] - y;
            if (dx * dx + dy * dy < r2) setColour(colA, i, randomColour());
        }
        uploadColours();
    }

    /* ------------------------------------------------------------ colour wipe */
    function startWipe(dir) {
        for (var i = 0; i < N; i++) {
            var c = randomColour(), a = colA[i * 3] * 255;
            if (Math.abs(c[0] - a) < 26) c = randomColour();   // avoid a near-invisible swap
            setColour(colB, i, c);
        }
        uploadColours();
        wipe = { dir: dir, pos: dir > 0 ? H + 40 : -40, life: 1 };
    }

    function stepWipe() {
        if (!wipe) return;
        var speed = (H + 80) / 42;                 // ~0.7s at 60fps
        wipe.pos += wipe.dir > 0 ? -speed : speed;
        var done = wipe.dir > 0 ? wipe.pos < -40 : wipe.pos > H + 40;
        if (done) {
            colA.set(colB);
            uploadColours();
            wipe = null;
        }
    }

    /* ------------------------------------------------------------- rendering */
    var mode = null, gl = null, R = null;

    function initGL() {
        // preserveDrawingBuffer is load-bearing, not an optimisation knob: the
        // trails are produced by fading the PREVIOUS frame, and without this the
        // browser wipes the drawing buffer after compositing, leaving nothing to
        // fade. The symptom is a background of exactly bg x fadeAlpha.
        gl = canvas.getContext('webgl2', {
            alpha: false, antialias: false, preserveDrawingBuffer: true
        });
        if (!gl) return false;

        function sh(type, src) {
            var s = gl.createShader(type);
            gl.shaderSource(s, src); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.warn('boids shader:', gl.getShaderInfoLog(s)); return null;
            }
            return s;
        }
        function prog(vs, fs) {
            var a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
            if (!a || !b) return null;
            var p = gl.createProgram();
            gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
            return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
        }

        var pointVS = `#version 300 es
        in vec2 aPos; in vec3 aColA; in vec3 aColB; in float aSize;
        uniform vec2 uRes; uniform float uWipeY; uniform float uWipeDir; uniform float uDpr;
        out vec3 vCol;
        void main(){
          vec2 c = (aPos / uRes) * 2.0 - 1.0; c.y = -c.y;
          gl_Position = vec4(c, 0.0, 1.0);
          gl_PointSize = aSize * uDpr;
          bool passed = uWipeDir > 0.0 ? (aPos.y > uWipeY) : (aPos.y < uWipeY);
          vCol = (uWipeDir == 0.0) ? aColA : (passed ? aColB : aColA);
        }`;

        var pointFS = `#version 300 es
        precision mediump float;
        in vec3 vCol; out vec4 frag;
        void main(){
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.28, r);
          if (a < 0.01) discard;
          frag = vec4(vCol, a);
        }`;

        var quadVS = `#version 300 es
        const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
        void main(){ gl_Position = vec4(P[gl_VertexID], 0., 1.); }`;

        var fadeFS = `#version 300 es
        precision mediump float;
        uniform vec3 uBg; uniform float uFade; out vec4 frag;
        void main(){ frag = vec4(uBg, uFade); }`;

        var pPoint = prog(pointVS, pointFS), pFade = prog(quadVS, fadeFS);
        if (!pPoint || !pFade) return false;

        R = {
            pPoint: pPoint, pFade: pFade,
            vao: gl.createVertexArray(),
            bPos: gl.createBuffer(), bColA: gl.createBuffer(), bColB: gl.createBuffer(), bSize: gl.createBuffer(),
            quadVao: gl.createVertexArray(),
            u: {
                res: gl.getUniformLocation(pPoint, 'uRes'),
                wipeY: gl.getUniformLocation(pPoint, 'uWipeY'),
                wipeDir: gl.getUniformLocation(pPoint, 'uWipeDir'),
                dpr: gl.getUniformLocation(pPoint, 'uDpr'),
                bgc: gl.getUniformLocation(pFade, 'uBg'),
                fade: gl.getUniformLocation(pFade, 'uFade')
            },
            posBuf: null
        };

        gl.bindVertexArray(R.vao);
        function attr(buf, loc, n, data) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
        }
        R.posBuf = new Float32Array(N * 2);
        attr(R.bPos,  gl.getAttribLocation(pPoint, 'aPos'),  2, R.posBuf);
        attr(R.bColA, gl.getAttribLocation(pPoint, 'aColA'), 3, colA);
        attr(R.bColB, gl.getAttribLocation(pPoint, 'aColB'), 3, colB);
        attr(R.bSize, gl.getAttribLocation(pPoint, 'aSize'), 1, size);
        gl.bindVertexArray(null);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(bg[0] / 255, bg[1] / 255, bg[2] / 255, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return true;
    }

    function uploadColours() {
        if (mode !== 'gl' || !R) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, R.bColA); gl.bufferSubData(gl.ARRAY_BUFFER, 0, colA);
        gl.bindBuffer(gl.ARRAY_BUFFER, R.bColB); gl.bufferSubData(gl.ARRAY_BUFFER, 0, colB);
    }

    // trail 0 -> heavy fade (no tail); trail 1 -> light fade (long tail)
    function fadeAlpha() { return 0.42 - trail * 0.37; }

    function drawGL() {
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.useProgram(R.pFade);
        gl.uniform3f(R.u.bgc, bg[0] / 255, bg[1] / 255, bg[2] / 255);
        gl.uniform1f(R.u.fade, fadeAlpha());
        gl.bindVertexArray(R.quadVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        for (var i = 0; i < N; i++) { R.posBuf[i * 2] = px[i]; R.posBuf[i * 2 + 1] = py[i]; }
        gl.useProgram(R.pPoint);
        gl.uniform2f(R.u.res, W, H);
        gl.uniform1f(R.u.dpr, dpr);
        gl.uniform1f(R.u.wipeY, wipe ? wipe.pos : 0);
        gl.uniform1f(R.u.wipeDir, wipe ? wipe.dir : 0);
        gl.bindVertexArray(R.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, R.bPos);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, R.posBuf);
        gl.drawArrays(gl.POINTS, 0, N);
        gl.bindVertexArray(null);
    }

    var ctx2d = null;
    function drawer2D() {
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx2d.globalAlpha = fadeAlpha();
        ctx2d.fillStyle = 'rgb(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ')';
        ctx2d.fillRect(0, 0, W, H);
        ctx2d.globalAlpha = 1;
        for (var i = 0; i < N; i++) {
            var c;
            if (wipe) {
                var passed = wipe.dir > 0 ? py[i] > wipe.pos : py[i] < wipe.pos;
                c = passed ? colB : colA;
            } else c = colA;
            ctx2d.fillStyle = 'rgb(' + ((c[i * 3] * 255) | 0) + ',' + ((c[i * 3 + 1] * 255) | 0) + ',' + ((c[i * 3 + 2] * 255) | 0) + ')';
            ctx2d.beginPath();
            ctx2d.arc(px[i], py[i], size[i] * 0.5, 0, 6.2832);
            ctx2d.fill();
        }
    }

    /* ------------------------------------------------------------------ loop */
    var raf = null, lastT = 0;

    function frame(t) {
        if (burst) burst.age += 1 / 60;
        stepSim(t);
        stepWipe();

        for (var k = 0; k < 3; k++) bg[k] += (bgTarget[k] - bg[k]) * 0.12;

        if (mode === 'gl') drawGL(); else drawer2D();
        raf = requestAnimationFrame(frame);
    }

    var enabled = true;

    function start() { if (!raf && !reduceMotion && enabled) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    // leaves a flat ground in the page colour rather than a frozen last frame
    function clearToBg() {
        if (mode === 'gl' && gl) {
            gl.clearColor(bgTarget[0] / 255, bgTarget[1] / 255, bgTarget[2] / 255, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        } else if (ctx2d) {
            ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx2d.globalAlpha = 1;
            ctx2d.fillStyle = 'rgb(' + bgTarget.join(',') + ')';
            ctx2d.fillRect(0, 0, W, H);
        }
    }

    /* ----------------------------------------------------------------- sizing */
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        if (mode === 'gl' && R) {
            gl.clearColor(bg[0] / 255, bg[1] / 255, bg[2] / 255, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
    }

    /* ------------------------------------------------------------------- boot */
    readBg(); bg = bgTarget.slice(); buildPalette();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;

    var probe = document.createElement('canvas').getContext('webgl2');
    var wantGL = !!probe;
    var count = wantGL ? (coarse ? 520 : 1300) : (coarse ? 260 : 520);
    allocate(count);
    resize();

    if (wantGL && initGL()) {
        mode = 'gl';
    } else {
        mode = '2d';
        ctx2d = canvas.getContext('2d');
        if (N > 520) { allocate(coarse ? 260 : 520); }
        ctx2d.fillStyle = 'rgb(' + bg.join(',') + ')';
        ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (reduceMotion) { stepSim(0); mode === 'gl' ? drawGL() : drawer2D(); }
    else start();

    /* ---------------------------------------------------------------- wiring */
    var rt = null;
    window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () { resize(); }, 140);
    });

    window.addEventListener('pointermove', function (e) {
        pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true;
    }, { passive: true });
    function pointerAway() { pointer.on = false; }
    window.addEventListener('pointerleave', pointerAway);
    document.addEventListener('mouseleave', pointerAway);
    window.addEventListener('blur', pointerAway);

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
    });

    window.addEventListener('lab:section', function (e) {
        startWipe(e.detail && e.detail.dir < 0 ? -1 : 1);
    });

    window.addEventListener('lab:theme', function () {
        readBg(); buildPalette();
        for (var i = 0; i < N; i++) { setColour(colA, i, randomColour()); setColour(colB, i, randomColour()); }
        uploadColours();
    });

    window.addEventListener('lab:trail', function (e) { trail = e.detail.value; });

    window.addEventListener('lab:motion', function (e) {
        enabled = !!e.detail.on;
        if (enabled) start();
        else { stop(); burst = null; clearToBg(); }
    });

    function moveBurst(x, y) { if (burst && burst.held) { burst.x = x; burst.y = y; } }
    function releaseBurst() { if (burst) burst.held = false; }

    window.LabField = {
        burst: fireBurst,
        move: moveBurst,
        release: releaseBurst,
        // mean on-screen displacement per frame, in CSS pixels
        speed: function () {
            var sum = 0;
            for (var i = 0; i < N; i++) sum += Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
            return (sum / N) * DT;
        }
    };

})();
