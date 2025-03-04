const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// Store rooms data - enhanced structure
const rooms = {};

// Emit updates to clients
function updateRoom(roomId) {
    io.to(roomId).emit("roomUpdate", rooms[roomId].users);
}

// REST API for rooms
app.get("/rooms", (req, res) => {
    res.json(Object.keys(rooms));
});

app.post("/rooms", (req, res) => {
    const { roomId } = req.body;
    
    if (!roomId) {
        return res.json({ error: "Room ID is required" });
    }
    
    if (rooms[roomId]) {
        return res.json({ error: "Room already exists" });
    }
    
    // Initialize room with users array and default hourly rate
    rooms[roomId] = {
        users: [],
        hourlyRate: 100
    };
    
    res.json({ success: true, rooms: Object.keys(rooms) });
});

// Join Room with WebSocket
io.on("connection", (socket) => {
    // Join a room
    socket.on("joinRoom", ({ roomId, userName }, callback) => {
        if (!roomId || !userName) return;

        if (!rooms[roomId]) {
            rooms[roomId] = {
                users: [],
                hourlyRate: 100
            };
        }

        let finalName = userName;
        let count = 1;
        while (rooms[roomId].users.some(user => user.name === finalName)) {
            finalName = `${userName}${count.toString().padStart(2, '0')}`;
            count++;
        }

        // Add user with default arrival/leaving times
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        
        rooms[roomId].users.push({ 
            name: finalName, 
            arrival: currentTime, 
            leaving: currentTime, 
            amountOwed: 0 
        });
        
        socket.join(roomId);
        
        // Store room info in socket for disconnect handling
        socket.roomData = { roomId, userName: finalName };
        
        updateRoom(roomId);

        // Send final assigned username back to frontend
        if (callback) callback(finalName);
    });

    // Update user time
    socket.on("updateUserTime", ({ roomId, userName, arrival, leaving }) => {
        if (!rooms[roomId]) return;
        
        const user = rooms[roomId].users.find(u => u.name === userName);
        if (user) {
            user.arrival = arrival;
            user.leaving = leaving;
            
            // Recalculate all amounts
            calculateAmounts(roomId);
            
            updateRoom(roomId);
        }
    });
    
    // Update hourly rate
    socket.on("updateHourlyRate", ({ roomId, rate }) => {
        if (!rooms[roomId]) return;
        
        rooms[roomId].hourlyRate = rate;
        
        // Recalculate all amounts
        calculateAmounts(roomId);
        
        updateRoom(roomId);
    });

    // Leave a room
    socket.on("leaveRoom", ({ roomId, userName }) => {
        if (!rooms[roomId]) return;

        rooms[roomId].users = rooms[roomId].users.filter(user => user.name !== userName);
        
        // Recalculate amounts
        calculateAmounts(roomId);
        
        socket.leave(roomId);
        updateRoom(roomId);
        
        // Clean up empty rooms
        if (rooms[roomId].users.length === 0) {
            delete rooms[roomId];
            io.emit("roomsUpdate", Object.keys(rooms));
        }
    });

    // Handle disconnections
    socket.on("disconnect", () => {
        if (socket.roomData) {
            const { roomId, userName } = socket.roomData;
            
            if (rooms[roomId]) {
                rooms[roomId].users = rooms[roomId].users.filter(user => user.name !== userName);
                
                // Recalculate amounts
                calculateAmounts(roomId);
                
                updateRoom(roomId);
                
                // Clean up empty rooms
                if (rooms[roomId].users.length === 0) {
                    delete rooms[roomId];
                    io.emit("roomsUpdate", Object.keys(rooms));
                }
            }
        }
    });
});

// Calculate amounts owed for all users in a room
function calculateAmounts(roomId) {
    if (!rooms[roomId] || rooms[roomId].users.length === 0) return;
    
    const hourlyRate = rooms[roomId].hourlyRate || 100;
    const users = rooms[roomId].users;
    const totalMinutes = 24 * 60; // Total minutes in a day
    
    let timeBlocks = {}; // Tracks how many people are present per time block
    let userAmounts = {}; // Stores each user's total owed amount

    // First loop: Track presence in each time block
    users.forEach((user) => {
        let arrival = timeToMinutes(user.arrival);
        let leaving = timeToMinutes(user.leaving);

        if (leaving < arrival) {
            leaving += totalMinutes; // Handle past-midnight stays
        }

        // Round to the nearest 15-minute block
        arrival = Math.round(arrival / 15) * 15;
        leaving = Math.round(leaving / 15) * 15;

        for (let t = arrival; t < leaving; t += 15) {
            const blockTime = t % totalMinutes; // Normalize to 0-1439
            if (!timeBlocks[blockTime]) timeBlocks[blockTime] = 0;
            timeBlocks[blockTime]++; // Count users in this block
        }

        userAmounts[user.name] = 0; // Initialize user's owed amount
    });

    // Calculate cost per 15-minute block
    const costPerBlock = hourlyRate / 4;  // Since 1 hour = 4 x 15-minute blocks

    // Second loop: Distribute cost fairly
    Object.keys(timeBlocks).forEach((block) => {
        let numPeople = timeBlocks[block];
        const blockNum = parseInt(block);

        users.forEach((user) => {
            let arrival = timeToMinutes(user.arrival);
            let leaving = timeToMinutes(user.leaving);

            if (leaving < arrival) leaving += totalMinutes;

            arrival = Math.round(arrival / 15) * 15;
            leaving = Math.round(leaving / 15) * 15;

            const normalizedBlock = blockNum;
            let extendedBlock = blockNum;
            
            // Check if the block is past midnight and the user's time spans midnight
            if (normalizedBlock < arrival && leaving > totalMinutes) {
                extendedBlock += totalMinutes;
            }

            if ((normalizedBlock >= arrival && normalizedBlock < leaving) ||
                (extendedBlock >= arrival && extendedBlock < leaving)) {
                userAmounts[user.name] += costPerBlock / numPeople; // Divide cost for this block
            }
        });
    });

    // Assign amounts owed back to users
    users.forEach((user) => {
        user.amountOwed = parseFloat(userAmounts[user.name].toFixed(2));
    });
}

// Helper function to convert time string to minutes
function timeToMinutes(time) {
    if (!time || typeof time !== 'string') return 0;
    
    let [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));