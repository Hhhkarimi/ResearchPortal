from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


PUBLIC_DIMENSIONS = (
    "portalIdentity", "organization", "libraryDocuments", "laboratories",
    "industryTechnology", "systemsServices", "documentsRegulations",
)
STATUSES = {"verified", "observed-reference", "restricted", "unresolved"}


class ContractViolation(RuntimeError):
    pass


def read_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as stream:
            return json.load(stream)
    except (OSError, json.JSONDecodeError) as error:
        raise ContractViolation(f"Invalid JSON artifact {path}: {error}") from error


def require_paths(root: Path, paths: tuple[str, ...], stage: str, kind: str) -> None:
    missing = [item for item in paths if not (root / item).exists()]
    if missing:
        raise ContractViolation(f"Stage {stage} missing {kind}: {missing}")


def _unique(rows: list[dict], key: str, label: str) -> None:
    values = [row.get(key) for row in rows]
    duplicates = [value for value, count in Counter(values).items() if value is not None and count > 1]
    if duplicates:
        raise ContractViolation(f"Duplicate {label}: {duplicates[:10]}")


def _valid_http_url(value: object) -> bool:
    parsed = urlparse(str(value or ""))
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def validate_domain(root: Path) -> dict[str, int]:
    institutions = read_json(root / "data/isc/institutions.json")
    audits = read_json(root / "data/audit/portal-audit.json")
    deep = read_json(root / "data/audit/deep-audit-matrix.json")
    reviews = read_json(root / "data/evidence/research-review.json")
    outcomes = read_json(root / "data/evidence/dimension-evidence.json")
    rankings = read_json(root / "data/statistics/portal-ranking.json")
    ledger = read_json(root / "data/evidence/provenance-ledger.json")

    if len(institutions) != 115:
        raise ContractViolation(f"ISC roster must have 115 rows, got {len(institutions)}")
    _unique(institutions, "slug", "university slug")
    slugs = {row["slug"] for row in institutions}
    for label, rows in (("audit", audits), ("deep audit", deep), ("review", reviews)):
        if len(rows) != 115 or {row.get("universitySlug") for row in rows} != slugs:
            raise ContractViolation(f"{label} must cover the locked 115-university roster exactly")

    if len(outcomes) != 115 * len(PUBLIC_DIMENSIONS):
        raise ContractViolation(f"Public dimension outcomes must equal 805, got {len(outcomes)}")
    _unique(outcomes, "id", "dimension outcome id")
    outcome_pairs = {(row.get("universitySlug"), row.get("dimension")) for row in outcomes}
    expected_pairs = {(slug, dimension) for slug in slugs for dimension in PUBLIC_DIMENSIONS}
    if outcome_pairs != expected_pairs:
        raise ContractViolation("Dimension outcomes do not form the complete 115 x 7 matrix")
    for row in outcomes:
        if row.get("status") not in STATUSES or row.get("reportedStatus") not in STATUSES:
            raise ContractViolation(f"Invalid dimension status: {row.get('id')}")
        sources = row.get("sources", [])
        if row.get("sourceCount") != len(sources):
            raise ContractViolation(f"sourceCount mismatch: {row.get('id')}")
        if any(not _valid_http_url(source.get("url")) for source in sources):
            raise ContractViolation(f"Invalid evidence source URL: {row.get('id')}")

    _unique(rankings, "universitySlug", "ranking university")
    if any(row.get("universitySlug") not in slugs for row in rankings):
        raise ContractViolation("Ranking contains a university outside the locked roster")
    ranks = [row.get("rank") for row in rankings]
    if sorted(ranks) != list(range(1, len(rankings) + 1)):
        raise ContractViolation("RTPMI global ranks must be contiguous and unique")
    if any(not 0 <= float(row.get("score", -1)) <= 100 for row in rankings):
        raise ContractViolation("RTPMI score is outside 0..100")

    _unique(ledger, "id", "provenance id")
    if any(row.get("universitySlug") not in slugs for row in ledger):
        raise ContractViolation("Provenance contains an unknown university")
    if any(not _valid_http_url(row.get("sourceUrl")) for row in ledger):
        raise ContractViolation("Provenance contains an invalid source URL")

    return {
        "institutions": len(institutions), "audits": len(audits), "deepAudits": len(deep),
        "reviews": len(reviews), "dimensionOutcomes": len(outcomes), "rankings": len(rankings),
        "provenanceRecords": len(ledger),
    }
