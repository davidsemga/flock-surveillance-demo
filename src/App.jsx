import { useEffect, useRef, useState } from "react";
import {
  FaceDetector,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const animationRef = useRef(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);
  const [error, setError] = useState("");
  const [time, setTime] = useState("");
  const [faceCount, setFaceCount] = useState(0);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();

    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load face detector
  useEffect(() => {
    const loadDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const detector = await FaceDetector.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
              delegate: "GPU",
            },

            runningMode: "VIDEO",
            minDetectionConfidence: 0.5,
          }
        );

        detectorRef.current = detector;
        setDetectorReady(true);
      } catch (err) {
        console.error("Face detector failed:", err);
      }
    };

    loadDetector();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraStarted(true);
      setError("");
    } catch (err) {
      console.error(err);
      setError(
        "Camera access was denied or unavailable."
      );
    }
  };

  // Start tracking once camera + detector are ready
  useEffect(() => {
    if (!cameraStarted || !detectorReady) return;

    const video = videoRef.current;

    const handleLoadedData = () => {
      detectFaces();
    };

    video.addEventListener(
      "loadeddata",
      handleLoadedData
    );

    if (video.readyState >= 2) {
      detectFaces();
    }

    return () => {
      video.removeEventListener(
        "loadeddata",
        handleLoadedData
      );
    };
  }, [cameraStarted, detectorReady]);

  const detectFaces = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;

    if (!video || !canvas || !detector) return;

    const ctx = canvas.getContext("2d");

    const runDetection = () => {
      if (
        video.readyState < 2 ||
        video.videoWidth === 0
      ) {
        animationRef.current =
          requestAnimationFrame(runDetection);

        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const results = detector.detectForVideo(
        video,
        performance.now()
      );

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const detections = results.detections || [];

      setFaceCount(detections.length);

      detections.forEach((detection, index) => {
        const box = detection.boundingBox;

        if (!box) return;

        const x = box.originX;
        const y = box.originY;
        const width = box.width;
        const height = box.height;

        drawTrackingBox(
          ctx,
          x,
          y,
          width,
          height,
          index
        );
      });

      animationRef.current =
        requestAnimationFrame(runDetection);
    };

    runDetection();
  };

  const drawTrackingBox = (
    ctx,
    x,
    y,
    width,
    height,
    index
  ) => {
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 3;

    const cornerLength = Math.min(
      width,
      height
    ) * 0.18;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLength);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLength, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(
      x + width - cornerLength,
      y
    );
    ctx.lineTo(x + width, y);
    ctx.lineTo(
      x + width,
      y + cornerLength
    );
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(
      x,
      y + height - cornerLength
    );
    ctx.lineTo(x, y + height);
    ctx.lineTo(
      x + cornerLength,
      y + height
    );
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(
      x + width - cornerLength,
      y + height
    );
    ctx.lineTo(
      x + width,
      y + height
    );
    ctx.lineTo(
      x + width,
      y + height - cornerLength
    );
    ctx.stroke();

    // Fake subject label
    ctx.font = "18px Courier New";

    const label =
      `SUBJECT_${String(index + 1).padStart(2, "0")} ` +
      `TRACKING`;

    const labelWidth =
      ctx.measureText(label).width;

    ctx.fillStyle =
      "rgba(0, 0, 0, 0.75)";

    ctx.fillRect(
      x,
      Math.max(y - 32, 0),
      labelWidth + 18,
      30
    );

    ctx.fillStyle = "#ffffff";

    ctx.fillText(
      label,
      x + 9,
      Math.max(y - 11, 21)
    );

    // Crosshair
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.beginPath();

    ctx.moveTo(centerX - 12, centerY);
    ctx.lineTo(centerX + 12, centerY);

    ctx.moveTo(centerX, centerY - 12);
    ctx.lineTo(centerX, centerY + 12);

    ctx.stroke();
  };

  return (
    <main className="page">

      <div className="camera-wrapper">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={
            cameraStarted
              ? "camera"
              : "camera hidden"
          }
        />

        {cameraStarted && (
          <canvas
            ref={canvasRef}
            className="tracking-canvas"
          />
        )}

      </div>

      {!cameraStarted && (
        <section className="intro">

          <div className="intro-content">

            <p className="eyebrow">
              AI ETHICS & SOCIETY
            </p>

            <h1 className="title">
              <span>Are you being</span>
              <span>watched?</span>
            </h1>

            <p className="subtitle">
              Continue to begin the presentation.
            </p>

            <button
              onClick={startCamera}
              className="cta"
            >
              Continue
            </button>

            {error && (
              <p className="error">
                {error}
              </p>
            )}

          </div>

        </section>
      )}

      {cameraStarted && (
        <>
          <div className="dark-overlay" />
          <div className="scanlines" />
          <div className="grid-overlay" />

          {/* scanning beam */}
          <div className="scan-beam" />

          <div className="surveillance-ui">

            <div className="top-bar">

              <div className="live-pill">
                <span className="live-dot" />
                LIVE
              </div>

              <div className="system-title">
                AUTOMATED SURVEILLANCE SYSTEM
              </div>

              <div className="timestamp">
                {time}
              </div>

            </div>

            <div className="left-panel panel">

              <p>
                SYSTEM STATUS:
                <span className="status">
                  {" "}ACTIVE
                </span>
              </p>

              <p>
                SUBJECTS DETECTED:{" "}
                {String(faceCount).padStart(
                  2,
                  "0"
                )}
              </p>

              <p>
                CLASSIFICATION: PERSON
              </p>

              <p>
                OBJECT TRACKING: ACTIVE
              </p>

              <p>
                MOVEMENT ANALYSIS: ACTIVE
              </p>

            </div>

            <div className="right-panel panel">

              <p>CAMERA ID: HX-204</p>

              <p>
                ZONE: PRESENTATION ROOM
              </p>

              <p>
                DATA COLLECTION: ACTIVE
              </p>

              <p>
                RETENTION: ENABLED
              </p>

              <p>
                SEARCHABLE: YES
              </p>

            </div>

            <div className="bottom-banner">

              <p>
                YOU ARE BEING WATCHED
              </p>

              <span>
                Movement detected. Subject
                tracking active.
              </span>

            </div>

          </div>
        </>
      )}

    </main>
  );
}

export default App;
