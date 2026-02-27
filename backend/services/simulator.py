"""Multi-way intersection traffic simulation engine."""

from __future__ import annotations

import math
import random
from typing import Dict, List, Any


# Default phase durations in seconds
DEFAULT_GREEN = 30
DEFAULT_YELLOW = 5
DEFAULT_RED = 30

# Emergency green durations by priority tier
AMBULANCE_GREEN = 60     # Ambulance — highest urgency, longest green
FIRE_ENGINE_GREEN = 45   # Fire Engine — high urgency, extended green

# Emergency vehicle priority levels (higher = more urgent)
EMERGENCY_PRIORITY = {
    "Ambulance": 5,       # Life-threatening, highest priority
    "Fire Engine": 3,     # Urgent but lower than ambulance
}

VEHICLE_TYPES = [
    {"id": "Ambulance", "label": "Ambulance", "priority": 5, "color": "#ef4444", "emergency": True},
    {"id": "Fire Engine", "label": "Fire Engine", "priority": 3, "color": "#dc2626", "emergency": True},
    {"id": "car", "label": "Car", "priority": 0, "color": "#4a8af4", "emergency": False},
    {"id": "bus", "label": "Bus", "priority": 0, "color": "#e8a838", "emergency": False},
    {"id": "police vehicle", "label": "Police Vehicle", "priority": 0, "color": "#2563eb", "emergency": False},
    {"id": "auto-rikshaw", "label": "Auto Rickshaw", "priority": 0, "color": "#a855f7", "emergency": False},
    {"id": "TwoWheelers", "label": "Two-Wheeler", "priority": 0, "color": "#10b981", "emergency": False},
]

INTERSECTION_TYPES = {
    1: {"name": "1-Way Signal", "roads": 1, "description": "Single road with one signal controlling flow"},
    2: {"name": "2-Way Signal", "roads": 2, "description": "Two opposing roads with alternating signals"},
    3: {"name": "3-Way Signal", "roads": 3, "description": "T-intersection with three-phase signal cycle"},
    4: {"name": "4-Way Signal", "roads": 4, "description": "Standard crossroad with four-phase signal cycle"},
    5: {"name": "5-Way Roundabout", "roads": 5, "description": "Roundabout with five entry points and yield signals"},
}


def _road_labels(count: int) -> List[str]:
    """Generate road labels: North, South, East, West, Southwest..."""
    labels = ["North", "South", "East", "West", "Southwest"]
    return labels[:count]


def _get_road_emergency_info(
    road: str,
    vehicles_per_road: Dict[str, List[Dict[str, int]]],
) -> Dict[str, Any]:
    """
    Inspect the actual vehicles on a road to determine its emergency status.

    Returns dict with:
      - is_emergency: bool
      - priority: int (0 = none, 3 = fire engine, 5 = ambulance)
      - emergency_type: str | None ("Ambulance", "Fire Engine", or None)
      - green_time: int (duration based on the highest-priority vehicle)
    """
    road_vehicles = vehicles_per_road.get(road, [])
    best_priority = 0
    best_type = None

    for v in road_vehicles:
        vtype = v.get("type", "")
        vcount = v.get("count", 0)
        if vcount > 0 and vtype in EMERGENCY_PRIORITY:
            p = EMERGENCY_PRIORITY[vtype]
            if p > best_priority:
                best_priority = p
                best_type = vtype

    if best_type == "Ambulance":
        return {
            "is_emergency": True,
            "priority": best_priority,
            "emergency_type": "Ambulance",
            "green_time": AMBULANCE_GREEN,
        }
    elif best_type == "Fire Engine":
        return {
            "is_emergency": True,
            "priority": best_priority,
            "emergency_type": "Fire Engine",
            "green_time": FIRE_ENGINE_GREEN,
        }
    else:
        return {
            "is_emergency": False,
            "priority": 0,
            "emergency_type": None,
            "green_time": DEFAULT_GREEN,
        }


def generate_signal_phases(
    intersection_type: int,
    vehicles_per_road: Dict[str, List[Dict[str, int]]],
    emergency_roads: List[str] | None = None,
) -> Dict[str, Any]:
    """
    Generate the signal phase sequence for an intersection type.

    Priority is derived from the ACTUAL vehicle data in vehicles_per_road,
    not just the emergency_roads list. This ensures a road only gets
    emergency priority if it truly has emergency vehicles with count > 0.

    Priority order: Ambulance roads → Fire Engine roads → Normal roads.
    Within each tier, roads are ordered by vehicle density.
    """
    if intersection_type not in INTERSECTION_TYPES:
        return {"error": f"Invalid intersection type: {intersection_type}"}

    info = INTERSECTION_TYPES[intersection_type]
    roads = _road_labels(info["roads"])

    # Compute emergency info for each road from ACTUAL vehicle data
    road_info = {}
    actual_emergency_roads = []
    for road in roads:
        einfo = _get_road_emergency_info(road, vehicles_per_road)
        road_info[road] = einfo
        if einfo["is_emergency"]:
            actual_emergency_roads.append(road)

    phases: List[Dict[str, Any]] = []
    total_cycle_time = 0

    # Sort roads: highest emergency priority first, then by vehicle count
    def road_sort_key(r):
        ei = road_info[r]
        total_veh = sum(v.get("count", 0) for v in vehicles_per_road.get(r, []))
        # Primary: emergency priority descending (negate for ascending sort)
        # Secondary: vehicle count descending
        return (-ei["priority"], -total_veh)

    sorted_roads = sorted(roads, key=road_sort_key)

    for i, road in enumerate(sorted_roads):
        ei = road_info[road]
        road_vehicles = vehicles_per_road.get(road, [])
        total_vehicles = sum(v.get("count", 0) for v in road_vehicles)

        # Calculate green time based on emergency type and vehicle density
        if ei["is_emergency"]:
            green_time = ei["green_time"]
        elif total_vehicles > 20:
            green_time = DEFAULT_GREEN + 15
        elif total_vehicles > 10:
            green_time = DEFAULT_GREEN + 5
        else:
            green_time = DEFAULT_GREEN

        yellow_time = DEFAULT_YELLOW

        # Build signal states for all roads during this phase
        signals = {}
        for r in roads:
            signals[r] = "GREEN" if r == road else "RED"

        phase = {
            "phase_number": i + 1,
            "active_road": road,
            "green_duration": green_time,
            "yellow_duration": yellow_time,
            "is_emergency_priority": ei["is_emergency"],
            "emergency_type": ei["emergency_type"],
            "vehicle_count": total_vehicles,
            "signals": signals,
        }
        phases.append(phase)
        total_cycle_time += green_time + yellow_time

    # For 5-Way roundabout: add a yield-all phase
    if intersection_type == 5:
        phases.append({
            "phase_number": len(phases) + 1,
            "active_road": "Yield-All",
            "green_duration": 10,
            "yellow_duration": 3,
            "is_emergency_priority": False,
            "emergency_type": None,
            "vehicle_count": 0,
            "signals": {r: "YELLOW" for r in roads},
        })
        total_cycle_time += 13

    return {
        "intersection_type": intersection_type,
        "intersection_name": info["name"],
        "description": info["description"],
        "roads": roads,
        "total_cycle_time": total_cycle_time,
        "phases": phases,
        "emergency_active": len(actual_emergency_roads) > 0,
        "emergency_roads": actual_emergency_roads,
    }


def get_intersection_types() -> List[Dict[str, Any]]:
    """Return available intersection configurations."""
    return [
        {"type": k, **v}
        for k, v in INTERSECTION_TYPES.items()
    ]


def get_vehicle_types() -> List[Dict[str, Any]]:
    """Return available vehicle types with their properties."""
    return VEHICLE_TYPES
