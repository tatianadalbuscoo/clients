// =====================
// Main application script
// =====================


// Import functions responsible for updating the chair's visualization and posture status display
const { updateChairVisualization, updatePostureStatus } = require('./chair');

// Selected chair ID
let selectedChairId = null;


/**
 * Main entry point - Initializes the main UI logic once the DOM is fully loaded.
 *
 * - Loads available chair IDs.
 * - Handles WebSocket connection when the "connect" button is clicked.
 * - Starts PoseNet and listens for real-time updates based on the selected chair.
 */
document.addEventListener('DOMContentLoaded', () => {

    // Fetch chair IDs from the server and populate the dropdown
    loadChairIds();
    //setupDateFilters();

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
        //initHistory();

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

    // Fetch chair IDs from the server
    fetch(`${CONFIG.SERVER.URL}/api/chairids`)
        .then(res => res.json())
        .then(data => {
            console.log('Received chair IDs:', data);

            const select = document.getElementById('chair-select');

            // Add a default disabled <option> prompting the user to select a chair
            select.innerHTML = '<option value="" disabled selected>Select a chair</option>';

            // If no chair IDs are returned, show a message in the dropdown
            if (!data.ids || data.ids.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No chairs available';
                option.disabled = true;
                select.appendChild(option);
                return;
            }

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


// Export functions so they can be tested
module.exports = {
    updatePostureFeedback,
    updateChairData
};


// Set default date filters to last 7 days and load history data
/*function setupDateFilters() {
    const today = new Date();
    const fromDate = new Date();

    // Set "from" date to 7 days ago
    fromDate.setDate(today.getDate() - 7);

    // Populate the date inputs with the default values
    document.getElementById('from-date').valueAsDate = fromDate;
    document.getElementById('to-date').valueAsDate = today;

    // Add event listener to filter button
    document.getElementById('filter-btn').addEventListener('click', () => {
        loadHistoryData();
    });

}*/

// Loads history data based on selected date range
/*function loadHistoryData() {
    const fromDate = document.getElementById('from-date').value;
    const toDate = document.getElementById('to-date').value;

    // Fetch data for the selected chair and date range
    //fetchHistory(selectedChairId || 'CHAIR01', fromDate, toDate);

}*/

/*
// Fetches posture history data from the server and updates the chart/table
function fetchHistory(chairId, from, to) {
    const url = `${CONFIG.SERVER.URL}/api/history/${chairId}?from=${from}&to=${to}`;

    fetch(url)
        .then(response => {
            console.log('Fetching history from:', url);
            return response.json();
        })
        .then(data => {
            console.log('Fetched data:', data);

            if (!Array.isArray(data) || data.length === 0) {
                alert('No history data found for the selected period.');
                return;
            }

            //updateHistoryTable(data);
            //updateHistoryChart(data);
        })
        .catch(error => {
            console.error('Error fetching history:', error);
        });
}*/






