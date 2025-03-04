<script>
export default {
    props: {
        joined: Boolean,
        roomId: String,
        userName: String,
        users: Array,
        rooms: Array,
    },
    data() {
        return {
            isSidebarOpen: true,
            newRoom: "",
        };
    },
    methods: {
        handleJoinRoom(roomId) {
            this.$emit("join-room", roomId);
        },
        createRoom() {
            this.$emit("create-room", this.newRoom);
            this.newRoom = "";
        },
    }
}
</script>
<template>

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
                <p class="text-sm text-gray-400 mt-1">You are: <span class="font-bold text-yellow-300">{{ userName
                }}</span></p>
            </div>

            <!-- User List -->
            <div class="flex-1 overflow-y-auto">
                <h3 class="text-gray-400 font-medium mb-3 text-sm">Users in Room</h3>
                <ul>
                    <li v-for="user in users" :key="user.name"
                        class="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-800"
                        :class="{ 'bg-gray-800': user.name === userName }">
                        <div
                            class="w-8 h-8 bg-blue-500 text-white flex items-center justify-center font-bold rounded-full">
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

</template>
<style></style>