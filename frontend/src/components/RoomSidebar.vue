<script>

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
            <input v-model="userName" placeholder="Enter Your Name" />
            <!-- <input v-model="roomId" type="number" placeholder="Enter Room number" /> -->
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

        <div v-else>
            <h2>Room #{{ roomId }}</h2>
            <h3>Users in Room:</h3>
            <ul>
                <li v-for="user in users" :key="user.name">{{ user.name }}</li>
            </ul>
            <button @click="handleLeaveRoom">Leave Room</button>
        </div>
    </div>
</template>
<style>
</style>