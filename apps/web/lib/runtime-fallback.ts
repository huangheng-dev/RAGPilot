import type { ModelProviderRuntimePosture } from "@/lib/platform-governance";

export type RuntimeFallbackReasonCode =
  | "configured_model_endpoint_missing"
  | "model_endpoint_disabled"
  | "model_endpoint_missing_chat_capability"
  | "model_endpoint_not_runtime_ready"
  | "model_endpoint_unsupported_credential_mode"
  | "model_endpoint_unavailable"
  | "unknown";

export type RuntimeFallbackSource = "default_model_endpoint" | "settings" | null;

export type NormalizedRuntimeProviderType =
  | "deterministic"
  | "openai_compatible"
  | "ollama"
  | "vllm";

export type ParsedRuntimeFallbackReason = {
  code: RuntimeFallbackReasonCode;
  source: RuntimeFallbackSource;
};

export function normalizeRuntimeProviderType(
  providerType: string | null | undefined
): NormalizedRuntimeProviderType | null {
  const normalized = providerType?.trim().toLowerCase() ?? "";
  if (normalized === "deterministic") {
    return "deterministic";
  }
  if (normalized === "openai_compatible") {
    return "openai_compatible";
  }
  if (normalized === "ollama" || normalized === "ollama_reserved") {
    return "ollama";
  }
  if (normalized === "vllm" || normalized === "vllm_reserved") {
    return "vllm";
  }
  return null;
}

export function parseRuntimeFallbackReason(
  fallbackReason: string | null | undefined
): ParsedRuntimeFallbackReason | null {
  const normalized = fallbackReason?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }

  const [rawCode, rawSource] = normalized.split(":");
  const source =
    rawSource === "default_model_endpoint" || rawSource === "settings"
      ? rawSource
      : null;

  switch (rawCode) {
    case "configured_model_endpoint_missing":
    case "model_endpoint_disabled":
    case "model_endpoint_missing_chat_capability":
    case "model_endpoint_not_runtime_ready":
    case "model_endpoint_unsupported_credential_mode":
    case "model_endpoint_unavailable":
      return { code: rawCode, source };
    default:
      return { code: "unknown", source };
  }
}

export function isRuntimeFallbackGovernanceIssue(
  reason: ParsedRuntimeFallbackReason | null
) {
  if (!reason) {
    return false;
  }

  return (
    reason.code === "configured_model_endpoint_missing" ||
    reason.code === "model_endpoint_disabled" ||
    reason.code === "model_endpoint_missing_chat_capability" ||
    reason.code === "model_endpoint_not_runtime_ready" ||
    reason.code === "model_endpoint_unsupported_credential_mode" ||
    reason.code === "model_endpoint_unavailable"
  );
}

export function isRuntimeFallbackConfigurationIssue(
  reason: ParsedRuntimeFallbackReason | null
) {
  if (!reason) {
    return false;
  }

  return reason.code === "model_endpoint_not_runtime_ready";
}

export function resolveRuntimeFallbackAgentIssue(
  reason: ParsedRuntimeFallbackReason | null
) {
  if (!reason) {
    return null;
  }

  if (reason.code === "model_endpoint_not_runtime_ready") {
    return "model_runtime_unconfigured" as const;
  }

  if (reason.code === "model_endpoint_disabled") {
    return "model_disabled" as const;
  }

  return null;
}

export function formatRuntimeFallbackReason(
  fallbackReason: string | null | undefined,
  t: (key: string, variables?: Record<string, string>) => string
) {
  const parsedReason = parseRuntimeFallbackReason(fallbackReason);
  if (!parsedReason) {
    return null;
  }

  const reasonLabel = t(`agents.executions.runtimeFallbackReasons.${parsedReason.code}`);
  if (!parsedReason.source) {
    return reasonLabel;
  }

  return t("agents.executions.runtimeFallbackReasonWithTarget", {
    reason: reasonLabel,
    target: t(`agents.executions.runtimeFallbackTargets.${parsedReason.source}`),
  });
}

export function resolveProviderPostureStatusTone(
  posture: ModelProviderRuntimePosture | null | undefined
) {
  if (!posture) {
    return "pending" as const;
  }
  if (posture.posture_status === "ready") {
    return "healthy" as const;
  }
  if (posture.posture_status === "attention") {
    return "attention" as const;
  }
  return "pending" as const;
}
