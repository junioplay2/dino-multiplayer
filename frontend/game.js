// ATENÇÃO: Troque a URL abaixo para a URL do seu backend quando subir no Render/Railway
const socket = io('https://dino-multiplayer.onrender.com'); 

let currentRoom = '';
let isGameRunning = false;
let myName = '';

// Elementos da DOM
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const statusMessage = document.getElementById('statusMessage');
const gameStatus = document.getElementById('gameStatus');

// Configurações do Jogo
const GRAVITY = 0.6;
const JUMP_POWER = -10;
const GAME_SPEED = 5;

class Dino {
    constructor(color) {
        this.x = 50;
        this.y = 150;
        this.width = 30;
        this.height = 30;
        this.vy = 0;
        this.isJumping = false;
        this.color = color;
    }
    jump() {
        if (!this.isJumping) {
            this.vy = JUMP_POWER;
            this.isJumping = true;
        }
    }
    update() {
        this.vy += GRAVITY;
        this.y += this.vy;
        if (this.y >= 150) { // Chão
            this.y = 150;
            this.vy = 0;
            this.isJumping = false;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0; // reseta
    }
}

class Obstacle {
    constructor() {
        this.x = 400;
        this.y = 150;
        this.width = 20;
        this.height = 30;
    }
    update() { this.x -= GAME_SPEED; }
    draw(ctx) {
        ctx.fillStyle = '#ffb199';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0844';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

// Instanciando os jogadores
const myDino = new Dino('#00f2fe');
const oppDino = new Dino('#ff0844');

const myCanvas = document.getElementById('myCanvas');
const myCtx = myCanvas.getContext('2d');
const oppCanvas = document.getElementById('oppCanvas');
const oppCtx = oppCanvas.getContext('2d');

let obstacles = [];
let frameCount = 0;

// --- LÓGICA DE SOCKETS (Rede) ---

document.getElementById('btnCreate').addEventListener('click', () => {
    myName = document.getElementById('playerName').value || 'Jogador 1';
    socket.emit('create_room', { name: myName });
});

document.getElementById('btnJoin').addEventListener('click', () => {
    myName = document.getElementById('playerName').value || 'Jogador 2';
    const roomCode = document.getElementById('roomCodeInput').value.toUpperCase();
    if (roomCode) socket.emit('join_room', { name: myName, roomCode });
});

socket.on('room_created', (roomCode) => {
    currentRoom = roomCode;
    showGameScreen(roomCode);
    document.getElementById('myName').innerText = myName;
    gameStatus.innerText = 'Envie o código para seu adversário!';
});

socket.on('start_game', (players) => {
    // Descobrir quem é quem
    const opp = players.player1.id === socket.id ? players.player2 : players.player1;
    document.getElementById('oppName').innerText = opp.name;
    
    if(!currentRoom) { // Se eu for o jogador 2 entrando agora
        currentRoom = document.getElementById('roomCodeInput').value.toUpperCase();
        showGameScreen(currentRoom);
        document.getElementById('myName').innerText = myName;
    }

    gameStatus.innerText = 'PREPARE-SE! O jogo vai começar...';
    setTimeout(startGame, 3000); // 3 segundos para começar
});

socket.on('opponent_jump', () => {
    oppDino.jump();
});

socket.on('you_win', () => {
    isGameRunning = false;
    gameStatus.innerText = "🏆 VOCÊ VENCEU! O adversário bateu.";
    gameStatus.style.color = "#00f2fe";
});

socket.on('error', (msg) => statusMessage.innerText = msg);

// --- LÓGICA DO JOGO ---

function showGameScreen(room) {
    loginScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    document.getElementById('displayRoomCode').innerText = room;
}

function startGame() {
    isGameRunning = true;
    obstacles = [];
    gameStatus.innerText = "CORRA!";
    gameStatus.style.color = "white";
    gameLoop();
}

// Controles
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isGameRunning) {
        myDino.jump();
        socket.emit('jump', currentRoom);
    }
});
// Suporte Mobile (Toque na tela)
document.addEventListener('touchstart', (e) => {
    if (isGameRunning) {
        myDino.jump();
        socket.emit('jump', currentRoom);
    }
});

function checkCollision(dino, obs) {
    return (
        dino.x < obs.x + obs.width &&
        dino.x + dino.width > obs.x &&
        dino.y < obs.y + obs.height &&
        dino.y + dino.height > obs.y
    );
}

function drawBackground(ctx) {
    ctx.clearRect(0, 0, 400, 200);
    // Linha do chão
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(400, 180);
    ctx.stroke();
}

function gameLoop() {
    if (!isGameRunning) return;

    drawBackground(myCtx);
    drawBackground(oppCtx);

    // Gerar obstáculos sincronizados (baseado em frames)
    frameCount++;
    if (frameCount % 100 === 0) {
        obstacles.push(new Obstacle());
    }

    // Atualizar Seu Dino
    myDino.update();
    myDino.draw(myCtx);

    // Atualizar Dino Inimigo
    oppDino.update();
    oppDino.draw(oppCtx);

    // Atualizar Obstáculos
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.update();
        
        // Desenha o obstáculo nas duas telas
        obs.draw(myCtx);
        obs.draw(oppCtx);

        // Verifica sua colisão
        if (checkCollision(myDino, obs)) {
            isGameRunning = false;
            gameStatus.innerText = "💥 VOCÊ PERDEU!";
            gameStatus.style.color = "#ff0844";
            socket.emit('game_over', currentRoom);
        }

        // Remove obstáculo que passou da tela
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    requestAnimationFrame(gameLoop);
}
