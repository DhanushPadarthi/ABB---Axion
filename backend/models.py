from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Literal
from enum import Enum


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNCONFIGURED = "unconfigured"


class MetricConfig(BaseModel):
    key: str
    label: str
    unit: str
    type: Literal["line", "gauge", "bar", "status"]
    normal_min: Optional[float]
    normal_max: Optional[float]
    warning_min: Optional[float]
    warning_max: Optional[float]
    critical_min: Optional[float]
    critical_max: Optional[float]
    base_value: float
    drift_rate: float


class DependencyLink(BaseModel):
    machine_id: str
    impact_weight: float  # 0.0 - 1.0


class Position(BaseModel):
    x: float
    y: float


class MachineConfig(BaseModel):
    id: str
    name: str
    type: str
    location: str
    description: str
    position: Position
    metrics: list[MetricConfig]
    dependencies_downstream: list[DependencyLink]


class MetricValue(BaseModel):
    key: str
    label: str
    unit: str
    type: str
    value: float
    status: HealthStatus
    normal_min: Optional[float]
    normal_max: Optional[float]
    warning_min: Optional[float]
    warning_max: Optional[float]
    critical_min: Optional[float]
    critical_max: Optional[float]


class MachineState(BaseModel):
    id: str
    name: str
    type: str
    location: str
    description: str
    position: Position
    health: HealthStatus
    metrics: list[MetricValue]
    dependencies_downstream: list[DependencyLink]
    degradation_factor: float = 0.0  # 0.0 = no degradation, 1.0 = full degradation


class AffectedMachine(BaseModel):
    machine_id: str
    machine_name: str
    description: str
    health: HealthStatus


class Incident(BaseModel):
    id: str
    title: str
    root_cause_machine_id: str
    root_cause_machine_name: str
    root_cause_metric: str
    root_cause_description: str
    affected_machines: list[AffectedMachine]
    severity: Literal["warning", "critical"]
    started_at: str
    rule_summary: str
    ai_summary: Optional[str] = None
    recommended_actions: list[str]
    throughput_impact_pct: float = 0.0


class FactoryState(BaseModel):
    machines: dict[str, MachineState]
    incidents: list[Incident]
    system_mode: Literal["normal", "warning", "incident"]
    tick: int
    timestamp: str


class DemoCommand(BaseModel):
    action: Literal["trigger_cascade", "reset"]
