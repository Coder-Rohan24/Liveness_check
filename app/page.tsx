"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";

const LivenessCheck = () => {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState("Initializing...");
  const [webcamActive, setWebcamActive] = useState(true);
  const prevNosePosition = useRef<{ x: number; y: number } | null>(null);
  const prevEyeHeight = useRef<number | null>(null);
  const prevFaceSize = useRef<number | null>(null);

  // Load Face API models
  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
      setStatus("Models Loaded. Ready to start.");
    };

    loadModels();
  }, []);

  // Function to stop webcam
  const stopWebcam = () => {
    if (webcamRef.current && webcamRef.current.video) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop()); // Stop all video tracks
      setWebcamActive(false);
    }
  };

  // Run Liveness Check
  const checkLiveness = async () => {
    if (!webcamRef.current?.video) return;

    setStatus("Detecting face...");
    const detection = await faceapi.detectSingleFace(webcamRef.current.video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    if (!detection) {
      setStatus("No face detected ❌");
      return;
    }

    const landmarks = detection.landmarks;
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    if (!nose || !leftEye || !rightEye) {
      setStatus("Error detecting facial features ❌. Please retry.");
      return;
    }

    prevEyeHeight.current = (getEyeHeight(leftEye) + getEyeHeight(rightEye)) / 2;
    prevNosePosition.current = { x: nose[0].x, y: nose[0].y };

    const detection2 = await faceapi.detectSingleFace(webcamRef.current.video, new faceapi.SsdMobilenetv1Options());
    if (!detection2) {
      setStatus("No face detected ❌");
      return;
    }

    prevFaceSize.current = detection2.box.width * detection2.box.height;
    setStatus("Face detected ✅. Blink your eyes...");

    setTimeout(() => {
      checkBlink();
    }, 3000);
  };

  // Function to check for blink
  const checkBlink = async () => {
    if (!webcamRef.current?.video) return;

    const detection = await faceapi.detectSingleFace(webcamRef.current.video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
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

    const newEyeHeight = (getEyeHeight(leftEye) + getEyeHeight(rightEye)) / 2;

    if (prevEyeHeight.current !== null && Math.abs(prevEyeHeight.current - newEyeHeight) > 0.5) {
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
    if (!webcamRef.current?.video) return;

    const detection = await faceapi.detectSingleFace(webcamRef.current.video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    if (!detection) {
      setStatus("No face detected ❌");
      return;
    }

    const nose = detection.landmarks.getNose();
    if (!nose || nose.length < 1) {
      setStatus("Error detecting nose ❌. Please retry.");
      return;
    }

    const newNosePosition = { x: nose[0].x, y: nose[0].y };

    if (
      prevNosePosition.current &&
      (Math.abs(prevNosePosition.current.x - newNosePosition.x) > 50 ||
        Math.abs(prevNosePosition.current.y - newNosePosition.y) > 10)
    ) {
      setStatus("Head movement detected ✅. Move your face closer or farther...");
      setTimeout(() => {
        checkDepth();
      }, 3000);
    } else {
      setStatus("No head movement detected ❌. Please retry.");
    }
  };

  // Function to check depth (face moving closer/farther)
  const checkDepth = async () => {
    if (!webcamRef.current?.video) return;

    const detection = await faceapi.detectSingleFace(webcamRef.current.video, new faceapi.SsdMobilenetv1Options());
    if (!detection) {
      setStatus("No face detected ❌. Please retry.");
      return;
    }

    const faceBox = detection.box;
    const newFaceSize = faceBox.width * faceBox.height;

    if (prevFaceSize.current !== null && Math.abs(prevFaceSize.current - newFaceSize) > prevFaceSize.current * 0.2) {
      setStatus("Depth confirmed ✅. Liveness successful!");
      stopWebcam(); // Stop webcam after success
    } else {
      setStatus("Depth check failed ❌. Please retry.");
    }
  };

  // Helper function to calculate eye height
  const getEyeHeight = (eye: { x: number; y: number }[]) => {
    if (!eye || eye.length < 6) return 0;
    return Math.abs(eye[1].y - eye[5].y);
  };

  return (
    <div>
      <h2>Liveness Check</h2>
      {webcamActive && <Webcam ref={webcamRef} />}
      <button onClick={checkLiveness} disabled={!webcamActive}>
        Start Liveness Check
      </button>
      <p>{status}</p>
    </div>
  );
};

export default LivenessCheck;
