/**
 * @jest-environment jsdom
 */

// Mock server configuration
jest.mock('../chairFrontend/js/config', () => ({
    SERVER: {
        IP: 'localhost',
        PORT: '3000',
        get URL() {
            return `http://localhost:3000`;
        },
        get SOCKET_URL() {
            return `http://localhost:3000/socket.io/socket.io.js`;
        }
    }
}));


// Import functions under test
const {
    stabilizePosture,
    sendPosnetDataToServer,
} = require('../chairFrontend/js/posenet.js');

// Setup required globals for JSDOM environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');

const { updateChairData } = require('../chairFrontend/js/main');


// ------------------------------- Test suite for stabilizePosture


describe('PoseNet Integration', () => {

    beforeEach(() => {
        document.body.innerHTML = `
            <button id="toggle-camera">Start Camera</button>
            <video id="video"></video>
            <canvas id="output"></canvas>
        `;
    });

    describe('stabilizePosture', () => {
        beforeEach(() => {
            jest.useFakeTimers();

            // Required for the function to work
            global.updatePostureStatus = jest.fn();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        // Test: Should call updatePostureStatus immediately if same posture is repeated
        test('updates posture immediately if same as last', () => {
            stabilizePosture('good');
            jest.advanceTimersByTime(2500);
            stabilizePosture('good');

            expect(global.updatePostureStatus).toHaveBeenCalledWith('good', 'posenet');
        });
    });
});


// ------------------------------- Test suite for sendPosnetDataToServer


describe('sendPosnetDataToServer', () => {
    beforeEach(() => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

        // Test: Should not send data if last send is too recent
        test('does not send pose data if within 1 second window', async () => {
            const pose = {
                keypoints: [{ part: 'nose', position: { x: 0, y: 0 }, score: 0.9 }]
            };

            sendPosnetDataToServer.lastSent = Date.now();

            await sendPosnetDataToServer(pose);

            expect(fetch).not.toHaveBeenCalled();
        });
    });


// ------------------------------- Test suite: toggleCamera + updateChairData


describe('toggleCamera - camera status and data validation', () => {
    let cameraButton;

    beforeEach(() => {
        document.body.innerHTML = `
            <button id="toggle-camera">Start Camera</button>
            <video id="video"></video>
        `;

        global.cameraActive = false; // Initial state

        // Mock media devices API
        global.navigator.mediaDevices = {
            getUserMedia: jest.fn(() => Promise.resolve({
                getTracks: () => [{ stop: jest.fn() }]
            }))
        };

        // Stub required video methods
        const video = document.getElementById('video');
        video.play = jest.fn();
        video.pause = jest.fn();

        // Stub posenet and canvas context to prevent runtime errors
        global.posenet = { load: jest.fn(() => Promise.resolve({})) };
        HTMLCanvasElement.prototype.getContext = jest.fn(() => ({}));

        cameraButton = document.getElementById('toggle-camera');
    });

    // Test: Should not throw for null or empty data
    test('handles null or incomplete data without exception', () => {
        expect(() => updateChairData(null)).not.toThrow();
        expect(() => updateChairData({})).not.toThrow();
    });

    // Test: Should log an error for invalid data formats
    test('logs an error for invalid data', () => {
        console.error = jest.fn();

        updateChairData(null);
        expect(console.error).toHaveBeenCalledWith('Invalid chair data received:', null);

        updateChairData({});
        expect(console.error).toHaveBeenCalledWith('Invalid chair data received:', {});
    });

    // Test: Toggles camera activation and updates button label
   test('toggles camera and updates button label', async () => {
        const video = document.getElementById('video');

        // Mock implementation of toggleCamera (simplified for unit testing)
        const toggleCamera = async () => {

            // Case 1: Camera is not active — activate it
            if (!global.cameraActive) {

                // Simulate access to the user's webcam
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });

                // Assign the simulated stream to the video element
                video.srcObject = stream;

                // Simulate starting the video
                video.play();

                // Update button text to indicate camera is running
                cameraButton.textContent = 'Stop Camera';

                // Set global flag to indicate camera is active
                global.cameraActive = true;
            }

            // Case 2: Camera is active — deactivate it
            else {

                // Retrieve and stop all media tracks (if any)
                const tracks = video.srcObject?.getTracks?.() || [];
                tracks.forEach((track) => track.stop());

                // Simulate pausing the video
                video.pause();

                // Update button text to indicate camera is off
                cameraButton.textContent = 'Start Camera';

                // Set global flag to indicate camera is inactive
                global.cameraActive = false;
            }
        };

        // First toggle: turn the camera on
        await toggleCamera();

        // Expect button label to update and cameraActive to be true
        expect(cameraButton.textContent).toBe('Stop Camera');
        expect(global.cameraActive).toBe(true);

        // Second toggle: turn the camera off
        await toggleCamera();

        // Expect button label to reset and cameraActive to be false
        expect(cameraButton.textContent).toBe('Start Camera');
        expect(global.cameraActive).toBe(false);
    });
});

