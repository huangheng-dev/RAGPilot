"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFormActions, DialogFormField, FormDialog } from "@/components/ui/form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import {
  listMcpConnectorTools,
  updateToolRegistration,
  type McpRemoteTool,
  type PlatformMcpConnector,
  type PlatformToolRegistration,
} from "@/lib/platform-governance";

type Props = {
  connectors: PlatformMcpConnector[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  open: boolean;
  tools: PlatformToolRegistration[];
};

export function McpToolMappingDialog({ connectors, onClose, onSaved, open, tools }: Props) {
  const { t } = useI18n();
  const mcpTools = useMemo(() => tools.filter((tool) => tool.transport_type === "mcp_reserved"), [tools]);
  const [toolId, setToolId] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [remoteToolName, setRemoteToolName] = useState("");
  const [remoteTools, setRemoteTools] = useState<McpRemoteTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTool = mcpTools.find((tool) => tool.id === toolId) ?? null;
  const selectedConnector = connectors.find((connector) => connector.id === connectorId) ?? null;

  useEffect(() => {
    if (!open) return;
    const initialTool = mcpTools[0] ?? null;
    const initialConnector = connectors.find((connector) => connector.slug === initialTool?.connector_reference) ?? connectors[0] ?? null;
    setToolId(initialTool?.id ?? "");
    setConnectorId(initialConnector?.id ?? "");
    setRemoteToolName(initialTool?.capabilities.find((value) => value.startsWith("mcp_tool:"))?.slice(9) ?? "");
    setRemoteTools([]);
    setError(null);
  }, [connectors, mcpTools, open]);

  async function discoverTools(nextConnectorId = connectorId) {
    if (!nextConnectorId) return;
    setIsLoading(true);
    setError(null);
    try {
      const catalog = await listMcpConnectorTools(nextConnectorId);
      setRemoteTools(catalog.tools);
      if (!catalog.tools.some((tool) => tool.name === remoteToolName)) setRemoteToolName(catalog.tools[0]?.name ?? "");
    } catch (reason) {
      setRemoteTools([]);
      setError(reason instanceof Error ? reason.message : t("agents.mcpMapping.discoveryFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  async function saveMapping() {
    if (!selectedTool || !selectedConnector || !remoteToolName) return;
    setIsLoading(true);
    setError(null);
    try {
      await updateToolRegistration(selectedTool.id, {
        name: selectedTool.name,
        slug: selectedTool.slug,
        transport_type: selectedTool.transport_type,
        surface_area: selectedTool.surface_area,
        endpoint_url: selectedTool.endpoint_url,
        connector_reference: selectedConnector.slug,
        description: selectedTool.description,
        capabilities: [...selectedTool.capabilities.filter((value) => !value.startsWith("mcp_tool:")), `mcp_tool:${remoteToolName}`],
        requires_admin_approval: selectedTool.requires_admin_approval,
        is_enabled: selectedTool.is_enabled,
      });
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("agents.mcpMapping.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <FormDialog open={open} onClose={onClose} title={t("agents.mcpMapping.title")} description={t("agents.mcpMapping.description")} footer={<DialogFormActions><Button onClick={onClose} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button><Button disabled={isLoading || !remoteToolName} onClick={() => void saveMapping()} type="button">{t("agents.mcpMapping.save")}</Button></DialogFormActions>}>
      <DialogFormField label={t("agents.mcpMapping.registration")}><Select value={toolId} onValueChange={setToolId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{mcpTools.map((tool) => <SelectItem key={tool.id} value={tool.id}>{tool.name}</SelectItem>)}</SelectContent></Select></DialogFormField>
      <DialogFormField label={t("agents.mcpMapping.connector")}><Select value={connectorId} onValueChange={(value) => { setConnectorId(value); setRemoteTools([]); setRemoteToolName(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{connectors.filter((connector) => connector.connector_type === "streamable_http").map((connector) => <SelectItem key={connector.id} value={connector.id}>{connector.name}</SelectItem>)}</SelectContent></Select></DialogFormField>
      <Button disabled={isLoading || !connectorId} onClick={() => void discoverTools()} type="button" variant="outline">{isLoading ? t("agents.mcpMapping.discovering") : t("agents.mcpMapping.discover")}</Button>
      <DialogFormField label={t("agents.mcpMapping.remoteTool")}><Select disabled={remoteTools.length === 0} value={remoteToolName} onValueChange={setRemoteToolName}><SelectTrigger><SelectValue placeholder={t("agents.mcpMapping.remoteToolPlaceholder")} /></SelectTrigger><SelectContent>{remoteTools.map((tool) => <SelectItem key={tool.name} value={tool.name}>{tool.name}</SelectItem>)}</SelectContent></Select></DialogFormField>
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
    </FormDialog>
  );
}
