from ragpilot_api.presentation.http.v1.api_router import api_router


def collect_route_paths(routes: list[object], prefix: str = "") -> set[str]:
    route_paths: set[str] = set()

    for route in routes:
        path = getattr(route, "path", None)
        if isinstance(path, str):
            route_paths.add(f"{prefix}{path}")

        nested_router = getattr(route, "original_router", None)
        include_context = getattr(route, "include_context", None)
        nested_prefix = getattr(include_context, "prefix", "")
        nested_routes = getattr(nested_router, "routes", None)
        if nested_routes is not None:
            route_paths.update(collect_route_paths(nested_routes, f"{prefix}{nested_prefix}"))

    return route_paths


def test_core_resource_routes_are_registered() -> None:
    route_paths = collect_route_paths(api_router.routes)

    assert "/tenants" in route_paths
    assert "/tenants/{tenant_id}" in route_paths
    assert "/workspaces" in route_paths
    assert "/workspaces/{workspace_id}" in route_paths
    assert "/workspaces/{workspace_id}/lifecycle" in route_paths
    assert "/knowledge-bases" in route_paths
    assert "/knowledge-bases/{knowledge_base_id}" in route_paths
    assert "/knowledge-bases/{knowledge_base_id}/publication" in route_paths
    assert "/retrieval-profiles" in route_paths
    assert "/retrieval-profiles/{retrieval_profile_id}" in route_paths
    assert "/runtime-governance/events" in route_paths
    assert "/runtime-governance/worklist" in route_paths
    assert "/model-endpoints" in route_paths
    assert "/model-endpoints/{model_endpoint_id}" in route_paths
    assert "/tool-registrations" in route_paths
    assert "/tool-registrations/{tool_registration_id}" in route_paths
    assert "/documents" in route_paths
    assert "/documents/{document_id}" in route_paths
    assert "/documents/{document_id}/reindex" in route_paths
    assert "/retrieve" in route_paths
    assert "/chat/conversations" in route_paths
    assert "/chat/conversations/metrics" in route_paths
    assert "/chat/conversations/{conversation_id}" in route_paths
    assert "/chat/messages" in route_paths
    assert "/workflow-runs" in route_paths
    assert "/workflow-runs/{workflow_run_id}" in route_paths
    assert "/workflow-runs/{workflow_run_id}/steps" in route_paths
    assert "/workflow-runs/{workflow_run_id}/events" in route_paths
    assert "/workflow-runs/{workflow_run_id}/retry" in route_paths
    assert "/workflow-runs/{workflow_run_id}/cancel" in route_paths
