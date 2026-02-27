# Smart Traffic Management System

A dynamic, intelligent traffic signal management and simulation system that prioritizes emergency vehicles (Ambulances and Fire Engines) using computer vision (YOLOv8) and a physics-based traffic simulation (Intelligent Driver Model).

## Key Features

- **Priority-Based Preemption:** Ambulances (Priority 5) receive 60-second green signals, and Fire Engines (Priority 3) receive 45-second green signals. Priority is dynamically calculated based on live vehicle counts.
- **Intelligent Driver Model (IDM):** Realistic vehicle physics and car-following behaviors, including acceleration, braking, and gap-keeping.
- **Dijkstra's Shortest Path:** Traffic-weighted routing ensuring emergency vehicles take the fastest path considering live congestion.
- **YOLOv8 Real-Time Detection:** Live camera feed integration identifying emergency vehicles to trigger signal override automatically.

## Prerequisites

Before running the project, ensure you have the following installed:

- **Python 3.9+** (for the backend)
- **Node.js 18+** (for the frontend and Vite)

---

## 🚀 How to Run the Project

The project consists of two main parts: a **FastAPI Python Backend** and a **React/Vite Frontend**. Both servers must be running simultaneously for the full experience.

### 1. Run the Backend (Python / FastAPI)

The backend handles the simulation logic, YOLO interference, and signal priority generation.

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment (recommended):

   ```bash
   python -m venv .venv

   # Windows:
   .venv\Scripts\activate

   # macOS/Linux:
   source .venv/bin/activate
   ```

3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend API will now be running at `http://localhost:8000`.

### 2. Run the Frontend (React / Vite)

The frontend is a dynamic dashboard built with React, TailwindCSS, and Lucide icons to visualize intersections and control the simulation.

1. Open a **new** terminal window and navigate to the `frotnend` directory:
   ```bash
   cd frotnend
   ```
2. Install the required Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the URL provided in the terminal (usually `http://localhost:5173`).

---

## Technical Stack

- **Frontend:** React, Vite, TailwindCSS (v4), Canvas API (for intersection rendering).
- **Backend:** Python, FastAPI, Ultralytics YOLOv8, OpenCV, NumPy.
- **Algorithms:** IDM (Intelligent Driver Model) for physics, Dijkstra for routing.
