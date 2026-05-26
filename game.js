// 🚨 TROQUE A URL ABAIXO PELO SEU LINK DO RENDER!
const socket = io('https://dino-multiplayer-backend-xyz.onrender.com');

// Telas
const loginScreen = document.getElementById('loginScreen');
const waitingScreen = document.getElementById('waitingScreen');
const gameScreen = document.getElementById('gameScreen');
const gameOverScreen = document.getElementById('gameOverScreen'); // NOVA TELA

// Elementos
const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCodeInput');
const displayRoomCode = document.getElementById('displayRoomCode');
const winnerText = document.getElementById('winnerText');

// Jogo
const dino = document.getElementById('dino');
const obstacle = document.getElementById('obstacle');
const btnJump = document.getElementById('btnJump');

let myRoomCode = '';
let isGameRunning = false;
let checkCollision;

// --- LÓGICA DE SALAS ---
btnCreateRoom.addEventListener('click', () => {
    const name = playerNameInput.value || 'Jogador 1';
    socket.emit('create_room', { name });
});

socket.on('room_created', (roomCode) => {
    myRoomCode = roomCode;
    loginScreen.style.display = 'none';
    waitingScreen.style.display = 'block';
    displayRoomCode.innerText = roomCode;
});

btnJoinRoom.addEventListener('click', () => {
    const name = playerNameInput.value || 'Jogador 2';
    const code = roomCodeInput.value.toUpperCase();
    if(code) {
        myRoomCode = code;
        socket.emit('join_room', { name, roomCode: code });
    }
});

socket.on('error', (msg) => {
    alert(msg);
});

// --- INÍCIO DO JOGO ---
socket.on('start_game', (players) => {
    loginScreen.style.display = 'none';
    waitingScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    document.getElementById('p1Name').innerText = players.player1.name;
    document.getElementById('p2Name').innerText = players.player2.name;

    startGame();
});

function startGame() {
    isGameRunning = true;
    obstacle.style.display = 'block';
    obstacle.classList.add('obs-move');

    checkCollision = setInterval(() => {
        const dinoTop = parseInt(window.getComputedStyle(dino).getPropertyValue('bottom'));
        const obsLeft = parseInt(window.getComputedStyle(obstacle).getPropertyValue('left'));

        if (obsLeft > 0 && obsLeft < 50 && dinoTop <= 30) {
            // Se você bater no bloco vermelho:
            gameOver("Você Bateu! 💥");
            socket.emit('game_over', myRoomCode);
        }
    }, 10);
}

// --- PULO ---
function jump() {
    if (dino.classList != 'jump' && isGameRunning) {
        dino.classList.add('jump');
        socket.emit('jump', myRoomCode);
        setTimeout(() => {
            dino.classList.remove('jump');
        }, 500);
    }
}

// O touchstart ajuda a responder mais rápido no celular e ignora zoom
btnJump.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    jump();
});
btnJump.addEventListener('click', jump);

socket.on('opponent_jump', () => {
    // Aqui poderiamos animar o pulo do adversário se quiséssemos ver os dois Dinos
});

// --- FIM DE JOGO ---
socket.on('you_win', () => {
    gameOver("VOCÊ VENCEU! 🏆");
});

function gameOver(message) {
    isGameRunning = false;
    clearInterval(checkCollision);
    obstacle.classList.remove('obs-move');
    
    // Troca a tela para o Fim de Jogo
    gameScreen.style.display = 'none';
    gameOverScreen.style.display = 'block';
    winnerText.innerText = message;
}
