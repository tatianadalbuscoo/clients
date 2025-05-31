// =====================
// PoseNet integration for posture tracking
// =====================

// DOM elements and states
let video;                  // HTML video element for webcam
let poseNet;                // PoseNet model instance
let pose;                   // Current detected pose
let isRunning = false;      // Tracks if camera/pose detection is active
let videoStream = null;     // Stores the webcam stream
let socket;                 // Socket connection to the server

// Posture analysis tracking
let lastPosture = null;             // Last detected posture
let postureChangeTimer = null;     // Timer to stabilize posture changes
let postureChangeTimestamp = Date.now(); // Timestamp of last posture change
const MIN_DURATION = 2500;         // Minimum time (ms) posture must be consistent to count

/**
 * Initializes the PoseNet setup:
 * - Stores the socket connection
 * - Sets up camera toggle button
 */
function initPoseNet(socketConnection) {
    socket = socketConnection;

    const cameraButton = document.getElementById('toggle-camera');
    cameraButton.addEventListener('click', toggleCamera);

    // Optional: Listen to posture updates from server
    /*
    socket.on('postureUpdate', (data) => {
        if (data.hasPoseData && data.postureStatus) {
            updatePostureStatus(data.postureStatus);
        }
    });
    */
}

/**
 * Toggles camera on/off and starts or stops pose detection.
 */
async function toggleCamera() {
    console.log('Toggling camera...');
    const cameraButton = document.getElementById('toggle-camera');

    if (!isRunning) {
        // Start camera and pose detection
        cameraButton.textContent = 'Starting...';
        await setupPoseNet();
        cameraButton.textContent = 'Stop Camera';
        isRunning = true;
    } else {
        // Stop camera and clean up resources
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
 * Sets up webcam, canvas, and PoseNet model for pose detection.
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

        // Hide video visually (used only for input)
        video.style.display = "block";
        video.style.position = "absolute";
        video.style.opacity = "0.01";
        video.style.zIndex = "-1";

        // Request camera stream
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });
        video.srcObject = videoStream;

        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                console.log('Video metadata loaded');
                video.play().then(() => {
                    const ctx = canvas.getContext('2d');

                    // Load PoseNet model
                    loadPoseNetModel().then(net => {
                        poseNet = net;

                        // Begin detection loop after a short delay
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
 * Loads the PoseNet model with specified configuration.
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
 * Main pose detection loop:
 * - Estimates pose from video
 * - Draws pose on canvas
 * - Sends data for posture analysis
 */
async function detectPose(video, canvas, ctx) {
    if (!isRunning || !poseNet) return;

    try {
        const poses = await poseNet.estimateMultiplePoses(video, {
            flipHorizontal: true,
            maxDetections: 1,
            scoreThreshold: 0.4,
            nmsRadius: 20
        });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Mirror and draw video feed
        if (video.readyState >= 2) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();


            if (!poses || poses.length === 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(canvas.width/2 - 140, canvas.height/2 - 15, 280, 30);
                ctx.fillStyle = 'white';
                ctx.fillText('Looking for you... Stand in view of camera', canvas.width/2, canvas.height/2);
            }
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(canvas.width/2 - 100, canvas.height/2 - 15, 200, 30);
            ctx.fillStyle = 'white';
            ctx.fillText('Camera starting...', canvas.width/2, canvas.height/2);
        }

        // If pose found, analyze and draw it
        if (poses.length > 0) {
            pose = poses[0];
            drawPose(pose, ctx);
            sendPosnetDataToServer(pose);
        }



        // Continue loop
        requestAnimationFrame(() => detectPose(video, canvas, ctx));
    } catch (error) {
        console.error('Error detecting pose:', error);
        requestAnimationFrame(() => detectPose(video, canvas, ctx));
    }
}

/**
 * Draws keypoints and skeleton on the canvas for visualization.
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

    // Define and draw skeleton (keypoint connections)
    const skeleton = [
        ['nose', 'leftEye'], ['leftEye', 'leftEar'], ['nose', 'rightEye'],
        ['rightEye', 'rightEar'], ['nose', 'leftShoulder'],
        ['nose', 'rightShoulder'], ['leftShoulder', 'rightShoulder']
    ];

    ctx.strokeStyle = 'aqua';
    ctx.lineWidth = 2;

    skeleton.forEach(pair => {
        const partA = getKeypoint(pose.keypoints, pair[0]);
        const partB = getKeypoint(pose.keypoints, pair[1]);

        if (partA && partB && partA.score > 0.5 && partB.score > 0.5) {
            ctx.beginPath();
            ctx.moveTo(partA.position.x, partA.position.y);
            ctx.lineTo(partB.position.x, partB.position.y);
            ctx.stroke();
        }
    });
}

/**
 * Utility to find a keypoint by name.
 */
function getKeypoint(keypoints, name) {
    return keypoints.find(keypoint => keypoint.part === name);
}

/**
 * Ensures that a posture is held for a minimum time before updating the UI.
 */
function stabilizePosture(newStatus) {
    if (newStatus === lastPosture) {
        if (postureChangeTimer) {
            clearTimeout(postureChangeTimer);
            postureChangeTimer = null;
        }
        updatePostureStatus(newStatus, 'posenet');  // ← AGGIUNTO
    } else {
        if (postureChangeTimer) clearTimeout(postureChangeTimer);

        postureChangeTimer = setTimeout(() => {
            lastPosture = newStatus;
            updatePostureStatus(newStatus, 'posenet');  // ← AGGIUNTO
            postureChangeTimer = null;
        }, MIN_DURATION);
    }
}


/**
 * Analyzes pose keypoints to determine posture quality and sends data to server.
 */
/*function sendPosnetDataToServer(pose) {
    if (!pose) return;

    if (!sendPosnetDataToServer.lastSent || (Date.now() - sendPosnetDataToServer.lastSent) > 3000) {
        sendPosnetDataToServer.lastSent = Date.now();

        const keypoints = pose.keypoints;
        const leftShoulder = keypoints.find(p => p.part === 'leftShoulder');
        const rightShoulder = keypoints.find(p => p.part === 'rightShoulder');
        const nose = keypoints.find(p => p.part === 'nose');

        let postureStatus = 'not_sitting';
        let verticalDist = null;
        let shoulderDifference = null;

        console.log("🧠 Pose detected:");
        console.log(" - Nose:", nose);
        console.log(" - Left shoulder:", leftShoulder);
        console.log(" - Right shoulder:", rightShoulder);
        console.log(" - AAAAAAAAAAAAAAAAAAAAAAA", postureStatus);


        if (leftShoulder && rightShoulder && nose &&
            leftShoulder.score > 0.3 && rightShoulder.score > 0.3 && nose.score > 0.3) {
        //if (nose && nose.score > 0.5) {
            const centerShoulders = {
                x: (leftShoulder.position.x + rightShoulder.position.x) / 2,
                y: (leftShoulder.position.y + rightShoulder.position.y) / 2
            };

            verticalDist = nose.position.y - centerShoulders.y;
            shoulderDifference = Math.abs(leftShoulder.position.y - rightShoulder.position.y);


            if (shoulderDifference > 50) {
                postureStatus = 'poor';
            } else {
                if (verticalDist > 80) {
                    postureStatus = 'leaning_forward';
                } else if (verticalDist < -300) {
                    postureStatus = 'poor';
                } else {
                    postureStatus = 'good';
                }
            }

            stabilizePosture(postureStatus);

            console.log('[DEBUG] shoulderDifference:', shoulderDifference.toFixed(2));
            console.log('[DEBUG] verticalDist:', verticalDist.toFixed(2));
            console.log('[DEBUG] postureStatus selected:', postureStatus);


        }

        // Send posture and pose data to server
        fetch(`${CONFIG.SERVER.URL}/posenet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chairId: selectedChairId || 'CHAIR01',
                source: 'posenet',
                keypoints: pose.keypoints,
                postureAnalysis: {
                    verticalDistance: verticalDist ? verticalDist.toFixed(2) : null,
                    shoulderDifference: shoulderDifference ? shoulderDifference.toFixed(2) : null,
                    postureStatus: postureStatus
                }
            })
        }).then(() => {
            console.log("Pose data sent to server");
        }).catch(error => {
            console.error('Error sending pose data:', error);
        });
    }
}*/

function sendPosnetDataToServer(pose) {
    if (!pose) return;

    if (!sendPosnetDataToServer.lastSent || (Date.now() - sendPosnetDataToServer.lastSent) > 1000) {
        sendPosnetDataToServer.lastSent = Date.now();

        fetch(`${CONFIG.SERVER.URL}/posenet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chairId: selectedChairId || 'CHAIR01',
                source: 'posenet',               // ✅ questo rimane!
                keypoints: pose.keypoints        // ✅ niente calcoli qui
            })
        })
            .then(() => {
                console.log("[CLIENT] Pose data sent to server");
            })
            .catch(error => {
                console.error('[CLIENT] Error sending pose data:', error);
            });
    }
}

