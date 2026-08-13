from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from research_portal_pipeline.hashing import canonical_hash, hash_path


class HashingTests(unittest.TestCase):
    def test_canonical_hash_ignores_mapping_order(self) -> None:
        self.assertEqual(canonical_hash({"a": 1, "b": 2}), canonical_hash({"b": 2, "a": 1}))

    def test_directory_hash_changes_with_content_not_mtime(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a").mkdir()
            file = root / "a/value.json"
            file.write_text('{"value":1}\n', encoding="utf-8")
            first = hash_path(root)
            file.touch()
            self.assertEqual(first, hash_path(root))
            file.write_text('{"value":2}\n', encoding="utf-8")
            self.assertNotEqual(first, hash_path(root))


if __name__ == "__main__":
    unittest.main()
