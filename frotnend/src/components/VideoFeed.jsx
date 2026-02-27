import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, Upload, AlertTriangle, RefreshCw, FolderOpen } from 'lucide-react';

const API_WS_URL = 'ws://localhost:8000/api/ws/detect';
const RECONNECT_DELAY_MS = 3000;
const FRAME_INTERVAL_MS = 500;

export default function VideoFeed({ onDetections, active = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const reconnectRef = useRef(null);
  const waitingRef = useRef(false);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [mode, setMode] = useState('webcam');
  const fileInputRef = useRef(null);

  const classColors = {
    Ambulance: '#ef4444',
    'Fire Engine': '#dc2626',
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' },
      });
      if (videoRef.current && mountedRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setErrorMsg('Camera access denied or unavailable.');
      setStatus('error');
    }
  }, []);

  const connectWS = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    setStatus('connecting');
    const ws = new WebSocket(API_WS_URL);
    wsRef.current = ws;
    waitingRef.current = false;

    ws.onopen = () => { if (mountedRef.current) { setStatus('running'); setReconnectCount(0); } };
    ws.onerror = () => { };
    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('reconnecting');
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) { setReconnectCount((c) => c + 1); connectWS(); }
      }, RECONNECT_DELAY_MS);
    };
    ws.onmessage = (event) => {
      waitingRef.current = false;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') return;
        if (data.error) { console.warn('[VideoFeed] Server error:', data.error); return; }
        drawDetections(data.detections || []);
        onDetections?.(data.detections || [], data.signal || {}, data.stats || {});
      } catch { /* ignore */ }
    };
  }, [onDetections]);

  const drawDetections = useCallback((detections) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const det of detections) {
      const [x1, y1, x2, y2] = det.bbox;
      const color = classColors[det.class_name] || '#38bdf8';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.shadowBlur = 0;
      const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 12px Inter, sans-serif';
      const textW = ctx.measureText(label).width + 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x1, y1 - 24, textW, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x1 + 5, y1 - 8);
    }
  }, []);

  const sendFrame = useCallback(() => {
    const video = videoRef.current;
    const ws = wsRef.current;
    if (!video || !ws || ws.readyState !== 1 || video.paused) return;
    if (waitingRef.current) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = video.videoWidth || 640;
    offscreen.height = video.videoHeight || 480;
    offscreen.getContext('2d').drawImage(video, 0, 0);
    offscreen.toBlob(
      (blob) => {
        if (!blob || !wsRef.current || wsRef.current.readyState !== 1) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          try { waitingRef.current = true; wsRef.current.send(JSON.stringify({ frame: reader.result })); } catch { }
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg', 0.6,
    );
  }, []);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('http://localhost:8000/api/detect', { method: 'POST', body: formData });
      const data = await res.json();
      onDetections?.(data.detections || [], data.signal || {}, data.stats || {});
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          for (const det of data.detections || []) {
            const [x1, y1, x2, y2] = det.bbox;
            const color = classColors[det.class_name] || '#38bdf8';
            ctx.strokeStyle = color; ctx.lineWidth = 2.5;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
            ctx.font = 'bold 12px Inter, sans-serif';
            const textW = ctx.measureText(label).width + 10;
            ctx.fillStyle = color; ctx.fillRect(x1, y1 - 24, textW, 22);
            ctx.fillStyle = '#fff'; ctx.fillText(label, x1 + 5, y1 - 8);
          }
        }
      };
      img.src = URL.createObjectURL(file);
    } catch { setErrorMsg('Upload failed. Is the backend running?'); }
  }, [onDetections]);

  useEffect(() => {
    mountedRef.current = true;
    if (active && mode === 'webcam') startCamera();
    return () => {
      mountedRef.current = false;
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
      if (timerRef.current) clearInterval(timerRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [active, mode]);

  useEffect(() => {
    if (cameraReady && active && mode === 'webcam') {
      connectWS();
      timerRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cameraReady, active, mode]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video">
      {/* Mode toggle */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <button
          onClick={() => setMode('webcam')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${mode === 'webcam'
            ? 'bg-[var(--accent)]/20 border-[var(--accent)]/50 text-[var(--accent)]'
            : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
            }`}
        >
          <Camera className="w-3.5 h-3.5" /> Webcam
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${mode === 'upload'
            ? 'bg-[var(--accent)]/20 border-[var(--accent)]/50 text-[var(--accent)]'
            : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
            }`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {mode === 'webcam' ? (
        <>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          <canvas ref={canvasRef} className="max-w-full max-h-[300px] rounded-lg" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-glow)] text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all active:scale-[0.97]"
          >
            <FolderOpen className="w-4 h-4" /> Choose Image to Detect
          </button>
          <p className="text-xs text-white/40">Upload a traffic image for YOLO detection</p>
        </div>
      )}

      {/* Status badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${status === 'running' ? 'bg-emerald-400 animate-pulse'
          : status === 'connecting' ? 'bg-amber-400 animate-pulse'
            : status === 'reconnecting' ? 'bg-orange-400 animate-pulse'
              : status === 'error' ? 'bg-red-400'
                : 'bg-gray-400'
          }`} />
        <span className="text-xs font-medium text-white/80 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
          {status === 'running' && 'Live'}
          {status === 'connecting' && 'Connecting...'}
          {status === 'reconnecting' && `Reconnecting (${reconnectCount})...`}
          {status === 'error' && 'Error'}
          {status === 'idle' && 'Idle'}
        </span>
      </div>

      {/* Error overlay */}
      {status === 'error' && mode === 'webcam' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center px-8 max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-red-400 font-semibold mb-2 text-lg">Connection Error</p>
            <p className="text-sm text-white/50 mb-5">{errorMsg}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { startCamera(); connectWS(); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:brightness-110 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Retry Camera
              </button>
              <button
                onClick={() => setMode('upload')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
              >
                <Upload className="w-4 h-4" /> Upload Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'idle' && !cameraReady && mode === 'webcam' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-secondary)]">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-white/50 text-sm">Requesting camera access...</p>
          </div>
        </div>
      )}
    </div>
  );
}
