// services/pusherService.js
import axios from 'axios';
import Pusher from 'pusher-js';

// Environment variables from .env file
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || process.env.VUE_APP_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || process.env.VUE_APP_PUSHER_CLUSTER || 'eu';

// API URL from environment (with fallback)
const API_URL = import.meta.env.VITE_API_URL || process.env.VUE_APP_API_URL || "http://localhost:3000";

// Initialize Pusher
const pusher = new Pusher(PUSHER_KEY, {
  cluster: PUSHER_CLUSTER
});

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
    const response = await axios.post(`${API_URL}/rooms/${roomId}/join`, { userName });
    
    // Subscribe to room updates
    if (roomChannel) {
      roomChannel.unsubscribe();
    }
    
    roomChannel = pusher.subscribe(`room-${roomId}-channel`);
    console.log(`Subscribed to channel: room-${roomId}-channel`);

    roomChannel.bind('room-update', data => {
      // Notify all listeners
      console.log(`Received room-update event with data:`, data);
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

// Other functions remain the same
export async function leaveRoom(roomId, userName) {
  try {
    await axios.delete(`${API_URL}/rooms/${roomId}/users/${userName}`);
    
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

export function onRoomUpdate(callback) {
  if (callback && !roomUpdateListeners.includes(callback)) {
    roomUpdateListeners.push(callback);
  }
}

export function offRoomUpdate(callback) {
  roomUpdateListeners = roomUpdateListeners.filter(listener => listener !== callback);
}

export async function updateUserTime(roomId, userName, arrival, leaving) {
  try {
    await axios.put(`${API_URL}/rooms/${roomId}/users/${userName}`, {
      arrival,
      leaving
    });
    return true;
  } catch (error) {
    console.error("Error updating user time:", error);
    return false;
  }
}

export async function updateHourlyRate(roomId, rate) {
  try {
    await axios.put(`${API_URL}/rooms/${roomId}/rate`, { rate });
    return true;
  } catch (error) {
    console.error("Error updating hourly rate:", error);
    return false;
  }
}

export async function fetchRooms() {
  try {
    const response = await axios.get(`${API_URL}/rooms`);
    return response.data;
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return [];
  }
}

export async function createRoom(roomId) {
  try {
    const response = await axios.post(`${API_URL}/rooms`, { roomId });
    return response.data;
  } catch (error) {
    console.error("Error creating room:", error);
    return { error: "Failed to create room" };
  }
}

export function setupDisconnectionHandler(roomId, userName) {
  window.addEventListener('beforeunload', () => {
    const xhr = new XMLHttpRequest();
    xhr.open('DELETE', `${API_URL}/rooms/${roomId}/users/${userName}`, false);
    xhr.send();
  });
}

export function removeDisconnectionHandler() {
  window.removeEventListener('beforeunload', () => {});
}