// services/pusherService.js
import axios from 'axios';
import Pusher from 'pusher-js';

// Initialize Pusher
const pusher = new Pusher('2010b2803d06844ca956', {
  cluster: 'eu'
});

// API URL
const API = "https://nasoor-git-pusher-integration-ahmaareks-projects.vercel.app";
const DEV_API = "http://localhost:3000"; // Change to your production URL when deploying

// Listeners objects to track subscriptions
let roomUpdateListeners = [];
let roomChannel = null;
let roomsChannel = null;

// Subscribe to the rooms channel for available rooms updates
export function listenForRoomsUpdates(callback) {
  if (!roomsChannel) {
    roomsChannel = pusher.subscribe('rooms-channel');
    roomsChannel.bind('rooms-update', data => {
      if (callback) callback(data.rooms);
    });
  }
}

// Join a room
export async function joinRoom(roomId, userName, callback) {
  try {
    const response = await axios.post(`${API}/rooms/${roomId}/join`, { userName });
    
    // Subscribe to room updates
    if (roomChannel) {
      roomChannel.unsubscribe();
    }
    
    roomChannel = pusher.subscribe(`room-${roomId}-channel`);
    roomChannel.bind('room-update', data => {
      // Notify all listeners
      roomUpdateListeners.forEach(listener => listener(data.users));
    });
    
    // Return the assigned username and users
    if (callback) callback(response.data.finalName);
    return response.data;
  } catch (error) {
    console.error("Error joining room:", error);
    return null;
  }
}

// Leave a room
export async function leaveRoom(roomId, userName) {
  try {
    await axios.delete(`${API}/rooms/${roomId}/users/${userName}`);
    
    // Unsubscribe from the room channel
    if (roomChannel) {
      roomChannel.unsubscribe();
      roomChannel = null;
    }
    
    return true;
  } catch (error) {
    console.error("Error leaving room:", error);
    return false;
  }
}

// Register for room updates
export function onRoomUpdate(callback) {
  if (callback && !roomUpdateListeners.includes(callback)) {
    roomUpdateListeners.push(callback);
  }
}

// Remove room update listener
export function offRoomUpdate(callback) {
  roomUpdateListeners = roomUpdateListeners.filter(listener => listener !== callback);
}

// Update user time
export async function updateUserTime(roomId, userName, arrival, leaving) {
  try {
    await axios.put(`${API}/rooms/${roomId}/users/${userName}`, {
      arrival,
      leaving
    });
    return true;
  } catch (error) {
    console.error("Error updating user time:", error);
    return false;
  }
}

// Update hourly rate
export async function updateHourlyRate(roomId, rate) {
  try {
    await axios.put(`${API}/rooms/${roomId}/rate`, { rate });
    return true;
  } catch (error) {
    console.error("Error updating hourly rate:", error);
    return false;
  }
}

// Fetch available rooms
export async function fetchRooms() {
  try {
    const response = await axios.get(`${API}/rooms`);
    return response.data;
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return [];
  }
}

// Create a new room
export async function createRoom(roomId) {
  try {
    const response = await axios.post(`${API}/rooms`, { roomId });
    return response.data;
  } catch (error) {
    console.error("Error creating room:", error);
    return { error: "Failed to create room" };
  }
}

// Setup disconnect handler for browser close
export function setupDisconnectionHandler(roomId, userName) {
  window.addEventListener('beforeunload', () => {
    // Make a synchronous request to leave the room
    const xhr = new XMLHttpRequest();
    xhr.open('DELETE', `${API}/rooms/${roomId}/users/${userName}`, false);
    xhr.send();
  });
}

// Remove disconnect handler
export function removeDisconnectionHandler() {
  window.removeEventListener('beforeunload', () => {});
}