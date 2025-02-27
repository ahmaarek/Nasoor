<script>
export default {
  data() {
    return {
      hourlyRate: 0,
      users: [],
    };
  },
  methods: {
    addUser() {
      this.users.push({ name: "", arrival: "", leaving: "", amountOwed: 0 });
    },
    removeUser(index) {
      this.users.splice(index, 1);
      this.calculateAmount();
    },
    calculateAmount() {
      const totalMinutes = 24 * 60; // Total minutes in a day
      let timeBlocks = {}; // Tracks how many people are present per time block
      let userAmounts = {}; // Stores each user's total owed amount

      this.users.forEach((user) => {
        let arrival = this.timeToMinutes(user.arrival);
        let leaving = this.timeToMinutes(user.leaving);

        // Handle cases where leaving time is past midnight
        if (leaving < arrival) {
          leaving += totalMinutes; // Treat the next day's time as continuous
        }

        // Round arrival and leaving to nearest 15-minute block
        arrival = Math.round(arrival / 15) * 15;
        leaving = Math.round(leaving / 15) * 15;

        // Track presence in 15-minute blocks
        for (let t = arrival; t < leaving; t += 15) {
          if (!timeBlocks[t]) timeBlocks[t] = 0;
          timeBlocks[t] += 1;
        }

        // Initialize user's amount owed
        userAmounts[user.name] = 0;
      });

      // Calculate cost per 15-minute block
      const costPerBlock = this.hourlyRate / 4; // Since 1 hour = 4 x 15-minute blocks

      Object.keys(timeBlocks).forEach((block) => {
        let numPeople = timeBlocks[block];

        this.users.forEach((user) => {
          let arrival = this.timeToMinutes(user.arrival);
          let leaving = this.timeToMinutes(user.leaving);

          if (leaving < arrival) leaving += totalMinutes; // Handle past-midnight stays

          arrival = Math.round(arrival / 15) * 15;
          leaving = Math.round(leaving / 15) * 15;

          if (block >= arrival && block < leaving) {
            userAmounts[user.name] += costPerBlock / numPeople;
          }
        });
      });

      // Assign calculated amounts to each user
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
  },
};
</script>

<template>

  <body class="bg-black">

    <div class="container">
      <div class="h-120 flex items-center justify-center">
        <img src="../assets/taffi.jpg" class="h-100 rounded-lg ">
      </div>

      <div class="flex items-center justify-center">
        <h1 class="font-mono font-extrabold text-2xl text-blue-400">NASOOR</h1>
      </div>
      <div class="bg-blue-400 p-4 rounded-lg shadow-md w-64 mx-auto">
        <label class="block text-sm font-mono font-medium text-black mb-1">Hourly Rate</label>
        <input type="number" v-model="hourlyRate" min="0"
          class="w-full border border-black rounded-md p-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500" />
      </div>

      <table class="text-white">
        <thead>
          <tr>
            <th>Name</th>
            <th>Arrival Time</th>
            <th>Leaving Time</th>
            <th>Amount Owed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(user, index) in users" :key="index">
            <td>
              <input type="text" v-model="user.name" placeholder="Enter name" />
            </td>
            <td>
              <input type="time" v-model="user.arrival" @input="calculateAmount(user)" />
            </td>
            <td>
              <input type="time" v-model="user.leaving" @input="calculateAmount(user)" />
            </td>
            <td>{{ user.amountOwed }}</td>
            <td>
              <button @click="removeUser(index)">❌</button>
            </td>
          </tr>
        </tbody>
      </table>

      <button class="px-4 py-2 rounded-full border-2 border-blue-400 text-blue-400 
         hover:bg-blue-900 hover:text-white hover:border-transparent 
         active:bg-blue-700 transition-all duration-200 ease-in-out shadow-md" @click="addUser">
        Add User
      </button>

    </div>
  </body>
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
