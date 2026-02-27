import React, { useState, useCallback } from 'react';
import VideoFeed from '../components/VideoFeed';
import TrafficSignal from '../components/TrafficSignal';
import {
  Car, Siren, BarChart3, Zap, Target, ClipboardList, AlertTriangle
} from 'lucide-react';

export default function VisionPage() {
  const [signal, setSignal] = useState({ signal: 'RED', reason: '', override: false, emergency_vehicles: [] });
  const [stats, setStats] = useState({ total_vehicles: 0, class_counts: {}, inference_ms: 0 });
  const [detections, setDetections] = useState([]);
  const [history, setHistory] = useState([]);

  const handleDetections = useCallback((dets, sig, st) => {
    setDetections(dets);
    setSignal(sig);
    setStats(st);

    if (dets.length > 0) {
      const ts = new Date().toLocaleTimeString();
      const emergency = dets.filter((d) => d.is_emergency);
      setHistory((prev) => [
        { ts, count: dets.length, emergency: emergency.length, classes: st.class_counts },
        ...prev.slice(0, 24),
      ]);
    }
  }, []);

  const emergencyCount = detections.filter((d) => d.is_emergency).length;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Hero Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] leading-tight">
              Vision Model Performance
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Real-time YOLO emergency vehicle detection with automatic signal override
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Left — Video Feed (3 cols) */}
        <div className="xl:col-span-3 space-y-5">
          {/* Video */}
          <div className="glass-card !p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Live Camera Feed
                </h2>
              </div>
              {stats.inference_ms > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)]">
                  <Zap className="w-3 h-3" /> {stats.inference_ms}ms
                </span>
              )}
            </div>
            <VideoFeed onDetections={handleDetections} active={true} />
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
            <StatCard
              Icon={Car}
              label="Total Vehicles"
              value={stats.total_vehicles || 0}
              color="var(--accent)"
              bg="rgba(56,189,248,0.08)"
            />
            <StatCard
              Icon={Siren}
              label="Emergency"
              value={emergencyCount}
              color="var(--danger)"
              bg="rgba(239,68,68,0.08)"
              highlight={emergencyCount > 0}
            />
            <StatCard
              Icon={BarChart3}
              label="Classes Found"
              value={Object.keys(stats.class_counts || {}).length}
              color="var(--warning)"
              bg="rgba(245,158,11,0.08)"
            />
            <StatCard
              Icon={Zap}
              label="Inference"
              value={`${stats.inference_ms || 0}ms`}
              color="var(--success)"
              bg="rgba(34,197,94,0.08)"
            />
          </div>

          {/* Detected Classes — horizontal chips */}
          {Object.keys(stats.class_counts || {}).length > 0 && (
            <div className="glass-card">
              <div className="section-title">Detected Classes</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.class_counts || {}).map(([cls, count]) => {
                  const isEmergency = ['Ambulance', 'Fire Engine'].includes(cls);
                  return (
                    <div
                      key={cls}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${isEmergency
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-[var(--accent)]/8 border-[var(--accent)]/15 text-[var(--accent)]'
                        }`}
                    >
                      {isEmergency && <Siren className="w-3.5 h-3.5" />}
                      <span>{cls}</span>
                      <span className="font-mono text-xs opacity-60">×{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5 stagger-children">
          {/* Traffic Signal */}
          <div className={`glass-card flex flex-col items-center py-8 transition-all duration-500 ${signal.override ? '!border-green-500/30 shadow-lg shadow-green-500/10' : ''
            }`}>
            <div className="section-title text-center">Traffic Signal</div>
            <TrafficSignal signal={signal.signal} size="lg" override={signal.override} />
            <div className={`mt-5 px-4 py-2 rounded-xl text-xs font-medium text-center w-full ${signal.override
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)]'
              }`}>
              {signal.reason || 'Waiting for detections...'}
            </div>
          </div>

          {/* How It Works */}
          <div className="glass-card">
            <div className="section-title">How It Works</div>
            <div className="space-y-3 text-xs text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>Camera captures frames and sends to YOLO model via WebSocket</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Model detects vehicles and classifies them (7 classes)</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <span>If Ambulance or Fire Engine detected → signal turns <span className="text-green-400 font-bold">GREEN</span></span>
              </div>
            </div>
          </div>

          {/* Detection Log */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-3">
              <div className="section-title !mb-0">Activity Log</div>
              {history.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                  {history.length} events
                </span>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {history.length === 0 ? (
                <div className="py-6 text-center">
                  <ClipboardList className="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)] opacity-30" />
                  <p className="text-xs text-[var(--text-secondary)]">No detections yet</p>
                </div>
              ) : (
                history.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg ${i === 0 ? 'bg-[var(--accent)]/5' : ''
                      }`}
                  >
                    <span className="text-[var(--text-secondary)] font-mono text-[10px] shrink-0">{entry.ts}</span>
                    <span className="text-[var(--text-primary)]">{entry.count} vehicle{entry.count !== 1 ? 's' : ''}</span>
                    {entry.emergency > 0 && (
                      <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400">
                        <Siren className="w-2.5 h-2.5" />{entry.emergency}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ Icon, label, value, color, bg, highlight = false }) {
  return (
    <div className={`glass-card flex items-center gap-3 !py-4 !px-4 transition-all duration-300 ${highlight ? '!border-red-500/30 shadow-lg shadow-red-500/10' : ''
      }`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <div className="text-xl font-extrabold leading-none" style={{ color }}>{value}</div>
        <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 uppercase tracking-wider font-medium">{label}</div>
      </div>
    </div>
  );
}
