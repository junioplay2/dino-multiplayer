// 🚨 COLOQUE A SUA URL DO RENDER AQUI EMBAIXO:
const socket = io('https://dino-multiplayer.onrender.com'); 

let currentRoom = '';
let isGameRunning = false;
let isSoloMode = false; 
let score = 0;          
let myName = '';
let gameSpeed = 4.5; 
let obstacleTimer = 0;
let obstacles = [];

// Elementos HTML
const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const displayRoomCode = document.getElementById('displayRoomCode');
const endGameResult = document.getElementById('endGameResult');
const oppWrapper = document.getElementById('oppWrapper');
const myTagType = document.getElementById('myTagType');
const btnRestart = document.getElementById('btnRestart');
const btnMenu = document.getElementById('btnMenu');

// Configuração dos Canvas
const myCanvas = document.getElementById('myCanvas');
const myCtx = myCanvas.getContext('2d');
const oppCanvas = document.getElementById('oppCanvas');
const oppCtx = oppCanvas.getContext('2d');

// Constantes físicas imutáveis
const GRAVITY = 0.6;
const JUMP_FORCE = -11;
const SPAWN_X = 700; // Ponto universal fora da tela (Garante sincronia perfeita)

class Dino {
    constructor(color) {
        this.x = 60;
        this.y = 0;
        this.width = 24;
        this.height = 28;
        this.vy = 0;
        this.isJumping = false;
        this.color = color;
    }
    jump() {
        if (!this.isJumping) {
            this.vy = JUMP_FORCE;
            this.isJumping = true;
        }
    }
    update(floorY) {
        this.vy += GRAVITY;
        this.y += this.vy;
        if (this.y >= floorY) {
            this.y = floorY;
            this.vy = 0;
            this.isJumping = false;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y - this.height, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Obstacle {
    constructor(x) {
        this.x = x;
        this.width = 16;
        this.height = 26;
    }
    update() {
        this.x -= gameSpeed;
    }
    draw(ctx, floorY) {
        ctx.fillStyle = '#ff0055';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0055';
        ctx.fillRect(this.x, floorY - this.height, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

const myDino = new Dino('#00f2fe');
const oppDino = new Dino('#ff0844');

let backgroundX = 0;

function drawScenery(ctx, floorY) {
    // Estrelas Espalhadas pela largura total
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for(let i=1; i<=6; i++) { ctx.fillRect(i * (ctx.canvas.width / 7), 30, 2, 2); }

    // Montanhas Parallax
    backgroundX -= (gameSpeed * 0.05);
    if (backgroundX <= -180) backgroundX = 0;

    ctx.fillStyle = "#1b0d3a";
    for (let i = 0; i < 6; i++) {
        let startX = backgroundX + (i * 180);
        ctx.beginPath();
        ctx.moveTo(startX, floorY);
        ctx.lineTo(startX + 90, floorY - 70);
        ctx.lineTo(startX + 180, floorY);
        ctx.fill();
    }

    // Linha do Chão Neon
    ctx.strokeStyle = ctx.canvas.id === "myCanvas" ? "#00f2fe" : "#ff0844";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(ctx.canvas.width, floorY);
    ctx.stroke();

    // Linhas de perspectiva tridimensionais (Grid)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    let numLines = Math.ceil(ctx.canvas.width / 50) + 2;
    for (let i = 0; i < numLines; i++) {
        let lineX = ((backgroundX * 8) + (i * 50)) % (ctx.canvas.width + 100);
        ctx.beginPath();
        ctx.moveTo(lineX, floorY + 2);
        ctx.lineTo(lineX - 20, ctx.canvas.height);
        ctx.stroke();
    }
}

// --- CONTROLE DE MENUS E REDE ---

document.getElementById('btnSolo').addEventListener('click', () => {
    isSoloMode = true;
    score = 0;
    oppWrapper.style.display = 'none';
    myTagType.innerText = "Pontos:";
    loginScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    setTimeout(initGame, 400);
});

document.getElementById('btnCreate').addEventListener('click', () => {
    isSoloMode = false;
    myName = document.getElementById('playerName').value || 'Player 1';
    socket.emit('create_room', { name: myName });
});

document.getElementById('btnJoin').addEventListener('click', () => {
    isSoloMode = false;
    myName = document.getElementById('playerName').value || 'Player 2';
    const code = document.getElementById('roomCodeInput').value.toUpperCase();
    if (code) socket.emit('join_room', { name: myName, roomCode: code });
});

socket.on('room_created', (roomCode) => {
    currentRoom = roomCode;
    loginScreen.style.display = 'none';
    waitingScreen.style.display = 'flex';
    displayRoomCode.innerText = roomCode;
});

socket.on('start_game', (players) => {
    oppWrapper.style.display = 'flex'; 
    myTagType.innerText = "Você:";
    
    const opp = players.player1.id === socket.id ? players.player2 : players.player1;
    document.getElementById('oppName').innerText = opp.name;
    document.getElementById('myName').innerText = myName;

    loginScreen.style.display = 'none';
    waitingScreen.style.display = 'none';
    gameScreen.style.display = 'flex';

    setTimeout(initGame, 400);
});

socket.on('opponent_jump', () => {
    if (!isSoloMode) oppDino.jump();
});

socket.on('you_win', () => {
    if (isGameRunning && !isSoloMode) {
        isGameRunning = false;
        showEndScreen("VOCÊ VENCEU! 🏆", "neon-cyan");
    }
});

function initGame() {
    isGameRunning = true;
    obstacles = [];
    gameSpeed = 4.5; 
    obstacleTimer = 0;

    // Ajuste de resolução interno 1:1 inicial
    myCanvas.width = myCanvas.clientWidth;
    myCanvas.height = myCanvas.clientHeight;
    myDino.y = myCanvas.height - 35;

    if (!isSoloMode) {
        oppCanvas.width = oppCanvas.clientWidth;
        oppCanvas.height = oppCanvas.clientHeight;
        oppDino.y = oppCanvas.height - 35;
    }
    
    gameLoop();
}

function triggerJump() {
    if (isGameRunning) {
        myDino.jump();
        if (!isSoloMode) socket.emit('jump', currentRoom);
    }
}
document.addEventListener('keydown', (e) => { if (e.code === 'Space') triggerJump(); });
document.getElementById('btnJump').addEventListener('touchstart', (e) => { e.preventDefault(); triggerJump(); });

function checkCollision(dino, obs, floorY) {
    return (
        dino.x < obs.x + obs.width &&
        dino.x + dino.width > obs.x &&
        dino.y - dino.height < floorY && 
        dino.y >= floorY - obs.height
    );
}

function showEndScreen(text, styleClass) {
    gameScreen.style.display = 'none';
    gameoverScreen.style.display = 'flex';
    endGameResult.innerText = text;
    endGameResult.className = `title ${styleClass}`;
}

btnRestart.addEventListener('click', () => {
    gameoverScreen.style.display = 'none';
    if (isSoloMode) {
        score = 0;
        gameScreen.style.display = 'flex';
        setTimeout(initGame, 200);
    } else {
        window.location.reload(); 
    }
});

btnMenu.addEventListener('click', () => {
    window.location.reload();
});

// --- LOOP DO JOGO ---
function gameLoop() {
    if (!isGameRunning) return;

    // Força a resolução interna do Canvas a bater 1:1 com o visor do aparelho
    myCanvas.width = myCanvas.clientWidth;
    myCanvas.height = myCanvas.clientHeight;
    let myFloor = myCanvas.height - 35;

    let oppFloor = 0;
    if (!isSoloMode) {
        oppCanvas.width = oppCanvas.clientWidth;
        oppCanvas.height = oppCanvas.clientHeight;
        oppFloor = oppCanvas.height - 35;
    }

    gameSpeed += 0.0016; 

    if (isSoloMode) {
        score += 0.1;
        document.getElementById('myName').innerText = Math.floor(score);
    }

    myCtx.clearRect(0, 0, myCanvas.width, myCanvas.height);
    drawScenery(myCtx, myFloor);

    if (!isSoloMode) {
        oppCtx.clearRect(0, 0, oppCanvas.width, oppCanvas.height);
        drawScenery(oppCtx, oppFloor);
        oppDino.update(oppFloor);
        oppDino.draw(oppCtx);
    }

    obstacleTimer++;
    if (obstacleTimer > 90) { 
        obstacles.push(new Obstacle(SPAWN_X)); 
        obstacleTimer = 0;
    }

    myDino.update(myFloor);
    myDino.draw(myCtx);

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.update();

        // Desenha se estiver dentro da área visível do aparelho
        if (obs.x < myCanvas.width) obs.draw(myCtx, myFloor);
        if (!isSoloMode && obs.x < oppCanvas.width) obs.draw(oppCtx, oppFloor);

        if (checkCollision(myDino, obs, myFloor)) {
            isGameRunning = false;
            
            if (isSoloMode) {
                showEndScreen(`GAME OVER\n${Math.floor(score)} PONTOS`, "neon-magenta");
            } else {
                socket.emit('game_over', currentRoom);
                showEndScreen("VOCÊ PERDEU! 💥", "neon-magenta");
            }
            return;
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    requestAnimationFrame(gameLoop);
}
