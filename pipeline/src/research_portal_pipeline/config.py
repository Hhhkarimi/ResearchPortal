from __future__ import annotations

import os
import re
import tomllib
from pathlib import Path

from .models import PipelineConfig, RetryPolicy, StageSpec


ENV_PATTERN = re.compile(r"\$\{([A-Z][A-Z0-9_]*)(?::-(.*?))?\}")


class ConfigurationError(ValueError):
    pass


def _expand(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        name, fallback = match.group(1), match.group(2)
        if name in os.environ:
            return os.environ[name]
        if fallback is not None:
            return fallback
        raise ConfigurationError(f"Required environment variable is missing: {name}")

    return ENV_PATTERN.sub(replace, value)


def _path(value: str, project_root: Path) -> Path:
    expanded = Path(_expand(value)).expanduser()
    return expanded if expanded.is_absolute() else project_root / expanded


def load_config(path: Path, project_root: Path) -> PipelineConfig:
    path = path.resolve()
    with path.open("rb") as stream:
        raw = tomllib.load(stream)

    pipeline = raw.get("pipeline", {})
    stages_raw = raw.get("stages", [])
    if not stages_raw:
        raise ConfigurationError("At least one [[stages]] entry is required.")

    stages: list[StageSpec] = []
    names: set[str] = set()
    for item in stages_raw:
        name = item["name"]
        if name in names:
            raise ConfigurationError(f"Duplicate stage name: {name}")
        names.add(name)
        commands = tuple(tuple(_expand(str(token)) for token in command) for command in item.get("commands", []))
        if not commands:
            raise ConfigurationError(f"Stage {name} has no commands.")
        retry_raw = item.get("retry", {})
        retry = RetryPolicy(
            attempts=int(retry_raw.get("attempts", 1)),
            initial_backoff_seconds=float(retry_raw.get("initial_backoff_seconds", 1)),
            max_backoff_seconds=float(retry_raw.get("max_backoff_seconds", 30)),
            retryable_exit_codes=tuple(int(code) for code in retry_raw.get("retryable_exit_codes", [75])),
        )
        if retry.attempts < 1:
            raise ConfigurationError(f"Stage {name} retry.attempts must be positive.")
        stages.append(StageSpec(
            name=name,
            commands=commands,
            inputs=tuple(item.get("inputs", [])),
            outputs=tuple(item.get("outputs", [])),
            depends_on=tuple(item.get("depends_on", [])),
            timeout_seconds=int(item.get("timeout_seconds", 900)),
            deterministic=bool(item.get("deterministic", True)),
            retry=retry,
        ))

    completed: set[str] = set()
    for stage in stages:
        missing = set(stage.depends_on) - completed
        if missing:
            raise ConfigurationError(f"Stage {stage.name} depends on missing or later stages: {sorted(missing)}")
        completed.add(stage.name)

    snapshot_date = _expand(str(pipeline.get("snapshot_date", "${PIPELINE_SNAPSHOT_DATE}")))
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", snapshot_date):
        raise ConfigurationError("pipeline.snapshot_date must use YYYY-MM-DD.")

    return PipelineConfig(
        name=str(pipeline.get("name", "research-portal")),
        snapshot_date=snapshot_date,
        schema_version=_expand(str(pipeline.get("schema_version", "11.0.0"))),
        methodology_version=_expand(str(pipeline.get("methodology_version", "RTPMI-4.2-ISC"))),
        artifact_root=_path(str(pipeline.get("artifact_root", ".pipeline/artifacts")), project_root),
        work_root=_path(str(pipeline.get("work_root", ".pipeline/work")), project_root),
        raw_paths=tuple(pipeline.get("raw_paths", [])),
        bootstrap_paths=tuple(pipeline.get("bootstrap_paths", [])),
        publish_paths=tuple(pipeline.get("publish_paths", ["data", "public/datasets"])),
        stages=tuple(stages),
        config_path=path,
    )
