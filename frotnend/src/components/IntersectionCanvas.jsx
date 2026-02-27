import React, { useRef, useEffect, useState } from 'react';

// Import vehicle sprites
import ambulanceSrc from '../assets/sprites/ambulance.png';
import autoRickshawSrc from '../assets/sprites/auto-rickshaw.png';
import busSrc from '../assets/sprites/bus.png';
import carSrc from '../assets/sprites/car.png';
import firetruckSrc from '../assets/sprites/firetruck.png';
import policeCarSrc from '../assets/sprites/police-car.png';
import twoWheelerSrc from '../assets/sprites/two-wheeler.png';

const SPRITE_MAP = {
  car: carSrc,
  bus: busSrc,
  Ambulance: ambulanceSrc,
  'Fire Engine': firetruckSrc,
  'police vehicle': policeCarSrc,
  'auto-rikshaw': autoRickshawSrc,
  TwoWheelers: twoWheelerSrc,
};

// ── IDM Parameters ──────────────────────────────────────────────
const IDM = {
  v0: 120,        // desired velocity (px/s)
  T: 0.8,         // safe time headway (s)
  s0: 8,          // minimum gap (px)
  a: 80,          // max acceleration (px/s²)
  b: 100,         // comfortable deceleration (px/s²)
  delta: 4,       // acceleration exponent
};

// ── Vehicle sizing ──────────────────────────────────────────────
const VEH_SIZES = {
  car: { w: 16, h: 32 },
  bus: { w: 18, h: 48 },
  Ambulance: { w: 16, h: 36 },
  'Fire Engine': { w: 18, h: 44 },
  'police vehicle': { w: 16, h: 34 },
  'auto-rikshaw': { w: 14, h: 26 },
  TwoWheelers: { w: 10, h: 24 },
};
const DEFAULT_SIZE = { w: 16, h: 32 };

// ── Visual constants ────────────────────────────────────────────
const ROAD_WIDTH = 52;
const LANE_W = ROAD_WIDTH / 2;
const LANE_OFFSET = LANE_W / 2; // center of incoming/outgoing lane

const COLORS = {
  bg: '#0b1120',
  road: '#2a3040',
  roadEdge: '#404858',
  dashLine: '#ffffff22',
  centerSolid: '#ffdd5788',
  stopLine: '#ffffff66',
  intersection: '#1c2434',
  crosswalk: '#ffffff10',
  RED: '#ef4444',
  GREEN: '#22c55e',
  YELLOW: '#f59e0b',
  text: '#d0d8e8',
  shadow: 'rgba(0,0,0,0.35)',
  headlight: 'rgba(255,240,200,0.08)',
  grass: '#0d1f12',
};

// ── Direction helpers ───────────────────────────────────────────
function getDirections(type) {
  if (type === 1) return ['north'];
  if (type === 2) return ['north', 'south'];
  if (type === 3) return ['north', 'east', 'south'];
  if (type === 5) return null; // roundabout
  return ['north', 'south', 'east', 'west'];
}

// Direction unit vectors (direction vehicle travels toward intersection)
const DIR_VEC = {
  north: { dx: 0, dy: 1 },   // drives southward
  south: { dx: 0, dy: -1 },  // drives northward
  east: { dx: -1, dy: 0 },  // drives westward
  west: { dx: 1, dy: 0 },   // drives eastward
};

// Perpendicular offset to get the incoming lane (right-hand traffic)
// Incoming = right side when looking toward intersection
const DIR_LANE_PERP = {
  north: { dx: 1, dy: 0 },
  south: { dx: -1, dy: 0 },
  east: { dx: 0, dy: 1 },
  west: { dx: 0, dy: -1 },
};

// Rotation for sprites traveling in each direction
const DIR_ROTATION = {
  north: Math.PI,        // facing down
  south: 0,              // facing up
  east: Math.PI / 2,     // facing left
  west: -Math.PI / 2,    // facing right
};

/**
 * IntersectionCanvas — realistic animated intersection with IDM physics.
 */
export default function IntersectionCanvas({
  type = 4,
  roads = [],
  phases = [],
  activePhase = 0,
  vehicles = {},
}) {
  const canvasRef = useRef(null);
  const imagesRef = useRef({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const simRef = useRef(null);     // simulation state
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const prevPhaseRef = useRef(-1);
  const [zoom, setZoom] = useState(1);

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.15;

  // ── Preload sprites ──────────────────────────────────────────
  useEffect(() => {
    const loaded = {};
    let count = 0;
    const entries = Object.entries(SPRITE_MAP);
    for (const [key, src] of entries) {
      const img = new Image();
      img.onload = () => { loaded[key] = img; count++; if (count === entries.length) { imagesRef.current = loaded; setImagesLoaded(true); } };
      img.onerror = () => { count++; if (count === entries.length) { imagesRef.current = loaded; setImagesLoaded(true); } };
      img.src = src;
    }
  }, []);

  // ── Build simulation state when vehicles/roads change ────────
  useEffect(() => {
    if (type === 5) {
      // Roundabout uses simpler approach
      simRef.current = buildRoundaboutSim(roads, vehicles);
    } else {
      simRef.current = buildRegularSim(type, roads, vehicles);
    }
  }, [vehicles, roads, type]);

  // ── Canvas resize ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    return () => observer.disconnect();
  }, []);

  // ── Mouse wheel zoom ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e) => {
      e.preventDefault();
      setZoom((prev) => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + delta)) * 100) / 100;
      });
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Animation loop ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const animate = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const sim = simRef.current;
      if (!sim) { rafRef.current = requestAnimationFrame(animate); return; }

      const currentPhase = phases[activePhase] || {};
      const signals = currentPhase.signals || {};

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      if (W === 0 || H === 0) { rafRef.current = requestAnimationFrame(animate); return; }
      const cx = W / 2;
      const cy = H / 2;

      // Update physics
      if (type === 5) {
        updateRoundaboutVehicles(sim, dt, signals, cx, cy, W, H);
      } else {
        updateRegularVehicles(sim, dt, signals, cx, cy, W, H, type);
      }

      // Draw with zoom
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);
      // Apply zoom centered on canvas center
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
      drawScene(ctx, W, H, cx, cy, sim, phases, activePhase, type, roads, imagesRef.current);
      ctx.restore();

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phases, activePhase, imagesLoaded, type, roads, zoom]);

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  const zoomReset = () => setZoom(1);

  return (
    <div className="w-full h-full min-h-[420px] relative rounded-xl overflow-hidden border border-[var(--border)]" style={{ background: COLORS.bg }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-[#0b1120cc] backdrop-blur-sm rounded-lg border border-[#ffffff15] p-1 select-none">
        <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-[#d0d8e8] hover:bg-[#ffffff15] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          −
        </button>
        <button onClick={zoomReset}
          className="px-2 h-7 rounded-md text-[10px] font-mono font-bold text-[#d0d8e8] hover:bg-[#ffffff15] transition-colors min-w-[44px] text-center">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-[#d0d8e8] hover:bg-[#ffffff15] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          +
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SIMULATION BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildRegularSim(type, roads, vehicleCounts) {
  const directions = getDirections(type);
  const vehList = [];

  roads.forEach((road, roadIdx) => {
    const dir = directions[roadIdx];
    if (!dir) return;
    const roadVeh = vehicleCounts[road] || [];
    let spawnOffset = 0;

    for (const vEntry of roadVeh) {
      for (let c = 0; c < Math.min(vEntry.count || 0, 8); c++) {
        const size = VEH_SIZES[vEntry.type] || DEFAULT_SIZE;
        const gap = size.h + IDM.s0 + 4 + Math.random() * 6;
        vehList.push({
          type: vEntry.type,
          road,
          roadIdx,
          dir,
          // position = distance traveled along lane from spawn edge
          // Negative means still off-screen
          pos: -(spawnOffset * gap) - 20 - Math.random() * 40,
          vel: IDM.v0 * (0.6 + Math.random() * 0.4),
          acc: 0,
          size,
          crossed: false, // has crossed stop line
          exitDir: null,  // assigned when crossing
        });
        spawnOffset++;
      }
    }
  });

  // Sort by road+direction so we can easily find leader
  return { type: 'regular', vehicles: vehList };
}

function buildRoundaboutSim(roads, vehicleCounts) {
  const vehList = [];
  const angleStep = (2 * Math.PI) / 5;

  roads.forEach((road, roadIdx) => {
    const angle = -Math.PI / 2 + roadIdx * angleStep;
    const roadVeh = vehicleCounts[road] || [];
    let spawnOffset = 0;

    for (const vEntry of roadVeh) {
      for (let c = 0; c < Math.min(vEntry.count || 0, 6); c++) {
        const size = VEH_SIZES[vEntry.type] || DEFAULT_SIZE;
        const gap = size.h + IDM.s0 + 4;
        vehList.push({
          type: vEntry.type,
          road,
          roadIdx,
          angle,
          pos: -(spawnOffset * gap) - 30 - Math.random() * 30,
          vel: IDM.v0 * 0.6,
          acc: 0,
          size,
        });
        spawnOffset++;
      }
    }
  });

  return { type: 'roundabout', vehicles: vehList };
}

// ═══════════════════════════════════════════════════════════════
//  IDM PHYSICS
// ═══════════════════════════════════════════════════════════════

function idmAcceleration(v, dv, s, v0 = IDM.v0) {
  const sStar = IDM.s0 + Math.max(0, v * IDM.T + (v * dv) / (2 * Math.sqrt(IDM.a * IDM.b)));
  const aFree = IDM.a * (1 - Math.pow(v / Math.max(v0, 1), IDM.delta));
  const aInt = -IDM.a * Math.pow(sStar / Math.max(s, 0.1), 2);
  return aFree + aInt;
}

// Returns stop-line position in ROAD-LOCAL coords (distance from spawn edge)
function getStopLinePos(dir, cx, cy, W, H) {
  const half = ROAD_WIDTH + 8;
  switch (dir) {
    case 'north': return cy - half;          // spawn at y=0, screen y = pos
    case 'south': return H - (cy + half);    // spawn at y=H, screen y = H - pos
    case 'east': return W - (cx + half);    // spawn at x=W, screen x = W - pos
    case 'west': return cx - half;          // spawn at x=0, screen x = pos
    default: return cy;
  }
}

function getRoadLength(dir, cx, cy, W, H) {
  switch (dir) {
    case 'north': return cy + 60;
    case 'south': return H - cy + 60;
    case 'east': return W - cx + 60;
    case 'west': return cx + 60;
    default: return H;
  }
}

function getSpawnEdgePos(dir, cx, cy, W, H) {
  // The "origin" of the lane — where pos=0 corresponds to on the canvas
  return 0; // We'll offset in world-to-screen transform
}

// ═══════════════════════════════════════════════════════════════
//  UPDATE — REGULAR INTERSECTION
// ═══════════════════════════════════════════════════════════════

function updateRegularVehicles(sim, dt, signals, cx, cy, W, H, type) {
  const vehs = sim.vehicles;
  const directions = getDirections(type);

  // Group by direction for leader-follower
  const byDir = {};
  for (const d of directions) byDir[d] = [];
  for (const v of vehs) {
    if (byDir[v.dir]) byDir[v.dir].push(v);
  }

  // Sort each group by position descending (furthest along first)
  for (const d of directions) {
    byDir[d].sort((a, b) => b.pos - a.pos);
  }

  // Get stop-line positions
  for (const d of directions) {
    const group = byDir[d];
    const stopLinePos = getStopLinePos(d, cx, cy, W, H);
    const roadLen = getRoadLength(d, cx, cy, W, H);
    const sig = findSignalForDir(d, directions, signals,
      vehs.filter(v => v.dir === d).map(v => v.road));

    for (let i = 0; i < group.length; i++) {
      const v = group[i];
      const leaderV = i > 0 ? group[i - 1] : null;

      // Leader gap
      let gap, deltaV;
      if (leaderV) {
        gap = leaderV.pos - v.pos - leaderV.size.h / 2 - v.size.h / 2;
        deltaV = v.vel - leaderV.vel;
      } else {
        gap = 9999;
        deltaV = 0;
      }

      // Signal acting as virtual leader
      if (!v.crossed) {
        const distToStop = stopLinePos - v.pos - v.size.h / 2;
        if (distToStop > 0 && sig !== 'GREEN') {
          // Virtual stopped leader at stop line
          if (distToStop < gap) {
            gap = distToStop;
            deltaV = v.vel; // leader velocity = 0
          }
        }
        if (distToStop < -5) {
          v.crossed = true;
        }
      }

      // Compute IDM acceleration
      v.acc = idmAcceleration(v.vel, deltaV, Math.max(gap, 0.1));
      // Clamp
      v.acc = Math.max(-IDM.b * 2, Math.min(IDM.a, v.acc));

      // Integrate
      v.vel += v.acc * dt;
      v.vel = Math.max(0, Math.min(IDM.v0 * 1.2, v.vel));
      v.pos += v.vel * dt;

      // Respawn if past canvas
      if (v.pos > roadLen + 80) {
        v.pos = -30 - Math.random() * 80;
        v.vel = IDM.v0 * (0.5 + Math.random() * 0.5);
        v.crossed = false;
      }
    }
  }
}

function findSignalForDir(dir, directions, signals, roadLabels) {
  // Find what road label this direction corresponds to
  const roadLabel = roadLabels[0];
  if (!roadLabel) return 'RED';
  return signals[roadLabel] || 'RED';
}

// ═══════════════════════════════════════════════════════════════
//  UPDATE — ROUNDABOUT
// ═══════════════════════════════════════════════════════════════

function updateRoundaboutVehicles(sim, dt, signals, cx, cy, W, H) {
  const vehs = sim.vehicles;
  const byRoad = {};
  for (const v of vehs) {
    if (!byRoad[v.roadIdx]) byRoad[v.roadIdx] = [];
    byRoad[v.roadIdx].push(v);
  }

  for (const idx of Object.keys(byRoad)) {
    const group = byRoad[idx];
    group.sort((a, b) => b.pos - a.pos);
    const sig = signals[group[0]?.road] || 'RED';
    const farDist = Math.max(W, H) * 0.5 + 30;
    const stopDist = farDist * 0.55;

    for (let i = 0; i < group.length; i++) {
      const v = group[i];
      const leaderV = i > 0 ? group[i - 1] : null;

      let gap = 9999, deltaV = 0;
      if (leaderV) {
        gap = leaderV.pos - v.pos - leaderV.size.h;
        deltaV = v.vel - leaderV.vel;
      }

      // Signal stop
      if (v.pos < stopDist) {
        const distToStop = stopDist - v.pos;
        if (distToStop > 0 && sig !== 'GREEN' && distToStop < gap) {
          gap = distToStop;
          deltaV = v.vel;
        }
      }

      v.acc = idmAcceleration(v.vel, deltaV, Math.max(gap, 0.1), IDM.v0 * 0.8);
      v.acc = Math.max(-IDM.b * 2, Math.min(IDM.a, v.acc));
      v.vel += v.acc * dt;
      v.vel = Math.max(0, v.vel);
      v.pos += v.vel * dt;

      if (v.pos > farDist + 60) {
        v.pos = -20 - Math.random() * 60;
        v.vel = IDM.v0 * 0.5;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  DRAWING
// ═══════════════════════════════════════════════════════════════

function drawScene(ctx, W, H, cx, cy, sim, phases, activePhase, type, roads, images) {
  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid
  ctx.fillStyle = '#ffffff06';
  for (let x = 0; x < W; x += 24) {
    for (let y = 0; y < H; y += 24) {
      ctx.beginPath();
      ctx.arc(x, y, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const currentPhase = phases[activePhase] || {};
  const signals = currentPhase.signals || {};

  if (type === 5) {
    drawRoundabout(ctx, cx, cy, W, H, roads, signals, sim, images);
  } else {
    drawRegularIntersection(ctx, cx, cy, W, H, type, roads, signals, sim, images);
  }
}

// ─── REGULAR INTERSECTION ─────────────────────────────────────

function drawRegularIntersection(ctx, cx, cy, W, H, type, roads, signals, sim, images) {
  const directions = getDirections(type);
  const halfRoad = ROAD_WIDTH / 2;

  // Draw roads
  for (const dir of directions) {
    drawRoadSurface(ctx, cx, cy, W, H, dir);
  }

  // Intersection box
  const boxSize = ROAD_WIDTH + 10;
  ctx.fillStyle = COLORS.intersection;
  ctx.fillRect(cx - boxSize, cy - boxSize, boxSize * 2, boxSize * 2);

  // Crosswalks
  for (const dir of directions) {
    drawCrosswalk(ctx, cx, cy, boxSize, dir);
  }

  // Stop lines
  for (const dir of directions) {
    drawStopLine(ctx, cx, cy, boxSize, dir);
  }

  // Lane markings on intersection box (guide lines)
  ctx.strokeStyle = '#ffffff08';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);

  // Draw vehicles (behind signals)
  if (sim) {
    const vehs = sim.vehicles;
    // Sort by y-position for depth ordering
    const sorted = [...vehs].sort((a, b) => {
      const aPos = vehicleScreenPos(a, cx, cy, W, H);
      const bPos = vehicleScreenPos(b, cx, cy, W, H);
      return (aPos?.y || 0) - (bPos?.y || 0);
    });
    for (const v of sorted) {
      const pos = vehicleScreenPos(v, cx, cy, W, H);
      if (!pos) continue;
      drawVehicle(ctx, images, v.type, pos.x, pos.y, pos.rotation, v.size, v.vel);
    }
  }

  // Signals & labels
  for (let i = 0; i < directions.length && i < roads.length; i++) {
    drawSignalLight(ctx, cx, cy, boxSize, directions[i], signals[roads[i]] || 'RED');
    drawRoadLabel(ctx, cx, cy, W, H, directions[i], roads[i]);
  }

  ctx.setLineDash([]);
}

function drawRoadSurface(ctx, cx, cy, W, H, dir) {
  const hw = ROAD_WIDTH / 2;

  // Shadow
  ctx.fillStyle = '#00000020';
  if (dir === 'north' || dir === 'south') {
    const y1 = dir === 'north' ? 0 : cy;
    const y2 = dir === 'north' ? cy : H;
    ctx.fillRect(cx - hw - 4, y1, ROAD_WIDTH + 8, y2 - y1);
  } else {
    const x1 = dir === 'west' ? 0 : cx;
    const x2 = dir === 'west' ? cx : W;
    ctx.fillRect(x1, cy - hw - 4, x2 - x1, ROAD_WIDTH + 8);
  }

  // Road surface
  ctx.fillStyle = COLORS.road;
  if (dir === 'north' || dir === 'south') {
    const y1 = dir === 'north' ? 0 : cy;
    const y2 = dir === 'north' ? cy : H;
    ctx.fillRect(cx - hw, y1, ROAD_WIDTH, y2 - y1);
  } else {
    const x1 = dir === 'west' ? 0 : cx;
    const x2 = dir === 'west' ? cx : W;
    ctx.fillRect(x1, cy - hw, x2 - x1, ROAD_WIDTH);
  }

  // Edge lines (solid white)
  ctx.strokeStyle = COLORS.roadEdge;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  if (dir === 'north' || dir === 'south') {
    const y1 = dir === 'north' ? 0 : cy;
    const y2 = dir === 'north' ? cy : H;
    ctx.beginPath(); ctx.moveTo(cx - hw, y1); ctx.lineTo(cx - hw, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + hw, y1); ctx.lineTo(cx + hw, y2); ctx.stroke();
  } else {
    const x1 = dir === 'west' ? 0 : cx;
    const x2 = dir === 'west' ? cx : W;
    ctx.beginPath(); ctx.moveTo(x1, cy - hw); ctx.lineTo(x2, cy - hw); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, cy + hw); ctx.lineTo(x2, cy + hw); ctx.stroke();
  }

  // Center divider (solid yellow — separates incoming/outgoing)
  ctx.strokeStyle = COLORS.centerSolid;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  const margin = ROAD_WIDTH + 12;
  if (dir === 'north') {
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - margin); ctx.stroke();
  } else if (dir === 'south') {
    ctx.beginPath(); ctx.moveTo(cx, cy + margin); ctx.lineTo(cx, H); ctx.stroke();
  } else if (dir === 'east') {
    ctx.beginPath(); ctx.moveTo(cx + margin, cy); ctx.lineTo(W, cy); ctx.stroke();
  } else if (dir === 'west') {
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cx - margin, cy); ctx.stroke();
  }

  // Lane dashes (each lane gets a subtle dash)
  ctx.strokeStyle = COLORS.dashLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 12]);
  // (we only have 2 lanes so center divider suffices)
  ctx.setLineDash([]);
}

function drawCrosswalk(ctx, cx, cy, boxSize, dir) {
  ctx.fillStyle = COLORS.crosswalk;
  const stripeCount = 6;
  const stripeW = ROAD_WIDTH / (stripeCount * 2);
  const hw = ROAD_WIDTH / 2;
  const hb = boxSize;
  for (let i = 0; i < stripeCount; i++) {
    const offset = (i * 2 + 0.5) * stripeW - hw;
    if (dir === 'north') ctx.fillRect(cx + offset, cy - hb - 7, stripeW, 7);
    if (dir === 'south') ctx.fillRect(cx + offset, cy + hb, stripeW, 7);
    if (dir === 'east') ctx.fillRect(cx + hb, cy + offset, 7, stripeW);
    if (dir === 'west') ctx.fillRect(cx - hb - 7, cy + offset, 7, stripeW);
  }
}

function drawStopLine(ctx, cx, cy, boxSize, dir) {
  ctx.strokeStyle = COLORS.stopLine;
  ctx.lineWidth = 2.5;
  const hb = boxSize + 8;
  const hw = ROAD_WIDTH / 2;
  ctx.beginPath();
  if (dir === 'north') {
    // Stop line just before intersection on incoming lane (right side)
    ctx.moveTo(cx, cy - hb);
    ctx.lineTo(cx + hw, cy - hb);
  } else if (dir === 'south') {
    ctx.moveTo(cx - hw, cy + hb);
    ctx.lineTo(cx, cy + hb);
  } else if (dir === 'east') {
    ctx.moveTo(cx + hb, cy);
    ctx.lineTo(cx + hb, cy + hw);
  } else if (dir === 'west') {
    ctx.moveTo(cx - hb, cy - hw);
    ctx.lineTo(cx - hb, cy);
  }
  ctx.stroke();
}

function drawSignalLight(ctx, cx, cy, boxSize, dir, state) {
  const offset = boxSize + 20;
  let x, y;
  if (dir === 'north') { x = cx + ROAD_WIDTH / 2 + 12; y = cy - offset; }
  else if (dir === 'south') { x = cx - ROAD_WIDTH / 2 - 12; y = cy + offset; }
  else if (dir === 'east') { x = cx + offset; y = cy + ROAD_WIDTH / 2 + 12; }
  else { x = cx - offset; y = cy - ROAD_WIDTH / 2 - 12; }

  // Housing
  ctx.fillStyle = '#0a0e1a';
  ctx.beginPath();
  ctx.roundRect(x - 8, y - 20, 16, 40, 5);
  ctx.fill();
  ctx.strokeStyle = '#2a3050';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Lights
  const lightStates = ['RED', 'YELLOW', 'GREEN'];
  const lightYs = [-12, 0, 12];
  for (let i = 0; i < 3; i++) {
    const isActive = lightStates[i] === state;
    const color = COLORS[lightStates[i]];
    ctx.fillStyle = isActive ? color : '#0f1520';
    if (isActive) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.arc(x, y + lightYs[i], 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawRoadLabel(ctx, cx, cy, W, H, dir, label) {
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  const tw = ctx.measureText(label).width + 14;
  let x, y;
  if (dir === 'north') { x = cx; y = 20; }
  else if (dir === 'south') { x = cx; y = H - 20; }
  else if (dir === 'east') { x = W - 40; y = cy; }
  else { x = 40; y = cy; }

  ctx.fillStyle = '#0b112080';
  ctx.beginPath();
  ctx.roundRect(x - tw / 2, y - 10, tw, 20, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffffff10';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

// ─── VEHICLE SCREEN POSITION ──────────────────────────────────

function vehicleScreenPos(v, cx, cy, W, H) {
  if (v.isRoundabout) return null; // handled separately
  const dir = v.dir;
  if (!dir) return null;
  const vec = DIR_VEC[dir];
  const perp = DIR_LANE_PERP[dir];
  const rot = DIR_ROTATION[dir];

  // Calculate spawn origin (edge of canvas for this direction)
  let ox, oy;
  if (dir === 'north') { ox = cx; oy = 0; }
  else if (dir === 'south') { ox = cx; oy = H; }
  else if (dir === 'east') { ox = W; oy = cy; }
  else if (dir === 'west') { ox = 0; oy = cy; }

  // Offset to incoming lane (right side)
  ox += perp.dx * LANE_OFFSET;
  oy += perp.dy * LANE_OFFSET;

  // Move along road by position
  const x = ox + vec.dx * v.pos;
  const y = oy + vec.dy * v.pos;

  return { x, y, rotation: rot };
}

// ─── DRAW VEHICLE ─────────────────────────────────────────────

function drawVehicle(ctx, images, vehicleType, x, y, rotation, size, vel) {
  const w = size?.w || 16;
  const h = size?.h || 32;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Shadow
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(2, 3, w * 0.45, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Headlight glow (when moving)
  if (vel > 10) {
    const glowAlpha = Math.min(vel / IDM.v0, 1) * 0.12;
    const grad = ctx.createRadialGradient(0, -h / 2 - 4, 0, 0, -h / 2 - 4, h * 0.6);
    grad.addColorStop(0, `rgba(255,240,200,${glowAlpha})`);
    grad.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-w, -h, w * 2, h);
  }

  // Sprite or fallback
  const img = images[vehicleType];
  if (img) {
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    // Fallback: rounded rectangle with color
    const fallbackColors = {
      Ambulance: '#ef4444',
      'Fire Engine': '#dc2626',
    };
    ctx.fillStyle = fallbackColors[vehicleType] || '#6b7280';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();
    // Windshield
    ctx.fillStyle = '#00000040';
    ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.25);
  }

  ctx.restore();
}

// ─── ROUNDABOUT ───────────────────────────────────────────────

function drawRoundabout(ctx, cx, cy, W, H, roads, signals, sim, images) {
  const radius = 95;
  const angleStep = (2 * Math.PI) / 5;
  const halfRoad = ROAD_WIDTH / 2;

  // Approach roads
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const ex = cx + Math.cos(angle) * (Math.max(W, H) * 0.5 + 30);
    const ey = cy + Math.sin(angle) * (Math.max(W, H) * 0.5 + 30);
    const sx = cx + Math.cos(angle) * (radius + 28);
    const sy = cy + Math.sin(angle) * (radius + 28);

    // Road shadow
    ctx.strokeStyle = '#00000030';
    ctx.lineWidth = ROAD_WIDTH + 6;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

    // Road surface
    ctx.strokeStyle = COLORS.road;
    ctx.lineWidth = ROAD_WIDTH;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

    // Center dashes
    ctx.strokeStyle = COLORS.centerSolid;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Roundabout ring
  ctx.strokeStyle = COLORS.road;
  ctx.lineWidth = ROAD_WIDTH * 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

  // Inner island
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius - 16);
  grad.addColorStop(0, '#1a3a20');
  grad.addColorStop(1, COLORS.grass);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, radius - ROAD_WIDTH * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#22c55e20';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Signals, labels
  for (let i = 0; i < 5 && i < roads.length; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const road = roads[i];
    const signalState = signals[road] || 'RED';

    // Signal light
    const lx = cx + Math.cos(angle) * (radius + 42);
    const ly = cy + Math.sin(angle) * (radius + 42);
    ctx.fillStyle = COLORS[signalState];
    ctx.shadowColor = COLORS[signalState];
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    const tlx = cx + Math.cos(angle) * (radius + 78);
    const tly = cy + Math.sin(angle) * (radius + 78);
    ctx.fillStyle = '#0b112080';
    const lbl = road;
    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    const tw = ctx.measureText(lbl).width + 12;
    ctx.beginPath();
    ctx.roundRect(tlx - tw / 2, tly - 10, tw, 20, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lbl, tlx, tly);
  }

  // Draw vehicles
  if (sim) {
    const farDist = Math.max(W, H) * 0.5 + 30;
    for (const v of sim.vehicles) {
      const angle = v.angle;
      const dist = farDist - v.pos;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      drawVehicle(ctx, images, v.type, x, y, angle + Math.PI / 2, v.size, v.vel);
    }
  }
}
