import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import AgentsConsolePage from "@/components/agents/AgentsConsolePage";

export const metadata: Metadata = {
  title: "Agents"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProtectedRoute requiredPermission="access_agents">
        <AgentsConsolePage />
      </ProtectedRoute>
    </Suspense>
  );
}
