const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: "*",  // Allow all origins (Change this to your frontend URL for security)
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"]
}));
const rooms = {}; // Stores rooms

app.get("/", (req, res) => {
    res.send("Nasoor API is running...");
});

// Get all available rooms
app.get("/rooms", (req, res) => {
    res.json(Object.keys(rooms));
});

// Create a new room
app.post("/rooms", (req, res) => {
    const { roomId } = req.body;
    if (!roomId) {
        return res.status(400).json({ error: "Room ID is required" });
    }
    
    if (rooms[roomId]) {
        return res.status(400).json({ error: "Room already exists" });
    }

    rooms[roomId] = [];
    res.json({ message: "Room created", rooms: Object.keys(rooms) });
});

// Join a room
app.post("/join-room", (req, res) => {
    const { roomId, userName } = req.body;
    if (!roomId || !userName) {
        return res.status(400).json({ error: "Room ID and user name are required" });
    }

    if (!rooms[roomId]) {
        return res.status(404).json({ error: "Room does not exist" });
    }

    rooms[roomId].push({ name: userName, arrival: "", leaving: "", amountOwed: 0 });

    res.json({ message: "User added", users: rooms[roomId] });
});

const PORT = process.env.PORT || 0;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

