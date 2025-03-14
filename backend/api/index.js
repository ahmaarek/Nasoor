const express = require("express");
const cors = require("cors");
const Pusher = require("pusher");
require("dotenv").config();

const app = express();

// Initialize Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER || "eu",
  useTLS: true
});

console.log('PUSHER_APP_ID:', process.env.PUSHER_APP_ID ? 'SET' : 'NOT SET');
console.log('PUSHER_KEY:', process.env.PUSHER_KEY ? 'SET' : 'NOT SET');
console.log('PUSHER_SECRET:', process.env.PUSHER_SECRET ? 'SET' : 'NOT SET');
console.log('PUSHER_CLUSTER:', process.env.PUSHER_CLUSTER || 'eu');

app.use(cors());
const allowedOriginsString = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
const allowedOrigins = allowedOriginsString.split(',').map(origin => origin.trim());

console.log('CORS: Allowed origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log('CORS: Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Store rooms data
const rooms = {};

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
  
  // Broadcast room update via Pusher
  pusher.trigger("rooms-channel", "rooms-update", {
    rooms: Object.keys(rooms)
  });
  
  res.json({ success: true, rooms: Object.keys(rooms) });
});

// Join a room
app.post("/rooms/:roomId/join", (req, res) => {
  const { roomId } = req.params;
  let { userName } = req.body;
  
  if (!roomId || !userName) {
    return res.status(400).json({ error: "Room ID and username are required" });
  }
  
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: [],
      hourlyRate: 100
    };
  }
  
  // Ensure unique username
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
  
  // Calculate amounts
  calculateAmounts(roomId);
  
  // Broadcast room update
  pusher.trigger(`room-${roomId}-channel`, "room-update", {
    users: rooms[roomId].users
  });
  
  res.json({ success: true, finalName, users: rooms[roomId].users });
});

// Update user time
app.put("/rooms/:roomId/users/:userName", (req, res) => {
  const { roomId, userName } = req.params;
  const { arrival, leaving } = req.body;
  
  if (!rooms[roomId]) {
    return res.status(404).json({ error: "Room not found" });
  }
  
  const user = rooms[roomId].users.find(u => u.name === userName);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  user.arrival = arrival;
  user.leaving = leaving;
  
  // Recalculate amounts
  calculateAmounts(roomId);
  
  // Broadcast room update
  pusher.trigger(`room-${roomId}-channel`, "room-update", {
    users: rooms[roomId].users
  });
  console.log(`After calculation, users:`, JSON.stringify(rooms[roomId].users));
  
  res.json({ success: true, users: rooms[roomId].users });
});

// Update hourly rate
app.put("/rooms/:roomId/rate", (req, res) => {
  const { roomId } = req.params;
  const { rate } = req.body;
  
  if (!rooms[roomId]) {
    return res.status(404).json({ error: "Room not found" });
  }
  
  rooms[roomId].hourlyRate = rate;
  
  // Recalculate amounts
  calculateAmounts(roomId);
  
  // Broadcast room update
  pusher.trigger(`room-${roomId}-channel`, "room-update", {
    users: rooms[roomId].users
  });
  
  res.json({ success: true, users: rooms[roomId].users });
});

// Leave a room
app.delete("/rooms/:roomId/users/:userName", (req, res) => {
  const { roomId, userName } = req.params;
  
  if (!rooms[roomId]) {
    return res.status(404).json({ error: "Room not found" });
  }
  
  rooms[roomId].users = rooms[roomId].users.filter(user => user.name !== userName);
  
  // Recalculate amounts
  calculateAmounts(roomId);
  
  // Broadcast room update
  pusher.trigger(`room-${roomId}-channel`, "room-update", {
    users: rooms[roomId].users
  });
  
  // Clean up empty rooms
  if (rooms[roomId].users.length === 0) {
    delete rooms[roomId];
    
    // Broadcast rooms update
    pusher.trigger("rooms-channel", "rooms-update", {
      rooms: Object.keys(rooms)
    });
  }
  
  res.json({ success: true });
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));