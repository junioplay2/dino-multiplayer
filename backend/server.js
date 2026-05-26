const express = require('express'); // 🚀 FIX: Agora com 'const' minúsculo correto!
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('Jogador conectado:', socket.id);

    // Criar uma nova sala
    socket.on('create_room', (data) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomCode] = { players: [{ id: socket.id, name: data.name }] };
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
    });

    // Entrar em uma sala existente
    socket.on('join_room', (data) => {
        const room = rooms[data.roomCode];
        if (room && room.players.length === 1) {
            room.players.push({ id: socket.id, name: data.name });
            socket.join(data.roomCode);
            // Avisa ambos que o jogo pode começar
            io.to(data.roomCode).emit('start_game', {
                player1: room.players[0],
                player2: room.players[1]
            });
        } else {
            socket.emit('error', 'Sala cheia ou inexistente!');
        }
    });

    // Sincronizar o pulo com o adversário
    socket.on('jump', (roomCode) => {
        socket.to(roomCode).emit('opponent_jump');
    });

    // Alguém bateu no obstáculo
    socket.on('game_over', (roomCode) => {
        if (roomCode) {
            // Envia os dois eventos necessários para o oponente congelar e vencer
            socket.to(roomCode).emit('opponent-died');
            socket.to(roomCode).emit('you_win'); 
        }
    });

    socket.on('disconnect', () => {
        console.log('Jogador desconectou:', socket.id);
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const isPlayerInRoom = room.players.some(p => p.id === socket.id);
            if (isPlayerInRoom) {
                socket.to(roomCode).emit('opponent-died');
                socket.to(roomCode).emit('you_win');
                delete rooms[roomCode]; // Remove a sala antiga para liberar memória
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
