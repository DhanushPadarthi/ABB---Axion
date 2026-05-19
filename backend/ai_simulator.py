"""
AI Simulator — Infers realistic value ranges for arbitrary sensor labels.

Used to back custom machines that have no real connected data source: when an
Architect adds a new machine with sensors like "outlet_temperature" or
"motor_vibration", this module synthesises a plausible numerical profile so the
front-end can simulate live telemetry against it.

Strategy:
  1. Local heuristic keyword match (always-on, instant, no API).
  2. Optional Gemini enrichment (if GEMINI_API_KEY is configured) to produce
     a more nuanced profile in batch.

The heuristic always succeeds — Gemini is purely an enhancement.
"""
from __future__ import annotations
import os
import re
import json
import asyncio
from typing import Iterable

try:
    from google import genai
    _GEMINI_AVAILABLE = True
except ImportError:
    genai = None  # type: ignore
    _GEMINI_AVAILABLE = False

_client = None


def _configure() -> bool:
    global _client
    api_key = os.getenv("GEMINI_API_KEY", "")
    if _GEMINI_AVAILABLE and api_key:
        if _client is None:
            _client = genai.Client(api_key=api_key)
        return True
    return False


# ─── Heuristic profile rules ───────────────────────────────────────────────────
# Order matters: first match wins.
_RULES: list[tuple[re.Pattern, dict]] = [
    (re.compile(r"temp|heat", re.I),
     {"min": 20, "max": 95, "unit": "°C", "kind": "line", "warn": 80, "crit": 90}),
    (re.compile(r"press|psi|bar", re.I),
     {"min": 0.5, "max": 6.0, "unit": "bar", "kind": "gauge", "warn": 5.0, "crit": 5.5}),
    (re.compile(r"vibrat|shock", re.I),
     {"min": 0.2, "max": 9.0, "unit": "mm/s", "kind": "line", "warn": 6.0, "crit": 8.0}),
    (re.compile(r"speed|rpm|motor|rotation", re.I),
     {"min": 800, "max": 3200, "unit": "RPM", "kind": "gauge", "warn": 2800, "crit": 3100}),
    (re.compile(r"flow|rate|throughput", re.I),
     {"min": 4, "max": 22, "unit": "L/s", "kind": "line", "warn": 6, "crit": 4.5}),
    (re.compile(r"level|fill|tank|inventory", re.I),
     {"min": 10, "max": 95, "unit": "%", "kind": "bar", "warn": 88, "crit": 93}),
    (re.compile(r"humid|moist", re.I),
     {"min": 25, "max": 75, "unit": "%RH", "kind": "line", "warn": 70, "crit": 73}),
    (re.compile(r"volt", re.I),
     {"min": 200, "max": 245, "unit": "V", "kind": "line", "warn": 238, "crit": 242}),
    (re.compile(r"current|amp", re.I),
     {"min": 4, "max": 55, "unit": "A", "kind": "line", "warn": 48, "crit": 52}),
    (re.compile(r"power|kw|watt|consumption|draw", re.I),
     {"min": 8, "max": 55, "unit": "kW", "kind": "line", "warn": 48, "crit": 52}),
    (re.compile(r"effic|perform|util", re.I),
     {"min": 70, "max": 99.5, "unit": "%", "kind": "gauge", "warn": 80, "crit": 75}),
    (re.compile(r"accur|qual|precision", re.I),
     {"min": 80, "max": 99.5, "unit": "%", "kind": "gauge", "warn": 90, "crit": 85}),
    (re.compile(r"weight|mass|kg|load", re.I),
     {"min": 2, "max": 50, "unit": "kg", "kind": "bar", "warn": 45, "crit": 48}),
    (re.compile(r"co2|gas|emission", re.I),
     {"min": 350, "max": 1200, "unit": "ppm", "kind": "line", "warn": 900, "crit": 1100}),
    (re.compile(r"noise|sound|db", re.I),
     {"min": 40, "max": 95, "unit": "dB", "kind": "line", "warn": 85, "crit": 90}),
    (re.compile(r"status|state|mode|on|off", re.I),
     {"min": 0, "max": 1, "unit": "", "kind": "status", "warn": None, "crit": None}),
]

_DEFAULT_PROFILE = {
    "min": 0, "max": 100, "unit": "", "kind": "line", "warn": 80, "crit": 90,
}


def heuristic_profile(label: str) -> dict:
    """Return a {min, max, unit, kind, warn, crit, base} dict for a sensor label."""
    for pattern, profile in _RULES:
        if pattern.search(label):
            p = dict(profile)
            break
    else:
        p = dict(_DEFAULT_PROFILE)
    # base value = halfway between min and warn (or midpoint if no warn)
    base = (p["min"] + (p["warn"] if p["warn"] is not None else p["max"])) / 2
    p["base"] = round(base, 2)
    p["label"] = label
    return p


def heuristic_profiles(labels: Iterable[str]) -> list[dict]:
    return [heuristic_profile(label) for label in labels]


# ─── Optional Gemini enrichment ────────────────────────────────────────────────

async def gemini_profiles(labels: list[str]) -> list[dict] | None:
    """Ask Gemini for industrial sensor ranges; returns None on any failure."""
    if not _configure() or not labels:
        return None

    prompt = (
        "You are an industrial automation expert. For each sensor label below, "
        "produce a JSON array of objects matching this schema (one object per label, "
        "in the same order):\n\n"
        '  {"label": "...", "min": number, "max": number, "unit": "string", '
        '"warn": number, "crit": number, "base": number, "kind": '
        '"line"|"gauge"|"bar"|"status"}\n\n'
        "Rules:\n"
        " - min < base < warn < crit <= max (unless kind=status, then 0/1).\n"
        " - Units must be realistic industrial units (°C, bar, RPM, %, kW, etc.).\n"
        " - Base values should be in the centre of the safe operating range.\n"
        " - Return ONLY the JSON array, no markdown, no commentary.\n\n"
        f"Sensor labels: {json.dumps(labels)}"
    )

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: _client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
            ),
        )
        raw = response.text.strip()
        # Strip code fences if present
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.M)
        data = json.loads(raw)
        if isinstance(data, list) and len(data) == len(labels):
            return data
        return None
    except Exception as e:
        print(f"[AI Simulator] Gemini profile call failed: {e}")
        return None


async def suggest_profiles(labels: list[str]) -> list[dict]:
    """
    Primary entry. Always returns a list[dict] of length len(labels).
    Tries Gemini once for the whole batch; falls back to heuristic per-label.
    """
    if not labels:
        return []
    ai = await gemini_profiles(labels)
    if ai:
        # Sanity-check each entry has the required fields; merge with heuristic as fallback
        out = []
        for i, label in enumerate(labels):
            h = heuristic_profile(label)
            entry = ai[i] if i < len(ai) and isinstance(ai[i], dict) else {}
            out.append({
                "label": label,
                "min": float(entry.get("min", h["min"])),
                "max": float(entry.get("max", h["max"])),
                "unit": str(entry.get("unit", h["unit"])),
                "warn": entry.get("warn", h["warn"]),
                "crit": entry.get("crit", h["crit"]),
                "base": float(entry.get("base", h["base"])),
                "kind": entry.get("kind", h["kind"]),
                "source": "ai",
            })
        return out
    return [{**heuristic_profile(label), "source": "heuristic"} for label in labels]
