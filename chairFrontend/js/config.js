// =====================
// Configuration file for the application
// =====================


const CONFIG = {

    // Server configuration
    SERVER: {

        // Server IP address and port
        IP: 'localhost',
        PORT: '3000',

        // Full server URL (constructed from IP and PORT)
        get URL() {
            return `http://${this.IP}:${this.PORT}`;
        },

        // Socket.IO URL
        get SOCKET_URL() {
            return `http://${this.IP}:${this.PORT}/socket.io/socket.io.js`;
        }
    }
};

// Make the configuration available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

