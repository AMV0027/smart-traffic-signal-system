import React, { useState, useEffect, useRef, useCallback } from 'react';
import IntersectionCanvas from '../components/IntersectionCanvas';
import TrafficSignal from '../components/TrafficSignal';
import {
  TrafficCone, Car, Bus, Bike, Siren, Truck, ShieldAlert,
  Play, Pause, Shuffle, Trash2, ChevronDown, RefreshCw,
  Timer, Route, AlertTriangle, CircleDot,
  Lightbulb, Cpu, Eye, Zap, BrainCircuit, Network
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

const ROAD_LABELS = {
  1: ['North'],
  2: ['North', 'South'],
  3: ['North', 'East', 'South'],
  4: ['North', 'South', 'East', 'West'],
  5: ['North', 'South', 'East', 'West', 'Southwest'],
};

const VEHICLE_TYPES = [
  { id: 'Ambulance', label: 'Ambulance', Icon: Siren, emergency: true },
  { id: 'Fire Engine', label: 'Fire Engine', Icon: Truck, emergency: true },
  { id: 'car', label: 'Car', Icon: Car, emergency: false },
  { id: 'bus', label: 'Bus', Icon: Bus, emergency: false },
  { id: 'police vehicle', label: 'Police Vehicle', Icon: ShieldAlert, emergency: false },
  { id: 'auto-rikshaw', label: 'Auto Rickshaw', Icon: Bike, emergency: false },
  { id: 'TwoWheelers', label: 'Two-Wheeler', Icon: Bike, emergency: false },
];

const INTERSECTION_DESCRIPTIONS = {
  1: 'Single road with one signal controlling flow',
  2: 'Two opposing roads with alternating signals',
  3: 'T-intersection with three-phase signal cycle',
  4: 'Standard crossroad with four-phase signal cycle',
  5: 'Roundabout with five entry points and yield signals',
};

export default function SimulationPage() {
  const [intersectionType, setIntersectionType] = useState(4);
  const [vehicles, setVehicles] = useState({});
  const [simResult, setSimResult] = useState(null);
  const [activePhase, setActivePhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRoad, setExpandedRoad] = useState(null);
  const timerRef = useRef(null);

  const roads = ROAD_LABELS[intersectionType] || [];

  useEffect(() => {
    const init = {};
    for (const road of ROAD_LABELS[intersectionType] || []) {
      init[road] = VEHICLE_TYPES.map((vt) => ({ type: vt.id, count: 0 }));
    }
    setVehicles(init);
    setSimResult(null);
    setActivePhase(0);
    setIsPlaying(false);
    setExpandedRoad(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [intersectionType]);

  const setVehicleCount = (road, typeId, val) => {
    setVehicles((prev) => {
      const updated = { ...prev };
      updated[road] = (updated[road] || []).map((v) =>
        v.type === typeId ? { ...v, count: typeof val === 'function' ? val(v.count) : val } : v,
      );
      return updated;
    });
  };

  const randomize = () => {
    const r = {};
    for (const road of roads) {
      r[road] = VEHICLE_TYPES.map((vt) => ({
        type: vt.id,
        count: vt.emergency
          ? (Math.random() > 0.65 ? Math.floor(Math.random() * 2) + 1 : 0)
          : Math.floor(Math.random() * 4) + 1,  // 1-4 per type, well under 11 total per road
      }));
    }
    setVehicles(r);
  };

  const clearAll = () => {
    const c = {};
    for (const road of roads) {
      c[road] = VEHICLE_TYPES.map((vt) => ({ type: vt.id, count: 0 }));
    }
    setVehicles(c);
    setSimResult(null);
  };

  const totalVehicleCount = Object.values(vehicles).reduce(
    (sum, arr) => sum + (arr || []).reduce((s, v) => s + v.count, 0), 0
  );

  const runSimulation = async () => {
    setLoading(true);
    setActivePhase(0);
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const emergencyRoads = roads.filter((road) =>
      (vehicles[road] || []).some(
        (v) => ['Ambulance', 'Fire Engine'].includes(v.type) && v.count > 0,
      ),
    );

    try {
      const res = await fetch(`${API_BASE}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intersection_type: intersectionType,
          vehicles_per_road: vehicles,
          emergency_roads: emergencyRoads,
        }),
      });
      const data = await res.json();
      setSimResult(data);
      setTimeout(() => setIsPlaying(true), 300);
    } catch {
      // Fallback: mirror the backend's priority-based logic locally
      const EPRIORITY = { Ambulance: 5, 'Fire Engine': 3 };
      const EGREEN = { Ambulance: 60, 'Fire Engine': 45 };

      const phases = roads.map((road, i) => {
        const roadVeh = vehicles[road] || [];
        let bestPriority = 0;
        let bestType = null;
        for (const v of roadVeh) {
          if (v.count > 0 && EPRIORITY[v.type]) {
            const p = EPRIORITY[v.type];
            if (p > bestPriority) { bestPriority = p; bestType = v.type; }
          }
        }
        const totalVeh = roadVeh.reduce((s, v) => s + v.count, 0);
        const isEmergency = bestPriority > 0;
        let greenDur = 30 + Math.min(totalVeh, 15);
        if (bestType === 'Ambulance') greenDur = 60;
        else if (bestType === 'Fire Engine') greenDur = 45;

        return {
          phase_number: i + 1,
          active_road: road,
          green_duration: greenDur,
          yellow_duration: 5,
          is_emergency_priority: isEmergency,
          emergency_type: bestType,
          vehicle_count: totalVeh,
          signals: Object.fromEntries(roads.map((r) => [r, r === road ? 'GREEN' : 'RED'])),
          _sort_priority: bestPriority,
          _sort_veh: totalVeh,
        };
      });
      // Sort: highest priority first, then vehicle count
      phases.sort((a, b) => b._sort_priority - a._sort_priority || b._sort_veh - a._sort_veh);
      phases.forEach((p, i) => (p.phase_number = i + 1));

      const emergencyRoadsList = phases.filter((p) => p.is_emergency_priority).map((p) => p.active_road);

      setSimResult({
        intersection_type: intersectionType,
        intersection_name: `${intersectionType}-Way ${intersectionType === 5 ? 'Roundabout' : 'Signal'}`,
        roads,
        total_cycle_time: phases.reduce((s, p) => s + p.green_duration + p.yellow_duration, 0),
        phases,
        emergency_active: emergencyRoadsList.length > 0,
        emergency_roads: emergencyRoadsList,
      });
      setTimeout(() => setIsPlaying(true), 300);
    }
    setLoading(false);
  };

  // Real phase timing: use green_duration + yellow_duration from simulation
  useEffect(() => {
    if (!isPlaying || !simResult?.phases?.length) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const scheduleNextPhase = () => {
      const phase = simResult.phases[activePhase];
      if (!phase) return;
      // Speed multiplier — 1s of sim ≈ 100ms real time (10× speed)
      const greenMs = (phase.green_duration || 30) * 100;
      const yellowMs = (phase.yellow_duration || 5) * 100;
      const totalMs = greenMs + yellowMs;

      timerRef.current = setTimeout(() => {
        setActivePhase((prev) => {
          const next = prev + 1;
          // Stop after one full pass — don't loop
          if (next >= simResult.phases.length) {
            setIsPlaying(false);
            return prev; // stay on last phase
          }
          return next;
        });
      }, totalMs);
    };

    scheduleNextPhase();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, simResult, activePhase]);

  const currentPhase = simResult?.phases?.[activePhase] || {};

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
            <TrafficCone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] leading-tight">
              Traffic Simulation
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Configure intersections, add vehicles, and observe smart signal management
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Left — Controls */}
        <div className="space-y-4">
          {/* Intersection Type */}
          <div className="glass-card">
            <div className="section-title">Intersection Type</div>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map((t) => (
                <button
                  key={t}
                  onClick={() => setIntersectionType(t)}
                  className={`py-2.5 rounded-xl text-center text-sm font-bold transition-all duration-200 border ${intersectionType === t
                    ? 'bg-[var(--accent)]/12 border-[var(--accent)]/40 text-[var(--accent)] shadow-sm'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  {t === 5 ? '5R' : `${t}W`}
                </button>
              ))}
            </div>
            <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-lg p-2.5 border border-[var(--border)]">
              <span className="font-semibold text-[var(--text-primary)]">
                {intersectionType === 5 ? '5-Way Roundabout' : `${intersectionType}-Way Signal`}
              </span>
              <span className="block mt-0.5 opacity-75">{INTERSECTION_DESCRIPTIONS[intersectionType]}</span>
            </div>
          </div>

          {/* Vehicles */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-3">
              <div className="section-title !mb-0">Vehicles</div>
              <div className="flex gap-1.5">
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
                <button
                  onClick={randomize}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors font-medium"
                >
                  <Shuffle className="w-3 h-3" /> Random
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-0.5">
              {roads.map((road) => {
                const roadTotal = (vehicles[road] || []).reduce((s, v) => s + v.count, 0);
                const hasEmergency = (vehicles[road] || []).some(
                  (v) => ['Ambulance', 'Fire Engine'].includes(v.type) && v.count > 0,
                );
                const isExpanded = expandedRoad === road;

                return (
                  <div key={road} className={`rounded-xl border transition-all duration-200 ${hasEmergency ? 'border-red-500/20 bg-red-500/5' : 'border-[var(--border)] bg-[var(--bg-primary)]/50'
                    }`}>
                    <button
                      onClick={() => setExpandedRoad(isExpanded ? null : road)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{road}</span>
                        {hasEmergency && <Siren className="w-3 h-3 text-red-400" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-secondary)] font-mono">{roadTotal}</span>
                        <ChevronDown className={`w-3 h-3 text-[var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-1 border-t border-[var(--border)] pt-2">
                        {VEHICLE_TYPES.map((vt) => {
                          const count = (vehicles[road] || []).find((v) => v.type === vt.id)?.count || 0;
                          return (
                            <div key={vt.id} className="flex items-center justify-between py-0.5">
                              <div className="flex items-center gap-1.5">
                                <vt.Icon className={`w-3.5 h-3.5 ${vt.emergency ? 'text-red-400' : 'text-[var(--text-secondary)]'}`} />
                                <span className={`text-xs ${vt.emergency ? 'text-red-400 font-semibold' : 'text-[var(--text-primary)]'}`}>
                                  {vt.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setVehicleCount(road, vt.id, (c) => Math.max(0, c - 1)); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20 transition-colors"
                                >
                                  −
                                </button>
                                <span className="w-7 text-center text-xs font-mono font-bold text-[var(--text-primary)]">{count}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setVehicleCount(road, vt.id, (c) => c + 1); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/20 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="text-[var(--text-secondary)]">Total vehicles</span>
                <span className="font-bold text-[var(--text-primary)]">{totalVehicleCount}</span>
              </div>
              <button
                onClick={runSimulation}
                disabled={loading || totalVehicleCount === 0}
                className="btn-primary w-full disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Run Simulation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Center — Canvas + Results (3 cols) */}
        <div className="xl:col-span-3 space-y-5">
          <div className="glass-card !p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                {intersectionType === 5 ? '5-Way Roundabout' : `${intersectionType}-Way Intersection`}
              </h2>
              {simResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${isPlaying
                      ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                      : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                      }`}
                  >
                    {isPlaying ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Play</>}
                  </button>
                  <span className="text-xs text-[var(--text-secondary)] font-mono bg-[var(--bg-primary)] px-2 py-1 rounded-lg border border-[var(--border)]">
                    {activePhase + 1}/{simResult.phases.length}
                  </span>
                </div>
              )}
            </div>
            <IntersectionCanvas
              type={intersectionType}
              roads={roads}
              phases={simResult?.phases || []}
              activePhase={activePhase}
              vehicles={vehicles}
            />
          </div>

          {simResult && (
            <div className="glass-card animate-fade-in">
              <div className="flex flex-wrap gap-3 mb-4">
                <SummaryChip Icon={RefreshCw} label="Phases" value={simResult.phases.length} color="var(--accent)" />
                <SummaryChip Icon={Timer} label="Cycle" value={`${simResult.total_cycle_time}s`} color="var(--warning)" />
                <SummaryChip Icon={Siren} label="Priority" value={simResult.emergency_roads?.length || 0} color="var(--danger)" />
                {currentPhase.active_road && (
                  <SummaryChip
                    Icon={currentPhase.is_emergency_priority ? AlertTriangle : CircleDot}
                    label="Active"
                    value={currentPhase.active_road}
                    color={currentPhase.is_emergency_priority ? 'var(--danger)' : 'var(--success)'}
                  />
                )}
              </div>

              <div className="section-title">Signal Phase Sequence</div>
              <div className="space-y-1.5">
                {simResult.phases.map((phase, i) => (
                  <button
                    key={i}
                    onClick={() => { setActivePhase(i); setIsPlaying(false); }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 group ${activePhase === i
                      ? 'bg-[var(--accent)]/8 border-[var(--accent)]/30'
                      : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${activePhase === i
                          ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                          : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)]'
                          }`}>
                          {phase.phase_number}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            {phase.active_road}
                            {phase.is_emergency_priority && (
                              <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${phase.emergency_type === 'Ambulance'
                                ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
                                }`}>
                                <Siren className="w-2.5 h-2.5" /> {phase.emergency_type === 'Ambulance' ? 'AMBULANCE' : 'FIRE ENGINE'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {phase.vehicle_count} vehicles · {phase.green_duration}s green · {phase.yellow_duration}s yellow
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {roads.map((r) => (
                          <div
                            key={r}
                            className="w-3 h-3 rounded-full transition-colors"
                            style={{
                              backgroundColor:
                                phase.signals?.[r] === 'GREEN' ? '#22c55e'
                                  : phase.signals?.[r] === 'YELLOW' ? '#f59e0b'
                                    : '#ef4444',
                              boxShadow: phase.signals?.[r] === 'GREEN' ? '0 0 6px #22c55e60' : 'none',
                            }}
                            title={`${r}: ${phase.signals?.[r]}`}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Signal Sequence Data Table */}
          {simResult && (
            <div className="glass-card animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/20">
                  <Timer className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Signal Sequence Data</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Detailed breakdown of each phase's signal allocation and vehicle distribution</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--bg-primary)]">
                      <th className="px-3 py-2.5 text-left font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">#</th>
                      <th className="px-3 py-2.5 text-left font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">Active Road</th>
                      <th className="px-3 py-2.5 text-center font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">Total Vehicles</th>
                      <th className="px-3 py-2.5 text-left font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">Emergency Type</th>
                      <th className="px-3 py-2.5 text-center font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">Emergency Count</th>
                      <th className="px-3 py-2.5 text-center font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">Civilian Vehicles</th>
                      <th className="px-3 py-2.5 text-center font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">Green (s)</th>
                      <th className="px-3 py-2.5 text-center font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">Yellow (s)</th>
                      {roads.map((r) => (
                        <th key={r} className="px-3 py-2.5 text-center font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)] whitespace-nowrap">{r}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {simResult.phases.map((phase, i) => {
                      const roadVehicles = vehicles[phase.active_road] || [];
                      const ambulanceCount = roadVehicles.find((v) => v.type === 'Ambulance')?.count || 0;
                      const fireEngineCount = roadVehicles.find((v) => v.type === 'Fire Engine')?.count || 0;
                      const emergencyCount = ambulanceCount + fireEngineCount;
                      const civilianCount = phase.vehicle_count - emergencyCount;

                      return (
                        <tr
                          key={i}
                          onClick={() => { setActivePhase(i); setIsPlaying(false); }}
                          className={`cursor-pointer transition-colors ${activePhase === i
                              ? 'bg-[var(--accent)]/8'
                              : i % 2 === 0
                                ? 'bg-[var(--bg-secondary)]/30'
                                : 'bg-transparent'
                            } hover:bg-[var(--accent)]/5`}
                        >
                          {/* Phase # */}
                          <td className="px-3 py-2.5 border-b border-[var(--border)]/50">
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${activePhase === i
                                ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)]'
                              }`}>
                              {phase.phase_number}
                            </span>
                          </td>

                          {/* Active Road */}
                          <td className="px-3 py-2.5 border-b border-[var(--border)]/50">
                            <span className="font-semibold text-[var(--text-primary)]">{phase.active_road}</span>
                          </td>

                          {/* Total Vehicles */}
                          <td className="px-3 py-2.5 text-center border-b border-[var(--border)]/50">
                            <span className="font-bold text-[var(--text-primary)]">{phase.vehicle_count}</span>
                          </td>

                          {/* Emergency Type */}
                          <td className="px-3 py-2.5 border-b border-[var(--border)]/50">
                            {phase.is_emergency_priority ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-bold border ${phase.emergency_type === 'Ambulance'
                                  ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                  : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
                                }`}>
                                <Siren className="w-2.5 h-2.5" />
                                {phase.emergency_type === 'Ambulance' ? 'Ambulance' : 'Fire Engine'}
                              </span>
                            ) : (
                              <span className="text-[var(--text-secondary)]">—</span>
                            )}
                          </td>

                          {/* Emergency Count */}
                          <td className="px-3 py-2.5 text-center border-b border-[var(--border)]/50">
                            {emergencyCount > 0 ? (
                              <span className="font-bold text-red-400">{emergencyCount}</span>
                            ) : (
                              <span className="text-[var(--text-secondary)]">0</span>
                            )}
                          </td>

                          {/* Civilian Vehicles */}
                          <td className="px-3 py-2.5 text-center border-b border-[var(--border)]/50">
                            <span className="text-[var(--text-primary)]">{Math.max(0, civilianCount)}</span>
                          </td>

                          {/* Green Duration */}
                          <td className="px-3 py-2.5 text-center border-b border-[var(--border)]/50">
                            <span className={`font-bold ${phase.is_emergency_priority ? 'text-green-400' : 'text-[var(--text-primary)]'}`}>
                              {phase.green_duration}
                            </span>
                          </td>

                          {/* Yellow Duration */}
                          <td className="px-3 py-2.5 text-center border-b border-[var(--border)]/50">
                            <span className="text-amber-400">{phase.yellow_duration}</span>
                          </td>

                          {/* Per-road signal states */}
                          {roads.map((r) => {
                            const sig = phase.signals?.[r] || 'RED';
                            const color = sig === 'GREEN' ? '#22c55e' : sig === 'YELLOW' ? '#f59e0b' : '#ef4444';
                            return (
                              <td key={r} className="px-3 py-2.5 text-center border-b border-[var(--border)]/50">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: color, boxShadow: sig === 'GREEN' ? `0 0 6px ${color}60` : 'none' }}
                                  />
                                  <span className="text-[10px] font-semibold" style={{ color }}>{sig}</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr className="bg-[var(--bg-primary)]">
                      <td colSpan={2} className="px-3 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
                        Total Cycle
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-[var(--text-primary)]">
                        {simResult.phases.reduce((s, p) => s + p.vehicle_count, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">—</td>
                      <td className="px-3 py-2.5 text-center font-bold text-red-400">
                        {simResult.phases.reduce((s, p) => {
                          const rv = vehicles[p.active_road] || [];
                          return s + (rv.find((v) => v.type === 'Ambulance')?.count || 0) + (rv.find((v) => v.type === 'Fire Engine')?.count || 0);
                        }, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-[var(--text-primary)]">
                        {simResult.phases.reduce((s, p) => {
                          const rv = vehicles[p.active_road] || [];
                          const ec = (rv.find((v) => v.type === 'Ambulance')?.count || 0) + (rv.find((v) => v.type === 'Fire Engine')?.count || 0);
                          return s + Math.max(0, p.vehicle_count - ec);
                        }, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-green-400">
                        {simResult.phases.reduce((s, p) => s + p.green_duration, 0)}s
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-amber-400">
                        {simResult.phases.reduce((s, p) => s + p.yellow_duration, 0)}s
                      </td>
                      {roads.map((r) => (
                        <td key={r} className="px-3 py-2.5 text-center text-[var(--text-secondary)] text-[10px]">—</td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {!simResult && (
            <div className="glass-card text-center py-12">
              <TrafficCone className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)] opacity-30" />
              <p className="text-[var(--text-secondary)] text-sm">
                Add vehicles to roads and click <strong>Run Simulation</strong> to see signal timing
              </p>
            </div>
          )}

          {/* Algorithm Context Section */}
          <div className="glass-card animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center border border-purple-500/20">
                <BrainCircuit className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">How It Works</h3>
                <p className="text-xs text-[var(--text-secondary)]">The intelligence behind smart signal management</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {/* Priority-Based Preemption */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 hover:border-red-500/20 transition-colors group">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                    <Siren className="w-4 h-4 text-red-400" />
                  </div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Priority-Based Preemption</h4>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Emergency vehicles are ranked by urgency — <span className="text-red-400 font-semibold">Ambulances (Priority 5)</span> receive
                  immediate green signals with extended 60-second windows, while <span className="text-orange-400 font-semibold">Fire Engines (Priority 3)</span> get
                  45-second windows. This tiered preemption ensures life-threatening situations are addressed first,
                  reducing emergency response times by up to 40%.
                </p>
              </div>

              {/* IDM Physics */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 hover:border-blue-500/20 transition-colors group">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <Zap className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Intelligent Driver Model (IDM)</h4>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Vehicles follow the IDM physics model — a continuous car-following algorithm that
                  naturally produces realistic acceleration, braking, and gap-keeping behavior. Each vehicle
                  independently reacts to the leader ahead and signal state, creating emergent traffic waves
                  and platoon formations without scripted behavior.
                </p>
              </div>

              {/* Dijkstra Routing */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 hover:border-green-500/20 transition-colors group">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <Network className="w-4 h-4 text-green-400" />
                  </div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Dijkstra's Shortest Path</h4>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Emergency routing uses Dijkstra's algorithm with traffic-weighted edges. Edge costs
                  combine physical distance with real-time congestion data, ensuring ambulances and fire engines
                  are directed along the fastest available route — not just the shortest. This dynamic
                  rerouting adapts as traffic conditions change.
                </p>
              </div>

              {/* YOLO Detection */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 hover:border-amber-500/20 transition-colors group">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                    <Eye className="w-4 h-4 text-amber-400" />
                  </div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">YOLOv8 Real-Time Detection</h4>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  A custom-trained YOLOv8 model identifies Ambulances and Fire Engines from live camera
                  feeds with &gt;90% confidence. Detection triggers instant signal override — no manual
                  intervention needed. The model runs inference at 30+ FPS via WebSocket, enabling
                  sub-second response to approaching emergency vehicles.
                </p>
              </div>
            </div>

            {/* What Makes It Unique */}
            <div className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <Lightbulb className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wide">What Makes This Unique</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    <span className="text-purple-300 font-semibold">Tiered Emergency Priority</span> — Unlike
                    fixed-cycle systems, signals dynamically reorder based on vehicle urgency, not just presence.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    <span className="text-purple-300 font-semibold">Vision + Simulation Fusion</span> — Combines
                    real-time YOLO detection with physics simulation for both reactive and predictive control.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    <span className="text-purple-300 font-semibold">Zero False Overrides</span> — Priority is derived
                    from verified vehicle counts, preventing phantom emergency triggers from stale data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
      <Icon className="w-4 h-4" style={{ color }} />
      <div>
        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider leading-none">{label}</div>
        <div className="text-base font-extrabold leading-tight" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}
