const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// const allowedOrigins = ["http://localhost:5173", "https://nasoor.vercel.app", "https://nasoor.netlify.app"]; 
const rooms = {}; // Stores rooms

    // app.use(function(req, res, next) {
    //     res.header("Access-Control-Allow-Origin", "http://localhost:5173"); // update to match the domain you will make the request from
    //     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    //     next();
    //   });

    app.options("*", (req, res) => {
        res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
        res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.sendStatus(204); // No content response for preflight
      });
app.get("/", function(req, res, next) {
    res.send("Nasoor API is running....");
});

// Get all available rooms
app.get("/rooms", (req, res, next) => {
    res.json(Object.keys(rooms));
});


// Create a new room
app.post("/rooms", (req, res, next) => {
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
app.post("/join-room", (req, res, next) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports=app;

