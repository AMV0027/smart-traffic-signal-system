"""Dijkstra's shortest-path algorithm for emergency vehicle routing."""

from __future__ import annotations

import heapq
from typing import Any, Dict, List, Tuple


def build_adjacency(
    edges: List[Dict[str, Any]],
    use_traffic: bool = True,
) -> Dict[str, List[Tuple[str, int]]]:
    """
    Build an adjacency list from a list of edge definitions.

    Each edge dict should have keys:
      - from / from_node : source node
      - to / to_node     : destination node
      - distance         : base distance weight
      - traffic_weight   : additional cost due to traffic congestion

    If *use_traffic* is True the effective weight is ``distance + traffic_weight``,
    otherwise only ``distance`` is used.

    Returns a dict mapping each node to a list of ``(neighbour, weight)`` tuples.
    """
    adj: Dict[str, List[Tuple[str, int]]] = {}

    for edge in edges:
        src = edge.get("from") or edge.get("from_node", "")
        dst = edge.get("to") or edge.get("to_node", "")
        dist = int(edge.get("distance", 1))
        traffic = int(edge.get("traffic_weight", 0)) if use_traffic else 0
        weight = dist + traffic

        adj.setdefault(src, []).append((dst, weight))
        adj.setdefault(dst, []).append((src, weight))  # undirected

    return adj


def dijkstra(
    adjacency: Dict[str, List[Tuple[str, int]]],
    start: str,
    destination: str,
) -> Tuple[List[str], int]:
    """
    Classic Dijkstra's algorithm.

    Returns ``(path, cost)`` where *path* is a list of node names from *start*
    to *destination* (inclusive) and *cost* is the total weight.

    If the destination is unreachable, returns ``([], -1)``.
    """
    if start not in adjacency:
        return ([], -1)

    dist: Dict[str, int] = {start: 0}
    prev: Dict[str, str | None] = {start: None}
    visited: set[str] = set()
    heap: List[Tuple[int, str]] = [(0, start)]

    while heap:
        cost, node = heapq.heappop(heap)

        if node in visited:
            continue
        visited.add(node)

        if node == destination:
            # Reconstruct path
            path: List[str] = []
            cur: str | None = destination
            while cur is not None:
                path.append(cur)
                cur = prev.get(cur)
            return (list(reversed(path)), cost)

        for neighbour, weight in adjacency.get(node, []):
            if neighbour in visited:
                continue
            new_cost = cost + weight
            if new_cost < dist.get(neighbour, float("inf")):
                dist[neighbour] = new_cost
                prev[neighbour] = node
                heapq.heappush(heap, (new_cost, neighbour))

    return ([], -1)
