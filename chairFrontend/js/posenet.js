// =====================
// PoseNet integration for posture tracking
// =====================

let video;                          // HTML video element for webcam
let poseNet;                        // PoseNet model instance
let pose;                           // Current detected pose
let isRunning = false;     // Indicates if the camera is currently active
let videoStream = null;        // Webcam media stream

// Posture analysis tracking
let lastPosture = null;             // Last posture that was detected and shown
let postureChangeTimer = null;      // Timer used to confirm consistent posture
const MIN_DURATION = 2500;       // Time (ms) a posture must persist before accepting it


/**
 * Initializes PoseNet setup:
 * - Attaches event listener to the toggle camera button
 *
 * parameters: none
 * return: void
 */
function initPoseNet() {

    const cameraButton = document.getElementById('toggle-camera');
    cameraButton.addEventListener('click', toggleCamera);
}


/**
 * Toggles the webcam and PoseNet detection on/off.
 *
 * parameters: none
 * return: void
 */
async function toggleCamera() {
    const cameraButton = document.getElementById('toggle-camera');

    if (!isRunning) {

        // Start camera and pose detection
        cameraButton.textContent = 'Starting...';
        await setupPoseNet();
        cameraButton.textContent = 'Stop Camera';
        isRunning = true;
    } else {

        // Stop camera and release resources
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
            video.srcObject = null;
        }

        cameraButton.textContent = 'Start Camera';
        isRunning = false;
    }
}


/**
 * Sets up the webcam, canvas, and loads the PoseNet model.
 *
 * parameters: none
 * return: Promise<void>
 */
async function setupPoseNet() {
    try {
        video = document.getElementById('video');
        const canvas = document.getElementById('output');

        // Set video and canvas size
        video.width = 640;
        video.height = 480;
        canvas.width = 640;
        canvas.height = 480;

        // Hide video from UI (used only as input to PoseNet)
        video.style.display = "block";
        video.style.position = "absolute";
        video.style.opacity = "0.01";
        video.style.zIndex = "-1";

        // Request access to the camera
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });
        video.srcObject = videoStream;

        // Start processing once video is ready
        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                console.log('Video metadata loaded');
                video.play().then(() => {
                    const ctx = canvas.getContext('2d');

                    // Load PoseNet model
                    loadPoseNetModel().then(net => {
                        poseNet = net;

                        // Begin pose detection loop
                        setTimeout(() => {
                            detectPose(video, canvas, ctx);
                        }, 1000);
                        resolve();
                    }).catch(error => reject(error));
                }).catch(error => reject(error));
            };

            video.onerror = (error) => reject(error);
        });
    } catch (error) {
        console.error('Error setting up PoseNet:', error);
        alert('Could not access camera. Please check permissions and try again.');
        throw error;
    }
}


/**
 * Loads the PoseNet model with configuration.
 *
 * parameters: none
 * return: PoseNet model instance
 */
async function loadPoseNetModel() {
    return await posenet.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        inputResolution: { width: 640, height: 480 },
        multiplier: 0.75
    });
}


/**
 * Main loop for detecting pose from webcam video.
 * - Draws video and detected pose on canvas
 * - Sends pose to server for analysis
 *
 * parameters: video (HTMLVideoElement), canvas (HTMLCanvasElement), ctx (CanvasRenderingContext2D)
 * return: void
 */
async function detectPose(video, canvas, ctx) {

    // Exit early if the camera is not running or PoseNet is not loaded
    if (!isRunning || !poseNet) return;

    try {

        // Estimate one or more poses from the video input using PoseNet
        const poses = await poseNet.estimateMultiplePoses(video, {
            flipHorizontal: true,
            maxDetections: 1,
            scoreThreshold: 0.6,
            nmsRadius: 20
        });

        // Clear canvas and draw background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Mirror video on canvas
        if (video.readyState >= 2) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();

            // Show a hint if no pose is found
            if (!poses || poses.length === 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(canvas.width/2 - 140, canvas.height/2 - 15, 280, 30);
                ctx.fillStyle = 'white';
                ctx.fillText('Looking for you... Stand in view of camera', canvas.width/2, canvas.height/2);
            }
        } else {

            // Show loading message while camera is initializing
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(canvas.width/2 - 100, canvas.height/2 - 15, 200, 30);
            ctx.fillStyle = 'white';
            ctx.fillText('Camera starting...', canvas.width/2, canvas.height/2);
        }

        // If a pose is found, draw and send it
        if (poses.length > 0) {
            pose = poses[0];
            drawPose(pose, ctx);
            sendPosnetDataToServer(pose);
        }

        // Continue the detection loop
        requestAnimationFrame(() => detectPose(video, canvas, ctx));
    } catch (error) {
        console.error('Error detecting pose:', error);
        requestAnimationFrame(() => detectPose(video, canvas, ctx));
    }
}


/**
 * Draws keypoints and skeleton on canvas.
 *
 * parameters: pose (Pose), ctx (CanvasRenderingContext2D)
 * return: void
 */
function drawPose(pose, ctx) {
    if (!pose) return;

    // Draw keypoints
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score > 0.5) {
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'aqua';
            ctx.fill();
        }
    });

    // Draw skeleton lines between keypoints
    const skeleton = [
        ['nose', 'leftEye'], ['leftEye', 'leftEar'], ['nose', 'rightEye'],
        ['rightEye', 'rightEar'], ['nose', 'leftShoulder'],
        ['nose', 'rightShoulder'], ['leftShoulder', 'rightShoulder']
    ];

    ctx.strokeStyle = 'aqua';
    ctx.lineWidth = 2;

    // Loop through each pair of connected body parts defined in "skeleton"
    skeleton.forEach(pair => {

        // Get the first and second keypoint in the pair (e.g., 'nose' and 'leftEye')
        const partA = getKeypoint(pose.keypoints, pair[0]);
        const partB = getKeypoint(pose.keypoints, pair[1]);

        // Only draw the line if both keypoints exist and have a high enough confidence score
        if (partA && partB && partA.score > 0.5 && partB.score > 0.5) {
            ctx.beginPath();                                     // Start a new path
            ctx.moveTo(partA.position.x, partA.position.y);      // Move to the first keypoint
            ctx.lineTo(partB.position.x, partB.position.y);      // Draw a line to the second keypoint
            ctx.stroke();                                        // Actually draw the line on the canvas
        }
    });
}


/**
 * Finds a keypoint by name.
 *
 * parameters: keypoints (array), name (string)
 * return: object | undefined
 */
function getKeypoint(keypoints, name) {
    return keypoints.find(keypoint => keypoint.part === name);
}


/**
 * Ensures that a posture is consistent for a minimum duration before applying it.
 *
 * parameters: newStatus (string)
 * return: void
 */
function stabilizePosture(newStatus) {

    // If the new posture is the same as the last confirmed one
    if (newStatus === lastPosture) {

        // Cancel any ongoing timer (no need to wait anymore)
        if (postureChangeTimer) {
            clearTimeout(postureChangeTimer);
            postureChangeTimer = null;
        }

        // Immediately update the UI with the same posture again (in case of refresh)
        updatePostureStatus(newStatus, 'posenet');
    } else {
        // If posture has changed, wait MIN_DURATION ms before applying it

        // Clear any previously running timer
        if (postureChangeTimer) clearTimeout(postureChangeTimer);

        // Start a new timer: if posture stays the same for MIN_DURATION, apply it
        postureChangeTimer = setTimeout(() => {

            // Save new posture as confirmed
            lastPosture = newStatus;
            updatePostureStatus(newStatus, 'posenet'); // Update UI

            // Clear the timer reference
            postureChangeTimer = null;
        }, MIN_DURATION);
    }
}


/**
 * Sends the current PoseNet keypoints to the server via HTTP POST.
 * Limits sending to once per second to avoid flooding the server.
 *
 * parameters: pose (object containing keypoints)
 * return: void
 */
function sendPosnetDataToServer(pose) {

    // Exit if no pose is provided
    if (!pose) return;

    // Allow sending only once every 1000 ms (1 second)
    if (!sendPosnetDataToServer.lastSent || (Date.now() - sendPosnetDataToServer.lastSent) > 1000) {

        // Update timestamp of last sent pose
        sendPosnetDataToServer.lastSent = Date.now();

        // Send POST request to the server with pose keypoints
        fetch(`${CONFIG.SERVER.URL}/posenet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chairId: selectedChairId || 'CHAIR01',
                source: 'posenet', // identify data source
                keypoints: pose.keypoints
            })
        })
            .then(() => {
                console.log("[CLIENT] Pose data sent to server"); // Debug
            })
            .catch(error => {
                console.error('[CLIENT] Error sending pose data:', error);
            });
    }
}


// Export functions for Jest
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        stabilizePosture,
        sendPosnetDataToServer
    };
}

// Attach functions to the window object for browser usage
if (typeof window !== 'undefined') {
    window.stabilizePosture = stabilizePosture;
    window.sendPosnetDataToServer = sendPosnetDataToServer;
}

