import { io } from "socket.io-client";

const API_URL = ""
const LOCAL_DEV_API = "http://localhost:3000"

const socket = io(LOCAL_DEV_API);

// Join a room with error handling
export function joinRoom(roomId, userName, callback) {
  socket.emit("joinRoom", { roomId, userName }, (finalName) => {
    if (callback) callback(finalName);
  });
}

// Leave a room
export function leaveRoom(roomId, userName) {
  socket.emit("leaveRoom", { roomId, userName });
}

// Listen for room updates
export function onRoomUpdate(callback) {
  socket.on("roomUpdate", (users) => {
    if (callback) callback(users);
  });
}

// Send user time updates
export function updateUserTime(roomId, userName, arrival, leaving) {
  socket.emit("updateUserTime", { roomId, userName, arrival, leaving });
}

// Send hourly rate updates
export function updateHourlyRate(roomId, rate) {
  socket.emit("updateHourlyRate", { roomId, rate });
}

// Handle disconnection cleanup
export function setupDisconnectionHandler(roomId, userName) {
  window.addEventListener('beforeunload', () => {
    leaveRoom(roomId, userName);
  });
}

// Remove disconnect handler
export function removeDisconnectionHandler() {
  window.removeEventListener('beforeunload', () => {});
}

export default socket;