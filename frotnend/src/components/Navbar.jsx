import React from 'react';
import { NavLink } from 'react-router-dom';
import { ScanEye, TrafficCone } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Vision Detection', Icon: ScanEye },
  { to: '/simulation', label: 'Traffic Simulation', Icon: TrafficCone },
];

export default function Navbar() {
  return (
    <nav className="w-full border-b border-[var(--border)] bg-[var(--bg-secondary)]/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Brand */}
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-blue-600 flex items-center justify-center text-white font-extrabold text-xs shadow-lg shadow-[var(--accent)]/20 group-hover:shadow-[var(--accent)]/40 transition-shadow">
            ST
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-[var(--text-primary)] leading-none">
              Smart Traffic
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              Management System
            </div>
          </div>
        </NavLink>

        {/* Nav Links */}
        <div className="flex items-center gap-1.5">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
