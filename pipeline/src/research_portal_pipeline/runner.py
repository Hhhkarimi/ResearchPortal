from __future__ import annotations

import json
import os
import platform
import random
import shutil
import subprocess
import sys
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .contracts import ContractViolation, require_paths, validate_domain
from .hashing import canonical_hash, hash_path, hash_paths
from .models import PipelineConfig, RunManifest, StageResult, StageSpec


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _copy(source: Path, target: Path) -> None:
    if source.is_dir():
        if target.exists():
            shutil.rmtree(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target, copy_function=shutil.copy2)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary, path)


class PipelineRunner:
    def __init__(self, config: PipelineConfig, project_root: Path, *, force: bool = False):
        self.config = config
        self.project_root = project_root.resolve()
        self.force = force
        self.config.artifact_root.mkdir(parents=True, exist_ok=True)
        self.config.work_root.mkdir(parents=True, exist_ok=True)

    def _code_hash(self) -> str:
        return canonical_hash(hash_paths(self.project_root, (
            "pipeline/src", "pipeline/config", "scripts", "package.json", "pyproject.toml",
        )))

    def _capture_raw(self) -> tuple[str, Path]:
        require_paths(self.project_root, self.config.raw_paths, "capture_raw", "raw inputs")
        inventory = hash_paths(self.project_root, self.config.raw_paths)
        artifact_hash = canonical_hash(inventory)
        artifact = self.config.artifact_root / "raw" / artifact_hash
        if not artifact.exists():
            temporary = artifact.with_name(artifact.name + f".tmp-{os.getpid()}")
            temporary.mkdir(parents=True, exist_ok=False)
            for item in self.config.raw_paths:
                _copy(self.project_root / item, temporary / item)
            _write_json(temporary / "RAW-MANIFEST.json", {
                "artifactHash": artifact_hash,
                "createdAt": utc_now(),
                "paths": inventory,
            })
            try:
                os.replace(temporary, artifact)
            except OSError:
                if artifact.exists():
                    shutil.rmtree(temporary)
                else:
                    raise
        return artifact_hash, artifact

    def _prepare_work(self, run_id: str, raw_artifact: Path) -> Path:
        work = self.config.work_root / run_id
        if work.exists():
            raise FileExistsError(f"Run workspace already exists: {work}")
        work.mkdir(parents=True)
        for item in self.config.bootstrap_paths:
            source = self.project_root / item
            if source.exists():
                _copy(source, work / item)
        for item in self.config.raw_paths:
            source = raw_artifact / item
            if source.exists():
                _copy(source, work / item)
        return work

    def _stage_fingerprint(self, stage: StageSpec, work: Path) -> tuple[str, dict[str, str]]:
        inputs = hash_paths(work, stage.inputs)
        # v2.2.4: stage cache must be invalidated whenever executable pipeline
        # code/config changes. Previously the run manifest recorded code_hash but
        # the stage fingerprint ignored it, so stale deterministic stage output
        # could survive script changes and later fail release validation.
        code_hash = self._code_hash()
        fingerprint = canonical_hash({
            "pipelineVersion": __version__, "stage": stage.name, "commands": stage.commands,
            "declaredInputs": stage.inputs, "declaredOutputs": stage.outputs,
            "dependsOn": stage.depends_on, "deterministic": stage.deterministic,
            "inputs": inputs, "codeHash": code_hash,
            "snapshotDate": self.config.snapshot_date,
            "schemaVersion": self.config.schema_version,
            "methodologyVersion": self.config.methodology_version,
        })
        return fingerprint, inputs

    def _cache_path(self, stage: StageSpec, fingerprint: str) -> Path:
        return self.config.artifact_root / "stage-cache" / stage.name / fingerprint

    def _restore_cache(self, stage: StageSpec, cache: Path, work: Path) -> bool:
        manifest = cache / "CACHE-MANIFEST.json"
        if self.force or not stage.deterministic or not manifest.exists():
            return False
        for item in stage.outputs:
            source = cache / "outputs" / item
            if not source.exists():
                return False
        for item in stage.outputs:
            _copy(cache / "outputs" / item, work / item)
        return True

    def _store_cache(self, stage: StageSpec, fingerprint: str, work: Path, output_hashes: dict[str, str]) -> None:
        if not stage.deterministic:
            return
        cache = self._cache_path(stage, fingerprint)
        if cache.exists():
            return
        temporary = cache.with_name(cache.name + f".tmp-{os.getpid()}")
        temporary.mkdir(parents=True, exist_ok=False)
        for item in stage.outputs:
            _copy(work / item, temporary / "outputs" / item)
        _write_json(temporary / "CACHE-MANIFEST.json", {
            "stage": stage.name, "fingerprint": fingerprint, "outputs": output_hashes,
            "createdAt": utc_now(),
        })
        cache.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.replace(temporary, cache)
        except OSError:
            if cache.exists():
                shutil.rmtree(temporary)
            else:
                raise

    def _resolve_command(self, command: tuple[str, ...], work: Path) -> list[str]:
        resolved: list[str] = []
        for index, token in enumerate(command):
            if index > 0 and token.startswith(("scripts/", "pipeline/")):
                resolved.append(str(work / token))
            else:
                resolved.append(token)
        return resolved

    def _execute_stage(self, stage: StageSpec, work: Path, run_directory: Path) -> StageResult:
        fingerprint, input_hashes = self._stage_fingerprint(stage, work)
        started = utc_now()
        start_time = time.monotonic()
        log_path = run_directory / "logs" / f"{stage.name}.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        cache = self._cache_path(stage, fingerprint)
        if self._restore_cache(stage, cache, work):
            output_hashes = hash_paths(work, stage.outputs)
            return StageResult(stage.name, "cached", fingerprint, 0, started, utc_now(),
                               time.monotonic() - start_time, input_hashes, output_hashes, str(log_path))

        require_paths(work, stage.inputs, stage.name, "inputs")
        attempts = 0
        environment = os.environ.copy()
        environment.update({
            "PIPELINE_RUN_ID": run_directory.name,
            "PIPELINE_SNAPSHOT_DATE": self.config.snapshot_date,
            "PIPELINE_SCHEMA_VERSION": self.config.schema_version,
            "PIPELINE_METHODOLOGY_VERSION": self.config.methodology_version,
            "TZ": "UTC",
        })
        last_error: str | None = None
        for attempts in range(1, stage.retry.attempts + 1):
            with log_path.open("a", encoding="utf-8") as log:
                log.write(f"\n[{utc_now()}] attempt={attempts}\n")
                try:
                    for command in stage.commands:
                        resolved = self._resolve_command(command, work)
                        log.write(f"$ {' '.join(resolved)}\n")
                        log.flush()
                        completed = subprocess.run(
                            resolved, cwd=work, env=environment, stdout=log, stderr=subprocess.STDOUT,
                            timeout=stage.timeout_seconds, check=False,
                        )
                        if completed.returncode:
                            error = RuntimeError(f"Command exited {completed.returncode}: {' '.join(resolved)}")
                            setattr(error, "returncode", completed.returncode)
                            raise error
                    last_error = None
                    break
                except (OSError, subprocess.TimeoutExpired, RuntimeError) as error:
                    last_error = str(error)
                    exit_code = getattr(error, "returncode", None)
                    can_retry = (
                        attempts < stage.retry.attempts
                        and not stage.deterministic
                        and (exit_code is None or exit_code in stage.retry.retryable_exit_codes)
                    )
                    log.write(f"ERROR: {last_error}\nretry={can_retry}\n")
                    if not can_retry:
                        break
                    delay = min(
                        stage.retry.initial_backoff_seconds * (2 ** (attempts - 1)),
                        stage.retry.max_backoff_seconds,
                    )
                    delay *= random.uniform(0.8, 1.2)
                    time.sleep(delay)
        if last_error:
            return StageResult(stage.name, "failed", fingerprint, attempts, started, utc_now(),
                               time.monotonic() - start_time, input_hashes, {}, str(log_path), last_error)

        require_paths(work, stage.outputs, stage.name, "outputs")
        output_hashes = hash_paths(work, stage.outputs)
        self._store_cache(stage, fingerprint, work, output_hashes)
        return StageResult(stage.name, "succeeded", fingerprint, attempts, started, utc_now(),
                           time.monotonic() - start_time, input_hashes, output_hashes, str(log_path))

    def _publish(self, run_id: str, work: Path) -> None:
        # Keep the transaction on the same filesystem as the project so every
        # os.replace below remains atomic even when artifacts live elsewhere.
        transaction = self.project_root / ".pipeline" / "publish-transactions" / run_id
        staged = transaction / "staged"
        backup = transaction / "backup"
        if transaction.exists():
            raise FileExistsError(f"Publish transaction already exists: {transaction}")
        for item in self.config.publish_paths:
            require_paths(work, (item,), "publish", "outputs")
            _copy(work / item, staged / item)

        backed_up: list[str] = []
        replaced: list[str] = []
        try:
            for item in self.config.publish_paths:
                target = self.project_root / item
                saved = backup / item
                replacement = staged / item
                saved.parent.mkdir(parents=True, exist_ok=True)
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    os.replace(target, saved)
                    backed_up.append(item)
                os.replace(replacement, target)
                replaced.append(item)
        except Exception:
            for item in reversed(replaced):
                target = self.project_root / item
                if target.exists():
                    if target.is_dir():
                        shutil.rmtree(target)
                    else:
                        target.unlink()
            for item in reversed(backed_up):
                target, saved = self.project_root / item, backup / item
                if saved.exists():
                    os.replace(saved, target)
            raise

    def run(self, *, publish: bool = False) -> RunManifest:
        raw_hash, raw_artifact = self._capture_raw()
        config_hash = hash_path(self.config.config_path)
        code_hash = self._code_hash()
        run_id = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{raw_hash[:10]}-{uuid.uuid4().hex[:6]}"
        work = self._prepare_work(run_id, raw_artifact)
        run_directory = self.config.artifact_root / "runs" / run_id
        run_directory.mkdir(parents=True, exist_ok=False)
        manifest = RunManifest(
            run_id=run_id, pipeline_name=self.config.name, status="running",
            snapshot_date=self.config.snapshot_date, schema_version=self.config.schema_version,
            methodology_version=self.config.methodology_version, config_path=str(self.config.config_path),
            config_hash=config_hash, code_hash=code_hash, raw_artifact_hash=raw_hash,
            raw_artifact_path=str(raw_artifact), project_root=str(self.project_root), work_root=str(work),
            created_at=utc_now(), environment=self._environment(),
        )
        manifest_path = run_directory / "RUN-MANIFEST.json"
        _write_json(manifest_path, manifest.to_dict())
        try:
            for stage in self.config.stages:
                result = self._execute_stage(stage, work, run_directory)
                manifest.stages.append(result)
                _write_json(manifest_path, manifest.to_dict())
                if result.status == "failed":
                    raise RuntimeError(f"Stage failed: {stage.name}: {result.error}")
            counts = validate_domain(work)
            _write_json(run_directory / "VALIDATION.json", counts)
            if publish:
                self._publish(run_id, work)
                manifest.published_at = utc_now()
            manifest.status = "published" if publish else "validated"
        except Exception as error:
            manifest.status = "failed"
            manifest.failure = {"type": type(error).__name__, "message": str(error), "traceback": traceback.format_exc()}
            _write_json(run_directory / "FAILURE.json", manifest.failure)
            raise
        finally:
            _write_json(manifest_path, manifest.to_dict())
        return manifest

    def _environment(self) -> dict[str, str]:
        node_version = "unavailable"
        try:
            node_version = subprocess.check_output(["node", "--version"], text=True, timeout=10).strip()
        except (OSError, subprocess.SubprocessError):
            pass
        return {
            "python": sys.version.split()[0], "node": node_version, "platform": platform.platform(),
            "pipelinePackage": __version__, "timezone": "UTC",
        }
