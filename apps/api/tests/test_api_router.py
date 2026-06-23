from ragpilot_api.presentation.http.v1.api_router import api_router


def test_core_resource_routes_are_registered() -> None:
    route_paths = {route.path for route in api_router.routes}

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
    assert "/workflow-runs/{workflow_run_id}/retry" in route_paths
