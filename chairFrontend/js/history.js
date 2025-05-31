// =====================
// History data handling and visualization
// =====================
/*

// Chart
let historyChart;


/**
 * Initializes the posture history module.
 * Sets up the chart and attaches event listeners for filtering.
 *
 * parameters: none
 * return: void

function initHistory() {

    // Set up chart for history visualization
    setupHistoryChart();

    // Set up event listeners for history filtering (When the "Filter" button is pressed)
    document.getElementById('filter-btn').addEventListener('click', () => {
        loadHistoryData();
    });
}


/**
 * Creates and configures the Chart.js line chart for posture history.
 *
 * parameters: none
 * return: void

function setupHistoryChart() {

    const ctx = document.getElementById('history-chart').getContext('2d');

    // Create a new Chart instance
    historyChart = new Chart(ctx, {
        type: 'line', // Use a line chart to visualize posture over time
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Posture Quality (0-100)',
                    data: [],
                    backgroundColor: 'rgba(193, 122, 112, 0.2)',
                    borderColor: 'rgba(193, 122, 112, 1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true  // Fill area under the line
                }
            ]
        },
        options: {
            responsive: true,   // Chart adjusts to container size
            maintainAspectRatio: false, // Allows flexible height
            plugins: {
                legend: {
                    labels: {
                        font: {
                            family: "'EB Garamond', serif"
                        }
                    }
                },
                tooltip: {
                    callbacks: {

                        // Customize tooltip to include posture status label
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;

                                // Add posture status description in tooltip
                                const status = context.dataset.postureStatus?.[context.dataIndex];
                                if (status) {
                                    label += ` (${formatPostureStatus(status)})`;
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Posture Quality',
                        font: {
                            family: "'EB Garamond', serif",
                            size: 14
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time',
                        font: {
                            family: "'EB Garamond', serif",
                            size: 14
                        }
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}


/**
 * Updates the HTML table showing historical posture data.
 *
 * parameters: historyData (array of posture records)
 * return: void

function updateHistoryChart(historyData) {
    if (!historyChart || !historyData || !Array.isArray(historyData)) return;

    const labels = [];
    const values = [];
    const statuses = [];

    // Raggruppa i record per ORA (es: "2025-05-30 14")
    const groupedByHour = {};

    historyData.forEach(record => {
        const date = new Date(record.timestamp);
        const dateKey = date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0') + ' ' +
            String(date.getHours()).padStart(2, '0') + ':00';

        if (!groupedByHour[dateKey]) {
            groupedByHour[dateKey] = [];
        }

        groupedByHour[dateKey].push(record.postureStatus);
    });

    // Per ogni ora, calcola la media della postura
    for (const [hour, statusList] of Object.entries(groupedByHour)) {
        let sum = 0;
        let count = 0;

        statusList.forEach(status => {
            switch (status) {
                case 'good': sum += 90; break;
                case 'poor': sum += 30; break;
                case 'not_sitting': sum += 10; break;
                default: sum += 0;
            }
            count++;
        });

        labels.push(hour);  // esempio: "2025-05-30 14:00"
        values.push(Math.round(sum / count));
        statuses.push('avg');
    }

    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = values;
    historyChart.data.datasets[0].postureStatus = statuses;

    historyChart.update();
}


// Updates the posture history table with sorted data,
// formatting each row with timestamp, posture status, and sensor values
function updateHistoryTable(historyData) {
    if (!historyData || !Array.isArray(historyData)) return;

    const tableBody = document.getElementById('history-data');
    if (!tableBody) return;

    // Clear existing rows
    tableBody.innerHTML = '';

    // Sort data by timestamp (newest first for the table)
    const sortedData = [...historyData].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Add data rows
    sortedData.forEach(record => {
        const row = document.createElement('tr');

        // Date/Time cell
        const timeCell = document.createElement('td');
        timeCell.textContent = formatDate(record.timestamp);
        row.appendChild(timeCell);

        // Posture Status cell
        const statusCell = document.createElement('td');

        // Create a status indicator span
        const statusIndicator = document.createElement('span');
        statusIndicator.textContent = formatPostureStatus(record.postureStatus);
        statusIndicator.classList.add('indicator');
        updatePostureClass(statusIndicator, record.postureStatus);
        statusCell.appendChild(statusIndicator);
        row.appendChild(statusCell);

        // Sensor Data cell
        const sensorCell = document.createElement('td');
        if (record.sensors && Array.isArray(record.sensors)) {
            const sensorValues = record.sensors.map((s, i) => `S${i+1}: ${s.value}`).join(', ');
            sensorCell.textContent = sensorValues;
        } else {
            sensorCell.textContent = 'N/A';
        }
        row.appendChild(sensorCell);

        tableBody.appendChild(row);
    });

    // Show message if no data
    if (sortedData.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 3;
        emptyCell.textContent = 'No posture data available for the selected period.';
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '2rem 0';
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
    }
}

/**
 * Converts posture status strings into friendly labels for display.
 *
 * parameters: status (string code like 'good', 'poor', etc.)
 * return: string (formatted label)

function formatPostureStatus(status) {
    switch (status) {
        case 'good':
            return 'Good Posture';
        case 'poor':
            return 'Poor Posture';
        case 'not_sitting':
            return 'Not Sitting';
        default:
            return 'Unknown';
    }
}
/**
 * Applies a CSS class to the status element based on posture.
 *
 * parameters: element (HTML element), postureStatus (string)
 * return: void

function updatePostureClass(element, postureStatus) {
    if (!element) return;

    // Rimuove classi precedenti
    element.classList.remove('good', 'poor', 'leaning_forward', 'not_sitting');

    // Aggiunge la nuova classe in base allo stato
    element.classList.add(postureStatus);
}
*/
