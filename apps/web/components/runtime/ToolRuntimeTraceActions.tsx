"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { buildAgentsHref, buildToolTraceSettingsHref } from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";

import { readToolTraceConnectorReference, type ToolRuntimeTraceRecord } from "./ToolRuntimeSummaryCard";

export function ToolRuntimeTraceActions({
  trace,
  tenantId = null
}: {
  trace: ToolRuntimeTraceRecord;
  tenantId?: string | null;
}) {
  const { t } = useI18n();
  const settingsHref = buildToolTraceSettingsHref({
    toolRegistrationId: trace.tool_registration_id,
    governanceIssue: trace.governance_issue ?? null,
    connectorReference: readToolTraceConnectorReference(trace)
  });
  const boundAgentsHref = buildAgentsHref({
    tenantId,
    status: "active",
    toolRegistrationId: trace.tool_registration_id
  });

  if (trace.governance_issue === "approval_required") {
    return (
      <>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link
            href={buildAgentsHref({
              tenantId,
              status: "active",
              issue: "tool_approval_required",
              toolRegistrationId: trace.tool_registration_id
            })}
          >
            {t("settings.tools.auditActions.openApprovalAgents")}
          </Link>
        </Button>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={settingsHref}>{t("settings.tools.auditActions.openToolSettings")}</Link>
        </Button>
      </>
    );
  }

  if (trace.governance_issue === "tool_disabled") {
    return (
      <>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link
            href={buildAgentsHref({
              tenantId,
              status: "active",
              readiness: "attention",
              issue: "tool_registration_disabled",
              toolRegistrationId: trace.tool_registration_id
            })}
          >
            {t("settings.tools.auditActions.openImpactedAgents")}
          </Link>
        </Button>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={settingsHref}>{t("settings.tools.auditActions.openToolSettings")}</Link>
        </Button>
      </>
    );
  }

  if (trace.governance_issue === "mcp_reserved") {
    return (
      <>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={settingsHref}>{t("settings.tools.auditActions.reviewReservedTransport")}</Link>
        </Button>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={boundAgentsHref}>{t("settings.tools.auditActions.openBoundAgents")}</Link>
        </Button>
      </>
    );
  }

  if (trace.governance_issue === "mcp_integration_pending") {
    return (
      <>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={settingsHref}>{t("settings.tools.auditActions.reviewIntegrationPending")}</Link>
        </Button>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={boundAgentsHref}>{t("settings.tools.auditActions.openBoundAgents")}</Link>
        </Button>
      </>
    );
  }

  if (trace.governance_issue === "endpoint_failure" || trace.governance_issue === "runtime_failure") {
    return (
      <>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={settingsHref}>{t("settings.tools.auditActions.reviewToolRuntime")}</Link>
        </Button>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={boundAgentsHref}>{t("settings.tools.auditActions.openBoundAgents")}</Link>
        </Button>
      </>
    );
  }

  return null;
}
