"""Traffic signal logic — determines signal state based on detected vehicles."""

from __future__ import annotations

from typing import List, Dict, Any

from services.detector import EMERGENCY_CLASSES


class SignalState:
    RED = "RED"
    GREEN = "GREEN"
    YELLOW = "YELLOW"


def determine_signal(detections: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Decide the traffic signal state based on current detections.

    Rules:
    - If ANY emergency vehicle (Ambulance, Fire Engine) is detected
      with confidence ≥ 0.3 → signal = GREEN (priority override)
    - Otherwise → signal = RED (default hold)

    Returns dict with signal state + reason.
    """
    emergency_found = []
    for det in detections:
        if det.get("class_name") in EMERGENCY_CLASSES and det.get("confidence", 0) >= 0.3:
            emergency_found.append(det["class_name"])

    if emergency_found:
        return {
            "signal": SignalState.GREEN,
            "reason": f"Emergency vehicle detected: {', '.join(set(emergency_found))}",
            "emergency_vehicles": list(set(emergency_found)),
            "override": True,
        }

    return {
        "signal": SignalState.RED,
        "reason": "No emergency vehicle detected",
        "emergency_vehicles": [],
        "override": False,
    }
