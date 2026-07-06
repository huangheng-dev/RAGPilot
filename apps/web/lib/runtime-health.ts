import { useCallback, useEffect, useState } from "react";
import { apiBaseUrl } from "@/lib/authenticated-api";

export type RuntimeHealthSnapshot = {
  service: string;
  status: string;
  environment: string;
  version: string;
  retrieval_engine: string;
  agent_runtime_engine: string;
  llamaindex_pilot_ready: boolean;
  langgraph_pilot_ready: boolean;
  chat_model_provider: string;
  chat_model_name: string;
  effective_chat_model_provider: string;
  effective_chat_model_name: string;
  effective_chat_model_source: string;
  effective_chat_model_endpoint_name: string | null;
  effective_chat_model_api_base_url: string | null;
};

export async function fetchRuntimeHealth(): Promise<RuntimeHealthSnapshot> {
  const response = await fetch(`${apiBaseUrl}/health`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}.`);
  }

  return (await response.json()) as RuntimeHealthSnapshot;
}

export function useRuntimeHealth(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealthSnapshot | null>(null);
  const [isLoadingRuntimeHealth, setIsLoadingRuntimeHealth] = useState(false);
  const [runtimeHealthErrorMessage, setRuntimeHealthErrorMessage] = useState<string | null>(null);

  const reloadRuntimeHealth = useCallback(async () => {
    if (!enabled) {
      setRuntimeHealth(null);
      setRuntimeHealthErrorMessage(null);
      setIsLoadingRuntimeHealth(false);
      return;
    }

    try {
      setIsLoadingRuntimeHealth(true);
      setRuntimeHealthErrorMessage(null);
      const payload = await fetchRuntimeHealth();
      setRuntimeHealth(payload);
    } catch (error) {
      setRuntimeHealth(null);
      setRuntimeHealthErrorMessage(error instanceof Error ? error.message : "Runtime health could not be loaded.");
    } finally {
      setIsLoadingRuntimeHealth(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reloadRuntimeHealth();
  }, [reloadRuntimeHealth]);

  return {
    runtimeHealth,
    isLoadingRuntimeHealth,
    runtimeHealthErrorMessage,
    reloadRuntimeHealth
  };
}
