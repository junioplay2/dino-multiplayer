const express = require('express');
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

    // 🛠️ CORREÇÃO CRÍTICA: Alguém bateu no obstáculo
    socket.on('game_over', (roomCode) => {
        if (roomCode) {
            // 1. Avisa o outro client que o dino do oponente dele morreu (para congelar a animação)
            socket.to(roomCode).emit('opponent-died');
            
            // 2. Avisa o outro client que ele ganhou a partida
            socket.to(roomCode).emit('you_win'); 
        }
    });

    // Limpeza de salas quando o jogador desconecta ou recarrega a página
    socket.on('disconnect', () => {
        console.log('Jogador desconectou:', socket.id);
        
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const isPlayerInRoom = room.players.some(p => p.id === socket.id);
            
            if (isPlayerInRoom) {
                // Se o jogo estava rodando, avisa o sobrevivente que ele ganhou por W.O.
                socket.to(roomCode).emit('opponent-died');
                socket.to(roomCode).emit('you_win');
                
                // Deleta a sala para liberar espaço na memória do servidor
                delete rooms[roomCode];
                console.log(`Sala ${roomCode} encerrada e removida.`);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
