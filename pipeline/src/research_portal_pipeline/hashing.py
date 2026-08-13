from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Iterable


CHUNK_SIZE = 1024 * 1024


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iter_files(path: Path) -> Iterable[Path]:
    if path.is_file():
        yield path
        return
    if path.is_dir():
        for root, directories, files in os.walk(path):
            directories[:] = sorted(item for item in directories if item not in {".git", ".next", "node_modules", "__pycache__"})
            for name in sorted(files):
                yield Path(root) / name


def hash_path(path: Path) -> str:
    if not path.exists():
        return "missing"
    if path.is_file():
        return sha256_file(path)
    digest = hashlib.sha256()
    for file_path in iter_files(path):
        relative = file_path.relative_to(path).as_posix().encode("utf-8")
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        digest.update(bytes.fromhex(sha256_file(file_path)))
    return digest.hexdigest()


def hash_paths(root: Path, paths: Iterable[str]) -> dict[str, str]:
    return {item: hash_path(root / item) for item in sorted(set(paths))}


def canonical_hash(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256_bytes(payload)
