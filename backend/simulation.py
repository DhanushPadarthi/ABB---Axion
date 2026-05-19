"""
Simulation engine.
Generates realistic telemetry data for all 5 factory machines.
Supports normal drift and incident cascade mode (triggered manually).
"""
from __future__ import annotations
import random
import math
import time
from datetime import datetime, timezone
from models import (
    MachineConfig, MachineState, MetricValue, HealthStatus, FactoryState
)
from dependency_engine import (
    load_machine_configs, compute_metric_status, compute_machine_health, propagate_dependencies
)


# Global simulation state
_machine_configs: dict[str, MachineConfig] = {}
_cascade_active: bool = False
_cascade_start_time: float = 0.0
_tick: int = 0

# Running metric values (mutable live state)
_current_values: dict[str, dict[str, float]] = {}


def initialize() -> None:
    """Load config and seed initial metric values."""
    global _machine_configs, _current_values
    _machine_configs = load_machine_configs()
    _current_values = {}
    for mid, cfg in _machine_configs.items():
        _current_values[mid] = {m.key: m.base_value for m in cfg.metrics}


def trigger_cascade() -> None:
    global _cascade_active, _cascade_start_time
    _cascade_active = True
    _cascade_start_time = time.time()


def reset_simulation() -> None:
    global _cascade_active, _cascade_start_time, _tick
    _cascade_active = False
    _cascade_start_time = 0.0
    _tick = 0
    initialize()


def tick() -> FactoryState:
    """Advance simulation by one tick and return the new factory state."""
    global _tick
    _tick += 1
    elapsed = time.time() - _cascade_start_time if _cascade_active else 0.0

    # Step 1: Update cooling unit metrics (root of the cascade)
    _update_cooling_unit(elapsed)

    # Step 2: Build preliminary machine states to feed into dependency engine
    preliminary_states = _build_machine_states()

    # Step 3: Propagate degradation factors
    degradation = propagate_dependencies(preliminary_states, _machine_configs)

    # Step 4: Apply degradation to downstream machines and rebuild final states
    _apply_degradation(degradation, elapsed)
    final_states = _build_machine_states()
    for mid, state in final_states.items():
        state.degradation_factor = degradation.get(mid, 0.0)

    return final_states


def _update_cooling_unit(elapsed: float) -> None:
    """Drive the cooling unit into failure if cascade is active."""
    cfg = _machine_configs["cooling_unit"]
    vals = _current_values["cooling_unit"]

    if _cascade_active:
        # Progressive failure: temperature rises, efficiency drops, flow rate drops
        # Reaches critical threshold (~90°C) at ~60 seconds elapsed
        failure_progress = min(1.0, elapsed / 60.0)

        target_temp = 12.0 + (90.0 - 12.0) * failure_progress * _ramp(failure_progress)
        target_efficiency = 96.0 - (96.0 - 35.0) * failure_progress
        target_flow = 16.0 - (16.0 - 3.5) * failure_progress
        target_power = 20.0 + (45.0 - 20.0) * failure_progress

        vals["coolant_temperature"] = _drift_toward(vals["coolant_temperature"], target_temp, 2.5)
        vals["cooling_efficiency"] = _drift_toward(vals["cooling_efficiency"], target_efficiency, 1.5)
        vals["coolant_flow_rate"] = _drift_toward(vals["coolant_flow_rate"], target_flow, 0.5)
        vals["power_draw"] = _drift_toward(vals["power_draw"], target_power, 1.0)
    else:
        # Normal operation: gentle drift within normal range
        for m in cfg.metrics:
            vals[m.key] = _normal_drift(vals[m.key], m.base_value, m.drift_rate, m.normal_min, m.normal_max)


def _apply_degradation(degradation: dict[str, float], elapsed: float) -> None:
    """Apply degradation factors to downstream machine metrics."""
    downstream_order = ["filling_machine", "capping_system", "packaging_conveyor", "storage_unit"]

    for mid in downstream_order:
        if mid not in _machine_configs:
            continue
        cfg = _machine_configs[mid]
        vals = _current_values[mid]
        deg = degradation.get(mid, 0.0)

        if deg <= 0.0:
            # No degradation — normal drift
            for m in cfg.metrics:
                vals[m.key] = _normal_drift(vals[m.key], m.base_value, m.drift_rate, m.normal_min, m.normal_max)
        else:
            _degrade_machine(mid, deg)


def _degrade_machine(machine_id: str, deg: float) -> None:
    """Push machine metrics toward degraded values proportional to deg (0-1)."""
    cfg = _machine_configs[machine_id]
    vals = _current_values[machine_id]

    degraded_targets = _get_degraded_targets(machine_id)

    for m in cfg.metrics:
        if m.key in degraded_targets:
            target = m.base_value + (degraded_targets[m.key] - m.base_value) * deg
        else:
            target = m.base_value
        # Move toward target with some noise
        vals[m.key] = _drift_toward(vals[m.key], target, m.drift_rate * 1.5)


def _get_degraded_targets(machine_id: str) -> dict[str, float]:
    """Define fully-degraded metric values for each downstream machine."""
    return {
        "filling_machine": {
            "fill_accuracy": 72.0,
            "throughput": 145.0,
            "fill_volume_variance": 11.0,
            "liquid_pressure": 2.2,
        },
        "capping_system": {
            "motor_speed": 850.0,
            "vibration_level": 9.5,
            "cap_accuracy": 82.0,
            "motor_temperature": 98.0,
        },
        "packaging_conveyor": {
            "belt_speed": 7.5,
            "motor_temperature": 93.0,
            "load": 8.0,
            "conveyor_throughput": 130.0,
        },
        "storage_unit": {
            "intake_rate": 115.0,
            "inventory_queue": 1300.0,
            "capacity_used": 94.0,
            "storage_temperature": 5.0,  # unaffected
        },
    }.get(machine_id, {})


def _build_machine_states() -> dict[str, MachineState]:
    """Construct MachineState objects from current metric values and configs."""
    states: dict[str, MachineState] = {}
    for mid, cfg in _machine_configs.items():
        metric_values = []
        metric_statuses = []
        for m in cfg.metrics:
            val = _current_values[mid].get(m.key, m.base_value)
            status = compute_metric_status(val, m)
            metric_statuses.append(status)
            metric_values.append(MetricValue(
                key=m.key,
                label=m.label,
                unit=m.unit,
                type=m.type,
                value=round(val, 2),
                status=status,
                normal_min=m.normal_min,
                normal_max=m.normal_max,
                warning_min=m.warning_min,
                warning_max=m.warning_max,
                critical_min=m.critical_min,
                critical_max=m.critical_max,
            ))

        health = compute_machine_health(metric_statuses)
        states[mid] = MachineState(
            id=mid,
            name=cfg.name,
            type=cfg.type,
            location=cfg.location,
            description=cfg.description,
            position=cfg.position,
            health=health,
            metrics=metric_values,
            dependencies_downstream=cfg.dependencies_downstream,
        )
    return states


# --- Utility helpers ---

def _normal_drift(current: float, base: float, drift: float, lo: float | None, hi: float | None) -> float:
    """Small random drift around base, clamped to normal range."""
    noise = random.gauss(0, drift * 0.3)
    # Gravity pull toward base
    pull = (base - current) * 0.05
    new_val = current + noise + pull
    if lo is not None:
        new_val = max(lo, new_val)
    if hi is not None:
        new_val = min(hi, new_val)
    return new_val


def _drift_toward(current: float, target: float, speed: float) -> float:
    """Move current value toward target with speed and small noise."""
    delta = target - current
    step = delta * 0.15 + random.gauss(0, speed * 0.1)
    return current + step


def _ramp(t: float) -> float:
    """Smooth ramp function (ease-in) for cascade progression."""
    return t * t * (3 - 2 * t)


def get_cascade_status() -> dict:
    return {
        "active": _cascade_active,
        "elapsed_seconds": round(time.time() - _cascade_start_time, 1) if _cascade_active else 0.0,
    }
