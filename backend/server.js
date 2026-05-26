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
let leaderboard = []; // Armazena o Top 5 Global { name, score }

// Função para buscar e transmitir salas que estão esperando jogador (com apenas 1 player)
function sendPublicRooms() {
    const publicRooms = [];
    for (const code in rooms) {
        if (rooms[code].players.length === 1) {
            publicRooms.push({
                code: code,
                host: rooms[code].players[0].name
            });
        }
    }
    io.emit('update_rooms', publicRooms);
}

io.on('connection', (socket) => {
    console.log('Jogador conectado:', socket.id);

    // Envia o ranking atual e as salas disponíveis para quem acabou de conectar
    socket.emit('update_leaderboard', leaderboard);
    sendPublicRooms();

    // Criar uma nova sala
    socket.on('create_room', (data) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomCode] = { 
            players: [{ id: socket.id, name: data.name }],
            scores: {}, // Placar de vitórias diretas da sessão
            rematchRequests: [] // Rastreia aceitação de revanche
        };
        rooms[roomCode].scores[socket.id] = 0;
        
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
        sendPublicRooms();
    });

    // Entrar em uma sala existente
    socket.on('join_room', (data) => {
        const room = rooms[data.roomCode];
        if (room && room.players.length === 1) {
            room.players.push({ id: socket.id, name: data.name });
            room.scores[socket.id] = 0;
            socket.join(data.roomCode);
            
            io.to(data.roomCode).emit('start_game', {
                player1: room.players[0],
                player2: room.players[1]
            });
            sendPublicRooms();
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
        const room = rooms[roomCode];
        if (room) {
            // O vencedor da rodada é quem NÃO emitiu o game_over
            const winner = room.players.find(p => p.id !== socket.id);
            if (winner) {
                room.scores[winner.id] = (room.scores[winner.id] || 0) + 1;
            }
            
            room.rematchRequests = []; // Limpa os pedidos antigos de revanche

            // Avisa a sala sobre a finalização da rodada enviando o placar atualizado
            io.to(roomCode).emit('round_ended', {
                loserId: socket.id,
                scores: room.scores
            });
        }
    });

    // Processa novos recordes enviados pelos jogadores
    socket.on('submit_score', (data) => {
        if (data.score > 0) {
            leaderboard.push({ name: data.name, score: Math.floor(data.score) });
            // Ordena do maior para o menor e corta mantendo apenas os 5 melhores
            leaderboard.sort((a, b) => b.score - a.score);
            leaderboard = leaderboard.slice(0, 5);
            io.emit('update_leaderboard', leaderboard);
        }
    });

    // Gerenciamento do fluxo de Revanche
    socket.on('request_rematch', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            if (!room.rematchRequests.includes(socket.id)) {
                room.rematchRequests.push(socket.id);
            }
            
            if (room.rematchRequests.length === 2) {
                // Ambos os jogadores aceitaram a revanche! Reinicia mantendo a sala e o histórico
                room.rematchRequests = [];
                io.to(roomCode).emit('rematch_started');
            } else {
                // Avisa o outro jogador que há um convite de revanche pendente
                socket.to(roomCode).emit('rematch_offered');
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Jogador desconectou:', socket.id);
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const isPlayerInRoom = room.players.some(p => p.id === socket.id);
            if (isPlayerInRoom) {
                socket.to(roomCode).emit('opponent_left');
                delete rooms[roomCode];
                sendPublicRooms();
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
