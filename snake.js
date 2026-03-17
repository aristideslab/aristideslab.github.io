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
                wTimeout = setTimeout(function() { wPressCount = 0; }, 3000);
            } else if (wPressCount === 2) {
                showWarning();
                wTimeout = setTimeout(function() { wPressCount = 0; removeWarning(); }, 5000);
            } else if (wPressCount >= 3) {
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
        w.textContent = 'press W again to enter snake mode';
        document.body.appendChild(w);
    }

    function removeWarning() {
        var w = document.getElementById('snake-warning');
        if (w) w.remove();
    }

    function launchSnake() {
        gameActive = true;

        // Lock scrolling
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);

        // Hide sidebar
        var sidebar = document.querySelector('.social-sidebar');
        if (sidebar) sidebar.style.display = 'none';

        // Create transparent overlay with canvas covering the whole page
        var overlay = document.createElement('div');
        overlay.id = 'snake-overlay';
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
                    '<div id="snake-go-hint">SPACE to restart // ESC to quit</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        var canvas = document.getElementById('snake-canvas');
        var ctx = canvas.getContext('2d');

        var labels = ['IG', 'PA', 'GH', 'YT'];
        var CELL = 30;
        var COLS, ROWS;

        // Game state
        var snake, dir, nextDir, food, score, gameOver, interval, speed;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            COLS = Math.floor(canvas.width / CELL);
            ROWS = Math.floor(canvas.height / CELL);
        }

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

            // Clear — transparent so website shows through
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Subtle grid overlay
            ctx.strokeStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
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

            // Snake segments — social-link style blocks
            for (var i = 0; i < snake.length; i++) {
                var seg = snake[i];
                var px = seg.x * CELL;
                var py = seg.y * CELL;

                // Block fill
                ctx.fillStyle = dark ? '#ffffff' : '#000000';
                ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

                // Label
                var label = labels[i % labels.length];
                ctx.fillStyle = dark ? '#000000' : '#ffffff';
                ctx.font = 'bold ' + Math.floor(CELL * 0.4) + 'px Monaco, Menlo, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, px + CELL / 2, py + CELL / 2);
            }

            // Food — @ symbol
            ctx.fillStyle = dark ? '#ffffff' : '#000000';
            ctx.font = 'bold ' + Math.floor(CELL * 0.75) + 'px Monaco, Menlo, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('@', food.x * CELL + CELL / 2, food.y * CELL + CELL / 2);
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

            if (head.x === food.x && head.y === food.y) {
                score++;
                document.getElementById('snake-score').textContent = 'SCORE: ' + score;
                placeFood();
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

        function initGame() {
            resize();
            var startX = Math.floor(COLS / 2);
            var startY = Math.floor(ROWS / 2);
            snake = [
                {x: startX, y: startY},
                {x: startX - 1, y: startY},
                {x: startX - 2, y: startY},
                {x: startX - 3, y: startY}
            ];
            dir = {x: 1, y: 0};
            nextDir = {x: 1, y: 0};
            food = {x: 0, y: 0};
            score = 0;
            speed = 130;
            gameOver = false;
            document.getElementById('snake-score').textContent = 'SCORE: 0';
            document.getElementById('snake-gameover').style.display = 'none';
            placeFood();
            draw();
            clearInterval(interval);
            interval = setInterval(tick, speed);
        }

        function quit() {
            gameActive = false;
            clearInterval(interval);
            window.removeEventListener('resize', onResize);
            overlay.remove();
            document.body.style.overflow = '';
            if (sidebar) sidebar.style.display = '';
        }

        function onResize() {
            resize();
            draw();
        }
        window.addEventListener('resize', onResize);

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
                initGame();
                return;
            }

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

        initGame();
    }
})();
