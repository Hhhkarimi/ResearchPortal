from __future__ import annotations

import tempfile
import unittest
import sys
from pathlib import Path

from research_portal_pipeline.hashing import hash_path
from research_portal_pipeline.models import PipelineConfig, RetryPolicy, StageSpec
from research_portal_pipeline.runner import PipelineRunner, _copy


class RunnerTests(unittest.TestCase):
    def _config(self, root: Path, stage: StageSpec) -> PipelineConfig:
        config_file = root / "pipeline.toml"
        config_file.write_text("[pipeline]\n", encoding="utf-8")
        return PipelineConfig(
            name="test", snapshot_date="2026-01-01", schema_version="1",
            methodology_version="test", artifact_root=root / "artifacts", work_root=root / "work-root",
            raw_paths=(), bootstrap_paths=(), publish_paths=(), stages=(stage,), config_path=config_file,
        )

    def test_copy_replaces_directory_without_leaving_stale_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, target = root / "source", root / "target"
            source.mkdir(); target.mkdir()
            (source / "current.json").write_text("{}", encoding="utf-8")
            (target / "stale.json").write_text("{}", encoding="utf-8")
            _copy(source, target)
            self.assertTrue((target / "current.json").exists())
            self.assertFalse((target / "stale.json").exists())
            self.assertEqual(hash_path(source), hash_path(target))

    def test_transient_failure_retries_and_is_recorded(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage = StageSpec(
                name="transient",
                commands=((sys.executable, "-c", "raise SystemExit(75)"),),
                inputs=(), outputs=(), deterministic=False,
                retry=RetryPolicy(attempts=2, initial_backoff_seconds=0, retryable_exit_codes=(75,)),
            )
            config = self._config(root, stage)
            work, run = root / "work", root / "run"
            work.mkdir(); run.mkdir()
            result = PipelineRunner(config, root)._execute_stage(stage, work, run)
            self.assertEqual(result.status, "failed")
            self.assertEqual(result.attempts, 2)
            self.assertTrue((run / "logs/transient.log").exists())

    def test_stage_fingerprint_changes_when_pipeline_code_changes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "scripts"
            scripts.mkdir()
            script = scripts / "stage.mjs"
            script.write_text("console.log('v1')\n", encoding="utf-8")
            stage = StageSpec(
                name="deterministic",
                commands=(("node", "scripts/stage.mjs"),),
                inputs=(), outputs=(), deterministic=True,
            )
            config = self._config(root, stage)
            work = root / "work"
            work.mkdir()
            runner = PipelineRunner(config, root)
            before, _ = runner._stage_fingerprint(stage, work)
            script.write_text("console.log('v2')\n", encoding="utf-8")
            after, _ = runner._stage_fingerprint(stage, work)
            self.assertNotEqual(before, after)


if __name__ == "__main__":
    unittest.main()
