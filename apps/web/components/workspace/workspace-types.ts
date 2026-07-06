export type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export type Workspace = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_archived?: boolean;
};

export type KnowledgeBase = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description?: string | null;
  retrieval_profile_id?: string | null;
  retrieval_profile_name?: string | null;
  publication_status?: string;
};

export type WorkspaceAgentContext = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  mode: "grounded_chat" | "document_intake" | "workflow_recovery";
  status: "draft" | "active" | "paused";
  objective: string;
  knowledge_base_scope: string | null;
  tools: Array<"chat" | "documents" | "operations" | "admin">;
  runtime_governance: WorkspaceAgentRuntimeGovernance | null;
};

export type WorkspaceAgentRuntimeResolvedScope = {
  workspace_id: string | null;
  workspace_slug: string | null;
  workspace_name: string | null;
  knowledge_base_id: string | null;
  knowledge_base_slug: string | null;
  knowledge_base_name: string | null;
  scope_issue: "scope_missing" | "scope_invalid" | null;
};

export type WorkspaceAgentRuntimeResolvedModelEndpoint = {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  model_name: string;
  base_url: string | null;
  credential_mode: string;
  credential_key_hint: string | null;
  capabilities: string[];
  is_enabled: boolean;
  is_default: boolean;
  runtime_ready: boolean;
  runtime_issue: "missing_base_url" | "missing_credential_hint" | "managed_reserved" | null;
  recent_preview_completed_events: number;
  recent_preview_blocked_events: number;
  recent_preview_failed_events: number;
  last_preview_status: "completed" | "blocked" | "failed" | null;
  last_preview_at: string | null;
};

export type WorkspaceAgentRuntimeResolvedRetrievalProfile = {
  id: string;
  name: string;
  slug: string;
  retrieval_mode: string;
  is_enabled: boolean;
  is_default: boolean;
  source: "knowledge_base" | "platform_default";
};

export type WorkspaceAgentRuntimeGovernance = {
  is_ready: boolean;
  issues: Array<
    | "model_missing"
    | "model_disabled"
    | "model_runtime_unconfigured"
    | "retrieval_profile_missing"
    | "retrieval_profile_disabled"
    | "scope_missing"
    | "scope_invalid"
    | "tools_missing"
    | "tool_registration_disabled"
    | "tool_approval_required"
    | "tool_mcp_reserved"
    | "tool_mcp_integration_pending"
  >;
  blocking_issues: Array<
    | "model_missing"
    | "model_disabled"
    | "model_runtime_unconfigured"
    | "retrieval_profile_missing"
    | "retrieval_profile_disabled"
    | "scope_missing"
    | "scope_invalid"
    | "tools_missing"
    | "tool_registration_disabled"
    | "tool_approval_required"
    | "tool_mcp_reserved"
    | "tool_mcp_integration_pending"
  >;
  approval_required_tool_count: number;
  disabled_registered_tool_count: number;
  missing_tool_registration_count: number;
  reserved_mcp_tool_count: number;
  integration_pending_mcp_tool_count: number;
  disabled_tool_registration_id: string | null;
  approval_required_tool_registration_id: string | null;
  reserved_mcp_tool_registration_id: string | null;
  integration_pending_mcp_tool_registration_id: string | null;
  integration_pending_mcp_connector_reference: string | null;
  focus_tool_registration: {
    id: string;
    name: string;
    slug: string;
    transport_type: "native" | "http" | "mcp_reserved";
    surface_area: "chat" | "documents" | "operations" | "admin" | "agents";
    endpoint_url: string | null;
    connector_reference: string | null;
    requires_admin_approval: boolean;
    is_enabled: boolean;
    recent_preview_completed_events: number;
    recent_preview_blocked_events: number;
    recent_preview_failed_events: number;
    last_preview_status: "completed" | "blocked" | "failed" | null;
    last_preview_at: string | null;
  } | null;
  focus_mcp_connector: {
    id: string;
    name: string;
    slug: string;
    connector_type: "streamable_http" | "sse" | "managed_reserved";
    base_url: string | null;
    auth_mode: "none" | "environment" | "managed_reserved";
    credential_key_hint: string | null;
    is_enabled: boolean;
    recent_preview_completed_events: number;
    recent_preview_blocked_events: number;
    recent_preview_failed_events: number;
    last_preview_status: "completed" | "blocked" | "failed" | null;
    last_preview_at: string | null;
  } | null;
  resolved_scope: WorkspaceAgentRuntimeResolvedScope;
  resolved_model_endpoint: WorkspaceAgentRuntimeResolvedModelEndpoint | null;
  resolved_retrieval_profile: WorkspaceAgentRuntimeResolvedRetrievalProfile | null;
};

export type WorkspaceAgentRecommendationReason =
  | "document-ready-for-grounded-chat"
  | "document-needs-intake"
  | "document-needs-recovery"
  | "workflow-completed"
  | "workflow-in-progress"
  | "workflow-failed";

export type WorkspaceAgentRecommendation = {
  agent: WorkspaceAgentContext;
  reason: WorkspaceAgentRecommendationReason;
  score: number;
  scopeMatched: boolean;
  capabilityCount: number;
  targetView: WorkspaceView;
};

export type Conversation = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id: string | null;
  title: string;
  created_by_user_id: string | null;
  message_count: number;
  latest_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Citation = {
  id: string;
  document_chunk_id: string;
  document_id: string | null;
  document_title: string | null;
  document_version_id: string | null;
  knowledge_base_id: string | null;
  chunk_index: number | null;
  rank: number;
  score: number | null;
  retrieval_method: string | null;
  vector_score: number | null;
  lexical_score: number | null;
  lexical_normalized_score: number | null;
  quote: string | null;
};

export type MessageFeedback = {
  id: string;
  message_id: string;
  submitted_by_user_id: string;
  answer_quality: "helpful" | "partially_helpful" | "not_helpful";
  citation_quality: "grounded" | "partial" | "broken";
  issue_labels: string[];
  feedback_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageFeedbackSummaryItem = MessageFeedback & {
  conversation_id: string;
  conversation_title: string;
  assistant_excerpt: string;
  knowledge_base_id: string | null;
  latest_user_question: string | null;
  retrieval_profile_id: string | null;
  retrieval_profile_name: string | null;
  follow_up_status: "pending" | "resolved";
  recommended_actions: Array<{
    action_key:
      | "review_knowledge_base_governance"
      | "review_retrieval_profile_governance"
      | "rerun_retrieval_comparison"
      | "validate_in_chat";
    action_category: "governance" | "analysis" | "validation";
    action_label: string;
    action_reason: string;
  }>;
};

export type MessageFeedbackSummary = {
  total_feedback: number;
  helpful_feedback: number;
  partially_helpful_feedback: number;
  not_helpful_feedback: number;
  citation_issue_feedback: number;
  retrieval_tuning_candidates: number;
  recent_feedback: MessageFeedbackSummaryItem[];
};

export type Message = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  model_name: string | null;
  usage_json: Record<string, unknown>;
  created_at: string;
  citations: Citation[];
  feedback_entries: MessageFeedback[];
};

export type ChatAskResponse = {
  conversation: Conversation;
  user_message: Message;
  assistant_message: Message;
};

export type WorkflowRun = {
  id: string;
  tenant_id: string;
  workflow_type: string;
  workflow_status: string;
  retry_of_workflow_run_id: string | null;
  temporal_workflow_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  subject_label: string | null;
  subject_workspace_id: string | null;
  subject_knowledge_base_id: string | null;
  root_workflow_run_id: string | null;
  latest_child_retry_run_id: string | null;
  latest_child_retry_status: string | null;
  active_child_retry_run_id: string | null;
  has_active_retry_child: boolean;
  retry_depth: number;
  child_retry_run_count: number;
  max_retry_depth: number;
  remaining_retry_attempts: number;
  error_message: string | null;
  operator_notes: string | null;
  is_retry_available: boolean;
  retry_unavailable_reason: string | null;
  total_step_count: number;
  completed_step_count: number;
  failed_step_count: number;
  active_step_count: number;
  pending_step_count: number;
  latest_active_step_name: string | null;
  latest_active_step_started_at: string | null;
  latest_completed_step_name: string | null;
  latest_completed_step_completed_at: string | null;
  highest_attempt_step_name: string | null;
  highest_attempt_count: number;
  latest_failed_step_name: string | null;
  latest_failed_step_error_message: string | null;
  failure_category:
    | "source_deleted"
    | "source_missing"
    | "parser_failure"
    | "embedding_failure"
    | "indexing_failure"
    | "runtime_timeout"
    | "runtime_capacity"
    | "unknown"
    | null;
  failure_recommended_action:
    | "review_document_source"
    | "review_parser_path"
    | "review_runtime"
    | "review_indexing"
    | "retry_when_ready"
    | "inspect_workflow"
    | null;
  failure_recommended_view: "chat" | "documents" | "workflows" | null;
  failure_recommended_primary_action:
    | "retry_workflow"
    | "open_workflows"
    | "open_document"
    | "open_chat"
    | "monitor_workflow"
    | null;
  failure_focus_step_name: string | null;
  failure_focus_error_message: string | null;
  failure_focus_attempt_count: number;
  recovery_actions: WorkflowRecoveryAction[];
  recovery_event_count: number;
  latest_recovery_event_at: string | null;
  recovery_stage:
    | "retry_available"
    | "retry_blocked_document_deleted"
    | "retry_blocked_document_missing"
    | "retry_blocked_unsupported"
    | "active_monitoring"
    | "completed_ready_for_chat"
    | "review_workflow"
    | null;
  recommended_next_view: "chat" | "documents" | "workflows" | null;
  recommended_primary_action:
    | "retry_workflow"
    | "open_workflows"
    | "open_document"
    | "open_chat"
    | "monitor_workflow"
    | null;
  follow_up_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowStep = {
  id: string;
  tenant_id: string;
  workflow_run_id: string;
  step_name: string;
  step_status: string;
  attempt_count: number;
  error_message: string | null;
  failure_category:
    | "source_deleted"
    | "source_missing"
    | "parser_failure"
    | "embedding_failure"
    | "indexing_failure"
    | "runtime_timeout"
    | "runtime_capacity"
    | "unknown"
    | null;
  failure_recommended_action:
    | "review_document_source"
    | "review_parser_path"
    | "review_runtime"
    | "review_indexing"
    | "retry_when_ready"
    | "inspect_workflow"
    | null;
  failure_recommended_view: "chat" | "documents" | "workflows" | null;
  failure_recommended_primary_action:
    | "retry_workflow"
    | "open_workflows"
    | "open_document"
    | "open_chat"
    | "monitor_workflow"
    | null;
  recovery_actions: WorkflowRecoveryAction[];
  is_failure_focus: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowRunEvent = {
  id: string;
  tenant_id: string;
  workflow_run_id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action_type: "retry_requested" | "retry_blocked" | "retry_spawned" | "cancel_requested" | "operator_notes_updated";
  detail: Record<string, unknown>;
  created_at: string;
};

export type WorkflowRecoveryAction = {
  action_key:
    | "review_document_source"
    | "review_parser_path"
    | "review_runtime"
    | "review_indexing"
    | "retry_when_ready"
    | "inspect_workflow";
  target_view: "chat" | "documents" | "workflows" | null;
  target_primary_action:
    | "retry_workflow"
    | "open_workflows"
    | "open_document"
    | "open_chat"
    | "monitor_workflow"
    | null;
  is_primary: boolean;
  is_enabled: boolean;
  disabled_reason: string | null;
};

export type WorkflowRunDetail = WorkflowRun & {
  input_json: Record<string, unknown>;
  steps: WorkflowStep[];
  events: WorkflowRunEvent[];
};

export type WorkflowRunActionResponse = WorkflowRun & {
  retry_of_workflow_run_id: string | null;
};

export type DocumentRecord = {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  title: string;
  source_uri: string | null;
  source_kind: "file" | "web" | "other";
  ingestion_status: string;
  indexing_status: string;
  latest_version_number: number | null;
  latest_version_parser_name: string | null;
  latest_version_ingestion_status: string | null;
  latest_version_chunk_count: number | null;
  latest_version_token_count_total: number | null;
  latest_version_updated_at: string | null;
  latest_workflow_run_id: string | null;
  latest_workflow_type: string | null;
  latest_workflow_status: string | null;
  latest_workflow_error_message: string | null;
  latest_workflow_updated_at: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentSourceFilter = "all" | "file" | "web" | "other";

export type DocumentChunk = {
  id: string;
  tenant_id: string;
  document_version_id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type DocumentVersionSummary = {
  id: string;
  version_number: number;
  ingestion_status: string;
  parser_name: string | null;
  chunk_count: number;
  token_count_total: number;
  created_at: string;
  updated_at: string;
};

export type DocumentDetail = {
  document: DocumentRecord;
  document_version_id: string | null;
  parser_name: string | null;
  version_number: number | null;
  version_ingestion_status: string | null;
  content_hash: string | null;
  asset_file_name: string | null;
  asset_content_type: string | null;
  asset_file_size_bytes: number | null;
  storage_bucket: string | null;
  storage_key: string | null;
  latest_completed_version_id: string | null;
  latest_completed_version_number: number | null;
  latest_completed_version_ingestion_status: string | null;
  latest_completed_parser_name: string | null;
  chunk_count: number;
  token_count_total: number;
  recent_versions: DocumentVersionSummary[];
  chunks: DocumentChunk[];
};

export type DocumentWorkflowActionResponse = {
  document: DocumentRecord;
  workflow_run_id: string;
  workflow_status: string;
  temporal_workflow_id: string | null;
};

export type DocumentRestoreResponse = {
  document: DocumentRecord;
  restored_at: string;
};

export type DocumentMetrics = {
  total_documents: number;
  completed_documents: number;
  active_documents: number;
  failed_documents: number;
};

export type WorkflowMetrics = {
  total_runs: number;
  active_runs: number;
  queued_runs: number;
  running_runs: number;
  retry_runs: number;
  completed_runs: number;
  failed_runs: number;
  cancelled_runs: number;
};

export type ConversationMetrics = {
  total_conversations: number;
  active_conversations: number;
  total_messages: number;
  latest_activity_at: string | null;
};

export type BootstrapState = {
  tenant: Tenant;
  workspace: Workspace;
  knowledgeBase: KnowledgeBase;
};

export type WorkspaceCatalog = {
  tenants: Tenant[];
  workspaces: Workspace[];
  knowledgeBases: KnowledgeBase[];
};

export type WorkspaceView = "chat" | "documents" | "workflows";

export type DocumentLifecycleFilter = "active" | "deleted" | "all";

export type DocumentSortOrder =
  | "updated-desc"
  | "created-desc"
  | "created-asc"
  | "title-asc"
  | "title-desc"
  | "status-priority";

export type WorkflowSortOrder =
  | "updated-desc"
  | "created-desc"
  | "created-asc"
  | "status-priority"
  | "type-asc";

export type WorkflowRetryMode = "all" | "retries" | "originals";

export type ContextManagementPanel =
  | "tenant-create"
  | "tenant-edit"
  | "workspace-create"
  | "workspace-edit"
  | "knowledge-base-create"
  | "knowledge-base-edit"
  | null;

export type WorkspaceSelection = {
  tenantId?: string;
  workspaceId?: string;
  knowledgeBaseId?: string;
};

export type DocumentActivityEvent = {
  id: string;
  event_type: string;
  status: string;
  timestamp: string;
  workflow_run_id: string | null;
  retry_of_workflow_run_id: string | null;
  document_version_id: string | null;
  version_number: number | null;
  parser_name: string | null;
  chunk_count: number | null;
  token_count_total: number | null;
  error_message: string | null;
};

export type DocumentActivitySummary = {
  total_events: number;
  total_versions: number;
  workflow_runs: number;
  retry_runs: number;
  failed_events: number;
  latest_event_at: string | null;
};

export type DocumentActivity = {
  document_id: string;
  title: string;
  asset_file_name: string | null;
  summary: DocumentActivitySummary;
  events: DocumentActivityEvent[];
};

export type RetrievalValidationSummary = {
  mode: "inspect" | "compare";
  status: "ready" | "review" | "hold" | "empty" | "failed";
  queryText: string;
  detail: string;
  engineName: string | null;
  candidateEngineName: string | null;
  retrievalProfileName: string | null;
  resultCount: number;
  updatedAt: string;
};
