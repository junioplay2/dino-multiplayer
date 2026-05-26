// 🚨 MANTENHA A URL DO SEU RENDER AQUI:
const socket = io('https://dino-multiplayer.onrender.com'); 

let currentRoom = '';
let isGameRunning = false;
let isSoloMode = false; 
let score = 0;          
let myName = '';
let gameSpeed = 4.5; 
let obstacleTimer = 0;
let powerUpTimer = 0;
let obstacles = [];
let powerUps = [];
let level = 1;

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

// ==========================================
// 🎨 MATRIZES DE PIXEL ART (100% NATIVO)
// ==========================================

const DINO_FRAMES = [
    // Frame 0: Pulando / Parado
    [
      "        ██████ ",
      "        █ ████ ",
      "        ██████ ",
      "        ███    ",
      "        ██████ ",
      "█      █████   ",
      "██    ██████   ",
      "███  ██████    ",
      " █████████     ",
      "  ███████      ",
      "    ███        ",
      "    █ █        ",
      "    █ █        ",
      "   ██ ██       "
    ],
    // Frame 1: Correndo (Perna Direita)
    [
      "        ██████ ",
      "        █ ████ ",
      "        ██████ ",
      "        ███    ",
      "        ██████ ",
      "█      █████   ",
      "██    ██████   ",
      "███  ██████    ",
      " █████████     ",
      "  ███████      ",
      "    ███        ",
      "      █        ",
      "      █        ",
      "     ██        "
    ],
    // Frame 2: Correndo (Perna Esquerda)
    [
      "        ██████ ",
      "        █ ████ ",
      "        ██████ ",
      "        ███    ",
      "        ██████ ",
      "█      █████   ",
      "██    ██████   ",
      "███  ██████    ",
      " █████████     ",
      "  ███████      ",
      "    ███        ",
      "    █          ",
      "    █          ",
      "   ██          "
    ],
    // Frame 3: Morto (Olho fechado)
    [
      "        ██████ ",
      "        █  ███ ",
      "        ██████ ",
      "        ███    ",
      "        ██████ ",
      "█      █████   ",
      "██    ██████   ",
      "███  ██████    ",
      " █████████     ",
      "  ███████      ",
      "    ███        ",
      "    █ █        ",
      "   ██ ██       ",
      "               "
    ]
];

const CACTUS_FRAME = [
    "   ██   ",
    " █ ██   ",
    "██ ██ █ ",
    "██ ██ ██",
    " ████ ██",
    "   ████ ",
    "   ██   ",
    "   ██   ",
    "   ██   ",
    "   ██   "
];

const BIRD_FRAMES = [
    // Frame 0: Asa para cima
    [
      "      ████      ",
      "    ████████    ",
      "   ██████████   ",
      "██████████████  ",
      "████████████████",
      "  ████████████  ",
      "    ██████      ",
      "    ██          "
    ],
    // Frame 1: Asa para baixo
    [
      "    ██          ",
      "    ██████      ",
      "  ████████████  ",
      "████████████████",
      "██████████████  ",
      "   ██████████   ",
      "    ████████    ",
      "      ████      "
    ]
];

const SHIELD_FRAME = [
    "   ████   ",
    " ████████ ",
    "██████████",
    "██████████",
    "██████████",
    " ████████ ",
    "   ████   "
];

// Novas matrizes para a Estrela Cadente e o Buraco/Cratera
const STAR_FRAME = [
    "    █    ",
    "  █████  ",
    "█████████",
    "  █████  ",
    "   █ █   "
];

const CRATER_FRAME = [
    "█          █",
    " ██      ██ ",
    "  ████████  ",
    "   ██████   "
];

// --- CLASSES DO JOGO ---

class Dino {
    constructor(color) {
        this.x = 60;
        this.y = 0;
        this.width = 40;   
        this.height = 44;  
        this.vy = 0;
        this.isJumping = false;
        this.jumpsAvailable = 2; 
        this.color = color;
        this.isDead = false; 
        this.animFrame = 0;  
        this.animTimer = 0;  
        this.isInvincible = false; 
        this.invincibleTimer = 0;
    }
    
    jump() {
        if (!this.isDead && this.jumpsAvailable > 0) {
            this.vy = JUMP_FORCE;
            this.isJumping = true;
            this.jumpsAvailable--;
        }
    }
    
    update(floorY) {
        this.vy += GRAVITY;
        this.y += this.vy;
        
        if (this.y >= floorY) {
            this.y = floorY;
            this.vy = 0;
            this.isJumping = false;
            this.jumpsAvailable = 2; 
        }

        if (this.isInvincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) {
                this.isInvincible = false;
            }
        }

        if (this.isDead) {
            this.animFrame = 3; 
        } else if (this.isJumping) {
            this.animFrame = 0; 
        } else {
            this.animTimer++;
            if (this.animTimer > (25 / gameSpeed)) { 
                this.animFrame = this.animFrame === 1 ? 2 : 1;
                this.animTimer = 0;
            }
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = this.isInvincible ? 25 : 10;
        ctx.shadowColor = this.isInvincible ? '#fffb00' : this.color;
        ctx.fillStyle = this.isInvincible ? '#fffb00' : this.color;
        
        if (this.isDead) ctx.globalAlpha = 0.4;
        if (this.isInvincible && this.invincibleTimer < 90 && Math.floor(this.invincibleTimer / 5) % 2 === 0) {
            ctx.globalAlpha = 0.2;
        }

        const frame = DINO_FRAMES[this.animFrame];
        const rows = frame.length;
        const cols = frame[0].length;
        const pixelW = this.width / cols;
        const pixelH = this.height / rows;
        const startY = this.y - this.height;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (frame[r][c] !== ' ') {
                    ctx.fillRect(
                        this.x + (c * pixelW), 
                        startY + (r * pixelH), 
                        Math.ceil(pixelW), 
                        Math.ceil(pixelH)
                    );
                }
            }
        }
        ctx.restore();
    }
}

class Obstacle {
    constructor(x, type) {
        this.x = x;
        this.type = type; // 'cactus', 'bird', 'star'
        this.hasLanded = false; // Controle exclusivo para a Estrela Cadente
        
        if (type === 'cactus') {
            this.width = 18;
            this.height = 32;
            this.yOffset = 0;
        } else if (type === 'bird') {
            this.width = 26;
            this.height = 20;
            this.yOffset = Math.random() > 0.5 ? 25 : 55;
        } else if (type === 'star') {
            this.width = 20;
            this.height = 20;
            this.yOffset = 140; // Começa bem alto na tela
        }
        
        this.animFrame = 0;
        this.animTimer = 0;
    }
    
    update() {
        this.x -= gameSpeed;
        
        if (this.type === 'bird') {
            this.animTimer++;
            if (this.animTimer > 15) {
                this.animFrame = this.animFrame === 0 ? 1 : 0;
                this.animTimer = 0;
            }
        }
        
        // Mecânica da Estrela Cadente Caindo no Chão
        if (this.type === 'star' && !this.hasLanded) {
            // Cai diagonalmente sincronizado à velocidade do jogo
            this.yOffset -= (gameSpeed * 1.3); 
            
            // Se atingir o chão, vira buraco/cratera permanentemente
            if (this.yOffset <= 0) {
                this.yOffset = 0;
                this.hasLanded = true;
                // Redimensiona o bloco de colisão para ajustar ao formato do buraco
                this.width = 30;
                this.height = 12;
            }
        }
    }
    
    draw(ctx, floorY) {
        ctx.save();
        let frame;
        
        if (this.type === 'cactus') {
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            frame = CACTUS_FRAME;
        } else if (this.type === 'bird') {
            ctx.fillStyle = '#00ff9d';
            ctx.shadowColor = '#00ff9d';
            frame = BIRD_FRAMES[this.animFrame];
        } else if (this.type === 'star') {
            if (!this.hasLanded) {
                ctx.fillStyle = '#ffdd00'; // Amarelo Neon Estrela caindo
                ctx.shadowColor = '#ffdd00';
                frame = STAR_FRAME;
            } else {
                ctx.fillStyle = '#9d00ff'; // Roxo Profundo Neon quando vira Buraco
                ctx.shadowColor = '#9d00ff';
                frame = CRATER_FRAME;
            }
        }
        
        ctx.shadowBlur = 12;
        const rows = frame.length;
        const cols = frame[0].length;
        const pixelW = this.width / cols;
        const pixelH = this.height / rows;
        const startY = (floorY - this.height) - this.yOffset;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (frame[r][c] !== ' ') {
                    ctx.fillRect(
                        this.x + (c * pixelW), 
                        startY + (r * pixelH), 
                        Math.ceil(pixelW), 
                        Math.ceil(pixelH)
                    );
                }
            }
        }
        ctx.restore();
    }
}

class PowerUp {
    constructor(x, floorY) {
        this.x = x;
        this.width = 20;
        this.height = 20;
        this.y = floorY - this.height - 40; 
        this.angle = 0;
    }
    update() {
        this.x -= gameSpeed;
        this.angle += 0.05; 
    }
    draw(ctx) {
        ctx.save();
        ctx.fillStyle = '#fffb00';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fffb00';

        const rows = SHIELD_FRAME.length;
        const cols = SHIELD_FRAME[0].length;
        const pixelW = this.width / cols;
        const pixelH = this.height / rows;
        const currentY = this.y + Math.sin(this.angle) * 5;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (SHIELD_FRAME[r][c] !== ' ') {
                    ctx.fillRect(
                        this.x + (c * pixelW), 
                        currentY + (r * pixelH), 
                        Math.ceil(pixelW), 
                        Math.ceil(pixelH)
                    );
                }
            }
        }
        ctx.restore();
    }
}

const myDino = new Dino('#00f2fe'); 
const oppDino = new Dino('#ff0844');

let backgroundX = 0;

function drawScenery(ctx, floorY, levelColor) {
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
    
    ctx.strokeStyle = levelColor;
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

// --- SOCKET.IO EVENTS ---

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

socket.on('round_ended', (data) => {
    isGameRunning = false;
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

    const myId = socket.id;
    const opponentId = Object.keys(data.scores).find(id => id !== myId);
    const myWins = data.scores[myId] || 0;
    const oppWins = data.scores[opponentId] || 0;
    if(matchScoreboard) {
        matchScoreboard.innerText = `Placar: Você ${myWins} x ${oppWins} Oponente`;
    }
});

socket.on('rematch_offered', () => {
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

// --- MENUS ---
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
    powerUps = [];
    gameSpeed = 4.5; 
    obstacleTimer = 0;
    powerUpTimer = 0;
    score = 0;
    level = 1;

    myDino.isDead = false;  
    oppDino.isDead = false; 
    myDino.isInvincible = false;
    oppDino.isInvincible = false;

    myCanvas.width = myCanvas.clientWidth;
    myCanvas.height = myCanvas.clientHeight;
    myDino.y = myCanvas.height - 35;

    if (!isSoloMode) {
        oppCanvas.width = oppCanvas.clientWidth;
        oppCanvas.height = oppCanvas.clientHeight;
        oppDino.y = oppCanvas.height - 35;
    }
    
    if (window.gameLoopFrame) cancelAnimationFrame(window.gameLoopFrame);
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

function checkCollision(dino, obj, floorY) {
    const dinoYStart = dino.y - dino.height;
    const objYStart = obj.type ? (floorY - obj.height - obj.yOffset) : obj.y;

    return (
        dino.x + 6 < obj.x + obj.width &&
        dino.x + dino.width - 6 > obj.x &&
        dinoYStart + 4 < objYStart + obj.height &&
        dino.y - 4 > objYStart
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

    myCtx.imageSmoothingEnabled = false;
    if (!isSoloMode) oppCtx.imageSmoothingEnabled = false;

    // Sistema de Níveis e Progressão
    score += 0.1; 
    level = Math.floor(score / 300) + 1; 
    gameSpeed = 4.5 + (level * 0.4); 

    let baseHue = (level * 60) % 360;
    let myColor = `hsl(${baseHue}, 100%, 60%)`;
    let oppColor = `hsl(${(baseHue + 180) % 360}, 100%, 60%)`;

    if (isSoloMode) {
        document.getElementById('myName').innerText = `Lvl ${level} - ${Math.floor(score)} pts`;
    }

    myCtx.clearRect(0, 0, myCanvas.width, myCanvas.height);
    drawScenery(myCtx, myFloor, myColor);

    if (!isSoloMode) {
        oppCtx.clearRect(0, 0, oppCanvas.width, oppCanvas.height);
        drawScenery(oppCtx, oppFloor, oppColor);
        if (!oppDino.isDead) { 
            oppDino.update(oppFloor); 
        }
        oppDino.draw(oppCtx);
    }

    // Gerador Sorteado de Obstáculos (Cacto, Pássaro ou Estrela Cadente)
    obstacleTimer++;
    if (obstacleTimer > (Math.random() * 40 + 75)) { 
        let rand = Math.random();
        let type = 'cactus';
        
        if (rand < 0.4) {
            type = 'cactus';
        } else if (rand < 0.7) {
            type = 'bird';
        } else {
            type = 'star'; // Sorteia a Estrela Cadente/Buraco
        }
        
        obstacles.push(new Obstacle(SPAWN_X, type)); 
        obstacleTimer = 0;
    }

    // Gerador de Power-Ups (Escudo de Invencibilidade)
    powerUpTimer++;
    if (powerUpTimer > 600) { 
        if(Math.random() > 0.5) {
            powerUps.push(new PowerUp(SPAWN_X, myFloor));
        }
        powerUpTimer = 0;
    }

    myDino.update(myFloor);
    myDino.draw(myCtx);

    // Processamento dos Escudos (Power-ups)
    for(let j = powerUps.length - 1; j >= 0; j--) {
        let pUp = powerUps[j];
        pUp.update();
        
        if (pUp.x < myCanvas.width) pUp.draw(myCtx);
        
        if (checkCollision(myDino, pUp, myFloor)) {
            myDino.isInvincible = true;
            myDino.invincibleTimer = 300; 
            powerUps.splice(j, 1);
            continue;
        }
        if (pUp.x + pUp.width < 0) {
            powerUps.splice(j, 1);
        }
    }

    // Processamento de Obstáculos Ativos
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.update();

        if (obs.x < myCanvas.width) obs.draw(myCtx, myFloor);
        if (!isSoloMode && obs.x < oppCanvas.width) obs.draw(oppCtx, oppFloor);

        // Testar colisão direta
        if (checkCollision(myDino, obs, myFloor)) {
            if (myDino.isInvincible) {
                // Escudo ativo destrói o obstáculo (ou passa por cima do buraco) sem morrer!
                obstacles.splice(i, 1);
                continue;
            } else {
                isGameRunning = false;
                myDino.isDead = true;
                
                if (isSoloMode) {
                    socket.emit('submit_score', { name: 'Solo Player', score: score });
                    showEndScreen(`GAME OVER\n${Math.floor(score)} PONTOS`, "neon-magenta");
                } else {
                    socket.emit('game_over', currentRoom); 
                }
                return;
            }
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    window.gameLoopFrame = requestAnimationFrame(gameLoop);
}
