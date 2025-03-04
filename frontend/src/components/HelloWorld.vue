<script>
import { joinRoom, leaveRoom, onRoomUpdate, updateUserTime, updateHourlyRate, setupDisconnectionHandler, removeDisconnectionHandler } from "../services/socket";

export default {
  data() {
    return {
      hourlyRate: 100,
      users: [],
      userName: "",
      roomId: null,
      isSpinning: false,
      isSidebarOpen: false,
      rooms: [],
      newRoom: "",
      joined: false,
      API: "https://nasoor-l90vwr4wz-ahmaareks-projects.vercel.app"
    };
  },
  methods: {
    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
    },
    async fetchRooms() {
      try {
        const response = await fetch(this.API + "/rooms");
        const data = await response.json();
        this.rooms = data;
      } catch (error) {
        console.error("Error fetching rooms:", error);
      }
    },
    async createRoom() {
      if (!this.newRoom) return;

      try {
        const response = await fetch(this.API + "/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: this.newRoom }),
        });

        const data = await response.json();
        if (data.error) {
          alert(data.error);
        } else {
          this.rooms = data.rooms || [];
          this.newRoom = "";
        }
      } catch (error) {
        console.error("Error creating room:", error);
      }
    },
    handleJoinRoom(roomId) {
      if (!roomId || !this.userName) {
        alert("Please enter both a Room ID and a Name!");
        return;
      }

      joinRoom(roomId, this.userName, (finalName) => {
        this.userName = finalName; // Store the final username assigned by backend
        this.roomId = roomId;
        this.joined = true;

        // Setup disconnect handler
        setupDisconnectionHandler(roomId, finalName);
      });
    },
    handleLeaveRoom() {
      leaveRoom(this.roomId, this.userName);
      this.joined = false;
      this.users = [];

      // Remove disconnect handler
      removeDisconnectionHandler();
    },
    addUser() {
      if (!this.joined) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const currentTime = `${hours}:${minutes}`;

        this.users.push({ name: "", arrival: currentTime, leaving: currentTime, amountOwed: 0 });
      } else {
        alert("In room mode, users are added automatically when they join the room.");
      }
    },
    duplicateRow(index) {
      if (this.joined) {
        alert("In room mode, you cannot duplicate users.");
        return;
      }

      const userToCopy = this.users[index]; // Get the selected user
      let baseName = userToCopy.name;
      let newName = baseName;
      let copyCount = 1;

      // Ensure the new name is unique by appending a number if needed
      while (this.users.some(user => user.name === newName)) {
        newName = `${baseName} ${copyCount}`;
        copyCount++;
      }

      const newUser = {
        name: newName, // Use the unique name
        arrival: userToCopy.arrival,
        leaving: userToCopy.leaving,
        amountOwed: 0,
      };

      // Insert the new user into the list
      this.users.splice(index + 1, 0, newUser);

      // Recalculate everything
      this.calculateAmount();
    },
    calculateTotalOwed() {
      if (this.users.length === 0) return 0;

      const totalMinutes = 24 * 60;
      let earliestArrival = totalMinutes;
      let latestLeaving = 0;

      this.users.forEach(user => {
        let arrival = this.timeToMinutes(user.arrival);
        let leaving = this.timeToMinutes(user.leaving);

        if (leaving < arrival) leaving += totalMinutes; // Handle past-midnight stays

        // Round to the nearest 15 minutes
        arrival = Math.round(arrival / 15) * 15;
        leaving = Math.round(leaving / 15) * 15;

        earliestArrival = Math.min(earliestArrival, arrival);
        latestLeaving = Math.max(latestLeaving, leaving);
      });

      // Calculate the total minutes used
      let totalUsedMinutes = latestLeaving - earliestArrival;
      let totalBlocks = totalUsedMinutes / 15; // Number of 15-minute blocks

      let totalOwed = (totalBlocks * this.hourlyRate) / 4; // Since 1 hour = 4 blocks
      return totalOwed.toFixed(2);
    },
    updateUserTime(roomId, userName, arrival, leaving) {
      // Only allow updating own time in room mode
      if (!this.joined || userName !== this.userName) return;

      console.log(`Attempting to update time for ${userName} in room ${roomId}`);

      // Import the updateUserTime function from your socket service
      import("../services/socket").then(({ updateUserTime }) => {
        updateUserTime(roomId, userName, arrival, leaving);
      }).catch(error => {
        console.error('Failed to import updateUserTime:', error);
      });
    },

    // Modify setCurrentTime to use the new updateUserTime method
    setCurrentTime(user, field) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const timeString = `${hours}:${minutes}`;

      user[field] = timeString;

      // If in a room and this is the current user, broadcast the change
      if (this.joined && user.name === this.userName) {
        this.updateUserTime(
          this.roomId,
          this.userName,
          user.arrival,
          user.leaving
        );
      } else if (!this.joined) {
        this.calculateAmount(user);
      }
    },
    spinImage() {
      this.isSpinning = true;
      setTimeout(() => this.isSpinning = false, 1000);
    },
    removeUser(index) {
      if (this.joined) {
        alert("In room mode, users are removed when they leave the room.");
        return;
      }

      this.users.splice(index, 1);
      this.calculateAmount();
    },
    calculateAmount() {
      if (this.joined) {
        return; // Let the server calculate this
      }

      const totalMinutes = 24 * 60; // Total minutes in a day
      let timeBlocks = {}; // Tracks how many people are present per time block
      let userAmounts = {}; // Stores each user's total owed amount

      // First loop: Track presence in each time block
      this.users.forEach((user) => {
        let arrival = this.timeToMinutes(user.arrival);
        let leaving = this.timeToMinutes(user.leaving);

        if (leaving < arrival) {
          leaving += totalMinutes; // Handle past-midnight stays
        }

        // Round to the nearest 15-minute block
        arrival = Math.round(arrival / 15) * 15;
        leaving = Math.round(leaving / 15) * 15;

        for (let t = arrival; t < leaving; t += 15) {
          if (!timeBlocks[t]) timeBlocks[t] = 0;
          timeBlocks[t]++; // Count ALL users correctly
        }

        userAmounts[user.name] = 0; // Initialize user's owed amount
      });

      // Calculate cost per 15-minute block
      const costPerBlock = (this.hourlyRate || 0) / 4;  // Since 1 hour = 4 x 15-minute blocks

      // Second loop: Distribute cost fairly
      Object.keys(timeBlocks).forEach((block) => {
        let numPeople = timeBlocks[block];

        this.users.forEach((user) => {
          let arrival = this.timeToMinutes(user.arrival);
          let leaving = this.timeToMinutes(user.leaving);

          if (leaving < arrival) leaving += totalMinutes;

          arrival = Math.round(arrival / 15) * 15;
          leaving = Math.round(leaving / 15) * 15;

          if (block >= arrival && block < leaving) {
            userAmounts[user.name] += costPerBlock / numPeople; // Divide cost correctly
          }
        });
      });

      // Assign amounts owed back to users
      this.users.forEach((user) => {
        user.amountOwed = userAmounts[user.name];
      });
    },
    timeToMinutes(time) {
      if (!time || typeof time !== 'string') return 0;

      let [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    },
    clearAll() {
      if (this.joined) {
        alert("In room mode, you cannot clear all users.");
        return;
      }

      this.users = []; // Remove all users
    },
    updateHourlyRateAndBroadcast() {
      // If in a room, broadcast the hourly rate change
      if (this.joined) {
        updateHourlyRate(this.roomId, this.hourlyRate);
      } else {
        this.calculateAmount();
      }
    }
  },
  mounted() {
    this.fetchRooms();

    // Set up socket event listeners
    onRoomUpdate((updatedUsers) => {
      this.users = updatedUsers;
    });

    // Refresh room list periodically
    this.roomsInterval = setInterval(() => {
      if (!this.joined) {
        this.fetchRooms();
      }
    }, 10000); // every 10 seconds
  },
  beforeUnmount() {
    clearInterval(this.roomsInterval);

    // Cleanup
    if (this.joined) {
      leaveRoom(this.roomId, this.userName);
      removeDisconnectionHandler();
    }
  },
  watch: {
    hourlyRate() {
      if (!this.joined) {
        this.calculateAmount();
      } else {
        // Debounce the broadcast to avoid too many updates
        clearTimeout(this.hourlyRateTimeout);
        this.hourlyRateTimeout = setTimeout(() => {
          this.updateHourlyRateAndBroadcast();
        }, 500);
      }
    }
  }
};
</script>

<template>
  <!-- Sidebar -->
  <div class="fixed left-0 top-0 h-full bg-black text-white w-64 transform transition-transform duration-300"
    :class="{ '-translate-x-full': !isSidebarOpen }">
    <button @click="isSidebarOpen = !isSidebarOpen" class="absolute right-[-40px] top-5 
                 bg-red-700 hover:bg-red-600 text-white rounded-full w-8 h-8 
                 flex items-center justify-center shadow-lg transition-all duration-300 m10-6">
      {{ isSidebarOpen ? "✖" : "➟" }}
    </button>
    <div class="p-4" v-if="!joined">
      <input v-model="userName" placeholder="Enter Your Name"
        class="w-full bg-gray-800 text-white p-2 rounded mb-4 border border-gray-700 focus:border-red-500 focus:outline-none" />

      <h2 class="text-xl font-semibold mb-4">Available Rooms</h2>

      <ul>
        <li v-for="room in rooms" :key="room" class="mb-2">
          <button @click="handleJoinRoom(room)"
            class="bg-red-950 w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700">
            Room {{ room }}
          </button>
        </li>
      </ul>

      <div class="mt-4">
        <input v-model="newRoom" type="number" placeholder="Enter new room number"
          class="w-full text-red-950 bg-white p-2 rounded" />
        <button @click="createRoom" class="mt-2 bg-green-600 text-white w-full py-2 rounded-lg">
          Create Room
        </button>
      </div>
    </div>
    <div v-else class="w-64 h-full bg-gray-900 text-white p-4 flex flex-col">
      <!-- Room Header -->
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-gray-200">Room #{{ roomId }}</h2>
        <p class="text-sm text-gray-400 mt-1">You are: <span class="font-bold text-yellow-300">{{ userName }}</span></p>
      </div>

      <!-- User List -->
      <div class="flex-1 overflow-y-auto">
        <h3 class="text-gray-400 font-medium mb-3 text-sm">Users in Room</h3>
        <ul>
          <li v-for="user in users" :key="user.name"
            class="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-800"
            :class="{ 'bg-gray-800': user.name === userName }">
            <div class="w-8 h-8 bg-blue-500 text-white flex items-center justify-center font-bold rounded-full">
              {{ user.name.charAt(0) }}
            </div>
            <span class="text-gray-300 text-sm">{{ user.name }}</span>
          </li>
        </ul>
      </div>

      <!-- Leave Room Button -->
      <button class="mt-4 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition"
        @click="handleLeaveRoom">
        🚪 Leave Room
      </button>
    </div>
  </div>


  <div class="fixed inset-0 top-0 left-0 w-full min-h-screen bg-gradient-to-b  from-red-900 to-black -z-10"></div>

  <div class="absolute top-1/4 left-1/3 w-72 h-72 bg-black opacity-30 blur-3xl animate-moveLight z-[-1]"></div>
  <div class="container">
    <div class="h-120 flex items-center justify-center">
      <img src="../assets/taffi.png" class="h-100 rounded-lg cursor-pointer transition-transform duration-500"
        :class="{ 'rotate-360 ': isSpinning }" @click="spinImage">
    </div>

    <div class="flex items-center justify-center">
      <h1 class="font-mono font-extrabold text-2xl text-white">NASOOR</h1>
    </div>

    <!-- Room Status Banner -->
    <div v-if="joined" class="bg-green-800 text-white p-2 rounded-lg mb-4 text-center">
      <p>You're connected to Room #{{ roomId }} as {{ userName }}</p>
    </div>

    <div class="flex flex-col items-center gap-4 relative">
      <!-- Hourly Rate Input -->
      <div class="bg-red-900 p-4 rounded-lg shadow-md w-64 text-center">
        <label class="block text-sm font-mono font-medium text-white mb-1">
          Hourly Rate
        </label>
        <input type="number" v-model="hourlyRate" min="0" @change="updateHourlyRateAndBroadcast" class="w-full border text-white border-white rounded-md p-2 text-center 
                     focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-500" />
      </div>

      <!-- Floating Total Owed -->
      <div class="fixed top-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-xl w-60 text-center 
                  animate-pulse transition-transform duration-300 ease-in-out">
        <h2 class="text-lg font-semibold">Total Owed</h2>
        <p class="text-2xl font-bold mt-2">{{ calculateTotalOwed() }}</p>
      </div>
    </div>




    <div class="overflow-x-auto w-full justify-centerr">
      <table
        class="w-[90%] md:w-3/4 lg:w-2/3 border-collapse bg-red-900 text-white shadow-lg rounded-2xl overflow-hidden">
        <thead>
          <tr class="bg-black text-white">
            <th class="py-3 px-4 text-left border-b border-red-900">Name</th>
            <th class="py-3 px-4 text-left border-b border-red-900">Arrival Time</th>
            <th class="py-3 px-4 text-left border-b border-red-900">Leaving Time</th>
            <th class="py-3 px-4 text-left border-b border-red-900">Amount Owed</th>
            <th class="py-3 px-4 text-left border-b border-red-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(user, index) in users" :key="index"
            class="odd:bg-red-900 even:bg-red-800 hover:bg-red-700 transition duration-200"
            :class="{ 'bg-red-700': user.name === userName }">
            <td class="py-3 px-4 border-b border-red-700">
              <input type="text" v-model="user.name" :disabled="joined" class="bg-transparent border border-black rounded-md px-2 py-1 
                       focus:outline-none focus:ring-2 focus:ring-red-400
                       disabled:opacity-70" />
            </td>
            <td class="py-3 px-4 border-b border-red-700">
              <input type="time" v-model="user.arrival"
                @input="joined ? (user.name === userName ? updateUserTime(roomId, userName, user.arrival, user.leaving) : null) : calculateAmount(user)"
                :disabled="joined && user.name !== userName" class="bg-transparent border border-black rounded-md px-2 py-1 
                            focus:outline-none focus:ring-2 focus:ring-red-400
                            disabled:opacity-70" />
              <button @click="setCurrentTime(user, 'arrival')" :disabled="joined && user.name !== userName" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded-full 
                            transition duration-300 text-xs
                            disabled:bg-gray-400 disabled:cursor-not-allowed">
                🕒
              </button>
            </td>
            <td class="py-3 px-4 border-b border-red-700">
              <input type="time" v-model="user.leaving"
                @input="joined ? (user.name === userName ? updateUserTime(roomId, userName, user.arrival, user.leaving) : null) : calculateAmount(user)"
                :disabled="joined && user.name !== userName" class="bg-transparent border border-black rounded-md px-2 py-1 
                            focus:outline-none focus:ring-2 focus:ring-red-400
                            disabled:opacity-70" />
              <button @click="setCurrentTime(user, 'leaving')" :disabled="joined && user.name !== userName" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded-full 
                            transition duration-300 text-xs
                            disabled:bg-gray-400 disabled:cursor-not-allowed">
                🕒
              </button>
            </td>
            <td class="py-3 px-4 border-b border-red-700 font-semibold">
              {{ user.amountOwed.toFixed(2) }}
            </td>
            <td class="py-3 px-4 border-b border-red-700 flex gap-2">
              <button @click="removeUser(index)" v-if="!joined"
                class="bg-red-700 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-md shadow-md transition">
                ❌
              </button>
              <button @click="duplicateRow(index)" v-if="!joined"
                class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md shadow-md transition">
                ➕
              </button>
              <!-- For room mode, show indicators -->
              <div v-if="joined && user.name === userName" class="bg-green-600 text-white text-xs py-1 px-2 rounded-md">
                You
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button @click="addUser()" v-if="!joined" class="mt-4 px-6 py-3 rounded-full border-1 border-white
              bg-gradient-to-b from-red-900 to-black text-white
              hover:from-red-300 hover:to-black hover:scale-105
              active:scale-95 transition-all duration-500 ease-in-out shadow-md hover:shadow-2xl">
      Add User
    </button>

    <div class="w-full flex justify-center mt-4" v-if="!joined">
      <button @click="clearAll" class="px-4 py-2 bg-red-600 text-white rounded-lg shadow-md 
                                      hover:bg-red-700 active:bg-red-800 transition-all duration-200">
        Clear All
      </button>
    </div>

  </div>
  <br>
</template>

<style scoped>
.container {
  text-align: center;
  max-width: 600px;
  margin: auto;
}

.input-group {
  margin-bottom: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

th,
td {
  border: 1px solid black;
  padding: 8px;
}

button {
  margin-top: 10px;
  padding: 5px 10px;
  cursor: pointer;
}
</style>
