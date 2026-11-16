const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const COLS = 8;
const ROWS = 10;
let CELL_SIZE = 40;

const offScreenCanvas = document.createElement('canvas');
const offCtx = offScreenCanvas.getContext('2d');

function resizeCanvas() {
    const maxWidth = window.innerWidth * 0.95;
    const maxHeight = window.innerHeight * 0.78;
    
    let w = maxWidth;
    let h = w * (ROWS / COLS);
    
    if (h > maxHeight) {
        h = maxHeight;
        w = h * (COLS / ROWS);
    }
    
    canvas.width = w;
    canvas.height = h;
    CELL_SIZE = w / COLS;

    initOffscreenBackground(w, h);
}

function initOffscreenBackground(width, height) {
    offScreenCanvas.width = width;
    offScreenCanvas.height = height;
    offCtx.fillStyle = '#0D1117';
    offCtx.fillRect(0, 0, width, height);

    offCtx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    offCtx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
        offCtx.beginPath();
        offCtx.moveTo(0, r * CELL_SIZE);
        offCtx.lineTo(width, r * CELL_SIZE);
        offCtx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
        offCtx.beginPath();
        offCtx.moveTo(c * CELL_SIZE, 0);
        offCtx.lineTo(c * CELL_SIZE, height);
        offCtx.stroke();
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let audioCtx = null;
let audioInitialized = false;

function initAudio() {
    if (audioInitialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
        audioCtx = new AudioContext();
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
        audioInitialized = true;
    }
}

window.addEventListener('touchstart', initAudio, { once: true });
window.addEventListener('click', initAudio, { once: true });

class ParticlePool {
    constructor(maxSize = 120) {
        this.pool = [];
        for (let i = 0; i < maxSize; i++) {
            this.pool.push({
                x: 0, y: 0,
                vx: 0, vy: 0,
                color: '#00F0FF',
                life: 0, maxLife: 30,
                active: false
            });
        }
    }

    spawn(x, y, color) {
        const p = this.pool.find(item => !item.active);
        if (p) {
            p.x = x;
            p.y = y;
            p.vx = (Math.random() - 0.5) * 6;
            p.vy = (Math.random() - 0.5) * 6;
            p.color = color;
            p.life = 0;
            p.maxLife = 20 + Math.random() * 25;
            p.active = true;
        }
    }

    updateAndDraw(targetCtx) {
        for (let i = 0; i < this.pool.length; i++) {
            const p = this.pool[i];
            if (p.active) {
                p.x += p.vx;
                p.y += p.vy;
                p.life++;
                if (p.life >= p.maxLife) {
                    p.active = false;
                } else {
                    targetCtx.fillStyle = p.color;
                    targetCtx.fillRect(p.x, p.y, 3, 3);
                }
            }
        }
    }
}

const particlePool = new ParticlePool();

class GameState {
    constructor() {
        this.score = 0;
        this.pins = 5;
        this.feverMeter = 0;
        this.feverActive = false;
        this.feverTimer = 0;
        this.gameOver = false;
        this.grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
        this.selectedCol = null;
        this.initDefaultGrid();
    }

    initDefaultGrid() {
        for (let r = 3; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (Math.random() > 0.32) {
                    const color = Math.floor(Math.random() * 4) + 1;
                    const randType = Math.random();
                    let type = 'normal';
                    if (randType > 0.94) type = 'bomb';
                    else if (randType > 0.88) type = 'tachyon';
                    else if (randType > 0.82) type = 'singularity';

                    this.grid[r][c] = { color, pinActive: true, type };
                }
            }
        }
    }
}

const game = new GameState();

const neonColors = {
    1: '#FF007F',
    2: '#00F0FF',
    3: '#5CFF85',
    4: '#BC13FE'
};

canvas.addEventListener('pointerdown', (e) => {
    if (game.gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        game.selectedCol = col;
        processPinInteraction(col, row);
    }
});

canvas.addEventListener('pointerup', () => {
    game.selectedCol = null;
});

function processPinInteraction(col, row) {
    if (navigator.vibrate) navigator.vibrate(40);
    const cell = game.grid[row][col];
    if (cell && cell.pinActive) {
        cell.pinActive = false;
        for (let i = 0; i < 8; i++) {
            particlePool.spawn(col * CELL_SIZE + CELL_SIZE/2, row * CELL_SIZE + CELL_SIZE/2, neonColors[cell.color]);
        }
        if (cell.type === 'bomb') triggerBombExplosion(col, row);
        else if (cell.type === 'tachyon') triggerTachyonFloat(col, row);
        else if (cell.type === 'singularity') triggerSingularitySuction(col, row);

        applyGravity();
        processMatches();
    }
}

function triggerBombExplosion(centerC, centerR) {
    for (let r = centerR - 1; r <= centerR + 1; r++) {
        for (let c = centerC - 1; c <= centerC + 1; c++) {
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                game.grid[r][c] = null;
                particlePool.spawn(c * CELL_SIZE + CELL_SIZE/2, r * CELL_SIZE + CELL_SIZE/2, '#FFFFFF');
            }
        }
    }
    game.score += game.feverActive ? 750 : 250;
}

function triggerTachyonFloat(centerC, centerR) {
    if (centerR > 0 && game.grid[centerR - 1][centerC]) {
        game.grid[centerR - 1][centerC].pinActive = false;
        game.score += 150;
    }
}

function triggerSingularitySuction(centerC, centerR) {
    const neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
    neighbors.forEach(([dc, dr]) => {
        const nc = centerC + dc;
        const nr = centerR + dr;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
            game.grid[nr][nc] = null;
        }
    });
    game.score += 400;
}

function applyGravity() {
    for (let c = 0; c < COLS; c++) {
        let writeRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (game.grid[r][c] !== null) {
                if (!game.grid[r][c].pinActive) {
                    game.grid[r][c] = null;
                } else {
                    let temp = game.grid[r][c];
                    game.grid[r][c] = null;
                    game.grid[writeRow][c] = temp;
                    writeRow--;
                }
            }
        }
    }
}

function processMatches() {
    const multiplier = game.feverActive ? 5 : 1;
    game.score += 50 * multiplier;
    game.feverMeter += 20;

    if (game.feverMeter >= 100 && !game.feverActive) {
        game.feverActive = true;
        game.feverTimer = Date.now() + 15000;
        game.feverMeter = 100;
    }
}

function update() {
    if (game.feverActive && Date.now() > game.feverTimer) {
        game.feverActive = false;
        game.feverMeter = 0;
    }
    document.getElementById('scoreVal').innerText = game.score;
    document.getElementById('feverVal').innerText = `${game.feverMeter}%`;
    document.getElementById('pinsVal').innerText = game.pins;
}

function render() {
    ctx.drawImage(offScreenCanvas, 0, 0);

    if (game.feverActive) {
        const pulse = Math.sin(Date.now() / 100) * 0.12 + 0.22;
        ctx.fillStyle = `rgba(188, 19, 254, ${pulse})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = game.grid[r][c];
            const x = c * CELL_SIZE;
            const y = r * CELL_SIZE;

            if (cell) {
                ctx.shadowColor = neonColors[cell.color];
                ctx.shadowBlur = cell.pinActive ? 8 : 2;
                ctx.fillStyle = neonColors[cell.color];
                ctx.fillRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
                ctx.shadowBlur = 0;

                ctx.fillStyle = '#05050A';
                ctx.fillRect(x + 10, y + 10, CELL_SIZE - 20, CELL_SIZE - 20);

                if (cell.type === 'bomb') {
                    ctx.fillStyle = '#FF007F';
                    ctx.beginPath();
                    ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, 5, 0, Math.PI * 2);
                    ctx.fill();
                } else if (cell.type === 'tachyon') {
                    ctx.fillStyle = '#00F0FF';
                    ctx.fillRect(x + CELL_SIZE/2 - 4, y + CELL_SIZE/2 - 4, 8, 8);
                } else if (cell.type === 'singularity') {
                    ctx.fillStyle = '#BC13FE';
                    ctx.beginPath();
                    ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    particlePool.updateAndDraw(ctx);

    if (game.selectedCol !== null) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(game.selectedCol * CELL_SIZE + CELL_SIZE / 2, 0);
        ctx.lineTo(game.selectedCol * CELL_SIZE + CELL_SIZE / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
