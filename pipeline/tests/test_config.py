from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from research_portal_pipeline.config import ConfigurationError, load_config


class ConfigTests(unittest.TestCase):
    def test_environment_default_and_stage_order(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "pipeline.toml"
            config.write_text('''
[pipeline]
snapshot_date = "${TEST_SNAPSHOT_DATE:-2026-01-02}"
[[stages]]
name = "first"
commands = [["python", "-V"]]
inputs = []
outputs = []
[[stages]]
name = "second"
depends_on = ["first"]
commands = [["python", "-V"]]
inputs = []
outputs = []
''', encoding="utf-8")
            os.environ.pop("TEST_SNAPSHOT_DATE", None)
            parsed = load_config(config, root)
            self.assertEqual(parsed.snapshot_date, "2026-01-02")
            self.assertEqual([stage.name for stage in parsed.stages], ["first", "second"])

    def test_forward_dependency_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "pipeline.toml"
            config.write_text('''
[pipeline]
snapshot_date = "2026-01-02"
[[stages]]
name = "first"
depends_on = ["later"]
commands = [["python", "-V"]]
''', encoding="utf-8")
            with self.assertRaises(ConfigurationError):
                load_config(config, root)


if __name__ == "__main__":
    unittest.main()
