from __future__ import annotations

import unittest

from research_portal_pipeline.contracts import _valid_http_url


class ContractTests(unittest.TestCase):
    def test_only_http_sources_are_public_evidence(self) -> None:
        self.assertTrue(_valid_http_url("https://example.edu/report"))
        self.assertTrue(_valid_http_url("http://example.edu/report"))
        self.assertFalse(_valid_http_url("file:///tmp/report"))
        self.assertFalse(_valid_http_url("javascript:alert(1)"))
        self.assertFalse(_valid_http_url("not-a-url"))


if __name__ == "__main__":
    unittest.main()
