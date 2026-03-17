(function() {
    var wPressCount = 0;
    var wTimeout = null;
    var gameActive = false;

    document.addEventListener('keydown', function(e) {
        if (gameActive) return;
        if (e.key === 'w' || e.key === 'W') {
            clearTimeout(wTimeout);

            wPressCount++;

            if (wPressCount === 1) {
                // First press — reset after 3 seconds if no follow-up
                wTimeout = setTimeout(function() { wPressCount = 0; }, 3000);
            } else if (wPressCount === 2) {
                // Second press — show warning
                showWarning();
                wTimeout = setTimeout(function() { wPressCount = 0; removeWarning(); }, 5000);
            } else if (wPressCount >= 3) {
                // Third press — launch snake
                wPressCount = 0;
                removeWarning();
                launchSnake();
            }
        }
    });

    function showWarning() {
        if (document.getElementById('snake-warning')) return;
        var w = document.createElement('div');
        w.id = 'snake-warning';
        w.innerHTML = '<div class="snake-warning-box">WARNING: You are about to enter snake mode.<br>Press <b>W</b> again to play.</div>';
        document.body.appendChild(w);
    }

    function removeWarning() {
        var w = document.getElementById('snake-warning');
        if (w) w.remove();
    }

    function launchSnake() {
        gameActive = true;

        // Hide sidebar links
        var sidebar = document.querySelector('.social-sidebar');
        if (sidebar) sidebar.style.display = 'none';

        // Create fullscreen overlay
        var overlay = document.createElement('div');
        overlay.id = 'snake-overlay';

        var labels = ['IG', 'PA', 'GH', 'YT'];

        // Grid config
        var COLS = 20;
        var ROWS = 20;
        var CELL = 0; // computed on resize

        // Game state
        var snake = [{x: 10, y: 10}, {x: 9, y: 10}, {x: 8, y: 10}, {x: 7, y: 10}];
        var dir = {x: 1, y: 0};
        var nextDir = {x: 1, y: 0};
        var food = {x: 15, y: 10};
        var score = 0;
        var gameOver = false;
        var interval = null;
        var speed = 130;

        // Build overlay HTML
        overlay.innerHTML =
            '<div id="snake-hud">' +
                '<span id="snake-score">SCORE: 0</span>' +
                '<span id="snake-quit">ESC to quit</span>' +
            '</div>' +
            '<canvas id="snake-canvas"></canvas>' +
            '<div id="snake-gameover" style="display:none;">' +
                '<div class="snake-go-box">' +
                    '<div id="snake-go-text">GAME OVER</div>' +
                    '<div id="snake-go-score"></div>' +
                    '<div id="snake-go-hint">Press SPACE to restart or ESC to quit</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var canvas = document.getElementById('snake-canvas');
        var ctx = canvas.getContext('2d');

        function resize() {
            var size = Math.min(window.innerWidth - 40, window.innerHeight - 100, 600);
            CELL = Math.floor(size / COLS);
            canvas.width = COLS * CELL;
            canvas.height = ROWS * CELL;
        }
        resize();
        window.addEventListener('resize', resize);

        function isDark() {
            return document.body.classList.contains('dark');
        }

        function placeFood() {
            var valid = false;
            while (!valid) {
                food.x = Math.floor(Math.random() * COLS);
                food.y = Math.floor(Math.random() * ROWS);
                valid = true;
                for (var i = 0; i < snake.length; i++) {
                    if (snake[i].x === food.x && snake[i].y === food.y) {
                        valid = false;
                        break;
                    }
                }
            }
        }

        function draw() {
            var dark = isDark();

            // Background
            ctx.fillStyle = dark ? '#050505' : '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Grid lines
            ctx.strokeStyle = dark ? '#1a1a1a' : '#f0f0f0';
            ctx.lineWidth = 0.5;
            for (var gx = 0; gx <= COLS; gx++) {
                ctx.beginPath();
                ctx.moveTo(gx * CELL, 0);
                ctx.lineTo(gx * CELL, ROWS * CELL);
                ctx.stroke();
            }
            for (var gy = 0; gy <= ROWS; gy++) {
                ctx.beginPath();
                ctx.moveTo(0, gy * CELL);
                ctx.lineTo(COLS * CELL, gy * CELL);
                ctx.stroke();
            }

            // Snake body — styled as social-link blocks
            for (var i = 0; i < snake.length; i++) {
                var seg = snake[i];
                var isHead = (i === 0);

                if (dark) {
                    ctx.fillStyle = isHead ? '#ffffff' : '#ffffff';
                    ctx.strokeStyle = '#333333';
                } else {
                    ctx.fillStyle = isHead ? '#000000' : '#000000';
                    ctx.strokeStyle = '#cccccc';
                }

                ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
                ctx.strokeRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);

                // Label text inside each block
                var label = labels[i % labels.length];
                ctx.fillStyle = dark ? '#000000' : '#ffffff';
                ctx.font = 'bold ' + Math.floor(CELL * 0.4) + 'px Monaco, Menlo, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, seg.x * CELL + CELL / 2, seg.y * CELL + CELL / 2);
            }

            // Food — @ symbol
            ctx.fillStyle = dark ? '#ffffff' : '#000000';
            ctx.font = 'bold ' + Math.floor(CELL * 0.7) + 'px Monaco, Menlo, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('@', food.x * CELL + CELL / 2, food.y * CELL + CELL / 2);

            // Border
            ctx.strokeStyle = dark ? '#444444' : '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
        }

        function tick() {
            if (gameOver) return;

            dir.x = nextDir.x;
            dir.y = nextDir.y;

            var head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

            // Wall collision
            if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
                endGame();
                return;
            }

            // Self collision
            for (var i = 0; i < snake.length; i++) {
                if (snake[i].x === head.x && snake[i].y === head.y) {
                    endGame();
                    return;
                }
            }

            snake.unshift(head);

            // Eat food
            if (head.x === food.x && head.y === food.y) {
                score++;
                document.getElementById('snake-score').textContent = 'SCORE: ' + score;
                placeFood();
                // Speed up slightly
                if (speed > 60) {
                    speed -= 2;
                    clearInterval(interval);
                    interval = setInterval(tick, speed);
                }
            } else {
                snake.pop();
            }

            draw();
        }

        function endGame() {
            gameOver = true;
            clearInterval(interval);
            document.getElementById('snake-gameover').style.display = 'flex';
            document.getElementById('snake-go-score').textContent = 'SCORE: ' + score;
        }

        function resetGame() {
            snake = [{x: 10, y: 10}, {x: 9, y: 10}, {x: 8, y: 10}, {x: 7, y: 10}];
            dir = {x: 1, y: 0};
            nextDir = {x: 1, y: 0};
            score = 0;
            speed = 130;
            gameOver = false;
            document.getElementById('snake-score').textContent = 'SCORE: 0';
            document.getElementById('snake-gameover').style.display = 'none';
            placeFood();
            draw();
            interval = setInterval(tick, speed);
        }

        function quit() {
            gameActive = false;
            clearInterval(interval);
            window.removeEventListener('resize', resize);
            overlay.remove();
            if (sidebar) sidebar.style.display = '';
        }

        // Controls
        document.addEventListener('keydown', function handler(e) {
            if (!gameActive) {
                document.removeEventListener('keydown', handler);
                return;
            }

            if (e.key === 'Escape') {
                quit();
                document.removeEventListener('keydown', handler);
                return;
            }

            if (e.key === ' ' && gameOver) {
                e.preventDefault();
                resetGame();
                return;
            }

            // Prevent reversing direction
            if ((e.key === 'ArrowUp' || e.key === 'w') && dir.y !== 1) {
                nextDir = {x: 0, y: -1};
            } else if ((e.key === 'ArrowDown' || e.key === 's') && dir.y !== -1) {
                nextDir = {x: 0, y: 1};
            } else if ((e.key === 'ArrowLeft' || e.key === 'a') && dir.x !== 1) {
                nextDir = {x: -1, y: 0};
            } else if ((e.key === 'ArrowRight' || e.key === 'd') && dir.x !== -1) {
                nextDir = {x: 1, y: 0};
            }

            e.preventDefault();
        });

        // Start
        placeFood();
        draw();
        interval = setInterval(tick, speed);
    }
})();
