"""
Vercel serverless entry-point for the AXION FastAPI backend.
Uses a2wsgi to bridge ASGI (FastAPI) → WSGI (Vercel Python runtime).
"""
import sys
import os

# Make backend modules importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Pre-initialise data structures so the first request doesn't hit cold-start errors
try:
    import simulation
    import incident_manager
    simulation.initialize()
    incident_manager.initialize()
except Exception:
    pass

from main import app as _fastapi_app          # noqa: E402
from a2wsgi import ASGIMiddleware             # noqa: E402

# Vercel Python runtime expects a WSGI-compatible callable named `app`
app = ASGIMiddleware(_fastapi_app)
