<script>
export default {
  data() {
    return {
      hourlyRate: 100,
      users: [],
      isSpinning: false,
      isSidebarOpen: false,
      rooms: [],
      newRoom: "",
      API : "https://nasoor-l90vwr4wz-ahmaareks-projects.vercel.app"
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
        const response = await fetch(this.API+ "/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: this.newRoom }),
        });

        const data = await response.json();
        if (data.error) {
          alert(data.error);
        } else {
          this.rooms = data.rooms;
          this.newRoom = "";
        }
      } catch (error) {
        console.error("Error creating room:", error);
      }
    },
    async joinRoom(room) {
      const userName = prompt("Enter your name:");
      if (!userName) return;

      try {
        const response = await fetch(this.API + "join-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room, userName }),
        });

        const data = await response.json();
        if (data.error) {
          alert(data.error);
        } else {
          alert(`You joined room: ${room}`);
        }
      } catch (error) {
        console.error("Error joining room:", error);
      }
    },
    addUser() {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${hours}:${minutes}`;

      this.users.push({ name: "", arrival: currentTime, leaving: currentTime, amountOwed: 0 });
    },
    duplicateRow(index) {
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
    setCurrentTime(user, field) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      user[field] = `${hours}:${minutes}`;
      this.calculateAmount(user);
    },
    spinImage() {
      this.isSpinning = true;
      setTimeout(() => this.isSpinning = false, 1000);
    },
    removeUser(index) {
      this.users.splice(index, 1);
      this.calculateAmount();
    },
    calculateAmount() {
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
      let [hours, minutes] = time.split(/[: ]/);
      const period = time.includes("PM") ? "PM" : "AM";
      hours = parseInt(hours, 10);
      minutes = parseInt(minutes, 10);

      return hours * 60 + minutes;
    },
    clearAll() {
      this.users = []; // Remove all users
    },

  },

  mounted() {
    this.fetchRooms();
  },
};
</script>

<template>
  <!-- Sidebar Toggle Button -->


  <!-- Sidebar -->
  <div class="fixed left-0 top-0 h-full bg-black text-white w-64 transform transition-transform duration-300"
    :class="{ '-translate-x-full': !isSidebarOpen }">
    <button @click="isSidebarOpen = !isSidebarOpen" class="absolute right-[-40px] top-5 
                 bg-red-700 hover:bg-red-600 text-white rounded-full w-8 h-8 
                 flex items-center justify-center shadow-lg transition-all duration-300 m10-6">
      {{ isSidebarOpen ? "✖" : "➟" }}
    </button>
    <div class="p-4">
      <h2 class="text-xl font-semibold mb-4">Available Rooms</h2>

      <ul>
        <li v-for="room in rooms" :key="room" class="mb-2">
          <button @click="joinRoom(room)" class="bg-red-950 w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700">
            {{ room }}
          </button>
        </li>
      </ul>

      <div class="mt-4">
        <input v-model="newRoom" type="number" placeholder="Enter new room name"
          class="w-full text-red-950 bg-white p-2 rounded" />
        <button @click="createRoom" class="mt-2 bg-green-600 text-white w-full py-2 rounded-lg">
          Create Room
        </button>
      </div>
    </div>
  </div>

  <!-- <body ></body>class="min-h-screen bg-gradient-to-b from-red-900 to-black flex flex-col items-center justify-center"> -->

  <div class="fixed top-0 left-0 w-full h-screen bg-gradient-to-b  from-red-900 to-black -z-10"></div>

  <div class="absolute top-1/4 left-1/3 w-72 h-72 bg-black opacity-30 blur-3xl animate-moveLight"></div>
  <!-- <div class="absolute top-1/2 left-2/3 w-96 h-96 bg-black opacity-30 blur-3xl animate-moveLight"></div> -->
  <div class="container">
    <div class="h-120 flex items-center justify-center">
      <img src="../assets/taffi.png" class="h-100 rounded-lg cursor-pointer transition-transform duration-500"
        :class="{ 'rotate-360 ': isSpinning }" @click="spinImage">
    </div>

    <div class="flex items-center justify-center">
      <h1 class="font-mono font-extrabold text-2xl text-white">NASOOR</h1>
    </div>
    <div class="flex flex-col items-center gap-4 relative">
      <!-- Hourly Rate Input -->
      <div class="bg-red-900 p-4 rounded-lg shadow-md w-64 text-center">
        <label class="block text-sm font-mono font-medium text-white mb-1">
          Hourly Rate
        </label>
        <input type="number" v-model="hourlyRate" min="0" class="w-full border text-white border-white rounded-md p-2 text-center 
             focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-500" />
      </div>

      <!-- Floating Total Owed -->
      <div class="fixed top-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-xl w-60 text-center 
          animate-pulse transition-transform duration-300 ease-in-out">
        <h2 class="text-lg font-semibold">Total Owed</h2>
        <p class="text-2xl font-bold mt-2">{{ calculateTotalOwed() }}</p>
      </div>
    </div>



    <div class="flex justify-center">
      <table
        class="w-[90%] md:w-3/4 lg:w-2/3 border-collapse bg-red-900 text-white shadow-lg rounded-lg overflow-hidden">
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
            class="odd:bg-red-900 even:bg-red-800 hover:bg-red-700 transition duration-200">
            <td class="py-3 px-4 border-b border-red-700">
              <input type="text" v-model="user.name"
                class="bg-transparent border border-black rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-400" />
            </td>
            <td class="py-3 px-4 border-b border-red-700">
              <input type="time" v-model="user.arrival" @input="calculateAmount(user)"
                class="bg-transparent border border-black rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-400" />
              <button @click="setCurrentTime(user, 'arrival')"
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded-full transition duration-300 text-xs">
                🕒
              </button>
            </td>
            <td class="py-3 px-4 border-b border-red-700">
              <input type="time" v-model="user.leaving" @input="calculateAmount(user)"
                class="bg-transparent border border-black rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-400" />
              <button @click="setCurrentTime(user, 'leaving')"
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded-full transition duration-300 text-xs">
                🕒
              </button>
            </td>
            <td class="py-3 px-4 border-b border-red-700 font-semibold">
              {{ user.amountOwed.toFixed(2) }}
            </td>
            <td class="py-3 px-4 border-b border-red-700 flex gap-2">
              <button @click="removeUser(index)"
                class="bg-red-700 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-md shadow-md transition">
                ❌
              </button>
              <button @click="duplicateRow(index)"
                class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md shadow-md transition">
                ➕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button @click="addUser()" class="px-6 py-3 rounded-full border-1 border-white
  bg-gradient-to-b from-red-900 to-black text-white
  hover:from-red-300 hover:to-black hover:scale-105
  active:scale-95 transition-all duration-500 ease-in-out shadow-md hover:shadow-2xl">
      Add User
    </button>

    <div class="w-full flex justify-center mt-4">
      <button @click="clearAll" class="px-4 py-2 bg-red-600 text-white rounded-lg shadow-md 
           hover:bg-red-700 active:bg-red-800 transition-all duration-200">
        Clear All
      </button>
    </div>

  </div>
  <br>

  </br>
  <!-- </body> -->
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
