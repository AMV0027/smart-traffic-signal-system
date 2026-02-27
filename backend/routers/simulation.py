"""Simulation & routing API routes."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

# Add project root so we can import dijkstra module
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_PROJECT_ROOT))

from dijkstra import build_adjacency, dijkstra  # noqa: E402
from services.simulator import (
    generate_signal_phases,
    get_intersection_types,
    get_vehicle_types,
)

router = APIRouter(tags=["simulation"])


# ---------- Request / Response models ----------

class VehicleCount(BaseModel):
    type: str
    count: int


class SimulationRequest(BaseModel):
    intersection_type: int  # 1-5
    vehicles_per_road: Dict[str, List[VehicleCount]]  # road_label → [{type, count}]
    emergency_roads: Optional[List[str]] = None


class EdgeDef(BaseModel):
    from_node: str  # aliased in JSON as "from"
    to_node: str    # aliased in JSON as "to"
    distance: int
    traffic_weight: int

    class Config:
        # allow both "from"/"to" and "from_node"/"to_node"
        populate_by_name = True


class RouteRequest(BaseModel):
    edges: List[Dict[str, Any]]
    start: str
    destination: str
    use_traffic: bool = True


# ---------- Endpoints ----------

@router.get("/intersection-types")
async def list_intersection_types():
    """Return all available intersection configurations."""
    return {"types": get_intersection_types()}


@router.get("/vehicle-types")
async def list_vehicle_types():
    """Return all vehicle types with properties."""
    return {"types": get_vehicle_types()}


@router.post("/simulate")
async def simulate(req: SimulationRequest) -> Dict[str, Any]:
    """
    Run a traffic signal simulation for the given intersection type and vehicle distribution.
    """
    vehicles = {
        road: [v.model_dump() for v in vlist]
        for road, vlist in req.vehicles_per_road.items()
    }
    result = generate_signal_phases(
        intersection_type=req.intersection_type,
        vehicles_per_road=vehicles,
        emergency_roads=req.emergency_roads,
    )
    return result


@router.post("/route")
async def compute_route(req: RouteRequest) -> Dict[str, Any]:
    """
    Compute the shortest emergency route using Dijkstra's algorithm.
    """
    adjacency = build_adjacency(req.edges, use_traffic=req.use_traffic)
    path, cost = dijkstra(adjacency, req.start, req.destination)

    if cost == -1:
        return {"path": [], "cost": -1, "reachable": False}

    return {"path": path, "cost": cost, "reachable": True}
