"""
AXION Backend — FastAPI Application
WebSocket + REST API for the AXION industrial monitoring demo.
"""
from __future__ import annotations
import asyncio
import json
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import simulation
import incident_manager
import ai_summarizer
import ai_simulator
from models import FactoryState, DemoCommand


# Tracks machines for which AI summary has already been requested (avoid duplicate calls)
_ai_requested_for: set[str] = set()

# Active WebSocket connections
_connections: set[WebSocket] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    simulation.initialize()
    incident_manager.initialize()
    asyncio.create_task(_simulation_loop())
    yield


app = FastAPI(title="AXION Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _connections.add(ws)
    try:
        while True:
            # Keep connection alive; all data is pushed from the simulation loop
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _connections.discard(ws)


async def _broadcast(payload: dict) -> None:
    dead = set()
    for ws in list(_connections):
        try:
            await ws.send_json(payload)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


# ─── Simulation Loop ────────────────────────────────────────────────────────────

async def _simulation_loop():
    global _ai_requested_for
    while True:
        await asyncio.sleep(0.5)  # 500ms tick

        # Advance simulation
        machine_states = simulation.tick()

        # Update incidents
        active_incidents = incident_manager.update(machine_states)

        # Determine system mode
        if any(inc.severity == "critical" for inc in active_incidents):
            system_mode = "incident"
        elif any(inc.severity == "warning" for inc in active_incidents):
            system_mode = "warning"
        else:
            system_mode = "normal"

        # Trigger AI summary for new incidents (non-blocking)
        for incident in active_incidents:
            rc_id = incident.root_cause_machine_id
            if rc_id not in _ai_requested_for and incident.ai_summary is None:
                _ai_requested_for.add(rc_id)
                asyncio.create_task(_fetch_ai_summary(incident))

        # Clear AI request tracking for resolved incidents
        active_root_ids = {inc.root_cause_machine_id for inc in active_incidents}
        _ai_requested_for &= active_root_ids

        # Build and broadcast factory state
        state = {
            "machines": {mid: s.model_dump() for mid, s in machine_states.items()},
            "incidents": [inc.model_dump() for inc in active_incidents],
            "system_mode": system_mode,
            "tick": simulation._tick,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cascade_status": simulation.get_cascade_status(),
        }
        await _broadcast(state)


async def _fetch_ai_summary(incident):
    """Fetch AI summary and push update to all clients when ready."""
    summary = await ai_summarizer.generate_incident_summary(incident)
    if summary:
        incident_manager.set_ai_summary(incident.root_cause_machine_id, summary)
        # The updated summary will appear in the next broadcast tick


# ─── REST API ───────────────────────────────────────────────────────────────────

@app.post("/api/demo/trigger")
async def trigger_cascade():
    """Trigger the cooling failure cascade scenario."""
    simulation.trigger_cascade()
    return {"status": "cascade_triggered"}


@app.post("/api/demo/reset")
async def reset_demo():
    """Reset simulation and incidents to initial state."""
    global _ai_requested_for
    simulation.reset_simulation()
    incident_manager.clear_all()
    _ai_requested_for = set()
    return {"status": "reset_complete"}


@app.get("/api/status")
async def get_status():
    """Health check and cascade status."""
    return {
        "status": "running",
        "cascade": simulation.get_cascade_status(),
        "active_connections": len(_connections),
    }


@app.get("/api/config/machines")
async def get_machine_configs():
    """Return machine configuration for the Architect view."""
    from dependency_engine import load_machine_configs
    configs = load_machine_configs()
    return {"machines": [c.model_dump() for c in configs.values()]}


@app.get("/api/incidents/history")
async def get_incident_history():
    """Return resolved incident history."""
    return {"incidents": [inc.model_dump() for inc in incident_manager.get_history()]}


# ─── AI Simulator (for architect-added custom machines without real datasource) ──

from fastapi import Body


@app.post("/api/ai/suggest-profile")
async def suggest_sensor_profile(payload: dict = Body(...)):
    """
    Generate plausible numerical profiles (min/max/unit/warn/crit/base) for a
    list of free-form sensor labels. Used to back custom machines that have no
    real connected data source — the front-end then simulates live values
    against the returned profile.

    Body: { "labels": ["outlet_temperature", "motor_vibration", ...] }
    """
    labels = payload.get("labels", []) if isinstance(payload, dict) else []
    if not isinstance(labels, list):
        labels = []
    labels = [str(l)[:80] for l in labels if l][:24]  # safety cap
    profiles = await ai_simulator.suggest_profiles(labels)
    return {"profiles": profiles}


# ─── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
