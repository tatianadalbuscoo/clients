// =====================
// Main application script
// =====================


// Selected chair ID
let selectedChairId = null;


/**
 * Main entry point - Initializes the main UI logic once the DOM is fully loaded.
 *
 * - Loads available chair IDs.
 * - Handles WebSocket connection when the "connect" button is clicked.
 * - Initialize PoseNet and listens for real-time updates based on the selected chair.
 */
document.addEventListener('DOMContentLoaded', () => {

    // Fetch chair IDs from the server and populate the dropdown
    loadChairIds();

    // Event listener for the "Connect" button
    const connectBtn = document.getElementById('connect-btn');
    connectBtn.addEventListener('click', () => {
        const select = document.getElementById('chair-select');
        selectedChairId = select.value;

        // Require a chair selection before connecting
        if (!selectedChairId) {
            alert('Please select a chair!');
            return;
        }

        // Prevent multiple socket connections
        if (window.socket && window.socket.connected) {
            console.log('Already connected');   // Debug
            return;
        }

        // Open socket connection to server
        const socket = io(CONFIG.SERVER.URL);
        window.socket = socket;

        // Show successful connection status
        socket.on('connect', () => {
            console.log('Connected to server'); // Debug
            document.getElementById('connection-status').textContent =
                `Connected to ${selectedChairId}`;
        });

        // Initialize PoseNet
        initPoseNet(socket);

        // Listen for sensor data
        socket.on('chairData', (data) => {
            if (data.chairId !== selectedChairId) return;
            updateChairData(data);
        });

        // Listen for posture updates (from PoseNet or sensors)
        socket.on('postureUpdate', (data) => {
            if (data.chairId !== selectedChairId) return;
            updatePostureFeedback(data.postureStatus, data.source === 'posenet' ? 'posenet' : 'sensors');
        });
    });
});


/**
 * Fetches available chair IDs from the server and populates the <select> dropdown.
 *
 * - Makes a GET request to /api/chairids
 * - If chair IDs are returned, adds them as <option> elements in the dropdown
 * - Adds a default "Select a chair" disabled option
 *
 *  parameters: none
 *  return: void
 */
function loadChairIds() {

    // Construct the API URL for fetching chair IDs
    let s = `${CONFIG.SERVER.URL}/api/chairids`;

    // Fetch chair IDs from the server (Get request)
    fetch(`${CONFIG.SERVER.URL}/api/chairids`)
        .then(res => res.json())
        .then(data => {
            console.log('Received chair IDs:', data); // Debug

            const select = document.getElementById('chair-select');

            // Add a default disabled <option> prompting the user to select a chair
            select.innerHTML = '<option value="" disabled selected>Select a chair</option>';

            // For each chair ID, create and append an <option> element
            data.ids.forEach(id => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = id;
                select.appendChild(option);
            });
        })
        .catch(err => {

            // Log any error that occurred during the fetch
            console.error('Error fetching chair IDs:', err);
        });
}


/**
 * Updates the UI with new sensor and posture data received from the selected chair.
 *
 * parameters: data (object containing sensor and posture information)
 * return: void
 */
function updateChairData(data) {

    // Make sure the data object exists and contains sensor information
    if (!data || !data.sensors) {
        console.error('Invalid chair data received:', data);
        return;
    }

    // Update the sensor visualization on the UI
    updateChairVisualization(data.sensors);

    // If posture data is present and NOT from PoseNet, update posture status
    if (data.source !== 'posenet' && data.postureStatus) {
        updatePostureFeedback(data.postureStatus, 'sensors');
    }

    // Update the status area with a timestamp of the last update
    const timestamp = new Date().toLocaleTimeString();
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = `Connected to ${selectedChairId} (Last update: ${timestamp})`;
    }
}


/**
 * Updates the posture status display based on the given posture type and data source.
 * parameters: status (string), source (string: 'sensors' or 'posenet', default = 'sensors')
 * return: void
 */
function updatePostureFeedback(status, source = 'sensors') {

    // Default messages in case the posture is unrecognized
    let statusText = 'Unknown';
    let adviceText = 'Posture not recognized.';

    console.log('Received postureStatus =', status); // Debug

    // Determine posture label and advice based on the status code
    switch (status) {
        case 'good':
            statusText = 'Good Posture';
            adviceText = 'Great job! Keep your back straight and relaxed, with your shoulders aligned.';
            break;
        case 'poor':
            statusText = 'Poor Posture';
            adviceText = 'Your shoulders appear unbalanced. Straighten your back and distribute your weight evenly.';
            break;
        case 'not_sitting':
            statusText = 'Not Sitting';
            adviceText = 'No sitting posture detected. Make sure you’re seated and visible to the camera.';
            break;
        case 'lean_forwarding':
            statusText = 'Leaning Forward';
            adviceText = 'You seem to be leaning forward. Try to sit back and let your spine rest against the chair.';
            break;
    }

    if (source === 'posenet') {

        // If data comes from PoseNet → update the feedback panel near the camera view
        const statusElement = document.getElementById('feedback-status');
        const descriptionElement = document.getElementById('feedback-description');
        const panel = document.getElementById('posture-feedback');

        // Update panel class and text content
        if (panel) panel.className = `posture-box ${status}`;
        if (statusElement) statusElement.textContent = statusText;
        if (descriptionElement) descriptionElement.textContent = adviceText;

        console.log('[PoseNet] Updated feedback panel'); // Debug

    } else {

        // If data comes from sensors → update the main posture indicator
        const indicator = document.querySelector('#posture-status .indicator');
        const panel = document.getElementById('posture-status');

        if (indicator) {

            // Reset and apply the new posture class
            indicator.classList.remove('good', 'poor', 'leaning_forward', 'not_sitting');
            indicator.classList.add(status);
            indicator.textContent = statusText;
            console.log('[Sensors] Updated main status indicator'); // Debug
        }
    }
}


// Export functions for Jest
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    const { updateChairVisualization } = require('./chair.js');
    global.updateChairVisualization = updateChairVisualization;
    module.exports = {
        updatePostureFeedback,
        updateChairData
    };
}

// Attach to window for browser usage (e.g. from other scripts)
if (typeof window !== 'undefined') {
    window.updatePostureFeedback = updatePostureFeedback;
    window.updateChairData = updateChairData;
}

