"""Smart Traffic Management System — FastAPI Backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.detection import router as detection_router
from routers.simulation import router as simulation_router

app = FastAPI(
    title="Smart Traffic Management System",
    description="YOLO-based emergency vehicle detection & traffic simulation API",
    version="1.0.0",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detection_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "message": "Smart Traffic Management API"}
