/**
 * @jest-environment jsdom
 */

// Mock dependencies from the 'chair' module
jest.mock('../chairFrontend/js/chair', () => ({
    updateChairVisualization: jest.fn(),
    updatePostureStatus: jest.fn()
}));


// ------------------------------- Test suite for updateChairData


describe('updateChairData', () => {
    let main;
    let updateChairData;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = '<div id="connection-status"></div>';

        // Override main.js temporarily to mock updatePostureFeedback
        jest.doMock('../chairFrontend/js/main.js', () => {
            const original = jest.requireActual('../chairFrontend/js/main.js');
            return {
                ...original,
                updatePostureFeedback: jest.fn()
            };
        });

        main = require('../chairFrontend/js/main.js');
        updateChairData = main.updateChairData;
    });

    afterEach(() => {
        jest.dontMock('../chairFrontend/js/main.js'); // Remove the mock
    });

    // Test: Should not throw when data is null or missing sensors
    test('returns early if data or sensors are missing', () => {
        expect(() => updateChairData(null)).not.toThrow();
        expect(() => updateChairData({})).not.toThrow();
    });

    // Test: Should update visualization and posture status for valid data (non-posenet)
    test('updates visualization and posture when data is valid and source is not posenet', () => {
        const data = {
            sensors: [{ value: 1 }],
            postureStatus: 'good',
            source: 'sensors'
        };

        updateChairData(data);
        const text = document.getElementById('connection-status').textContent;

        expect(require('../chairFrontend/js/chair').updateChairVisualization).toHaveBeenCalled();
        expect(text).toMatch(/Last update:/);
    });

    // Test: Should not call updatePostureFeedback if source is posenet
    test('does not update posture if source is posenet', () => {
        const data = {
            sensors: [{ value: 1 }],
            postureStatus: 'good',
            source: 'posenet'
        };

        updateChairData(data);

        expect(require('../chairFrontend/js/chair').updateChairVisualization).toHaveBeenCalled();
        expect(main.updatePostureFeedback).not.toHaveBeenCalled();
    });
});

// ------------------------------- updatePostureFeedback

describe('updatePostureFeedback', () => {
    const { updatePostureFeedback } = require('../chairFrontend/js/main.js');

    // Test: Should update PoseNet feedback panel with correct text and class
    test('updates PoseNet feedback panel for good posture', () => {
        document.body.innerHTML = `
            <div id="feedback-status"></div>
            <div id="feedback-description"></div>
            <div id="posture-feedback" class=""></div>
        `;

        updatePostureFeedback('good', 'posenet');

        expect(document.getElementById('feedback-status').textContent).toBe('Good Posture');
        expect(document.getElementById('feedback-description').textContent).toMatch(/Great job/i);
        expect(document.getElementById('posture-feedback').className).toBe('posture-box good');
    });

    // Test: Should update sensor panel for poor posture
    test('updates posture indicator from sensors', () => {
        document.body.innerHTML = `
            <div id="posture-status">
                <div class="indicator"></div>
            </div>
        `;

        updatePostureFeedback('poor', 'sensors');

        const indicator = document.querySelector('#posture-status .indicator');
        expect(indicator.classList.contains('poor')).toBe(true);
        expect(indicator.textContent).toBe('Poor Posture');
    });

    // Test: Should default to unknown posture for unrecognized input
    test('handles unknown posture status gracefully', () => {
        document.body.innerHTML = `
            <div id="posture-status">
                <div class="indicator"></div>
            </div>
        `;

        updatePostureFeedback('slouched', 'sensors');

        const indicator = document.querySelector('#posture-status .indicator');
        expect(indicator.textContent).toBe('Unknown');
    });

    // Test: Should not throw if indicator element is missing from DOM
    test('does nothing if indicator element is missing', () => {
        document.body.innerHTML = `<div id="posture-status"></div>`;

        expect(() => updatePostureFeedback('good', 'sensors')).not.toThrow();
    });

    // Test: Should not throw if posenet elements are missing
    test('does nothing if posenet elements are missing', () => {
        document.body.innerHTML = ``;

        expect(() => updatePostureFeedback('good', 'posenet')).not.toThrow();
    });
});

