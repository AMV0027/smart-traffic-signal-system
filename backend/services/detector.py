"""YOLO-based vehicle detector service."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Dict, Any

import cv2
import numpy as np
from ultralytics import YOLO

# Resolve model path relative to project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_MODEL_PATH = _PROJECT_ROOT / "model" / "best"

# Class names from data.yaml (2-class emergency model)
CLASS_NAMES = [
    "Ambulance",
    "Fire Engine",
]

# Emergency vehicle class names (trigger signal override)
EMERGENCY_CLASSES = {"Ambulance", "Fire Engine"}


class VehicleDetector:
    """Wraps the YOLO model for inference on images and video frames."""

    def __init__(self):
        self._model: YOLO | None = None

    def _load_model(self) -> YOLO:
        """Lazy-load the YOLO model."""
        if self._model is None:
            model_path = None

            # 1) Check for best.pt next to the best/ directory (most common)
            pt_sibling = _MODEL_PATH.parent / "best.pt"
            if pt_sibling.exists():
                model_path = pt_sibling

            # 2) Check for .pt files inside model/best/
            if model_path is None:
                for name in ("best.pt", "last.pt", "weights.pt"):
                    candidate = _MODEL_PATH / name
                    if candidate.exists():
                        model_path = candidate
                        break

            # 3) Check project root
            if model_path is None:
                pt_root = _PROJECT_ROOT / "best.pt"
                if pt_root.exists():
                    model_path = pt_root

            # 4) Fallback to directory itself
            if model_path is None:
                model_path = _MODEL_PATH

            print(f"[Detector] Loading YOLO model from: {model_path}")
            self._model = YOLO(str(model_path))
            print(f"[Detector] Model loaded successfully")
        return self._model

    @property
    def model(self) -> YOLO:
        return self._load_model()

    def detect_from_bytes(self, image_bytes: bytes, conf: float = 0.35) -> List[Dict[str, Any]]:
        """Run detection on raw image bytes. Returns list of detection dicts."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return []
        return self._run_inference(frame, conf)

    def detect_from_frame(self, frame: np.ndarray, conf: float = 0.35) -> List[Dict[str, Any]]:
        """Run detection on a numpy BGR frame."""
        return self._run_inference(frame, conf)

    def _run_inference(self, frame: np.ndarray, conf: float) -> List[Dict[str, Any]]:
        results = self.model.predict(frame, conf=conf, verbose=False)
        detections: List[Dict[str, Any]] = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                cls_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else f"class_{cls_id}"
                det = {
                    "class_id": cls_id,
                    "class_name": cls_name,
                    "confidence": round(float(boxes.conf[i].item()), 3),
                    "bbox": [round(float(c), 1) for c in boxes.xyxy[i].tolist()],
                    "is_emergency": cls_name in EMERGENCY_CLASSES,
                }
                detections.append(det)
        return detections


# Singleton instance
detector = VehicleDetector()
