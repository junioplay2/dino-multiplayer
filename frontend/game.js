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
const splitContainer = document.getElementById('split-container');
const leaderboardList = document.getElementById('leaderboard-list');
const roomsList = document.getElementById('rooms-list');
const matchScoreboard = document.getElementById('match-scoreboard');

// Configuração dos Canvas
const myCanvas = document.getElementById('myCanvas');
const myCtx = myCanvas.getContext('2d');
const oppCanvas = document.getElementById('oppCanvas');
const oppCtx = oppCanvas.getContext('2d');

const GRAVITY = 0.6;
const JUMP_FORCE = -11;
const SPAWN_X = 580; 

class Dino {
    constructor(color) {
        this.x = 60;
        this.y = 0;
        this.width = 24;
        this.height = 28;
        this.vy = 0;
        this.isJumping = false;
        this.color = color;
        this.isDead = false; 
    }
    jump() {
        if (!this.isJumping && !this.isDead) {
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
        if (this.isDead) ctx.globalAlpha = 0.4;
        ctx.fillRect(this.x, this.y - this.height, this.width, this.height);
        ctx.globalAlpha = 1.0; 
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
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for(let i=1; i<=6; i++) { ctx.fillRect(i * (ctx.canvas.width / 7), 30, 2, 2); }
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
    ctx.strokeStyle = ctx.canvas.id === "myCanvas" ? "#00f2fe" : "#ff0844";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(ctx.canvas.width, floorY);
    ctx.stroke();
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

// --- ESCUTAS SOCKET.IO DE INFRAESTRUTURA COMPARTILHADA ---

socket.on('update_leaderboard', (leaderboard) => {
    if(!leaderboardList) return;
    leaderboardList.innerHTML = leaderboard.length === 0 ? "<li>Nenhum recorde</li>" : "";
    leaderboard.forEach(item => {
        leaderboardList.innerHTML += `<li><strong>${item.name}</strong> - ${item.score} pts</li>`;
    });
});

socket.on('update_rooms', (rooms) => {
    if(!roomsList) return;
    if(rooms.length === 0) {
        roomsList.innerHTML = "<span style='color:#aaa; font-size:12px;'>Nenhuma sala aberta.</span>";
        return;
    }
    roomsList.innerHTML = "";
    rooms.forEach(room => {
        const btn = document.createElement('button');
        btn.innerText = `SALA: ${room.code} (${room.host})`;
        btn.style = "background:#00f2fe; color:#000; border:none; padding:4px 8px; font-weight:bold; cursor:pointer; border-radius:4px; text-align:left; font-size:11px;";
        btn.addEventListener('click', () => {
            isSoloMode = false;
            splitContainer.classList.remove('solo-active');
            myName = document.getElementById('playerName').value || 'Player 2';
            currentRoom = room.code;
            socket.emit('join_room', { name: myName, roomCode: room.code });
        });
        roomsList.appendChild(btn);
    });
});

socket.on('room_created', (roomCode) => {
    currentRoom = roomCode;
    loginScreen.style.display = 'none';
    waitingScreen.style.display = 'flex';
    displayRoomCode.innerText = roomCode;
});

socket.on('start_game', (players) => {
    splitContainer.classList.remove('solo-active'); 
    oppWrapper.style.display = 'flex'; 
    myTagType.innerText = "Você:";
    if(matchScoreboard) matchScoreboard.style.display = 'block';
    
    const opp = players.player1.id === socket.id ? players.player2 : players.player1;
    document.getElementById('oppName').innerText = opp.name;
    document.getElementById('myName').innerText = myName;

    loginScreen.style.display = 'none';
    waitingScreen.style.display = 'none';
    gameScreen.style.display = 'flex';

    setTimeout(initGame, 300);
});

socket.on('opponent_jump', () => {
    if (!isSoloMode) oppDino.jump();
});

// Processamento unificado de fim de rodada
socket.on('round_ended', (data) => {
    isGameRunning = false;
    
    // Envia a pontuação obtida nessa corrida para verificar se entra nos 5 melhores recordes globais
    socket.emit('submit_score', { name: myName, score: score });

    if (data.loserId === socket.id) {
        myDino.isDead = true;
        showEndScreen("VOCÊ PERDEU! 💥", "neon-magenta");
        btnRestart.innerText = "Pedir Revanche ⚔️";
    } else {
        oppDino.isDead = true;
        showEndScreen("VOCÊ VENCEU! 🏆", "neon-cyan");
        btnRestart.innerText = "Aguardando Oponente...";
    }
    btnRestart.disabled = false;

    // Atualiza o visor interno de confrontos diretos
    const myId = socket.id;
    const opponentId = Object.keys(data.scores).find(id => id !== myId);
    const myWins = data.scores[myId] || 0;
    const oppWins = data.scores[opponentId] || 0;
    if(matchScoreboard) {
        matchScoreboard.innerText = `Placar: Você ${myWins} x ${oppWins} Oponente`;
    }
});

socket.on('rematch_offered', () => {
    // Altera o estado do botão caso o outro player peça revanche primeiro
    btnRestart.innerText = "Aceitar Revanche! ⚔️";
    btnRestart.disabled = false;
});

socket.on('rematch_started', () => {
    gameoverScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    btnRestart.disabled = false;
    setTimeout(initGame, 200);
});

socket.on('opponent_left', () => {
    alert("O oponente saiu ou desconectou da partida.");
    window.location.reload();
});

// --- CONTROLE DE MENUS ---

document.getElementById('btnSolo').addEventListener('click', () => {
    isSoloMode = true;
    score = 0;
    if(matchScoreboard) matchScoreboard.style.display = 'none';
    splitContainer.classList.add('solo-active'); 
    myTagType.innerText = "Pontos:";
    loginScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    setTimeout(initGame, 300);
});

document.getElementById('btnCreate').addEventListener('click', () => {
    isSoloMode = false;
    splitContainer.classList.remove('solo-active');
    myName = document.getElementById('playerName').value || 'Player 1';
    socket.emit('create_room', { name: myName });
});

document.getElementById('btnJoin').addEventListener('click', () => {
    isSoloMode = false;
    splitContainer.classList.remove('solo-active');
    myName = document.getElementById('playerName').value || 'Player 2';
    const code = document.getElementById('roomCodeInput').value.toUpperCase();
    if (code) {
        currentRoom = code; 
        socket.emit('join_room', { name: myName, roomCode: code });
    }
});

function initGame() {
    isGameRunning = true;
    obstacles = [];
    gameSpeed = 4.5; 
    obstacleTimer = 0;
    score = 0; // Zera a pontuação de corrida da rodada

    myDino.isDead = false;  
    oppDino.isDead = false; 

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
    if (isSoloMode) {
        gameoverScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
        setTimeout(initGame, 200);
    } else {
        // Modo Multiplayer: Processa pedido de Revanche
        btnRestart.innerText = "Aguardando Resposta...";
        btnRestart.disabled = true;
        socket.emit('request_rematch', currentRoom);
    }
});

btnMenu.addEventListener('click', () => {
    window.location.reload();
});

// --- LOOP PRINCIPAL ---
function gameLoop() {
    if (!isGameRunning) return;

    if (myCanvas.width !== myCanvas.clientWidth || myCanvas.height !== myCanvas.clientHeight) {
        myCanvas.width = myCanvas.clientWidth;
        myCanvas.height = myCanvas.clientHeight;
    }
    let myFloor = myCanvas.height - 35;

    let oppFloor = 0;
    if (!isSoloMode) {
        if (oppCanvas.width !== oppCanvas.clientWidth || oppCanvas.height !== oppCanvas.clientHeight) {
            oppCanvas.width = oppCanvas.clientWidth;
            oppCanvas.height = oppCanvas.clientHeight;
        }
        oppFloor = oppCanvas.height - 35;
    }

    gameSpeed += 0.0016; 
    score += 0.1; // Pontuação acumulada por sobrevivência (vale para Solo e Multi!)

    if (isSoloMode) {
        document.getElementById('myName').innerText = Math.floor(score);
    }

    myCtx.clearRect(0, 0, myCanvas.width, myCanvas.height);
    drawScenery(myCtx, myFloor);

    if (!isSoloMode) {
        oppCtx.clearRect(0, 0, oppCanvas.width, oppCanvas.height);
        drawScenery(oppCtx, oppFloor);
        if (!oppDino.isDead) { 
            oppDino.update(oppFloor); 
        }
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

        if (obs.x < myCanvas.width) obs.draw(myCtx, myFloor);
        if (!isSoloMode && obs.x < oppCanvas.width) obs.draw(oppCtx, oppFloor);

        if (checkCollision(myDino, obs, myFloor)) {
            isGameRunning = false;
            myDino.isDead = true;
            
            if (isSoloMode) {
                socket.emit('submit_score', { name: 'Solo Player', score: score });
                showEndScreen(`GAME OVER\n${Math.floor(score)} PONTOS`, "neon-magenta");
            } else {
                // Notifica o servidor e o servidor decide placar e status
                socket.emit('game_over', currentRoom); 
            }
            return;
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    requestAnimationFrame(gameLoop);
}
