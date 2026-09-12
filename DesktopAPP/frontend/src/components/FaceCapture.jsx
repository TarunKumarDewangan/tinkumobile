import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

let modelsLoadedPromise = null;
function loadModels() {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    ]);
  }
  return modelsLoadedPromise;
}

// Consecutive detected frames required before auto-capturing — just enough
// to avoid snapping a blurry mid-motion frame, without making the user wait.
const STABLE_FRAMES_REQUIRED = 4;

/**
 * Live camera capture — auto-snaps a photo as soon as a face is steadily
 * detected (no blink-wait step; this trades a bit of anti-spoofing rigor for
 * a fast, reliable check-in on lower-end phones where blink detection was
 * too slow/finicky).
 */
export default function FaceCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const stableFramesRef = useRef(0);
  const capturedRef = useRef(false);

  const [status, setStatus] = useState('loading'); // loading | camera_error | detecting | holding | verifying | done
  const [message, setMessage] = useState('Loading face detection...');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadModels();
      } catch (e) {
        if (!cancelled) { setStatus('camera_error'); setMessage('Failed to load face detection models.'); }
        return;
      }
      if (cancelled) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 360 } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('detecting');
        setMessage('Look at the camera...');
        detectLoop();
      } catch (e) {
        setStatus('camera_error');
        setMessage('Camera access denied or unavailable.');
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectLoop = async () => {
    if (capturedRef.current || !videoRef.current) return;

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160 });
    const result = await faceapi.detectSingleFace(videoRef.current, options);

    if (result) {
      stableFramesRef.current += 1;
      setStatus('holding');
      setMessage('Hold still...');
      if (stableFramesRef.current >= STABLE_FRAMES_REQUIRED) {
        capturedRef.current = true;
        setStatus('verifying');
        setMessage('Verifying...');
        await finishCapture();
        return;
      }
    } else {
      stableFramesRef.current = 0;
      setStatus('detecting');
      setMessage('Position your face in the frame...');
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  };

  const finishCapture = async () => {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160 });
    const result = await faceapi.detectSingleFace(videoRef.current, options).withFaceLandmarks().withFaceDescriptor();
    if (!result) {
      // Lost the face right at the capture moment — reset and try again.
      capturedRef.current = false;
      stableFramesRef.current = 0;
      setStatus('detecting');
      setMessage('Lost face — look at the camera again...');
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL('image/jpeg', 0.7);

    setStatus('done');
    setMessage('Captured!');
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    onCapture({ descriptor: Array.from(result.descriptor), photo });
  };

  return (
    <div className="text-center">
      <div className="position-relative d-inline-block rounded-3 overflow-hidden border" style={{ background: '#000' }}>
        <video ref={videoRef} muted playsInline style={{ width: 320, height: 240, objectFit: 'cover', transform: 'scaleX(-1)' }} />
        {status === 'holding' && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(99,102,241,0.25)' }}>
            <span className="badge bg-primary fs-6">🙂 Hold still</span>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div className="mt-2 fw-bold small">
        {status === 'camera_error' ? <span className="text-danger">{message}</span> : message}
      </div>
      {onCancel && (
        <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={onCancel}>Cancel</button>
      )}
    </div>
  );
}
