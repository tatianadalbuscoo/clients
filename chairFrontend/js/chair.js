// =====================
// Connects to the server and listens for incoming data.
// As soon as new chair data arrives,
// it updates the website visualization in real time.
// =====================


/**
 * Initializes the chair data listener.
 *
 * parameters: socket (the active socket.io connection)
 * return: void
 */
function initChair(socket) {

    // Listen for incoming chair data from the server
    socket.on('chairData', (data) => {
        console.log('Received chair data:', data); // Debug

        // Update the sensor display and posture indicator on the page
        updateChairVisualization(data.sensors);
        updatePostureStatus(data.postureStatus);
    });
}


/**
 * Updates the chair sensor display based on pressure values.
 *
 * parameters: sensors (array containing pressure values from each sensor)
 * return: void
 */
function updateChairVisualization(sensors) {

    // Validate input: make sure sensors is a non-empty array
    if (!sensors || !Array.isArray(sensors)) return;
    
    // Find the maximum value to normalize the visualization
    const maxValue = Math.max(...sensors.map(sensor => sensor.value));
    
    // Update each sensor visualization
    sensors.forEach((sensor, index) => {
        const sensorElement = document.getElementById(`sensor${index + 1}`);
        if (!sensorElement) return;
        
        // Calculate intensity based on the sensor value
        const normalizedValue = sensor.value / Math.max(maxValue, 1);
        
        // Use the normalized value to determine color intensity
        const intensity = Math.min(Math.floor(normalizedValue * 100), 100);
        
        // Get a color based on intensity (from yellow to red)
        const hue = Math.max(120 - intensity * 1.2, 0);
        const backgroundColor = `hsl(${hue}, 80%, 70%)`;
        
        // Apply styles to the sensor element
        sensorElement.style.backgroundColor = backgroundColor;
        
        // Scale the size slightly based on pressure
        const scale = 1 + normalizedValue * 0.2;
        sensorElement.style.transform = `scale(${scale})`;
        
        // Display the value
        sensorElement.textContent = `S${index + 1}: ${sensor.value}`;
    });
}


/**
 * Updates the posture status element with text and visual feedback.
 *
 * parameters: status (a string representing the current posture)
 * return: void
 */
function updatePostureStatus(status) {
    const statusElement = document.getElementById('posture-status').querySelector('.indicator');
    if (!statusElement) return;
    statusElement.innerHTML = status;
}


// Export functions for Jest
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        updateChairVisualization,
        updatePostureStatus,
    };
}


// Attach functions to the window object for browser usage
if (typeof window !== 'undefined') {
    window.updateChairVisualization = updateChairVisualization;
    window.updatePostureStatus = updatePostureStatus;
}

