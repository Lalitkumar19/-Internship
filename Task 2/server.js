// server.js - Complete Node.js Backend with Socket.IO for ChatConnect
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Store connected users and chat rooms
const connectedUsers = new Map();
const chatRooms = new Map();
const messageHistory = new Map(); // Store recent messages per room

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoints
app.get('/api/stats', (req, res) => {
    const stats = {
        totalUsers: connectedUsers.size,
        totalRooms: chatRooms.size,
        rooms: Array.from(chatRooms.entries()).map(([room, users]) => ({
            name: room,
            userCount: users.size
        })),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };
    res.json(stats);
});

app.get('/api/users', (req, res) => {
    const users = Array.from(connectedUsers.values()).map(user => ({
        username: user.username,
        room: user.room,
        joinedAt: user.joinedAt
    }));
    res.json(users);
});

app.get('/api/messages/:room', (req, res) => {
    const room = req.params.room;
    const messages = messageHistory.get(room) || [];
    res.json(messages);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        connections: connectedUsers.size,
        rooms: chatRooms.size
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);
    
    // Handle user joining
    socket.on('user-join', (userData) => {
        try {
            const { username, room = 'general' } = userData;
            
            if (!username || username.trim() === '') {
                socket.emit('error', { message: 'Username is required' });
                return;
            }
            
            // Check if username is already taken in the room
            const existingUser = Array.from(connectedUsers.values())
                .find(user => user.username === username && user.room === room);
            
            if (existingUser) {
                socket.emit('error', { message: 'Username already taken in this room' });
                return;
            }
            
            // Store user information
            connectedUsers.set(socket.id, {
                id: socket.id,
                username: username.trim(),
                room: room,
                joinedAt: new Date(),
                isTyping: false
            });
            
            // Join room
            socket.join(room);
            
            // Add to room users list
            if (!chatRooms.has(room)) {
                chatRooms.set(room, new Set());
            }
            chatRooms.get(room).add(socket.id);
            
            // Initialize message history for room if needed
            if (!messageHistory.has(room)) {
                messageHistory.set(room, []);
            }
            
            // Broadcast to room that user joined
            socket.to(room).emit('user-joined', {
                username: username,
                message: `${username} joined the chat`,
                timestamp: new Date().toISOString(),
                type: 'system'
            });
            
            // Send updated users list to room
            const roomUsers = getRoomUsers(room);
            io.to(room).emit('users-update', roomUsers);
            
            // Send welcome message to user
            socket.emit('system-message', {
                message: `Welcome to the ${room} chat room, ${username}! 🎉`,
                timestamp: new Date().toISOString(),
                type: 'welcome'
            });
            
            // Send recent message history to the new user
            const recentMessages = messageHistory.get(room).slice(-20); // Last 20 messages
            socket.emit('message-history', recentMessages);
            
            console.log(`👤 ${username} joined room: ${room}`);
            
        } catch (error) {
            console.error('Error in user-join:', error);
            socket.emit('error', { message: 'Failed to join chat' });
        }
    });
    
    // Handle new message
    socket.on('send-message', (messageData) => {
        try {
            const user = connectedUsers.get(socket.id);
            if (!user) {
                socket.emit('error', { message: 'User not found' });
                return;
            }
            
            const { message } = messageData;
            
            if (!message || message.trim() === '') {
                return;
            }
            
            const messageObj = {
                id: generateMessageId(),
                username: user.username,
                message: message.trim(),
                timestamp: new Date().toISOString(),
                type: 'message',
                room: user.room
            };
            
            // Store message in history
            const roomMessages = messageHistory.get(user.room);
            roomMessages.push(messageObj);
            
            // Keep only last 100 messages per room
            if (roomMessages.length > 100) {
                roomMessages.splice(0, roomMessages.length - 100);
            }
            
            // Broadcast message to room
            io.to(user.room).emit('new-message', messageObj);
            
            console.log(`💬 [${user.room}] ${user.username}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
            
        } catch (error) {
            console.error('Error in send-message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });
    
    // Handle typing events
    socket.on('typing-start', () => {
        try {
            const user = connectedUsers.get(socket.id);
            if (!user) return;
            
            user.isTyping = true;
            socket.to(user.room).emit('user-typing', {
                username: user.username,
                typing: true
            });
        } catch (error) {
            console.error('Error in typing-start:', error);
        }
    });
    
    socket.on('typing-stop', () => {
        try {
            const user = connectedUsers.get(socket.id);
            if (!user) return;
            
            user.isTyping = false;
            socket.to(user.room).emit('user-typing', {
                username: user.username,
                typing: false
            });
        } catch (error) {
            console.error('Error in typing-stop:', error);
        }
    });
    
    // Handle private message
    socket.on('private-message', (data) => {
        try {
            const sender = connectedUsers.get(socket.id);
            if (!sender) return;
            
            const { targetUsername, message } = data;
            
            if (!targetUsername || !message) {
                socket.emit('error', { message: 'Target username and message are required' });
                return;
            }
            
            const targetUser = Array.from(connectedUsers.values())
                .find(user => user.username === targetUsername);
            
            if (targetUser) {
                const privateMessage = {
                    id: generateMessageId(),
                    from: sender.username,
                    message: message.trim(),
                    timestamp: new Date().toISOString(),
                    type: 'private'
                };
                
                // Send to target user
                io.to(targetUser.id).emit('private-message', privateMessage);
                
                // Send confirmation to sender
                socket.emit('private-message-sent', {
                    to: targetUsername,
                    message: message,
                    timestamp: privateMessage.timestamp
                });
                
                console.log(`🔒 Private message: ${sender.username} -> ${targetUsername}`);
            } else {
                socket.emit('error', { message: 'User not found or offline' });
            }
        } catch (error) {
            console.error('Error in private-message:', error);
            socket.emit('error', { message: 'Failed to send private message' });
        }
    });
    
    // Handle room change
    socket.on('change-room', (newRoom) => {
        try {
            const user = connectedUsers.get(socket.id);
            if (!user) return;
            
            const oldRoom = user.room;
            
            if (oldRoom === newRoom) return;
            
            // Leave old room
            socket.leave(oldRoom);
            if (chatRooms.has(oldRoom)) {
                chatRooms.get(oldRoom).delete(socket.id);
            }
            
            // Join new room
            socket.join(newRoom);
            user.room = newRoom;
            
            if (!chatRooms.has(newRoom)) {
                chatRooms.set(newRoom, new Set());
            }
            chatRooms.get(newRoom).add(socket.id);
            
            // Initialize message history for new room if needed
            if (!messageHistory.has(newRoom)) {
                messageHistory.set(newRoom, []);
            }
            
            // Notify rooms
            socket.to(oldRoom).emit('user-left', {
                username: user.username,
                message: `${user.username} left the chat`,
                timestamp: new Date().toISOString(),
                type: 'system'
            });
            
            socket.to(newRoom).emit('user-joined', {
                username: user.username,
                message: `${user.username} joined the chat`,
                timestamp: new Date().toISOString(),
                type: 'system'
            });
            
            // Update users lists
            const oldRoomUsers = getRoomUsers(oldRoom);
            const newRoomUsers = getRoomUsers(newRoom);
            
            io.to(oldRoom).emit('users-update', oldRoomUsers);
            io.to(newRoom).emit('users-update', newRoomUsers);
            
            // Send recent message history to the user
            const recentMessages = messageHistory.get(newRoom).slice(-20);
            socket.emit('message-history', recentMessages);
            
            console.log(`🚪 ${user.username} moved from ${oldRoom} to ${newRoom}`);
            
        } catch (error) {
            console.error('Error in change-room:', error);
            socket.emit('error', { message: 'Failed to change room' });
        }
    });
    
    // Handle disconnect
    socket.on('disconnect', (reason) => {
        try {
            const user = connectedUsers.get(socket.id);
            
            if (user) {
                // Remove from room
                if (chatRooms.has(user.room)) {
                    chatRooms.get(user.room).delete(socket.id);
                    
                    // Clean up empty rooms
                    if (chatRooms.get(user.room).size === 0) {
                        chatRooms.delete(user.room);
                    }
                }
                
                // Notify room
                socket.to(user.room).emit('user-left', {
                    username: user.username,
                    message: `${user.username} left the chat`,
                    timestamp: new Date().toISOString(),
                    type: 'system'
                });
                
                // Update users list
                const roomUsers = getRoomUsers(user.room);
                io.to(user.room).emit('users-update', roomUsers);
                
                // Remove user
                connectedUsers.delete(socket.id);
                
                console.log(`❌ ${user.username} disconnected (${reason})`);
            } else {
                console.log(`❌ Unknown user disconnected: ${socket.id} (${reason})`);
            }
        } catch (error) {
            console.error('Error in disconnect:', error);
        }
    });
    
    // Handle connection error
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });
    
    // Handle general errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Helper functions
function getRoomUsers(room) {
    const roomUserIds = chatRooms.get(room) || new Set();
    return Array.from(roomUserIds)
        .map(id => connectedUsers.get(id))
        .filter(user => user)
        .map(user => ({
            id: user.id,
            username: user.username,
            joinedAt: user.joinedAt,
            isTyping: user.isTyping || false
        }))
        .sort((a, b) => a.username.localeCompare(b.username));
}

function generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function cleanupEmptyRooms() {
    for (const [roomName, users] of chatRooms.entries()) {
        if (users.size === 0) {
            chatRooms.delete(roomName);
            messageHistory.delete(roomName);
        }
    }
}

// Cleanup empty rooms every 10 minutes
setInterval(cleanupEmptyRooms, 10 * 60 * 1000);

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down chat server gracefully...');
    
    // Notify all users about server shutdown
    io.emit('system-message', {
        message: 'Server is shutting down. Please refresh to reconnect.',
        timestamp: new Date().toISOString(),
        type: 'system'
    });
    
    // Close server
    server.close(() => {
        console.log('✅ Chat server closed successfully');
        process.exit(0);
    });
    
    // Force close after 5 seconds
    setTimeout(() => {
        console.log('⚠️ Forcing server shutdown...');
        process.exit(1);
    }, 5000);
});

// Start server
server.listen(PORT, () => {
    console.log('\n🚀 ChatConnect Server Started!');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`📊 API Stats: http://localhost:${PORT}/api/stats`);
    console.log(`👥 API Users: http://localhost:${PORT}/api/users`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
    console.log('='.repeat(50));
    console.log('💬 Chat server ready for connections...\n');
});

// Export for testing
module.exports = { app, server, io };