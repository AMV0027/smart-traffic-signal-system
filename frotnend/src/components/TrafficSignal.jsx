import React from 'react';

/**
 * Animated traffic signal with red / yellow / green lights.
 * Props:
 *   signal   – "RED" | "YELLOW" | "GREEN"
 *   size     – "sm" | "md" | "lg" (default "md")
 *   label    – optional label text
 *   override – boolean, show override badge
 */
export default function TrafficSignal({ signal = 'RED', size = 'md', label, override = false }) {
  const sizes = {
    sm: { light: 'w-8 h-8', box: 'p-2 gap-2 w-16', text: 'text-xs' },
    md: { light: 'w-14 h-14', box: 'p-4 gap-3 w-24', text: 'text-sm' },
    lg: { light: 'w-20 h-20', box: 'p-6 gap-4 w-36', text: 'text-base' },
  };
  const s = sizes[size] || sizes.md;

  const lights = [
    { color: 'red', state: signal === 'RED' },
    { color: 'yellow', state: signal === 'YELLOW' },
    { color: 'green', state: signal === 'GREEN' },
  ];

  return (
    <div className="flex flex-col items-center gap-3 animate-fade-in">
      {/* Signal Housing */}
      <div
        className={`flex flex-col items-center ${s.box} rounded-2xl bg-[#111827] border-2 border-[var(--border)] shadow-2xl`}
      >
        {lights.map(({ color, state }) => (
          <div
            key={color}
            className={`${s.light} rounded-full transition-all duration-500 ${state
                ? `signal-${color} signal-light active`
                : 'signal-off signal-light'
              }`}
          />
        ))}
      </div>

      {/* Label */}
      {label && (
        <span className={`${s.text} text-[var(--text-secondary)] font-medium`}>
          {label}
        </span>
      )}

      {/* Override Badge */}
      {override && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--success)]/15 border border-[var(--success)]/30">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <span className="text-xs font-semibold text-[var(--success)]">PRIORITY OVERRIDE</span>
        </div>
      )}
    </div>
  );
}
