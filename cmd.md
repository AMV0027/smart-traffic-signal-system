# Backend (needs: pip install -r backend/requirements.txt)

cd backend && uvicorn main:app --reload --port 8000

# Frontend (already running on http://localhost:5173)

cd frotnend && npm run dev
