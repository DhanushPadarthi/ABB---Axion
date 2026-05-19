"""
Dependency propagation engine.
Traverses the machine dependency DAG and computes degradation factors
for downstream machines when an upstream machine enters warning/critical state.
"""
from __future__ import annotations
import json
import os
from models import MachineConfig, MachineState, HealthStatus


def load_machine_configs() -> dict[str, MachineConfig]:
    config_path = os.path.join(os.path.dirname(__file__), "config", "machines.json")
    with open(config_path, "r") as f:
        data = json.load(f)
    return {m["id"]: MachineConfig(**m) for m in data["machines"]}


def compute_metric_status(value: float, metric_cfg) -> HealthStatus:
    """Determine health status of a single metric value against thresholds."""
    # Critical check
    if metric_cfg.critical_max is not None and value >= metric_cfg.critical_max:
        return HealthStatus.CRITICAL
    if metric_cfg.critical_min is not None and value <= metric_cfg.critical_min:
        return HealthStatus.CRITICAL
    # Warning check
    if metric_cfg.warning_max is not None and value >= metric_cfg.warning_max:
        return HealthStatus.WARNING
    if metric_cfg.warning_min is not None and value <= metric_cfg.warning_min:
        return HealthStatus.WARNING
    return HealthStatus.HEALTHY


def compute_machine_health(metrics_status: list[HealthStatus]) -> HealthStatus:
    """Aggregate metric statuses into a single machine health status."""
    if any(s == HealthStatus.CRITICAL for s in metrics_status):
        return HealthStatus.CRITICAL
    if any(s == HealthStatus.WARNING for s in metrics_status):
        return HealthStatus.WARNING
    return HealthStatus.HEALTHY


def propagate_dependencies(
    machine_states: dict[str, MachineState],
    machine_configs: dict[str, MachineConfig],
) -> dict[str, float]:
    """
    For each machine, compute its degradation_factor based on upstream machine health.
    Returns a dict of machine_id -> degradation_factor (0.0 to 1.0).

    Traversal order: topological (root → leaves).
    Since this is a fixed 5-node chain, we traverse in defined order.
    """
    degradation: dict[str, float] = {mid: 0.0 for mid in machine_states}

    # Propagate in topological order (cooling → filling → capping → conveyor → storage)
    topo_order = _topological_sort(machine_configs)

    for machine_id in topo_order:
        config = machine_configs.get(machine_id)
        if config is None:
            continue
        for dep in config.dependencies_downstream:
            downstream_id = dep.machine_id
            upstream_state = machine_states.get(machine_id)
            if upstream_state is None:
                continue

            # Compute upstream severity ratio (0.0 healthy, 1.0 critical)
            upstream_severity = _health_to_severity(upstream_state.health)
            if upstream_severity == 0.0:
                continue

            # Propagate: downstream degradation += upstream_severity * impact_weight
            incoming = upstream_severity * dep.impact_weight
            # Account for the upstream machine's own degradation (cascading)
            upstream_degradation = degradation.get(machine_id, 0.0)
            # Total propagated = direct impact + upstream's own degradation effect
            total = incoming + (upstream_degradation * dep.impact_weight * 0.5)
            degradation[downstream_id] = min(
                1.0, degradation.get(downstream_id, 0.0) + total
            )

    return degradation


def _health_to_severity(health: HealthStatus) -> float:
    return {
        HealthStatus.HEALTHY: 0.0,
        HealthStatus.WARNING: 0.4,
        HealthStatus.CRITICAL: 1.0,
        HealthStatus.UNCONFIGURED: 0.0,
    }.get(health, 0.0)


def _topological_sort(machine_configs: dict[str, MachineConfig]) -> list[str]:
    """Kahn's algorithm for topological sort on the dependency DAG."""
    # Build in-degree map
    in_degree: dict[str, int] = {mid: 0 for mid in machine_configs}
    adj: dict[str, list[str]] = {mid: [] for mid in machine_configs}

    for mid, cfg in machine_configs.items():
        for dep in cfg.dependencies_downstream:
            if dep.machine_id in adj:
                adj[mid].append(dep.machine_id)
                in_degree[dep.machine_id] += 1

    queue = [mid for mid, deg in in_degree.items() if deg == 0]
    order = []

    while queue:
        node = queue.pop(0)
        order.append(node)
        for neighbor in adj[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # If order length != number of nodes, there's a cycle — log and return partial
    if len(order) != len(machine_configs):
        print("WARNING: Dependency cycle detected in machine config — using partial order")

    return order


def find_root_cause(
    machine_states: dict[str, MachineState],
    machine_configs: dict[str, MachineConfig],
) -> list[str]:
    """
    Find all machines that are in warning/critical state AND have no unhealthy upstream.
    These are the root causes of current incidents.
    """
    # Build reverse adjacency (downstream -> list of upstreams)
    upstreams: dict[str, list[str]] = {mid: [] for mid in machine_configs}
    for mid, cfg in machine_configs.items():
        for dep in cfg.dependencies_downstream:
            if dep.machine_id in upstreams:
                upstreams[dep.machine_id].append(mid)

    root_causes = []
    for mid, state in machine_states.items():
        if state.health in (HealthStatus.WARNING, HealthStatus.CRITICAL):
            # Check if ALL upstreams are healthy
            all_upstream_healthy = all(
                machine_states[up_id].health == HealthStatus.HEALTHY
                for up_id in upstreams.get(mid, [])
                if up_id in machine_states
            )
            if all_upstream_healthy:
                root_causes.append(mid)

    return root_causes
