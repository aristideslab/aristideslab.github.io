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
        w.textContent = 'press W again to play snake';
        document.body.appendChild(w);
    }

    function removeWarning() {
        var w = document.getElementById('snake-warning');
        if (w) w.remove();
    }

    function launchSnake() {
        gameActive = true;

        // Lock scroll
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);

        // Hide sidebar
        var sidebar = document.querySelector('.social-sidebar');
        if (sidebar) sidebar.style.display = 'none';

        // Canvas — directly on body, no wrapper
        var canvas = document.createElement('canvas');
        canvas.id = 'snake-canvas';
        document.body.appendChild(canvas);

        // HUD
        var hud = document.createElement('div');
        hud.id = 'snake-hud';
        hud.innerHTML = '<span id="snake-score">0</span><span id="snake-quit">esc</span>';
        document.body.appendChild(hud);

        // Game over screen (hidden)
        var goScreen = document.createElement('div');
        goScreen.id = 'snake-gameover';
        goScreen.style.display = 'none';
        goScreen.innerHTML =
            '<div id="snake-go-text">GAME OVER</div>' +
            '<div id="snake-go-score"></div>' +
            '<div id="snake-go-hint">space to restart / esc to quit</div>';
        document.body.appendChild(goScreen);

        var ctx = canvas.getContext('2d');
        var labels = ['IG', 'PA', 'GH', 'YT', 'TD', '☕'];
        var CELL = 28;
        var COLS, ROWS;
        var snake, dir, nextDir, food, score, gameOver, interval, speed;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            COLS = Math.floor(canvas.width / CELL);
            ROWS = Math.floor(canvas.height / CELL);
        }

        function placeFood() {
            var tries = 0;
            do {
                food.x = Math.floor(Math.random() * COLS);
                food.y = Math.floor(Math.random() * ROWS);
                var onSnake = false;
                for (var i = 0; i < snake.length; i++) {
                    if (snake[i].x === food.x && snake[i].y === food.y) { onSnake = true; break; }
                }
                tries++;
            } while (onSnake && tries < 500);
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Snake — solid black blocks
            for (var i = 0; i < snake.length; i++) {
                var s = snake[i];
                ctx.fillStyle = '#000000';
                ctx.fillRect(s.x * CELL, s.y * CELL, CELL - 1, CELL - 1);

                // Label
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold ' + Math.floor(CELL * 0.4) + 'px Monaco,Menlo,monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labels[i % labels.length], s.x * CELL + CELL / 2, s.y * CELL + CELL / 2);
            }

            // Food
            ctx.font = 'bold ' + Math.floor(CELL * 0.8) + 'px Monaco,Menlo,monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.strokeText('@', food.x * CELL + CELL / 2, food.y * CELL + CELL / 2);
            ctx.fillStyle = '#000000';
            ctx.fillText('@', food.x * CELL + CELL / 2, food.y * CELL + CELL / 2);
        }

        function tick() {
            if (gameOver) return;
            dir.x = nextDir.x;
            dir.y = nextDir.y;
            var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

            if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) { endGame(); return; }
            for (var i = 0; i < snake.length; i++) {
                if (snake[i].x === head.x && snake[i].y === head.y) { endGame(); return; }
            }

            snake.unshift(head);
            if (head.x === food.x && head.y === food.y) {
                score++;
                document.getElementById('snake-score').textContent = score;
                placeFood();
                if (speed > 60) { speed -= 2; clearInterval(interval); interval = setInterval(tick, speed); }
            } else {
                snake.pop();
            }
            draw();
        }

        function endGame() {
            gameOver = true;
            clearInterval(interval);
            goScreen.style.display = 'flex';
            document.getElementById('snake-go-score').textContent = 'score: ' + score;
        }

        function initGame() {
            resize();
            var cx = Math.floor(COLS / 2);
            var cy = Math.floor(ROWS / 2);
            snake = [{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy},{x:cx-3,y:cy}];
            dir = {x:1,y:0};
            nextDir = {x:1,y:0};
            food = {x:0,y:0};
            score = 0;
            speed = 130;
            gameOver = false;
            document.getElementById('snake-score').textContent = '0';
            goScreen.style.display = 'none';
            placeFood();
            draw();
            clearInterval(interval);
            interval = setInterval(tick, speed);
        }

        function quit() {
            gameActive = false;
            clearInterval(interval);
            window.removeEventListener('resize', onResize);
            canvas.remove();
            hud.remove();
            goScreen.remove();
            document.body.style.overflow = '';
            if (sidebar) sidebar.style.display = '';
        }

        function onResize() { resize(); draw(); }
        window.addEventListener('resize', onResize);

        document.addEventListener('keydown', function handler(e) {
            if (!gameActive) { document.removeEventListener('keydown', handler); return; }
            if (e.key === 'Escape') { quit(); document.removeEventListener('keydown', handler); return; }
            if (e.key === ' ' && gameOver) { e.preventDefault(); initGame(); return; }
            if ((e.key === 'ArrowUp' || e.key === 'w') && dir.y !== 1) nextDir = {x:0,y:-1};
            else if ((e.key === 'ArrowDown' || e.key === 's') && dir.y !== -1) nextDir = {x:0,y:1};
            else if ((e.key === 'ArrowLeft' || e.key === 'a') && dir.x !== 1) nextDir = {x:-1,y:0};
            else if ((e.key === 'ArrowRight' || e.key === 'd') && dir.x !== -1) nextDir = {x:1,y:0};
            e.preventDefault();
        });

        initGame();
    }
})();
