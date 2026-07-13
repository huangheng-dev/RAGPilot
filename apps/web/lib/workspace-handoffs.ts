import { buildWorkspaceHref, type WorkspaceHandoffIntent, type WorkspaceNavigationTarget } from "@/lib/workspace-navigation";

type AgentMode = "grounded_chat" | "document_intake" | "workflow_recovery";
type WorkspaceView = "chat" | "documents" | "workflows";
type WorkspaceSourceContext =
  | {
      sourceSurface: "home";
    }
  | {
      sourceSurface: "agents";
    }
  | {
      sourceSurface: "admin";
      sourceAdminSection: "overview" | "directory" | "access" | "runtime" | "security";
    }
  | {
      sourceSurface: "operations";
      sourceOperationsLane: "overview" | "failed" | "retries" | "pressure";
    };

type WorkspaceHandoffTarget = Omit<
  WorkspaceNavigationTarget,
  "sourceSurface" | "sourceAdminSection" | "sourceOperationsLane" | "handoffIntent"
> & {
  handoffIntent?: WorkspaceHandoffIntent | null;
};

export function buildWorkspaceHandoffHref(sourceContext: WorkspaceSourceContext, target: WorkspaceHandoffTarget) {
  return buildWorkspaceHref({
    ...target,
    ...sourceContext
  });
}

export function buildHomeWorkspaceHref(target: WorkspaceHandoffTarget) {
  return buildWorkspaceHandoffHref({ sourceSurface: "home" }, target);
}

export function buildAgentsWorkspaceHref(target: WorkspaceHandoffTarget) {
  return buildWorkspaceHandoffHref({ sourceSurface: "agents" }, target);
}

export function buildAdminWorkspaceHref(
  section: "overview" | "directory" | "access" | "runtime" | "security",
  target: WorkspaceHandoffTarget
) {
  return buildWorkspaceHandoffHref(
    {
      sourceSurface: "admin",
      sourceAdminSection: section
    },
    target
  );
}

export function buildOperationsWorkspaceHref(
  lane: "overview" | "failed" | "retries" | "pressure",
  target: WorkspaceHandoffTarget
) {
  return buildWorkspaceHandoffHref(
    {
      sourceSurface: "operations",
      sourceOperationsLane: lane
    },
    target
  );
}

export function resolveAgentWorkspaceHandoffIntent(mode: AgentMode, view: WorkspaceView): WorkspaceHandoffIntent {
  if (mode === "workflow_recovery") {
    if (view === "documents") {
      return "document_recovery";
    }

    return "workflow_recovery";
  }

  return "agent_brief";
}
