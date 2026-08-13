from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class RetryPolicy:
    attempts: int = 1
    initial_backoff_seconds: float = 1.0
    max_backoff_seconds: float = 30.0
    retryable_exit_codes: tuple[int, ...] = (75,)


@dataclass(frozen=True)
class StageSpec:
    name: str
    commands: tuple[tuple[str, ...], ...]
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    depends_on: tuple[str, ...] = ()
    timeout_seconds: int = 900
    deterministic: bool = True
    retry: RetryPolicy = RetryPolicy()


@dataclass(frozen=True)
class PipelineConfig:
    name: str
    snapshot_date: str
    schema_version: str
    methodology_version: str
    artifact_root: Path
    work_root: Path
    raw_paths: tuple[str, ...]
    bootstrap_paths: tuple[str, ...]
    publish_paths: tuple[str, ...]
    stages: tuple[StageSpec, ...]
    config_path: Path


@dataclass
class StageResult:
    name: str
    status: str
    fingerprint: str
    attempts: int
    started_at: str
    finished_at: str
    duration_seconds: float
    input_hashes: dict[str, str] = field(default_factory=dict)
    output_hashes: dict[str, str] = field(default_factory=dict)
    log_path: str | None = None
    error: str | None = None


@dataclass
class RunManifest:
    run_id: str
    pipeline_name: str
    status: str
    snapshot_date: str
    schema_version: str
    methodology_version: str
    config_path: str
    config_hash: str
    code_hash: str
    raw_artifact_hash: str
    raw_artifact_path: str
    project_root: str
    work_root: str
    created_at: str
    environment: dict[str, str]
    stages: list[StageResult] = field(default_factory=list)
    published_at: str | None = None
    failure: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
