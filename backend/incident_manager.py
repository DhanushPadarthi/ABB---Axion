"""
Incident manager.
Clusters machine alerts into coherent incidents using dependency graph traversal.
Manages incident lifecycle: detection, clustering, resolution.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from models import MachineState, Incident, AffectedMachine, HealthStatus
from dependency_engine import find_root_cause, load_machine_configs, _topological_sort


_machine_configs = {}
_active_incidents: dict[str, Incident] = {}  # root_cause_machine_id -> Incident
_incident_history: list[Incident] = []


def initialize():
    global _machine_configs
    _machine_configs = load_machine_configs()


def _compute_throughput_impact(machine_states: dict[str, MachineState]) -> float:
    """Estimate throughput reduction percentage based on filling machine metrics."""
    filling = machine_states.get("filling_machine")
    if not filling:
        return 0.0
    throughput_metric = next((m for m in filling.metrics if m.key == "throughput"), None)
    if not throughput_metric:
        return 0.0
    base = 300.0  # base throughput bottles/min
    current = throughput_metric.value
    reduction = max(0.0, (base - current) / base * 100)
    return round(reduction, 1)


def _build_recommended_actions(root_cause_id: str) -> list[str]:
    playbook = {
        "cooling_unit": [
            "Reduce production line speed by 20% immediately to reduce fill variance",
            "Alert maintenance team: cooling unit thermal runaway — inspect coolant flow valves",
            "Activate backup cooling circuit if available (Control Panel → Backup Systems)",
            "Monitor fill accuracy — halt production if fill accuracy drops below 75%",
            "Log incident and initiate preventive maintenance work order",
        ],
        "filling_machine": [
            "Check liquid pressure supply lines for blockages",
            "Reduce fill rate to stabilize volume variance",
            "Alert maintenance team to inspect fill nozzle calibration",
            "Monitor downstream capping system for backup",
        ],
        "capping_system": [
            "Reduce conveyor speed to reduce back-pressure on capping system",
            "Alert maintenance team: elevated vibration in capping motor",
            "Inspect cap feed hopper for jams",
        ],
        "packaging_conveyor": [
            "Reduce belt speed to prevent motor overheating",
            "Alert maintenance team: conveyor motor temperature rising",
            "Check belt tension and alignment",
        ],
    }
    return playbook.get(root_cause_id, ["Alert maintenance team", "Inspect affected systems"])


def _build_rule_summary(root_cause_id: str, root_cause_name: str, affected: list[str]) -> str:
    affected_str = ", ".join(affected) if affected else "no downstream systems"
    metric_labels = {
        "cooling_unit": "coolant temperature exceeded critical threshold (>90°C)",
        "filling_machine": "fill accuracy dropped below critical threshold (<80%)",
        "capping_system": "motor vibration exceeded critical threshold (>9 mm/s)",
        "packaging_conveyor": "motor temperature exceeded critical threshold (>95°C)",
    }
    trigger = metric_labels.get(root_cause_id, "metrics exceeded critical thresholds")
    return (
        f"{root_cause_name} {trigger}. "
        f"Dependency propagation has affected: {affected_str}. "
        f"Immediate operator action required."
    )


def update(machine_states: dict[str, MachineState]) -> list[Incident]:
    """
    Evaluate current machine states, create/update/resolve incidents.
    Returns the list of currently active incidents.
    """
    global _active_incidents

    root_causes = find_root_cause(machine_states, _machine_configs)

    # Remove incidents whose root cause is now healthy
    resolved = [
        rc_id for rc_id in list(_active_incidents.keys())
        if rc_id not in root_causes
        or machine_states.get(rc_id, None) is None
        or machine_states[rc_id].health == HealthStatus.HEALTHY
    ]
    for rc_id in resolved:
        incident = _active_incidents.pop(rc_id)
        _incident_history.append(incident)

    # Create or update incidents for each root cause
    for rc_id in root_causes:
        rc_state = machine_states.get(rc_id)
        if rc_state is None:
            continue

        # Find the worst metric on the root cause machine
        worst_metric = _find_worst_metric(rc_state)

        # Collect all affected downstream machines
        affected_ids = _collect_downstream(rc_id, machine_states)
        affected_machines = [
            AffectedMachine(
                machine_id=mid,
                machine_name=machine_states[mid].name,
                description=_describe_impact(mid, machine_states[mid]),
                health=machine_states[mid].health,
            )
            for mid in affected_ids
            if mid in machine_states and machine_states[mid].health != HealthStatus.HEALTHY
        ]

        severity = "critical" if rc_state.health == HealthStatus.CRITICAL else "warning"
        throughput_impact = _compute_throughput_impact(machine_states)

        if rc_id not in _active_incidents:
            # New incident
            incident_id = str(uuid.uuid4())[:8]
            _active_incidents[rc_id] = Incident(
                id=incident_id,
                title=f"{rc_state.name} — {'Critical Failure' if severity == 'critical' else 'Warning Condition'}",
                root_cause_machine_id=rc_id,
                root_cause_machine_name=rc_state.name,
                root_cause_metric=worst_metric,
                root_cause_description=rc_state.description,
                affected_machines=affected_machines,
                severity=severity,
                started_at=datetime.now(timezone.utc).isoformat(),
                rule_summary=_build_rule_summary(
                    rc_id, rc_state.name, [m.machine_name for m in affected_machines]
                ),
                recommended_actions=_build_recommended_actions(rc_id),
                throughput_impact_pct=throughput_impact,
            )
        else:
            # Update existing incident
            existing = _active_incidents[rc_id]
            _active_incidents[rc_id] = existing.model_copy(update={
                "affected_machines": affected_machines,
                "severity": severity,
                "throughput_impact_pct": throughput_impact,
                "rule_summary": _build_rule_summary(
                    rc_id, rc_state.name, [m.machine_name for m in affected_machines]
                ),
            })

    return list(_active_incidents.values())


def set_ai_summary(root_cause_machine_id: str, summary: str) -> None:
    """Update an active incident with an AI-generated summary."""
    if root_cause_machine_id in _active_incidents:
        existing = _active_incidents[root_cause_machine_id]
        _active_incidents[root_cause_machine_id] = existing.model_copy(
            update={"ai_summary": summary}
        )


def get_history() -> list[Incident]:
    return list(_incident_history)


def clear_all() -> None:
    global _active_incidents, _incident_history
    _active_incidents = {}
    _incident_history = []


def _find_worst_metric(state: MachineState) -> str:
    critical_metrics = [m for m in state.metrics if m.status == HealthStatus.CRITICAL]
    warning_metrics = [m for m in state.metrics if m.status == HealthStatus.WARNING]
    if critical_metrics:
        return f"{critical_metrics[0].label} ({critical_metrics[0].value}{critical_metrics[0].unit})"
    if warning_metrics:
        return f"{warning_metrics[0].label} ({warning_metrics[0].value}{warning_metrics[0].unit})"
    return "multiple metrics"


def _collect_downstream(root_id: str, machine_states: dict[str, MachineState]) -> list[str]:
    """BFS from root to collect all downstream machine IDs."""
    configs = _machine_configs
    visited = []
    queue = [root_id]
    while queue:
        current = queue.pop(0)
        cfg = configs.get(current)
        if cfg is None:
            continue
        for dep in cfg.dependencies_downstream:
            if dep.machine_id not in visited:
                visited.append(dep.machine_id)
                queue.append(dep.machine_id)
    return visited


def _describe_impact(machine_id: str, state: MachineState) -> str:
    impacts = {
        "filling_machine": lambda s: _filling_impact(s),
        "capping_system": lambda s: _capping_impact(s),
        "packaging_conveyor": lambda s: _conveyor_impact(s),
        "storage_unit": lambda s: _storage_impact(s),
    }
    fn = impacts.get(machine_id)
    return fn(state) if fn else f"{state.name} is degraded"


def _filling_impact(state: MachineState) -> str:
    acc = next((m for m in state.metrics if m.key == "fill_accuracy"), None)
    tp = next((m for m in state.metrics if m.key == "throughput"), None)
    parts = []
    if acc:
        parts.append(f"fill accuracy reduced to {acc.value:.1f}%")
    if tp:
        parts.append(f"throughput at {tp.value:.0f} btl/min")
    return "Filling Machine: " + ", ".join(parts) if parts else "Filling Machine degraded"


def _capping_impact(state: MachineState) -> str:
    vib = next((m for m in state.metrics if m.key == "vibration_level"), None)
    temp = next((m for m in state.metrics if m.key == "motor_temperature"), None)
    parts = []
    if vib:
        parts.append(f"vibration at {vib.value:.1f} mm/s")
    if temp:
        parts.append(f"motor temp {temp.value:.0f}°C")
    return "Capping System: " + ", ".join(parts) if parts else "Capping System degraded"


def _conveyor_impact(state: MachineState) -> str:
    speed = next((m for m in state.metrics if m.key == "belt_speed"), None)
    return f"Conveyor: belt speed reduced to {speed.value:.1f} m/min" if speed else "Conveyor degraded"


def _storage_impact(state: MachineState) -> str:
    rate = next((m for m in state.metrics if m.key == "intake_rate"), None)
    return f"Storage: intake rate reduced to {rate.value:.0f} units/min" if rate else "Storage degraded"
