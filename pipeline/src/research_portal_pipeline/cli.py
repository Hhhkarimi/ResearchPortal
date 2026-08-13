from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import ConfigurationError, load_config
from .contracts import ContractViolation, validate_domain
from .runner import PipelineRunner


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="rp-pipeline", description="ResearchPortal reproducible data pipeline")
    root.add_argument("--project-root", type=Path, default=Path.cwd())
    root.add_argument("--config", type=Path, default=Path("pipeline/config/pipeline.toml"))
    subcommands = root.add_subparsers(dest="command", required=True)
    run = subcommands.add_parser("run", help="Run all stages in an isolated workspace")
    run.add_argument("--publish", action="store_true", help="Atomically promote validated data/public outputs")
    run.add_argument("--force", action="store_true", help="Ignore deterministic stage cache")
    subcommands.add_parser("plan", help="Print stage contracts without executing them")
    subcommands.add_parser("validate", help="Validate the currently published project data")
    return root


def _config_path(value: Path, project_root: Path) -> Path:
    return value if value.is_absolute() else project_root / value


def main(argv: list[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    project_root = arguments.project_root.resolve()
    try:
        config = load_config(_config_path(arguments.config, project_root), project_root)
        if arguments.command == "plan":
            print(json.dumps({
                "pipeline": config.name,
                "snapshotDate": config.snapshot_date,
                "rawPaths": config.raw_paths,
                "publishPaths": config.publish_paths,
                "stages": [{
                    "name": stage.name, "dependsOn": stage.depends_on, "inputs": stage.inputs,
                    "outputs": stage.outputs, "commands": stage.commands,
                    "deterministic": stage.deterministic, "attempts": stage.retry.attempts,
                } for stage in config.stages],
            }, ensure_ascii=False, indent=2))
            return 0
        if arguments.command == "validate":
            print(json.dumps(validate_domain(project_root), ensure_ascii=False, indent=2))
            return 0
        manifest = PipelineRunner(config, project_root, force=arguments.force).run(publish=arguments.publish)
        print(json.dumps(manifest.to_dict(), ensure_ascii=False, indent=2))
        return 0
    except (ConfigurationError, ContractViolation, FileNotFoundError, FileExistsError, RuntimeError) as error:
        print(f"pipeline error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
