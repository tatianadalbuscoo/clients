// Main application script
// Initializes app modules and connects to server once the page is fully loaded
let selectedChairId = null;





document.addEventListener('DOMContentLoaded', () => {
    // Initialize Socket.IO
    //const socket = io('http://172.20.10.2:3000');

    // Set up Socket.IO event listeners
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    // Initialize modules
    initChair(socket);
    initPoseNet(socket);
    initHistory();


    // Set current date in the date filters
    setupDateFilters();
});

// Carica gli ID disponibili dal server e popola il <select>
function loadChairIds() {
    let s = `${CONFIG.SERVER.URL}/api/chairids`;
    console.log(s);
  fetch(`${CONFIG.SERVER.URL}/api/chairids`) // Use full URL instead of relative path
    .then(res => res.json())
    .then(data => {
      console.log('Received chair IDs:', data);

      const select = document.getElementById('chair-select');
      select.innerHTML = '<option disabled selected>Select a chair</option>';

      if (!data.ids || data.ids.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No chairs available';
        option.disabled = true;
        select.appendChild(option);
        return;
      }

      data.ids.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = id;
        select.appendChild(option);
      });
    })
    .catch(err => {
      console.error('Error fetching chair IDs:', err);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  loadChairIds(); // carica gli ID al caricamento

    const connectBtn = document.getElementById('connect-btn');
    connectBtn.addEventListener('click', () => {
        const select = document.getElementById('chair-select');
        selectedChairId = select.value;

        if (!selectedChairId) {
            alert('Please select a chair!');
            return;
        }

        // Avvia connessione
        socket = io(CONFIG.SERVER.URL);

        socket.on('connect', () => {
            console.log('Connected to server');
            document.getElementById('connection-status').textContent = `Connected to ${selectedChairId}`;
        });

        // Inizializzazioni DOPO connessione
        initPoseNet(socket);
        initHistory();
        setupDateFilters();

        socket.on('chairData', (data) => {
            if (data.chairId !== selectedChairId) return;
            updateChairData(data);
        });

        socket.on('postureUpdate', (data) => {
            if (data.chairId !== selectedChairId) return;
            updatePostureStatus(data.postureStatus, data.source === 'posenet' ? 'posenet' : 'sensors');
        });
    });


});


    // Listener per feedback da PoseNetsocket.on('postureUpdate', (data) => {
      socket.on('postureUpdate', (data) => {
          //loadHistoryData();
          if (data.chairId !== selectedChairId) return;

          if (data.source === 'posenet') {
              console.log('Posture update (PoseNet):', data);
              updatePostureStatus(data.postureStatus, 'posenet');
          } else {
              console.log('Posture update (Sensor):', data);
              updatePostureStatus(data.postureStatus, 'sensors');
          }
      });





// Set default date filters to last 7 days and load history data
function setupDateFilters() {
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
    
}

// Loads history data based on selected date range
function loadHistoryData() {
    const fromDate = document.getElementById('from-date').value;
    const toDate = document.getElementById('to-date').value;

    // Fetch data for the selected chair and date range
    fetchHistory(selectedChairId || 'CHAIR01', fromDate, toDate);

}
function updateChairData(data) {
    // Verifica che i dati contengano le informazioni necessarie
    if (!data || !data.sensors) {
      console.error('Invalid chair data received:', data);
      return;
    }

    // Aggiorna la visualizzazione dei sensori
    updateChairVisualization(data.sensors);

    // Se i dati contengono anche informazioni sulla postura, aggiorna anche quella
    // Se i dati contengono anche informazioni sulla postura, aggiorna solo se NON viene da PoseNet
    if (data.source !== 'posenet' && data.postureStatus) {
        updatePostureStatus(data.postureStatus, 'sensors');
    }


    // Aggiorna il timestamp dell'ultimo aggiornamento (opzionale)
    const timestamp = new Date().toLocaleTimeString();
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.textContent = `Connected to ${selectedChairId} (Last update: ${timestamp})`;
    }
  }

// Fetches posture history data from the server and updates the chart/table
/*function fetchHistory(chairId, from, to) {
    const url = `http://d9b3-194-230-145-110.ngrok-free.app/api/history/${chairId}?from=${from}&to=${to}`;

    fetch(url)
        .then(response => {
            console.log('Fetching history from:', url);
            console.log(response)
            return response.text()
        })
        .then(rawText => {
            try {
                console.log('Raw response:', rawText);
                const data = JSON.parse(rawText);
                console.log('History data ed:', data);
                updateHistoryTable(data);
                updateHistoryChart(data);
            } catch (error) {

                console.error('Error parsing history data:', error);
                throw new Error('Invalid JSON format');
            }

            // Update the table and chart with the fetched data

        })
        .catch(error => {
            console.error('Error fetching history:', error);
        });
}*/
function fetchHistory(chairId, from, to) {
   const url = `${CONFIG.SERVER.URL}/api/history/${chairId}?from=${from}&to=${to};`

    fetch(url)
        .then(response => {
            console.log('Fetching history from:', url);
            return response.json();
        })
        .then(data => {
            console.log('Fetched data:', data);
            updateHistoryTable(data);
            updateHistoryChart(data);
        })
        .catch(error => {
            console.error('Error fetching history:', error);
        });
}

// Formats a date string into a readable format (e.g., "Apr 27, 2025, 14:30")
function formatDate(dateString) {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function updatePostureStatus(status, source = 'sensors') {
    let statusText = 'Unknown';
    let adviceText = 'Posture not recognized.';

    console.log('[UI] Received postureStatus =', status);


    switch (status) {
        case 'good':
            statusText = 'Good Posture';
            adviceText = 'Great job! Keep your back straight and relaxed, with your shoulders aligned.';
            break;
        case 'poor':
            statusText = 'Poor Posture';
            adviceText = 'Your shoulders appear unbalanced. Straighten your back and distribute your weight evenly.';
            break;
        /*case 'leaning_forward':
            statusText = 'Leaning Forward';
            adviceText = 'Your head is too far forward. Pull your chin back and align your ears with your shoulders.';
            break;*/
        case 'not_sitting':
            statusText = 'Not Sitting';
            adviceText = 'No sitting posture detected. Make sure you’re seated and visible to the camera.';
            break;

    }

    if (source === 'posenet') {
        // Posture da PoseNet → aggiorna riquadro vicino al video
        const statusElement = document.getElementById('feedback-status');
        const descriptionElement = document.getElementById('feedback-description');
        const panel = document.getElementById('posture-feedback');

        if (panel) panel.className = `posture-box ${status}`;
        if (statusElement) statusElement.textContent = statusText;
        if (descriptionElement) descriptionElement.textContent = adviceText;

        console.log('[PoseNet] Updated feedback panel');
    } else {
        // Postura dai sensori → aggiorna indicatore centrale
        const indicator = document.querySelector('#posture-status .indicator');
        const panel = document.getElementById('posture-status');

        if (indicator) {
            indicator.classList.remove('good', 'poor', 'leaning_forward', 'not_sitting');
            indicator.classList.add(status);
            indicator.textContent = statusText;
            console.log('[Sensors] Updated main status indicator');
        }
    }
}






