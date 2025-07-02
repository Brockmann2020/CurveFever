const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const broadcast = io.of('/broadcast');

// socketId -> { id, color }
const players = new Map();
const lines = [];
let gameStarted = false;

function getPlayers() {
    const obj = {};
    for (const { id, color } of players.values()) {
        obj[id] = { color };
    }
    return obj;
}

function emitPlayerCount() {
    broadcast.emit('playerCount', players.size);
}

broadcast.on('connection', (socket) => {
    socket.on('join', ({ id, color }) => {
        players.set(socket.id, { id, color });
        console.log('join', id, socket.id);
        socket.emit('state', { players: getPlayers(), lines });
        emitPlayerCount();
    });

    socket.on('segment', (seg) => {
        lines.push(seg);
        socket.broadcast.emit('segment', seg);
    });

    socket.on('dead', ({ id }) => {
        for (const [sid, info] of players.entries()) {
            if (info.id === id) {
                players.delete(sid);
                break;
            }
        }
        socket.broadcast.emit('dead', { id });
        emitPlayerCount();
        console.log('dead', id);
    });

    socket.on('start', () => {
        if (!gameStarted && players.size >= 2) {
            gameStarted = true;
            lines.length = 0;
            broadcast.emit('start');
        }
    });

    socket.on('disconnect', () => {
        const info = players.get(socket.id);
        if (info) {
            players.delete(socket.id);
            broadcast.emit('dead', { id: info.id });
            emitPlayerCount();
            console.log('disconnect', info.id);
        }
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
