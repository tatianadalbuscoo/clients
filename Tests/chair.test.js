/**
 * @jest-environment jsdom
 *
 */


// Import the relevant functions
const { updateChairVisualization, updatePostureStatus } = require('../chairFrontend/js/chair.js');


// ------------------------------- Test suite for updateChairVisualization


describe('updateChairVisualization', () => {

    // Set up a mock DOM with 3 sensor divs
    beforeEach(() => {
        // Set up fake DOM elements for sensors
        document.body.innerHTML = `
      <div id="sensor1"></div>
      <div id="sensor2"></div>
      <div id="sensor3"></div>
    `;
    });

    // Test: Applies text content, scale, and color styling based on sensor values
    test('applies color and scale based on sensor values', () => {

        // Simulated sensor input data
        const sensors = [
            { value: 10 },
            { value: 20 },
            { value: 30 }
        ];

        updateChairVisualization(sensors);

        const sensor3 = document.getElementById('sensor3');

        // Check that text content shows correct sensor value
        expect(sensor3.textContent).toContain('S3: 30');

        // Check that the scale style is applied
        expect(sensor3.style.transform).toMatch(/scale\([0-9.]+\)/);

        // Check that a background color was set
        expect(sensor3.style.backgroundColor).not.toBe('');
    });

    // Test: Should exit early and not throw errors if input is null or not an array
    test('returns early if sensors is not an array', () => {

        // Should not throw
        expect(() => updateChairVisualization(null)).not.toThrow();
        expect(() => updateChairVisualization({})).not.toThrow();
    });
});


// ------------------------------- Test suite for updatePostureStatus


describe('updatePostureStatus', () => {
    beforeEach(() => {

        // Prepare a fake DOM for the posture indicator
        document.body.innerHTML = `
      <div id="posture-status"><div class="indicator"></div></div>
    `;
        global.updatePostureClass = jest.fn(); // Mock the style update function
    });


    // Test: Does nothing and throws no errors if the .indicator element is missing
    test('does nothing if .indicator element is missing', () => {

        // Remove the indicator element
        document.body.innerHTML = `<div id="posture-status"></div>`;

        // Should not throw any error even if the element is missing
        expect(() => updatePostureStatus('poor')).not.toThrow();
    });
});

