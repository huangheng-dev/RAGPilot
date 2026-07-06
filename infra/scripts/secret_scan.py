from __future__ import annotations

import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]

TARGET_PATHS = [
    "README.md",
    ".env.example",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "apps/api/ragpilot_api",
    "apps/web/app",
    "apps/web/components",
    "apps/web/lib",
    "apps/web/messages",
    "docs",
    "packages",
]

ALLOWED_SUFFIXES = {
    ".env",
    ".json",
    ".md",
    ".py",
    ".toml",
    ".ts",
    ".tsx",
    ".yaml",
    ".yml",
}

EXCLUDED_PARTS = {
    ".next",
    ".venv",
    "__pycache__",
    "dist",
    "logs",
    "node_modules",
    "output",
    "tmp",
    "work",
}

SENSITIVE_PATTERN = re.compile(
    r"(OPENAI_API_KEY|ANTHROPIC_API_KEY|AZURE_OPENAI|SECRET_KEY|JWT_SECRET|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH|sk-[A-Za-z0-9_-]{20,})"
)


def is_allowed_file(path: Path) -> bool:
    return path.suffix in ALLOWED_SUFFIXES or path.name.startswith(".env")


def is_excluded(path: Path) -> bool:
    return bool(EXCLUDED_PARTS.intersection(path.parts))


def iter_scan_files() -> list[Path]:
    files: list[Path] = []
    for target in TARGET_PATHS:
        path = REPO_ROOT / target
        if not path.exists():
            continue
        if path.is_file():
            if is_allowed_file(path) and not is_excluded(path):
                files.append(path)
            continue
        files.extend(
            file
            for file in path.rglob("*")
            if file.is_file() and is_allowed_file(file) and not is_excluded(file)
        )
    return files


def main() -> int:
    print("Running RAGPilot secret scan...")

    matches: list[str] = []
    for file in iter_scan_files():
        try:
            lines = file.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError as exc:
            print(f"Secret scan could not read '{file}': {exc}", file=sys.stderr)
            return 2

        for line_number, line in enumerate(lines, start=1):
            if SENSITIVE_PATTERN.search(line):
                relative_path = file.relative_to(REPO_ROOT).as_posix()
                matches.append(f"{relative_path}:{line_number}:{line}")

    if matches:
        print("")
        print("Potential sensitive matches found:")
        for match in matches:
            print(match)
        return 1

    print("No sensitive key patterns found in tracked source and documentation scope.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
