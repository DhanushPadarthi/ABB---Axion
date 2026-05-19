"""
AI Summarizer — Gemini API integration with rule-based fallback.
Called once per new incident (not on every tick).
Non-blocking: fallback rule summary shown instantly; AI enriches it asynchronously.
"""
from __future__ import annotations
import os
import json
import asyncio
from models import Incident

try:
    from google import genai
    _GEMINI_AVAILABLE = True
except ImportError:
    genai = None  # type: ignore
    _GEMINI_AVAILABLE = False

_client = None


def _configure():
    global _client
    api_key = os.getenv("GEMINI_API_KEY", "")
    if _GEMINI_AVAILABLE and api_key:
        if _client is None:
            _client = genai.Client(api_key=api_key)
        return True
    return False


async def generate_incident_summary(incident: Incident) -> str | None:
    """
    Generate an AI summary for the given incident.
    Returns None if AI is unavailable or fails — caller uses rule_summary as fallback.
    """
    if not _configure():
        return None

    context = _build_context(incident)
    prompt = _build_prompt(context)

    try:
        # Run blocking call in thread pool to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: _client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
            )
        )
        raw = response.text.strip()
        # Validate: must be non-empty and not start with JSON/code block
        if raw and not raw.startswith("```") and len(raw) < 800:
            return raw
        return None
    except Exception as e:
        print(f"[AI Summarizer] Gemini call failed: {e}")
        return None


def _build_context(incident: Incident) -> dict:
    affected_summary = [
        {"machine": m.machine_name, "status": m.health.value, "description": m.description}
        for m in incident.affected_machines
    ]
    return {
        "incident_title": incident.title,
        "root_cause_machine": incident.root_cause_machine_name,
        "root_cause_metric": incident.root_cause_metric,
        "severity": incident.severity,
        "throughput_impact_pct": incident.throughput_impact_pct,
        "affected_machines": affected_summary,
        "recommended_actions": incident.recommended_actions[:3],
        "started_at": incident.started_at,
    }


def _build_prompt(context: dict) -> str:
    return f"""You are an industrial operations AI assistant for AXION, a smart factory monitoring platform.

An incident has been detected in a beverage bottling plant. Based on the structured context below, write a 2-3 sentence plain-language operational summary for the plant operator. 

RULES:
- Use plain English. No technical jargon that an operator would not understand.
- Do not invent metric values or machine behaviors not present in the context.
- Do not use bullet points. Write flowing sentences.
- End with one sentence about urgency and consequence if not addressed.
- Maximum 100 words.

INCIDENT CONTEXT:
{json.dumps(context, indent=2)}

Write only the summary. No headers, no bullet points, no explanation of what you are doing."""
