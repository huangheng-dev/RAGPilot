import re
from pathlib import Path

from ragpilot_api.infrastructure.database.models import Base
from ragpilot_api.main import app


HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}


def test_api_outline_matches_actual_fastapi_route_inventory() -> None:
    repository_root = Path(__file__).resolve().parents[3]
    outline = (repository_root / "docs" / "api" / "api-outline.md").read_text(
        encoding="utf-8"
    )
    documented_routes: set[tuple[str, str]] = set()
    for method, documented_path in re.findall(
        r"^- `([A-Z]+) ([^`]+)`", outline, re.MULTILINE
    ):
        path = documented_path.split(" ", 1)[0]
        documented_routes.add(
            (method, path if path == "/" else f"/api/v1{path}")
        )

    actual_routes = {
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
        if method.upper() in HTTP_METHODS
    }

    assert documented_routes == actual_routes, (
        f"Missing from docs: {sorted(actual_routes - documented_routes)}; "
        f"documented but absent: {sorted(documented_routes - actual_routes)}"
    )


def test_platform_data_model_lists_every_current_orm_table() -> None:
    repository_root = Path(__file__).resolve().parents[3]
    data_model = (
        repository_root / "docs" / "architecture" / "platform-data-model.md"
    ).read_text(encoding="utf-8")
    current_tables_section = data_model.split("## Current Tables", 1)[1].split(
        "## Important Relationships", 1
    )[0]
    documented_tables = set(
        re.findall(r"^- `([a-z][a-z0-9_]*)`$", current_tables_section, re.MULTILINE)
    )
    actual_tables = set(Base.metadata.tables)

    assert documented_tables == actual_tables, (
        f"Missing from docs: {sorted(actual_tables - documented_tables)}; "
        f"documented but absent: {sorted(documented_tables - actual_tables)}"
    )
