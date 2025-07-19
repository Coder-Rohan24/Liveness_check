import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";

const LivenessCheck = () => {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState("Initializing...");
  const prevNosePosition = useRef(null); // Tracking head movement
  const prevEyeHeight = useRef(null); // Tracking eye height for blink detection
  const prevFaceSize = useRef(null);

  // Load Face API models
  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models"); // Needed for eye and nose tracking
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
      setStatus("Models Loaded. Ready to start.");
    };

    loadModels();
  }, []);

  // Run Liveness Check
  const checkLiveness = async () => {
    const video = webcamRef.current.video;
    if (!video) return;

    setStatus("Detecting face...");
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    if (!detection) {
      setStatus("No face detected ❌");
      return;
    }
    
    // Get landmarks for eyes and nose
    const landmarks = detection.landmarks;
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    if (!nose || !leftEye || !rightEye) {
      setStatus("Error detecting facial features ❌. Please retry.");
      return;
    }

    // Get initial eye height (average of left and right eye)
    const initialEyeHeight = (getEyeHeight(leftEye) + getEyeHeight(rightEye)) / 2;
    prevEyeHeight.current = initialEyeHeight;

    // Get nose position for head tracking
    let nosePosition = { x: nose[0].x, y: nose[0].y };
    prevNosePosition.current = nosePosition;

    console.log("Initial Eye Height:", initialEyeHeight);
    console.log("Initial Nose Position:", nosePosition);
    const detection2 = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options());
    const faceBox = detection2.box;
    prevFaceSize.current = faceBox.width * faceBox.height; // Store initial face size

    console.log("Initial Face Size:", prevFaceSize.current);
    setStatus("Face detected ✅. Blink your eyes...");
    // Wait for user to blink
    setTimeout(() => {
      checkBlink();
    }, 3000);
  };

  // Function to check for blink
  const checkBlink = async () => {
    const video = webcamRef.current.video;
    if (!video) return;

    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    if (!detection) {
      setStatus("No face detected ❌");
      return;
    }

    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    if (!leftEye || !rightEye) {
      setStatus("Error detecting eyes ❌. Please retry.");
      return;
    }

    // Get new eye height after blinking
    const newEyeHeight = (getEyeHeight(leftEye) + getEyeHeight(rightEye)) / 2;
    console.log("New Eye Height:", newEyeHeight);

    // Check if eye height is significantly smaller (eyes closed)
    if (Math.abs(prevEyeHeight.current - newEyeHeight) > 0.5) {
      setStatus("Blink detected ✅. Move your head slightly...");
      setTimeout(() => {
        checkHeadMovement();
      }, 3000);
    } else {
      setStatus("No blink detected ❌. Please retry.");
    }
  };

  // Function to check head movement
  const checkHeadMovement = async () => {
    const video = webcamRef.current.video;
    if (!video) return;

    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    if (!detection) {
      setStatus("No face detected ❌");
      return;
    }

    const nose = detection.landmarks.getNose();
    if (!nose || nose.length < 1) {
      setStatus("Error detecting nose ❌. Please retry.");
      return;
    }

    let newNosePosition = { x: nose[0].x, y: nose[0].y };
    console.log("New Nose Position:", newNosePosition);

    // Check if the user has moved their head
    if (
      Math.abs(prevNosePosition.current.x - newNosePosition.x) > 50 ||
      Math.abs(prevNosePosition.current.y - newNosePosition.y) > 10
    ) {
      setStatus("Head movement detected ✅. Move your face closer or far...");
      // prevNosePosition.current = newNosePosition; // Update reference

      setTimeout(() => {
        checkDepth();
      }, 3000);
    } else {
      setStatus("No head movement detected ❌. Please retry.");
    }
  };

  // Function to check depth (face moving closer/farther)
   const checkDepth = async () => {
    const video = webcamRef.current.video;
    if (!video) return;

    const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options());
    if (!detection) {
      setStatus("No face detected ❌. Please retry.");
      return;
    }
    const faceBox = detection.box;
    const newFaceSize = faceBox.width * faceBox.height;
    console.log("New Face Size:", newFaceSize);
    console.log("Previous Face Size:", prevFaceSize.current);
    if (Math.abs(prevFaceSize.current - newFaceSize) > prevFaceSize.current * 0.2) {
      setStatus("Depth confirmed ✅. Liveness successful!");
    } else {
      setStatus("Depth check failed ❌. Please retry.");
    }
  };

  // Helper function to calculate eye height
  const getEyeHeight = (eye) => {
    if (!eye || eye.length < 6) return 0;
    return Math.abs(eye[1].y - eye[5].y); // Distance between top and bottom eyelid
  };

  return (
    <div>
      <h2>Liveness Check</h2>
      <Webcam ref={webcamRef} />
      <button onClick={checkLiveness}>Start Liveness Check</button>
      <p>{status}</p>
    </div>
  );
};

export default LivenessCheck;
