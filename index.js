const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const broadcast = io.of('/broadcast');

const players = new Map(); // id -> {socketId, color}
const lines = [];
let gameStarted = false;

function emitPlayerCount() {
    broadcast.emit('playerCount', players.size);
}

broadcast.on('connection', (socket) => {
    socket.on('join', ({ id, color }) => {
        players.set(id, { socketId: socket.id, color });
        socket.emit('state', { players: Object.fromEntries(players), lines });
        emitPlayerCount();
    });

    socket.on('segment', (seg) => {
        lines.push(seg);
        socket.broadcast.emit('segment', seg);
    });

    socket.on('dead', ({ id }) => {
        players.delete(id);
        socket.broadcast.emit('dead', { id });
        emitPlayerCount();
    });

    socket.on('start', () => {
        if (!gameStarted && players.size >= 2) {
            gameStarted = true;
            lines.length = 0;
            broadcast.emit('start');
        }
    });

    socket.on('disconnect', () => {
        for (const [id, info] of players.entries()) {
            if (info.socketId === socket.id) {
                players.delete(id);
                broadcast.emit('dead', { id });
                emitPlayerCount();
                break;
            }
        }
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
