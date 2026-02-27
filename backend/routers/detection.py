"""Detection & signal API routes."""

from __future__ import annotations

import asyncio
import base64
import json
import time
import traceback
from typing import Any, Dict
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
from fastapi import APIRouter, File, UploadFile, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.detector import detector
from services.signal_logic import determine_signal

router = APIRouter(tags=["detection"])

# Thread pool for CPU-bound YOLO inference so it doesn't block the event loop
_executor = ThreadPoolExecutor(max_workers=2)


def _run_detection(image_bytes: bytes):
    """Synchronous detection — runs in thread pool."""
    start = time.time()
    detections = detector.detect_from_bytes(image_bytes)
    inference_ms = round((time.time() - start) * 1000, 1)
    return detections, inference_ms


@router.post("/detect")
async def detect_image(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload an image and get vehicle detections + signal state.
    """
    contents = await file.read()
    loop = asyncio.get_event_loop()
    detections, inference_ms = await loop.run_in_executor(_executor, _run_detection, contents)
    signal = determine_signal(detections)

    class_counts: Dict[str, int] = {}
    for det in detections:
        name = det["class_name"]
        class_counts[name] = class_counts.get(name, 0) + 1

    return {
        "detections": detections,
        "signal": signal,
        "stats": {
            "total_vehicles": len(detections),
            "class_counts": class_counts,
            "inference_ms": inference_ms,
        },
    }


@router.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket):
    """
    WebSocket endpoint for real-time video detection.

    Flow control: waits for inference to finish before accepting the next frame,
    preventing queue buildup and timeouts.
    """
    await websocket.accept()
    print("[WS] Client connected")

    try:
        loop = asyncio.get_event_loop()

        while True:
            # Wait for a frame from the client (with a generous timeout)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send a keepalive ping if no frame received in 30s
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"type": "ping"})
                continue

            # Parse the frame
            try:
                payload = json.loads(data)
                frame_b64 = payload.get("frame", "")
            except json.JSONDecodeError:
                frame_b64 = data

            if not frame_b64:
                continue

            # Strip data URL prefix
            if "," in frame_b64:
                frame_b64 = frame_b64.split(",", 1)[1]

            try:
                image_bytes = base64.b64decode(frame_b64)
            except Exception:
                await websocket.send_json({"error": "Invalid base64 frame"})
                continue

            # Run detection in thread pool (non-blocking)
            try:
                detections, inference_ms = await loop.run_in_executor(
                    _executor, _run_detection, image_bytes
                )
            except Exception as e:
                print(f"[WS] Inference error: {e}")
                await websocket.send_json({"error": f"Inference failed: {e}"})
                continue

            signal = determine_signal(detections)

            class_counts: Dict[str, int] = {}
            for det in detections:
                name = det["class_name"]
                class_counts[name] = class_counts.get(name, 0) + 1

            await websocket.send_json({
                "type": "detection",
                "detections": detections,
                "signal": signal,
                "stats": {
                    "total_vehicles": len(detections),
                    "class_counts": class_counts,
                    "inference_ms": inference_ms,
                },
            })

    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        traceback.print_exc()
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json({"error": str(e)})
        except Exception:
            pass
