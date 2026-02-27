import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import VisionPage from './pages/VisionPage';
import SimulationPage from './pages/SimulationPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<VisionPage />} />
            <Route path="/simulation" element={<SimulationPage />} />
          </Routes>
        </main>
        <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--text-secondary)]">
          Smart Traffic Management System · Powered by YOLOv8 & Dijkstra
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;