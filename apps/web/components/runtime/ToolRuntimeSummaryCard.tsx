"use client";

import type { ReactNode } from "react";

import { ConsoleOutlineBadge } from "@/components/console/ConsolePrimitives";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type ToolRuntimeTraceRecord = {
  tool_registration_id: string;
  name: string;
  slug?: string;
  endpoint_url?: string | null;
  invocation_status: string;
  governance_issue?: string | null;
  summary: string;
  error_message?: string | null;
  request_metadata?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
};

export type ToolRuntimeSummaryRecord = {
  total_bound_tools?: number;
  completed_tools?: number;
  blocked_tools?: number;
  failed_tools?: number;
  reserved_tools?: number;
  unavailable_tools?: number;
  skipped_tools?: number;
  traces?: ToolRuntimeTraceRecord[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readToolRuntimeTrace(value: unknown): ToolRuntimeTraceRecord | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const toolRegistrationId = readString(record.tool_registration_id);
  const name = readString(record.name);
  const invocationStatus = readString(record.invocation_status);
  const summary = readString(record.summary);
  if (!toolRegistrationId || !name || !invocationStatus || !summary) {
    return null;
  }

  return {
    tool_registration_id: toolRegistrationId,
    name,
    slug: readOptionalString(record.slug) ?? undefined,
    endpoint_url: readOptionalString(record.endpoint_url),
    invocation_status: invocationStatus,
    governance_issue: readOptionalString(record.governance_issue),
    summary,
    error_message: readOptionalString(record.error_message),
    request_metadata: asRecord(record.request_metadata) ?? {},
    response_metadata: asRecord(record.response_metadata) ?? {}
  };
}

export function readToolTraceConnectorReference(trace: ToolRuntimeTraceRecord) {
  const responseConnectorReference = readOptionalString(trace.response_metadata?.connector_reference);
  if (responseConnectorReference && responseConnectorReference.trim().length > 0) {
    return responseConnectorReference.trim();
  }

  const requestConnectorReference = readOptionalString(trace.request_metadata?.connector_reference);
  if (requestConnectorReference && requestConnectorReference.trim().length > 0) {
    return requestConnectorReference.trim();
  }

  return null;
}

export function readToolRuntimeSummary(resultPayload: Record<string, unknown>): ToolRuntimeSummaryRecord | null {
  const toolRuntimeRecord = asRecord(resultPayload.tool_runtime);
  if (!toolRuntimeRecord) {
    return null;
  }

  const traces = Array.isArray(toolRuntimeRecord.traces)
    ? toolRuntimeRecord.traces.map(readToolRuntimeTrace).filter((trace): trace is ToolRuntimeTraceRecord => trace !== null)
    : [];

  return {
    total_bound_tools: readNumber(toolRuntimeRecord.total_bound_tools),
    completed_tools: readNumber(toolRuntimeRecord.completed_tools),
    blocked_tools: readNumber(toolRuntimeRecord.blocked_tools),
    failed_tools: readNumber(toolRuntimeRecord.failed_tools),
    reserved_tools: readNumber(toolRuntimeRecord.reserved_tools),
    unavailable_tools: readNumber(toolRuntimeRecord.unavailable_tools),
    skipped_tools: readNumber(toolRuntimeRecord.skipped_tools),
    traces
  };
}

export function getToolInvocationStatusClass(status: string) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "blocked") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "reserved") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (status === "unavailable") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function ToolRuntimeSummaryCard({
  summary,
  title,
  maxTraces = 3,
  renderTraceActions
}: {
  summary: ToolRuntimeSummaryRecord;
  title?: string;
  maxTraces?: number;
  renderTraceActions?: (trace: ToolRuntimeTraceRecord) => ReactNode;
}) {
  const { t } = useI18n();
  const traces = Array.isArray(summary.traces) ? summary.traces.slice(0, maxTraces) : [];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-950">
          {title ?? t("agents.executions.toolRuntime.title")}
        </div>
        <div className="flex flex-wrap gap-2">
          <ConsoleOutlineBadge>
            {t("agents.executions.toolRuntime.traces", {
              count: String(summary.total_bound_tools ?? traces.length)
            })}
          </ConsoleOutlineBadge>
          {summary.completed_tools ? (
            <ConsoleOutlineBadge>
              {t("agents.executions.toolRuntime.completed", { count: String(summary.completed_tools) })}
            </ConsoleOutlineBadge>
          ) : null}
          {summary.blocked_tools ? (
            <ConsoleOutlineBadge>
              {t("agents.executions.toolRuntime.blocked", { count: String(summary.blocked_tools) })}
            </ConsoleOutlineBadge>
          ) : null}
          {summary.failed_tools ? (
            <ConsoleOutlineBadge>
              {t("agents.executions.toolRuntime.failed", { count: String(summary.failed_tools) })}
            </ConsoleOutlineBadge>
          ) : null}
          {summary.reserved_tools ? (
            <ConsoleOutlineBadge>
              {t("agents.executions.toolRuntime.reserved", { count: String(summary.reserved_tools) })}
            </ConsoleOutlineBadge>
          ) : null}
          {summary.unavailable_tools ? (
            <ConsoleOutlineBadge>
              {t("agents.executions.toolRuntime.unavailable", { count: String(summary.unavailable_tools) })}
            </ConsoleOutlineBadge>
          ) : null}
          {summary.skipped_tools ? (
            <ConsoleOutlineBadge>
              {t("agents.executions.toolRuntime.skipped", { count: String(summary.skipped_tools) })}
            </ConsoleOutlineBadge>
          ) : null}
        </div>
      </div>
      {traces.length > 0 ? (
        <div className="mt-4 space-y-3">
          {traces.map((trace, index) => {
            const attemptCount = readNumber(trace.request_metadata?.attempt_count);
            const statusCode = readNumber(trace.response_metadata?.status_code);
            const traceActions = renderTraceActions ? renderTraceActions(trace) : null;

            return (
              <div
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3"
                key={`${trace.tool_registration_id}-${trace.invocation_status}-${index}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{trace.name}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">{trace.summary}</div>
                  </div>
                  <Badge className={cn("border", getToolInvocationStatusClass(trace.invocation_status))} variant="outline">
                    {t(`agents.executions.toolRuntime.statuses.${trace.invocation_status}`)}
                  </Badge>
                </div>
                {trace.error_message ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                    {trace.error_message}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {attemptCount > 1 ? (
                    <ConsoleOutlineBadge>
                      {t("agents.executions.toolRuntime.attempts", { count: String(attemptCount) })}
                    </ConsoleOutlineBadge>
                  ) : null}
                  {statusCode > 0 ? (
                    <ConsoleOutlineBadge>
                      {t("agents.executions.toolRuntime.httpStatus", { status: String(statusCode) })}
                    </ConsoleOutlineBadge>
                  ) : null}
                </div>
                {traceActions ? <div className="mt-3 flex flex-wrap gap-2">{traceActions}</div> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-500">
          {t("agents.executions.toolRuntime.empty")}
        </div>
      )}
    </div>
  );
}
